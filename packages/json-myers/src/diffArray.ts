/**
 * `diffArray` — diff of two arrays using Myers' O(ND) algorithm over
 * fingerprints + smart-key identity preservation.
 *
 * ## Pipeline
 *
 *   1. Each item in A and B is converted to a string fingerprint via
 *      `fingerprintArray` — primitives, smart-keyed objects, and
 *      content-hashed structurals each get a distinct label. Smart-key
 *      duplicates within an array fall back to content hash on the
 *      second+ occurrence ("first wins").
 *   2. Myers runs on the `string[]` of fingerprints, producing a flat
 *      sequence of `keep`/`del`/`ins` operations.
 *   3. We walk the edit script in order, tracking the cursor in both
 *      A (for `remove` op indices) and B (for `add` op indices).
 *   4. `keep` on a smart-key fingerprint → check if the underlying
 *      object actually evolved (nested-update recursion via
 *      `diffJsonInner`). `keep` on a content-hash → no change.
 *   5. `add` on a smart-key fingerprint → seed the new item with the
 *      FULL source item (including identity field — preserves type).
 *
 * ## Wire markers emitted
 *
 *   - `$ops`             — always present (R8 — array-diff discriminator).
 *   - `$identity`        — only when `identity !== "id"` (the default).
 *   - `$assertCollection`— only when inference detects a homogeneous
 *                          collection (every item in A and B is a
 *                          non-null plain object with the identity
 *                          field, no duplicates).
 */

import { myers, type Edit } from "./myers.js";
import { fingerprintArray } from "./fingerprint.js";
import { diffJsonInner, isTrivialDiff, NO_CHANGE } from "./diffJson.js";
import type { Op } from "./types.js";
import { DEFAULT_IDENTITY } from "./types.js";

