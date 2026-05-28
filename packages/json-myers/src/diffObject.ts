/**
 * `diffObject` — diff of two plain JSON objects.
 *
 * Output shape (v3):
 *
 * ```ts
 * {
 *   "$remove": ["k1", "k2"]?,   // keys present in `a` but not `b`
 *   "keyA": <subDiff>?,         // recursive diff for keys in both
 *   "keyB": <newValue>?,        // values for keys added in `b`
 * }
 * ```
 *
 * Keys whose sub-diff is trivial (NO_CHANGE) are omitted — the output
 * carries ONLY the entries needed to transform `a` into `b`. The
 * `identity` argument is propagated to nested `diffArray` calls
 * (single global value for the whole `diffJson` call in v3.x).
 */

import { diffJsonInner, NO_CHANGE } from "./diffJson.js";

export function diffObject(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  identity: string,
  cache?: WeakMap<object, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const removed: string[] = [];

  // Keys in `a` missing from `b` → marked for removal.
  for (const k of Object.keys(a)) {
    if (!(k in b)) {
      removed.push(k);
    }
  }

  // Keys in `b` — either added (new) or both-have-it (recurse).
  for (const k of Object.keys(b)) {
    if (!(k in a)) {
      // Added — include `b[k]` directly. `patchJson` rebuilds it via
      // R2 (base at this key is `undefined` ↦ patch wins).
      out[k] = b[k];
      continue;
    }
    const sub = diffJsonInner(a[k], b[k], identity, cache);
    if (sub !== NO_CHANGE) {
      out[k] = sub;
    }
  }

  if (removed.length > 0) {
    out.$remove = removed;
  }

  return out;
}
