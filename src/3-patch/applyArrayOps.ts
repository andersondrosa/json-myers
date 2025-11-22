import { diffJson } from "../2-diff/diffJson";
import { isNonEmptyDiff, getKey } from "../2-diff/utils";

export function applyArrayOps(
  ops: any[],
  original: any[],
  modified: any[],
  modifiedIds: string[],
  result: any,
): void {
  const resultOps = result.$__arrayOps;

  // 🔍 Conta as keys no original e no modified separadamente
  const countKeys = (arr: any[]) => {
    const map = new Map<string, number>();
    for (const item of arr) {
      const key = getKey(item);
      if (key) map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  };

  const originalKeyCount = countKeys(original);
  const modifiedKeyCount = countKeys(modified);

  for (const op of ops) {
    if (op.type === "move") {
      // Operação de movimentação otimizada
      const item = op.item.startsWith("#") ? op.item.slice(1) : op.item;

      resultOps.push({
        type: "move",
        from: op.from,
        to: op.to,
        item: op.item,
      });
      continue;
    }

    if (op.type === "remove") {
      const item = original[op.index];
      const key = getKey(item);

      if (key && originalKeyCount.get(key) === 1) {
        resultOps.push({ type: "remove", index: op.index, key });
      } else {
        resultOps.push({ type: "remove", index: op.index, item });
      }
    }

    if (op.type === "add") {
      const idx = modifiedIds.indexOf(op.item);
      const item = modified[idx];
      const key = getKey(item);

      if (key && modifiedKeyCount.get(key) === 1) {
        resultOps.push({ type: "add", index: idx, key });

        const originalItem = original.find((o) => getKey(o) === key);
        const { key: _, ...rest } = item;
        const nested = diffJson(originalItem ?? {}, rest);
        if (isNonEmptyDiff(nested)) {
          result[key] = nested;
        }
      } else {
        resultOps.push({ type: "add", index: idx, item });
      }
    }
  }
}
