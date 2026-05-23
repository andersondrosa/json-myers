import { applyMyersDiff } from "../core/myersDiff";

type ArrayOp =
  | { type: "add"; index: number; item: string }
  | { type: "remove"; index: number; item: string };

/**
 * Renderiza um diff de array-de-strings (tipicamente linhas de código) no
 * formato `git diff --unified`.
 *
 * Útil para visualizar diffs gerados por `diffJson` ou `diffLines` sobre
 * arquivos textuais linha-a-linha em ferramentas que esperam unified diff.
 *
 * Aceita apenas ops `add`/`remove` literais — não suporta `move` nem smart keys.
 *
 * @param originalLines Linhas do arquivo original.
 * @param arrayOps Operações de array geradas por `diffJson`/`diffLines` sobre as linhas.
 * @param filename Nome do arquivo para exibir no header (default `"file.ts"`).
 * @returns String no formato `git diff --unified` (full file, sem context cropping).
 */
export function convertJsonMyersToGitDiff(
  originalLines: string[],
  arrayOps: ArrayOp[],
  filename = "file.ts",
): string {
  // Reconstrói o array final aplicando os ops corretamente
  const newLines = applyMyersDiff(originalLines, arrayOps);

  // Conjuntos de índices marcados como removidos (no original) e adicionados (no final)
  const removedIdx = new Set<number>();
  const addedIdx = new Set<number>();
  for (const op of arrayOps) {
    if (op.type === "remove") removedIdx.add(op.index);
    else addedIdx.add(op.index);
  }

  // Caminha original (i) e final (j) em paralelo, guiados pelos ops
  const hunk: string[] = [];
  let i = 0;
  let j = 0;
  while (i < originalLines.length || j < newLines.length) {
    if (i < originalLines.length && removedIdx.has(i)) {
      hunk.push(`-${originalLines[i]}`);
      i++;
    } else if (j < newLines.length && addedIdx.has(j)) {
      hunk.push(`+${newLines[j]}`);
      j++;
    } else {
      // Linha de contexto — presente em ambos
      hunk.push(` ${originalLines[i]}`);
      i++;
      j++;
    }
  }

  const header = [
    `diff --git a/${filename} b/${filename}`,
    `--- a/${filename}`,
    `+++ b/${filename}`,
    `@@ -1,${originalLines.length} +1,${newLines.length} @@`,
  ];

  return [...header, ...hunk].join("\n");
}
