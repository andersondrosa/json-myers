import type { MyersOp, OptimizedMyersOp } from "../types";

/**
 * Pareia ops de `remove` + `add` do mesmo item em uma única op `move`.
 *
 * @param diff Saída crua de `myersDiff()`.
 * @param canMove Predicate opcional que decide se um item pode ser pareado
 *   como `move`. Útil para evitar pareamento ambíguo em items duplicados
 *   (ex.: strings repetidas). Quando omitido, todos os pareamentos são feitos.
 * @returns Lista de ops com moves detectados, ordenada pelo índice de destino.
 */
export function myersDiffOptimization<T>(
  diff: MyersOp<T>[],
  canMove?: (item: T) => boolean,
): OptimizedMyersOp<T>[] {
  const optimized: OptimizedMyersOp<T>[] = [];
  const removes = diff.filter((op) => op.type === "remove");
  const adds = diff.filter((op) => op.type === "add");
  const matchedRemoves = new Set<number>();
  const matchedAdds = new Set<number>();

  removes.forEach((remOp, remIdx) => {
    if (canMove && !canMove(remOp.item)) return;
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
 * Inverso de `myersDiffOptimization()`: expande cada `move` de volta para
 * um par `remove + add`, restaurando o formato cru do Myers.
 */
export function optimizedDiffToMyersRaw<T>(
  optimizedDiff: OptimizedMyersOp<T>[],
): MyersOp<T>[] {
  const raw: MyersOp<T>[] = [];

  optimizedDiff.forEach((op) => {
    if (op.type === "move") {
      raw.push({ type: "remove", index: op.from, item: op.item });
      raw.push({ type: "add", index: op.to, item: op.item });
    } else {
      raw.push(op);
    }
  });

  return raw.sort((a, b) => a.index - b.index);
}
