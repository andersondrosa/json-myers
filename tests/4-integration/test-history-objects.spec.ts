import { describe, it, expect } from "vitest";
import { diffJson } from "../../src/2-diff/diffJson";
import { patchJson } from "../../src/3-patch/patchJson";

/**
 * Teste de histórico com arrays de OBJETOS (keys)
 *
 * Diferente do test-history-simple.spec.ts que usa strings,
 * este teste usa OBJETOS com propriedade 'key'.
 *
 * Testa 2 aspectos:
 * 1. Myers: Operações em keys (add/remove/move de objetos inteiros)
 * 2. Diff de objetos: Mudanças em propriedades dentro dos objetos
 */

describe("History Objects: Array de Objetos com Keys (Git-like)", () => {
  // 7 steps de evolução de um array de campos (objetos)
  const history = {
    // Step 0: Estado inicial - 5 campos básicos
    step0: [
      { key: "name", type: "string", required: true, maxLength: 100 },
      { key: "email", type: "string", required: true, pattern: "email" },
      { key: "password", type: "string", required: true, minLength: 8 },
      { key: "age", type: "number", required: false, min: 0, max: 120 },
      { key: "city", type: "string", required: false, maxLength: 50 },
    ],

    // Step 1: Adiciona campo phone
    step1: [
      { key: "name", type: "string", required: true, maxLength: 100 },
      { key: "email", type: "string", required: true, pattern: "email" },
      { key: "password", type: "string", required: true, minLength: 8 },
      { key: "age", type: "number", required: false, min: 0, max: 120 },
      { key: "city", type: "string", required: false, maxLength: 50 },
      { key: "phone", type: "string", required: false, pattern: "phone" }, // ADD
    ],

    // Step 2: Remove password + altera email (não mais required)
    step2: [
      { key: "name", type: "string", required: true, maxLength: 100 },
      { key: "email", type: "string", required: false, pattern: "email" }, // CHANGED required
      { key: "age", type: "number", required: false, min: 0, max: 120 },
      { key: "city", type: "string", required: false, maxLength: 50 },
      { key: "phone", type: "string", required: false, pattern: "phone" },
      // password REMOVED
    ],

    // Step 3: Move name para depois de email + altera maxLength
    step3: [
      { key: "email", type: "string", required: false, pattern: "email" },
      { key: "name", type: "string", required: true, maxLength: 200 }, // MOVED + CHANGED maxLength
      { key: "age", type: "number", required: false, min: 0, max: 120 },
      { key: "city", type: "string", required: false, maxLength: 50 },
      { key: "phone", type: "string", required: false, pattern: "phone" },
    ],

    // Step 4: Substitui city por country + altera propriedades
    step4: [
      { key: "email", type: "string", required: false, pattern: "email" },
      { key: "name", type: "string", required: true, maxLength: 200 },
      { key: "age", type: "number", required: false, min: 18, max: 100 }, // CHANGED min/max
      { key: "country", type: "string", required: true, maxLength: 2 }, // REPLACED city
      { key: "phone", type: "string", required: false, pattern: "phone" },
    ],

    // Step 5: Adiciona bio e avatar + altera phone
    step5: [
      { key: "email", type: "string", required: false, pattern: "email" },
      { key: "name", type: "string", required: true, maxLength: 200 },
      { key: "age", type: "number", required: false, min: 18, max: 100 },
      { key: "country", type: "string", required: true, maxLength: 2 },
      { key: "phone", type: "string", required: true, pattern: "phone" }, // CHANGED required
      { key: "bio", type: "text", required: false, maxLength: 500 }, // ADD
      { key: "avatar", type: "string", required: false, format: "url" }, // ADD
    ],

    // Step 6: Remove name + altera bio
    step6: [
      { key: "email", type: "string", required: false, pattern: "email" },
      { key: "age", type: "number", required: false, min: 18, max: 100 },
      { key: "country", type: "string", required: true, maxLength: 2 },
      { key: "phone", type: "string", required: true, pattern: "phone" },
      { key: "bio", type: "text", required: true, maxLength: 1000 }, // CHANGED required + maxLength
      { key: "avatar", type: "string", required: false, format: "url" },
      // name REMOVED
    ],

    // Step 7: Reordena (avatar e bio pro início) + altera email
    step7: [
      { key: "avatar", type: "string", required: true, format: "url" }, // MOVED + CHANGED required
      { key: "bio", type: "text", required: true, maxLength: 1000 },
      { key: "email", type: "string", required: true, pattern: "email" }, // CHANGED required
      { key: "age", type: "number", required: false, min: 18, max: 100 },
      { key: "country", type: "string", required: true, maxLength: 2 },
      { key: "phone", type: "string", required: true, pattern: "phone" },
    ],
  };

  it("deve gerar diffs entre todos os steps (objetos completos)", () => {
    const diffs: any[] = [];

    console.log("\n=== GERANDO DIFFS (Objetos com Keys) ===\n");

    for (let i = 0; i < 7; i++) {
      const current = history[`step${i}` as keyof typeof history];
      const next = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(current, next);
      diffs.push(diff);

      console.log(`📝 Diff ${i} → ${i + 1}:`);
      console.log(`   Keys From: [${current.map((x) => x.key).join(", ")}]`);
      console.log(`   Keys To:   [${next.map((x) => x.key).join(", ")}]`);
      console.log(`   ArrayOps:  ${diff.$__arrayOps?.length || 0} ops`);

      // Mostrar patches em propriedades
      const keyPatches = Object.keys(diff).filter((k) => k !== "$__arrayOps");
      if (keyPatches.length > 0) {
        console.log(`   Patches:   [${keyPatches.join(", ")}]`);
      }
      console.log();
    }

    expect(diffs.length).toBe(7);
  });

  it("deve aplicar diffs sequencialmente (avançar histórico)", () => {
    let currentState = structuredClone(history.step0);

    console.log("\n=== APLICANDO DIFFS (Forward) ===\n");
    console.log(
      `Step 0: keys=[${currentState.map((x: any) => x.key).join(", ")}]`,
    );

    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      currentState = patchJson(currentState, diff);

      console.log(
        `Step ${i + 1}: keys=[${currentState.map((x: any) => x.key).join(", ")}]`,
      );

      // Verificar se chegou no estado esperado
      expect(currentState).toEqual(to);
    }

    expect(currentState).toEqual(history.step7);
  });

  it("deve fazer rollback completo aplicando diffs reversos", () => {
    let currentState = structuredClone(history.step7);

    const reverseDiffs: any[] = [];

    console.log("\n=== GERANDO REVERSE DIFFS ===\n");

    for (let i = 7; i > 0; i--) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i - 1}` as keyof typeof history];

      const reverseDiff = diffJson(from, to);
      reverseDiffs.push(reverseDiff);

      console.log(`🔄 Reverse diff ${i} → ${i - 1}`);
      console.log(`   From keys: [${from.map((x) => x.key).join(", ")}]`);
      console.log(`   To keys:   [${to.map((x) => x.key).join(", ")}]`);
    }

    console.log("\n=== APLICANDO ROLLBACK ===\n");

    for (let i = 0; i < 7; i++) {
      const expectedStep = 7 - i - 1;
      const expected = history[`step${expectedStep}` as keyof typeof history];

      currentState = patchJson(currentState, reverseDiffs[i]);

      console.log(
        `Step ${expectedStep}: keys=[${currentState.map((x: any) => x.key).join(", ")}]`,
      );

      expect(currentState).toEqual(expected);
    }

    expect(currentState).toEqual(history.step0);
  });

  it("deve fazer round-trip completo: forward → backward", () => {
    const original = structuredClone(history.step0);
    let state = structuredClone(original);

    console.log("\n=== ROUND-TRIP TEST (Objetos) ===\n");
    console.log(`Original: ${state.length} objetos`);
    console.log(`Keys: [${original.map((x: any) => x.key).join(", ")}]\n`);

    // FORWARD
    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      state = patchJson(state, diff);
    }

    console.log(`After forward: ${state.length} objetos`);
    console.log(`Keys: [${state.map((x: any) => x.key).join(", ")}]`);
    expect(state).toEqual(history.step7);

    // BACKWARD
    for (let i = 6; i >= 0; i--) {
      const from = history[`step${i + 1}` as keyof typeof history];
      const to = history[`step${i}` as keyof typeof history];

      const reverseDiff = diffJson(from, to);
      state = patchJson(state, reverseDiff);
    }

    console.log(`After backward: ${state.length} objetos`);
    console.log(`Keys: [${state.map((x: any) => x.key).join(", ")}]\n`);
    expect(state).toEqual(original);

    console.log("✅ Round-trip successful!");
  });

  it("deve detectar moves corretamente (não remove+add)", () => {
    // step2 → step3: name move para posição 1
    const from = history.step2;
    const to = history.step3;

    const diff = diffJson(from, to);

    console.log("\n=== MOVE DETECTION (Objetos) ===");
    console.log(`From: [${from.map((x) => x.key).join(", ")}]`);
    console.log(`To:   [${to.map((x) => x.key).join(", ")}]`);

    const ops = diff.$__arrayOps || [];
    const moves = ops.filter((op: any) => op.type === "move");
    const removes = ops.filter((op: any) => op.type === "remove");
    const adds = ops.filter((op: any) => op.type === "add");

    console.log(`\nMoves: ${moves.length}`);
    console.log(`Removes: ${removes.length}`);
    console.log(`Adds: ${adds.length}`);

    // Deve detectar como move, não remove+add
    expect(moves.length).toBeGreaterThan(0);

    // Verificar se tem patch para name (mudou maxLength)
    expect(diff.name).toBeDefined();
    expect(diff.name.maxLength).toBe(200);
  });

  it("deve aplicar patches em propriedades dos objetos", () => {
    // step0 → step1: adiciona phone
    // step1 → step2: altera email.required = false

    const state0 = structuredClone(history.step0);
    const state1 = structuredClone(history.step1);

    const diff01 = diffJson(state0, state1);
    const result1 = patchJson(state0, diff01);

    // Verificar que phone foi adicionado
    const phoneField = result1.find((x: any) => x.key === "phone");
    expect(phoneField).toBeDefined();
    expect(phoneField?.type).toBe("string");
    expect(phoneField?.pattern).toBe("phone");

    const diff12 = diffJson(state1, history.step2);
    const result2 = patchJson(result1, diff12);

    // Verificar que email.required mudou para false
    const emailField = result2.find((x: any) => x.key === "email");
    expect(emailField?.required).toBe(false);

    // Verificar que password foi removido
    const passwordField = result2.find((x: any) => x.key === "password");
    expect(passwordField).toBeUndefined();
  });

  it("deve lidar com múltiplas mudanças no mesmo diff", () => {
    // step6 → step7:
    // - Move avatar (5→0) + altera required
    // - Move bio (4→1)
    // - Altera email.required = true

    const diff67 = diffJson(history.step6, history.step7);

    console.log("\n=== MÚLTIPLAS MUDANÇAS ===");
    console.log("ArrayOps:", JSON.stringify(diff67.$__arrayOps, null, 2));

    const patches = Object.keys(diff67).filter((k) => k !== "$__arrayOps");
    console.log("Patches:", patches);

    const result = patchJson(history.step6, diff67);

    // Verificar ordem
    expect(result[0].key).toBe("avatar");
    expect(result[1].key).toBe("bio");

    // Verificar patches aplicados
    expect(result[0].required).toBe(true); // avatar.required mudou
    expect(result[2].required).toBe(true); // email.required mudou
  });

  it("deve preservar propriedades não alteradas", () => {
    // Ao longo de TODOS os steps, algumas propriedades permanecem iguais

    let state = structuredClone(history.step0);

    // Aplicar todos os diffs
    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];
      const diff = diffJson(from, to);
      state = patchJson(state, diff);
    }

    // Verificar que country.maxLength = 2 (definido no step4, nunca mudou)
    const country = state.find((x: any) => x.key === "country");
    expect(country?.maxLength).toBe(2);
    expect(country?.required).toBe(true);

    // Verificar que phone.pattern = "phone" (definido no step1, nunca mudou)
    const phone = state.find((x: any) => x.key === "phone");
    expect(phone?.pattern).toBe("phone");
  });

  it("deve validar integridade após cada step", () => {
    let state = structuredClone(history.step0);

    console.log("\n=== VALIDAÇÃO DE INTEGRIDADE ===\n");

    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      state = patchJson(state, diff);

      // Validações
      const keys = state.map((x: any) => x.key);
      const uniqueKeys = new Set(keys);

      console.log(`Step ${i + 1}:`);
      console.log(`  Total: ${state.length} objetos`);
      console.log(`  Keys únicas: ${uniqueKeys.size}`);
      console.log(
        `  Duplicatas: ${keys.length - uniqueKeys.size ? "❌" : "✅"}`,
      );

      // Nenhuma duplicata
      expect(uniqueKeys.size).toBe(state.length);

      // Todos objetos têm key
      state.forEach((obj: any) => {
        expect(obj.key).toBeDefined();
        expect(typeof obj.key).toBe("string");
      });

      // Estado final igual ao esperado
      expect(state).toEqual(to);
    }

    console.log("\n✅ Integridade validada em todos os steps!");
  });
});
