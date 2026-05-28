import { createPatch } from "rfc6902";
import type { Adapter } from "./types.ts";

export const rfc6902Adapter: Adapter = {
  name: "rfc6902",
  label: "rfc6902 (RFC 6902)",
  generate: (a, b) => createPatch(a, b),
};
