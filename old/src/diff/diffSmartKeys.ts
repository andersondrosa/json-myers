import { diffJson } from "./diffJson";
import { isNonEmptyDiff, getKey } from "./utils";

/**
 * Computa diffs aninhados entre items que existem em ambos os arrays e
 * compartilham a mesma smart key (`key` ou `id`).
 *
 * Mutates `result`, acumulando cada diff não-vazio sob a chave correspondente.
 *
 * Regras:
 * - Prioridade `key` > `id` (via `getKey`)
 * - Apenas a primeira ocorrência de cada identidade é considerada
 * - Items sem identidade são ignorados (passam pelo Myers normal em `diffArray`)
 *
 * @param original Array de partida.
 * @param modified Array de destino.
 * @param result Objeto destino onde diffs aninhados são acumulados.
 */
export function diffSmartKeys(
  original: any[],
  modified: any[],
  result: any,
): void {
  const originalByKey = new Map<string, any>();
  const modifiedByKey = new Map<string, any>();

  for (const item of original) {
    const key = getKey(item);
    if (key && !originalByKey.has(key)) {
      originalByKey.set(key, item);
    }
  }

  for (const item of modified) {
    const key = getKey(item);
    if (key && !modifiedByKey.has(key)) {
      modifiedByKey.set(key, item);
    }
  }

  for (const key of originalByKey.keys()) {
    if (modifiedByKey.has(key)) {
      const origItem = originalByKey.get(key);
      const modItem = modifiedByKey.get(key);
      const nested = diffJson(origItem, modItem);
      if (isNonEmptyDiff(nested)) {
        result[key] = nested;
      }
    }
  }
}
