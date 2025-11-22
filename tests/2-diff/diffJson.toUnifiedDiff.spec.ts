import { describe, it, expect } from "vitest";
import { diffJson } from "../../src/2-diff/diffJson";
import { patchJson } from "../../src/3-patch/patchJson";
import { convertJsonMyersToGitDiff } from "../../src/4-utils/convertJsonMyersToGitDiff";

describe("diffJson + convertJsonMyersToGitDiff – visualização estilo Git", () => {
  it("detecta adição de linha ao final", () => {
    const original = ["function soma(a, b) {", "  return a + b;", "}"];

    const modified = [
      "function soma(a, b) {",
      "  return a + b;",
      "}",
      "console.log(soma(2, 3));",
    ];

    const diff = diffJson(original, modified);
    const unified = convertJsonMyersToGitDiff(
      original,
      diff.$__arrayOps,
      "soma.ts",
    );

    expect(unified).toContain("+console.log(soma(2, 3));");

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
    const original = ["const msg = 'Hello';", "console.log(msg);"];
    const modified = ["const msg = 'Olá';", "console.log(msg);"];

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
