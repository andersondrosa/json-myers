/**
 * `diffJson` — top-level diff dispatcher.
 *
 * Given two JSON values (`a` = old, `b` = new), produces a diff in the
 * v3 wire format that, when applied via `patchJson(a, diff)`, yields
 * `b` exactly.
 *
 * Dispatch by type pair:
 *
 *   (object,  object)  → `diffObject`  → `{ $remove?, ...keyDiffs }`
 *   (array,   array)   → `diffArray`   → `{ $ops, $identity?, $assertCollection?, ...nestedUpdates }`
 *   (any other pair)   → `b`           → R2 type-change replacement
 *   (a deep-equals b)  → no-op patch (`{}` or `{ $ops: [] }`)
 *
 * Internal sub-diffs use the `NO_CHANGE` sentinel to skip emitting
 * trivial entries (object recursion drops keys whose sub-diff is
 * no-op).
 */

import { diffArray } from "./diffArray.js";
import { diffObject } from "./diffObject.js";
import type { DiffOptions } from "./types.js";
import { DEFAULT_IDENTITY } from "./types.js";

/** Sentinel — internal only — signals "no diff needed at this position". */
export const NO_CHANGE: unique symbol = Symbol("json-myers/no-change");
export type NoChange = typeof NO_CHANGE;

// ── Public ─────────────────────────────────────────────────────────

/**
 * Compute a patch that, when applied to `a` via `patchJson`, yields
 * `b`. Pure — never mutates either argument.
 */
export function diffJson(
  a: unknown,
  b: unknown,
  options: DiffOptions = {},
): unknown {
  const identity = options.identity ?? DEFAULT_IDENTITY;
  const d = diffJsonInner(a, b, identity);
  if (d === NO_CHANGE) {
    // Same content — return a no-op patch that's compatible with the
    // base's shape (R8: array diff carries `$ops`; object diff does
    // not).
    if (Array.isArray(a)) return { $ops: [] };
    if (a !== null && typeof a === "object") return {};
    return b; // primitive — replace identity-wise (a === b anyway)
  }
  return d;
}

// ── Internal ───────────────────────────────────────────────────────

/**
 * Core diff function — returns `NO_CHANGE` when the two values are
 * structurally equal (a useful signal for parent recursors to skip
 * emitting the entry). `identity` is propagated through the recursion
 * as the single global value for this `diffJson` call.
 */
export function diffJsonInner(
  a: unknown,
  b: unknown,
  identity: string,
): unknown | NoChange {
  // Fast path: identical references or primitives compared by Object.is.
  if (Object.is(a, b)) return NO_CHANGE;

  // Type mismatch → R2 replacement.
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return b;

  if (a === null || b === null) {
    // Both null caught by Object.is; only one is null here → replace.
    return b;
  }

  const aIsObj = typeof a === "object";
  const bIsObj = typeof b === "object";
  if (aIsObj !== bIsObj) return b;

  if (aArr && bArr) {
    const d = diffArray(a as unknown[], b as unknown[], identity);
    return isTrivialArrayDiff(d) ? NO_CHANGE : d;
  }

  if (aIsObj && bIsObj) {
    const d = diffObject(
      a as Record<string, unknown>,
      b as Record<string, unknown>,
      identity,
    );
    return isTrivialObjectDiff(d) ? NO_CHANGE : d;
  }

  // Both primitives but Object.is says different → replace.
  return b;
}

/**
 * A diff entry is "trivial" when applying it leaves the base unchanged.
 * Used by parent recursors to decide whether to include the entry.
 */
export function isTrivialDiff(diff: unknown): boolean {
  if (diff === NO_CHANGE) return true;
  if (diff === null) return false;
  if (typeof diff !== "object") return false;
  if (Array.isArray(diff)) return false;
  const obj = diff as Record<string, unknown>;
  return isTrivialObjectDiff(obj) || isTrivialArrayDiff(obj);
}

function isTrivialObjectDiff(diff: Record<string, unknown>): boolean {
  if ("$ops" in diff) return false;
  return Object.keys(diff).length === 0;
}

function isTrivialArrayDiff(diff: Record<string, unknown>): boolean {
  if (!("$ops" in diff)) return false;
  const ops = diff.$ops;
  if (!Array.isArray(ops) || ops.length > 0) return false;
  // Empty $ops; any sibling key OTHER than markers means nested update
  // — not trivial. Markers ($identity, $assertCollection) alone don't
  // make a diff non-trivial.
  for (const k of Object.keys(diff)) {
    if (k === "$ops" || k === "$identity" || k === "$assertCollection") {
      continue;
    }
    return false;
  }
  return true;
}
