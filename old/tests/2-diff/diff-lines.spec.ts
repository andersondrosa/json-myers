import { describe, it, expect } from "vitest";
import { diffLines, patchJson, applyMyersDiff } from "../../src";

describe("diffLines — git-style diff for arrays of primitives", () => {
  describe("Casos minimais", () => {
    it("arrays idênticos → $__arrayOps vazio", () => {
      const diff = diffLines(["a", "b", "c"], ["a", "b", "c"]);
      expect(diff).toEqual({ $__arrayOps: [] });
    });

    it("array vazio → array vazio", () => {
      expect(diffLines([], [])).toEqual({ $__arrayOps: [] });
    });

    it("add em array vazio", () => {
      const diff = diffLines([], ["a", "b"]);
      expect(diff.$__arrayOps).toEqual([
        { type: "add", index: 0, item: "a" },
        { type: "add", index: 1, item: "b" },
      ]);
    });

    it("remove total", () => {
      const diff = diffLines(["a", "b"], []);
      expect(diff.$__arrayOps).toEqual([
        { type: "remove", index: 0, item: "a" },
        { type: "remove", index: 1, item: "b" },
      ]);
    });
  });

  describe("Itens únicos — comporta como Myers cru", () => {
    it("substituir uma linha", () => {
      const diff = diffLines(["a", "b", "c"], ["a", "x", "c"]);
      expect(diff.$__arrayOps).toContainEqual({
        type: "remove",
        index: 1,
        item: "b",
      });
      expect(diff.$__arrayOps).toContainEqual({
        type: "add",
        index: 1,
        item: "x",
      });
    });

    it("inserir no meio", () => {
      const diff = diffLines(["a", "b", "c"], ["a", "x", "b", "c"]);
      expect(diff.$__arrayOps).toEqual([
        { type: "add", index: 1, item: "x" },
      ]);
    });

    it("remover do meio", () => {
      const diff = diffLines(["a", "b", "c"], ["a", "c"]);
      expect(diff.$__arrayOps).toEqual([
        { type: "remove", index: 1, item: "b" },
      ]);
    });
  });

  describe("Itens duplicados — NUNCA emite move (git-like)", () => {
    it("array com strings repetidas: nenhum move detectado", () => {
      const before = ["A", "B", "C", "B de novo"];
      const after = ["B de novo", "A", "B", "C"];
      const diff = diffLines(before, after);

      // Nenhum move — só add/remove
      const moves = diff.$__arrayOps.filter((op: any) => op.type === "move");
      expect(moves).toHaveLength(0);

      // Round-trip funciona
      expect(patchJson(before, diff)).toEqual(after);
    });

    it("várias linhas vazias e fechamentos de bloco — round-trip ok", () => {
      const before = [
        "function a() {",
        "  return 1;",
        "}",
        "",
        "function b() {",
        "  return 2;",
        "}",
      ];
      const after = [
        "function a() {",
        "  return 1;",
        "}",
        "",
        "function c() {",
        "  return 3;",
        "}",
        "",
        "function b() {",
        "  return 2;",
        "}",
      ];
      const diff = diffLines(before, after);

      // Sem moves
      expect(
        diff.$__arrayOps.filter((op: any) => op.type === "move"),
      ).toHaveLength(0);

      expect(patchJson(before, diff)).toEqual(after);
    });

    it("3 fechamentos `}` idênticos: cada um permanece como add/remove próprio", () => {
      const before = ["{", "}", "{", "}", "{", "}"];
      const after = ["{", "}", "{", "}"];
      const diff = diffLines(before, after);

      expect(
        diff.$__arrayOps.filter((op: any) => op.type === "move"),
      ).toHaveLength(0);

      expect(patchJson(before, diff)).toEqual(after);
    });
  });

  describe("Round-trip — forward e backward", () => {
    const samples: Array<[string, string[], string[]]> = [
      ["swap simples", ["A", "B"], ["B", "A"]],
      ["rotação", ["A", "B", "C"], ["B", "C", "A"]],
      ["substituir 2 + adicionar 1", ["a", "b", "c"], ["a", "x", "y", "z"]],
      [
        "muitas duplicatas",
        ["", "x", "", "y", "", "z", ""],
        ["", "y", "", "z", "", "x", ""],
      ],
    ];

    for (const [name, before, after] of samples) {
      it(`${name} — forward`, () => {
        const diff = diffLines(before, after);
        expect(patchJson(before, diff)).toEqual(after);
      });

      it(`${name} — backward`, () => {
        const reverse = diffLines(after, before);
        expect(patchJson(after, reverse)).toEqual(before);
      });
    }
  });

  describe("Determinismo — runs idênticos", () => {
    it("5 runs sobre o mesmo par produzem output bit-a-bit igual", () => {
      const before = ["a", "b", "c", "d", "e"];
      const after = ["b", "x", "d", "e", "a"];
      const samples = Array.from({ length: 5 }, () =>
        JSON.stringify(diffLines(before, after)),
      );
      expect(new Set(samples).size).toBe(1);
    });
  });

  describe("Equivalência com applyMyersDiff (cru) para arrays primitivos", () => {
    it("ops são as mesmas que applyMyersDiff produziria", () => {
      const before = ["a", "b", "c"];
      const after = ["c", "a", "b"];
      const diff = diffLines(before, after);
      // O resultado de aplicar deve bater
      expect(patchJson(before, diff)).toEqual(after);
      // E aplicar as mesmas ops via applyMyersDiff também deve bater
      expect(applyMyersDiff(before, diff.$__arrayOps as any)).toEqual(after);
    });
  });
});
