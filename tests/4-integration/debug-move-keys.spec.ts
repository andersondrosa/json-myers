import { describe, test, expect } from "vitest";
import { diffJson, patchJson } from "../../src";

describe("DEBUG: Move com smart keys", () => {
  test("deve mover item com id e aplicar mudança interna", () => {
    const original = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];

    const modified = [
      { id: 2, name: "Bob" },
      { id: 1, name: "Alice Updated" },
    ];

    console.log("\n=== TESTE DEBUG ===");
    console.log("Original:", JSON.stringify(original, null, 2));
    console.log("Modified:", JSON.stringify(modified, null, 2));

    const diff = diffJson(original, modified);
    console.log("\nDIFF gerado:", JSON.stringify(diff, null, 2));

    const result = patchJson(original, diff);
    console.log("\nRESULT após patch:", JSON.stringify(result, null, 2));
    console.log("EXPECTED:", JSON.stringify(modified, null, 2));

    expect(result).toEqual(modified);
  });
});
