# json-myers

<p align="center">
  <img src="./old/public/jason-myers.png" alt="JSON Myers" width="600">
</p>

<p align="center">
  <strong>JSON diff/patch with identity-aware semantics — Myers algorithm at its core.</strong>
</p>

This repository is a monorepo housing the active package and the legacy v2
implementation kept around for reference.

## Layout

```
.
├── packages/
│   └── json-myers/        json-myers — v3 (current)
└── old/                   v2 — archived, kept for history and reference
```

## Active package — `json-myers` (v3)

Clean-room rewrite living in [`packages/json-myers/`](./packages/json-myers/).
Built against an executable conformance suite, equivalent to
`git diff --diff-algorithm=myers` on edit distance.

Highlights:

- **Fingerprint-based identity** — every item maps to a stable label
  (`p:<tag>:<value>` for primitives, `#<key>` for objects with declared
  identity, `h:<hash>` for content-addressable structurals)
- **Wire format v3** — `$ops`, `$identity`, `$assertCollection`, `$remove`
- **Strict mode** — divergences between patch and base raise typed errors
- **Two entry points** — full (~9.5 KB ESM) and `/patch` (~4.9 KB) for
  runtimes that only apply diffs

See [`packages/json-myers/README.md`](./packages/json-myers/README.md) for
the full pitch, API, and decisions log.

## Legacy — `old/` (v2)

The v2 implementation that shipped to npm as `json-myers@2.0.0`. Kept
intact under [`old/`](./old/) — source, tests, docs, conformance suites.
Not built or tested by the monorepo scripts.

## Monorepo scripts

```bash
# Install everything
pnpm install

# Build the active package
pnpm build

# Test (runs vitest in each workspace)
pnpm test

# Typecheck across the workspace
pnpm typecheck

# Lint / format
pnpm lint
pnpm format
```

All `pnpm <task>` scripts in the root delegate to `packages/json-myers`
via `pnpm --recursive --filter`.

## License

MIT © Anderson D. Rosa
