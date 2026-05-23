// Tipos públicos
export type {
  Diff,
  ArrayDiff,
  ObjectDiff,
  ArrayOp,
  ArrayAddOp,
  ArrayRemoveOp,
  ArrayMoveOp,
  RemoveMarker,
  MyersOp,
  OptimizedMyersOp,
} from "./types";

// core: Algoritmo Myers base
export { myersDiff, applyMyersDiff, rollbackMyersDiff } from "./core/myersDiff";
export type { DiffOp } from "./core/myersDiff"; // deprecated alias
export {
  myersDiffOptimization,
  optimizedDiffToMyersRaw,
} from "./core/myersDiffOptimization";

// diff: Geração de diferenças
export { diffJson } from "./diff/diffJson";
export { diffArray } from "./diff/diffArray";
export { diffObject } from "./diff/diffObject";
export { diffSmartKeys } from "./diff/diffSmartKeys";
export { diffLines } from "./diff/diffLines";

// patch: Aplicação de patches
export { patchJson } from "./patch/patchJson";

// Aliases (backwards compatibility)
export { diffJson as diff } from "./diff/diffJson";
export { patchJson as patch } from "./patch/patchJson";

// Utils
export { convertJsonMyersToGitDiff } from "./utils/convertJsonMyersToGitDiff";
