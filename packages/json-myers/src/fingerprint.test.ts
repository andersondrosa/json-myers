/**
 * Unit tests for `fingerprintItem` + `hashValue`.
 *
 * Critical invariants tested:
 *
 *  1. Distinct types of "same-looking" values get distinct fingerprints
 *     (no cross-type collision).
 *  2. Anti-collision: literal string `"#abc"` ≠ smart-key `"#abc"` from
 *     `{ key: "abc" }`.
 *  3. Determinism: same content → same fingerprint, regardless of
 *     object key insertion order.
 *  4. Smart-key precedence: `id` and `key` fields produce smart-key
 *     fingerprints; absence falls back to content hash.
 *  5. Recursion: nested objects and arrays hash deterministically.
 */
import { describe, expect, it } from "vitest";
import { fingerprintItem, hashValue } from "./fingerprint.js";

// ── 1. Distinct types ─────────────────────────────────────────────

describe("fingerprint — distinct types", () => {
  it("null is distinct from string 'null'", () => {
    expect(fingerprintItem(null)).not.toBe(fingerprintItem("null"));
  });

  it("number 0 is distinct from string '0'", () => {
    expect(fingerprintItem(0)).not.toBe(fingerprintItem("0"));
  });

  it("number 0 is distinct from boolean false", () => {
    expect(fingerprintItem(0)).not.toBe(fingerprintItem(false));
  });

  it("number 1 is distinct from boolean true", () => {
    expect(fingerprintItem(1)).not.toBe(fingerprintItem(true));
  });

  it("string 'true' is distinct from boolean true", () => {
    expect(fingerprintItem("true")).not.toBe(fingerprintItem(true));
  });

  it("empty array distinct from empty object", () => {
    expect(fingerprintItem([])).not.toBe(fingerprintItem({}));
  });

  it("empty array distinct from null", () => {
    expect(fingerprintItem([])).not.toBe(fingerprintItem(null));
  });
});

// ── 2. Anti-collision (the v1 escape system problem) ──────────────

describe("fingerprint — anti-collision (#-prefix)", () => {
  it("string '#abc' ≠ smart-key '#abc' from { id: 'abc' }", () => {
    const literalString = fingerprintItem("#abc");
    const smartKey = fingerprintItem({ id: "abc" });
    expect(smartKey).toBe("#abc");
    expect(literalString).not.toBe(smartKey);
    // Literal string keeps the primitive prefix.
    expect(literalString).toMatch(/^p:s:#abc$/);
  });

  it("string '#1' ≠ smart-key '#1' from { id: 1 }", () => {
    const literal = fingerprintItem("#1");
    const smart = fingerprintItem({ id: 1 });
    expect(smart).toBe("#1");
    expect(literal).not.toBe(smart);
  });
});

// ── 3. Determinism (key order independence) ───────────────────────

describe("fingerprint — determinism across key order", () => {
  it("same object, different key order → same fingerprint", () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { z: 3, y: 2, x: 1 };
    expect(fingerprintItem(a)).toBe(fingerprintItem(b));
  });

  it("nested objects with different key orders → same fingerprint", () => {
    const a = { user: { name: "Ana", age: 30 }, version: 1 };
    const b = { version: 1, user: { age: 30, name: "Ana" } };
    expect(fingerprintItem(a)).toBe(fingerprintItem(b));
  });

  it("hashValue stable across repeated calls", () => {
    const v = { a: 1, b: [2, 3, { c: "x" }] };
    const h1 = hashValue(v);
    const h2 = hashValue(v);
    expect(h1).toBe(h2);
  });

  it("hashValue stable across structurally-equal independent constructions", () => {
    const v1 = { a: 1, b: [2, 3, { c: "x" }] };
    const v2 = JSON.parse(JSON.stringify(v1));
    expect(hashValue(v1)).toBe(hashValue(v2));
  });
});

// ── 4. Smart-key precedence ───────────────────────────────────────

