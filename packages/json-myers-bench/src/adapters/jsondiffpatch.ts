import * as jsondiffpatch from "jsondiffpatch";
import type { Adapter } from "./types.ts";

const instance = jsondiffpatch.create({
  objectHash: (obj: unknown, idx?: number) => {
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      if (typeof o.id === "string" || typeof o.id === "number")
        return String(o.id);
      if (typeof o.sku === "string" || typeof o.sku === "number")
        return String(o.sku);
      if (typeof o.key === "string" || typeof o.key === "number")
        return String(o.key);
    }
    return `$$index:${idx ?? 0}`;
  },
  arrays: { detectMove: true, includeValueOnMove: false },
});

export const jsondiffpatchAdapter: Adapter = {
  name: "jsondiffpatch",
  label: "jsondiffpatch (identity-aware via objectHash)",
  generate: (a, b) => instance.diff(a, b),
};
