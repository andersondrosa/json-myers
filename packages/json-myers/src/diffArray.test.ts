/**
 * Unit tests for `diffArray` (and exercising the diffJson/diffObject
 * recursive infrastructure).
 *
 * The critical invariant tested across all cases is **round-trip**:
 * `patchJson(a, diffJson(a, b))` must deep-equal `b`. Any divergence
 * here is a bug somewhere in the diff/patch pipeline.
 */
import { describe, it, expect } from "vitest";
import { diffJson } from "./diffJson.js";
import { patchJson } from "./patch.js";

// ── Round-trip property — the contract ────────────────────────────

function roundTrip(a: unknown, b: unknown): void {
  const diff = diffJson(a, b);
  const applied = patchJson(a, diff);
  expect(applied).toEqual(b);
}

// ── 1. Array of primitives ────────────────────────────────────────

describe("diffArray — primitives", () => {
  it("identical arrays → empty $ops", () => {
    const a = ["x", "y", "z"];
    const diff = diffJson(a, a) as { $ops: unknown[] };
    expect(diff).toEqual({ $ops: [] });
    roundTrip(a, a);
  });

  it("insert at end", () => {
    roundTrip(["a", "b"], ["a", "b", "c"]);
  });

  it("insert at start", () => {
    roundTrip(["b", "c"], ["a", "b", "c"]);
  });

  it("insert at middle", () => {
    roundTrip(["a", "c"], ["a", "b", "c"]);
  });

  it("delete at end", () => {
    roundTrip(["a", "b", "c"], ["a", "b"]);
  });

  it("delete at start", () => {
    roundTrip(["a", "b", "c"], ["b", "c"]);
  });

  it("delete at middle", () => {
    roundTrip(["a", "b", "c"], ["a", "c"]);
  });

  it("substitute middle", () => {
    roundTrip(["a", "b", "c"], ["a", "X", "c"]);
  });

  it("swap two elements", () => {
    roundTrip(["a", "b"], ["b", "a"]);
  });

  it("reverse three elements", () => {
    roundTrip(["a", "b", "c"], ["c", "b", "a"]);
  });

  it("totally different arrays", () => {
    roundTrip(["a", "b", "c"], ["x", "y", "z"]);
  });

  it("empty → non-empty", () => {
    roundTrip([], ["a", "b", "c"]);
  });

  it("non-empty → empty", () => {
    roundTrip(["a", "b", "c"], []);
  });
});

// ── 2. Smart-key identity preservation ────────────────────────────

describe("diffArray — smart-keys (objects with id/key)", () => {
  it("identical smart-key array → empty $ops", () => {
    const a = [
      { id: "alice", v: 1 },
      { id: "bob", v: 2 },
    ];
    const diff = diffJson(a, a) as { $ops: unknown[] };
    expect(diff.$ops).toEqual([]);
    roundTrip(a, a);
  });

  it("smart-key item content changes → nested update via smart-key", () => {
    const a = [{ id: "alice", role: "user" }];
    const b = [{ id: "alice", role: "admin" }];
    const diff = diffJson(a, b) as Record<string, unknown>;
    expect(diff.$ops).toEqual([]);
    expect(diff.alice).toEqual({ role: "admin" });
    roundTrip(a, b);
  });

  it("swap of two smart-keyed items → remove+add by key (move sugar)", () => {
    const a = [{ id: "alice" }, { id: "bob" }];
    const b = [{ id: "bob" }, { id: "alice" }];
    roundTrip(a, b);
  });

  it("add a new smart-key item with payload", () => {
    const a = [{ id: "alice", role: "user" }];
    const b = [
      { id: "alice", role: "user" },
      { id: "bob", role: "admin" },
    ];
    roundTrip(a, b);
  });

  it("remove a smart-key item", () => {
    const a = [{ id: "alice" }, { id: "bob" }];
    const b = [{ id: "bob" }];
    roundTrip(a, b);
  });

  it("smart-key with `key` field instead of `id`", () => {
    const a = [{ key: "X", v: 1 }];
    const b = [{ key: "X", v: 2 }];
    roundTrip(a, b);
  });

  it("nested change deep inside a smart-keyed item", () => {
    const a = [{ id: "alice", profile: { age: 30, city: "Lisbon" } }];
    const b = [{ id: "alice", profile: { age: 31, city: "Lisbon" } }];
    roundTrip(a, b);
  });

  it("complex: swap + update + add", () => {
    const a = [
      { id: "alice", role: "user" },
      { id: "bob", role: "user" },
    ];
    const b = [
      { id: "bob", role: "admin" },
      { id: "alice", role: "admin" },
      { id: "carol", role: "user" },
    ];
    roundTrip(a, b);
  });
});

