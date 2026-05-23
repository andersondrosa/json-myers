import { myersDiff } from "../core/myersDiff";
import { ARRAY_OPS_KEY } from "../constants";

/**
 * Diff de arrays sem identidade — tipicamente linhas de código ou strings.
 *
 * Funciona como `git diff` em texto: produz apenas `add` e `remove`. Não há
 * detecção de move, porque items duplicados (várias linhas vazias, vários `}`)
 * não têm identidade que permita rastrear "qual" se moveu.
 *
 * Para arrays de objetos com `id`/`key` (identidade explícita), use `diffJson`
 * ou `diffArray` — eles ativam a otimização de moves.
 *
 * @param original Array de partida.
 * @param modified Array de destino.
 * @returns Objeto com `$__arrayOps` contendo apenas `add` e `remove`.
 *
 * @example
 * diffLines(["a","b","c"], ["a","x","c"]);
 * // {
 * //   $__arrayOps: [
 * //     { type: "remove", index: 1, item: "b" },
 * //     { type: "add",    index: 1, item: "x" }
 * //   ]
 * // }
 */
export function diffLines<T>(original: T[], modified: T[]): any {
  const ops = myersDiff(original, modified);
  return { [ARRAY_OPS_KEY]: ops };
}