export function diffArray(
  a: readonly unknown[],
  b: readonly unknown[],
  identity: string = DEFAULT_IDENTITY,
  cache?: WeakMap<object, string>,
): Record<string, unknown> {
  // 1. Fingerprint each side, with smart-key duplicate detection.
  //    A per-call cache (when provided) lets us skip FNV-1a recursion
  //    for object references we've already fingerprinted in this call —
  //    huge win on immutable-state inputs where unchanged subtrees
  //    keep their original instances across `a` and `b`.
  const fpA = fingerprintArray(a, identity, cache);
  const fpB = fingerprintArray(b, identity, cache);

  // 2. Myers diff on fingerprints (strings — cheap `===` comparison).
  const edits: Edit<string>[] = myers(fpA, fpB);

  // 3 + 4 + 5. Walk the edit script — emit raw remove/add ops, then
  // coalesce (del fp, ins fp) pairs into move ops (O-001).
  //
  // The walk produces a list of `RawOp` records that retain the
  // fingerprint, so the coalesce pass can pair them up without
  // re-fingerprinting. Smart-key pairs become smart-key moves; any
  // other pair (primitive / content-hash) becomes a positional move.
  const raw: RawOp[] = [];
  const nested: Record<string, unknown> = {};

  let aIdx = 0; // cursor into a (advances on keep/del)
  let bIdx = 0; // cursor into b (advances on keep/ins)

  for (const e of edits) {
    if (e.type === "keep") {
      const fp = e.item;
      if (isSmartKeyFp(fp)) {
        // Smart-key match — identity preserved; check for content
        // changes via recursive diff.
        const aItem = a[aIdx];
        const bItem = b[bIdx];
        const sub = diffJsonInner(aItem, bItem, identity, cache);
        if (sub !== NO_CHANGE && !isTrivialDiff(sub)) {
          nested[fp.slice(1)] = sub;
        }
      }
      aIdx++;
      bIdx++;
    } else if (e.type === "del") {
      const fp = e.item;
      if (isSmartKeyFp(fp)) {
        raw.push({ kind: "del", fp, key: fp.slice(1), aIdx });
      } else {
        raw.push({ kind: "del", fp, aIdx });
      }
      aIdx++;
    } else {
      // ins
      const fp = e.item;
      const bItem = b[bIdx];
      if (isSmartKeyFp(fp)) {
        const key = fp.slice(1);
        raw.push({ kind: "ins", fp, key, bIdx, bItem });
      } else {
        raw.push({ kind: "ins", fp, bIdx, bItem });
      }
      bIdx++;
    }
  }

  // ── Coalesce phase — pair (del fp, ins fp) into move ops ────────────
  //
  // A `del` followed (anywhere later) by an `ins` with the same
  // fingerprint represents the same item changing position. We collapse
  // the pair into a single `move` op:
  //
  //   - Smart-key fingerprint → { type: "move", key, to: bIdx }
  //   - Other fingerprint     → { type: "move", from: aIdx, to: bIdx }
  //
  // Pairing is first-come-first-served per fingerprint, which is
  // deterministic and keeps the wire stable across runs.
  //
  // For smart-key moves, the nested entry carries the *delta* between
  // the A-side and B-side items (via diffJsonInner) rather than the
  // full B-side item — drastically smaller wire when the item only
  // moved without other changes (NO_CHANGE → omit entirely).
  const ops: Op[] = coalesceMoves(raw, nested, a, identity, cache);

  // 6. Emit the result with markers — $identity only when non-default,
  //    $assertCollection only when inferred.
  const result: Record<string, unknown> = { $ops: ops };
  if (identity !== DEFAULT_IDENTITY) {
    result.$identity = identity;
  }
  if (inferAssertCollection(a, b, identity)) {
    result.$assertCollection = true;
  }
  Object.assign(result, nested);
  return result;
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Intermediate op record used by the coalesce phase. Keeps the
 * fingerprint and (for `ins`) the source item, so we can either emit a
 * standalone op or pair it up into a move without re-walking the
 * inputs.
 */
type RawOp =
  | { kind: "del"; fp: string; aIdx: number; key?: string }
  | { kind: "ins"; fp: string; bIdx: number; bItem: unknown; key?: string };

/**
 * Pair (del fp, ins fp) records into `move` ops; emit unpaired ones as
 * regular `remove`/`add`. Side-effect: writes seeds into `nested` for
 * smart-key adds and for smart-key moves that need a body recurse.
 *
 * Pairing rule: first-come-first-served per fingerprint string. The
 * resulting op order follows the original edit-script order — ops are
 * placed at the position of the *first* member of the pair (the del),
 * with the ins position dropped. This keeps the wire stable and matches
 * how the patcher reorders internally anyway (removes desc, adds asc).
 */
function coalesceMoves(
  raw: readonly RawOp[],
  nested: Record<string, unknown>,
  a: readonly unknown[],
  identity: string,
  cache?: WeakMap<object, string>,
): Op[] {
  // ── Pass 1 — Bucket del and ins indices by fingerprint ─────────────
  // Smart-key fingerprint includes the key, so smart-key dels and ins
  // for the same key pair up uniquely. Content-hash fingerprints can
  // appear multiple times for identical-looking items; we pair them
  // FIFO in raw-order, which keeps the wire deterministic.
  const delByFp = new Map<string, number[]>();
  const insByFp = new Map<string, number[]>();
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const map = r.kind === "del" ? delByFp : insByFp;
    const q = map.get(r.fp);
    if (q) q.push(i);
    else map.set(r.fp, [i]);
  }

  // ── Pass 2 — Resolve pairs (raw-index → partner raw-index) ─────────
  // Both halves of a pair get a mutual link so the emission pass can
  // detect the pair from whichever side it encounters first.
  //
  // NOTE: Coalescing is restricted to SMART-KEY fingerprints only
  // (fingerprint starts with `#`). Positional `move` ops resolve
  // `from`/`to` against the patcher's current `result` state, which
  // mutates as moves are applied — emitting multiple positional moves
  // with A-original indices would corrupt the resulting array.
  // Smart-key moves identify items by key, so they're robust to
  // intermediate reordering and pair safely. Primitive/content-hash
  // pairs stay as remove+add (semantically equivalent, slightly
  // verbose). A future enhancement could compute positional move
  // indices against a simulated patcher state.
  const partner = new Map<number, number>();
  for (const [fp, delIdxs] of delByFp) {
    if (!isSmartKeyFp(fp)) continue;
    const insIdxs = insByFp.get(fp);
    if (!insIdxs) continue;
    const n = Math.min(delIdxs.length, insIdxs.length);
    for (let k = 0; k < n; k++) {
      partner.set(delIdxs[k], insIdxs[k]);
      partner.set(insIdxs[k], delIdxs[k]);
    }
  }

  // ── Pass 3 — Emit ops in raw order, materializing each pair at the
  //           position of its FIRST member (preserves edit-script
  //           ordering and keeps the wire stable). ───────────────────
  const handled = new Set<number>();
  const ops: Op[] = [];

  for (let i = 0; i < raw.length; i++) {
    if (handled.has(i)) continue;
    const r = raw[i];
    const pIdx = partner.get(i);

    if (pIdx !== undefined) {
      handled.add(i);
      handled.add(pIdx);
      const del = (r.kind === "del" ? r : raw[pIdx]) as Extract<
        RawOp,
        { kind: "del" }
      >;
      const ins = (r.kind === "ins" ? r : raw[pIdx]) as Extract<
        RawOp,
        { kind: "ins" }
      >;
      if (del.key !== undefined) {
        // Smart-key move — fingerprint includes the key so both halves
        // share it. The B-side item may have evolved; compute the
        // *delta* between the A-side cached item and the B-side
        // destination via diffJsonInner, and place it in nested[key].
        // The patcher recycles the cached item from its removedByKey
        // map and applies the nested delta — same final state as
        // emitting the full B-side seed, but with O(diff) wire size
        // instead of O(item) when only a few fields changed (typical
        // reorder case: NO_CHANGE → omit nested entirely).
        ops.push({ type: "move", key: del.key, to: ins.bIdx });
        const sub = diffJsonInner(a[del.aIdx], ins.bItem, identity, cache);
        if (sub !== NO_CHANGE && !isTrivialDiff(sub)) {
          nested[del.key] = sub;
        }
      } else {
        ops.push({ type: "move", from: del.aIdx, to: ins.bIdx });
      }
      continue;
    }

    // Unpaired — emit standalone op.
    if (r.kind === "del") {
      if (r.key !== undefined) {
        ops.push({ type: "remove", key: r.key });
      } else {
        ops.push({ type: "remove", index: r.aIdx });
      }
    } else {
      if (r.key !== undefined) {
        ops.push({ type: "add", key: r.key, index: r.bIdx });
        const seed = extractSeed(r.bItem);
        if (seed !== undefined) {
          nested[r.key] = seed;
        }
      } else {
        ops.push({ type: "add", index: r.bIdx, item: r.bItem });
      }
    }
  }

  return ops;
}