describe("fingerprint — smart-key (default identity 'id')", () => {
  it("default `id` field produces smart-key fingerprint", () => {
    expect(fingerprintItem({ id: "alice", role: "user" })).toBe("#alice");
  });

  it("configurable identity — custom field name", () => {
    expect(fingerprintItem({ code: "PRD-1", v: 1 }, "code")).toBe("#PRD-1");
    expect(fingerprintItem({ sku: "X", v: 1 }, "sku")).toBe("#X");
    expect(fingerprintItem({ userId: "u-1" }, "userId")).toBe("#u-1");
  });

  it("default `id` ignores `key` (no fallback)", () => {
    // v2 had a `key` fallback; v3 honors only the declared identity field.
    expect(fingerprintItem({ key: "foo", v: 1 })).toMatch(/^h:[0-9a-f]+$/);
  });

  it("custom identity ignores other fields", () => {
    // With identity="code", `id` is just another property.
    const fp = fingerprintItem({ id: "alice", code: "PRD-1" }, "code");
    expect(fp).toBe("#PRD-1");
  });

  it("numeric identity is stringified in the fingerprint", () => {
    expect(fingerprintItem({ id: 42 })).toBe("#42");
  });

  it("object without identity field falls back to content hash", () => {
    const fp = fingerprintItem({ name: "Ana", age: 30 });
    expect(fp).toMatch(/^h:[0-9a-f]+$/);
  });

  it("smart-key remains stable as other properties change", () => {
    const a = fingerprintItem({ id: "alice", v: 1 });
    const b = fingerprintItem({ id: "alice", v: 999 });
    expect(a).toBe(b); // identity preserved; content evolves
  });

  it("non-string non-number identity value falls back to content hash", () => {
    // `id: true` is unusual; we don't treat booleans as identities.
    const fp = fingerprintItem({ id: true, v: 1 });
    expect(fp).toMatch(/^h:[0-9a-f]+$/);
  });
});

// ── 5. Content hash sensitivity ───────────────────────────────────

describe("fingerprint — content hash sensitivity", () => {
  it("changing one field changes the hash", () => {
    const a = fingerprintItem({ name: "Ana", age: 30 });
    const b = fingerprintItem({ name: "Ana", age: 31 });
    expect(a).not.toBe(b);
  });

  it("adding a field changes the hash", () => {
    const a = fingerprintItem({ name: "Ana" });
    const b = fingerprintItem({ name: "Ana", role: "user" });
    expect(a).not.toBe(b);
  });

  it("removing a field changes the hash", () => {
    const a = fingerprintItem({ name: "Ana", role: "user" });
    const b = fingerprintItem({ name: "Ana" });
    expect(a).not.toBe(b);
  });

  it("arrays — same content same hash", () => {
    expect(fingerprintItem([1, 2, 3])).toBe(fingerprintItem([1, 2, 3]));
  });

  it("arrays — order matters", () => {
    expect(fingerprintItem([1, 2, 3])).not.toBe(fingerprintItem([3, 2, 1]));
  });

  it("nested array within object — recursive hash", () => {
    const a = fingerprintItem({ list: [1, 2, 3] });
    const b = fingerprintItem({ list: [1, 2, 3] });
    expect(a).toBe(b);
  });

  it("nested object within array — recursive hash", () => {
    const a = fingerprintItem([{ x: 1 }, { y: 2 }]);
    const b = fingerprintItem([{ x: 1 }, { y: 2 }]);
    expect(a).toBe(b);
  });

  it("deep change deep into structure changes top fingerprint", () => {
    const a = fingerprintItem({ a: { b: { c: 1 } } });
    const b = fingerprintItem({ a: { b: { c: 2 } } });
    expect(a).not.toBe(b);
  });
});

// ── 6. Edge cases ─────────────────────────────────────────────────

describe("fingerprint — edge cases", () => {
  it("NaN has deterministic fingerprint", () => {
    expect(fingerprintItem(NaN)).toBe(fingerprintItem(NaN));
  });

  it("Infinity has deterministic fingerprint", () => {
    expect(fingerprintItem(Infinity)).toBe(fingerprintItem(Infinity));
  });

  it("-Infinity is distinct from Infinity", () => {
    expect(fingerprintItem(-Infinity)).not.toBe(fingerprintItem(Infinity));
  });

  it("empty object and object with empty string key are distinct", () => {
    expect(fingerprintItem({})).not.toBe(fingerprintItem({ "": "" }));
  });

  it("string of 1000 chars hashes in a reasonable time", () => {
    const long = "a".repeat(1000);
    const t0 = performance.now();
    fingerprintItem(long);
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(50); // sanity: not pathologically slow
  });

  it("deeply nested object hashes deterministically", () => {
    let v: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 20; i++) {
      v = { wrap: v };
    }
    expect(fingerprintItem(v)).toBe(fingerprintItem(structuredClone(v)));
  });
});
