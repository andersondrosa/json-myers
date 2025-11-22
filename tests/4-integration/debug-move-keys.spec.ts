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


    const diff = diffJson(original, modified);

    const result = patchJson(original, diff);

    expect(result).toEqual(modified);
  });
});