function isSmartKeyFp(fp: string): boolean {
  return fp.length > 0 && fp.charCodeAt(0) === 0x23; // '#'
}

/**
 * Build the seed for a smart-key `add` op. Returns the full item as a
 * shallow copy (no fields filtered) — the identity field is included
 * to preserve its original type. `buildFromSeed` at patch time spreads
 * this over `{ [identity]: smartKey }`; the seed's identity value
 * overrides the string-converted smart-key.
 *
 * Returns `undefined` when the item isn't a plain object (no
 * meaningful payload to put in a sibling).
 */
function extractSeed(item: unknown): unknown {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    return undefined;
  }
  const obj = item as Record<string, unknown>;
  if (Object.keys(obj).length === 0) return undefined;
  return { ...obj };
}

/**
 * Determine whether (a, b) form a homogeneous collection — every item
 * is a non-null plain object with a string/number value at the
 * identity field, and no duplicates.
 */
function inferAssertCollection(
  a: readonly unknown[],
  b: readonly unknown[],
  identity: string,
): boolean {
  if (!isCollectionShape(a, identity)) return false;
  if (!isCollectionShape(b, identity)) return false;
  return true;
}

function isCollectionShape(arr: readonly unknown[], identity: string): boolean {
  if (arr.length === 0) return false; // empty arrays don't carry the assertion
  const seen = new Set<string>();
  for (const item of arr) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }
    const id = (item as Record<string, unknown>)[identity];
    if (typeof id !== "string" && typeof id !== "number") return false;
    const k = String(id);
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}
