import { describe, it, expect } from "vitest";
import { diffJson, patchJson } from "../../src";

describe("CORE: Moves - Testes Base Isolados", () => {
  describe("Single Move", () => {
    it("deve mover 1 item para frente (from < to)", () => {
      const original = ["a", "b", "c", "d"];
      const modified = ["b", "c", "a", "d"];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });

    it("deve mover 1 item para trás (from > to)", () => {
      const original = ["a", "b", "c", "d"];
      const modified = ["c", "a", "b", "d"];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });

    it("deve mover do início para o fim", () => {
      const original = ["a", "b", "c"];
      const modified = ["b", "c", "a"];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });

    it("deve mover do fim para o início", () => {
      const original = ["a", "b", "c"];
      const modified = ["c", "a", "b"];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });
  });

  describe("Dois Moves Simples", () => {
    it("deve mover 2 items para frente (sem overlap)", () => {
      const original = ["a", "b", "c", "d", "e"];
      const modified = ["c", "d", "e", "a", "b"];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });

    it("deve mover 2 items para trás (sem overlap)", () => {
      const original = ["a", "b", "c", "d", "e"];
      const modified = ["d", "e", "a", "b", "c"];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });

    it("deve trocar 2 items de posição (swap)", () => {
      const original = ["a", "b", "c", "d"];
      const modified = ["b", "a", "c", "d"];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });
  });

  describe("Múltiplos Moves PARA O MESMO ÍNDICE (caso crítico)", () => {
    it("deve mover 2 items para o mesmo índice", () => {
      const original = ["a", "b", "c", "d", "e"];
      const modified = ["a", "d", "e", "b", "c"];

      const diff = diffJson(original, modified);

      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });

    it("deve mover 3 items para o mesmo índice (caso do step1)", () => {
      // Simplificado do step1 real
      const original = [
        "area_total",
        "area_util",
        "preco",
        "tipo_imovel",
        "descricao",
        "outros",
      ];
      const modified = [
        "preco",
        "descricao",
        "area_total",
        "tipo_imovel",
        "area_util",
        "outros",
      ];

      const diff = diffJson(original, modified);

      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });
  });

  describe("Moves Complexos (5+ moves)", () => {
    it("deve aplicar 5 moves simultâneos", () => {
      const original = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const modified = ["c", "a", "d", "b", "e", "h", "f", "g"];

      const diff = diffJson(original, modified);
      const result = patchJson(original, diff);

      expect(result).toEqual(modified);
    });
  });
});
