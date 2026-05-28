/**
 * Inspect — dumps the actual diff produced by each lib on a single
 * scenario, side-by-side. Used to verify the empirical claim that
 * myers and jsondiffpatch emit the same NUMBER of operations (LCS
 * equivalence) — and that the size difference is purely wire format.
 *
 * Run: pnpm tsx src/inspect.ts <scenarioId>
 *      defaults to "01-array-reverse-100"
 */

import { SCENARIOS } from "./fixtures/scenarios.ts";
import { ADAPTERS } from "./adapters/index.ts";

const scenarioId = process.argv[2] ?? "01-array-reverse-100";
const scenario = SCENARIOS.find((s) => s.id === scenarioId);
if (!scenario) {
  process.stderr.write(`Unknown scenario: ${scenarioId}\n`);
  process.exit(1);
}

const { a, b } = scenario.build();
const ctx = scenario.identity ? { identity: scenario.identity } : undefined;

process.stdout.write(`=== ${scenario.id} — ${scenario.title} ===\n\n`);

function countOps(diff: unknown): number {
  if (!diff || typeof diff !== "object") return 0;

  // myers: $ops array
  if ("$ops" in diff && Array.isArray((diff as { $ops: unknown[] }).$ops)) {
    return (diff as { $ops: unknown[] }).$ops.length;
  }

  // RFC 6902: array of {op: ..., path: ...}
  if (Array.isArray(diff)) {
    return diff.length;
  }

  // jsondiffpatch: object with _t: "a" + numeric keys (delta format)
  if ((diff as { _t?: string })._t === "a") {
    const obj = diff as Record<string, unknown>;
    // Count entries excluding _t marker.
    return Object.keys(obj).filter((k) => k !== "_t").length;
  }

  // Fallback — count top-level keys minus marker.
  const obj = diff as Record<string, unknown>;
  return Object.keys(obj).length;
}

function previewDiff(diff: unknown, maxChars = 250): string {
  const s = JSON.stringify(diff);
  if (!s) return "(empty)";
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "…";
}

for (const adapter of ADAPTERS) {
  if (adapter.name === "myers-refcache") continue; // duplicate output
  try {
    const diff = adapter.generate(a, b, ctx);
    const bytes = Buffer.byteLength(JSON.stringify(diff) ?? "");
    const opCount = countOps(diff);
    process.stdout.write(`── ${adapter.label}\n`);
    process.stdout.write(`   ops:    ${opCount}\n`);
    process.stdout.write(`   bytes:  ${bytes}\n`);
    process.stdout.write(
      `   bytes/op: ${(bytes / Math.max(opCount, 1)).toFixed(1)}\n`,
    );
    process.stdout.write(`   preview: ${previewDiff(diff)}\n\n`);
  } catch (err) {
    process.stdout.write(`── ${adapter.label} — FAILED\n`);
    process.stdout.write(
      `   error: ${err instanceof Error ? err.message : String(err)}\n\n`,
    );
  }
}
