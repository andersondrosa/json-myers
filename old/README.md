# json-myers

<p align="center">
  <img src="./public/jason-myers.png" alt="JSON Myers" width="600">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/json-myers"><img src="https://img.shields.io/npm/v/json-myers" alt="npm version"></a>
  <a href="https://github.com/andersondrosa/json-myers"><img src="https://img.shields.io/badge/tests-269%2F269-brightgreen" alt="Tests"></a>
  <a href="https://github.com/andersondrosa/json-myers/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
</p>

<p align="center">
  <strong>The first JSON diff/patch library that actually understands arrays.</strong>
</p>

## The problem

Traditional deep-merge tools (Lodash, Ramda, json-patch) treat arrays as positional data. Reordering an array of objects — even with stable IDs — generates oversized diffs full of `remove + add` pairs, and merging back is impossible without losing identity.

```js
const original = [
  { id: 1, name: "Alice", role: "user" },
  { id: 2, name: "Bob",   role: "user" }
];

const modified = [
  { id: 2, name: "Bob",   role: "admin" },  // Bob promoted + moved up
  { id: 1, name: "Alice", role: "admin" }   // Alice promoted
];

_.merge(original, modified);
// ❌ Overwrites by position. Identity is lost.
```

## The solution

`json-myers` runs the **Myers diff algorithm** (the one Git uses) over a stable identity projection of each array, then emits a minimal patch that knows the difference between *moving* an object and *replacing* it.

```js
import { diffJson, patchJson } from "json-myers";

const diff = diffJson(original, modified);
// {
//   $__arrayOps: [{ type: "move", from: 1, to: 0, item: "#2" }],
//   "1": { role: "admin" },
//   "2": { role: "admin" }
// }

const result = patchJson(original, diff);
// ✅ Bob moves up, both get promoted, identity preserved.
```

## Features

- **Myers O(ND) diff** — same algorithm as Git
- **Move detection** — `move` operations instead of `remove + add` for shuffled items
- **Smart keys** — track objects by `id` or `key` (numeric IDs auto-stringified)
- **Anti-collision escape** — `"#a"` (string literal) and `{ key: "a" }` never clash
- **Deep diffs** — nested patches at smart-key positions
- **Reversible** — diff + reverse-diff supports full undo/redo
- **Idempotent** — applying a diff twice gives the same result
- **Zero deps** — pure TypeScript, CJS + ESM + DTS

## Install

```bash
npm install json-myers
# or: pnpm add json-myers / yarn add json-myers
```

## Quick start

### Primitive & object diffs

```js
import { diffJson, patchJson } from "json-myers";

const diff = diffJson(
  { name: "John", age: 30, hobbies: ["reading", "music"] },
  { name: "John Silva", age: 30, hobbies: ["reading", "music", "sports"], city: "NYC" }
);
// {
//   name: "John Silva",
//   hobbies: { $__arrayOps: [{ type: "add", index: 2, item: "sports" }] },
//   city: "NYC"
// }
```

### Array of objects (smart keys)

```js
const users1 = [
  { id: 1, name: "Alice", role: "admin" },
  { id: 2, name: "Bob",   role: "user"  }
];

const users2 = [
  { id: 2, name: "Bob",   role: "admin" },
  { id: 1, name: "Alice", role: "admin" },
  { id: 3, name: "Carol", role: "user"  }
];

const diff = diffJson(users1, users2);
// {
//   $__arrayOps: [
//     { type: "move", from: 0, to: 1, item: "#1" },
//     { type: "add",  index: 2, key: "3" }
//   ],
//   "2": { role: "admin" },
//   "3": { id: 3, name: "Carol", role: "user" }
// }
```

### Property removal

```js
diffJson({ a: 1, b: 2 }, { a: 1 });
// { b: { $__remove: true } }
```

## API

### Diff & patch

| Export | Purpose |
|---|---|
| `diffJson(original, modified)` | Compute minimal diff between any two JSON values |
| `patchJson(base, diff)` | Apply a diff to a base value, returning a new value |
| `diff` | Alias of `diffJson` |
| `patch` | Alias of `patchJson` |

### Building blocks (advanced)

| Export | Purpose |
|---|---|
| `diffArray(a, b)` | Array-only diff (used internally by `diffJson`) |
| `diffObject(a, b)` | Object-only diff (used internally by `diffJson`) |
| `diffSmartKeys(a, b, result)` | Nested diff between identified objects |
| `myersDiff(a, b)` | Raw Myers O(ND) → `{type, index, item}[]` |
| `myersDiffOptimization(ops)` | Pair `remove+add` of the same item into `move` |
| `applyMyersDiff(arr, ops)` | Apply raw Myers ops to an array |
| `rollbackMyersDiff(arr, ops)` | Reverse-apply raw Myers ops |
| `optimizedDiffToMyersRaw(ops)` | Inverse of `myersDiffOptimization` |
| `convertJsonMyersToGitDiff(lines, ops, file)` | Render line-array diff as Git unified diff |

## Diff format (cheat sheet)

```ts
// Array ops
{
  $__arrayOps: [
    { type: "add",    index: 2, item: "sports" },
    { type: "remove", index: 0, item: "reading" },
    { type: "move",   from: 1, to: 3, item: "#user-1" }
  ]
}

// Property removal
{ propertyName: { $__remove: true } }

// Nested diff for an identified object
{
  $__arrayOps: [{ type: "move", from: 0, to: 2, item: "#user-1" }],
  "user-1": { name: "Updated" }
}
```

Full specification: [`docs/DIFF_FORMAT.md`](./docs/DIFF_FORMAT.md).

## Use cases

- **Real-time sync** — send only the delta over WebSocket / SSE
- **Undo/redo history** — store diffs, not snapshots
- **Audit logs** — minimal, semantically meaningful change records
- **CRDT-adjacent workflows** — composable patches with identity tracking
- **API PATCH endpoints** — replace heavy PUT payloads with structured deltas

## Semantic rules

`patchJson` follows 5 rules ([merge-conformance suite](./docs/json-merge-conformance.json) — 49 cases). A second suite ([reorder-conformance](./docs/json-reorder-conformance.json) — 64 cases) validates `diffJson` determinism and round-trip symmetry.

- **R1** — Array in patch (without `$__arrayOps`) **replaces** the base array entirely. No positional merge.
- **R2** — Type change between base and patch (array↔object↔primitive) → patch wins, base discarded.
- **R3** — Recursive structural merge only for (object, object) pairs without `$__arrayOps`.
- **R4** — `$__arrayOps` requires an array base. If the base isn't an array, `patchJson` throws `TypeError`.
- **R5** — `$__remove: true` deletes the corresponding key.

## Limitations

- Doesn't detect property renames (treated as `remove + add`)
- Circular references aren't supported
- Array worst case is O(N²) when there's no overlap
- Patches generated by `diffJson` must be applied by `patchJson` — hand-crafted moves are not guaranteed to work

## Further reading

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Internal structure, layers, design decisions
- [`docs/MYERS-LOGIC.md`](./docs/MYERS-LOGIC.md) — The algorithm explained
- [`docs/DIFF_FORMAT.md`](./docs/DIFF_FORMAT.md) — Diff format specification
- [`docs/SMART_KEYS.md`](./docs/SMART_KEYS.md) — Identity tracking system
- [`docs/PATCH_LOGIC.md`](./docs/PATCH_LOGIC.md) — How `patchJson` applies ops

## License

MIT © Anderson D. Rosa
