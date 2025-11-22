import { describe, test, expect } from "vitest";
import {
  myersDiffOptimization,
  optimizedDiffToMyersRaw,
} from "../../src/1-core/myersDiffOptimization";
import { myersDiff } from "../../src/1-core/myersDiff";

describe("Myers Diff Optimization", () => {
  //
  test("Converte Myers raw para diff otimizado com moves", () => {
    const rawDiff: any[] = [
      { type: "remove", index: 3, item: "x" },
      { type: "add", index: 1, item: "x" },
    ];

    const optimized = myersDiffOptimization(rawDiff);

    expect(optimized).toEqual([{ type: "move", from: 3, to: 1, item: "x" }]);
  });

  test("Converte diff otimizado com moves para Myers raw corretamente", () => {
    const optimizedDiff: any[] = [{ type: "move", from: 3, to: 1, item: "x" }];

    const raw = optimizedDiffToMyersRaw(optimizedDiff);

    expect(raw).toEqual([
      { type: "add", index: 1, item: "x" },
      { type: "remove", index: 3, item: "x" },
    ]);
  });

  test("Conversão complexa Myers -> Otimizado -> Myers mantém consistência", () => {
    const rawDiffComplexo: any[] = [
      { type: "remove", index: 0, item: "a" },
      { type: "remove", index: 1, item: "b" },
      { type: "add", index: 3, item: "a" },
      { type: "add", index: 4, item: "b" },
      { type: "add", index: 5, item: "x" },
    ];

    const optimized = myersDiffOptimization(rawDiffComplexo);

    expect(optimized).toEqual([
      { type: "move", from: 0, to: 3, item: "a" },
      { type: "move", from: 1, to: 4, item: "b" },
      { type: "add", index: 5, item: "x" },
    ]);

    const reverted = optimizedDiffToMyersRaw(optimized);

    expect(reverted).toEqual([...rawDiffComplexo]);
  });

  test("Conversão sem moves retorna diff original inalterado", () => {
    const rawDiffSemMove: any[] = [
      { type: "remove", index: 2, item: "y" },
      { type: "add", index: 4, item: "z" },
    ];

    const optimized = myersDiffOptimization(rawDiffSemMove);

    expect(optimized).toEqual(rawDiffSemMove);

    const reverted = optimizedDiffToMyersRaw(optimized);
    expect(reverted).toEqual(rawDiffSemMove);
  });

  test("Teste final", () => {
    const oldArray: any[] = [
      "bed",
      "bath",
      "garage",
      "kitchen",
      "living room",
      "dining room",
      "basement",
      "attic",
      "pool",
      "yard",
      "driveway",
      "front yard",
      "back yard",
      "patio",
      "deck",
      "porch",
      "balcony",
      "stairs",
      "hallway",
      "closet",
    ];

    const newArray: any[] = [
      // bloco menor veio pra cima
      "front yard",
      "back yard",
      "patio",
      "deck",
      "porch",
      "balcony",
      "stairs",
      "hallway",
      "closet",
      // bloco inicial e maior manteve parado.
      "bed",
      "bath",
      "garage",
      "kitchen",
      "living room",
      "dining room",
      "basement",
      "attic",
      "pool",
      "yard",
      "driveway",
    ];

    const rawDiffSemMove = myersDiff(oldArray, newArray);

    // console.log(rawDiffSemMove);

    expect(rawDiffSemMove).toEqual([
      { type: "add", index: 0, item: "front yard" },
      { type: "add", index: 1, item: "back yard" },
      { type: "add", index: 2, item: "patio" },
      { type: "add", index: 3, item: "deck" },
      { type: "add", index: 4, item: "porch" },
      { type: "add", index: 5, item: "balcony" },
      { type: "add", index: 6, item: "stairs" },
      { type: "add", index: 7, item: "hallway" },
      { type: "add", index: 8, item: "closet" },
      { type: "remove", index: 11, item: "front yard" },
      { type: "remove", index: 12, item: "back yard" },
      { type: "remove", index: 13, item: "patio" },
      { type: "remove", index: 14, item: "deck" },
      { type: "remove", index: 15, item: "porch" },
      { type: "remove", index: 16, item: "balcony" },
      { type: "remove", index: 17, item: "stairs" },
      { type: "remove", index: 18, item: "hallway" },
      { type: "remove", index: 19, item: "closet" },
    ]);

    const optimized = myersDiffOptimization(rawDiffSemMove);

    expect(optimized).toEqual([
      { type: "move", from: 11, to: 0, item: "front yard" },
      { type: "move", from: 12, to: 1, item: "back yard" },
      { type: "move", from: 13, to: 2, item: "patio" },
      { type: "move", from: 14, to: 3, item: "deck" },
      { type: "move", from: 15, to: 4, item: "porch" },
      { type: "move", from: 16, to: 5, item: "balcony" },
      { type: "move", from: 17, to: 6, item: "stairs" },
      { type: "move", from: 18, to: 7, item: "hallway" },
      { type: "move", from: 19, to: 8, item: "closet" },
    ]);

    const reverted = optimizedDiffToMyersRaw(optimized);

    expect(reverted).toEqual(rawDiffSemMove);
  });
});
