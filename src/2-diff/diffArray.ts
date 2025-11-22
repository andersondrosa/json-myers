import { myersDiff } from "../1-core/myersDiff";
import { myersDiffOptimization } from "../1-core/myersDiffOptimization";
import { getArrayItemIdentity, getKey } from "./utils";
import { diffSmartKeys } from "./diffSmartKeys";
import { applyArrayOps } from "../3-patch/applyArrayOps";

export function diffArray(original: any[], modified: any[]): any {
  const result: any = { $__arrayOps: [] };

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

  const rawOps = myersDiff(originalIds, modifiedIds);
  const ops = myersDiffOptimization(rawOps);

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
