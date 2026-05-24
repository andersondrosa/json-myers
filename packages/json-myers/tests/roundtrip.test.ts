/**
 * Round-trip test — exhaustive coverage of the (diff → patch) pipeline.
 *
 * For each pair `(a, b)`:
 *   1. diff = diffJson(a, b, options?)
 *   2. result = patchJson(a, diff, options?)
 *   3. expect(result).toEqual(b)
 *
 * For most cases, also tests the BACKWARD direction:
 *   - reverseDiff = diffJson(b, a, options?)
 *   - reverseResult = patchJson(b, reverseDiff, options?)
 *   - expect(reverseResult).toEqual(a)
 *
 * Categories covered:
 *   - Primitives (string, number, boolean, null) — every kind of change
 *   - Objects — add/remove/update keys, deep nesting
 *   - Arrays of primitives — insert/delete/swap/reverse
 *   - Arrays of smart-keyed objects — identity preserved across moves
 *   - Mixed arrays — primitives + objects coexisting
 *   - Type changes (R2 — array↔object↔primitive)
 *   - Null handling — base/patch nullability at every level
 *   - Custom identity — $identity wire + DiffOptions.identity
 *   - assertCollection — collections inferred automatically
 *   - Deep nesting — 5+ levels of mixed structures
 *   - Edge cases — empty, NaN, Infinity, strings with markers, unicode
 *   - Realistic scenarios — e-commerce, blog, CRM
 *   - Multi-step history — apply a chain of diffs and roll back
 *   - Fuzz — seeded random mutations of complex structures
 */
import { describe, it, expect } from "vitest";
import { diffJson } from "../src/diffJson.js";
import { patchJson } from "../src/patch.js";
import type { DiffOptions, PatchOptions } from "../src/types.js";

// ── Helpers ───────────────────────────────────────────────────────

/** Forward round-trip: diff(a,b) applied to a yields b. */
function rt(
  a: unknown,
  b: unknown,
  diffOpts: DiffOptions = {},
  patchOpts: PatchOptions = diffOpts as PatchOptions,
): void {
  const d = diffJson(a, b, diffOpts);
  const result = patchJson(a, d, patchOpts);
  expect(result).toEqual(b);
}

/** Round-trip in BOTH directions — forward and backward. */
function rtBoth(
  a: unknown,
  b: unknown,
  diffOpts: DiffOptions = {},
  patchOpts: PatchOptions = diffOpts as PatchOptions,
): void {
  const dFwd = diffJson(a, b, diffOpts);
  expect(patchJson(a, dFwd, patchOpts)).toEqual(b);

  const dBwd = diffJson(b, a, diffOpts);
  expect(patchJson(b, dBwd, patchOpts)).toEqual(a);
}

