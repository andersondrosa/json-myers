import { describe, expect, it } from "vitest";
import { diffArray } from "../../src";

describe("diffArray - Lista com objetos com chaves duplicadas", () => {
  //
  it("deve considerar apenas o primeiro item com key duplicada no original", () => {
    //
    const original = [
      { key: "foo", value: "1" },
      { key: "foo", value: "OLD-VALUE" },
    ];
    const modified = [
      { key: "foo", value: "1" },
      { key: "foo", value: "NEW-VALUE" },
    ];

    const diff = diffArray(original, modified);

    expect(diff).toEqual({
      $__arrayOps: [
        {
          type: "remove",
          index: 1,
          item: { key: "foo", value: "OLD-VALUE" },
        },
        { type: "add", index: 1, item: { key: "foo", value: "NEW-VALUE" } },
      ],
    });
  });

  it("deve ignorar objetos duplicados no modified", () => {
    const original = [
      { key: "foo", value: "1" },
      { key: "foo", value: "2" },
    ];
    const modified = [
      { key: "foo", value: "3" },
      { key: "foo", value: "4" },
    ];

    const diff = diffArray(original, modified);

    expect(diff).toEqual({
      $__arrayOps: [
        { type: "remove", index: 1, item: { key: "foo", value: "2" } },
        { type: "add", index: 1, item: { key: "foo", value: "4" } },
      ],
      foo: { value: "3" },
    });
  });

  it("deve ignorar objetos duplicados no original", () => {
    const original = [
      { key: "foo", value: "1" },
      { key: "foo", value: "2" },
    ];
    const modified = [{ key: "foo", value: "3" }];

    const diff = diffArray(original, modified);

    expect(diff).toEqual({
      $__arrayOps: [
        { type: "remove", index: 1, item: { key: "foo", value: "2" } },
      ],
      foo: { value: "3" },
    });
  });

  it("deve tratar objetos duplicados no modified como valores normais", () => {
    const original = [{ key: "foo", value: "1" }];
    const modified = [
      { key: "foo", value: "2" },
      { key: "foo", value: "3" },
    ];

    const diff = diffArray(original, modified);

    expect(diff).toEqual({
      $__arrayOps: [
        { type: "add", index: 1, item: { key: "foo", value: "3" } },
      ],
      foo: { value: "2" },
    });
  });

  it("deve não gerar duplicações quando a key já foi considerada", () => {
    const original = [
      { key: "foo", value: "1" },
      { key: "foo", value: "2" },
    ];
    const modified = [
      { key: "foo", value: "3" },
      { key: "foo", value: "4" },
    ];

    const diff = diffArray(original, modified);

    // Apenas o primeiro 'foo' é considerado no diff
    expect(diff).toEqual({
      $__arrayOps: [
        { type: "remove", index: 1, item: { key: "foo", value: "2" } },
        { type: "add", index: 1, item: { key: "foo", value: "4" } },
      ],
      foo: { value: "3" },
    });
  });
});
