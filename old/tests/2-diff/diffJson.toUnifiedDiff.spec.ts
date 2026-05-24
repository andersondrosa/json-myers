import { describe, it, expect } from "vitest";
import { convertJsonMyersToGitDiff, diffJson, patchJson } from "../../src";

describe("diffJson + convertJsonMyersToGitDiff – visualização estilo Git", () => {
  it("detecta adição de linha ao final", () => {
    const original = ["function soma(a, b) {", "  return a + b;", "}"];

    const modified = [
      "function soma(a, b) {",
      "  return a + b;",
      "}",
    ];

    const diff = diffJson(original, modified);
    const unified = convertJsonMyersToGitDiff(
      original,
      diff.$__arrayOps,
      "soma.ts",
    );


    const merged = patchJson(original, diff);
    expect(merged).toEqual(modified);
  });

  it("detecta remoção e troca de linha intermediária", () => {
    const original = [
      "function main() {",
      "  const result = run();",
      "  return result;",
      "}",
    ];

    const modified = ["function main() {", "  return run();", "}"];

    const diff = diffJson(original, modified);
    const unified = convertJsonMyersToGitDiff(
      original,
      diff.$__arrayOps,
      "main.ts",
    );

    expect(unified).toContain("-  const result = run();");
    expect(unified).toContain("-  return result;");
    expect(unified).toContain("+  return run();");

    const merged = patchJson(original, diff);
    expect(merged).toEqual(modified);
  });

  it("detecta troca de linha simples", () => {
    const original = ["const msg = 'Hello';"];
    const modified = ["const msg = 'Olá';"];

    const diff = diffJson(original, modified);
    const unified = convertJsonMyersToGitDiff(
      original,
      diff.$__arrayOps,
      "msg.ts",
    );

    expect(unified).toContain("-const msg = 'Hello';");
    expect(unified).toContain("+const msg = 'Olá';");

    const merged = patchJson(original, diff);
    expect(merged).toEqual(modified);
  });

  it("retorna diff sem mudanças se igual", () => {
    const original = ["function teste() {", "  return true;", "}"];
    const modified = [...original];

    const diff = diffJson(original, modified);
    const unified = convertJsonMyersToGitDiff(
      original,
      diff.$__arrayOps || [],
      "teste.ts",
    );

    expect(diff).toEqual({ $__arrayOps: [] });
    expect(unified).toContain(" function teste() {");
  });
});
