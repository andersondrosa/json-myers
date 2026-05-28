# json-myers

## 3.2.0

### Minor Changes

- Add `$identity: ":index"` for Nd matrices and Map-based smart-key lookup
  in the patcher.

  **Changes:**
  - **D-034 — `POSITIONAL_IDENTITY` (`":index"`)**: reserved identity
    value for arrays where the index IS the identity (Nd matrices,
    grids, boards). When an array-diff carries `$identity: ":index"`,
    the patcher routes nested-update sibling keys as numeric indices
    (`result[Number(key)]`) instead of by smart-key lookup. Recursion
    is genuine — Nd matrices nest by repeating the marker. Non-integer,
    negative, fractional or out-of-range sibling keys degrade as
    smart-key-miss (silent skip in normal, `KEY_NOT_FOUND` in strict).
    `$assertCollection` is silenced in positional mode (a matrix is not
    a homogeneous-identity collection). Positional `$ops` operate
    unchanged. Scope: patcher only — `diffJson` does not auto-detect
    matrices (emitters like StateMatrix declare in the wire).
  - **D-035 — Map-based smart-key lookup**: 3 hot paths in
    `applyArrayOps` that did linear `indexOfSmartKey` scans (smart-key
    move partition, Phase 1 remove resolution, Phase 4 nested updates)
    now use a precomputed `Map<smartKey, index>`. Reduces lookup
    complexity from O(N·M) to O(N+M). Empirical impact on total apply
    time is ~3–4× (lookup was ~5% of total work; the rest is `patchJson`
    recursion). Universal — every smart-key user benefits, not just
    `:index`. Strict mode has **zero overhead** on the happy path.
  - **Wire format extended**: `$identity` accepts the reserved value
    `":index"`. Existing diffs continue to apply correctly.

  **API additions:**
  - `POSITIONAL_IDENTITY` constant exported from `json-myers` and
    `json-myers/patch` (value: `":index"`).

  **Conformance:** new rule **R11** (matrix-positional) with 10 cases
  (12 tests including strict double-mode). Total: **107/107** merge
  cases passing (was 95/95).

  **Tests:** 483/483 passing (was 471/471) — 12 new conformance + 21
  new unit tests covering 2D/3D cell edit, edge cases (NaN, negatives,
  fractional indices, out-of-range), composition with `$ops` and
  smart-key objects, `$assertCollection` silenced, regression guard
  for smart-key default path.

  **Bench:** new patch-side bench in `packages/json-myers-bench`
  (`pnpm bench:patch`). See
  `packages/json-myers-bench/results/PATCH-RESULTS.md` for empirical
  validation of D-034 and D-035 across 11 scenarios.

  **Docs updated:** README, ARCHITECTURE, and DECISIONS (D-034, D-035,
  O-009, O-010) reflect the new identity mode, the algorithmic
  optimization, and honest empirical numbers.

## 3.1.0

### Minor Changes

- e5fd38c: Diff generation now emits `move` ops for smart-key reorders (O-001
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

## 3.0.0

### Major Changes

- New oficial version 3.0
