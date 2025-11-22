import { describe, expect, it } from "vitest";
import { diffSmartKeys } from "../../src";

describe("diffSmartKeys", () => {
  it("deve gerar diff interno entre dois objetos com mesma key", () => {
    const original = [{ key: "foo", value: 1 }];
    const modified = [{ key: "foo", value: 2 }];
    const result: any = {};

    diffSmartKeys(original, modified, result);

    expect(result).toEqual({
      foo: { value: 2 },
    });
  });

  it("deve ignorar objetos sem key", () => {
    const original = [{ value: 1 }];
    const modified = [{ value: 2 }];
    const result: any = {};

    diffSmartKeys(original, modified, result);

    expect(result).toEqual({});
  });

  it("deve ignorar objetos com key presente em apenas um dos arrays", () => {
    const original = [{ key: "foo", value: 1 }];
    const modified = [{ key: "bar", value: 1 }];
    const result: any = {};

    diffSmartKeys(original, modified, result);

    expect(result).toEqual({});
  });

  it("deve considerar apenas o primeiro item com key duplicada", () => {
    const original = [
      { key: "foo", value: 1 },
      { key: "foo", value: 999 }, // ← deve ser ignorado
    ];
    const modified = [{ key: "foo", value: 2 }];
    const result: any = {};

    diffSmartKeys(original, modified, result);

    expect(result).toEqual({
      foo: { value: 2 },
    });
  });

  it("deve ignorar quando não há diferença interna", () => {
    const original = [{ key: "foo", value: 1 }];
    const modified = [{ key: "foo", value: 1 }];
    const result: any = {};

    diffSmartKeys(original, modified, result);

    expect(result).toEqual({});
  });
});
