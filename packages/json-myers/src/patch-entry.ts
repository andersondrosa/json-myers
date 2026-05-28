/**
 * json-myers/patch
 *
 * Patch-only subset — for runtimes that only APPLY diffs (clients
 * receiving server-sent patches, launchers consuming
 * `mergeStrategy: "myers"`, ETL targets, etc).
 *
 * Bundle is ~37% the size of the full package (no diff generator, no
 * Myers algorithm, no fingerprint). Exposes everything the patch side
 * of the contract needs:
 *
 *   - `patchJson` + `applyArrayOps`
 *   - All error classes + type guards
 *   - All types relevant to consuming a diff
 *   - `DEFAULT_IDENTITY` constant
 *
 * For full diff generation, import from `json-myers`.
 */

export { patchJson } from "./patch.js";
export { applyArrayOps } from "./applyArrayOps.js";

export {
  OpsBaseNotArrayError,
  isOpsBaseNotArrayError,
  StrictViolationError,
  isStrictViolationError,
  CollectionAssertionError,
  isCollectionAssertionError,
  DEFAULT_IDENTITY,
  POSITIONAL_IDENTITY,
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
  StrictViolationCode,
  CollectionAssertionCode,
  Diff,
} from "./types.js";
