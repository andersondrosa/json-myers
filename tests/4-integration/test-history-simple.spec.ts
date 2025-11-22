import { describe, it, expect } from "vitest";
import { diffJson } from "../../src/2-diff/diffJson";
import { patchJson } from "../../src/3-patch/patchJson";

/**
 * Teste de histórico simplificado com arrays de strings (keys)
 *
 * Simula um fluxo Git-like:
 * - 7 steps (commits)
 * - Cada step é uma modificação do anterior
 * - Gera diffs entre steps (como git diff)
 * - Aplica diffs para frente (avança no histórico)
 * - Aplica diffs reversos (rollback ao estado inicial)
 */

describe("History Simple: Array de Strings (Git-like)", () => {
  // 7 steps de evolução de um array de campos
  const history = {
    step0: ["name", "email", "password", "age", "city"],

    step1: ["name", "email", "password", "age", "city", "phone"], // + phone

    step2: ["name", "email", "age", "city", "phone"], // - password

    step3: ["email", "name", "age", "city", "phone"], // move name↔email

    step4: ["email", "name", "age", "country", "phone"], // city → country

    step5: ["email", "name", "age", "country", "phone", "bio", "avatar"], // + bio, avatar

    step6: ["email", "age", "country", "phone", "bio", "avatar"], // - name

    step7: ["avatar", "bio", "email", "age", "country", "phone"], // reordenação
  };

  it("deve gerar diffs entre todos os steps (como git diff)", () => {
    const diffs: any[] = [];

    console.log("\n=== GERANDO DIFFS (Git-like) ===\n");

    // Gerar diff entre cada step
    for (let i = 0; i < 7; i++) {
      const current = history[`step${i}` as keyof typeof history];
      const next = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(current, next);
      diffs.push(diff);

      console.log(`📝 Diff ${i} → ${i + 1}:`);
      console.log(`   From: [${current.join(", ")}]`);
      console.log(`   To:   [${next.join(", ")}]`);
      console.log(`   Ops:  ${JSON.stringify(diff.$__arrayOps || [])}\n`);
    }

    expect(diffs.length).toBe(7);

    // Salvar diffs para inspeção
    console.log("\n=== DIFFS GERADOS ===");
    diffs.forEach((diff, idx) => {
      console.log(`\nDiff ${idx}:`, JSON.stringify(diff, null, 2));
    });
  });

  it("deve aplicar diffs sequencialmente (avançar histórico)", () => {
    let currentState = [...history.step0];

    console.log("\n=== APLICANDO DIFFS (Forward) ===\n");
    console.log(`Step 0: [${currentState.join(", ")}]`);

    // Aplicar cada diff
    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      currentState = patchJson(currentState, diff);

      console.log(`Step ${i + 1}: [${currentState.join(", ")}]`);

      // Verificar se chegou no estado esperado
      expect(currentState).toEqual(to);
    }

    // Estado final deve ser step7
    expect(currentState).toEqual(history.step7);
  });

  it("deve fazer rollback completo aplicando diffs reversos", () => {
    // Começar do step7
    let currentState = [...history.step7];

    // Gerar diffs reversos
    const reverseDiffs: any[] = [];

    console.log("\n=== GERANDO REVERSE DIFFS ===\n");

    for (let i = 7; i > 0; i--) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i - 1}` as keyof typeof history];

      const reverseDiff = diffJson(from, to);
      reverseDiffs.push(reverseDiff);

      console.log(`🔄 Reverse diff ${i} → ${i - 1}:`);
      console.log(`   From: [${from.join(", ")}]`);
      console.log(`   To:   [${to.join(", ")}]`);
    }

    console.log("\n=== APLICANDO ROLLBACK ===\n");
    console.log(`Start: [${currentState.join(", ")}]`);

    // Aplicar reverse diffs
    for (let i = 0; i < 7; i++) {
      const expectedStep = 7 - i - 1;
      const expected = history[`step${expectedStep}` as keyof typeof history];

      currentState = patchJson(currentState, reverseDiffs[i]);

      console.log(`Step ${expectedStep}: [${currentState.join(", ")}]`);

      // Verificar se voltou ao estado correto
      expect(currentState).toEqual(expected);
    }

    // Deve voltar ao step0 original
    expect(currentState).toEqual(history.step0);
  });

  it("deve fazer round-trip completo: forward → backward", () => {
    const original = [...history.step0];
    let state = [...original];

    console.log("\n=== ROUND-TRIP TEST ===\n");
    console.log(`Original: [${original.join(", ")}]\n`);

    // FORWARD: Aplicar todos os diffs
    const forwardDiffs: any[] = [];

    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      forwardDiffs.push(diff);

      state = patchJson(state, diff);
    }

    console.log(`After forward: [${state.join(", ")}]`);
    expect(state).toEqual(history.step7);

    // BACKWARD: Reverter todos os diffs
    for (let i = 6; i >= 0; i--) {
      const from = history[`step${i + 1}` as keyof typeof history];
      const to = history[`step${i}` as keyof typeof history];

      const reverseDiff = diffJson(from, to);
      state = patchJson(state, reverseDiff);
    }

    console.log(`After backward: [${state.join(", ")}]`);
    expect(state).toEqual(original);

    console.log("\n✅ Round-trip successful!");
  });

  it("deve preservar idempotência: aplicar diff duas vezes", () => {
    const from = history.step3;
    const to = history.step4;

    const diff = diffJson(from, to);

    // Aplicar diff
    const result1 = patchJson(from, diff);
    expect(result1).toEqual(to);

    // Aplicar diff novamente no resultado (não deve mudar)
    const result2 = patchJson(result1, diff);

    console.log("\n=== IDEMPOTÊNCIA ===");
    console.log(`From:     [${from.join(", ")}]`);
    console.log(`To:       [${to.join(", ")}]`);
    console.log(`Result 1: [${result1.join(", ")}]`);
    console.log(`Result 2: [${result2.join(", ")}]`);

    // Segundo apply não deve mudar nada (já está no estado final)
    // Nota: Pode adicionar items duplicados se não for idempotente
    expect(result2).toEqual(result1);
  });

  it("deve detectar corretamente moves vs remove+add", () => {
    // step2 → step3: apenas troca de posição (move)
    const from = history.step2;
    const to = history.step3;

    const diff = diffJson(from, to);

    console.log("\n=== MOVE DETECTION ===");
    console.log(`From: [${from.join(", ")}]`);
    console.log(`To:   [${to.join(", ")}]`);
    console.log(`Diff:`, JSON.stringify(diff, null, 2));

    // Deve ter detectado como move, não como remove+add
    const ops = diff.$__arrayOps || [];
    const moves = ops.filter((op: any) => op.type === "move");
    const removes = ops.filter((op: any) => op.type === "remove");
    const adds = ops.filter((op: any) => op.type === "add");

    console.log(`\nMoves: ${moves.length}`);
    console.log(`Removes: ${removes.length}`);
    console.log(`Adds: ${adds.length}`);

    // Como apenas houve troca, deve ter moves
    expect(moves.length).toBeGreaterThan(0);
  });

  it("deve lidar com múltiplas operações no mesmo diff", () => {
    // step4 → step5: adiciona 2 items
    const diff45 = diffJson(history.step4, history.step5);

    // step5 → step6: remove 1 item
    const diff56 = diffJson(history.step5, history.step6);

    // step6 → step7: move múltiplos items
    const diff67 = diffJson(history.step6, history.step7);

    console.log("\n=== OPERAÇÕES MÚLTIPLAS ===");
    console.log(
      "\nDiff 4→5 (adds):",
      JSON.stringify(diff45.$__arrayOps, null, 2),
    );
    console.log(
      "\nDiff 5→6 (remove):",
      JSON.stringify(diff56.$__arrayOps, null, 2),
    );
    console.log(
      "\nDiff 6→7 (moves):",
      JSON.stringify(diff67.$__arrayOps, null, 2),
    );

    // Aplicar sequencialmente
    let state = [...history.step4];

    state = patchJson(state, diff45);
    expect(state).toEqual(history.step5);

    state = patchJson(state, diff56);
    expect(state).toEqual(history.step6);

    state = patchJson(state, diff67);
    expect(state).toEqual(history.step7);
  });
});
