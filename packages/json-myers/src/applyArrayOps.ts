/**
 * Application of `$ops` operations to a base array.
 *
 * The application happens in three phases:
 *
 *   1. Removes — descending by resolved index. Items removed by
 *      smart-key are cached so a paired `add` with the same key
 *      reuses the original item (the "remove+add as move" sugar —
 *      identical to a smart-key `move`).
 *   2. Moves — applied next. Smart-key moves are normalized inline
 *      into the same remove+add flow (sugar); positional moves run
 *      directly.
 *   3. Adds — ascending by index. Smart-key adds either re-use a
 *      previously-removed item or build a fresh one from a sibling
 *      diff entry.
 *
 * After ops settle, nested updates by smart-key (any non-marker key in
 * the diff that matches a smart-key in the result array) are applied
 * recursively via `patchJson`.
 *
 * The identity field is resolved per call: `diff.$identity` wins over
 * `options.identity`, which wins over `DEFAULT_IDENTITY` (`"id"`).
 *
 * When `diff.$assertCollection: true`, the base array is pre-validated
 * (every item is a plain object with the declared identity, no
 * duplicates) — `CollectionAssertionError` on violation. After
 * validation, the algorithm operates in a fast path.
 *
 * In strict mode, every divergence (missing key, out-of-range index,
 * no-op move, key collision on add, missed nested-update key) is
 * raised as `StrictViolationError` instead of silent-ignored.
 */

import type {
  OpsDiff,
  AddOp,
  RemoveOp,
  PatchOptions,
  MoveOpPositional,
} from "./types.js";
import {
  DEFAULT_IDENTITY,
  StrictViolationError,
  CollectionAssertionError,
} from "./types.js";
import { patchJson } from "./patch.js";

/** Set of marker keys that must be skipped when iterating an OpsDiff. */
const MARKER_KEYS = new Set(["$ops", "$identity", "$assertCollection"]);

/** Extract the smart-key value of an item using the active identity field. */
function smartKeyOf(item: unknown, identity: string): string | undefined {
  if (item !== null && typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    const id = o[identity];
    if (typeof id === "string" || typeof id === "number") {
      return String(id);
    }
  }
  return undefined;
}

/** Find the index of an item in `arr` matching the given smart-key. */
function indexOfSmartKey(
  arr: readonly unknown[],
  lookupKey: string,
  identity: string,
): number {
  for (let i = 0; i < arr.length; i++) {
    if (smartKeyOf(arr[i], identity) === lookupKey) return i;
  }
  return -1;
}

/**
 * Build a fresh item for a smart-key add when no recycled item exists.
 * The item gets the smart-key value in the identity field, plus any
 * properties from the sibling diff entry (spread overrides — preserves
 * original type of the identity field if seed carries it).
 */
function buildFromSeed(
  identity: string,
  smartKey: string,
  seed: unknown,
): Record<string, unknown> {
  const base: Record<string, unknown> = { [identity]: smartKey };
  if (seed !== null && typeof seed === "object" && !Array.isArray(seed)) {
    return { ...base, ...(seed as Record<string, unknown>) };
  }
  return base;
}

/**
 * Pre-validate a base array against the collection contract. Throws
 * `CollectionAssertionError` on the first violation.
 *
 * Three contracts checked:
 *   1. Every item is a non-null plain object (not primitive, not
 *      array).
 *   2. Every item carries the declared identity field with a
 *      string/number value.
 *   3. No two items share the same identity value.
 */
function assertCollection(arr: readonly unknown[], identity: string): void {
  const seen = new Set<string>();
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new CollectionAssertionError(
        "COLLECTION_NON_OBJECT_ITEM",
        `Item at index ${i} is not a plain object`,
        { index: i, item, identity },
      );
    }
    const id = (item as Record<string, unknown>)[identity];
    if (typeof id !== "string" && typeof id !== "number") {
      throw new CollectionAssertionError(
        "COLLECTION_MISSING_IDENTITY",
        `Item at index ${i} is missing the "${identity}" identity field`,
        { index: i, item, identity },
      );
    }
    const k = String(id);
    if (seen.has(k)) {
      throw new CollectionAssertionError(
        "COLLECTION_DUPLICATE_IDENTITY",
        `Duplicate identity "${k}" at index ${i}`,
        { index: i, identityValue: k, identity },
      );
    }
    seen.add(k);
  }
}

/**
 * Apply a `$ops` diff fragment to a base array. Pure — returns a new
 * array and does not mutate the input.
 */
