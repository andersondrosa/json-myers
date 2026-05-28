/**
 * Unit tests for the positional-identity (`:index`) mode of
 * `applyArrayOps` — used by Nd matrices and any array where the
 * INDEX itself is the identity.
 *
 * Critical invariants tested:
 *
 *   1. Sibling-key nested updates are routed by numeric index when
 *      `$identity === ":index"` (cell editing in 2D/3D matrices).
 *   2. Non-integer / out-of-range sibling keys silently skip in normal
 *      mode and throw `KEY_NOT_FOUND` in strict mode.
 *   3. Positional `$ops` (add/remove with `index`) operate unchanged
 *      and compose cleanly with cell editing.
 *   4. `$assertCollection: true` is SILENCED when the array is
 *      positional (matrices are not homogeneous-identity collections).
 *   5. Smart-key composition — a cell that holds a `{ id }` object
 *      recurses into smart-key semantics naturally.
 *   6. The default smart-key path is unaffected (regression guard for
 *      the Map-based lookup optimization).
 */
import { describe, expect, it } from "vitest";
import { applyArrayOps } from "./applyArrayOps.js";
import {
  POSITIONAL_IDENTITY,
  isStrictViolationError,
  type OpsDiff,
} from "./types.js";

// ── 1. Cell editing — 2D ─────────────────────────────────────────────

describe(":index — 2D cell editing", () => {
  it("edits a single cell via two levels of $identity", () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "1": {
        $ops: [],
        $identity: POSITIONAL_IDENTITY,
        "2": 60,
      },
    };
    const result = applyArrayOps(matrix, diff);
    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 60],
      [7, 8, 9],
    ]);
  });

  it("edits multiple cells in different rows", () => {
    const matrix = [
      [1, 2],
      [3, 4],
    ];
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "0": { $ops: [], $identity: POSITIONAL_IDENTITY, "1": 99 },
      "1": { $ops: [], $identity: POSITIONAL_IDENTITY, "0": 88 },
    };
    const result = applyArrayOps(matrix, diff);
    expect(result).toEqual([
      [1, 99],
      [88, 4],
    ]);
  });

  it("does not mutate the input", () => {
    const matrix = [
      [1, 2],
      [3, 4],
    ];
    const snapshot = JSON.parse(JSON.stringify(matrix));
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "0": { $ops: [], $identity: POSITIONAL_IDENTITY, "0": 100 },
    };
    applyArrayOps(matrix, diff);
    expect(matrix).toEqual(snapshot);
  });
});

// ── 2. Cell editing — 3D ─────────────────────────────────────────────

describe(":index — 3D cell editing", () => {
  it("edits a single cell in a 2×2×2 cube via three levels", () => {
    const cube = [
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ];
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "1": {
        $ops: [],
        $identity: POSITIONAL_IDENTITY,
        "0": {
          $ops: [],
          $identity: POSITIONAL_IDENTITY,
          "1": 99,
        },
      },
    };
    const result = applyArrayOps(cube, diff);
    expect(result).toEqual([
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 99],
        [7, 8],
      ],
    ]);
  });
});

// ── 3. Edge cases — sibling key parsing ──────────────────────────────

describe(":index — sibling key parsing", () => {
  const base = [10, 20, 30];

  it("silently skips non-integer keys in normal mode", () => {
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      foo: 99,
    };
    const result = applyArrayOps(base, diff);
    expect(result).toEqual([10, 20, 30]);
  });

  it("silently skips out-of-range indices in normal mode", () => {
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "7": 99,
    };
    const result = applyArrayOps(base, diff);
    expect(result).toEqual([10, 20, 30]);
  });

  it("silently skips negative indices in normal mode", () => {
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "-1": 99,
    };
    const result = applyArrayOps(base, diff);
    expect(result).toEqual([10, 20, 30]);
  });

  it("silently skips fractional indices in normal mode", () => {
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "1.5": 99,
    };
    const result = applyArrayOps(base, diff);
    expect(result).toEqual([10, 20, 30]);
  });

  it("strict: throws KEY_NOT_FOUND on non-integer sibling key", () => {
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      foo: 99,
    };
    try {
      applyArrayOps(base, diff, { strict: true });
      throw new Error("expected throw");
    } catch (err) {
      expect(isStrictViolationError(err)).toBe(true);
      if (isStrictViolationError(err)) {
        expect(err.code).toBe("KEY_NOT_FOUND");
      }
    }
  });

  it("strict: throws KEY_NOT_FOUND on out-of-range index", () => {
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "7": 99,
    };
    try {
      applyArrayOps(base, diff, { strict: true });
      throw new Error("expected throw");
    } catch (err) {
      expect(isStrictViolationError(err)).toBe(true);
      if (isStrictViolationError(err)) {
        expect(err.code).toBe("KEY_NOT_FOUND");
      }
    }
  });

  it("accepts index 0 (edge of valid range)", () => {
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "0": 999,
    };
    const result = applyArrayOps(base, diff);
    expect(result).toEqual([999, 20, 30]);
  });
});

// ── 4. Composition with positional $ops ──────────────────────────────

