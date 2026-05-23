import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { patchJson } from "../../src";

type ConformanceCase = {
  id: string;
  category: string;
  description: string;
  base: any;
  patch: any;
  expected?: any;
  throws?: boolean;
};

const suite = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../docs/json-merge-conformance.json"),
    "utf-8",
  ),
);

const cases: ConformanceCase[] = suite.cases;

describe("Conformance: json-merge-conformance.json", () => {
  for (const c of cases) {
    it(`[${c.id}] ${c.description}`, () => {
      if (c.throws) {
        expect(() => patchJson(c.base, c.patch)).toThrow();
      } else {
        const result = patchJson(c.base, c.patch);
        expect(result).toEqual(c.expected);
      }
    });
  }
});
