# JSON-myers Conformance — v2

Spec executável do contrato que `json-myers` (e qualquer implementação que
se proponha equivalente) deve satisfazer pra ser usada como `mergeStrategy:
"myers"` no StateDelta.

> Esta pasta é publicada junto com o package `json-myers` —
> outras implementações podem consumir os JSONs daqui pra validar
> conformidade.

## Arquivos

- [`json-merge-conformance.json`](./json-merge-conformance.json) — casos
  `(base, patch, expected | throws | strict_throws | collection_throws)`
  testando **aplicação de patches** (`patchJson`). Categorizados por
  regra (R1–R10). Casos com `strict_throws` rodam em ambos os modos
  (normal + strict); casos com `collection_throws` validam o
  `CollectionAssertionError`.
- [`json-reorder-conformance.json`](./json-reorder-conformance.json) — 16
  casos `(base, modified)` testando **geração de diff** (`diffJson`):
  determinismo (estabilidade em N runs) + simetria de round-trip. Sem
  fixar valores canônicos.

## Mudanças vs v1

| v1 | v2 | Por quê |
|---|---|---|
| `$__arrayOps` | `$ops` | `$` já sinaliza system-reserved; `__` é ruído |
| `$__remove: true` (per-key) | `$remove: [...keys]` (bulk) | Forma única cobre single e bulk; processado antes do merge |
| `remove { index, item }` | `remove { index }` | `item` redundante; índice já identifica |
| `move { from, to, item }` | `move { from, to }` | `item` redundante |
| (sem) | `move { key, to }` | Move smart-key como op de primeira classe |
| `ARRAY_OPS_BASE_NOT_ARRAY` | `OPS_BASE_NOT_ARRAY` | Casa com `$ops` |

`remove key=X` + `add key=X` continua aceito como **açúcar sintático**
equivalente a `move key=X to=N` — identidade do item é preservada.

## Regras (resumo)

1. **R1** — Arrays no patch (sem `$ops`) **sempre substituem** o array
   base. Nunca fazem merge por índice.
2. **R2** — Mudança de tipo (array↔objeto↔primitivo) → patch substitui
   base inteiramente.
3. **R3** — Recursão estrutural só em pares `(objeto, objeto)` cujo patch
   não é objeto com `$ops`.
4. **R4** — `$ops` é a marca estrutural de array: smart-keys quando os
   itens têm identidade (`key`); posicional caso contrário (`index`).
   `move` é canônico; `remove key=X` + `add key=X` é açúcar.
5. **R5** — `$remove: [...keys]` apaga as chaves listadas, escopado ao
   nível do objeto onde aparece. Processado **antes** do merge regular:
   `{ $remove: ['a'], a: 9 }` → `{ a: 9 }` (efetivo reset).
6. **R6** — `$ops` requer base de tipo array naquela posição. Base de
   qualquer outro tipo (objeto, primitivo, ausente) → `throw`
   `OPS_BASE_NOT_ARRAY`. Fail-fast na fronteira (independente de modo).
7. **R7 — Modo strict.** `patchJson(base, patch, { strict: true })` —
   assume que o patch foi gerado por `diffJson(base, ...)` real.
   Qualquer divergência (chave que não existe, índice fora de range,
   move no-op, chave duplicada em add, smart-key lookup que falha) →
   `throw StrictViolationError` com código enumerado
   (`KEY_NOT_FOUND`, `INDEX_OUT_OF_RANGE`, `KEY_ALREADY_EXISTS`,
   `MOVE_NO_OP`, `OBJECT_KEY_NOT_FOUND`). Default é permissivo
   (silent-ignore).
8. **R8** — Diff de array sempre carrega `$ops` (mesmo vazio). É o
   discriminador estrutural "esta posição é um array".
9. **R9 — Identity per-array via wire.** Default `"id"`. Cada
   array-diff pode declarar `$identity: "<field>"` para override
   local. Ordem de resolução: `diff.$identity` → `options.identity` →
   `"id"`. Sem fallback dual (v2 `id` + `key` removido).
10. **R10 — Collection assertion.** Array-diff pode carregar
    `$assertCollection: true` — patcher pré-valida que a base é
    collection homogênea. Violação → `throw CollectionAssertionError`
    com código (`COLLECTION_NON_OBJECT_ITEM`,
    `COLLECTION_MISSING_IDENTITY`, `COLLECTION_DUPLICATE_IDENTITY`).
    Sempre lança (independente de strict mode). Inferido
    automaticamente pelo `diffJson`.

## Como rodar a merge conformance

```ts
import conformance from "./json-merge-conformance.json";
import { patchJson } from "json-myers";

for (const c of conformance.cases) {
  if (c.throws) {
    // R6 — deve lançar
    let threw = false;
    try { patchJson(c.base, c.patch); } catch { threw = true; }
    // assert threw === true
    continue;
  }
  const result = patchJson(c.base, c.patch);
  // assert deepEqual(result, c.expected)
}
```

Casos com `throws: "OPS_BASE_NOT_ARRAY"` testam a R6 — a chamada deve
lançar.

## Como rodar a reorder conformance

```ts
import reorder from "./json-reorder-conformance.json";
import { diffJson, patchJson } from "json-myers";

for (const c of reorder.cases) {
  // RD1 — estabilidade em N runs
  const runs = Array.from({ length: 5 }, () => diffJson(c.base, c.modified));
  // assert all runs deepEqual to runs[0]

  // RD2 — forward
  // assert deepEqual(patchJson(c.base, runs[0]), c.modified)

  // RD3 — backward (reverse)
  const reverseDiff = diffJson(c.modified, c.base);
  // assert deepEqual(patchJson(c.modified, reverseDiff), c.base)
}
```

## Status

| Implementação | merge (84 tests) | reorder (16 cases / 64 tests) |
|---|---|---|
| `json-myers` npm (1.0.3, spec v1) | parcial — falha R1, R2, R5-bulk, R6, R7, R8 | 15/16 (bug `move from:X to:X`) |
| `json-myers` (workspace, spec v2) | **84/84 ✅** | **64/64 ✅** |

A implementação local `json-myers` é a referência v2.
