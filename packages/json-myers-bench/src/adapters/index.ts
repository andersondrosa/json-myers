import { myersAdapter } from "./myers.ts";
import { myersRefCacheAdapter } from "./myers-refcache.ts";
import { fastJsonPatchAdapter } from "./fast-json-patch.ts";
import { rfc6902Adapter } from "./rfc6902.ts";
import { jsondiffpatchAdapter } from "./jsondiffpatch.ts";
import type { Adapter } from "./types.ts";

export const ADAPTERS: Adapter[] = [
  myersAdapter,
  myersRefCacheAdapter,
  fastJsonPatchAdapter,
  rfc6902Adapter,
  jsondiffpatchAdapter,
];
