# Arquitetura

Visão geral da estrutura interna de `json-myers`. Para detalhes de componentes específicos, veja os documentos referenciados ao longo do texto.

---

## Visão de uma frase

`json-myers` é uma biblioteca TypeScript de diff/patch para JSON. O core é o **algoritmo de Myers** rodando sobre uma projeção de identidade dos arrays (smart keys), com pós-processamento que detecta moves e aplica patches aninhados.

---

## Camadas

A pasta `src/` está organizada em 4 camadas com responsabilidades isoladas:

```
┌─────────────────────────────────────────────────────────┐
│  API pública  (src/index.ts)                            │
│  diffJson · patchJson · diff · patch · myersDiff · ...  │
└─────────────────────────────────────────────────────────┘
            │                              │
┌───────────┴────────────┐    ┌────────────┴──────────────┐
│  diff/                 │    │  patch/                   │
│  Geração de diferenças │    │  Aplicação de patches     │
│  ──────────────────    │    │  ──────────────────       │
│  diffJson              │    │  patchJson                │
│  diffArray             │    │                           │
│  diffObject            │    │                           │
│  diffSmartKeys         │    │                           │
│  applyArrayOps         │    │                           │
│  primitives            │    │                           │
│  utils                 │    │                           │
└────────────┬───────────┘    └────────────┬──────────────┘
             │                             │
             └──────────────┬──────────────┘
                            │
            ┌───────────────┴───────────────┐
            │  core/                        │
            │  Algoritmo Myers base         │
            │  ──────────────────           │
            │  myersDiff (O(ND))            │
            │  applyMyersDiff               │
            │  rollbackMyersDiff            │
            │  myersDiffOptimization        │
            │  optimizedDiffToMyersRaw      │
            └───────────────────────────────┘

            ┌───────────────────────────────┐
            │  utils/                       │
            │  Conversões auxiliares        │
            │  convertJsonMyersToGitDiff    │
            └───────────────────────────────┘

            ┌───────────────────────────────┐
            │  constants.ts                 │
            │  REMOVE_MARKER · ARRAY_OPS_KEY · SMART_KEY_PREFIX │
            └───────────────────────────────┘
```

### Mapa arquivo → conceito

| Arquivo | Responsabilidade |
|---|---|
| `src/core/myersDiff.ts` | Algoritmo Myers O(ND): `myersDiff`, `applyMyersDiff`, `rollbackMyersDiff` |
| `src/core/myersDiffOptimization.ts` | Pareia `remove + add` do mesmo item em `move`; e o inverso |
| `src/diff/diffJson.ts` | Entry point — despacha por tipo (primitivo / array / objeto) |
| `src/diff/diffArray.ts` | Constrói identidades, chama Myers, traduz ops para o formato de diff |
| `src/diff/diffObject.ts` | Diff chave-a-chave de objetos (com `$__remove` para propriedades removidas) |
| `src/diff/diffSmartKeys.ts` | Diff aninhado de objetos com mesma identidade em arrays |
| `src/diff/applyArrayOps.ts` | Traduz ops do Myers (identidades `#key`) para o formato final do diff |
| `src/diff/primitives.ts` | `isPrimitiveDiff`, `primitiveDiff` |
| `src/diff/utils.ts` | `getKey`, `getArrayItemIdentity`, `escape/unescapeIdentity`, `isNonEmptyDiff` |
| `src/patch/patchJson.ts` | Aplicação completa do diff (com ajuste de índices, smart keys, recursão) |
| `src/utils/convertJsonMyersToGitDiff.ts` | Renderiza array-diff como unified diff (uso opcional, p/ visualização) |
| `src/constants.ts` | Constantes textuais: `REMOVE_MARKER`, `ARRAY_OPS_KEY`, `SMART_KEY_PREFIX` |

---

## Fluxo de dados

### Geração de diff (`diffJson`)

```
diffJson(a, b)
  ├─ ambos primitivos?     → primitiveDiff
  ├─ ambos arrays?         → diffArray
  │                            ├─ gera identidades (smart keys + escape)
  │                            ├─ myersDiff(idsA, idsB)
  │                            ├─ myersDiffOptimization → moves
  │                            ├─ applyArrayOps → ops finais com #key
  │                            └─ diffSmartKeys → diffs aninhados por identidade
  └─ ambos objetos?        → diffObject (recursão via diffJson)
```

### Aplicação de patch (`patchJson`)

```
patchJson(base, diff)
  ├─ diff primitivo?       → retorna diff
  ├─ base é array + $__arrayOps?
  │     1. removes (maior → menor)
  │     2. ajusta moves
  │     3. moves (resolvendo #key, convertendo em remove+add)
  │     4. adds (menor → maior)
  │     5. patches aninhados por identidade
  └─ objeto?               → itera chaves, recursão
```

Detalhes em [`PATCH_LOGIC.md`](./PATCH_LOGIC.md).

---

## Decisões de design

