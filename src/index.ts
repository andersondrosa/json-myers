
// core: Algoritmo Myers base
export { myersDiff, applyMyersDiff, rollbackMyersDiff } from "./core/myersDiff";
export {
  myersDiffOptimization,
  optimizedDiffToMyersRaw,
} from "./core/myersDiffOptimization";

// diff: Geração de diferenças
export { diffJson } from "./diff/diffJson";
export { diffArray } from "./diff/diffArray";
export { diffObject } from "./diff/diffObject";
export { diffSmartKeys } from "./diff/diffSmartKeys";

// patch: Aplicação de patches
export { patchJson } from "./patch/patchJson";
export { applyArrayOps } from "./patch/applyArrayOps";

// Aliases (backwards compatibility)
export { diffJson as diff } from "./diff/diffJson";
export { patchJson as patch } from "./patch/patchJson";

// Utils
export { convertJsonMyersToGitDiff } from "./utils/convertJsonMyersToGitDiff";

