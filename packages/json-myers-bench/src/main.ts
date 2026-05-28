import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runAll, type ScenarioResult } from "./runner.ts";
import { renderMarkdown, renderJson } from "./report.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "..", "results");

async function main() {
  process.stdout.write("Bench — geração de patches JSON\n");
  process.stdout.write("================================\n\n");

  // Persist after every scenario so a crash mid-run preserves progress.
  const persist = (acc: ScenarioResult[]) => {
    writeFileSync(join(RESULTS_DIR, "results.json"), renderJson(acc));
    writeFileSync(join(RESULTS_DIR, "RESULTS.md"), renderMarkdown(acc));
  };

  const results = await runAll(persist);
  persist(results);

  process.stdout.write(`\nResultados salvos em:\n`);
  process.stdout.write(`  ${join(RESULTS_DIR, "RESULTS.md")}\n`);
  process.stdout.write(`  ${join(RESULTS_DIR, "results.json")}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
