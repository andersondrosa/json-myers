import { describe, it, expect } from "vitest";
import { diffJson, patchJson } from "../../src";

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


    // Gerar diff entre cada step
    for (let i = 0; i < 7; i++) {
      const current = history[`step${i}` as keyof typeof history];
      const next = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(current, next);
      diffs.push(diff);

    }

    expect(diffs.length).toBe(7);

    // Salvar diffs para inspeção
    diffs.forEach((diff, idx) => {
    });
  });

  it("deve aplicar diffs sequencialmente (avançar histórico)", () => {
    let currentState = [...history.step0];


    // Aplicar cada diff
    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      currentState = patchJson(currentState, diff);


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


    for (let i = 7; i > 0; i--) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i - 1}` as keyof typeof history];

      const reverseDiff = diffJson(from, to);
      reverseDiffs.push(reverseDiff);

    }


    // Aplicar reverse diffs
    for (let i = 0; i < 7; i++) {
      const expectedStep = 7 - i - 1;
      const expected = history[`step${expectedStep}` as keyof typeof history];

      currentState = patchJson(currentState, reverseDiffs[i]);


      // Verificar se voltou ao estado correto
      expect(currentState).toEqual(expected);
    }

    // Deve voltar ao step0 original
    expect(currentState).toEqual(history.step0);
  });

  it("deve fazer round-trip completo: forward → backward", () => {
    const original = [...history.step0];
    let state = [...original];


    // FORWARD: Aplicar todos os diffs
    const forwardDiffs: any[] = [];

    for (let i = 0; i < 7; i++) {
      const from = history[`step${i}` as keyof typeof history];
      const to = history[`step${i + 1}` as keyof typeof history];

      const diff = diffJson(from, to);
      forwardDiffs.push(diff);

      state = patchJson(state, diff);
    }

    expect(state).toEqual(history.step7);

    // BACKWARD: Reverter todos os diffs
    for (let i = 6; i >= 0; i--) {
      const from = history[`step${i + 1}` as keyof typeof history];
      const to = history[`step${i}` as keyof typeof history];

      const reverseDiff = diffJson(from, to);
      state = patchJson(state, reverseDiff);
    }

    expect(state).toEqual(original);

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


    // Segundo apply não deve mudar nada (já está no estado final)
    // Nota: Pode adicionar items duplicados se não for idempotente
    expect(result2).toEqual(result1);
  });

  it("deve detectar corretamente moves vs remove+add", () => {
    // step2 → step3: apenas troca de posição (move)
    const from = history.step2;
    const to = history.step3;

    const diff = diffJson(from, to);


    // Deve ter detectado como move, não como remove+add
    const ops = diff.$__arrayOps || [];
    const moves = ops.filter((op: any) => op.type === "move");
    const removes = ops.filter((op: any) => op.type === "remove");
    const adds = ops.filter((op: any) => op.type === "add");


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
