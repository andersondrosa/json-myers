//
export function isPrimitiveDiff(a: any, b: any): boolean {
  const isObjectA = typeof a === "object" && a !== null;
  const isObjectB = typeof b === "object" && b !== null;
  return !isObjectA || !isObjectB;
}

export function primitiveDiff(original: any, modified: any): any {
  return original === modified ? {} : modified;
}
