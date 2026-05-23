/**
 * Reorder conformance runner — validates `diffJson` against
 * `conformance/json-reorder-conformance.json`.
 *
 * Each case `(base, modified)` is exercised through 4 invariants:
 *
 *   RD1 — Stability:    `diffJson(base, modified)` in N consecutive
 *                       runs produces bit-identical output.
 *   RD2 — Forward:      `patchJson(base, diffJson(base, modified))` === modified.
 *   RD3 — Backward:     `patchJson(modified, diffJson(modified, base))` === base.
 *   RD4 — Reverse stab: `diffJson(modified, base)` is also stable across N runs.
 *
 * No canonical-value comparison — we don't fix the diff format,
 * only the invariants. Implementations may emit different (equally
 * valid) diffs and still pass.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { diffJson } from "../src/diffJson.js";
import { patchJson } from "../src/patch.js";

const here = dirname(fileURLToPath(import.meta.url));
const conformancePath = resolve(
  here,
  "../conformance/json-reorder-conformance.json",
);

interface ReorderCase {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly base: unknown;
  readonly modified: unknown;
}

interface ReorderConformance {
  readonly cases: readonly ReorderCase[];
}

const conformance: ReorderConformance = JSON.parse(
  readFileSync(conformancePath, "utf8"),
);

const RUNS = 5;

// Group by category — mirrors the conformance file shape.
const byCategory = new Map<string, ReorderCase[]>();
for (const c of conformance.cases) {
  const bucket = byCategory.get(c.category) ?? [];
  bucket.push(c);
  byCategory.set(c.category, bucket);
}

for (const [category, cases] of byCategory) {
  describe(`reorder conformance / ${category}`, () => {
    for (const c of cases) {
      // RD1 — Forward stability.
      it(`${c.id} [RD1 stability] — ${c.description}`, () => {
        const first = JSON.stringify(diffJson(c.base, c.modified));
        for (let i = 1; i < RUNS; i++) {
          const next = JSON.stringify(diffJson(c.base, c.modified));
          expect(next).toBe(first);
        }
      });

      // RD2 — Forward round-trip.
      it(`${c.id} [RD2 forward]`, () => {
        const diff = diffJson(c.base, c.modified);
        const applied = patchJson(c.base, diff);
        expect(applied).toEqual(c.modified);
      });

      // RD3 — Backward round-trip.
      it(`${c.id} [RD3 backward]`, () => {
        const reverseDiff = diffJson(c.modified, c.base);
        const applied = patchJson(c.modified, reverseDiff);
        expect(applied).toEqual(c.base);
      });

      // RD4 — Reverse stability.
      it(`${c.id} [RD4 reverse stability]`, () => {
        const first = JSON.stringify(diffJson(c.modified, c.base));
        for (let i = 1; i < RUNS; i++) {
          const next = JSON.stringify(diffJson(c.modified, c.base));
          expect(next).toBe(first);
        }
      });
    }
  });
}
