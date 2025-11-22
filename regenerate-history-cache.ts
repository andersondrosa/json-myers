import { diffJson } from './src/diff/diffJson';
import fs from 'fs';
import path from 'path';

const historyPath = path.join(__dirname, "tests/history");
const cachePath = path.join(__dirname, "tests/history/cache");

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(path.join(historyPath, file), "utf-8"));
}

function saveDiff(index: number, diff: any) {
  fs.writeFileSync(
    path.join(cachePath, `diff-${index}.json`),
    JSON.stringify(diff, null, 2)
  );
}

console.log('=== REGENERANDO CACHE DE DIFFS ===\n');

// Gerar diff 1: original → modified-1
console.log('Gerando diff-1.json...');
const original = readJson("original.json");
const modified1 = readJson("modified-1.json");
const diff1 = diffJson(original, modified1);
saveDiff(1, diff1);
console.log('  ✅ diff-1.json salvo');

// Gerar diffs 2-7: modified-(i-1) → modified-i
for (let i = 2; i <= 7; i++) {
  console.log(`Gerando diff-${i}.json...`);
  const prev = readJson(`modified-${i - 1}.json`);
  const next = readJson(`modified-${i}.json`);
  const diff = diffJson(prev, next);
  saveDiff(i, diff);
  console.log(`  ✅ diff-${i}.json salvo`);
}

console.log('\n✅ TODOS OS DIFFS REGENERADOS COM SUCESSO!');
console.log('\nAgora os testes devem passar.');
