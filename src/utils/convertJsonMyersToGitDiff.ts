type ArrayOp =
  | { type: "add"; index: number; item: string }
  | { type: "remove"; index: number; item: string };

export function convertJsonMyersToGitDiff(
  originalLines: string[],
  arrayOps: ArrayOp[],
  filename = "file.ts",
): string {
  const newLines = [...originalLines];
  let removed = 0;
  let added = 0;

  // aplica as operações no array para obter o conteúdo final
  for (const op of arrayOps) {
    const i = op.index - removed + added;

    if (op.type === "remove") {
      newLines.splice(i, 1);
      removed++;
    }

    if (op.type === "add") {
      newLines.splice(i, 0, op.item);
      added++;
    }
  }

  const result: string[] = [];
  result.push(`diff --git a/${filename} b/${filename}`);
  result.push(`--- a/${filename}`);
  result.push(`+++ b/${filename}`);

  const hunk: string[] = [];

  let i = 0;
  while (i < originalLines.length || i < newLines.length) {
    const oldLine = originalLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      hunk.push(` ${oldLine}`);
    } else {
      if (oldLine !== undefined) hunk.push(`-${oldLine}`);
      if (newLine !== undefined) hunk.push(`+${newLine}`);
    }

    i++;
  }

  result.push(`@@ -1,${originalLines.length} +1,${newLines.length} @@`);
  result.push(...hunk);

  return result.join("\n");
}
