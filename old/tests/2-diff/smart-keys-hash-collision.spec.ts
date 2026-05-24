import { describe, it, expect } from "vitest";
import { diffJson, patchJson } from "../../src";

describe("🔥 EDGE CASE: Colisão de identidade com #", () => {
  it("string '#a' vs objeto {key:'a'} - COLISÃO!", () => {
    const original = [
      "#a", // ← String literal "#a"
      { key: "a" }, // ← Objeto com key="a" → vira "#a"
      "normal",
    ];

    const modified = [{ key: "a" }, "#a", "normal"];


    const diff = diffJson(original, modified);

    const result = patchJson(original, diff);

    // Verificar se deu problema
    if (JSON.stringify(result) !== JSON.stringify(modified)) {
    }

    expect(result).toEqual(modified);
  });

  it("múltiplas strings com # no início", () => {
    const original = [
      "#user-1",
      "#user-2",
      { key: "user-1" }, // ← COLISÃO com "#user-1" acima!
    ];

    const modified = [{ key: "user-1" }, "#user-1", "#user-2"];


    const diff = diffJson(original, modified);

    const result = patchJson(original, diff);

    expect(result).toEqual(modified);
  });

  it("string vazia, string com #, e null", () => {
    const original = ["", "#", "##", "#null", null];

    const modified = [null, "#null", "##", "#", ""];


    const diff = diffJson(original, modified);

    const result = patchJson(original, diff);

    expect(result).toEqual(modified);
  });

  it("objeto com key que já é um hash-like", () => {
    const original = [
      { key: "a3f2e8d1" }, // ← Parece hash SHA256
      "a3f2e8d1", // ← String com mesmo valor
    ];

    const modified = ["a3f2e8d1", { key: "a3f2e8d1" }];


    const diff = diffJson(original, modified);

    const result = patchJson(original, diff);

    expect(result).toEqual(modified);
  });

  it("verificar identidades geradas", () => {
    const items = [
      "#a", // String literal
      { key: "a" }, // Objeto com key
      "a", // String sem #
      { value: "a" }, // Objeto sem key
    ];


    // Simular geração de identidades (mesmo código usado internamente)
    const getKey = (item: any) => {
      if (!item || typeof item !== "object") return undefined;
      if (typeof item.key === "string") return item.key;
      if (item.id !== undefined && item.id !== null) return String(item.id);
      return undefined;
    };

    const getIdentity = (item: any): string => {
      const key = getKey(item);
      if (key) return `#${key}`;
      return typeof item === "object" && item !== null
        ? JSON.stringify(item)
        : String(item);
    };

    items.forEach((item, idx) => {
      const identity = getIdentity(item);
    });

    // Verificar colisões
    const identities = items.map(getIdentity);
    const duplicates = identities.filter(
      (id, i) => identities.indexOf(id) !== i,
    );

    if (duplicates.length > 0) {
      duplicates.forEach((dup) => {
        const indices = identities
          .map((id, i) => (id === dup ? i : -1))
          .filter((i) => i !== -1);
      });
    }
  });
});
