import { describe, it, expect } from "vitest";
import { diffJson } from "../../src/2-diff/diffJson";
import { patchJson } from "../../src/3-patch/patchJson";

describe("diffJson", () => {
  it("gera diff simples entre dois objetos JSON", () => {
    const original = {
      name: "Projeto",
      tags: ["a", "b", "c"],
      items: [
        { key: "1", val: "one" },
        { key: "2", val: "two" },
      ],
      config: { enabled: true, version: 1 },
    };

    const modified = {
      name: "Projeto Atualizado",
      tags: ["a", "c", "d"],
      items: [
        { key: "2", val: "two-modified" },
        { key: "3", val: "three" },
      ],
      config: { enabled: false, version: 2 },
    };

    const expectedDiff = {
      name: "Projeto Atualizado",
      tags: {
        $__arrayOps: [
          { type: "remove", index: 1, item: "b" },
          { type: "add", index: 2, item: "d" },
        ],
      },
      items: {
        "2": { val: "two-modified" },
        "3": { val: "three" },
        $__arrayOps: [
          { type: "remove", index: 0, key: "1" },
          { type: "add", index: 1, key: "3" },
        ],
      },
      config: { enabled: false, version: 2 },
    };

    const diff = diffJson(original, modified);

    expect(diff).toEqual(expectedDiff);
  });

  it("detecta remoção de propriedade", () => {
    const original = { field: "value", toRemove: "bye" };
    const modified = { field: "value" };
    const diff = diffJson(original, modified);
    expect(diff).toEqual({ toRemove: { $__remove: true } });
  });

  it("retorna objeto vazio quando não há mudanças", () => {
    const original = { a: 1, b: [1, 2], c: { d: true } };
    const modified = { a: 1, b: [1, 2], c: { d: true } };
    const diff = diffJson(original, modified);
    expect(diff).toEqual({});
  });

  it("detecta alterações profundas em estrutura complexa", () => {
    const original = {
      name: "Projeto",
      tags: ["a", "b", "c"],
      items: [
        { key: "1", val: "one", meta: { createdBy: "userA" } },
        { key: "2", val: "two" },
        { key: "4", val: "old" },
      ],
      config: {
        enabled: true,
        version: 1,
        history: [
          { id: "v1", timestamp: 111 },
          { id: "v2", timestamp: 222 },
        ],
      },
    };

    const modified = {
      name: "Projeto Atualizado",
      tags: ["a", "c", "d"],
      items: [
        { key: "2", val: "two-modified" },
        { key: "3", val: "three" },
        { key: "1", val: "one", meta: { changed: true } },
      ],
      config: {
        enabled: false,
        version: 2,
        history: [
          { id: "v2", timestamp: 222 },
          { id: "v3", timestamp: 333 },
        ],
      },
    };

    const expectedDiff = {
      name: "Projeto Atualizado",
      tags: {
        $__arrayOps: [
          { type: "remove", index: 1, item: "b" },
          { type: "add", index: 2, item: "d" },
        ],
      },
      items: {
        "1": {
          meta: {
            createdBy: { $__remove: true },
            changed: true,
          },
        },
        "2": { val: "two-modified" },
        "3": { val: "three" },
        $__arrayOps: [
          { type: "remove", index: 2, key: "4" },
          { type: "move", from: 0, to: 3, item: "#1" },
          { type: "add", index: 1, key: "3" },
        ],
      },
      config: {
        enabled: false,
        version: 2,
        history: {
          $__arrayOps: [
            {
              type: "remove",
              index: 0,
              key: "v1",
            },
            {
              type: "add",
              index: 1,
              key: "v3",
            },
          ],
          v3: {
            id: "v3",
            timestamp: 333,
          },
        },
      },
    };

    const diff = diffJson(original, modified);

    // Verificar estrutura principal (ordem de operações pode variar)
    expect(diff.name).toEqual("Projeto Atualizado");
    expect(diff.tags.$__arrayOps).toHaveLength(2);
    expect(diff.items.$__arrayOps).toHaveLength(3);
    expect(diff.config.enabled).toEqual(false);
    expect(diff.config.version).toEqual(2);

    // O importante: patch deve funcionar corretamente
    const merged = patchJson(original, diff);
    expect(merged).toEqual(modified);
  });

  it("detecta alterações em arrays de objetos com chaves duplicadas", () => {
    // Array com `key` duplicada (id: "abc")
    const original = {
      list: ["foo", "bar", { key: "baz", value: "OLD" }],
    };

    const modified = {
      root: "true",
      list: [
        "foo",
        "bar",
        { key: "baz", value: "NEW" },
        "ok",
        { key: "delta", value: "DELTA" },
        null,
      ],
    };

    const diff = diffJson(original, modified);
  });
});