export function applyArrayOps(
  base: readonly unknown[],
  diff: OpsDiff,
  options: PatchOptions = {},
): unknown[] {
  const strict = options.strict === true;

  // Resolve identity: diff's $identity wins over options, which wins
  // over default "id". This is the only place the precedence is set.
  const identity =
    typeof diff.$identity === "string"
      ? diff.$identity
      : (options.identity ?? DEFAULT_IDENTITY);

  // Collection assertion — pre-validate base shape.
  if (diff.$assertCollection === true) {
    assertCollection(base, identity);
  }

  const ops = diff.$ops;

  // Partition by op type. Smart-key moves are pre-expanded into
  // remove+add pairs (sugar normalization). Positional moves stay in
  // their own bucket so they can be applied between removes and adds.
  const removes: RemoveOp[] = [];
  const positionalMoves: MoveOpPositional[] = [];
  const adds: AddOp[] = [];

  for (const op of ops) {
    if (op.type === "remove") {
      removes.push(op);
    } else if (op.type === "add") {
      adds.push(op);
    } else {
      // move
      if ("key" in op) {
        // Resolve up front: is the key present in the base array?
        const currentIdx = indexOfSmartKey(base, op.key, identity);
        if (currentIdx < 0) {
          if (strict) {
            throw new StrictViolationError(
              "KEY_NOT_FOUND",
              `move { key: "${op.key}" } — no item with that key in the array`,
              { op: "move", key: op.key },
            );
          }
          // Normal mode: silent skip — DO NOT desugar (would create
          // a phantom item via the add half).
          continue;
        }
        // Strict: catch no-op moves (already at target index).
        if (strict && currentIdx === op.to) {
          throw new StrictViolationError(
            "MOVE_NO_OP",
            `move { key: "${op.key}", to: ${op.to} } is a no-op — item already at target index`,
            { key: op.key, to: op.to },
          );
        }
        // Smart-key move → desugar into remove+add (same key).
        removes.push({ type: "remove", key: op.key });
        adds.push({ type: "add", key: op.key, index: op.to });
      } else {
        if (strict && op.from === op.to) {
          throw new StrictViolationError(
            "MOVE_NO_OP",
            `move { from: ${op.from}, to: ${op.to} } is a no-op`,
            { from: op.from, to: op.to },
          );
        }
        positionalMoves.push(op);
      }
    }
  }

  let result: unknown[] = [...base];

  // Cache of items removed by smart-key, so an `add` with the same
  // key reinserts the original (the "sugar move").
  const removedByKey = new Map<string, unknown>();

  // ── 1. Removes ───────────────────────────────────────────────────
  const resolvedRemoves: { op: RemoveOp; index: number }[] = [];
  for (const op of removes) {
    if ("key" in op) {
      const idx = indexOfSmartKey(result, op.key, identity);
      if (idx < 0) {
        if (strict) {
          throw new StrictViolationError(
            "KEY_NOT_FOUND",
            `remove { key: "${op.key}" } — no item with that key in the array`,
            { op: "remove", key: op.key },
          );
        }
        continue;
      }
      resolvedRemoves.push({ op, index: idx });
    } else {
      if (op.index < 0 || op.index >= result.length) {
        if (strict) {
          throw new StrictViolationError(
            "INDEX_OUT_OF_RANGE",
            `remove { index: ${op.index} } — out of range (length ${result.length})`,
            { op: "remove", index: op.index, length: result.length },
          );
        }
        continue;
      }
      resolvedRemoves.push({ op, index: op.index });
    }
  }
  // Apply descending so indices stay valid.
  resolvedRemoves.sort((a, b) => b.index - a.index);
  for (const { op, index } of resolvedRemoves) {
    const item = result[index];
    result.splice(index, 1);
    if ("key" in op) {
      removedByKey.set(op.key, item);
    }
  }

  // ── 2. Positional moves — remove-then-insert ─────────────────────
  for (const op of positionalMoves) {
    const { from, to } = op;
    if (from < 0 || from >= result.length) {
      if (strict) {
        throw new StrictViolationError(
          "INDEX_OUT_OF_RANGE",
          `move { from: ${from} } — out of range (length ${result.length})`,
          { op: "move-from", from, length: result.length },
        );
      }
      continue;
    }
    const item = result[from];
    result.splice(from, 1);
    result.splice(to, 0, item);
  }

  // ── 3. Adds — ascending by resolved index ────────────────────────
  const resolvedAdds = adds
    .map((op) => {
      const idx = (op as { index?: number }).index;
      return { op, index: typeof idx === "number" ? idx : result.length };
    })
    .sort((a, b) => a.index - b.index);

  for (const { op, index } of resolvedAdds) {
    let item: unknown;
    if ("key" in op) {
      const recycled = removedByKey.get(op.key);
      if (recycled !== undefined) {
        item = recycled;
        removedByKey.delete(op.key);
      } else {
        // Strict: an add for a key that already exists is a collision.
        if (strict && indexOfSmartKey(result, op.key, identity) >= 0) {
          throw new StrictViolationError(
            "KEY_ALREADY_EXISTS",
            `add { key: "${op.key}" } — an item with this key already exists`,
            { key: op.key },
          );
        }
        const seed = (diff as Record<string, unknown>)[op.key];
        item = buildFromSeed(identity, op.key, seed);
      }
    } else {
      item = op.item;
    }
    const at = Math.min(index, result.length);
    result.splice(at, 0, item);
  }

  // ── 4. Nested updates by smart-key ───────────────────────────────
  for (const [k, v] of Object.entries(diff)) {
    if (MARKER_KEYS.has(k)) continue;
    const idx = indexOfSmartKey(result, k, identity);
    if (idx < 0) {
      if (strict) {
        throw new StrictViolationError(
          "KEY_NOT_FOUND",
          `nested update for "${k}" — no item with that smart-key in the resulting array`,
          { op: "nested-update", key: k },
        );
      }
      continue;
    }
    result[idx] = patchJson(result[idx], v, options);
  }

  return result;
}
