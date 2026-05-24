/**
 * Constantes textuais usadas nos marcadores do formato de diff.
 * Re-exportadas para conveniência — também disponíveis em `src/constants.ts`.
 */

/**
 * Marcador colocado no valor de uma chave para indicar que a propriedade
 * deve ser removida durante o patch.
 *
 * @example
 * { name: { $__remove: true } } // remove a propriedade `name`
 */
export type RemoveMarker = { $__remove: true };

/**
 * Operação de adição num array.
 *
 * - `item` é usado quando o valor é literal (primitivo ou objeto sem identidade)
 * - `key` é usado quando o item tem smart key — o objeto a adicionar é
 *   reconstruído a partir de `diff[key]` aplicado a um base vazio (ou existente)
 */
export type ArrayAddOp<T = unknown> =
  | { type: "add"; index: number; item: T }
  | { type: "add"; index: number; key: string };

/**
 * Operação de remoção num array.
 *
 * - `item` é usado quando o valor original era literal
 * - `key` é usado quando o item original tinha smart key
 *
 * O `index` é a posição no array **original** (antes da aplicação).
 */
export type ArrayRemoveOp<T = unknown> =
  | { type: "remove"; index: number; item: T }
  | { type: "remove"; index: number; key: string };

/**
 * Operação de movimentação num array — fusão de `remove + add` do mesmo item.
 *
 * - `from`: posição no array original
 * - `to`: posição no array final
 * - `item`: identidade do item movido (string `#key` quando há smart key,
 *   ou JSON.stringify do objeto, ou primitivo escapado)
 * - `key`: presente em moves de smart key (alternativo a `item`)
 */
export type ArrayMoveOp<T = unknown> =
  | { type: "move"; from: number; to: number; item: T | string }
  | { type: "move"; from: number; to: number; key: string };

/**
 * Qualquer operação válida dentro de `$__arrayOps`.
 */
export type ArrayOp<T = unknown> =
  | ArrayAddOp<T>
  | ArrayRemoveOp<T>
  | ArrayMoveOp<T>;

/**
 * Diff de um array. Sempre contém `$__arrayOps`; pode conter chaves adicionais
 * (smart keys) com diffs aninhados de items identificados.
 */
export interface ArrayDiff {
  $__arrayOps: ArrayOp[];
  [smartKey: string]: ArrayOp[] | Diff;
}

/**
 * Diff de um objeto. Cada chave mapeia para um `Diff` recursivo ou para
 * `{ $__remove: true }` indicando remoção.
 */
export interface ObjectDiff {
  [key: string]: Diff | RemoveMarker;
}

/**
 * Resultado de `diffJson()`. Estrutura JSON pura que representa as mudanças
 * entre dois valores.
 *
 * - `{}` ou `null` quando não há mudanças
 * - Primitivo quando o valor primitivo mudou (ou o tipo mudou completamente)
 * - `ArrayDiff` para arrays
 * - `ObjectDiff` para objetos
 */
export type Diff =
  | string
  | number
  | boolean
  | null
  | unknown[]
  | ArrayDiff
  | ObjectDiff;

/**
 * Operação crua produzida por `myersDiff()` — apenas add/remove, sem
 * detecção de move.
 */
export type MyersOp<T = unknown> =
  | { type: "add"; index: number; item: T }
  | { type: "remove"; index: number; item: T };

/**
 * Operação otimizada produzida por `myersDiffOptimization()` — pode ser
 * um add/remove cru ou um move pareado.
 */
export type OptimizedMyersOp<T = unknown> =
  | MyersOp<T>
  | { type: "move"; from: number; to: number; item: T };
