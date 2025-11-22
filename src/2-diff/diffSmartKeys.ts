import { diffJson } from "./diffJson";
import { isNonEmptyDiff, getKey } from "./utils";

/**
 * Compara profundamente objetos com `key` ou `id` que existem em ambos os arrays.
 *
 * - Prioridade: key > id
 * - Apenas o primeiro item com cada key é considerado.
 * - Objetos duplicados com a mesma key são ignorados.
 * - Se houver diferença interna entre os objetos, o diff é salvo em `result[key]`.
 *
 * @param original - Array original
 * @param modified - Array modificado
 * @param result - Objeto onde o diff será acumulado
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
