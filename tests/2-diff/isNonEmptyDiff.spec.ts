import { describe, expect, it } from "vitest";
import { isNonEmptyDiff } from "../../src/2-diff/utils";

describe("isNonEmptyDiff", () => {
  it("retorna false para objetos vazios", () => {
    expect(isNonEmptyDiff({})).toBe(false);
  });

  it("retorna false para objetos somente com $__arrayOps vazio", () => {
    expect(isNonEmptyDiff({ $__arrayOps: [] })).toBe(false);
  });

  it("retorna true para objetos com $__arrayOps não vazio", () => {
    expect(
      isNonEmptyDiff({ $__arrayOps: [{ type: "add", index: 0, item: "foo" }] }),
    ).toBe(true);
  });

  it("retorna true para objetos com outras chaves além de $__arrayOps", () => {
    expect(isNonEmptyDiff({ $__arrayOps: [], foo: "bar" })).toBe(true);
  });

  it("retorna true para arrays não vazios", () => {
    expect(isNonEmptyDiff([1, 2, 3])).toBe(true);
  });

  it("retorna false para arrays vazios", () => {
    expect(isNonEmptyDiff([])).toBe(false);
  });

  it("retorna true para primitivas diferentes de null e objetos", () => {
    expect(isNonEmptyDiff(0)).toBe(true);
    expect(isNonEmptyDiff("")).toBe(true);
    expect(isNonEmptyDiff(false)).toBe(true);
  });

  it("retorna false para null", () => {
    expect(isNonEmptyDiff(null)).toBe(false);
  });
});
