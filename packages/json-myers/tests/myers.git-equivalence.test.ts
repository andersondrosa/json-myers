/**
 * Empirical proof of equivalence with `git diff --diff-algorithm=myers`.
 *
 * Property: for any pair of line-arrays (A, B), our Myers implementation
 * must produce the SAME edit distance (D = del + ins) as `git diff`
 * configured to use the Myers algorithm.
 *
 * NOTE — We compare edit DISTANCE, not the exact form. Myers has
 * unique shortest distance D but can have multiple shortest paths
 * (e.g., `[A,B] → [B,A]` can be either `del A; ins A` or `del B; ins B`,
 * both D=2). Implementations may pick different paths and still both be
 * correct.
 *
 * We also reconstruct B from A via our edit script as a separate
 * correctness check.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { myers, type Edit } from "../src/myers.js";

// ── Helpers ───────────────────────────────────────────────────────

/** Stats from our own myers implementation. */
function ourStats(a: string[], b: string[]) {
  const edits = myers(a, b);
  return {
    edits,
    del: edits.filter((e) => e.type === "del").length,
    ins: edits.filter((e) => e.type === "ins").length,
  };
}

/** Apply edit script to A — must reconstruct B. */
function applyEdits<T>(a: readonly T[], edits: readonly Edit<T>[]): T[] {
  const out: T[] = [];
  let i = 0;
  for (const e of edits) {
    if (e.type === "keep") {
      out.push(a[i]!);
      i++;
    } else if (e.type === "del") {
      i++;
    } else {
      out.push(e.item);
    }
  }
  return out;
}

/**
 * Run `git diff --diff-algorithm=myers --no-index -U0 A B` on temp
 * files and count `-` / `+` lines.
 */
function gitDiffStats(aLines: string[], bLines: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "myers-proof-"));
  try {
    const fa = join(dir, "a.txt");
    const fb = join(dir, "b.txt");
    // Both files terminated with newline (git assumes line-terminated).
    writeFileSync(fa, aLines.map((l) => l + "\n").join(""));
    writeFileSync(fb, bLines.map((l) => l + "\n").join(""));

    let out: string;
    try {
      out = execSync(
        `git diff --diff-algorithm=myers --no-index -U0 -- "${fa}" "${fb}"`,
        { encoding: "utf8" },
      );
    } catch (err) {
      // `git diff --no-index` returns exit 1 when files differ.
      out = (err as { stdout: string }).stdout ?? "";
    }

    let del = 0;
    let ins = 0;
    for (const line of out.split("\n")) {
      if (line.startsWith("-") && !line.startsWith("---")) del++;
      else if (line.startsWith("+") && !line.startsWith("+++")) ins++;
    }
    return { del, ins };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Seeded PRNG for reproducible fuzzing — Mulberry32. */
function seedRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a random pair (A, B) with `mutations` random edits. */
function generatePair(
  seed: number,
  baseLines: number,
  mutations: number,
): { a: string[]; b: string[] } {
  const rng = seedRng(seed);
  const a = Array.from({ length: baseLines }, (_, i) => `line-${i}`);
  const b = [...a];
  for (let i = 0; i < mutations; i++) {
    const op = rng();
    const pos = Math.floor(rng() * Math.max(b.length, 1));
    if (op < 0.4 && b.length > 0) {
      // delete
      b.splice(pos, 1);
    } else if (op < 0.8) {
      // insert
      b.splice(pos, 0, `new-${seed}-${i}`);
    } else if (b.length > 0) {
      // substitute (del+ins)
      b.splice(pos, 1, `sub-${seed}-${i}`);
    }
  }
  return { a, b };
}

// ── Fixed scenarios ───────────────────────────────────────────────

interface Scenario {
  readonly name: string;
  readonly a: string[];
  readonly b: string[];
}

const fixedScenarios: Scenario[] = [
  { name: "identical 3 lines", a: ["a", "b", "c"], b: ["a", "b", "c"] },
  { name: "insert at start", a: ["b", "c"], b: ["a", "b", "c"] },
  { name: "insert at middle", a: ["a", "c"], b: ["a", "b", "c"] },
  { name: "insert at end", a: ["a", "b"], b: ["a", "b", "c"] },
  { name: "delete at start", a: ["a", "b", "c"], b: ["b", "c"] },
  { name: "delete at middle", a: ["a", "b", "c"], b: ["a", "c"] },
  { name: "delete at end", a: ["a", "b", "c"], b: ["a", "b"] },
  { name: "substitute middle", a: ["a", "b", "c"], b: ["a", "X", "c"] },
  {
    name: "two hunks separated by snake",
    a: ["a", "b", "c", "d", "e", "f", "g"],
    b: ["a", "B", "c", "d", "e", "F", "g"],
  },
  {
    name: "alternating change",
    a: ["a", "1", "b", "2", "c"],
    b: ["a", "X", "b", "Y", "c"],
  },
  {
    name: "Myers paper example (ABCABBA → CBABAC)",
    a: ["A", "B", "C", "A", "B", "B", "A"],
    b: ["C", "B", "A", "B", "A", "C"],
  },
  { name: "empty A", a: [], b: ["x", "y", "z"] },
  { name: "empty B", a: ["x", "y", "z"], b: [] },
  {
    name: "100 lines, 1 insert at 50",
    a: Array.from({ length: 100 }, (_, i) => `line-${i}`),
    b: [
      ...Array.from({ length: 50 }, (_, i) => `line-${i}`),
      "INSERTED",
      ...Array.from({ length: 50 }, (_, i) => `line-${50 + i}`),
    ],
  },
];

// ── Tests ─────────────────────────────────────────────────────────

describe("myers ≡ git diff --diff-algorithm=myers (edit distance)", () => {
  for (const s of fixedScenarios) {
    it(s.name, () => {
      const ours = ourStats(s.a, s.b);
      const theirs = gitDiffStats(s.a, s.b);

      // The shortest edit distance is unique — must match git's exactly.
      const ourD = ours.del + ours.ins;
      const theirD = theirs.del + theirs.ins;
      expect(ourD).toBe(theirD);

      // Component-wise also matches (modulo ambiguous ties — see note).
      // For Myers' canonical traversal, both implementations should
      // agree on (del, ins) breakdown too.
      expect(ours.del).toBe(theirs.del);
      expect(ours.ins).toBe(theirs.ins);

      // Independent correctness: applying our script reconstructs B.
      expect(applyEdits(s.a, ours.edits)).toEqual(s.b);
    });
  }
});

describe("myers ≡ git diff — fuzzing with seeded random mutations", () => {
  const seeds = [1, 7, 42, 123, 999, 31415, 271828, 1618033];
  const sizes = [10, 30, 60];
  const mutations = [3, 10, 25];

  for (const seed of seeds) {
    for (const baseLines of sizes) {
      for (const m of mutations) {
        const label = `seed=${seed} lines=${baseLines} mutations=${m}`;
        it(label, () => {
          const { a, b } = generatePair(seed, baseLines, m);
          const ours = ourStats(a, b);
          const theirs = gitDiffStats(a, b);

          // Edit distance is uniquely determined — must match.
          const ourD = ours.del + ours.ins;
          const theirD = theirs.del + theirs.ins;
          expect(ourD).toBe(theirD);

          // Correctness — our edits reconstruct B from A.
          expect(applyEdits(a, ours.edits)).toEqual(b);
        });
      }
    }
  }
});
