/**
 * Fingerprint — convert any JSON value into a stable string label so
 * the Myers diff can compare items via `===` on labels (cheap) instead
 * of structural deep-equality on every pair (expensive O(N×M)).
 *
 * ## Three flavors of fingerprint
 *
 * - `"p:<tag>:<literal>"` — primitive (null, boolean, number, string).
 *   The tag prefix prevents cross-type collisions (e.g. boolean `true`
 *   vs string `"true"`).
 * - `"#<key>"`             — object with a declared identity (`id` or
 *   `key` field). The smart-key form — preserves identity across
 *   content changes; diff emits nested updates instead of remove+add.
 * - `"h:<hex>"`            — object without identity, OR array, OR any
 *   structural item that needs content-equality. Hashed with FNV-1a
 *   recursively over the structure.
 *
 * ## Anti-collision
 *
 * The primitive prefix `"p:s:"` for strings means a literal string
 * `"#abc"` becomes `"p:s:#abc"` — does NOT collide with a smart-key
 * `"#abc"` from `{ key: "abc" }`. This is by design (R4 escape system
 * built into the prefix scheme).
 *
 * ## Determinism
 *
 * Object keys are sorted alphabetically before hashing → the same
 * logical object produces the same fingerprint regardless of property
 * insertion order. Each value type is mixed with a distinct tag byte
 * so structurally-similar-but-typed-different values diverge.
 */

// ── Public API ────────────────────────────────────────────────────

/**
 * Stable, content-addressable label for a JSON value. Two values with
 * the same fingerprint are considered the "same item" for diff
 * purposes (Myers feeds on these labels via `===`).
 *
 * @param value     Any JSON value.
 * @param identity  Field name to inspect for smart-key identity in
 *                  objects. Default `"id"`. Only `string | number`
 *                  values are accepted as identity — other types fall
 *                  back to content hash.
 */
export function fingerprintItem(value: unknown, identity = "id"): string {
  if (value === null) return "p:null";

  switch (typeof value) {
    case "string":
      return "p:s:" + value;
    case "number":
      return "p:n:" + numberRepr(value);
    case "boolean":
      return value ? "p:b:1" : "p:b:0";
    case "object":
      break; // fall through to object/array handling
    default:
      // bigint, symbol, function, undefined — not JSON; treat as opaque hash.
      return "p:x:" + String(value);
  }

  // ── array ────────────────────────────────────────────────────────
  if (Array.isArray(value)) {
    return "h:" + hashToHex(value);
  }

  // ── object ───────────────────────────────────────────────────────
  const obj = value as Record<string, unknown>;
  const id = obj[identity];
  if (typeof id === "string" || typeof id === "number") {
    return "#" + String(id);
  }
  return "h:" + hashToHex(obj);
}

/**
 * Fingerprint a whole array with smart-key duplicate detection:
 * **only the first occurrence of a smart-key wins**; subsequent items
 * with the same smart-key fall back to content hash. This preserves
 * the "first wins" semantic without ambiguity.
 *
 * Used by `diffArray` to prepare the input for Myers — the resulting
 * `string[]` is fed to the algorithm via `===` equality.
 */
export function fingerprintArray(
  arr: readonly unknown[],
  identity = "id",
): string[] {
  const out: string[] = new Array(arr.length);
  const seenSmartKeys = new Set<string>();
  for (let i = 0; i < arr.length; i++) {
    const fp = fingerprintItem(arr[i], identity);
    if (fp.length > 0 && fp.charCodeAt(0) === 0x23 /* '#' */) {
      if (seenSmartKeys.has(fp)) {
        // Duplicate smart-key in the same array → fall back to content
        // hash for this occurrence (first wins).
        out[i] = "h:" + hashToHex(arr[i]);
      } else {
        seenSmartKeys.add(fp);
        out[i] = fp;
      }
    } else {
      out[i] = fp;
    }
  }
  return out;
}

/**
 * Compute the FNV-1a 32-bit hash of a JSON value recursively. Returns
 * an unsigned 32-bit integer. Stable across object key insertion
 * order (keys sorted alphabetically internally).
 */
export function hashValue(value: unknown): number {
  return updateHash(FNV_OFFSET, value) >>> 0;
}

// ── Internals ─────────────────────────────────────────────────────

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Tag bytes — distinguish types so primitives don't collide. */
const TAG_NULL = 0x10;
const TAG_UNDEFINED = 0x11;
const TAG_BOOLEAN = 0x12;
const TAG_NUMBER = 0x13;
const TAG_STRING = 0x14;
const TAG_ARRAY = 0x15;
const TAG_OBJECT = 0x16;

function mixByte(h: number, byte: number): number {
  h ^= byte & 0xff;
  return Math.imul(h, FNV_PRIME);
}

function mixUint16(h: number, value: number): number {
  h = mixByte(h, value & 0xff);
  return mixByte(h, (value >>> 8) & 0xff);
}

function mixString(h: number, s: string): number {
  // Use char codes — covers full BMP. JSON strings stay in the BMP in
  // practice; surrogate pairs are still hashed byte-wise deterministically.
  for (let i = 0; i < s.length; i++) {
    h = mixUint16(h, s.charCodeAt(i));
  }
  // Mix length too — distinguishes "ab" from "ba" with same charset.
  return mixUint16(h, s.length & 0xffff);
}

// Reusable buffers for number serialization (avoid per-call allocation).
const NUM_BUF = new ArrayBuffer(8);
const NUM_F64 = new Float64Array(NUM_BUF);
const NUM_BYTES = new Uint8Array(NUM_BUF);

function mixNumber(h: number, n: number): number {
  NUM_F64[0] = n;
  for (let i = 0; i < 8; i++) {
    h = mixByte(h, NUM_BYTES[i]!);
  }
  return h;
}

function updateHash(h: number, value: unknown): number {
  if (value === null) return mixByte(h, TAG_NULL);
  if (value === undefined) return mixByte(h, TAG_UNDEFINED);

  switch (typeof value) {
    case "boolean":
      h = mixByte(h, TAG_BOOLEAN);
      return mixByte(h, value ? 1 : 0);

    case "number":
      h = mixByte(h, TAG_NUMBER);
      return mixNumber(h, value);

    case "string":
      h = mixByte(h, TAG_STRING);
      return mixString(h, value);

    case "object": {
      if (Array.isArray(value)) {
        h = mixByte(h, TAG_ARRAY);
        h = mixUint16(h, value.length & 0xffff);
        for (const item of value) {
          h = updateHash(h, item);
        }
        return h;
      }
      h = mixByte(h, TAG_OBJECT);
      // Sort keys for insertion-order independence.
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      h = mixUint16(h, keys.length & 0xffff);
      for (const k of keys) {
        h = mixString(h, k);
        h = updateHash(h, obj[k]);
      }
      return h;
    }

    default:
      // bigint, symbol, function — non-JSON, mix string repr defensively.
      h = mixByte(h, TAG_STRING);
      return mixString(h, String(value));
  }
}

/** Convenience: 8-char hex rendering of `hashValue` for use as fingerprint suffix. */
export function hashToHex(value: unknown): string {
  return hashValue(value).toString(16).padStart(8, "0");
}

/**
 * Render a number in a canonical form for the primitive fingerprint.
 * IEEE-754 byte representation is used for hashing; for the literal
 * fingerprint we use the JSON-equivalent form.
 */
function numberRepr(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "Infinity";
  if (n === -Infinity) return "-Infinity";
  // -0 vs 0: stringify both as "0" (JSON treats them the same).
  if (n === 0) return "0";
  return String(n);
}
