import { describe, test, expect } from "vitest";
import {
  myersDiff,
  applyMyersDiff,
  rollbackMyersDiff,
} from "../../src/1-core/myersDiff";

describe("Myers Diff Algorithm", () => {
  //
  test("gera diff correto entre arrays", () => {
    const oldArray = ["a", "b", "c", "d"];
    const newArray = ["b", "c", "x", "d"];

    const diff = myersDiff(oldArray, newArray);

    expect(diff).toEqual([
      { type: "remove", index: 0, item: "a" },
      { type: "add", index: 2, item: "x" }, // índice no array FINAL
    ]);
  });

  test("aplica o diff corretamente", () => {
    const oldArray = ["a", "b", "c", "d"];
    const newArray = ["b", "c", "x", "d"];

    const diff = myersDiff(oldArray, newArray);
    const applied = applyMyersDiff(oldArray, diff);

    expect(applied).toEqual(newArray);
  });

  test("faz rollback corretamente", () => {
    const oldArray = ["a", "b", "c", "d"];
    const newArray = ["b", "c", "x", "d"];

    const diff = myersDiff(oldArray, newArray);
    const rollbacked = rollbackMyersDiff(newArray, diff);

    expect(rollbacked).toEqual(oldArray);
  });

  test("caso complexo com múltiplas mudanças", () => {
    const oldArray = ["1", "2", "3", "4", "5", "6"];
    const newArray = ["0", "2", "3", "5", "6", "7"];

    const diff = myersDiff(oldArray, newArray);
    const applied = applyMyersDiff(oldArray, diff);
    const rollbacked = rollbackMyersDiff(newArray, diff);

    expect(applied).toEqual(newArray);
    expect(rollbacked).toEqual(oldArray);
  });

  test("caso de troca", () => {
    const oldArray = ["1", "2"];
    const newArray = ["2", "1"];

    const diff = myersDiff(oldArray, newArray);

    console.log(diff);

    const applied = applyMyersDiff(oldArray, diff);
    const rollbacked = rollbackMyersDiff(newArray, diff);

    expect(applied).toEqual(newArray);
    expect(rollbacked).toEqual(oldArray);
  });

  test("arrays vazios e edge-cases", () => {
    expect(myersDiff([], [])).toEqual([]);
    expect(myersDiff(["a"], [])).toEqual([
      { type: "remove", index: 0, item: "a" },
    ]);
    expect(myersDiff([], ["a"])).toEqual([
      { type: "add", index: 0, item: "a" },
    ]);
  });

  test("aplicação e rollback com arrays vazios", () => {
    const oldArray: string[] = [];
    const newArray = ["a"];

    const diff = myersDiff(oldArray, newArray);
    const applied = applyMyersDiff(oldArray, diff);
    const rollbacked = rollbackMyersDiff(newArray, diff);

    expect(applied).toEqual(newArray);
    expect(rollbacked).toEqual(oldArray);
  });
});