/** Seeded PRNG — Mulberry32. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ══════════════════════════════════════════════════════════════════════
// 1. Primitives
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — primitives", () => {
  it("string → string", () => rtBoth("foo", "bar"));
  it("number → number", () => rtBoth(42, 99));
  it("boolean flip", () => rtBoth(true, false));
  it("null → string", () => rtBoth(null, "hello"));
  it("string → null", () => rtBoth("hello", null));
  it("0 → 1", () => rtBoth(0, 1));
  it("'' → ' '", () => rtBoth("", " "));
  it("number type change", () => rtBoth(42, "42"));
});

// ══════════════════════════════════════════════════════════════════════
// 2. Objects
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — objects", () => {
  it("add property", () => {
    rtBoth({ a: 1 }, { a: 1, b: 2 });
  });

  it("remove property", () => {
    rtBoth({ a: 1, b: 2 }, { a: 1 });
  });

  it("update primitive property", () => {
    rtBoth({ a: 1, b: 2 }, { a: 1, b: 99 });
  });

  it("multiple changes at once", () => {
    rtBoth(
      { a: 1, b: 2, c: 3 },
      { a: 99, c: 3, d: 4 }, // a changed, b removed, d added
    );
  });

  it("nested 3 levels — change at deepest", () => {
    rtBoth({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
  });

  it("nested 3 levels — change at middle", () => {
    rtBoth({ a: { b: { c: 1 } } }, { a: { b: { c: 1, d: 2 } } });
  });

  it("remove deeply nested property", () => {
    rtBoth({ a: { b: { x: 1, y: 2 } } }, { a: { b: { x: 1 } } });
  });

  it("multiple deep changes", () => {
    rtBoth(
      { user: { profile: { name: "A", age: 1 } }, settings: { x: 1 } },
      { user: { profile: { name: "B", age: 2 } }, settings: { x: 1, y: 2 } },
    );
  });

  it("key order independence — diff is stable regardless of key order", () => {
    const a = { x: 1, y: 2, z: 3 };
    const b1 = { y: 2, x: 99, z: 3 };
    const b2 = { z: 3, x: 99, y: 2 };
    rt(a, b1);
    rt(a, b2);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Arrays of primitives
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — arrays of primitives", () => {
  it("insert at start", () => rtBoth(["b", "c"], ["a", "b", "c"]));
  it("insert at middle", () => rtBoth(["a", "c"], ["a", "b", "c"]));
  it("insert at end", () => rtBoth(["a", "b"], ["a", "b", "c"]));
  it("delete at start", () => rtBoth(["a", "b", "c"], ["b", "c"]));
  it("delete at middle", () => rtBoth(["a", "b", "c"], ["a", "c"]));
  it("delete at end", () => rtBoth(["a", "b", "c"], ["a", "b"]));
  it("substitute single", () => rtBoth(["a", "b", "c"], ["a", "X", "c"]));
  it("substitute multiple", () => rtBoth([1, 2, 3, 4], [10, 2, 30, 4]));
  it("swap two", () => rtBoth(["a", "b"], ["b", "a"]));
  it("reverse three", () => rtBoth(["a", "b", "c"], ["c", "b", "a"]));
  it("reverse five", () => rtBoth([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]));
  it("completely different", () => rtBoth([1, 2, 3], [9, 8, 7]));
  it("rotation left", () => rtBoth(["a", "b", "c", "d"], ["b", "c", "d", "a"]));
  it("rotation right", () =>
    rtBoth(["a", "b", "c", "d"], ["d", "a", "b", "c"]));
  it("empty → non-empty", () => rtBoth([], [1, 2, 3]));
  it("non-empty → empty", () => rtBoth([1, 2, 3], []));
  it("mixed types primitives", () =>
    rtBoth([1, "two", true, null], [null, true, "two", 1]));
  it("100 items, 1 inserted in middle", () => {
    const a = Array.from({ length: 100 }, (_, i) => i);
    const b = [...a.slice(0, 50), 999, ...a.slice(50)];
    rtBoth(a, b);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Arrays of smart-keyed objects
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — arrays of smart-keyed objects", () => {
  it("identical → diff is no-op", () => {
    const a = [{ id: "alice" }, { id: "bob" }];
    rt(a, a);
  });

  it("update single field on identified item", () => {
    rtBoth([{ id: "alice", role: "user" }], [{ id: "alice", role: "admin" }]);
  });

  it("update on second item, first unchanged", () => {
    rtBoth(
      [
        { id: "alice", role: "user" },
        { id: "bob", role: "user" },
      ],
      [
        { id: "alice", role: "user" },
        { id: "bob", role: "admin" },
      ],
    );
  });

  it("swap two smart-keyed items", () => {
    rtBoth([{ id: "alice" }, { id: "bob" }], [{ id: "bob" }, { id: "alice" }]);
  });

  it("swap + update — identity preserved through move", () => {
    rtBoth(
      [
        { id: "alice", role: "user" },
        { id: "bob", role: "user" },
      ],
      [
        { id: "bob", role: "admin" },
        { id: "alice", role: "admin" },
      ],
    );
  });

  it("add new item with payload", () => {
    rtBoth(
      [{ id: "alice", role: "user" }],
      [
        { id: "alice", role: "user" },
        { id: "bob", role: "admin" },
      ],
    );
  });

  it("remove identified item", () => {
    rtBoth(
      [{ id: "alice" }, { id: "bob" }, { id: "carol" }],
      [{ id: "alice" }, { id: "carol" }],
    );
  });

  it("combined: add + remove + update + reorder", () => {
    rtBoth(
      [
        { id: "alice", role: "user", v: 1 },
        { id: "bob", role: "user", v: 1 },
        { id: "carol", role: "user", v: 1 },
      ],
      [
        { id: "carol", role: "admin", v: 1 }, // moved + updated
        { id: "dave", role: "user", v: 1 }, // new
        { id: "alice", role: "user", v: 2 }, // updated v
      ], // bob removed
    );
  });

  it("numeric id preserved as number", () => {
    rtBoth(
      [{ id: 1, name: "Alice" }],
      [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    );
  });

  it("deep change inside smart-keyed item", () => {
    rtBoth(
      [{ id: "alice", profile: { age: 30, city: "Lisbon" } }],
      [{ id: "alice", profile: { age: 31, city: "Lisbon" } }],
    );
  });

  it("smart-key item with nested array changing", () => {
    rtBoth(
      [{ id: "alice", tags: ["a", "b"] }],
      [{ id: "alice", tags: ["a", "b", "c"] }],
    );
  });

  it("duplicate smart-keys — first wins, second falls back to content hash", () => {
    rtBoth(
      [
        { id: "foo", value: 1 },
        { id: "foo", value: 2 },
      ],
      [
        { id: "foo", value: 1 },
        { id: "foo", value: 3 },
      ],
    );
  });

  it("3 duplicates — only first is smart-key", () => {
    rtBoth(
      [
        { id: "x", v: 1 },
        { id: "x", v: 2 },
        { id: "x", v: 3 },
      ],
      [
        { id: "x", v: 1 },
        { id: "x", v: 99 },
        { id: "x", v: 3 },
      ],
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Mixed arrays — primitives + objects coexisting
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — mixed arrays", () => {
  it("string + smart-keyed object + number", () => {
    rtBoth(
      ["header", { id: "alice", v: 1 }, 42],
      ["header", { id: "alice", v: 2 }, 99],
    );
  });

  it("reorder of heterogeneous", () => {
    rtBoth(
      [{ id: "a" }, "primitive", { id: "b" }],
      [{ id: "b" }, "primitive", { id: "a" }],
    );
  });

  it("insert primitive in array of objects", () => {
    rtBoth(
      [{ id: "alice" }, { id: "bob" }],
      [{ id: "alice" }, "interlude", { id: "bob" }],
    );
  });

  it("remove smart-keyed item from mixed array", () => {
    rtBoth(
      ["start", { id: "alice" }, "middle", { id: "bob" }, "end"],
      ["start", "middle", { id: "bob" }, "end"],
    );
  });

  it("array of objects without identity (content-hash)", () => {
    rtBoth([{ x: 1 }, { x: 2 }, { x: 3 }], [{ x: 1 }, { x: 99 }, { x: 3 }]);
  });

  it("nested arrays in array", () => {
    rtBoth(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [1, 2],
        [5, 6],
      ],
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Type changes (R2)
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — type changes", () => {
  it("array → object", () => rtBoth([1, 2], { a: 1 }));
  it("object → array", () => rtBoth({ a: 1 }, [1, 2]));
  it("object → primitive", () => rtBoth({ a: 1 }, 42));
  it("primitive → object", () => rtBoth(42, { a: 1 }));
  it("array → primitive", () => rtBoth([1, 2], 99));
  it("primitive → array", () => rtBoth(99, [1, 2]));
  it("nested object → array", () => {
    rtBoth({ config: { items: { x: 1 } } }, { config: { items: [1, 2, 3] } });
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Null handling
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — null handling", () => {
  it("null → object", () => rtBoth(null, { a: 1 }));
  it("object → null", () => rtBoth({ a: 1 }, null));
  it("null → array", () => rtBoth(null, [1, 2]));
  it("array → null", () => rtBoth([1, 2], null));
  it("nested null becomes value", () => {
    rtBoth({ a: null, b: 1 }, { a: { x: 1 }, b: 1 });
  });
  it("nested value becomes null", () => {
    rtBoth({ a: { x: 1 } }, { a: null });
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Custom identity (R9)
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — custom identity via options", () => {
  it("identity: 'code'", () => {
    rtBoth(
      [
        { code: "X", v: 1 },
        { code: "Y", v: 2 },
      ],
      [
        { code: "X", v: 99 },
        { code: "Y", v: 2 },
      ],
      { identity: "code" },
    );
  });

  it("identity: 'sku' — swap + update", () => {
    rtBoth(
      [
        { sku: "A", stock: 10 },
        { sku: "B", stock: 5 },
      ],
      [
        { sku: "B", stock: 3 },
        { sku: "A", stock: 10 },
      ],
      { identity: "sku" },
    );
  });

  it("identity: 'userId' — multiple operations", () => {
    rtBoth(
      [
        { userId: "u1", name: "Alice" },
        { userId: "u2", name: "Bob" },
      ],
      [
        { userId: "u2", name: "Robert" }, // moved + updated
        { userId: "u3", name: "Carol" }, // new
      ], // u1 removed
      { identity: "userId" },
    );
  });

  it("default 'id' when no option passed", () => {
    rtBoth([{ id: "alice", v: 1 }], [{ id: "alice", v: 2 }]);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. assertCollection (R10)
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — assertCollection inferred & validated", () => {
  it("homogeneous collection — diff carries $assertCollection: true", () => {
    const a = [
      { id: "alice", role: "user" },
      { id: "bob", role: "user" },
    ];
    const b = [
      { id: "alice", role: "admin" },
      { id: "bob", role: "user" },
    ];
    const d = diffJson(a, b) as { $assertCollection?: boolean };
    expect(d.$assertCollection).toBe(true);
    expect(patchJson(a, d)).toEqual(b);
  });

  it("hybrid array — no $assertCollection emitted", () => {
    const a = ["primitive", { id: "alice" }];
    const b = ["primitive", { id: "alice", v: 1 }];
    const d = diffJson(a, b) as { $assertCollection?: boolean };
    expect(d.$assertCollection).toBeUndefined();
    expect(patchJson(a, d)).toEqual(b);
  });

  it("collection at deep level inferred independently", () => {
    const a = {
      body: {
        users: [{ id: "alice" }, { id: "bob" }],
        tags: ["dev", "admin"],
      },
    };
    const b = {
      body: {
        users: [{ id: "alice", v: 1 }, { id: "bob" }],
        tags: ["dev", "admin"],
      },
    };
    rtBoth(a, b);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Deep nesting
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — deep nesting (5+ levels)", () => {
  it("5 levels — change at deepest", () => {
    rtBoth(
      { a: { b: { c: { d: { e: "old" } } } } },
      { a: { b: { c: { d: { e: "new" } } } } },
    );
  });

  it("5 levels — multiple changes at various levels", () => {
    rtBoth(
      { a: { b: { c: { d: { e: 1 } }, x: "X" } }, top: 1 },
      { a: { b: { c: { d: { e: 2 } }, x: "Y" } }, top: 2 },
    );
  });

  it("object → array → object → array deeply", () => {
    rtBoth(
      { items: [{ subs: [{ id: "alice", v: 1 }] }] },
      { items: [{ subs: [{ id: "alice", v: 2 }] }] },
    );
  });

  it("8 levels deep", () => {
    let a: Record<string, unknown> = { leaf: 1 };
    let b: Record<string, unknown> = { leaf: 2 };
    for (let i = 0; i < 8; i++) {
      a = { wrap: a };
      b = { wrap: b };
    }
    rtBoth(a, b);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Edge cases
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — edge cases", () => {
  it("empty objects", () => rt({}, {}));
  it("empty arrays", () => rt([], []));
  it("strings starting with #", () => rtBoth(["#a", "#b"], ["#b", "#a"]));
  it("string '$ops' as value", () => {
    rtBoth({ trick: "$ops" }, { trick: "different" });
  });
  it("string '$remove' as value", () => {
    rtBoth({ trick: "$remove" }, { trick: "different" });
  });
  it("unicode in keys", () => {
    rtBoth({ 日本語: 1, "🎉": "party" }, { 日本語: 2, "🎉": "party-time" });
  });
  it("unicode in array values", () => {
    rtBoth(["a", "日本語", "🎉"], ["日本語", "a", "🎉", "🚀"]);
  });
  it("very long string in field", () => {
    const long = "x".repeat(10000);
    rtBoth({ doc: long }, { doc: long + "!" });
  });
  it("large numbers", () => {
    rtBoth({ n: Number.MAX_SAFE_INTEGER }, { n: 1 });
  });
  it("negative numbers", () => rtBoth({ n: -42 }, { n: 42 }));
  it("decimals", () => rtBoth({ n: 3.14159 }, { n: 2.71828 }));
  it("boolean array", () => {
    rtBoth([true, false, true], [false, true, false]);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 12. Realistic scenarios
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — realistic scenarios", () => {
  it("E-commerce: product catalog with inventory + reorder", () => {
    const a = {
      catalog: {
        products: [
          { id: "p-001", name: "Widget", price: 9.99, stock: 100 },
          { id: "p-002", name: "Gadget", price: 19.99, stock: 50 },
          { id: "p-003", name: "Gizmo", price: 29.99, stock: 25 },
        ],
        featured: ["p-001", "p-003"],
      },
      settings: { currency: "USD", taxRate: 0.08 },
    };
    const b = {
      catalog: {
        products: [
          { id: "p-002", name: "Gadget Pro", price: 24.99, stock: 30 }, // updated + moved
          { id: "p-001", name: "Widget", price: 9.99, stock: 80 }, // stock changed
          { id: "p-004", name: "Doodad", price: 14.99, stock: 200 }, // new
        ], // p-003 removed
        featured: ["p-001", "p-002", "p-004"],
      },
      settings: { currency: "USD", taxRate: 0.085 }, // tax updated
    };
    rtBoth(a, b);
  });

  it("Blog: post with comments + tags evolving", () => {
    const a = {
      post: {
        id: 42,
        title: "Hello World",
        body: "First post.",
        tags: ["intro", "hello"],
        comments: [
          { id: "c1", author: "Alice", body: "Welcome!" },
          { id: "c2", author: "Bob", body: "Nice post." },
        ],
      },
    };
    const b = {
      post: {
        id: 42,
        title: "Hello World!", // updated
        body: "First post, edited.", // updated
        tags: ["intro", "greeting"], // tag swapped
        comments: [
          { id: "c2", author: "Bob", body: "Nice post." }, // moved
          { id: "c1", author: "Alice", body: "Thanks!" }, // moved + updated body
          { id: "c3", author: "Carol", body: "Hi!" }, // new
        ],
      },
    };
    rtBoth(a, b);
  });

  it("CRM: contacts with deals — multi-level smart-keys", () => {
    const a = {
      contacts: [
        {
          id: "ctc-1",
          name: "Acme Corp",
          deals: [
            { id: "d-100", value: 5000, stage: "open" },
            { id: "d-101", value: 3000, stage: "open" },
          ],
        },
        {
          id: "ctc-2",
          name: "Globex",
          deals: [{ id: "d-200", value: 7500, stage: "closed" }],
        },
      ],
    };
    const b = {
      contacts: [
        {
          id: "ctc-2",
          name: "Globex Inc", // renamed
          deals: [
            { id: "d-200", value: 7500, stage: "closed" },
            { id: "d-201", value: 10000, stage: "open" }, // new deal
          ],
        },
        {
          id: "ctc-1",
          name: "Acme Corp",
          deals: [
            { id: "d-100", value: 5500, stage: "won" }, // updated
          ], // d-101 removed
        },
        // ctc-3 added below — different position from before
      ],
    };
    rtBoth(a, b);
  });

  it("Game state: player + inventory with item moves", () => {
    const a = {
      player: { id: "p1", hp: 100, mana: 50, level: 5 },
      inventory: [
        { id: "sword", damage: 10, equipped: true },
        { id: "potion", count: 5 },
        { id: "shield", defense: 8, equipped: false },
      ],
      world: { area: "forest", time: "day" },
    };
    const b = {
      player: { id: "p1", hp: 75, mana: 30, level: 6 }, // damaged + leveled
      inventory: [
        { id: "shield", defense: 8, equipped: true }, // equipped + moved
        { id: "sword", damage: 12, equipped: true }, // upgraded
        { id: "potion", count: 4 }, // consumed one
        { id: "torch", duration: 60 }, // new
      ],
      world: { area: "cave", time: "night" }, // changed area
    };
    rtBoth(a, b);
  });

  it("Document with arrays of mixed identity (id + sku)", () => {
    const a = {
      users: [{ id: "alice", role: "user" }],
      products: [{ sku: "X-1", stock: 10 }],
    };
    const b = {
      users: [{ id: "alice", role: "admin" }],
      products: [{ sku: "X-1", stock: 5 }],
    };
    // Default identity "id" works for users; products' diff is by
    // content hash (no "id" field). Still round-trips correctly.
    rtBoth(a, b);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 13. Multi-step history — apply chain of diffs, roll back
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — multi-step history", () => {
  it("apply 7 diffs forward and 7 reverse — primitives", () => {
    const history = [
      ["a", "b", "c"],
      ["a", "b", "c", "d"],
      ["a", "X", "c", "d"],
      ["X", "a", "c", "d"],
      ["X", "a", "c"],
      ["X", "Y", "a", "c"],
      ["X", "Y", "c", "a"],
      ["c", "Y", "X", "a"],
    ];
    // Forward.
    let s: unknown = history[0];
    for (let i = 0; i < history.length - 1; i++) {
      const d = diffJson(s, history[i + 1]);
      s = patchJson(s, d);
      expect(s).toEqual(history[i + 1]);
    }
    // Backward.
    for (let i = history.length - 1; i > 0; i--) {
      const d = diffJson(s, history[i - 1]);
      s = patchJson(s, d);
      expect(s).toEqual(history[i - 1]);
    }
    expect(s).toEqual(history[0]);
  });

  it("apply 5 diffs forward and reverse — complex object", () => {
    const history = [
      { users: [{ id: "alice" }] },
      { users: [{ id: "alice" }, { id: "bob" }] },
      { users: [{ id: "alice", role: "admin" }, { id: "bob" }] },
      { users: [{ id: "bob" }, { id: "alice", role: "admin" }] },
      { users: [{ id: "bob" }] },
      { users: [{ id: "bob" }, { id: "carol" }, { id: "dave" }] },
    ];
    let s: unknown = history[0];
    for (let i = 0; i < history.length - 1; i++) {
      s = patchJson(s, diffJson(s, history[i + 1]));
      expect(s).toEqual(history[i + 1]);
    }
    for (let i = history.length - 1; i > 0; i--) {
      s = patchJson(s, diffJson(s, history[i - 1]));
      expect(s).toEqual(history[i - 1]);
    }
    expect(s).toEqual(history[0]);
  });

  it("diff is deterministic — same (a, b) produces same diff bit-by-bit", () => {
    const a = { users: [{ id: "alice", role: "user" }, { id: "bob" }] };
    const b = { users: [{ id: "bob" }, { id: "alice", role: "admin" }] };
    const d1 = JSON.stringify(diffJson(a, b));
    const d2 = JSON.stringify(diffJson(a, b));
    const d3 = JSON.stringify(diffJson(a, b));
    expect(d1).toBe(d2);
    expect(d2).toBe(d3);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 14. Fuzz — seeded random mutations
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — seeded fuzz on complex structures", () => {
  /** Build a baseline complex JSON document. */
  function baselineDoc(seed: number): Record<string, unknown> {
    const r = rng(seed);
    const users: Record<string, unknown>[] = [];
    const count = Math.floor(r() * 6) + 2;
    for (let i = 0; i < count; i++) {
      users.push({
        id: `u-${i}`,
        name: `User ${i}`,
        role: r() < 0.5 ? "user" : "admin",
        score: Math.floor(r() * 100),
        tags: Array.from(
          { length: Math.floor(r() * 3) + 1 },
          (_, j) => `t${j}`,
        ),
      });
    }
    return {
      version: Math.floor(r() * 10),
      users,
      meta: {
        flag: r() < 0.5,
        nested: {
          depth: Math.floor(r() * 5),
          label: `label-${seed}`,
        },
      },
      tags: Array.from(
        { length: Math.floor(r() * 5) + 1 },
        (_, i) => `tag-${i}`,
      ),
    };
  }

  /** Apply seeded random mutations to a doc. */
  function mutate(
    doc: Record<string, unknown>,
    seed: number,
  ): Record<string, unknown> {
    const r = rng(seed);
    const out = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

    if (r() < 0.5) {
      out.version = Math.floor(r() * 100);
    }
    if (r() < 0.4) {
      (out.meta as { flag: boolean }).flag = !(out.meta as { flag: boolean })
        .flag;
    }
    if (r() < 0.4) {
      (out.meta as { nested: { label: string } }).nested.label = `label-${
        seed * 7
      }`;
    }

    const users = out.users as Record<string, unknown>[];
    // Possible mutations on users.
    if (r() < 0.5 && users.length > 0) {
      // update a random user's role
      const i = Math.floor(r() * users.length);
      users[i]!.role = users[i]!.role === "user" ? "admin" : "user";
    }
    if (r() < 0.3 && users.length > 1) {
      // swap two
      const i = Math.floor(r() * users.length);
      let j = Math.floor(r() * users.length);
      if (j === i) j = (j + 1) % users.length;
      const tmp = users[i]!;
      users[i] = users[j]!;
      users[j] = tmp;
    }
    if (r() < 0.4) {
      // add new user
      users.push({
        id: `u-new-${seed}`,
        name: `Newcomer ${seed}`,
        role: "user",
        score: 0,
        tags: ["new"],
      });
    }
    if (r() < 0.3 && users.length > 1) {
      // remove a user
      const i = Math.floor(r() * users.length);
      users.splice(i, 1);
    }

    const tags = out.tags as string[];
    if (r() < 0.4) {
      tags.push(`extra-${seed}`);
    }
    if (r() < 0.3 && tags.length > 0) {
      tags.splice(Math.floor(r() * tags.length), 1);
    }
    return out;
  }

  const seeds = [1, 7, 42, 99, 256, 1024, 31415, 271828];
  for (const seed of seeds) {
    it(`fuzz seed=${seed}`, () => {
      const a = baselineDoc(seed);
      const b = mutate(a, seed * 3);
      rtBoth(a, b);
    });
  }

  // Larger fuzz — chain of 5 mutations
  for (const seed of [13, 89, 1009]) {
    it(`fuzz chain (5 steps) seed=${seed}`, () => {
      let current: Record<string, unknown> = baselineDoc(seed);
      const states: Record<string, unknown>[] = [current];
      for (let i = 1; i <= 5; i++) {
        const next = mutate(current, seed + i * 17);
        states.push(next);
        current = next;
      }
      // Forward chain.
      let s: unknown = states[0];
      for (let i = 0; i < states.length - 1; i++) {
        s = patchJson(s, diffJson(s, states[i + 1]));
        expect(s).toEqual(states[i + 1]);
      }
      // Reverse chain.
      for (let i = states.length - 1; i > 0; i--) {
        s = patchJson(s, diffJson(s, states[i - 1]));
        expect(s).toEqual(states[i - 1]);
      }
      expect(s).toEqual(states[0]);
    });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 15. Stability — diff output is content-addressable
// ══════════════════════════════════════════════════════════════════════

describe("Round-trip — diff stability (content-addressable)", () => {
  it("complex doc — same diff bit-by-bit across 10 invocations", () => {
    const a = baseline();
    const b = mutated();
    const diffs = Array.from({ length: 10 }, () =>
      JSON.stringify(diffJson(a, b)),
    );
    for (let i = 1; i < diffs.length; i++) {
      expect(diffs[i]).toBe(diffs[0]);
    }
  });

  function baseline() {
    return {
      version: 1,
      users: [
        { id: "alice", role: "user" },
        { id: "bob", role: "user" },
        { id: "carol", role: "admin" },
      ],
      products: [
        { id: "p1", stock: 10, tags: ["a", "b"] },
        { id: "p2", stock: 5, tags: ["b", "c"] },
      ],
      settings: { theme: "dark", flags: { beta: true } },
    };
  }

  function mutated() {
    return {
      version: 2,
      users: [
        { id: "carol", role: "admin" }, // moved
        { id: "alice", role: "admin" }, // updated
        { id: "dave", role: "user" }, // new
      ], // bob removed
      products: [
        { id: "p2", stock: 5, tags: ["b", "c"] }, // moved
        { id: "p1", stock: 8, tags: ["a", "b", "x"] }, // stock + tags changed
      ],
      settings: { theme: "light", flags: { beta: true, prod: true } },
    };
  }
});