### Por que Myers

Comparado a alternativas comuns:

| Algoritmo | Complexidade | Detecta moves | Usado por |
|---|---|---|---|
| **Myers** | O(N·D) | Sim (com pós-proc) | Git, este projeto |
| LCS clássico | O(N²) | Não | json-patch |
| Diff recursivo ingênuo | O(N) | Não | deep-diff |

Myers é matematicamente ótimo para o problema de "menor script de edição" e tem o overhead razoável de `D · N` quando as mudanças são pequenas.

### Por que smart keys

Arrays de objetos em JSON não têm identidade nativa. Sem smart keys, qualquer reordenação vira `remove + add` em massa. Tracking por `id`/`key` permite:

- Detectar **moves** em vez de tratar como remove+add
- Aplicar **patches aninhados** (mudança interna do objeto move)
- Diffs **drasticamente menores** em arrays com identidade

Veja [`SMART_KEYS.md`](./SMART_KEYS.md).

### Por que o sistema de escape

`{ key: "a" }` gera identidade `"#a"`. Mas e se houver uma string literal `"#a"` no mesmo array? Sem escape, colidem.

Solução: strings começando com `#` ou `\` ganham um `\` na frente; `unescapeIdentity` reverte no patch. Detalhes em [`SMART_KEYS.md`](./SMART_KEYS.md#sistema-de-escape).

### Por que separar `diff/` de `patch/`

Geração e aplicação são fluxos independentes — você pode gerar um diff num cliente e aplicar num servidor, ou vice-versa, sem nunca carregar a camada oposta. A separação reflete isso e mantém o bundle navegável.

### Por que `core/` é só Myers

O algoritmo de Myers é uma primitiva pura (entrada: dois arrays; saída: ops). Toda a complexidade específica de JSON — identidades, recursão, patches aninhados — vive em `diff/` e `patch/`. Essa separação permite que `core/` seja reutilizado para qualquer sequência (strings, arrays de números, etc).

### Por que imutabilidade

Tanto `diffJson` quanto `patchJson` nunca mutam suas entradas. Isso permite uso seguro em React/Redux, estruturas compartilhadas e ambientes funcionais. O custo é um clone raso por nível, mitigado por structural sharing.

---

## Performance

### Complexidade

| Operação | Caso médio | Pior caso |
|---|---|---|
| `myersDiff(a, b)` | O(N·D) | O(N²) |
| `diffJson` (objetos) | O(K) onde K = nº chaves | O(K) |
| `diffJson` (arrays) | dominado por Myers | O(N²) |
| `patchJson` | O(N) | O(N·M) onde M = nº moves |

`D` = distância de edição (nº de ops não-diagonais).

### Otimizações implementadas

- **Aplicação ordenada**: removes do maior pra menor, adds do menor pra maior → cada splice é O(N) único, sem reindexação repetida
- **Clone raso**: `[...arr]` e `{...obj}` apenas no nível atual; recursão só onde há mudança
- **Lookup por identidade no move**: ao resolver `#key`, busca o objeto original no `base` em vez de fazer `JSON.parse` da string — ~10× mais rápido
- **Primeira ocorrência apenas**: keys duplicadas são tratadas só na primeira, evitando ambiguidade

### O que **não** é otimizado

Estas otimizações são plausíveis no futuro mas **não estão implementadas**:

- Cache de identidades via WeakMap
- String interning para identidades repetidas
- Early-exit por igualdade referencial em sub-árvores
- Chunking para arrays muito grandes

Benchmarks não foram medidos formalmente — não há números reais a citar.

---

## Testes

Estrutura em `tests/`:

```
tests/
├─ 1-core/         # Myers cru e otimização
├─ 2-diff/         # Geração de diff por tipo
└─ 3-integration/  # Round-trip, histórico, casos reais, suíte de conformidade
```

**Status atual: 269/269 passando** (156 unit/integration + 49 merge-conformance + 64 reorder-conformance). Rodar com `pnpm test`.

Duas suítes de conformidade em `docs/`:
- [`json-merge-conformance.json`](./json-merge-conformance.json) — valida as 5 regras semânticas (R1–R5) de `patchJson`
- [`json-reorder-conformance.json`](./json-reorder-conformance.json) — valida determinismo de `diffJson` e simetria de round-trip (RD1–RD4) para reordenações

---

## Build

- TypeScript 5.x + tsup
- Saída: CJS (`dist/index.js`), ESM (`dist/index.mjs`), tipos (`dist/index.d.ts`/`.d.mts`)
- Sem dependências em runtime
- Tamanho: ~16KB CJS, ~14KB ESM (não minificado)

---

## Roadmap (não-vinculante)

- Tipagem real da API pública (substituir `any` por tipos discriminados)
- Benchmarks formais com `vitest bench` ou tinybench
- Investigação do edge case em `myers-optimization-bug.spec.ts`
- CHANGELOG.md formal e bumps semver disciplinados
