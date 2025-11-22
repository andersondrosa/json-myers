import { describe, it, expect } from "vitest";
import { diffJson, patchJson } from "../../src";

describe("Move sem smart keys (objetos sem id/key)", () => {
  it("deve mover objetos sem id/key corretamente", () => {
    const original = [{ value: "A" }, { value: "B" }, { value: "C" }];

    const modified = [
      { value: "C" }, // move 2 → 0
      { value: "A" },
      { value: "B" },
    ];

    const diff = diffJson(original, modified);
    const result = patchJson(original, diff);

    expect(result).toEqual(modified);
  });

  it("com smart keys funciona corretamente (controle)", () => {
    const original = [
      { id: "a", value: "A" },
      { id: "b", value: "B" },
      { id: "c", value: "C" },
    ];

    const modified = [
      { id: "c", value: "C" },
      { id: "a", value: "A" },
      { id: "b", value: "B" },
    ];

    const diff = diffJson(original, modified);
    const result = patchJson(original, diff);

    expect(result).toEqual(modified);
  });

  it("deve mover múltiplos objetos sem smart keys", () => {
    const original = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
      { name: "Carol", age: 35 },
      { name: "Dave", age: 28 },
    ];

    const modified = [
      { name: "Carol", age: 35 }, // 2 → 0
      { name: "Alice", age: 30 }, // 0 → 1
      { name: "Dave", age: 28 }, // 3 → 2
      { name: "Bob", age: 25 }, // 1 → 3
    ];

    const diff = diffJson(original, modified);
    const result = patchJson(original, diff);

    // Verificar que todos são objetos
    result.forEach((item: any, idx: number) => {
      expect(typeof item).toBe("object");
      expect(typeof item).not.toBe("string");
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
      { user: { name: "Bob" }, status: "inactive" },
    ];

    const modified = [
      { user: { name: "Bob" }, status: "inactive" },
      { user: { name: "Alice" }, status: "active" },
    ];

    const diff = diffJson(original, modified);
    const result = patchJson(original, diff);

    // Verificar estrutura
    expect(result[0].user.name).toBe("Bob");
    expect(result[1].user.name).toBe("Alice");
    expect(result).toEqual(modified);
  });
});
