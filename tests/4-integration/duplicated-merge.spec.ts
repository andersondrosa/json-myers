import { describe, it, expect } from "vitest";
import { patchJson } from "../../src/3-patch/patchJson"; // ou o nome correto
import { diffJson } from "../../src/2-diff/diffJson";

// Utilitário auxiliar para gerar + aplicar o diff
function applyDiff(original: any, modified: any) {
  const diff = diffJson(original, modified);
  const merged = patchJson(original, diff);
  return merged;
}

describe("patchJson com listas e keys duplicadas", () => {
  //
  it("deve aplicar corretamente alterações no item com key única", () => {
    //
    const original = [
      { key: "foo", value: "A" },
      { key: "foo", value: "B" },
    ];

    const modified = [
      { key: "foo", value: "Z" },
      { key: "foo", value: "X" },
    ];

    const diff = diffJson(original, modified);

    console.log(JSON.stringify(diff, null, 2));

    const merged = patchJson(original, diff);

    expect(merged).toEqual([
      { key: "foo", value: "Z" },
      { key: "foo", value: "X" },
    ]);
  });

  it("deve aplicar corretamente alterações em itens duplicados tratados como valores", () => {
    const original = [
      { key: "foo", value: "A" },
      { key: "foo", value: "B" },
    ];
    const modified = [
      { key: "foo", value: "A" },
      { key: "foo", value: "C" },
    ];

    const merged = applyDiff(original, modified);

    expect(merged).toEqual([
      { key: "foo", value: "A" },
      { key: "foo", value: "C" },
    ]);
  });

  it("deve tratar corretamente remoção do item com key duplicada", () => {
    const original = [
      { key: "foo", value: "X" },
      { key: "foo", value: "Y" },
    ];
    const modified = [{ key: "foo", value: "X" }];

    const merged = applyDiff(original, modified);

    expect(merged).toEqual([{ key: "foo", value: "X" }]);
  });

  it("deve tratar corretamente adição de item duplicado", () => {
    const original = [{ key: "foo", value: "1" }];
    const modified = [
      { key: "foo", value: "1" },
      { key: "foo", value: "2" },
    ];

    const merged = applyDiff(original, modified);

    expect(merged).toEqual([
      { key: "foo", value: "1" },
      { key: "foo", value: "2" },
    ]);
  });

  it("deve aplicar corretamente múltiplas operações combinadas", () => {
    const original = [
      { key: "foo", value: "A" },
      { key: "foo", value: "B" },
    ];
    const modified = [
      { key: "foo", value: "X" },
      { key: "foo", value: "C" },
      { key: "bar", value: "NEW" },
    ];

    const merged = applyDiff(original, modified);

    expect(merged).toEqual([
      { key: "foo", value: "X" },
      { key: "foo", value: "C" },
      { key: "bar", value: "NEW" },
    ]);
  });
});
