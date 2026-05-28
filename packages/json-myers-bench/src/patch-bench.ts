/**
 * Patch-side bench — measures `patchJson` application performance in
 * isolation (no cross-lib comparison).
 *
 * Targets two optimizations introduced in v3.x:
 *
 *   - D-034 — `$identity: ":index"` recursive positional mode for Nd
 *     matrices. Demonstrates that apply cost is a function of nesting
 *     DEPTH, not matrix size (single cell-edit in a 1000x1000 matrix
 *     should be roughly as fast as in a 10x10).
 *
 *   - D-035 — Map-based smart-key lookup. Demonstrates the
 *     O(N·M) → O(N+M) reduction in Phase 4 nested updates by scaling
 *     both array size and the number of simultaneous nested updates.
 *
 * Each scenario builds a (base, diff) pair ONCE, validates the patch
 * via a tiny `deepEqual` (so we don't silently bench a broken patch),
 * then runs tinybench over `patchJson(base, diff, options)`. The base
 * is reused across iterations safely because `patchJson` is pure (R3
 * — no mutation of inputs).
 *
 * Output: `results/PATCH-RESULTS.md` grouped by category, with median
 * latency + throughput (hz). No `opsCount` (irrelevant for apply).
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Bench } from "tinybench";
import {
  patchJson,
  diffJson,
  POSITIONAL_IDENTITY,
  type OpsDiff,
  type PatchOptions,
} from "json-myers";
import { makeUsers, clone } from "./fixtures/generators.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "..", "results");

declare const globalThis: { gc?: () => void };

// ── deepEqual (tiny, only used for sanity check before benching) ─────

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!(k in bObj)) return false;
    if (!deepEqual(aObj[k], bObj[k])) return false;
  }
  return true;
}

// ── Builders for matrix fixtures ─────────────────────────────────────

function buildMatrix2D(n: number): number[][] {
  const m: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(n);
    for (let j = 0; j < n; j++) row[j] = i * n + j;
    m[i] = row;
  }
  return m;
}

function buildMatrix3D(n: number): number[][][] {
  const m: number[][][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const slab: number[][] = new Array(n);
    for (let j = 0; j < n; j++) {
      const row = new Array<number>(n);
      for (let k = 0; k < n; k++) row[k] = i * n * n + j * n + k;
      slab[j] = row;
    }
    m[i] = slab;
  }
  return m;
}

/**
 * Compute the expected matrix after editing `m[i][j]` to `value`.
 * Doesn't mutate `m`; returns a shallow-cloned version with the
 * target row replaced (cheap: avoids cloning the whole matrix).
 */
function expectMatrix2DCellEdit(
  m: number[][],
  i: number,
  j: number,
  value: number,
): number[][] {
  const out = m.slice();
  const row = out[i].slice();
  row[j] = value;
  out[i] = row;
  return out;
}

// ── Scenario shape ───────────────────────────────────────────────────

interface PatchScenario {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  /** Builds the (base, diff, options?, expected) for this scenario. */
  readonly build: () => {
    base: unknown;
    diff: unknown;
    options?: PatchOptions;
    expected: unknown;
  };
}

interface PatchRun {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly medianMs: number;
  readonly hz: number;
  readonly samples: number;
}

// ── Scenarios ────────────────────────────────────────────────────────

