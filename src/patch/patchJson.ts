const REMOVE_MARKER = "$__remove";

function resolveKey(item: any): string | undefined {
  if (!item || typeof item !== "object") return undefined;

  // Prioridade: key > id
  if (typeof item.key === "string") return item.key;
  if (item.id !== undefined && item.id !== null) return String(item.id);

  return undefined;
}

/**
 * Aplica operações de move.
 *
 * IMPORTANTE: Myers gera:
 * - remove.index = índice no array ORIGINAL
 * - move.to = índice no array FINAL
 *
 * Para aplicar corretamente, precisamos reconstruir o array passo a passo.
 *
 * @param arr Array atual (após removes puros)
 * @param moves Operações de move (podem ter keys)
 * @param base Array original (para resolver keys)
 * @param diff Diff completo (para patches em keys)
 */
function applyMovesWithIndexTracking(
  arr: any[],
  moves: any[],
  base: any[] = [],
  diff: any = {},
): any[] {
  if (moves.length === 0) return arr;

  // Import da função para gerar identidade (mesmo código de utils.ts)
  const escapeIdentity = (str: string): string => {
    if (str.startsWith("#") || str.startsWith("\\")) {
      return `\\${str}`;
    }
    return str;
  };

  const unescapeIdentity = (str: string): string => {
    if (str.startsWith("\\")) {
      return str.slice(1);
    }
    return str;
  };

  const getArrayItemIdentity = (item: any): string => {
    const key = resolveKey(item);
    if (key) return `#${key}`;

    if (typeof item === "object" && item !== null) {
      return JSON.stringify(item);
    }

    const str = String(item);
    return escapeIdentity(str);
  };

  // Converter moves para add+remove
  const operations: any[] = [];

  for (const move of moves) {
    // Resolver item (incluindo smart keys)
    let itemToAdd = move.item;

    const hasSmartKey =
      typeof move.item === "string" && move.item.startsWith("#");
    const key = hasSmartKey ? move.item.slice(1) : move.key;

    if (key) {
      // Smart key: buscar objeto no base array e aplicar patch
      const patch = diff[key] ?? {};
      const existing = base.find((i) => resolveKey(i) === key);
      itemToAdd = patchJson(existing || {}, patch);

      if (!("key" in itemToAdd) && !("id" in itemToAdd)) {
        itemToAdd.key = key;
      }
    } else if (typeof move.item === "string") {
      // Objeto sem smart key: move.item é uma string JSON.stringify
      //
      // OTIMIZAÇÃO: Em vez de fazer JSON.parse(), buscamos o objeto original
      // no array base usando a mesma identidade gerada por getArrayItemIdentity().
      //
      // Exemplo:
      //   move.item = "{\"value\":\"C\"}"
      //   Busca no base array o objeto que gera essa mesma identidade
      //   Retorna o objeto original { value: "C" } (sem parse!)
      //
      // Performance: ~10x mais rápido que JSON.parse()
      const existing = base.find((item) => {
        const identity = getArrayItemIdentity(item);
        return identity === move.item;
      });

      if (existing) {
        // ✅ Usa o objeto original (sem parse!)
        itemToAdd = existing;
      } else {
        // Fallback: se não encontrou, tenta parse ou unescape
        if (move.item.startsWith("{") || move.item.startsWith("[")) {
          // Objeto JSON stringified
          try {
            itemToAdd = JSON.parse(move.item);
          } catch (e) {
            // Se falhar parse, manter string (fallback seguro)
            itemToAdd = move.item;
          }
        } else if (move.item.startsWith("\\")) {
          // String escapada (ex: "\#a" → "#a")
          itemToAdd = unescapeIdentity(move.item);
        } else {
          // Primitivo (número, string simples)
          itemToAdd = move.item;
        }
      }
    }

    // Move = remove do original + add no final
    operations.push(
      { type: "remove", index: move.from, item: move.item },
      { type: "add", index: move.to, item: itemToAdd },
    );
  }

  // Aplicar usando a função correta do Myers
  return applyMyersDiff(arr, operations);
}

/**
 * Aplica diff do Myers corretamente.
 *
 * Estratégia: aplicar REMOVES primeiro (maior→menor), depois ADDS (menor→maior)
 */
function applyMyersDiff(arr: any[], operations: any[]): any[] {
  let result = [...arr];

  // Separar operações
  const removes = operations.filter((op) => op.type === "remove");
  const adds = operations.filter((op) => op.type === "add");

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

export function patchJson(base: any, diff: any): any {
  if (typeof diff !== "object" || diff === null) return diff;
  if (typeof base !== "object" || base === null)
    base = Array.isArray(diff) ? [] : {};

  let result = Array.isArray(base) ? [...base] : { ...base };

  if (Array.isArray(result) && "$__arrayOps" in diff) {
    const ops = [...diff.$__arrayOps];

    // Separa operações por tipo
    const removes = ops.filter((op) => op.type === "remove");
    const adds = ops.filter((op) => op.type === "add");
    const moves = ops.filter((op) => op.type === "move");

    let arr = [...result];

    // 1. Aplica removes (do maior índice para o menor)
    removes.sort((a, b) => b.index - a.index);
    const removedIndices: number[] = [];
    for (const op of removes) {
      if (op.key) {
        const idx = arr.findIndex((i) => resolveKey(i) === op.key);
        if (idx !== -1) {
          arr.splice(idx, 1);
          // Usar op.index que vem do diff original do Myers
          removedIndices.push(op.index);
        }
      } else {
        arr.splice(op.index, 1);
        removedIndices.push(op.index);
      }
    }

    // 2. Ajusta índices dos moves baseado nos removes
    const adjustedMoves = moves.map((move) => {
      // Conta quantos removes aconteceram antes de move.from
      const removesBeforeFrom = removedIndices.filter(
        (idx) => idx < move.from,
      ).length;
      // Conta quantos removes aconteceram antes de move.to
      const removesBeforeTo = removedIndices.filter(
        (idx) => idx < move.to,
      ).length;

      return {
        from: move.from - removesBeforeFrom,
        to: move.to - removesBeforeTo,
        item: move.item,
        key: move.key,
      };
    });

    // 3. Aplica moves com ajuste de índices
    arr = applyMovesWithIndexTracking(arr, adjustedMoves, base, diff);

    // 3. Aplica adds (do menor índice para o maior)
    adds.sort((a, b) => a.index - b.index);
    for (const op of adds) {
      if (op.key) {
        const patch = diff[op.key] ?? {};
        const existing = base.find((i) => resolveKey(i) === op.key);
        const merged = patchJson(existing || {}, patch);

        // Só adiciona key se o objeto não tem nem key nem id
        if (!("key" in merged) && !("id" in merged)) {
          merged.key = op.key;
        }

        arr.splice(op.index, 0, merged);
      } else {
        arr.splice(op.index, 0, op.item);
      }
    }

    // Aplica diffs por chave se ainda não aplicados
    for (const key in diff) {
      if (key === "$__arrayOps") continue;
      const idx = arr.findIndex((i) => resolveKey(i) === key);
      if (idx !== -1) {
        arr[idx] = patchJson(arr[idx], diff[key]);
      }
    }

    return arr;
  }

  for (const key in diff) {
    const value = diff[key];
    if (typeof value === "object" && value !== null && REMOVE_MARKER in value) {
      delete result[key];
    } else if (typeof value === "object" && value !== null) {
      result[key] = patchJson(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
