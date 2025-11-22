import { describe, it, expect } from "vitest";
import { patchJson } from "../../src/3-patch/patchJson";
import { diffJson } from "../../src/2-diff/diffJson";

describe("patchJson", () => {
  it("should apply primitive change", () => {
    const base = { a: 1 };
    const diff = { a: 2 };
    expect(patchJson(base, diff)).toEqual({ a: 2 });
  });

  it("should add new property", () => {
    const base = { a: 1 };
    const diff = { b: 2 };
    expect(patchJson(base, diff)).toEqual({ a: 1, b: 2 });
  });

  it("should remove property using $__remove", () => {
    const base = { a: 1, b: 2 };
    const diff = { b: { $__remove: true } };
    expect(patchJson(base, diff)).toEqual({ a: 1 });
  });

  it("should apply nested object diff", () => {
    const base = { user: { name: "Ana", age: 30 } };
    const diff = { user: { age: 31 } };
    expect(patchJson(base, diff)).toEqual({
      user: { name: "Ana", age: 31 },
    });
  });

  it("should apply $__arrayOps", () => {
    const base = ["a", "b", "c"];
    const diff = {
      $__arrayOps: [
        { type: "remove", index: 1, item: "b" },
        { type: "add", index: 1, item: "x" },
      ],
    };
    expect(patchJson(base, diff)).toEqual(["a", "x", "c"]);
  });

  it("should apply $__arrayOps 2", () => {
    const base = [
      { key: "1", name: "a" },
      { key: "2", name: "b" },
    ];
    const diff = {
      $__arrayOps: [
        { type: "remove", key: "1" },
        { type: "add", key: "3", index: 1 },
      ],
      "2": { name: "b2" },
      "3": { name: "c" },
    };
    const rollback = patchJson(base, diff);

    expect(rollback).toEqual(
      [
        { key: "2", name: "b2" },
        { key: "3", name: "c" },
      ].sort((a, b) => a.key.localeCompare(b.key)),
    );
  });

  it("should return diff if base is null", () => {
    const base = null;
    const diff = { a: 1 };
    expect(patchJson(base, diff)).toEqual({ a: 1 });
  });

  it("should return value directly if diff is primitive", () => {
    expect(patchJson({ a: 1 }, 42)).toEqual(42);
  });

  it("should apply complex nested diff", () => {
    const base = {
      user: {
        name: "Ana",
        tags: ["a", "b", "c"],
      },
    };
    const diff = {
      user: {
        tags: {
          $__arrayOps: [
            { type: "remove", index: 1, item: "b" },
            { type: "add", index: 1, item: "x" },
          ],
        },
      },
    };
    expect(patchJson(base, diff)).toEqual({
      user: {
        name: "Ana",
        tags: ["a", "x", "c"],
      },
    });
  });

  it("should create diff from complex attrx and rollback correctly", () => {
    //
    const original = [
      { key: "nome", type: "string", value: "Casa" },
      { key: "ativo", type: "boolean", value: true, toRemove: "Remover" },
      { key: "area", type: "number", value: 200, as: "area" },
      { key: "cor", type: "object", value: { h: 200, s: 50, l: 60 } },
      { key: "preco", type: "number", value: 500000, as: "currency" },
      { key: "descricao", type: "string", value: "Casa de esquina." },
      { key: "fotos", type: "array", value: ["foto1.jpg", "foto2.jpg"] },
      { key: "tags", type: "array", value: ["nova", "urgente"] },
      { key: "publicado_em", type: "string" },
      { key: "prioridade", type: "number", value: 1 },
    ];

    const modificado = [
      { key: "nome", type: "string", value: "Casa ampla" },
      { key: "area", type: "number", value: 220, as: "area" },
      { key: "ativo", type: "boolean", value: false, NEW: "OK" },
      { key: "cor", type: "object", value: { h: 190, s: 60, l: 70 } },
      { key: "preco", type: "number", value: 520000, as: "currency" },
      { key: "descricao", type: "string", value: "Casa de jardim." },
      { key: "fotos", type: "array", value: ["foto1.jpg", "foto3.jpg"] },
      { key: "tags", type: "array", value: ["urgente"] },
      { key: "prioridade", type: "number", value: 2 },
      { key: "publicado_em", type: "string" },
    ];

    const originalObj = { atributos: original };
    const modificadoObj = { atributos: modificado };

    const diff = diffJson(originalObj, modificadoObj);

    const resultado = patchJson(originalObj, diff);

    const rollback = patchJson(resultado, diffJson(modificadoObj, originalObj));

    expect(resultado).toEqual(modificadoObj);
    expect(rollback).toEqual(originalObj);
  });

  it("should preserve full content of reordered attributes including custom fields", () => {
    const base = [
      { key: "nome", type: "string", value: "Casa" },
      { key: "ativo", type: "boolean", value: true },
      { key: "area", type: "number", value: 200, as: "area" },
    ];

    const diff = {
      $__arrayOps: [
        { type: "remove", key: "ativo" },
        { type: "add", key: "ativo", index: 2 },
      ],
      ativo: { value: false, NEW: "OK" },
    };

    const expected = [
      { key: "nome", type: "string", value: "Casa" },
      { key: "area", type: "number", value: 200, as: "area" },
      {
        key: "ativo",
        type: "boolean",
        value: false,
        NEW: "OK",
      },
    ];

    const result = patchJson(base, diff);
    expect(result).toEqual(expected);
  });
});