// ── 3. Mixed arrays (smart-key + primitive + content-hash) ────────

describe("diffArray — mixed item types", () => {
  it("primitives and smart-keys side by side", () => {
    const a = ["header", { id: "alice", v: 1 }, "footer"];
    const b = ["HEADER", { id: "alice", v: 2 }, "footer"];
    roundTrip(a, b);
  });

  it("array containing object-without-id treats by content hash", () => {
    const a = [{ x: 1 }, { y: 2 }];
    const b = [{ x: 1 }, { y: 99 }];
    // Items have no id/key → hashed by content. Changing y means a
    // different fingerprint → remove+add.
    roundTrip(a, b);
  });

  it("array of nested arrays", () => {
    const a = [
      [1, 2],
      [3, 4],
    ];
    const b = [
      [1, 2],
      [5, 6],
    ];
    roundTrip(a, b);
  });
});

// ── 4. Object containing arrays (full pipeline) ───────────────────

describe("diffArray — full pipeline through objects", () => {
  it("object with array field that gains an item", () => {
    const a = { name: "Project", tags: ["a", "b"] };
    const b = { name: "Project", tags: ["a", "b", "c"] };
    roundTrip(a, b);
  });

  it("object with smart-key array — item updated", () => {
    const a = {
      name: "Project",
      users: [
        { id: "alice", role: "user" },
        { id: "bob", role: "user" },
      ],
    };
    const b = {
      name: "Project",
      users: [
        { id: "alice", role: "admin" },
        { id: "bob", role: "user" },
      ],
    };
    roundTrip(a, b);
  });

  it("deeply nested structure with mix of changes", () => {
    const a = {
      app: {
        name: "Alpha",
        version: "1.0.0",
        config: { theme: "dark", lang: "en" },
        users: [
          { id: "alice", role: "user" },
          { id: "bob", role: "user" },
        ],
      },
    };
    const b = {
      app: {
        name: "Beta",
        version: "1.0.0", // unchanged
        config: { theme: "light", lang: "en" }, // theme changed
        users: [
          { id: "alice", role: "admin" }, // role changed
          { id: "carol", role: "user" }, // bob replaced by carol
        ],
      },
    };
    roundTrip(a, b);
  });
});

// ── 5. Determinism ────────────────────────────────────────────────

describe("diffArray — determinism (R-D1 from reorder spec)", () => {
  it("repeated diff calls produce bit-identical output", () => {
    const a = [{ id: "alice" }, { id: "bob" }, "x", { y: 1 }];
    const b = [{ id: "bob" }, "y", { id: "alice", v: 9 }];
    const d1 = JSON.stringify(diffJson(a, b));
    const d2 = JSON.stringify(diffJson(a, b));
    const d3 = JSON.stringify(diffJson(a, b));
    expect(d1).toBe(d2);
    expect(d2).toBe(d3);
  });
});

// ── 6. Object diff also works (smoke) ─────────────────────────────

describe("diffObject — smoke", () => {
  it("removed key produces $remove list", () => {
    const a = { a: 1, b: 2, c: 3 };
    const b = { a: 1, c: 3 };
    const diff = diffJson(a, b) as Record<string, unknown>;
    expect(diff.$remove).toEqual(["b"]);
    roundTrip(a, b);
  });

  it("added key", () => {
    roundTrip({ a: 1 }, { a: 1, b: 2 });
  });

  it("changed value", () => {
    roundTrip({ a: 1 }, { a: 2 });
  });

  it("multiple removals batched into one $remove", () => {
    const a = { a: 1, b: 2, c: 3, d: 4 };
    const b = { a: 1 };
    const diff = diffJson(a, b) as Record<string, unknown>;
    expect(Array.isArray(diff.$remove)).toBe(true);
    expect((diff.$remove as string[]).sort()).toEqual(["b", "c", "d"]);
    roundTrip(a, b);
  });
});

// ── 7. Type changes ───────────────────────────────────────────────

describe("diffJson — type change replaces", () => {
  it("array → object", () => {
    roundTrip([1, 2], { a: 1 });
  });

  it("object → array", () => {
    roundTrip({ a: 1 }, [1, 2]);
  });

  it("object → primitive", () => {
    roundTrip({ a: 1 }, 42);
  });

  it("primitive → object", () => {
    roundTrip(42, { a: 1 });
  });
});
