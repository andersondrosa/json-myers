import { describe, expect, it } from "vitest";
import { diffJson, patchJson } from "../../src";

describe("Histórico de modificações com diffs", () => {
  //
  it("deve aplicar todos os diffs e chegar na última modificação", () => {
    //
    const original = [
      {
        key: "area_total",
        type: "number",
        value: 120,
        meta: { type: "m²", min: 0 },
        role: "area",
      },
      {
        key: "area_util",
        type: "number",
        value: 95,
        meta: { type: "m²", min: 0 },
        role: "area",
      },
      {
        key: "preco",
        type: "number",
        value: 450000,
        meta: { type: "BRL", min: 0 },
        role: "currency",
      },
    ];

    const modificado = [
      {
        key: "area_util",
        type: "number",
        value: 95,
        meta: { type: "m²", min: 0 },
        role: "area",
      },
      {
        key: "preco",
        type: "number",
        value: 450000,
        meta: { type: "BRL", min: 0 },
        role: "currency",
      },
      {
        key: "area_total",
        type: "number",
        value: 120,
        meta: { type: "m²", min: 0 },
        role: "area",
      },
    ];

    const diff = diffJson(original, modificado);

    // Com optimization ativada, gera move ao invés de remove+add
    expect(diff).toEqual({
      $__arrayOps: [
        { type: "move", from: 0, to: 2, item: "#area_total" }, // índice correto no array final
      ],
    });

    const restored = patchJson(original, diff);

    expect(restored).toEqual(modificado);
  });
});
