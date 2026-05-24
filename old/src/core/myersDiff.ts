import type { MyersOp } from "../types";

/** @deprecated Use `MyersOp` from the package root. */
export type DiffOp<T> = MyersOp<T>;

/**
 * Algoritmo de Myers O(N·D) — calcula o menor script de edição entre dois
 * arrays como uma sequência de `add` e `remove`.
 *
 * Convenção de índices:
 * - `remove.index` é a posição no array **original** (`a`)
 * - `add.index` é a posição no array **final** (`b`)
 *
 * @param a Array de origem.
 * @param b Array de destino.
 * @returns Lista de operações cruas (sem detecção de move).
 *
 * @example
 * myersDiff(["a","b","c"], ["b","c","a"]);
 * // [
 * //   { type: "remove", index: 0, item: "a" },
 * //   { type: "add",    index: 2, item: "a" }
 * // ]
 */
export function myersDiff<T>(a: T[], b: T[]): MyersOp<T>[] {
  const N = a.length,
    M = b.length;
  const max = N + M;
  const v: Record<number, number> = { 1: 0 };
  const trace: Record<number, number>[] = [];

  for (let d = 0; d <= max; d++) {
    const vPrev = { ...v };
    trace.push(vPrev);

    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
        x = v[k + 1];
      } else {
        x = v[k - 1] + 1;
      }
      let y = x - k;
      while (x < N && y < M && a[x] === b[y]) {
        x++;
        y++;
      }
      v[k] = x;
      if (x >= N && y >= M) {
        return backtrack(trace, a, b);
      }
    }
  }
  return [];
}

function backtrack<T>(
  trace: Record<number, number>[],
  a: T[],
  b: T[],
): MyersOp<T>[] {
  let x = a.length,
    y = b.length;
  const result: MyersOp<T>[] = [];

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;

    let prevK;
    if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v[prevK];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
    }

    if (d === 0) break;

    if (x === prevX) {
      // Add: índice é a posição no array de destino (b), não no array de origem (a)
      result.unshift({ type: "add", index: prevY, item: b[prevY] });
      y--;
    } else {
      result.unshift({ type: "remove", index: prevX, item: a[prevX] });
      x--;
    }
  }

  return result;
}

/**
 * Aplica uma lista de operações Myers a um array, retornando um novo array.
 *
 * Estratégia: removes do maior para o menor índice, depois adds do menor para
 * o maior — única ordem que respeita os referenciais (`remove` em índices do
 * original, `add` em índices do final).
 *
 * @param original Array de partida (não é mutado).
 * @param diff Operações a aplicar.
 * @returns Novo array com as operações aplicadas.
 */
export function applyMyersDiff<T>(original: T[], diff: MyersOp<T>[]): T[] {
  let result = [...original];

  // Separar operações
  const removes = diff.filter((op) => op.type === "remove");
  const adds = diff.filter((op) => op.type === "add");

  // 1. Aplicar removes do MAIOR índice para o MENOR (evita deslocamento)
  removes.sort((a, b) => b.index - a.index);
  for (const op of removes) {
    result.splice(op.index, 1);
  }

  // 2. Aplicar adds do MENOR índice para o MAIOR
  adds.sort((a, b) => a.index - b.index);
  for (const op of adds) {
    result.splice(op.index, 0, op.item);
  }

  return result;
}

/**
 * Reverte a aplicação de um diff Myers — dado o array `modified` e o diff
 * que o produziu, reconstrói o array original.
 *
 * @param modified Array depois das operações.
 * @param diff Operações que geraram `modified` a partir do original.
 * @returns Array original reconstruído.
 */
export function rollbackMyersDiff<T>(modified: T[], diff: MyersOp<T>[]): T[] {
  const result = [...modified];

  // Aplica o diff reverso corretamente:
  for (let i = diff.length - 1; i >= 0; i--) {
    const op = diff[i];
    if (op.type === "add") {
      // Remove o item adicionado originalmente (busca por valor para evitar erro)
      const idx = result.indexOf(op.item);
      if (idx !== -1) result.splice(idx, 1);
    } else if (op.type === "remove") {
      // Reinsere o item removido originalmente exatamente na posição original
      result.splice(op.index, 0, op.item);
    }
  }

  return result;
}
