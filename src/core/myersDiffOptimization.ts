// Tipos básicos
type MyersDiffOp<T> =
  | { type: "add"; index: number; item: T }
  | { type: "remove"; index: number; item: T };

type OptimizedDiffOp<T> =
  | MyersDiffOp<T>
  | { type: "move"; from: number; to: number; item: T };

/**
 * Gera operações "move" a partir do Myers diff bruto
 */
export function myersDiffOptimization<T>(
  diff: MyersDiffOp<T>[],
): OptimizedDiffOp<T>[] {
  const optimized: OptimizedDiffOp<T>[] = [];
  const removes = diff.filter((op) => op.type === "remove");
  const adds = diff.filter((op) => op.type === "add");
  const matchedRemoves = new Set<number>();
  const matchedAdds = new Set<number>();

  // Identificar pares remove+add que formam moves
  removes.forEach((remOp, remIdx) => {
    for (let addIdx = 0; addIdx < adds.length; addIdx++) {
      const addOp = adds[addIdx];
      if (!matchedAdds.has(addIdx) && remOp.item === addOp.item) {
        optimized.push({
          type: "move",
          from: remOp.index,
          to: addOp.index,
          item: remOp.item,
        });
        matchedRemoves.add(remIdx);
        matchedAdds.add(addIdx);
        break;
      }
    }
  });

  // Adicionar removes e adds não matchados
  removes.forEach((op, idx) => {
    if (!matchedRemoves.has(idx)) optimized.push(op);
  });

  adds.forEach((op, idx) => {
    if (!matchedAdds.has(idx)) optimized.push(op);
  });

  return optimized.sort((a, b) => {
    const idxA = "to" in a ? a.to : a.index;
    const idxB = "to" in b ? b.to : b.index;
    return idxA - idxB;
  });
}

/**
 * Reverte operações "move" de volta para Myers diff bruto (add/remove)
 */
export function optimizedDiffToMyersRaw<T>(
  optimizedDiff: OptimizedDiffOp<T>[],
): MyersDiffOp<T>[] {
  const raw: MyersDiffOp<T>[] = [];

  optimizedDiff.forEach((op) => {
    if (op.type === "move") {
      raw.push({ type: "remove", index: op.from, item: op.item });
      raw.push({ type: "add", index: op.to, item: op.item });
    } else {
      raw.push(op);
    }
  });

  // Ordenar por índice para garantir consistência
  return raw.sort((a, b) => a.index - b.index);
}
