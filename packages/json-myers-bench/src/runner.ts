import { Bench } from "tinybench";
import { ADAPTERS } from "./adapters/index.ts";
import { SCENARIOS, type Scenario } from "./fixtures/scenarios.ts";

export type AdapterRun = {
  name: string;
  label: string;
  ok: boolean;
  /** Semantic op count — not a size metric. Lets us prove
   * algorithmic equivalence (myers vs LCS produce the same number of
   * ops). Wire serialization (bytes) is intentionally NOT measured:
   * the bench focuses on generation performance, not output size. */
  opsCount: number | null;
  diff: unknown;
  meanMs: number | null;
  medianMs: number | null;
  hz: number | null;
  samples: number;
  error: string | null;
};

export type ScenarioResult = {
  id: string;
  title: string;
  category: string;
  runs: AdapterRun[];
};

/**
 * Count semantic operations in a diff — gives a fair "algorithmic
 * comparison" across wire formats. The bytes difference between libs
 * with the same opsCount is purely representational (wire format).
 */
function countOps(diff: unknown): number {
  if (!diff || typeof diff !== "object") return 0;

  // myers wire — $ops array
  if ("$ops" in diff && Array.isArray((diff as { $ops: unknown[] }).$ops)) {
    return (diff as { $ops: unknown[] }).$ops.length;
  }

  // RFC 6902 — array of {op, path}
  if (Array.isArray(diff)) return diff.length;

  // jsondiffpatch — { _t: "a", _0: ..., 1: ..., ... }
  if ((diff as { _t?: string })._t === "a") {
    const keys = Object.keys(diff as Record<string, unknown>);
    return keys.filter((k) => k !== "_t").length;
  }

  // Fallback — top-level keys (object diff).
  return Object.keys(diff as Record<string, unknown>).length;
}

// Per-adapter probe budget — if a single generate() call takes longer
// than this, skip benching to avoid spawning 5+ heavy iterations and
// blowing memory on pathological inputs (e.g. RFC 6902 doing LCS over
// 2k items).
const PROBE_TIMEOUT_MS = 1500;

declare const globalThis: { gc?: () => void };

async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  const { a, b } = scenario.build();

  const runs: AdapterRun[] = [];

  for (const adapter of ADAPTERS) {
    // Encourage GC before each adapter to keep readings comparable and
    // memory bounded. Best-effort — only works when node is run with
    // --expose-gc.
    globalThis.gc?.();

    // Announce BEFORE the probe so if the adapter crashes (OOM,
    // hang) the operator can see which one was the culprit.
    process.stdout.write(`   …  ${adapter.name.padEnd(20)} probing\r`);

    let ok = false;
    let diff: unknown = undefined;
    let opsCount: number | null = null;
    let error: string | null = null;
    let probeMs = 0;

    const ctx = scenario.identity ? { identity: scenario.identity } : undefined;

    try {
      const t0 = performance.now();
      diff = adapter.generate(a, b, ctx);
      probeMs = performance.now() - t0;
      // Only `opsCount` is computed from the diff — it's a semantic
      // count, not a size metric. We deliberately don't measure
      // `JSON.stringify(diff).length` or gzip size: those would be
      // serialization metrics, not generation performance. The bench
      // is exclusively about how fast each lib produces the diff
      // in-memory.
      opsCount = countOps(diff);
      ok = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    if (!ok) {
      runs.push({
        name: adapter.name,
        label: adapter.label,
        ok: false,
        opsCount: null,
        diff: undefined,
        meanMs: null,
        medianMs: null,
        hz: null,
        samples: 0,
        error,
      });
      continue;
    }

    // Skip bench loop for slow adapters — record the probe as the
    // single sample. Keeps memory bounded and avoids freezing on
    // pathological inputs.
    if (probeMs > PROBE_TIMEOUT_MS) {
      runs.push({
        name: adapter.name,
        label: adapter.label,
        ok: true,
        opsCount,
        diff: undefined,
        meanMs: probeMs,
        medianMs: probeMs,
        hz: 1000 / probeMs,
        samples: 1,
        error: `slow (>${PROBE_TIMEOUT_MS}ms) — single-sample only`,
      });
      continue;
    }

    const bench = new Bench({
      time: 100,
      iterations: 3,
      warmupTime: 30,
      warmupIterations: 1,
    });

    bench.add(adapter.name, () => {
      adapter.generate(a, b, ctx);
    });

    await bench.run();
    const task = bench.tasks[0];
    const result = task.result;

    runs.push({
      name: adapter.name,
      label: adapter.label,
      ok: true,
      opsCount,
      diff: undefined, // keep memory bounded — diff payload not needed in results
      meanMs: result?.latency.mean ?? null,
      medianMs: result?.latency.p50 ?? null,
      hz: result?.throughput.mean ?? null,
      samples: result?.latency.samples.length ?? 0,
      error: null,
    });
  }

  return {
    id: scenario.id,
    title: scenario.title,
    category: scenario.category,
    runs,
  };
}

export async function runAll(
  onScenarioDone?: (acc: ScenarioResult[]) => void,
): Promise<ScenarioResult[]> {
  const out: ScenarioResult[] = [];
  for (const s of SCENARIOS) {
    process.stdout.write(`▶  ${s.id}  ${s.title}\n`);
    const r = await runScenario(s);
    out.push(r);
    for (const run of r.runs) {
      const flag = run.ok ? "✓" : "✗";
      const ops =
        run.opsCount !== null
          ? `${run.opsCount.toString().padStart(6)} ops`
          : "    (failed)";
      const ms =
        run.medianMs !== null
          ? `${run.medianMs.toFixed(3).padStart(10)} ms`
          : "          —";
      // Overwrite the "probing" line and emit the final result.
      process.stdout.write(
        `   ${flag} ${run.name.padEnd(20)} ${ops}   ${ms}\n`,
      );
    }
    // Persist partial results so a crash mid-run preserves progress.
    onScenarioDone?.(out);
  }
  return out;
}
