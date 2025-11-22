# Bug Report: json-myers - Move Operation on Arrays Without Smart Keys

**Date:** 2025-11-22
**Package:** `json-myers` v1.0.0-rc
**Severity:** High
**Status:** Unconfirmed

---

## Summary

When using `diffJson()` and `patchJson()` with arrays that **do NOT have smart keys** (`id`/`key`), the **move operation corrupts data** by converting objects to strings.

---

## Expected Behavior

When reordering an array without smart keys, the objects should be moved correctly:

```javascript
const original = [
  { value: "A" },
  { value: "B" },
  { value: "C" }
];

const modified = [
  { value: "C" },  // ← Moved to first
  { value: "A" },
  { value: "B" }
];

const diff = diffJson(original, modified);
const result = patchJson(original, diff);

// EXPECTED:
result === [
  { value: "C" },
  { value: "A" },
  { value: "B" }
];
```

---

## Actual Behavior

The first item gets **corrupted** and converted to a **JSON string**:

```javascript
// ACTUAL RESULT:
[
  "{\"value\":\"C\"}",  // ← CORRUPTED! Should be object, not string
  { value: "A" },
  { value: "B" }
]
```

---

## Reproduction

### Test Case

```javascript
import { diffJson, patchJson } from "json-myers";

const original = [
  { value: "A" },
  { value: "B" },
  { value: "C" }
];

const modified = [
  { value: "C" },
  { value: "A" },
  { value: "B" }
];

const diff = diffJson(original, modified);
console.log("Diff:", JSON.stringify(diff, null, 2));

const result = patchJson(original, diff);
console.log("Result:", JSON.stringify(result, null, 2));
console.log("Match?", JSON.stringify(result) === JSON.stringify(modified));
```

### Output

```json
Diff: {
  "$__arrayOps": [
    {
      "type": "move",
      "from": 2,
      "to": 0,
      "item": "{\"value\":\"C\"}"  // ← Already stringified here!
    }
  ]
}

Result: [
  "{\"value\":\"C\"}",  // ← Corrupted
  { "value": "A" },
  { "value": "B" }
]

Match? false
```

---

## Analysis

### Root Cause

When arrays **do NOT have smart keys**, Myers attempts to use the **serialized object** as the move identifier:

```javascript
// In move operation:
{
  "type": "move",
  "from": 2,
  "to": 0,
  "item": "{\"value\":\"C\"}"  // ← JSON stringified object
}
```

When `patchJson()` applies this move, it **literally uses the string** instead of the actual object reference.

### Why Smart Keys Work

With smart keys (`id`/`key`), Myers uses the **key reference**:

```javascript
// With id:
{
  "type": "move",
  "from": 2,
  "to": 0,
  "item": "#c"  // ← Reference to id="c"
}
```

This works correctly because `patchJson()` can look up the object by its key.

---

## Workaround

**Always use smart keys (`id` or `key`) in array objects** when reordering is expected:

```javascript
// ✅ WORKS CORRECTLY
const original = [
  { id: "a", value: "A" },
  { id: "b", value: "B" },
  { id: "c", value: "C" }
];

const modified = [
  { id: "c", value: "C" },
  { id: "a", value: "A" },
  { id: "b", value: "B" }
];

const diff = diffJson(original, modified);
const result = patchJson(original, diff);
// ✅ Result is correct!
```

---

## Expected Fix

### Option 1: Use Index-Based Reference

For arrays without smart keys, use index references:

```javascript
{
  "type": "move",
  "from": 2,
  "to": 0,
  "item": 2  // ← Index reference
}
```

### Option 2: Embed Object in Move

Store the actual object in the move operation:

```javascript
{
  "type": "move",
  "from": 2,
  "to": 0,
  "item": { value: "C" }  // ← Actual object, not stringified
}
```

### Option 3: Use Remove + Add Instead

When no smart keys are present, avoid move operations entirely:

```javascript
{
  "$__arrayOps": [
    { "type": "remove", "index": 2, "item": { value: "C" } },
    { "type": "add", "index": 0, "item": { value: "C" } }
  ]
}
```

---

## Impact

### High Severity

- **Data corruption** when reordering arrays without smart keys
- **Silent failure** - no error thrown, just wrong data
- **Production risk** - can corrupt user data if not caught

### Affected Use Cases

1. ❌ Reordering drag-and-drop lists without IDs
2. ❌ Sorting arrays of objects by value
3. ❌ Moving items in dynamic forms
4. ✅ Arrays WITH `id`/`key` work fine (not affected)

---

## Test Results

Tested with `json-myers` v1.0.0-rc:

| Scenario | Smart Keys | Result |
|----------|------------|--------|
| Reorder with `id` | ✅ Yes | ✅ **PASS** |
| Reorder with `key` | ✅ Yes | ✅ **PASS** |
| Reorder WITHOUT keys | ❌ No | ❌ **FAIL** (corrupted) |
| Add/Remove WITHOUT keys | ❌ No | ✅ **PASS** |
| Update fields WITHOUT keys | ❌ No | ✅ **PASS** |

---

## Recommendation

### For json-myers Maintainers

1. Fix move operation for arrays without smart keys
2. Add test coverage for this scenario
3. Document smart key requirement clearly

### For Users (Temporary)

**Always use smart keys** when working with arrays that may be reordered:

```javascript
// ❌ AVOID (may corrupt data on move)
const items = [
  { name: "Item 1" },
  { name: "Item 2" }
];

// ✅ SAFE (works correctly)
const items = [
  { id: "item-1", name: "Item 1" },
  { id: "item-2", name: "Item 2" }
];
```

---

## Additional Information

### Environment

- **Node.js:** v18+
- **Package:** json-myers v1.0.0-rc
- **Test Framework:** Vitest

### Related Issues

- None found (needs to be reported upstream)

### Contact

This bug was discovered while implementing manifest resolution in the `manifest-core` package.

---

## Appendix: Full Test Code

```typescript
import { describe, it } from "vitest";
import { diffJson, patchJson } from "json-myers";

describe("Bug: Move without smart keys", () => {
  it("Cenário 5: Reordenar array SEM smart keys", () => {
    const original = [
      { value: "A" },
      { value: "B" },
      { value: "C" }
    ];

    const modified = [
      { value: "C" },
      { value: "A" },
      { value: "B" }
    ];

    const diff = diffJson(original, modified);
    console.log("\n=== CENÁRIO 5: REORDENAR SEM smart keys ===");
    console.log("Original:", JSON.stringify(original, null, 2));
    console.log("Modified:", JSON.stringify(modified, null, 2));
    console.log("Diff:", JSON.stringify(diff, null, 2));

    const result = patchJson(original, diff);
    console.log("Result:", JSON.stringify(result, null, 2));
    console.log("✓ Igual ao modified?", JSON.stringify(result) === JSON.stringify(modified));

    // BUG: result[0] is a string instead of an object!
    // Expected: { value: "C" }
    // Actual: "{\"value\":\"C\"}"
  });
});
```

---

**Last Updated:** 2025-11-22
**Reporter:** manifest-core team
