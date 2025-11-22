export type DiffOp<T> =
  | { type: "add"; index: number; item: T }
  | { type: "remove"; index: number; item: T };

export function myersDiff<T>(a: T[], b: T[]): DiffOp<T>[] {
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
): DiffOp<T>[] {
  let x = a.length,
    y = b.length;
  const result: DiffOp<T>[] = [];

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

// =============================================================================

export function applyMyersDiff<T>(original: T[], diff: DiffOp<T>[]): T[] {
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

// =============================================================================

export function rollbackMyersDiff<T>(modified: T[], diff: DiffOp<T>[]): T[] {
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
