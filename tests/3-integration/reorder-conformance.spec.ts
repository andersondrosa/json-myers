import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { diffJson, patchJson } from "../../src";

type ReorderCase = {
  id: string;
  category: string;
  description: string;
  base: any;
  modified: any;
};

const suite = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../docs/json-reorder-conformance.json"),
    "utf-8",
  ),
);

const cases: ReorderCase[] = suite.cases;
const RUNS = suite.spec?.runner_protocol?.default_runs ?? 5;

describe("Reorder conformance: json-reorder-conformance.json", () => {
  for (const c of cases) {
    describe(`[${c.id}] ${c.description}`, () => {
      it(`RD1 — diffJson(base, modified) is stable across ${RUNS} runs`, () => {
        const samples = Array.from({ length: RUNS }, () =>
          JSON.stringify(diffJson(c.base, c.modified)),
        );
        const unique = new Set(samples);
        expect(unique.size).toBe(1);
      });

      it("RD2 — patchJson(base, diff) === modified (forward)", () => {
        const diff = diffJson(c.base, c.modified);
        const result = patchJson(c.base, diff);
        expect(result).toEqual(c.modified);
      });

      it(`RD4 — diffJson(modified, base) is stable across ${RUNS} runs`, () => {
        const samples = Array.from({ length: RUNS }, () =>
          JSON.stringify(diffJson(c.modified, c.base)),
        );
        const unique = new Set(samples);
        expect(unique.size).toBe(1);
      });

      it("RD3 — patchJson(modified, reverse-diff) === base (backward)", () => {
        const reverse = diffJson(c.modified, c.base);
        const result = patchJson(c.modified, reverse);
        expect(result).toEqual(c.base);
      });
    });
  }
});
