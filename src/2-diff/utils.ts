export function getArrayItemIdentity(item: any): string {
  const key = getKey(item);
  if (key) {
    return `#${key}`;
  }
  return typeof item === "object" && item !== null
    ? JSON.stringify(item)
    : String(item);
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