const SCENARIOS: PatchScenario[] = [
  // ── D-034 — :index cell-edit, scaling array size ──────────────────
  {
    id: "matrix-2d-cell-10x10",
    title: "Matrix 2D 10×10 — edit 1 cell",
    category: ":index cell-edit (D-034)",
    build: () => {
      const base = buildMatrix2D(10);
      const diff: OpsDiff = {
        $ops: [],
        $identity: POSITIONAL_IDENTITY,
        "5": {
          $ops: [],
          $identity: POSITIONAL_IDENTITY,
          "5": 999,
        },
      };
      const expected = expectMatrix2DCellEdit(base, 5, 5, 999);
      return { base, diff, expected };
    },
  },
  {
    id: "matrix-2d-cell-100x100",
    title: "Matrix 2D 100×100 — edit 1 cell",
    category: ":index cell-edit (D-034)",
    build: () => {
      const base = buildMatrix2D(100);
      const diff: OpsDiff = {
        $ops: [],
        $identity: POSITIONAL_IDENTITY,
        "50": {
          $ops: [],
          $identity: POSITIONAL_IDENTITY,
          "50": 999,
        },
      };
      const expected = expectMatrix2DCellEdit(base, 50, 50, 999);
      return { base, diff, expected };
    },
  },
  {
    id: "matrix-2d-cell-1000x1000",
    title: "Matrix 2D 1000×1000 — edit 1 cell",
    category: ":index cell-edit (D-034)",
    build: () => {
      const base = buildMatrix2D(1000);
      const diff: OpsDiff = {
        $ops: [],
        $identity: POSITIONAL_IDENTITY,
        "500": {
          $ops: [],
          $identity: POSITIONAL_IDENTITY,
          "500": 999,
        },
      };
      const expected = expectMatrix2DCellEdit(base, 500, 500, 999);
      return { base, diff, expected };
    },
  },
  {
    id: "matrix-3d-cube-50x50x50",
    title: "Matrix 3D 50×50×50 — edit 1 cell (Nd recursion)",
    category: ":index cell-edit (D-034)",
    build: () => {
      const base = buildMatrix3D(50);
      const diff: OpsDiff = {
        $ops: [],
        $identity: POSITIONAL_IDENTITY,
        "25": {
          $ops: [],
          $identity: POSITIONAL_IDENTITY,
          "25": {
            $ops: [],
            $identity: POSITIONAL_IDENTITY,
            "25": 999,
          },
        },
      };
      // Build expected with shallow clones along the edited path.
      const out = base.slice();
      const slab = out[25].slice();
      const row = slab[25].slice();
      row[25] = 999;
      slab[25] = row;
      out[25] = slab;
      return { base, diff, expected: out };
    },
  },
  {
    id: "matrix-2d-100x100-edit-100-cells",
    title: "Matrix 2D 100×100 — edit 100 cells (1% density)",
    category: ":index cell-edit (D-034)",
    build: () => {
      const n = 100;
      const base = buildMatrix2D(n);

      // Edit one cell per row across the diagonal — 100 cell edits.
      const diff: Record<string, unknown> = {
        $ops: [],
        $identity: POSITIONAL_IDENTITY,
      };
      for (let i = 0; i < n; i++) {
        diff[String(i)] = {
          $ops: [],
          $identity: POSITIONAL_IDENTITY,
          [String(i)]: 999,
        };
      }

      // Expected — diagonal replaced with 999.
      const expected = base.map((row, i) => {
        const r = row.slice();
        r[i] = 999;
        return r;
      });

      return { base, diff: diff as unknown as OpsDiff, expected };
    },
  },

  // ── D-035 — Map-based lookup, smart-key nested updates ────────────
  {
    id: "smart-key-100x10",
    title: "Smart-key — 100 users, 10 nested updates",
    category: "Map lookup (D-035)",
    build: () => {
      const base = makeUsers(101, 100);

      const diff: Record<string, unknown> = { $ops: [] };
      const expected = clone(base);
      for (let i = 0; i < 10; i++) {
        const idx = i * 10;
        const id = base[idx].id;
        diff[id] = { role: "admin" };
        expected[idx].role = "admin";
      }
      return { base, diff: diff as unknown as OpsDiff, expected };
    },
  },
  {
    id: "smart-key-1000x50",
    title: "Smart-key — 1.000 users, 50 nested updates",
    category: "Map lookup (D-035)",
    build: () => {
      const base = makeUsers(102, 1000);

      const diff: Record<string, unknown> = { $ops: [] };
      const expected = clone(base);
      for (let i = 0; i < 50; i++) {
        const idx = i * 20;
        const id = base[idx].id;
        diff[id] = { role: "admin" };
        expected[idx].role = "admin";
      }
      return { base, diff: diff as unknown as OpsDiff, expected };
    },
  },
  {
    id: "smart-key-10000x100",
    title: "Smart-key — 10.000 users, 100 nested updates",
    category: "Map lookup (D-035)",
    build: () => {
      const base = makeUsers(103, 10000);

      const diff: Record<string, unknown> = { $ops: [] };
      const expected = clone(base);
      for (let i = 0; i < 100; i++) {
        const idx = i * 100;
        const id = base[idx].id;
        diff[id] = { role: "admin" };
        expected[idx].role = "admin";
      }
      return { base, diff: diff as unknown as OpsDiff, expected };
    },
  },

  // ── Modes (overhead bench) ────────────────────────────────────────
  {
    id: "strict-1000x50",
    title: "Strict mode — 1.000 users, 50 nested updates",
    category: "Mode overheads",
    build: () => {
      const base = makeUsers(104, 1000);

      const diff: Record<string, unknown> = { $ops: [] };
      const expected = clone(base);
      for (let i = 0; i < 50; i++) {
        const idx = i * 20;
        const id = base[idx].id;
        diff[id] = { role: "admin" };
        expected[idx].role = "admin";
      }
      return {
        base,
        diff: diff as unknown as OpsDiff,
        options: { strict: true },
        expected,
      };
    },
  },
  {
    id: "assert-collection-1000",
    title: "$assertCollection — 1.000-item collection validation",
    category: "Mode overheads",
    build: () => {
      const base = makeUsers(105, 1000);

      // Single nested update with collection assertion enabled —
      // measures the per-call validation pass + the lookup.
      const diff: OpsDiff = {
        $ops: [],
        $assertCollection: true,
        [base[500].id]: { role: "admin" },
      };
      const expected = clone(base);
      expected[500].role = "admin";
      return { base, diff, expected };
    },
  },

  // ── Composition realista ──────────────────────────────────────────
  {
    id: "multi-level-reorder-deep-change",
    title: "Multi-level reorder + deep change (cenário 15 reaproveitado)",
    category: "Realistic composition",
    build: () => {
      const a = {
        users: [
          {
            id: "alice",
            name: "Alice",
            childs: [
              { id: "c1", name: "Bob" },
              { id: "c2", name: "Carol" },
            ],
          },
          { id: "dave", name: "Dave", childs: [{ id: "c3", name: "Eve" }] },
          {
            id: "frank",
            name: "Frank",
            childs: [
              { id: "c5", name: "Gina" },
              { id: "c6", name: "Hugo" },
            ],
          },
        ],
      };
      const b = {
        users: [
          {
            id: "frank",
            name: "Frank",
            childs: [
              { id: "c6", name: "Hugo" },
              { id: "c5", name: "Gina" },
            ],
          },
          {
            id: "alice",
            name: "Alice",
            childs: [
              { id: "c2", name: "Carol" },
              { id: "c1", name: "Bob CHANGED" },
            ],
          },
          { id: "dave", name: "Dave", childs: [{ id: "c3", name: "Eve" }] },
        ],
      };
      // Pre-compute the diff once — not measured.
      const diff = diffJson(a, b);
      return { base: a, diff, expected: b };
    },
  },
];

