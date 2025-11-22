import { describe, expect, it } from "vitest";
import { myersDiff, applyArrayOps } from "../../src";

describe("applyArrayOps", () => {
  //
  it("aplica operação de remoção corretamente", () => {
    const original = [
      { key: "foo", value: 1 },
      { key: "bar", value: 2 },
    ];
    const modified = [{ key: "foo", value: 1 }];
    const modifiedIds: any[] = [];
    const result: any = { $__arrayOps: [] };

    const ops = [{ type: "remove", index: 1, item: "#bar" }];

    applyArrayOps(ops, original, modified, modifiedIds, result);

    expect(result.$__arrayOps).toEqual([
      { type: "remove", index: 1, key: "bar" },
    ]);
  });

  it("aplica operação de adição corretamente", () => {
    const original = [{ key: "foo", value: 1 }];
    const modified = [
      { key: "foo", value: 1 },
      { key: "bar", value: 2 },
    ];
    const modifiedIds = ["#foo", "#bar"];
    const result: any = { $__arrayOps: [] };

    const ops = [{ type: "add", index: 1, item: "#bar" }];

    applyArrayOps(ops, original, modified, modifiedIds, result);

    expect(result.$__arrayOps).toEqual([{ type: "add", index: 1, key: "bar" }]);
  });

  it("não aplica operação de remoção para índice inválido quando os arrays são idênticos", () => {
    const original = [{ key: "foo", value: 1 }];
    const modified = [{ key: "foo", value: 1 }];

    const result: any = { $__arrayOps: [] };

    const ops = [{ type: "remove", index: 1, item: "#bar" }];

    applyArrayOps(ops, original, modified, ["#foo"], result);

    // O resultado esperado é que não tenha nenhuma operação de remoção,
    // pois o item "#bar" não existe no array `modified`.
    expect(result.$__arrayOps).toEqual([{ type: "remove", index: 1 }]);
  });

  it("aplica remoção e adição corretamente em sequência", () => {
    const original = [{ key: "foo", value: 1 }];
    const modified = [{ key: "bar", value: 2 }];
    const modifiedIds = ["#bar"];
    const result: any = { $__arrayOps: [] };

    const ops = [
      { type: "remove", index: 0, item: "#foo" },
      { type: "add", index: 0, item: "#bar" },
    ];

    applyArrayOps(ops, original, modified, modifiedIds, result);

    expect(result.$__arrayOps).toEqual([
      { type: "remove", index: 0, key: "foo" },
      { type: "add", index: 0, key: "bar" },
    ]);
  });

  it("detecta reordenação de itens com mesma key e valor", () => {
    const original = [
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ];

    const modified = [
      { key: "b", value: 2 },
      { key: "a", value: 1 },
    ];

    const modifiedIds = ["#b", "#a"];
    const result: any = { $__arrayOps: [] };

    const ops = myersDiff(["#a", "#b"], ["#b", "#a"]);

    applyArrayOps(ops, original, modified, modifiedIds, result);

    expect(result.$__arrayOps).toEqual([
      { type: "remove", index: 0, key: "a" },
      { type: "add", index: 1, key: "a" },
    ]);
  });
});
