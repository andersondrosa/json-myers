/**
 * `patchJson` — apply a json-myers diff onto a base value.
 *
 * Implements the StateDelta merge-conformance rules R1–R6:
 *
 * - R1 — Plain arrays in a patch always REPLACE the base array.
 * - R2 — Type change (array↔object↔primitive) → patch replaces base.
 * - R3 — Structural recursion only in (object, object) pairs whose
 *   patch is NOT itself a `$ops` object.
 * - R4 — `$ops` triggers structural array operations (see
 *   `./applyArrayOps`). `move` is canonical; remove+add with the same
 *   smart-key is accepted as sugar.
 * - R5 — `$remove: [...keys]` deletes the listed keys from the merged
 *   object level. Processed BEFORE other entries.
 * - R6 — `$ops` over a base that is not an array → throw
 *   `OpsBaseNotArrayError` (independent of `strict`).
 *
 * `options.strict` (default `false`) — when `true`, raises
 * `StrictViolationError` on any divergence between the patch and the
 * base it's applied to (e.g. removing a non-existent key, smart-key
 * lookups that miss).
 */

import { applyArrayOps } from "./applyArrayOps.js";
import {
  OpsBaseNotArrayError,
  StrictViolationError,
  type OpsDiff,
  type PatchOptions,
} from "./types.js";

/** Check if a value is a non-null, non-array JSON object. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Check if a diff object carries the `$ops` marker. */
function hasOpsMarker(v: unknown): v is OpsDiff {
  return isPlainObject(v) && Array.isArray((v as Record<string, unknown>).$ops);
}

/**
 * Extract the `$remove` list from a diff object — array of string keys
 * to delete from the merged result. Returns `null` when absent or
 * malformed (non-array).
 */
function extractRemoveList(v: Record<string, unknown>): string[] | null {
  const raw = v.$remove;
  if (!Array.isArray(raw)) return null;
  return raw.filter((k): k is string => typeof k === "string");
}

/** Describe the JSON kind of a value, for error messages. */
function jsonKindOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "object") return "object";
  return typeof v;
}

/**
 * Apply a json-myers diff onto a base value. Pure — never mutates
 * either argument. Returns a new value.
 *
 * @throws {OpsBaseNotArrayError} when `$ops` is applied over a base
 *   that is not an array (R6 — both modes).
 * @throws {StrictViolationError} in strict mode, on any divergence
 *   between the patch and the base.
 */
export function patchJson(
  base: unknown,
  diff: unknown,
  options: PatchOptions = {},
): unknown {
  // ── Diff is primitive / null / array / non-object → replace
  // (R1 for arrays, full replace otherwise).
  if (diff === null) return null;
  if (typeof diff !== "object") return diff;
  if (Array.isArray(diff)) return diff;

  // ── Diff is `$ops` — structural array operation (R4 / R6).
  if (hasOpsMarker(diff)) {
    if (!Array.isArray(base)) {
      throw new OpsBaseNotArrayError(jsonKindOf(base));
    }
    return applyArrayOps(base, diff, options);
  }

  // ── Diff is a plain object (no `$ops`).
  //    If base is not also a plain object → R2 type change: rebuild
  //    fresh from diff. `$remove` is irrelevant here (nothing to
  //    remove from a freshly-built object).
  if (!isPlainObject(base)) {
    const fresh: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(diff)) {
      if (k === "$remove") continue;
      fresh[k] = patchJson(undefined, v, options);
    }
    return fresh;
  }

  // ── Both objects — key-by-key recursion (R3).
  //    `$remove` is processed FIRST (deletes listed keys), then the
  //    remaining entries merge normally.
  const diffObj = diff as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  const removeList = extractRemoveList(diffObj);
  if (removeList) {
    for (const k of removeList) {
      if (options.strict && !(k in out)) {
        throw new StrictViolationError(
          "OBJECT_KEY_NOT_FOUND",
          `$remove: cannot remove "${k}" — key not present in base object`,
          { key: k },
        );
      }
      delete out[k];
    }
  }
  for (const [k, v] of Object.entries(diffObj)) {
    if (k === "$remove") continue;
    out[k] = patchJson(out[k], v, options);
  }
  return out;
}
