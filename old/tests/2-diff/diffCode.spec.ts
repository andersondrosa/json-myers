import { describe, it, expect } from "vitest";
import { diffJson, patchJson } from "../../src";

describe("diffJson – versionamento de código por linha", () => {
  it("detecta adição de linha ao final do código", () => {
    const original = {
      code: [
        //
        "function soma(a, b) {",
        "  return a + b;",
        "}",
      ],
    };

    const modified = {
      code: [
        "function soma(a, b) {",
        "  return a + b;",
        "}",
        "console.log(soma(2, 3));",
      ],
    };

    const expectedDiff = {
      code: {
        $__arrayOps: [
          { type: "add", index: 3, item: "console.log(soma(2, 3));" },
        ],
      },
    };

    const diff = diffJson(original, modified);
    expect(diff).toEqual(expectedDiff);

    const merged = patchJson(original, diff);
    expect(merged).toEqual(modified);
  });

  it("detecta remoção de linha intermediária", () => {
    const original = {
      code: [
        "function main() {",
        "  const result = run();",
        "  return result;",
        "}",
      ],
    };

    const modified = {
      code: [
        //
        "function main() {",
        "  return run();",
        "}",
      ],
    };

    const diff = diffJson(original, modified);

    // Verificar que tem as operações corretas (ordem pode variar)
    expect(diff.code.$__arrayOps).toHaveLength(3);
    expect(diff.code.$__arrayOps).toContainEqual({
      type: "remove",
      index: 1,
      item: "  const result = run();",
    });
    expect(diff.code.$__arrayOps).toContainEqual({
      type: "remove",
      index: 2,
      item: "  return result;",
    });
    expect(diff.code.$__arrayOps).toContainEqual({
      type: "add",
      index: 1,
      item: "  return run();",
    });

    const merged = patchJson(original, diff);
    expect(merged).toEqual(modified);
  });

  it("detecta troca de linha", () => {
    const original = {
      code: ["const msg = 'Hello';", "console.log(msg);"],
    };

    const modified = {
      code: ["const msg = 'Olá';", "console.log(msg);"],
    };

    const expectedDiff = {
      code: {
        $__arrayOps: [
          { type: "remove", index: 0, item: "const msg = 'Hello';" },
          { type: "add", index: 0, item: "const msg = 'Olá';" },
        ],
      },
    };

    const diff = diffJson(original, modified);
    expect(diff).toEqual(expectedDiff);

    const merged = patchJson(original, diff);
    expect(merged).toEqual(modified);
  });

  it("retorna {} se não houver mudança no código", () => {
    const code = ["function teste() {", "  return true;", "}"];

    const diff = diffJson({ code }, { code: [...code] });
    expect(diff).toEqual({});
  });
});
