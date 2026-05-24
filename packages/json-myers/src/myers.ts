/**
 * Myers diff — O(ND) algorithm (Eugene Myers, 1986).
 *
 * Clean-room implementation of the same algorithm Git uses for file
 * diffs. Operates on two sequences A and B; returns the minimum edit
 * script (sequence of keep/del/ins) that transforms A into B.
 *
 * ## How the algorithm works
 *
 * The diff problem is mapped onto a 2D edit graph:
 *
 * ```
 *        0   1   2   ←  Y (sequence B)
 *      +───+───+───+
 *    0 │   │ b │ c │
 *      +───+───+───+
 *    1 │ a │   │   │       Horizontal (X → X+1): DELETE A[x]
 *      +───+───+───+       Vertical   (Y → Y+1): INSERT B[y]
 *    ↓ X (sequence A)      Diagonal (when A[x]===B[y]): KEEP (free)
 * ```
 *
 * Myers iterates over `D` (the edit distance) from 0 upward, and for
 * each `D` explores all diagonals `k = -D..D step 2` (k = x - y). For
 * each diagonal, it computes the *furthest reaching* x for that
 * (D, k). The first `D` for which (x, y) reaches (N, M) is the
 * shortest edit distance.
 *
 * The recurrence for `x` on diagonal `k` at iteration `D`:
 *
 *   x = v[k+1]      if k == -D or (k != D and v[k-1] < v[k+1])
 *       (we came from diagonal k+1 via a vertical step → INSERT)
 *
 *   x = v[k-1] + 1  otherwise
 *       (we came from diagonal k-1 via a horizontal step → DELETE)
 *
 * After computing x, we "follow the snake" — extend along the
 * diagonal as long as A[x] === B[y].
 *
 * The trace (snapshot of v at each D) is kept to backtrack and
 * reconstruct the actual edit script after the shortest path is found.
 *
 * ## Indexing
 *
 * Since k ranges over negative values, the `v` array is offset:
 * `v[k]` is stored at `v[k + MAX]` where `MAX = N + M`.
 */

// ── Types ─────────────────────────────────────────────────────────

/** A single edit operation in a diff script. */
export type Edit<T> =
  | { readonly type: "keep"; readonly item: T }
  | { readonly type: "del"; readonly item: T; readonly index: number }
  | { readonly type: "ins"; readonly item: T; readonly index: number };

/** Equality function for elements. */
export type EqFn<T> = (a: T, b: T) => boolean;

// ── Public API ────────────────────────────────────────────────────

/**
 * Compute the minimum edit script from `a` to `b` using Myers' O(ND)
 * algorithm.
 *
 * Returns a flat list of `keep`/`del`/`ins` operations in order. The
 * `index` field on `del` is the position in `a`; on `ins` it's the
 * position in `b` — together with the keep stream, the script can be
 * applied or rendered as a unified diff.
 *
 * @param a   Source sequence.
 * @param b   Target sequence.
 * @param eq  Equality function (defaults to `===`).
 */
export function myers<T>(
  a: readonly T[],
  b: readonly T[],
  eq: EqFn<T> = defaultEq,
): Edit<T>[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;

  // Edge case: both empty.
  if (max === 0) return [];

  // Edge case: A empty → all inserts.
  if (n === 0) {
    const out: Edit<T>[] = [];
    for (let j = 0; j < m; j++) {
      out.push({ type: "ins", item: b[j]!, index: j });
    }
    return out;
  }

  // Edge case: B empty → all deletes.
  if (m === 0) {
    const out: Edit<T>[] = [];
    for (let i = 0; i < n; i++) {
      out.push({ type: "del", item: a[i]!, index: i });
    }
    return out;
  }

  // ── Forward search ─────────────────────────────────────────────
  // v[k + max] = furthest x reached on diagonal k for current D.
  const v = new Array<number>(2 * max + 1).fill(0);
  const trace: number[][] = [];

  for (let d = 0; d <= max; d++) {
    // Snapshot v BEFORE this iteration's updates — needed for
    // backtracking to know which "previous diagonal" we came from.
    trace.push(v.slice());

    for (let k = -d; k <= d; k += 2) {
      const kIdx = k + max;
      let x: number;

      const cameFromInsert =
        k === -d || (k !== d && v[kIdx - 1]! < v[kIdx + 1]!);

      if (cameFromInsert) {
        x = v[kIdx + 1]!; // vertical move (insert)
      } else {
        x = v[kIdx - 1]! + 1; // horizontal move (delete)
      }

      let y = x - k;

      // Follow the snake — extend along the diagonal as long as equal.
      while (x < n && y < m && eq(a[x]!, b[y]!)) {
        x++;
        y++;
      }

      v[kIdx] = x;

      // Reached the bottom-right corner — shortest distance found.
      if (x >= n && y >= m) {
        return backtrack(trace, a, b, n, m, max);
      }
    }
  }

  // Unreachable — Myers is guaranteed to terminate by D <= N + M.
  /* c8 ignore next */
  return [];
}

// ── Backtracking ──────────────────────────────────────────────────

/**
 * Reconstruct the edit script by walking back through the trace from
 * (N, M) to (0, 0).
 *
 * At each step D, the trace tells us what v[k] was BEFORE the
 * iteration that updated diagonal k. So we can determine: did we come
 * from a horizontal step (delete) or vertical step (insert)?
 */
function backtrack<T>(
  trace: number[][],
  a: readonly T[],
  b: readonly T[],
  n: number,
  m: number,
  max: number,
): Edit<T>[] {
  const edits: Edit<T>[] = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d]!;
    const k = x - y;
    const kIdx = k + max;

    const cameFromInsert = k === -d || (k !== d && v[kIdx - 1]! < v[kIdx + 1]!);

    const prevK = cameFromInsert ? k + 1 : k - 1;
    const prevKIdx = prevK + max;
    const prevX = v[prevKIdx]!;
    const prevY = prevX - prevK;

    // Walk back along the snake (keeps) before this step's edit.
    while (x > prevX && y > prevY) {
      edits.unshift({ type: "keep", item: a[x - 1]! });
      x--;
      y--;
    }

    // At D=0 there's no previous edit — only the initial snake.
    if (d > 0) {
      if (x > prevX) {
        // Horizontal step from (prevX, prevY) — delete at (x-1) of A.
        edits.unshift({ type: "del", item: a[x - 1]!, index: x - 1 });
      } else {
        // Vertical step from (prevX, prevY) — insert at (y-1) of B.
        edits.unshift({ type: "ins", item: b[y - 1]!, index: y - 1 });
      }
      x = prevX;
      y = prevY;
    }
  }

  return edits;
}

// ── Helpers ───────────────────────────────────────────────────────

function defaultEq<T>(a: T, b: T): boolean {
  return (a as unknown) === (b as unknown);
}
