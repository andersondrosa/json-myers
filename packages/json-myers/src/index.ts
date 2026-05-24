/**
 * json-myers
 *
 * Clean-room implementation of the json-myers diff/patch contract,
 * built against the StateDelta conformance suite (R1–R6, v2 spec).
 *
 * Phase 1 — `patchJson` only. The `diffJson` generator follows in a
 * later phase.
 *
 * Wire markers (v2):
 *   - `$ops`     — structural array-operations marker
 *   - `$remove`  — bulk key-removal marker (list of keys to drop from
 *                  the merged object level where it appears)
 *
 * Errors:
 *   - `OpsBaseNotArrayError` (code: `OPS_BASE_NOT_ARRAY`) — `$ops` over
 *     a non-array base.
 */

export { patchJson } from "./patch.js";
export { applyArrayOps } from "./applyArrayOps.js";
export { myers } from "./myers.js";
export type { Edit, EqFn } from "./myers.js";
export {
  fingerprintItem,
  fingerprintArray,
  hashValue,
  hashToHex,
} from "./fingerprint.js";
export { diffJson } from "./diffJson.js";
export { diffArray } from "./diffArray.js";
export { diffObject } from "./diffObject.js";

export {
  OpsBaseNotArrayError,
  isOpsBaseNotArrayError,
  StrictViolationError,
  isStrictViolationError,
  CollectionAssertionError,
  isCollectionAssertionError,
  DEFAULT_IDENTITY,
} from "./types.js";

export type {
  Op,
  AddOp,
  AddOpPositional,
  AddOpSmartKey,
  RemoveOp,
  RemoveOpPositional,
  RemoveOpSmartKey,
  MoveOp,
  MoveOpPositional,
  MoveOpSmartKey,
  OpsDiff,
  RemoveListMarker,
  PatchOptions,
  DiffOptions,
  StrictViolationCode,
  CollectionAssertionCode,
  Diff,
} from "./types.js";