describe(":index — composition with $ops", () => {
  it("adds a new row and edits an existing one in the same patch", () => {
    const matrix = [
      [1, 2],
      [3, 4],
    ];
    const diff: OpsDiff = {
      $ops: [{ type: "add", index: 2, item: [5, 6] }],
      $identity: POSITIONAL_IDENTITY,
      "0": { $ops: [], $identity: POSITIONAL_IDENTITY, "1": 99 },
    };
    const result = applyArrayOps(matrix, diff);
    expect(result).toEqual([
      [1, 99],
      [3, 4],
      [5, 6],
    ]);
  });

  it("removes a row and edits another", () => {
    const matrix = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    const diff: OpsDiff = {
      $ops: [{ type: "remove", index: 1 }],
      $identity: POSITIONAL_IDENTITY,
      "1": { $ops: [], $identity: POSITIONAL_IDENTITY, "0": 99 },
    };
    // After remove of index 1, result is [[1,2],[5,6]]. Nested key "1"
    // hits the SURVIVING row [5,6] → cell 0 becomes 99.
    const result = applyArrayOps(matrix, diff);
    expect(result).toEqual([
      [1, 2],
      [99, 6],
    ]);
  });
});

// ── 5. $assertCollection silenced in positional mode ─────────────────

describe(":index — $assertCollection silenced", () => {
  it("ignores $assertCollection: true on a positional array", () => {
    const matrix = [
      [1, 2],
      [3, 4],
    ];
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      $assertCollection: true, // would throw if honored — items are arrays
      "0": { $ops: [], $identity: POSITIONAL_IDENTITY, "0": 99 },
    };
    const result = applyArrayOps(matrix, diff);
    expect(result).toEqual([
      [99, 2],
      [3, 4],
    ]);
  });
});

// ── 6. Composition with smart-key objects in cells ───────────────────

describe(":index — composition with smart-key cells", () => {
  it("recurses into a {id, ...} object held in a cell", () => {
    const grid = [
      [{ id: "a", v: 1 }, { id: "b", v: 2 }],
      [{ id: "c", v: 3 }, { id: "d", v: 4 }],
    ];
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "1": {
        $ops: [],
        $identity: POSITIONAL_IDENTITY,
        "0": { v: 30 }, // plain-object update of the c-row, col-0 cell
      },
    };
    const result = applyArrayOps(grid, diff);
    expect(result).toEqual([
      [{ id: "a", v: 1 }, { id: "b", v: 2 }],
      [{ id: "c", v: 30 }, { id: "d", v: 4 }],
    ]);
  });
});

// ── 7. Default smart-key path — regression guard ─────────────────────

describe("smart-key default path — Map optimization regression guard", () => {
  it("applies nested updates over many items correctly", () => {
    const users = Array.from({ length: 50 }, (_, i) => ({
      id: `u${i}`,
      role: "user",
    }));
    const diff: OpsDiff = {
      $ops: [],
      u3: { role: "admin" },
      u17: { role: "admin" },
      u42: { role: "admin" },
    };
    const result = applyArrayOps(users, diff) as { id: string; role: string }[];
    expect(result[3]).toEqual({ id: "u3", role: "admin" });
    expect(result[17]).toEqual({ id: "u17", role: "admin" });
    expect(result[42]).toEqual({ id: "u42", role: "admin" });
    expect(result[0].role).toBe("user");
    expect(result.length).toBe(50);
  });

  it("smart-key remove + nested update on surviving items", () => {
    const users = [
      { id: "alice", role: "user" },
      { id: "bob", role: "user" },
      { id: "carol", role: "user" },
    ];
    const diff: OpsDiff = {
      $ops: [{ type: "remove", key: "bob" }],
      alice: { role: "admin" },
      carol: { role: "admin" },
    };
    const result = applyArrayOps(users, diff);
    expect(result).toEqual([
      { id: "alice", role: "admin" },
      { id: "carol", role: "admin" },
    ]);
  });

  it("strict mode unaffected — throws KEY_NOT_FOUND on missing nested key", () => {
    const users = [{ id: "alice", role: "user" }];
    const diff: OpsDiff = {
      $ops: [],
      ghost: { role: "admin" },
    };
    try {
      applyArrayOps(users, diff, { strict: true });
      throw new Error("expected throw");
    } catch (err) {
      expect(isStrictViolationError(err)).toBe(true);
      if (isStrictViolationError(err)) {
        expect(err.code).toBe("KEY_NOT_FOUND");
      }
    }
  });
});

// ── 8. Empty positional array ────────────────────────────────────────

describe(":index — empty array", () => {
  it("handles empty base with no-op diff", () => {
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
    };
    const result = applyArrayOps([], diff);
    expect(result).toEqual([]);
  });

  it("silently skips any sibling key on empty base in normal mode", () => {
    const diff: OpsDiff = {
      $ops: [],
      $identity: POSITIONAL_IDENTITY,
      "0": 99,
    };
    const result = applyArrayOps([], diff);
    expect(result).toEqual([]);
  });

  it("can grow an empty positional array via $ops add", () => {
    const diff: OpsDiff = {
      $ops: [{ type: "add", index: 0, item: [1, 2, 3] }],
      $identity: POSITIONAL_IDENTITY,
    };
    const result = applyArrayOps([], diff);
    expect(result).toEqual([[1, 2, 3]]);
  });
});
