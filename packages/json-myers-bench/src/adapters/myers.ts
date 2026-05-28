import { diffJson } from "json-myers";
import type { Adapter } from "./types.ts";

export const myersAdapter: Adapter = {
  name: "myers",
  label: "json-myers",
  generate: (a, b, ctx) =>
    ctx?.identity ? diffJson(a, b, { identity: ctx.identity }) : diffJson(a, b),
};
