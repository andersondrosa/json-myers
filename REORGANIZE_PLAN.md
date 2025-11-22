# Plano de Reorganização por Camadas

## SRC - Organização por Camadas

### 1-core/ (Algoritmo Myers Base)
- myersDiff.ts
- myersDiffOptimization.ts
- applyMyersDiff() (extrair de myersDiff.ts)

### 2-diff/ (Geração de Diffs)
- diffJson.ts (entry point)
- diffArray.ts
- diffObject.ts
- diffSmartKeys.ts
- primitives.ts
- utils.ts
- addRemovedSmartKeys.ts

### 3-patch/ (Aplicação de Patches)
- patchJson.ts
- applyArrayOps.ts
- applyMovesWithIndexTracking() (já está em patchJson.ts)

### 4-utils/ (Utilitários)
- convertJsonMyersToGitDiff.ts
- utils/index.ts

### Raiz (manter)
- index.ts (exports principais)
- types.ts (tipos globais)
- diff-ready.ts (?)

---

## TESTS - Organização por Camadas

### 1-core/
MOVER:
- tests/myers-diff.spec.ts → tests/1-core/myers-diff.spec.ts
- tests/myers-diff-optimization.spec.ts → tests/1-core/myers-optimization.spec.ts
- tests/myers-optimization-bug.spec.ts → tests/1-core/myers-optimization-bug.spec.ts

CRIAR:
- tests/1-core/apply-myers-diff.spec.ts (testes de aplicação base)

### 2-diff/
MOVER:
- tests/diff/*.spec.ts → tests/2-diff/*.spec.ts
  - diffJson.spec.ts
  - diffCode.test.ts
  - json-diff.spec.ts
  - json-diff-with-duplicated-keys.spec.ts
  - diff-array.spec.ts
  - diff-object.spec.ts
  - diff-smart-keys.spec.ts
  - smart-keys-id-support.spec.ts
  - applyArrayOps.spec.ts

### 3-patch/
MOVER:
- tests/patch/apply-moves.spec.ts → tests/3-patch/patch-moves.spec.ts (SKIPADO)

CRIAR:
- tests/3-patch/patch-primitives.spec.ts
- tests/3-patch/patch-objects.spec.ts
- tests/3-patch/patch-arrays.spec.ts

### 4-integration/
MOVER:
- tests/merge/merge.spec.ts → tests/4-integration/diff-and-patch.spec.ts
- tests/merge/deep-merge.spec.ts → tests/4-integration/deep-diff-patch.spec.ts
- tests/merge/test-history.spec.ts → tests/4-integration/history-rollback.spec.ts

ADICIONAR:
- tests/core/moves-base.spec.ts → tests/1-core/moves-base.spec.ts

### Deletar (temporários)
- tests/debug-move-keys.spec.ts
- test-*.ts (arquivos de debug na raiz)

---

## Comandos de Reorganização

```bash
# SRC
mv src/myersDiff.ts src/1-core/
mv src/myersDiffOptimization.ts src/1-core/

mv src/diff/*.ts src/2-diff/

mv src/patchJson.ts src/3-patch/
mv src/diff/applyArrayOps.ts src/3-patch/

mv src/convertJsonMyersToGitDiff.ts src/4-utils/
mv src/utils src/4-utils/

# TESTS
mv tests/myers*.spec.ts tests/1-core/
mv tests/core/moves-base.spec.ts tests/1-core/

mv tests/diff/*.spec.ts tests/2-diff/

mv tests/patch/*.spec.ts tests/3-patch/

mv tests/merge/*.spec.ts tests/4-integration/
```
