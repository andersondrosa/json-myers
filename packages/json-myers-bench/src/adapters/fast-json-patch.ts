import fastJsonPatch from "fast-json-patch";
import type { Adapter } from "./types.ts";

export const fastJsonPatchAdapter: Adapter = {
  name: "fast-json-patch",
  label: "fast-json-patch (RFC 6902)",
  generate: (a, b) => fastJsonPatch.compare(a as object, b as object),
};
