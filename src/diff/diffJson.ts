import type { Diff } from "../types";
import { isPrimitiveDiff, primitiveDiff } from "./primitives";
import { diffArray } from "./diffArray";
import { diffObject } from "./diffObject";

/**
 * Computa o diff mínimo entre dois valores JSON de qualquer profundidade.
 *
 * - Primitivos iguais → `{}`
 * - Primitivos diferentes (ou mudança de tipo) → retorna `modified` integral
 * - Arrays vs arrays → Myers + detecção de moves + smart keys
 * - Objetos vs objetos → diff chave-a-chave recursivo
 * - Tipos divergentes (object↔array) → retorna `modified` integral (R2)
 *
 * O diff é **JSON puro** e pode ser serializado livremente.
 *
 * @param original Valor de partida.
 * @param modified Valor de destino.
 * @returns Diff aplicável via `patchJson()`, ou `{}` se não houver mudanças.
 *
 * @example
 * diffJson({ a: 1 }, { a: 2 });           // { a: 2 }
 * diffJson([1, 2, 3], [1, 3, 4]);          // { $__arrayOps: [...] }
 * diffJson({ a: 1 }, {});                  // { a: { $__remove: true } }
 * diffJson({ a: 1 }, [9]);                 // [9]  (R2: tipo mudou)
 */
export function diffJson(original: unknown, modified: unknown): Diff {
  if (isPrimitiveDiff(original, modified)) {
    return primitiveDiff(original, modified);
  }

  const origIsArray = Array.isArray(original);
  const modIsArray = Array.isArray(modified);

  // R2: tipos divergentes (object vs array) → modified substitui original
  if (origIsArray !== modIsArray) {
    return modified as Diff;
  }

  if (origIsArray && modIsArray) {
    return diffArray(original as any[], modified as any[]);
  }

  return diffObject(original, modified);
}
