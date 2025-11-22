import { describe, it, expect } from "vitest";
import { diffJson } from "../src/2-diff/diffJson";
import { patchJson } from "../src/3-patch/patchJson";

describe("Move sem smart keys (objetos sem id/key)", () => {
  it("deve mover objetos sem id/key corretamente", () => {
    const original = [
      { value: "A" },
      { value: "B" },
      { value: "C" }
    ];

    const modified = [
      { value: "C" },  // move 2 → 0
      { value: "A" },
      { value: "B" }
    ];

    console.log("\n=== BUG REPORT TEST ===");
    console.log("Original:", JSON.stringify(original));
    console.log("Modified:", JSON.stringify(modified));

    const diff = diffJson(original, modified);
    console.log("\nDiff:", JSON.stringify(diff, null, 2));

    const result = patchJson(original, diff);
    console.log("\nResult:", JSON.stringify(result, null, 2));

    // Verificar tipo do primeiro item
    console.log("\nTipo do result[0]:", typeof result[0]);
    console.log("É objeto?", typeof result[0] === 'object');
    console.log("É string?", typeof result[0] === 'string');

    if (typeof result[0] === 'string') {
      console.error("\n❌ BUG CONFIRMADO! Item virou string:", result[0]);
    }

    // Esse teste DEVE falhar atualmente
    expect(result).toEqual(modified);
  });

  it("com smart keys funciona corretamente (controle)", () => {
    const original = [
      { id: "a", value: "A" },
      { id: "b", value: "B" },
      { id: "c", value: "C" }
    ];

    const modified = [
      { id: "c", value: "C" },
      { id: "a", value: "A" },
      { id: "b", value: "B" }
    ];

    console.log("\n=== TESTE DE CONTROLE (com id) ===");

    const diff = diffJson(original, modified);
    console.log("Diff:", JSON.stringify(diff, null, 2));

    const result = patchJson(original, diff);
    console.log("Result:", JSON.stringify(result, null, 2));

    // Esse teste DEVE passar
    expect(result).toEqual(modified);
  });

  it("deve mover múltiplos objetos sem smart keys", () => {
    const original = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
      { name: "Carol", age: 35 },
      { name: "Dave", age: 28 }
    ];

    const modified = [
      { name: "Carol", age: 35 },  // 2 → 0
      { name: "Alice", age: 30 },  // 0 → 1
      { name: "Dave", age: 28 },   // 3 → 2
      { name: "Bob", age: 25 }     // 1 → 3
    ];

    const diff = diffJson(original, modified);
    const result = patchJson(original, diff);

    console.log("\n=== MÚLTIPLOS MOVES ===");
    console.log("Result:", JSON.stringify(result, null, 2));

    // Verificar que todos são objetos
    result.forEach((item: any, idx: number) => {
      expect(typeof item).toBe('object');
      expect(typeof item).not.toBe('string');
    });

    expect(result).toEqual(modified);
  });

  it("deve mover arrays de números sem smart keys", () => {
    const original = [1, 2, 3, 4, 5];
    const modified = [5, 1, 2, 3, 4];

    const diff = diffJson(original, modified);
    const result = patchJson(original, diff);

    expect(result).toEqual(modified);
  });

  it("deve mover arrays de strings sem smart keys", () => {
    const original = ["apple", "banana", "cherry"];
    const modified = ["cherry", "apple", "banana"];

    const diff = diffJson(original, modified);
    const result = patchJson(original, diff);

    expect(result).toEqual(modified);
  });

  it("deve lidar com objetos complexos sem smart keys", () => {
    const original = [
      { user: { name: "Alice" }, status: "active" },
      { user: { name: "Bob" }, status: "inactive" }
    ];

    const modified = [
      { user: { name: "Bob" }, status: "inactive" },
      { user: { name: "Alice" }, status: "active" }
    ];

    const diff = diffJson(original, modified);
    const result = patchJson(original, diff);

    console.log("\n=== OBJETOS COMPLEXOS ===");
    console.log("Result:", JSON.stringify(result, null, 2));

    // Verificar estrutura
    expect(result[0].user.name).toBe("Bob");
    expect(result[1].user.name).toBe("Alice");
    expect(result).toEqual(modified);
  });
});
