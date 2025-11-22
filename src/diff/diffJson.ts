import { isPrimitiveDiff, primitiveDiff } from "./primitives";
import { diffArray } from "./diffArray";
import { diffObject } from "./diffObject";

/**
 * Cria um diff entre dois valores JSON (qualquer profundidade).
 *
 * Regras:
 * - Se ambos forem primitivos: retorna `{}` se forem iguais, ou `modified` se forem diferentes.
 * - Se forem arrays: aplica algoritmo de Myers para detectar mudanças de posição/adicionais/removidos.
 * - Se forem objetos: compara chave a chave e gera subdiffs.
 *
 * Retorna um JSON contendo apenas as diferenças necessárias para transformar `original` em `modified`.
 *
 * @param original Valor original (objeto, array ou primitivo)
 * @param modified Valor modificado
 * @returns Diff aplicável ou `{}` se idêntico
 */
export function diffJson(original: any, modified: any): any {
  // Caso primitivo ou nulo: compara diretamente
  if (isPrimitiveDiff(original, modified)) {
    return primitiveDiff(original, modified);
  }

  // Caso arrays: aplica myersDiff + lógica especial de objetos com chave
  if (Array.isArray(original) && Array.isArray(modified)) {
    return diffArray(original, modified);
  }

  // Caso objetos simples: compara chave a chave
  return diffObject(original, modified);
}
