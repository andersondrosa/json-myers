/**
 * Unit tests for the Myers O(ND) algorithm.
 *
 * These tests are isolated to the core algorithm — no JSON, no
 * fingerprints, no smart-keys. Just `T[]` in, `Edit<T>[]` out.
 *
 * Property tested across all cases: applying the edit script to `a`
 * reconstructs `b` exactly.
 */
import { describe, expect, it } from "vitest";
import { myers, type Edit } from "./myers.js";

// ── Property: applying the edit script reconstructs B ─────────────

function applyEdits<T>(a: readonly T[], edits: readonly Edit<T>[]): T[] {
  // Walk both sequences in parallel using the edit script.
  const out: T[] = [];
  let i = 0;
  for (const e of edits) {
    if (e.type === "keep") {
      out.push(a[i]!);
      i++;
    } else if (e.type === "del") {
      i++;
    } else {
      out.push(e.item);
    }
  }
  // Any remaining keeps would have already been emitted; nothing else.
  return out;
}

/** Count distinct edit types in a script. */
function tally<T>(edits: readonly Edit<T>[]) {
  return {
    keep: edits.filter((e) => e.type === "keep").length,
    del: edits.filter((e) => e.type === "del").length,
    ins: edits.filter((e) => e.type === "ins").length,
  };
}

// ── Edge cases ────────────────────────────────────────────────────

describe("myers — edge cases", () => {
  it("both empty → empty script", () => {
    expect(myers([], [])).toEqual([]);
  });

  it("A empty → all inserts", () => {
    const edits = myers([], ["a", "b", "c"]);
    expect(tally(edits)).toEqual({ keep: 0, del: 0, ins: 3 });
    expect(applyEdits([], edits)).toEqual(["a", "b", "c"]);
  });

  it("B empty → all deletes", () => {
    const edits = myers(["a", "b", "c"], []);
    expect(tally(edits)).toEqual({ keep: 0, del: 3, ins: 0 });
    expect(applyEdits(["a", "b", "c"], edits)).toEqual([]);
  });

  it("identical → all keeps, no edits", () => {
    const a = ["a", "b", "c"];
    const edits = myers(a, a);
    expect(tally(edits)).toEqual({ keep: 3, del: 0, ins: 0 });
    expect(applyEdits(a, edits)).toEqual(a);
  });

  it("single element identical", () => {
    expect(myers(["x"], ["x"])).toEqual([{ type: "keep", item: "x" }]);
  });

  it("single element changed → del + ins", () => {
    const edits = myers(["a"], ["b"]);
    expect(tally(edits)).toEqual({ keep: 0, del: 1, ins: 1 });
    expect(applyEdits(["a"], edits)).toEqual(["b"]);
  });
});

// ── Classical patterns ────────────────────────────────────────────

describe("myers — classical patterns", () => {
  it("insert at start", () => {
    const edits = myers(["b", "c"], ["a", "b", "c"]);
    expect(applyEdits(["b", "c"], edits)).toEqual(["a", "b", "c"]);
    expect(tally(edits)).toEqual({ keep: 2, del: 0, ins: 1 });
  });

  it("insert at middle", () => {
    const edits = myers(["a", "c"], ["a", "b", "c"]);
    expect(applyEdits(["a", "c"], edits)).toEqual(["a", "b", "c"]);
    expect(tally(edits)).toEqual({ keep: 2, del: 0, ins: 1 });
  });

  it("insert at end", () => {
    const edits = myers(["a", "b"], ["a", "b", "c"]);
    expect(applyEdits(["a", "b"], edits)).toEqual(["a", "b", "c"]);
    expect(tally(edits)).toEqual({ keep: 2, del: 0, ins: 1 });
  });

  it("delete at start", () => {
    const edits = myers(["a", "b", "c"], ["b", "c"]);
    expect(applyEdits(["a", "b", "c"], edits)).toEqual(["b", "c"]);
    expect(tally(edits)).toEqual({ keep: 2, del: 1, ins: 0 });
  });

  it("delete at middle", () => {
    const edits = myers(["a", "b", "c"], ["a", "c"]);
    expect(applyEdits(["a", "b", "c"], edits)).toEqual(["a", "c"]);
    expect(tally(edits)).toEqual({ keep: 2, del: 1, ins: 0 });
  });

  it("delete at end", () => {
    const edits = myers(["a", "b", "c"], ["a", "b"]);
    expect(applyEdits(["a", "b", "c"], edits)).toEqual(["a", "b"]);
    expect(tally(edits)).toEqual({ keep: 2, del: 1, ins: 0 });
  });

  it("substitution → del + ins (Myers doesn't model substitution natively)", () => {
    const edits = myers(["a", "b", "c"], ["a", "X", "c"]);
    expect(applyEdits(["a", "b", "c"], edits)).toEqual(["a", "X", "c"]);
    expect(tally(edits)).toEqual({ keep: 2, del: 1, ins: 1 });
  });

  it("complete swap of 2 elements", () => {
    const edits = myers(["a", "b"], ["b", "a"]);
    expect(applyEdits(["a", "b"], edits)).toEqual(["b", "a"]);
    // Minimum: del a, then ins a after b — or vice versa. 1 del + 1 ins.
    expect(tally(edits)).toEqual({ keep: 1, del: 1, ins: 1 });
  });

  it("reverse of 3 elements", () => {
    const edits = myers(["a", "b", "c"], ["c", "b", "a"]);
    expect(applyEdits(["a", "b", "c"], edits)).toEqual(["c", "b", "a"]);
  });
});

