import { describe, it, expect } from "vitest";
import { diffJson } from "../../src/2-diff/diffJson";
import { patchJson } from "../../src/3-patch/patchJson";

/**
 * Teste de histórico CAÓTICO (vida real)
 *
 * Mix de TUDO:
 * - Strings puras
 * - Números
 * - Objetos com 'key'
 * - Objetos com 'id' (numérico e string)
 * - Objetos sem identificador
 * - Objetos aninhados
 * - Arrays dentro de objetos
 * - null e undefined
 *
 * Simula um array real de configurações/dados onde
 * não há padrão consistente.
 */

describe("History Complex: Mix Caótico (Vida Real)", () => {
  const history = {
    // Step 0: Inicial - completo caos
    step0: [
      "config-version-1.0", // STRING pura
      { key: "theme", value: "dark", enabled: true }, // OBJETO com key
      42, // NÚMERO
      { id: 1, name: "Admin", role: "admin" }, // OBJETO com id numérico
      { value: "random" }, // OBJETO sem identificador
      null, // NULL
    ],

    // Step 1: Adiciona items variados + altera alguns
    step1: [
      "config-version-1.1", // STRING alterada
      { key: "theme", value: "light", enabled: true }, // OBJETO alterado
      42,
      { id: 1, name: "Admin", role: "super-admin" }, // OBJETO alterado
      { value: "random" },
      null,
      { id: "user-2", email: "user@test.com" }, // ADD: OBJETO com id string
      100, // ADD: NÚMERO
    ],

    // Step 2: Remove null + adiciona objeto complexo
    step2: [
      "config-version-1.1",
      { key: "theme", value: "light", enabled: true },
      42,
      { id: 1, name: "Admin", role: "super-admin" },
      { value: "random" },
      // null REMOVED
      { id: "user-2", email: "user@test.com" },
      100,
      {
        // ADD: OBJETO complexo sem id/key
        settings: { notifications: true, language: "en" },
        meta: ["tag1", "tag2"],
      },
    ],

    // Step 3: Move string pro final + adiciona nested
    step3: [
      { key: "theme", value: "light", enabled: true },
      42,
      { id: 1, name: "Admin", role: "super-admin" },
      { value: "random" },
      { id: "user-2", email: "user@test.com" },
      100,
      {
        settings: { notifications: true, language: "en" },
        meta: ["tag1", "tag2"],
      },
      "config-version-1.1", // MOVED string
      { key: "debug", enabled: false }, // ADD: objeto simples
    ],

    // Step 4: Substitui número 42 por objeto + altera nested
    step4: [
      { key: "theme", value: "light", enabled: true },
      { key: "timeout", value: 42, unit: "seconds" }, // REPLACED número por objeto
      {
        id: 1,
        name: "Admin",
        role: "super-admin",
        permissions: ["read", "write"],
      }, // ADD array
      { value: "random" },
      { id: "user-2", email: "user@test.com", verified: true }, // ADD prop
      100,
      {
        settings: { notifications: false, language: "pt" }, // CHANGED nested
        meta: ["tag1", "tag2", "tag3"], // ADD item in array
      },
      "config-version-1.1",
      { key: "debug", enabled: true }, // CHANGED
    ],

    // Step 5: Remove objeto sem id + adiciona mix
    step5: [
      { key: "theme", value: "light", enabled: true },
      { key: "timeout", value: 42, unit: "seconds" },
      {
        id: 1,
        name: "Admin",
        role: "super-admin",
        permissions: ["read", "write"],
      },
      // { value: "random" } REMOVED
      { id: "user-2", email: "user@test.com", verified: true },
      100,
      {
        settings: { notifications: false, language: "pt" },
        meta: ["tag1", "tag2", "tag3"],
      },
      "config-version-1.1",
      { key: "debug", enabled: true },
      "999", // ADD: número (vira string)
      "feature-flags", // ADD: string
      { id: 3, active: true }, // ADD: objeto id numérico
    ],

    // Step 6: Grande reordenação + múltiplas mudanças
    step6: [
      "999", // MOVED número pro início (vira string)
      { id: 3, active: false, updated: true }, // MOVED + CHANGED
      { key: "theme", value: "dark", enabled: false }, // CHANGED múltiplos
      { key: "timeout", value: 60, unit: "seconds" }, // CHANGED value
      {
        id: 1,
        name: "SuperAdmin",
        role: "super-admin",
        permissions: ["read", "write", "delete"],
      },
      100,
      {
        settings: { notifications: false, language: "pt", theme: "dark" },
        meta: ["tag2", "tag3"], // REMOVED tag1
      },
      "config-version-2.0", // CHANGED string
      { key: "debug", enabled: true },
      // "feature-flags" REMOVED
      { id: "user-2", email: "updated@test.com", verified: true }, // CHANGED + MOVED
    ],

    // Step 7: Simplificação + cleanup
    step7: [
      "1000", // CHANGED "999" → "1000" (strings)
      { id: 3, active: false, updated: true },
      { key: "theme", value: "auto", enabled: true }, // CHANGED
      { id: 1, name: "SuperAdmin", role: "owner", permissions: ["all"] }, // CHANGED
      100,
      "config-version-2.0",
      { key: "debug", enabled: false }, // CHANGED
      // Objetos complexos e user-2 REMOVED
      null, // ADD: null de volta
      { key: "newField", type: "test" }, // ADD: novo campo
    ],
  };

  it("deve gerar diffs entre todos os steps (mix caótico)", () => {
    const diffs: any[] = [];

    console.log("\n=== GERANDO DIFFS (Mix Caótico) ===\n");

    for (let i = 0; i < 7; i++) {
      const current = history[`step${i}` as keyof typeof history];
      const next = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(current, next);
      diffs.push(diff);

      console.log(`📝 Diff ${i} → ${i + 1}:`);
      console.log(`   Length: ${current.length} → ${next.length}`);
      console.log(`   ArrayOps: ${diff.$__arrayOps?.length || 0} ops`);

      const patches = Object.keys(diff).filter((k) => k !== "$__arrayOps");
      if (patches.length > 0) {
        console.log(`   Patches: ${patches.length} keys`);
      }
      console.log();
    }

    expect(diffs.length).toBe(7);
  });

  it("deve aplicar diffs sequencialmente (forward caótico)", () => {
    let currentState = structuredClone(history.step0);

    console.log("\n=== APLICANDO DIFFS (Forward Caótico) ===\n");
    console.log(`Step 0: length=${currentState.length}`);

    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      currentState = patchJson(currentState, diff);

      console.log(`Step ${i + 1}: length=${currentState.length}`);

      // Verificar estado esperado
      expect(currentState).toEqual(to);
    }

    expect(currentState).toEqual(history.step7);
  });

  it("deve fazer rollback completo (backward caótico)", () => {
    let currentState = structuredClone(history.step7);

    const reverseDiffs: any[] = [];

    console.log("\n=== GERANDO REVERSE DIFFS ===\n");

    for (let i = 7; i > 0; i--) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i - 1}` as keyof typeof history];

      const reverseDiff = diffJson(from, to);
      reverseDiffs.push(reverseDiff);

      console.log(
        `🔄 Reverse diff ${i} → ${i - 1}: ${reverseDiff.$__arrayOps?.length || 0} ops`,
      );
    }

    console.log("\n=== APLICANDO ROLLBACK ===\n");

    for (let i = 0; i < 7; i++) {
      const expectedStep = 7 - i - 1;
      const expected = history[`step${expectedStep}` as keyof typeof history];

      currentState = patchJson(currentState, reverseDiffs[i]);

      console.log(`Step ${expectedStep}: length=${currentState.length}`);

      expect(currentState).toEqual(expected);
    }

    expect(currentState).toEqual(history.step0);
  });

  it("deve fazer round-trip completo (ida e volta)", () => {
    const original = structuredClone(history.step0);
    let state = structuredClone(original);

    console.log("\n=== ROUND-TRIP TEST (Caótico) ===\n");
    console.log(`Original: ${state.length} items`);

    // FORWARD
    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      state = patchJson(state, diff);
    }

    console.log(`After forward: ${state.length} items`);
    expect(state).toEqual(history.step7);

    // BACKWARD
    for (let i = 6; i >= 0; i--) {
      const from = history[`step${i + 1}` as keyof typeof history];
      const to = history[`step${i}` as keyof typeof history];

      const reverseDiff = diffJson(from, to);
      state = patchJson(state, reverseDiff);
    }

    console.log(`After backward: ${state.length} items`);
    expect(state).toEqual(original);

    console.log("\n✅ Round-trip successful!");
  });

  it("deve lidar com todos os tipos de dados", () => {
    // Step 0 tem:
    // - string, objeto com key, número, objeto com id, objeto sem id, null

    const state0 = history.step0;

    // Validar tipos
    expect(typeof state0[0]).toBe("string"); // "config-version-1.0"
    expect(typeof state0[1]).toBe("object"); // { key: "theme" }
    expect(typeof state0[2]).toBe("number"); // 42
    expect(typeof state0[3]).toBe("object"); // { id: 1 }
    expect(typeof state0[4]).toBe("object"); // { value: "random" }
    expect(state0[5]).toBe(null); // null

    console.log("\n=== TIPOS DE DADOS NO STEP 0 ===");
    state0.forEach((item: any, idx: number) => {
      const type = item === null ? "null" : typeof item;
      const desc =
        typeof item === "object" && item !== null
          ? JSON.stringify(item).substring(0, 30)
          : String(item);
      console.log(`  [${idx}] ${type}: ${desc}`);
    });
  });

  it("deve detectar moves em meio ao caos", () => {
    // step2 → step3: string move para o final
    const diff = diffJson(history.step2, history.step3);

    console.log("\n=== MOVE DETECTION (Caótico) ===");
    console.log("Diff:", JSON.stringify(diff, null, 2));

    const ops = diff.$__arrayOps || [];
    const moves = ops.filter((op: any) => op.type === "move");

    console.log(`\nTotal ops: ${ops.length}`);
    console.log(`Moves: ${moves.length}`);

    expect(moves.length).toBeGreaterThan(0);
  });

  it("deve aplicar patches em objetos nested", () => {
    // step3 → step4: altera settings.notifications e meta array

    const state3 = structuredClone(history.step3);
    const diff = diffJson(state3, history.step4);

    console.log("\n=== PATCHES EM NESTED ===");
    console.log(
      "Diff patches:",
      Object.keys(diff).filter((k) => k !== "$__arrayOps"),
    );

    const result = patchJson(state3, diff);

    // Encontrar objeto com settings
    const settingsObj: any = result.find(
      (x: any) => typeof x === "object" && x !== null && "settings" in x,
    );

    expect(settingsObj).toBeDefined();
    expect(settingsObj.settings.notifications).toBe(false); // mudou de true
    expect(settingsObj.settings.language).toBe("pt"); // mudou de en
    expect(settingsObj.meta).toEqual(["tag1", "tag2", "tag3"]); // adicionou tag3
  });

  it("deve lidar com substituição de tipos", () => {
    // step3 → step4: número 42 vira objeto { key: "timeout", value: 42 }

    const diff = diffJson(history.step3, history.step4);

    console.log("\n=== SUBSTITUIÇÃO DE TIPOS ===");

    const result = patchJson(history.step3, diff);

    // Índice 1 era número, agora é objeto
    expect(typeof history.step3[1]).toBe("number");
    expect(typeof result[1]).toBe("object");
    expect((result[1] as any).key).toBe("timeout");
    expect((result[1] as any).value).toBe(42);
  });

  it("deve validar integridade em cada step", () => {
    let state = structuredClone(history.step0);

    console.log("\n=== VALIDAÇÃO DE INTEGRIDADE (Caótico) ===\n");

    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      state = patchJson(state, diff);

      console.log(`Step ${i + 1}:`);
      console.log(`  Total items: ${state.length}`);

      // Contar tipos
      const types = state.reduce((acc: any, item: any) => {
        const type = item === null ? "null" : typeof item;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      console.log(`  Tipos:`, types);

      // Estado correto
      expect(state).toEqual(to);
    }

    console.log("\n✅ Integridade validada!");
  });

  it("deve preservar null e undefined corretamente", () => {
    // null em step0, removido em step1, volta em step7

    const state0 = history.step0;
    const state1 = history.step1;
    const state7 = history.step7;

    console.log("\n=== NULL/UNDEFINED ===");
    console.log(`Step 0 tem null: ${state0.includes(null)}`);
    console.log(`Step 1 tem null: ${state1.includes(null)}`);
    console.log(`Step 7 tem null: ${state7.includes(null)}`);

    expect(state0.includes(null)).toBe(true);
    expect(state1.includes(null)).toBe(true); // ainda tem
    expect(state7.includes(null)).toBe(true); // volta
  });

  it("deve lidar com objetos com id numérico E string", () => {
    // step1 tem:
    // { id: 1 } - numérico
    // { id: "user-2" } - string

    const state = history.step5; // tem ambos

    const numericId = state.find(
      (x: any) => typeof x === "object" && x !== null && x.id === 1,
    );

    const stringId = state.find(
      (x: any) => typeof x === "object" && x !== null && x.id === "user-2",
    );

    console.log("\n=== IDs NUMÉRICOS E STRING ===");
    console.log("Objeto com id=1:", numericId);
    console.log("Objeto com id='user-2':", stringId);

    expect(numericId).toBeDefined();
    expect(stringId).toBeDefined();

    // Aplicar diff e verificar que ambos são rastreados
    const diff56 = diffJson(history.step5, history.step6);

    console.log(
      "\nPatches no diff 5→6:",
      Object.keys(diff56).filter((k) => k !== "$__arrayOps"),
    );

    // user-2 deve ter patch (email mudou)
    expect(diff56["user-2"]).toBeDefined();
  });

  it("deve suportar arrays profundos e nested", () => {
    // step4 tem objeto com settings nested e meta array

    const state = history.step4;
    const complexObj: any = state.find(
      (x: any) => typeof x === "object" && x !== null && "settings" in x,
    );

    console.log("\n=== NESTED ARRAYS ===");
    console.log("Objeto complexo:", JSON.stringify(complexObj, null, 2));

    expect(complexObj.settings).toBeDefined();
    expect(Array.isArray(complexObj.meta)).toBe(true);
    expect(complexObj.meta.length).toBe(3);

    // Aplicar diff que altera nested
    const diff45 = diffJson(history.step4, history.step5);
    const result = patchJson(state, diff45);

    const updatedObj: any = result.find(
      (x: any) => typeof x === "object" && x !== null && "settings" in x,
    );

    // Verificar que nested foi preservado
    expect(updatedObj.settings.language).toBe("pt");
    expect(updatedObj.meta).toEqual(["tag1", "tag2", "tag3"]);
  });
});
