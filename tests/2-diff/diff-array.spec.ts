import { describe, expect, it } from "vitest";
import { diffArray } from "../../src";

describe("diffArray", () => {
  it("detecta adição simples", () => {
    const original = ["a"];
    const modified = ["a", "b"];
    const diff = diffArray(original, modified);
    expect(diff).toEqual({
      $__arrayOps: [{ type: "add", index: 1, item: "b" }],
    });
  });

  it("detecta remoção simples", () => {
    const original = ["a", "b"];
    const modified = ["a"];
    const diff = diffArray(original, modified);
    expect(diff).toEqual({
      $__arrayOps: [{ type: "remove", index: 1, item: "b" }],
    });
  });

  it("detecta alteração de objeto com key", () => {
    const original = [{ key: "foo", value: 1 }];
    const modified = [{ key: "foo", value: 2 }];
    const diff = diffArray(original, modified);
    expect(diff).toEqual({ $__arrayOps: [], foo: { value: 2 } });
  });

  it("detecta remoção de objeto com key", () => {
    const original = [{ key: "foo", value: 1 }];
    const modified = [];
    const diff = diffArray(original, modified);

    expect(diff).toEqual({
      $__arrayOps: [{ type: "remove", index: 0, key: "foo" }],
    });
  });

  it("detecta adição de objeto com key", () => {
    const original: any[] = [];
    const modified = [{ key: "foo", value: "x" }];
    const diff = diffArray(original, modified);

    expect(diff).toEqual({
      $__arrayOps: [{ type: "add", index: 0, key: "foo" }],
      foo: { value: "x" },
    });
  });

  it("ignora objetos com key duplicada no diff inteligente", () => {
    const original = [
      { key: "foo", value: 1 },
      { key: "foo", value: 2 },
    ];
    const modified = [{ key: "foo", value: 1 }];
    const diff = diffArray(original, modified);
    expect(diff.$__arrayOps.length).toBeGreaterThan(0);
    expect(diff.foo).toBeUndefined();
  });

  it("retorna {} se arrays forem idênticos", () => {
    const arr = ["x", { key: "k", value: 1 }];
    expect(diffArray(arr, [...arr])).toEqual({ $__arrayOps: [] });
  });
});
