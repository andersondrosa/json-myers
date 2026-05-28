import { diffJson } from "json-myers";
import type { Adapter } from "./types.ts";

/**
 * json-myers with `refCache: true` — opt-in WeakMap cache for
 * fingerprints. Pure performance optimization: same output bytes,
 * faster when the input has preserved JS references (immutable state
 * managers like Redux/Immer/Zustand).
 *
 * On freshly-deserialized JSON (refs never preserved), refCache adds
 * ~50ns overhead per fingerprint call with no benefit — but still
 * produces identical diffs.
 */
export const myersRefCacheAdapter: Adapter = {
  name: "myers-refcache",
  label: "json-myers (refCache opt-in)",
  generate: (a, b, ctx) =>
    ctx?.identity
      ? diffJson(a, b, { identity: ctx.identity, refCache: true })
      : diffJson(a, b, { refCache: true }),
};
