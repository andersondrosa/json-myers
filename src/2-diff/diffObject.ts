import { diffJson } from "./diffJson";
import { isNonEmptyDiff } from "./utils";

const REMOVE_MARKER = "$__remove";

export function diffObject(original: any, modified: any): any {
  const diff: any = {};
  const keys = new Set([...Object.keys(original), ...Object.keys(modified)]);

  for (const key of keys) {
    if (!(key in modified)) {
      diff[key] = { [REMOVE_MARKER]: true };
    } else if (!(key in original)) {
      diff[key] = modified[key];
    } else {
      const nested = diffJson(original[key], modified[key]);
      if (nested === null || isNonEmptyDiff(nested)) {
        diff[key] = nested;
      }
    }
  }

  return diff;
}
