/**
 * Conformance runner — exercises every case in
 * `docs/conformance/json-merge-conformance.json` against `patchJson`.
 *
 * Three classes of case:
 *
 * - `expected` — apply patch in normal mode, assert deep equality
 *   against `expected`.
 * - `throws` — apply patch in normal mode, assert it raised the listed
 *   error code (R6: `OPS_BASE_NOT_ARRAY`).
 * - `strict_throws` — apply patch in BOTH modes:
 *     (1) normal mode returns `expected` (silent-ignore behavior);
 *     (2) strict mode raises `StrictViolationError` with the listed
 *         code.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  patchJson,
  isOpsBaseNotArrayError,
  isStrictViolationError,
  isCollectionAssertionError,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const conformancePath = resolve(
  here,
  "../conformance/json-merge-conformance.json",
);

interface ConformanceCase {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly base: unknown;
  readonly patch: unknown;
  readonly expected?: unknown;
  readonly throws?: string;
  readonly strict_throws?: string;
  readonly collection_throws?: string;
}

interface Conformance {
  readonly cases: readonly ConformanceCase[];
}

const conformance: Conformance = JSON.parse(
  readFileSync(conformancePath, "utf8"),
);

// Group cases by category so the test report mirrors the conformance shape.
const byCategory = new Map<string, ConformanceCase[]>();
for (const c of conformance.cases) {
  const bucket = byCategory.get(c.category) ?? [];
  bucket.push(c);
  byCategory.set(c.category, bucket);
}

for (const [category, cases] of byCategory) {
  describe(`conformance / ${category}`, () => {
    for (const c of cases) {
      // R6 — `throws` cases (independent of mode).
      if (c.throws) {
        it(`${c.id} — ${c.description}`, () => {
          let caught: unknown;
          try {
            patchJson(c.base, c.patch);
          } catch (err) {
            caught = err;
          }
          expect(caught).toBeDefined();
          if (c.throws === "OPS_BASE_NOT_ARRAY") {
            expect(isOpsBaseNotArrayError(caught)).toBe(true);
          }
        });
        continue;
      }

      // R10 — `collection_throws` cases (independent of mode; always thrown).
      if (c.collection_throws) {
        it(`${c.id} — ${c.description}`, () => {
          let caught: unknown;
          try {
            patchJson(c.base, c.patch);
          } catch (err) {
            caught = err;
          }
          expect(caught).toBeDefined();
          expect(isCollectionAssertionError(caught)).toBe(true);
          if (isCollectionAssertionError(caught)) {
            expect(caught.code).toBe(c.collection_throws);
          }
        });
        continue;
      }

      // Normal mode — must equal `expected`.
      it(`${c.id} [normal] — ${c.description}`, () => {
        const result = patchJson(c.base, c.patch);
        expect(result).toEqual(c.expected);
      });

      // Strict mode — when `strict_throws` is declared, must throw
      // with the documented code.
      if (c.strict_throws) {
        it(`${c.id} [strict] — must throw ${c.strict_throws}`, () => {
          let caught: unknown;
          try {
            patchJson(c.base, c.patch, { strict: true });
          } catch (err) {
            caught = err;
          }
          expect(caught).toBeDefined();
          expect(isStrictViolationError(caught)).toBe(true);
          if (isStrictViolationError(caught)) {
            expect(caught.code).toBe(c.strict_throws);
          }
        });
      }
    }
  });
}