// ── Classic Myers paper example ───────────────────────────────────

describe("myers — paper example (Myers 1986)", () => {
  // The example from Section 4 of the paper:
  //   A = ABCABBA
  //   B = CBABAC
  // Edit distance D = 5
  it("ABCABBA → CBABAC reconstructs correctly", () => {
    const a = ["A", "B", "C", "A", "B", "B", "A"];
    const b = ["C", "B", "A", "B", "A", "C"];
    const edits = myers(a, b);
    expect(applyEdits(a, edits)).toEqual(b);
    // Minimum edit distance from the paper is D=5.
    const { del, ins } = tally(edits);
    expect(del + ins).toBe(5);
  });
});

// ── Longer sequences ──────────────────────────────────────────────

describe("myers — longer sequences", () => {
  it("two snakes around an edit hunk", () => {
    const a = ["a", "b", "c", "d", "e", "f", "g"];
    const b = ["a", "b", "X", "Y", "e", "f", "g"];
    const edits = myers(a, b);
    expect(applyEdits(a, edits)).toEqual(b);
    expect(tally(edits)).toEqual({ keep: 5, del: 2, ins: 2 });
  });

  it("alternating identical and different", () => {
    const a = ["a", "1", "b", "2", "c", "3"];
    const b = ["a", "X", "b", "Y", "c", "Z"];
    const edits = myers(a, b);
    expect(applyEdits(a, edits)).toEqual(b);
    expect(tally(edits)).toEqual({ keep: 3, del: 3, ins: 3 });
  });

  it("100-element identical sequences → 0 edits", () => {
    const a = Array.from({ length: 100 }, (_, i) => `line-${i}`);
    const edits = myers(a, a);
    expect(tally(edits)).toEqual({ keep: 100, del: 0, ins: 0 });
  });

  it("100-element with one insertion at position 50", () => {
    const a = Array.from({ length: 100 }, (_, i) => `line-${i}`);
    const b = [...a.slice(0, 50), "INSERTED", ...a.slice(50)];
    const edits = myers(a, b);
    expect(applyEdits(a, edits)).toEqual(b);
    expect(tally(edits)).toEqual({ keep: 100, del: 0, ins: 1 });
  });
});

// ── Custom eq function ────────────────────────────────────────────

describe("myers — custom equality", () => {
  it("case-insensitive string comparison", () => {
    const a = ["Hello", "World"];
    const b = ["HELLO", "world"];
    const edits = myers(a, b, (x, y) => x.toLowerCase() === y.toLowerCase());
    expect(tally(edits)).toEqual({ keep: 2, del: 0, ins: 0 });
  });

  it("object equality by id field", () => {
    type Item = { id: string; v: number };
    const a: Item[] = [
      { id: "x", v: 1 },
      { id: "y", v: 2 },
    ];
    const b: Item[] = [
      { id: "x", v: 99 }, // same id, different v → considered equal
      { id: "z", v: 3 },
    ];
    const edits = myers(a, b, (x, y) => x.id === y.id);
    expect(tally(edits)).toEqual({ keep: 1, del: 1, ins: 1 });
  });
});

// ── Property: indices on del/ins are stable ───────────────────────

describe("myers — index positions on operations", () => {
  it("del.index points into A", () => {
    const edits = myers(["a", "b", "c"], ["a", "c"]);
    const del = edits.find((e) => e.type === "del");
    expect(del).toBeDefined();
    if (del && del.type === "del") {
      expect(del.index).toBe(1); // "b" was at index 1 of A
    }
  });

  it("ins.index points into B", () => {
    const edits = myers(["a", "c"], ["a", "b", "c"]);
    const ins = edits.find((e) => e.type === "ins");
    expect(ins).toBeDefined();
    if (ins && ins.type === "ins") {
      expect(ins.index).toBe(1); // "b" is at index 1 of B
    }
  });
});
