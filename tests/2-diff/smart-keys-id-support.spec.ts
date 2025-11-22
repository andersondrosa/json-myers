import { describe, it, expect } from "vitest";
import { diffJson } from "../../src/2-diff/diffJson";
import { patchJson } from "../../src/3-patch/patchJson";

describe("Smart Keys - Suporte a id e key", () => {
  describe("Prioridade key > id", () => {
    it("deve usar 'key' quando presente", () => {
      const original = [{ key: "foo", value: 1 }];
      const modified = [{ key: "foo", value: 2 }];

      const diff = diffJson(original, modified);

      expect(diff).toEqual({
        $__arrayOps: [],
        foo: { value: 2 },
      });
    });

    it("deve usar 'id' quando 'key' não existe", () => {
      const original = [{ id: 123, value: 1 }];
      const modified = [{ id: 123, value: 2 }];

      const diff = diffJson(original, modified);

      expect(diff).toEqual({
        $__arrayOps: [],
        "123": { value: 2 },
      });
    });

    it("deve priorizar 'key' mesmo quando 'id' existe", () => {
      const original = [{ key: "foo", id: 123, value: 1 }];
      const modified = [{ key: "foo", id: 123, value: 2 }];

      const diff = diffJson(original, modified);

      expect(diff).toEqual({
        $__arrayOps: [],
        foo: { value: 2 }, // Usa 'foo', não '123'
      });
    });
  });

  describe("Tipos de id", () => {
    it("deve aceitar id numérico", () => {
      const original = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      const modified = [
        { id: 2, name: "Bob" },
        { id: 1, name: "Alice Updated" },
      ];

      const diff = diffJson(original, modified);

      // Verifica que detectou mudança interna
      expect(diff["1"]).toEqual({ name: "Alice Updated" });

      // Verifica que gerou arrayOps (pode ser move ou remove+add)
      expect(diff.$__arrayOps.length).toBeGreaterThan(0);

      // O importante: patch funciona corretamente
      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });

    it("deve aceitar id string", () => {
      const original = [
        { id: "user-1", name: "Alice" },
        { id: "user-2", name: "Bob" },
      ];

      const modified = [
        { id: "user-2", name: "Bob" },
        { id: "user-1", name: "Alice Updated" },
      ];

      const diff = diffJson(original, modified);

      // Verifica que detectou mudança interna
      expect(diff["user-1"]).toEqual({ name: "Alice Updated" });

      // Verifica que gerou arrayOps
      expect(diff.$__arrayOps.length).toBeGreaterThan(0);

      // O importante: patch funciona corretamente
      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });

    it("deve aceitar id UUID", () => {
      const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
      const uuid2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

      const original = [
        { id: uuid1, name: "Alice" },
        { id: uuid2, name: "Bob" },
      ];

      const modified = [
        { id: uuid1, name: "Alice", role: "admin" },
        { id: uuid2, name: "Bob" },
      ];

      const diff = diffJson(original, modified);

      expect(diff).toEqual({
        $__arrayOps: [],
        [uuid1]: { role: "admin" },
      });

      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });
  });

  describe("Operações com id", () => {
    it("deve detectar adição com id", () => {
      const original = [{ id: 1, name: "Alice" }];

      const modified = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      const diff = diffJson(original, modified);

      expect(diff).toEqual({
        $__arrayOps: [{ type: "add", index: 1, key: "2" }],
        "2": { id: 2, name: "Bob" },
      });

      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });

    it("deve detectar remoção com id", () => {
      const original = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      const modified = [{ id: 1, name: "Alice" }];

      const diff = diffJson(original, modified);

      expect(diff).toEqual({
        $__arrayOps: [{ type: "remove", index: 1, key: "2" }],
      });

      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });

    it("deve detectar movimentação com id", () => {
      const original = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Carol" },
      ];

      const modified = [
        { id: 3, name: "Carol" },
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      const diff = diffJson(original, modified);

      // Verifica que gerou operações (reordenação detectada)
      expect(diff.$__arrayOps.length).toBeGreaterThan(0);

      // O importante: patch funciona corretamente
      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });

    it("deve combinar movimentação + alteração interna", () => {
      const original = [
        { id: 1, name: "Alice", role: "user" },
        { id: 2, name: "Bob", role: "user" },
      ];

      const modified = [
        { id: 2, name: "Bob", role: "admin" }, // Moveu + mudou role
        { id: 1, name: "Alice", role: "user" },
      ];

      const diff = diffJson(original, modified);

      // Verifica que detectou mudança interna
      expect(diff["2"]).toEqual({ role: "admin" });

      // Verifica que gerou operações
      expect(diff.$__arrayOps.length).toBeGreaterThan(0);

      // O importante: patch funciona corretamente
      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });
  });

  describe("IDs duplicados", () => {
    it("deve rastrear apenas primeira ocorrência de id duplicado", () => {
      const original = [
        { id: 1, name: "Alice" },
        { id: 1, name: "Alice Clone" }, // ID duplicado!
        { id: 2, name: "Bob" },
      ];

      const modified = [
        { id: 1, name: "Alice Updated" }, // Primeira mudou
        { id: 1, name: "Alice Clone" }, // Segunda inalterada
        { id: 2, name: "Bob" },
      ];

      const diff = diffJson(original, modified);

      // Primeira ocorrência é rastreada
      expect(diff["1"]).toEqual({ name: "Alice Updated" });

      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });

    it("deve tratar segunda ocorrência como objeto sem identidade", () => {
      const original = [
        { id: 1, name: "First" },
        { id: 1, name: "Second" }, // Duplicata
      ];

      const modified = [
        { id: 1, name: "First" },
        { id: 1, name: "Second Changed" }, // Duplicata mudou
      ];

      const diff = diffJson(original, modified);

      // Segunda é comparada por JSON completo
      expect(diff.$__arrayOps).toContainEqual(
        expect.objectContaining({
          type: "remove",
          index: 1,
          item: { id: 1, name: "Second" },
        }),
      );

      expect(diff.$__arrayOps).toContainEqual(
        expect.objectContaining({
          type: "add",
          index: 1,
          item: { id: 1, name: "Second Changed" },
        }),
      );
    });
  });

  describe("Casos sem identidade", () => {
    it("deve usar JSON.stringify para objetos sem key nem id", () => {
      const original = [{ name: "Alice" }];
      const modified = [{ name: "Bob" }];

      const diff = diffJson(original, modified);

      expect(diff.$__arrayOps).toContainEqual({
        type: "remove",
        index: 0,
        item: { name: "Alice" },
      });

      expect(diff.$__arrayOps).toContainEqual({
        type: "add",
        index: 0,
        item: { name: "Bob" },
      });
    });
  });

  describe("Caso real: CRM com indicações", () => {
    it("deve rastrear indicações por id corretamente", () => {
      interface Referral {
        id: string;
        client: string;
        status: "AVAILABLE" | "RENTED" | "CANCELLED";
        value: number;
      }

      const original: Referral[] = [
        { id: "ref-1", client: "João", status: "AVAILABLE", value: 4500 },
        { id: "ref-2", client: "Maria", status: "AVAILABLE", value: 3200 },
        { id: "ref-3", client: "Pedro", status: "AVAILABLE", value: 5000 },
      ];

      const modified: Referral[] = [
        { id: "ref-2", client: "Maria", status: "AVAILABLE", value: 3200 },
        { id: "ref-1", client: "João", status: "RENTED", value: 4500 }, // Status mudou
        { id: "ref-3", client: "Pedro", status: "CANCELLED", value: 5000 }, // Status mudou
      ];

      const diff = diffJson(original, modified);

      // Verifica que detectou mudanças internas
      expect(diff["ref-1"]).toEqual({ status: "RENTED" });
      expect(diff["ref-3"]).toEqual({ status: "CANCELLED" });

      // Verifica que gerou operações
      expect(diff.$__arrayOps.length).toBeGreaterThan(0);

      // Diff size menor que enviar array completo
      const diffSize = JSON.stringify(diff).length;
      const fullSize = JSON.stringify(modified).length;
      expect(diffSize).toBeLessThan(fullSize); // Diff é menor que full

      // O importante: patch funciona corretamente
      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });
  });

  describe("Edge cases com id", () => {
    it("deve lidar com id = 0", () => {
      const original = [{ id: 0, value: "zero" }];
      const modified = [{ id: 0, value: "updated" }];

      const diff = diffJson(original, modified);

      expect(diff).toEqual({
        $__arrayOps: [],
        "0": { value: "updated" },
      });

      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });

    it("deve ignorar id = null", () => {
      const original = [{ id: null, value: 1 }];
      const modified = [{ id: null, value: 2 }];

      const diff = diffJson(original, modified);

      // Sem id válido, trata como objeto sem identidade
      expect(diff.$__arrayOps).toHaveLength(2); // remove + add

      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });

    it("deve ignorar id = undefined", () => {
      const original = [{ id: undefined, value: 1 }];
      const modified = [{ id: undefined, value: 2 }];

      const diff = diffJson(original, modified);

      // Sem id válido, trata como objeto sem identidade
      expect(diff.$__arrayOps).toHaveLength(2); // remove + add
    });

    it("não deve adicionar 'key' em objeto que já tem 'id'", () => {
      const original = [{ id: 1, name: "Alice" }];
      const modified = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      // Objeto adicionado não deve ter 'key' injetada
      expect(result[1]).toEqual({ id: 2, name: "Bob" });
      expect(result[1]).not.toHaveProperty("key");
    });

    it("deve adicionar 'key' apenas se objeto não tem key nem id", () => {
      const original = [{ name: "Alice" }];

      // Diff simulado com key
      const diff = {
        $__arrayOps: [{ type: "add", index: 1, key: "custom-key" }],
        "custom-key": { name: "Bob" },
      };

      const result = patchJson(original, diff);

      // Como objeto não tinha key nem id, injeta key
      expect(result[1]).toEqual({ name: "Bob", key: "custom-key" });
    });
  });

  describe("Conversão de tipos de id", () => {
    it("deve converter id number para string na comparação", () => {
      const original = [{ id: 123, name: "Alice" }];
      const modified = [{ id: 123, name: "Alice Updated" }];

      const diff = diffJson(original, modified);

      // Key deve ser string "123"
      expect(diff).toEqual({
        $__arrayOps: [],
        "123": { name: "Alice Updated" },
      });

      const result = patchJson(original, diff);
      expect(result).toEqual(modified);
    });

    it("deve manter tipo original do id no objeto", () => {
      const original = [{ id: 123, name: "Alice" }];
      const modified = [{ id: 123, name: "Alice Updated" }];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      // id permanece number
      expect(result[0].id).toBe(123);
      expect(typeof result[0].id).toBe("number");
    });
  });
});
