/**
 * Escapa strings que começam com # ou \ para evitar colisões
 * com smart keys.
 *
 * Exemplos:
 *   "#a"    → "\#a"
 *   "\#a"   → "\\#a"
 *   "\\#a"  → "\\\#a"
 *   "normal" → "normal" (sem escape)
 */
function escapeIdentity(str: string): string {
  // Se começa com # ou \, adiciona \ no início
  if (str.startsWith("#") || str.startsWith("\\")) {
    return `\\${str}`;
  }
  return str;
}

/**
 * Remove escape de identidade.
 *
 * Exemplos:
 *   "\#a"    → "#a"
 *   "\\#a"   → "\#a"
 *   "\\\#a"  → "\\#a"
 *   "normal" → "normal" (sem unescape)
 */
export function unescapeIdentity(str: string): string {
  // Se começa com \, remove o primeiro \
  if (str.startsWith("\\")) {
    return str.slice(1);
  }
  return str;
}

export function getArrayItemIdentity(item: any): string {
  const key = getKey(item);
  if (key) {
    return `#${key}`;
  }

  if (typeof item === "object" && item !== null) {
    return JSON.stringify(item);
  }

  // String ou primitivo: escapar se começar com # ou \
  const str = String(item);
  return escapeIdentity(str);
}

export function isNonEmptyDiff(value: any): boolean {
  if (value === null) return false;
  if (typeof value !== "object") return true;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  if (keys.length === 1 && keys[0] === "$__arrayOps") {
    return value.$__arrayOps.length > 0;
  }
  return true;
}

export function getKey(item: any): string | undefined {
  if (!item || typeof item !== "object") return undefined;

  // Prioridade: key > id
  if (typeof item.key === "string") return item.key;
  if (item.id !== undefined && item.id !== null) return String(item.id);

  return undefined;
}
