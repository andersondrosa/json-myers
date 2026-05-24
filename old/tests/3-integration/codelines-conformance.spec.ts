import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  diffJson,
  patchJson,
  myersDiff,
  convertJsonMyersToGitDiff,
} from "../../src";

type CodelinesCase = {
  id: string;
  description: string;
  before: string[];
  after: string[];
  git: { removes: number; adds: number; hunks: number };
};

const suite = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../docs/json-codelines-conformance.json"),
    "utf-8",
  ),
);

const cases: CodelinesCase[] = suite.cases;
const RUNS = suite.spec?.runner_protocol?.default_runs ?? 5;

describe("Codelines conformance: json-codelines-conformance.json", () => {
  for (const c of cases) {
    describe(`[${c.id}] ${c.description}`, () => {
      it(`RD1 — diffJson stable across ${RUNS} runs`, () => {
        const samples = Array.from({ length: RUNS }, () =>
          JSON.stringify(diffJson(c.before, c.after)),
        );
        expect(new Set(samples).size).toBe(1);
      });

      it("RD2 — forward round-trip (before + diff = after)", () => {
        const diff = diffJson(c.before, c.after);
        expect(patchJson(c.before, diff)).toEqual(c.after);
      });

      it("RD3 — backward round-trip (after + reverse-diff = before)", () => {
        const reverse = diffJson(c.after, c.before);
        expect(patchJson(c.after, reverse)).toEqual(c.before);
      });

      it("RC1 — raw Myers op count matches git's add+remove total", () => {
        const rawOps = myersDiff(c.before, c.after);
        const myersAdds = rawOps.filter((op) => op.type === "add").length;
        const myersRemoves = rawOps.filter((op) => op.type === "remove").length;
        const myersTotal = myersAdds + myersRemoves;
        const gitTotal = c.git.adds + c.git.removes;
        expect(myersTotal).toBe(gitTotal);
        // Cada lado também deve bater (ambos algoritmos são determinísticos)
        expect(myersAdds).toBe(c.git.adds);
        expect(myersRemoves).toBe(c.git.removes);
      });

      it("RC2 — convertJsonMyersToGitDiff yields a valid unified-diff structure", () => {
        // Usa raw Myers (sem moves) porque convertJsonMyersToGitDiff só suporta add/remove
        const rawOps = myersDiff(c.before, c.after);
        const unified = convertJsonMyersToGitDiff(
          c.before,
          rawOps as any,
          `${c.id}.ts`,
        );

        // Header presente
        expect(unified).toContain(`diff --git a/${c.id}.ts b/${c.id}.ts`);
        expect(unified).toContain(`--- a/${c.id}.ts`);
        expect(unified).toContain(`+++ b/${c.id}.ts`);
        // Pelo menos um hunk header
        expect(unified).toMatch(/^@@ /m);
        // Contém linhas +/- consistentes com a contagem de ops
        const plusLines = (unified.match(/^\+[^+]/gm) || []).length;
        const minusLines = (unified.match(/^-[^-]/gm) || []).length;
        expect(plusLines).toBe(c.git.adds);
        expect(minusLines).toBe(c.git.removes);
      });
    });
  }
});
