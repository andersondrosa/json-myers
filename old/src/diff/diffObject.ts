import { REMOVE_MARKER } from "../constants";
import { diffJson } from "./diffJson";
import { isNonEmptyDiff } from "./utils";

/**
 * Computa o diff entre dois objetos chave-a-chave.
 *
 * - Chave presente apenas em `original` → marcada com `{ $__remove: true }`
 * - Chave presente apenas em `modified` → atribui valor diretamente
 * - Chave em ambos → `diffJson` recursivo, mantido apenas se não vazio
 *
 * @param original Objeto de partida.
 * @param modified Objeto de destino.
 * @returns Objeto contendo apenas as chaves que mudaram.
 */
export function diffObject(original: any, modified: any): any {
  const diff: any = {};
  const keys = new Set([...Object.keys(original), ...Object.keys(modified)]);

  for (const key of keys) {
    if (!(key in modified)) {
      diff[key] = { [REMOVE_MARKER]: true };
    } else if (!(key in original)) {
      diff[key] = modified[key];
    } else {
      const nested = diffJson(original[key], modified[key]);
      if (nested === null || isNonEmptyDiff(nested)) {
        diff[key] = nested;
      }
    }
  }

  return diff;
}
