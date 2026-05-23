import { ARRAY_OPS_KEY, REMOVE_MARKER, SMART_KEY_PREFIX } from "../constants";
import type { Diff } from "../types";
import {
  getArrayItemIdentity,
  getKey,
  unescapeIdentity,
} from "../diff/utils";

/**
 * Aplica um diff (gerado por `diffJson`) a um valor base, retornando um novo
 * valor. **Nunca muta `base`**.
 *
 * O genérico `T` preserva o tipo do consumidor: passar `User[]` retorna `User[]`.
 *
 * @param base   Valor original a ser modificado.
 * @param diff   Diff a aplicar.
 * @returns Novo valor com as mudanças aplicadas.
 *
 * @example
 * patchJson({ a: 1 }, { a: 2 });                              // { a: 2 }
 * patchJson({ a: 1, b: 2 }, { b: { $__remove: true } });      // { a: 1 }
 * patchJson([1, 2, 3], { $__arrayOps: [{ type:"add", index:3, item:4 }] }); // [1,2,3,4]
 */
export function patchJson<T = unknown>(base: T, diff: Diff): T;
export function patchJson(base: any, diff: any): any {
  // Primitivo (incluindo null) no patch → substitui base inteiramente
  if (typeof diff !== "object" || diff === null) return diff;

  // R1: Array no patch (sem $__arrayOps wrapper) substitui base inteiramente
  if (Array.isArray(diff)) return [...diff];

  // A partir daqui, diff é objeto não-array. Pode ser:
  // - { $__arrayOps: [...] }  → operações de array (R4), exige base array
  // - objeto plano             → merge recursivo (R3)

  if (ARRAY_OPS_KEY in diff) {
    // $__arrayOps é semanticamente uma operação sobre array. Se o base
    // não é array, é estado inconsistente — o gerador de diff jamais
    // produziria essa situação. Fail-fast.
    if (!Array.isArray(base)) {
      const baseKind =
        base === null ? "null" : base === undefined ? "undefined" : typeof base;
      throw new TypeError(
        `patchJson: $__arrayOps requires an array base, got ${baseKind}`,
      );
    }
  } else if (Array.isArray(base)) {
    // R2: base é array, patch é objeto plano sem $__arrayOps → patch wins
    base = {};
  } else if (typeof base !== "object" || base === null) {
    // R2: base é primitivo/null → patch wins (descarta base)
    base = {};
  }

  let result = Array.isArray(base) ? [...base] : { ...base };

  if (Array.isArray(result) && ARRAY_OPS_KEY in diff) {
    const ops = [...diff[ARRAY_OPS_KEY]];

    // Expande moves em (remove, add) pareados. Aplicar como Myers cru —
    // removes (maior → menor) seguido de adds (menor → maior) — é a única
    // ordem matematicamente correta, porque `remove.index` está no espaço
    // do array original e `add.index` no espaço do array final.
    //
    // Importante: adds reais carregam o VALOR REAL em `item`; adds vindos
    // de moves carregam a IDENTIDADE (string serializada ou "#key"). A flag
    // `_fromMove` distingue os dois — adds-de-move precisam resolver o valor
    // real via `base.find()`.
    const removes: any[] = [];
    const adds: any[] = [];
    for (const op of ops) {
      if (op.type === "remove") {
        removes.push(op);
      } else if (op.type === "add") {
        adds.push(op);
      } else if (op.type === "move") {
        removes.push({
          type: "remove",
          index: op.from,
          item: op.item,
          key: op.key,
          _fromMove: true,
        });
        adds.push({
          type: "add",
          index: op.to,
          item: op.item,
          key: op.key,
          _fromMove: true,
        });
      }
    }

    let arr = [...result];

    // 1. Aplica removes (do maior índice para o menor)
    removes.sort((a, b) => b.index - a.index);
    for (const op of removes) {
      if (op.key) {
        const idx = arr.findIndex((i) => getKey(i) === op.key);
        if (idx !== -1) arr.splice(idx, 1);
      } else if (
        typeof op.item === "string" &&
        op.item.startsWith(SMART_KEY_PREFIX)
      ) {
        // move expandido sem `key` mas com item `#key` — resolve por identidade
        const key = op.item.slice(1);
        const idx = arr.findIndex((i) => getKey(i) === key);
        if (idx !== -1) arr.splice(idx, 1);
      } else {
        arr.splice(op.index, 1);
      }
    }

    // 2. Aplica adds (do menor índice para o maior)
    adds.sort((a, b) => a.index - b.index);
    for (const op of adds) {
      let item = op.item;

      // Resolve smart key explícita (op.key) — válido tanto em add real
      // quanto em add expandido de move.
      if (op.key) {
        const patch = diff[op.key] ?? {};
        const existing = base.find((i: any) => getKey(i) === op.key);
        item = patchJson(existing || {}, patch);
        if (!("key" in item) && !("id" in item)) item.key = op.key;
      }
      // Add expandido de move: op.item é uma IDENTIDADE (string), precisa
      // ser resolvida para o valor real do `base`.
      else if (op._fromMove && typeof op.item === "string") {
        // Smart key implícita ("#key")
        if (op.item.startsWith(SMART_KEY_PREFIX)) {
          const key = op.item.slice(1);
          const patch = diff[key] ?? {};
          const existing = base.find((i: any) => getKey(i) === key);
          item = patchJson(existing || {}, patch);
          if (!("key" in item) && !("id" in item)) item.key = key;
        }
        // Outras identidades: busca no base pelo item cuja identidade gerada bate
        else {
          const existing = base.find(
            (i: any) => getArrayItemIdentity(i) === op.item,
          );
          if (existing !== undefined) {
            item = existing;
          }
          // String escapada (\#a → #a)
          else if (op.item.startsWith("\\")) {
            item = unescapeIdentity(op.item);
          }
          // Fallback: tenta parse de JSON serializado
          else if (op.item.startsWith("{") || op.item.startsWith("[")) {
            try {
              item = JSON.parse(op.item);
            } catch {
              // mantém op.item
            }
          }
        }
      }

      arr.splice(op.index, 0, item);
    }

    // 3. Aplica diffs por chave se ainda não aplicados
    for (const key in diff) {
      if (key === ARRAY_OPS_KEY) continue;
      const idx = arr.findIndex((i) => getKey(i) === key);
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
