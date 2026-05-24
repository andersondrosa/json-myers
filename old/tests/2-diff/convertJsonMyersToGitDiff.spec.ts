import { describe, it, expect } from "vitest";
import { convertJsonMyersToGitDiff } from "../../src";

describe("convertJsonMyersToGitDiff", () => {
  it("gera diff unificado para remoção e adição de linha", () => {
    const original = ["export const x = 10;", "console.log(x);"];

    const diff = {
      lines: {
        $__arrayOps: [
          { type: "remove", index: 0, item: "export const x = 10;" },
          { type: "add", index: 0, item: "export const x = 42;" },
        ],
      },
    };

    const result = convertJsonMyersToGitDiff(
      original,
      diff.lines.$__arrayOps as [],
      "math.ts",
    );

    expect(result).toEqual(
      [
        "diff --git a/math.ts b/math.ts",
        "--- a/math.ts",
        "+++ b/math.ts",
        "@@ -1,2 +1,2 @@",
        "-export const x = 10;",
        "+export const x = 42;",
        " console.log(x);",
      ].join("\n"),
    );
  });
});
