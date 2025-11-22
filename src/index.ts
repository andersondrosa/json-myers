// 1-CORE: Algoritmo Myers base
export { myersDiff } from "./1-core/myersDiff";
export { myersDiffOptimization } from "./1-core/myersDiffOptimization";

// 2-DIFF: Geração de diferenças
export { diffJson } from "./2-diff/diffJson";
export { diffArray } from "./2-diff/diffArray";
export { diffObject } from "./2-diff/diffObject";

// 3-PATCH: Aplicação de patches
export { patchJson } from "./3-patch/patchJson";

// Aliases (backwards compatibility)
export { diffJson as diff } from "./2-diff/diffJson";
export { patchJson as patch } from "./3-patch/patchJson";