// ── Runner ───────────────────────────────────────────────────────────

async function runOne(scenario: PatchScenario): Promise<PatchRun> {
  const { base, diff, options, expected } = scenario.build();

  // Sanity check — bench measures nothing useful if the patch is wrong.
  const result = patchJson(base, diff, options);
  if (!deepEqual(result, expected)) {
    throw new Error(
      `Scenario "${scenario.id}" produced wrong result — bench aborted.`,
    );
  }

  globalThis.gc?.();

  const bench = new Bench({
    time: 200,
    iterations: 5,
    warmupTime: 50,
    warmupIterations: 2,
  });

  bench.add(scenario.id, () => {
    patchJson(base, diff, options);
  });

  await bench.run();
  const task = bench.tasks[0];
  const r = task.result;

  return {
    id: scenario.id,
    title: scenario.title,
    category: scenario.category,
    medianMs: r?.latency.p50 ?? NaN,
    hz: r?.throughput.mean ?? NaN,
    samples: r?.latency.samples.length ?? 0,
  };
}

// ── Markdown rendering ───────────────────────────────────────────────

function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  if (ms < 0.001) return `${(ms * 1_000_000).toFixed(0)} ns`;
  if (ms < 1) return `${(ms * 1000).toFixed(2)} µs`;
  return `${ms.toFixed(3)} ms`;
}

function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) return "—";
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(2)}M / s`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(2)}k / s`;
  return `${hz.toFixed(0)} / s`;
}

function renderMarkdown(runs: PatchRun[]): string {
  const byCategory = new Map<string, PatchRun[]>();
  for (const r of runs) {
    const bucket = byCategory.get(r.category) ?? [];
    bucket.push(r);
    byCategory.set(r.category, bucket);
  }

  const lines: string[] = [];
  lines.push("# json-myers — patch bench");
  lines.push("");
  lines.push(
    "Aplicação isolada de `patchJson`. Sem comparação cross-lib — mede só a performance do próprio `json-myers` aplicando diffs pré-construídos.",
  );
  lines.push("");
  lines.push(
    "Cada cenário valida `patchJson(base, diff, options) === expected` antes de medir. Bench via tinybench (mediana de p50).",
  );
  lines.push("");
  lines.push(`Total de cenários: **${runs.length}**.`);
  lines.push("");

  for (const [category, list] of byCategory) {
    lines.push(`## ${category}`);
    lines.push("");
    lines.push("| Cenário | Mediana | Throughput | Samples |");
    lines.push("|---|---|---|---|");
    for (const r of list) {
      lines.push(
        `| ${r.title} | ${formatMs(r.medianMs)} | ${formatHz(r.hz)} | ${r.samples} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderJson(runs: PatchRun[]): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runs,
    },
    null,
    2,
  );
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  process.stdout.write("Patch-side bench — patchJson em isolamento\n");
  process.stdout.write("==========================================\n\n");

  const persist = (acc: PatchRun[]) => {
    writeFileSync(join(RESULTS_DIR, "patch-results.json"), renderJson(acc));
    writeFileSync(join(RESULTS_DIR, "PATCH-RESULTS.md"), renderMarkdown(acc));
  };

  const out: PatchRun[] = [];
  for (const s of SCENARIOS) {
    process.stdout.write(`▶  ${s.id}  ${s.title}\n`);
    const run = await runOne(s);
    out.push(run);
    process.stdout.write(
      `   ✓ ${formatMs(run.medianMs).padStart(10)}   ${formatHz(run.hz).padStart(14)}   (${run.samples} samples)\n`,
    );
    persist(out);
  }

  process.stdout.write(`\nResultados salvos em:\n`);
  process.stdout.write(`  ${join(RESULTS_DIR, "PATCH-RESULTS.md")}\n`);
  process.stdout.write(`  ${join(RESULTS_DIR, "patch-results.json")}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
