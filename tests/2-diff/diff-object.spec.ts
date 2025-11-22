import { describe, expect, it } from "vitest";
import { diffJson } from "../../src/2-diff/diffJson";
import { diffObject } from "../../src/2-diff/diffObject";

describe("diffObject", () => {
  it("detecta valor primitivo diferente", () => {
    const original = { value: 1 };
    const modified = { value: 2 };
    const diff = diffJson(original, modified);
    expect(diff).toEqual({ value: 2 });
  });

  it("detecta valor igual (número)", () => {
    const original = { value: 5 };
    const modified = { value: 5 };
    const diff = diffJson(original, modified);
    expect(diff).toEqual({});
  });

  it("detecta valor igual (null)", () => {
    const original = { value: null };
    const modified = { value: null };
    const diff = diffJson(original, modified);
    expect(diff).toEqual({});
  });

  it("detecta modificação para null", () => {
    const original = { value: 105 };
    const modified = { value: null };
    const diff = diffObject(original, modified);
    expect(diff).toEqual({ value: null });
  });

  it("detecta modificação de null para valor", () => {
    const original = { value: null };
    const modified = { value: 105 };
    const diff = diffJson(original, modified);
    expect(diff).toEqual({ value: 105 });
  });

  it("detecta chave nova adicionada", () => {
    const original = {};
    const modified = { value: 10 };
    const diff = diffJson(original, modified);
    expect(diff).toEqual({ value: 10 });
  });

  it("detecta remoção com undefined", () => {
    const original = { value: 10 };
    const modified = {};
    const diff = diffJson(original, modified);
    expect(diff).toEqual({ value: { $__remove: true } });
  });

  it("detecta objeto aninhado modificado", () => {
    const original = { meta: { min: 0 } };
    const modified = { meta: { min: 1 } };
    const diff = diffJson(original, modified);
    expect(diff).toEqual({ meta: { min: 1 } });
  });

  it("detecta objeto aninhado igual", () => {
    const original = { meta: { min: 0 } };
    const modified = { meta: { min: 0 } };
    const diff = diffJson(original, modified);
    expect(diff).toEqual({});
  });
});
