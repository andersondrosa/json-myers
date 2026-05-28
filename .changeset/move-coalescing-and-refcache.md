---
"json-myers": minor
---

Diff generation now emits `move` ops for smart-key reorders (O-001
implemented). Adds opt-in `refCache` for fingerprint caching in
immutable-state workloads.

**Changes:**

- **D-032 — Smart-key `move` coalescing in `diffArray`**: pairs of
  `(del fp, ins fp)` with matching smart-key fingerprints are now
  collapsed into a single `move` op instead of `remove + add` literal.
  Restricted to smart-key (positional move would corrupt indices in
  the patcher's intermediate state). Nested updates of moved items
  use `diffJsonInner` for minimal delta (no-op moves omit the nested
  entry entirely via `NO_CHANGE`). Drops diff size dramatically in
  reorder-heavy scenarios.

- **D-033 — `options.refCache` opt-in**: per-call `WeakMap<object, string>`
  fingerprint cache. ~1.7× faster generation in immutable-state
  workloads (Redux/Immer/Zustand) where references are preserved
  between `a` and `b`. Output is bit-identical to the non-cached
  mode — pure optimization, no semantic change. Distinct from
  `jsondiffpatch`'s `===` semantic (which breaks on in-place
  mutation): refCache uses reference as a **cache key for the
  fingerprint**, not as identity semantics.

- **Wire format unchanged**: existing patches still apply correctly.
  The patcher always accepted `move` ops — only the generator changed.

**Tests:** 450/450 passing (conformance R1–R10 + diff RD1–RD4 + Myers
git-equivalence + roundtrip fuzz).

**Bench**: see `packages/json-myers-bench/results/RESULTS.md` for
empirical comparison against `fast-json-patch`, `rfc6902`, and
`jsondiffpatch` across 15 scenarios.

**Docs reorganized**: `DECISIONS.md` moved to `docs/DECISIONS.md`.
README and ARCHITECTURE updated with new sections covering
`refCache`, benchmark insights, and the smart-key-only positional
move limitation.
