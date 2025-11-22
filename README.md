# json-myers

<p align="center">
  <img src="./public/jason-myers.png" alt="JSON Myers" width="600">
</p>

<p align="center">
  <a href="https://github.com/andersondrosa/json-myers"><img src="https://img.shields.io/badge/tests-157%2F157%20passing-brightgreen" alt="Tests"></a>
  <a href="https://github.com/andersondrosa/json-myers"><img src="https://img.shields.io/badge/coverage-100%25%20active-brightgreen" alt="Coverage"></a>
  <a href="https://github.com/andersondrosa/json-myers"><img src="https://img.shields.io/badge/status-stable-green" alt="Status"></a>
  <a href="https://www.npmjs.com/package/json-myers"><img src="https://img.shields.io/npm/v/json-myers" alt="npm version"></a>
</p>

<p align="center">
  <strong>The first JSON diff/patch library that actually understands arrays.</strong>
</p>

## The Problem

Traditional deep merge tools (Lodash, Ramda, etc.) fail catastrophically with arrays:

```javascript
// Using lodash.merge or similar tools:
const original = {
  users: [
    { id: 1, name: "Alice", role: "admin" },
    { id: 2, name: "Bob", role: "user" }
  ]
};

const modified = {
  users: [
    { id: 2, name: "Bob", role: "admin" },  // Bob promoted + moved to top
    { id: 1, name: "Alice", role: "admin" }  // Alice promoted
  ]
};

_.merge(original, modified);
// ❌ Result: Overwrites entire array or merges by index
// Can't detect: moves, reordering, or track objects by identity
```

**The fundamental issue:** Standard merge tools treat arrays as positional data structures, not collections of identified objects.

## The Solution

**json-myers** uses the Myers diff algorithm (same as Git) with smart object tracking to generate **minimal, semantically-aware patches** that understand array operations:

```javascript
import { diffJson, patchJson } from 'json-myers';

const diff = diffJson(original, modified);
// {
//   users: {
//     $__arrayOps: [
//       { type: "move", from: 1, to: 0, item: "#2" }  // Bob moved to top
//     ],
//     "1": { role: "admin" },  // Alice role updated
//     "2": { role: "admin" }   // Bob role updated
//   }
// }

const result = patchJson(original, diff);
// ✅ Perfect reconstruction: moves + updates applied correctly
```

### What Makes This Possible

1. **Myers Algorithm**: Mathematically optimal diff (same as Git uses for files)
2. **Smart Keys**: Tracks objects by `id`/`key` instead of array position
3. **Semantic Operations**: Understands `move`, not just `remove + add`
4. **Deep Merging**: Recursively patches nested objects at specific positions

This enables **true collaborative editing**, **conflict-free synchronization**, and **precise state management** - things impossible with traditional merge tools.

## Key Features

- 🚀 **High Performance**: Optimized Myers O(ND) algorithm (same as Git)
- 🔄 **Move Detection**: Identifies when items are moved in arrays
- 🔑 **Smart Keys**: Tracks objects by `id`/`key` (supports numeric IDs)
- 🛡️ **Anti-Collision**: Automatic escaping prevents string/key conflicts
- 📦 **Minimal Patches**: Generates only necessary differences
- 🔙 **Reversible**: Full undo/redo support
- 🌳 **Deep Support**: Works with complex nested structures
- ✅ **100% Tested**: 157 tests passing, 0 failures
- 🎯 **Idempotent**: Safe to apply diffs multiple times

## Installation

```bash
npm install json-myers
# or
yarn add json-myers
# or
pnpm add json-myers
```

## How to Use

### Basic Example

```javascript
import { diffJson, patchJson } from 'json-myers';

const original = {
  name: "John",
  age: 30,
  hobbies: ["reading", "music"]
};

const modified = {
  name: "John Silva",
  age: 30,
  hobbies: ["reading", "music", "sports"],
  city: "New York"
};

// Calculate differences
const diff = diffJson(original, modified);
// {
//   name: "John Silva",
//   hobbies: {
//     "$__arrayOps": [
//       { type: "add", index: 2, item: "sports" }
//     ]
//   },
//   city: "New York"
// }

// Apply differences
const result = patchJson(original, diff);
// result === modified
```

