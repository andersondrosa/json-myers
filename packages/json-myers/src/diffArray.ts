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
): Record<string, unknown> {
  // 1. Fingerprint each side, with smart-key duplicate detection.
  const fpA = fingerprintArray(a, identity);
  const fpB = fingerprintArray(b, identity);

  // 2. Myers diff on fingerprints (strings — cheap `===` comparison).
  const edits: Edit<string>[] = myers(fpA, fpB);

  // 3 + 4 + 5. Walk the edit script.
  const ops: Op[] = [];
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
        const sub = diffJsonInner(aItem, bItem, identity);
        if (sub !== NO_CHANGE && !isTrivialDiff(sub)) {
          nested[fp.slice(1)] = sub;
        }
      }
      aIdx++;
      bIdx++;
    } else if (e.type === "del") {
      const fp = e.item;
      if (isSmartKeyFp(fp)) {
        ops.push({ type: "remove", key: fp.slice(1) });
      } else {
        ops.push({ type: "remove", index: aIdx });
      }
      aIdx++;
    } else {
      // ins
      const fp = e.item;
      const bItem = b[bIdx];
      if (isSmartKeyFp(fp)) {
        const key = fp.slice(1);
        ops.push({ type: "add", key, index: bIdx });
        // Seed includes the FULL item (R-Gap-C fix). The identity
        // field is preserved with its original type (number, string,
        // etc) — `buildFromSeed` spreads the seed, so the seed wins.
        const seed = extractSeed(bItem);
        if (seed !== undefined) {
          nested[key] = seed;
        }
      } else {
        ops.push({ type: "add", index: bIdx, item: bItem });
      }
      bIdx++;
    }
  }

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

function isCollectionShape(
  arr: readonly unknown[],
  identity: string,
): boolean {
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
