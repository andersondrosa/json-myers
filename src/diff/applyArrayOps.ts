import { ARRAY_OPS_KEY } from "../constants";
import { diffJson } from "./diffJson";
import { isNonEmptyDiff, getKey } from "./utils";

export function applyArrayOps(
  ops: any[],
  original: any[],
  modified: any[],
  modifiedIds: string[],
  result: any,
): void {
  const resultOps = result[ARRAY_OPS_KEY];

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
      // op.index é a posição correta no array `modified` (vem direto do Myers).
      // Não usar modifiedIds.indexOf(op.item) — em arrays com itens duplicados
      // (ex. linhas de código com "}" ou "" repetidas), indexOf retornaria
      // sempre a primeira ocorrência, deslocando o índice gerado.
      const idx = op.index;
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