### Working with Arrays

```javascript
// Simple arrays
const diff1 = diffJson([1, 2, 3], [1, 3, 4]);
// {
//   "$__arrayOps": [
//     { type: "remove", index: 1, item: 2 },
//     { type: "add", index: 2, item: 4 }
//   ]
// }

// Move detection
const diff2 = diffJson(["A", "B", "C"], ["B", "C", "A"]);
// {
//   "$__arrayOps": [
//     { type: "move", from: 0, to: 2, item: "A" }
//   ]
// }
```

### Smart Keys - Object Arrays (with numeric IDs!)

```javascript
const users1 = [
  { id: 1, name: "Alice", role: "admin" },
  { id: 2, name: "Bob", role: "user" }
];

const users2 = [
  { id: 2, name: "Bob", role: "admin" },    // Bob promoted
  { id: 1, name: "Alice", role: "admin" },  // Alice moved position
  { id: 3, name: "Carol", role: "user" }    // Carol added
];

const diff = diffJson(users1, users2);
// {
//   "$__arrayOps": [
//     { type: "move", from: 0, to: 1, item: "#1" },  // Alice move
//     { type: "add", index: 2, key: "3" }             // Carol add
//   ],
//   "2": { role: "admin" },  // Change in Bob (id: 2)
//   "3": { name: "Carol", role: "user" }  // Carol new (id not duplicated)
// }

// ✨ Numeric IDs are automatically converted to strings in keys!
```

### Removing Properties

```javascript
const diff = diffJson(
  { a: 1, b: 2, c: 3 },
  { a: 1, c: 3 }
);
// {
//   b: { "$__remove": true }
// }

// Apply removal
const result = patchJson({ a: 1, b: 2, c: 3 }, diff);
// { a: 1, c: 3 }
```

### Deep Diffs

```javascript
const state1 = {
  user: {
    profile: {
      name: "John",
      settings: {
        theme: "light",
        notifications: true
      }
    }
  }
};

const state2 = {
  user: {
    profile: {
      name: "John",
      settings: {
        theme: "dark",
        notifications: true,
        language: "en-US"
      }
    }
  }
};

const diff = diffJson(state1, state2);
// {
//   user: {
//     profile: {
//       settings: {
//         theme: "dark",
//         language: "en-US"
//       }
//     }
//   }
// }
```

## Complete API

### diffJson(original, modified)

Calculates the difference between two JSON values.

```typescript
function diffJson(original: any, modified: any): any
```

**Special returns:**
- `{}`: No changes
- Direct value: When the type changes completely
- Object with changes: For objects and arrays

### patchJson(base, diff)

Applies a diff to a base value.

```typescript
function patchJson(base: any, diff: any): any
```

### myersDiff(arrayA, arrayB)

Calculates basic diff between two arrays using Myers algorithm.

```typescript
type Operation =
  | { type: "add", index: number, item: any }
  | { type: "remove", index: number, item: any }

function myersDiff(a: any[], b: any[]): Operation[]
```

### myersDiffOptimization(operations)

Optimizes diff operations by detecting moves.

```typescript
type OptimizedOperation = Operation |
  { type: "move", from: number, to: number, item: any }

function myersDiffOptimization(ops: Operation[]): OptimizedOperation[]
```

### convertJsonMyersToGitDiff(lines, operations, filename)

Converts diff operations to Git unified diff format.

```typescript
function convertJsonMyersToGitDiff(
  lines: string[],
  operations: Operation[],
  filename: string
): string
```

## Diff Formats

### Array Operations

```javascript
{
  "$__arrayOps": [
    { type: "add", index: 2, item: "new" },
    { type: "remove", index: 0, item: "old" },
    { type: "move", from: 1, to: 3, item: "moved" }
  ]
}
```

