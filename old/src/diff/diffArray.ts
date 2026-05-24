import { myersDiff } from "../core/myersDiff";
import { myersDiffOptimization } from "../core/myersDiffOptimization";
import { ARRAY_OPS_KEY } from "../constants";
import { getArrayItemIdentity, getKey } from "./utils";
import { diffSmartKeys } from "./diffSmartKeys";
import { applyArrayOps } from "./applyArrayOps";

/**
 * Computa o diff entre dois arrays.
 *
 * Constrói uma projeção de identidade de cada item (smart key, `JSON.stringify`
 * ou primitivo escapado), roda o algoritmo de Myers sobre essas identidades,
 * detecta moves e traduz para o formato final do diff (`$__arrayOps` +
 * diffs aninhados por smart key).
 *
 * Usado internamente por `diffJson()` quando ambos os valores são arrays.
 *
 * @param original Array de partida.
 * @param modified Array de destino.
 * @returns Objeto com `$__arrayOps` e, quando aplicável, diffs aninhados.
 */
export function diffArray(original: any[], modified: any[]): any {
  const result: any = { [ARRAY_OPS_KEY]: [] };

  const getIdentityListWithValues = (arr: any[]): string[] => {
    const seenKeys = new Set<string>();
    const identities: string[] = [];

    arr.forEach((item, index) => {
      const key = getKey(item);
      if (key) {
        if (!seenKeys.has(key)) {
          seenKeys.add(key); // Só o primeiro item com a chave será tratado como chave válida
          identities.push(`#${key}`);
        } else {
          // Para chaves duplicadas, tratamos como valores serializados
          identities.push(JSON.stringify(item)); // Tratando como valor primitivo
        }
      } else {
        identities.push(getArrayItemIdentity(item));
      }
    });

    return identities;
  };

  const originalIds = getIdentityListWithValues(original);
  const modifiedIds = getIdentityListWithValues(modified);

  // Conta ocorrências em cada lado, separadamente.
  // Um item pode ser pareado em `move` apenas se sua identidade é única em
  // AMBOS os lados — caso contrário a pareação é ambígua (qual "}" se moveu?).
  // Arrays híbridos (objetos com id único + strings duplicadas) funcionam:
  // os objetos viram move, as strings duplicadas ficam como add/remove puros.
  const originalCount = new Map<string, number>();
  for (const id of originalIds) {
    originalCount.set(id, (originalCount.get(id) ?? 0) + 1);
  }
  const modifiedCount = new Map<string, number>();
  for (const id of modifiedIds) {
    modifiedCount.set(id, (modifiedCount.get(id) ?? 0) + 1);
  }
  const canMove = (item: string) =>
    originalCount.get(item) === 1 && modifiedCount.get(item) === 1;

  const rawOps = myersDiff(originalIds, modifiedIds);
  const ops = myersDiffOptimization(rawOps, canMove);

  // Prepare os arrayOps
  applyArrayOps(ops, original, modified, modifiedIds, result);

  // Verifica as chaves inteligentes
  diffSmartKeys(original, modified, result);

  // Remove duplicatas de chave no resultado
  for (const key of Object.keys(result)) {
    if (result[key]?.hasOwnProperty("key")) {
      const keyItem = result[key];
      if (keyItem?.key) {
        delete result[key]; // Remover duplicatas tratadas como objetos
      }
    }
  }

  return result;
}