### Modifications with Smart Keys

```javascript
{
  "$__arrayOps": [
    { type: "move", from: 0, to: 2, item: "#user-1" }
  ],
  "user-1": {               // changes in object with key="user-1"
    name: "Updated Name"
  },
  "user-2": {               // changes in object with key="user-2"
    email: "new@email.com"
  }
}
```

### Property Removal

```javascript
{
  property: { "$__remove": true }
}
```

## Use Cases

### 1. **State Synchronization**

```javascript
// Client sends only changes
const localState = getLocalState();
const remoteState = await fetchRemoteState();
const diff = diffJson(remoteState, localState);

// Server applies changes
await sendDiff(diff); // Sends only the differences
```

### 2. **Undo/Redo System**

```javascript
class History {
  constructor(initial) {
    this.states = [initial];
    this.diffs = [];
    this.current = 0;
  }

  push(newState) {
    const diff = diffJson(this.states[this.current], newState);
    this.diffs.push(diff);
    this.states.push(newState);
    this.current++;
  }

  undo() {
    if (this.current > 0) {
      this.current--;
      return this.states[this.current];
    }
  }

  redo() {
    if (this.current < this.states.length - 1) {
      this.current++;
      return this.states[this.current];
    }
  }
}
```

### 3. **Change Auditing**

```javascript
// Record all changes
const auditLog = [];

function updateData(newData) {
  const oldData = getCurrentData();
  const diff = diffJson(oldData, newData);

  auditLog.push({
    timestamp: new Date(),
    user: getCurrentUser(),
    changes: diff
  });

  saveData(newData);
}
```

### 4. **Real-time Collaboration**

```javascript
// WebSocket for synchronization
socket.on('state-change', (diff) => {
  const currentState = getState();
  const newState = patchJson(currentState, diff);
  setState(newState);
});

// Send local changes
function handleLocalChange(newState) {
  const diff = diffJson(lastSyncedState, newState);
  socket.emit('state-change', diff);
  lastSyncedState = newState;
}
```

## Performance

- **Myers Algorithm**: O(ND) where N = size, D = edit distance
- **Optimized for**: Small changes in large structures
- **Smart Keys**: Reduces complexity in object arrays
- **Caching**: Object IDs are cached during diff

## Limitations

- Doesn't detect property renaming (treats as remove + add)
- Circular objects are not supported
- Very large arrays may have degraded performance in worst case
- Order of patch application matters for arrays

## Comparison with Alternatives

| Feature | json-myers | deep-diff | json-patch |
|---------|-----------|-----------|------------|
| Algorithm | Myers | Recursive | RFC 6902 |
| Move detection | ✅ | ❌ | ❌ |
| Smart Keys | ✅ | ❌ | ❌ |
| Output format | Custom | Custom | JSON Patch |
| Performance | High | Medium | Medium |
| Diff size | Minimal | Medium | Large |

## Changelog

### v1.0.0-rc (2025-11-22) ✅

**Status:** Stable - Production Ready

**Bug Fixes:**
- 🐛 Fixed critical duplication bug when applying moves after removes with smart keys
- 🐛 Fixed incorrect `removedIndices` calculation in `patchJson.ts`

**Features:**
- ✨ Anti-collision escape system (`"#a"` vs `{key:"a"}`)
- ✨ Optimization: array base search ~10x faster than `JSON.parse()`
- ✨ Complete Git-like history test (7 steps forward/backward)
- ✨ Perfect round-trip validation
- ✨ Idempotency validation
- ✨ Support for chaotic type mix (real life)

**Tests:**
- ✅ 157/157 tests passing (100%)
- ✅ 0 tests failing
- ✅ 0 tests skipped
- ✅ 5 new edge-case collision tests
- ✅ Complete coverage of critical cases

**Breaking Changes:**
- None! 100% compatible with previous versions

---

## License

MIT © 2025 Anderson D. Rosa