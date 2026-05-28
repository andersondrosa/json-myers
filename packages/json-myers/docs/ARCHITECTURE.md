# json-myers — Arquitetura

Internals técnicos do pacote `json-myers`. Para a visão de
alto nível e API pública, veja
[`README.md`](../README.md). Para o registro de cada decisão de design
(incluindo rejeições), veja [`DECISIONS.md`](./DECISIONS.md).

---

## Estrutura do código

```
packages/json-myers/
├── src/
│   ├── index.ts             ← Full entry: diff + patch + tudo
│   ├── patch-entry.ts       ← Patch-only entry (subset pra /patch)
│   ├── types.ts             ← Op, Diff, PatchOptions, Errors
│   ├── myers.ts             ← Algoritmo O(ND) puro
│   ├── fingerprint.ts       ← FNV-1a recursivo + smart-key
│   ├── diffJson.ts          ← Despachador top-level + NO_CHANGE sentinel
│   ├── diffArray.ts         ← fingerprint + Myers + smart-key updates
│   ├── diffObject.ts        ← Recursão key-by-key + $remove
│   ├── patch.ts             ← Despachador top-level + R6 throw
│   ├── applyArrayOps.ts     ← Aplicação de $ops (3 fases)
│   └── *.test.ts            ← Unit tests co-localizados (vitest)
├── tests/
│   ├── patch.conformance.test.ts        ← Runner spec R1–R11 (107 testes)
│   ├── diff.conformance.test.ts         ← Runner spec RD1–RD4 (64 testes)
│   └── myers.git-equivalence.test.ts    ← Equivalência com git diff (86 testes)
├── conformance/
│   ├── README.md
│   ├── json-merge-conformance.json      ← Spec executável de aplicação
│   └── json-reorder-conformance.json    ← Spec executável de geração
└── ...
```

### Dois entry-points

`tsup` gera dois bundles separados — ambos no mesmo package, expostos
via `exports` map no `package.json`:

| Entry-point | Bundle ESM | Bundle CJS | API |
|---|---|---|---|
| `json-myers` | ~9.5 KB | ~9.5 KB | tudo (diff + patch + myers + fingerprint) |
| `json-myers/patch` | ~4.9 KB | ~4.9 KB | só `patchJson`, `applyArrayOps`, errors, types |

Quem só APLICA patches (clients, launchers, ETL targets) importa de
`/patch` e ganha **~51% de redução** no bundle. Quem gera diffs
importa do entry padrão.

Internamente, `src/patch-entry.ts` é um arquivo de re-exports curado
— não duplica código, apenas expõe o subset relevante. Tree-shaking
do bundler consumidor + entry-point separado garantem que código de
diff não vaze no bundle de quem só importa `/patch`.

---

## Camadas

```
┌─────────────────────────────────────────────────────────────────┐
│                       API PÚBLICA                               │
│   diffJson, diffArray, diffObject, patchJson, applyArrayOps,    │
│   myers, fingerprintItem, hashValue                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                    DESPACHO POR TIPO                            │
│   diffJson (a, b) → array? object? primitive? type-change?     │
│   patchJson (base, diff) → $ops? plain object? primitive?      │
└──────────────┬─────────────────────────────┬────────────────────┘
               │                             │
┌──────────────┴──────────────┐ ┌────────────┴────────────────────┐
│        GERAÇÃO (diff)       │ │        APLICAÇÃO (patch)        │
│                             │ │                                 │
│  diffArray ←→ diffObject    │ │  applyArrayOps (3 fases)        │
│  (mutual recursion via      │ │  + nested-update por smart-key  │
│   diffJsonInner)            │ │  + dispatch one-shot (smart-key │
│                             │ │    Map vs :index posicional)    │
└──────────────┬──────────────┘ └─────────────────────────────────┘
               │
┌──────────────┴──────────────┐
│      IDENTIDADE             │
│  fingerprintItem(value)     │
│  → "p:..." / "#..." / "h:.." │
│                             │
│  hashValue(value) → uint32  │
│  (FNV-1a 32-bit recursivo)  │
└──────────────┬──────────────┘
               │
┌──────────────┴──────────────┐
│     ALGORITMO PURO          │
│  myers(a, b, eq?) →         │
│  Edit<T>[] (O(ND))          │
└─────────────────────────────┘
```

---

## Fluxos

### Fluxo de `diffJson(a, b)`

```
                a, b
                 │
                 ▼
       ┌──────────────────┐
       │ Object.is(a, b)? │── sim ──▶ NO_CHANGE
       └────────┬─────────┘
                │ não
                ▼
       ┌──────────────────┐
       │ Type mismatch?   │── sim ──▶ retorna `b` (R2 replace)
       └────────┬─────────┘
                │ não
        ┌───────┴────────┐
        ▼                ▼
   [array, array]   [object, object]
        │                │
        ▼                ▼
    diffArray        diffObject
        │                │
        │  ┌─────────────┘
        │  │
        │  ▼          (recursão via diffJsonInner em
        │  diffObject     valores não-trivialmente iguais)
        │  │
        ▼  ▼
   {  $ops: [...],   ← se array
      <smart-key>: <subDiff>,
      ...
   }
   OU
   {  $remove: [...],   ← se object
      <key>: <subDiff>,
      ...
   }
```

`diffJsonInner` retorna `NO_CHANGE` quando inputs são iguais — útil
para pais filtrarem entries triviais. `diffJson` público sempre
retorna um patch aplicável (no caso degenerado `a === b`, retorna o
no-op apropriado pra forma).

### Fluxo de `diffArray(a, b)`

```
       a, b (arrays)
            │
            ▼
   ┌────────────────────┐
   │ a.map(fingerprintItem) → fpA: string[] │
   │ b.map(fingerprintItem) → fpB: string[] │
   └─────────┬──────────┘
             │
             ▼
   ┌─────────────────────────┐
   │ myers(fpA, fpB)         │   ← O(ND) sobre strings, eq===
   │  → Edit<string>[]       │
   └─────────┬───────────────┘
             │
             ▼
   ┌─────────────────────────┐
   │ walk edits, manter      │
   │ aIdx / bIdx; emit       │
   │ RawOp por edit:         │
   │                         │
   │ keep:                   │
   │   - smart-key? recurse  │
   │     com diffJsonInner   │
   │   - else: skip          │
   │                         │
   │ del:                    │
   │   - smart-key? push     │
   │     { del, fp, key }    │
   │   - else: push          │
   │     { del, fp, aIdx }   │
   │                         │
   │ ins:                    │
   │   - smart-key? push     │
   │     { ins, fp, key,     │
   │       bIdx, bItem }     │
   │   - else: push          │
   │     { ins, fp, bIdx,    │
   │       bItem }           │
   └─────────┬───────────────┘
             │
             ▼
   ┌─────────────────────────────────┐
   │ coalesceMoves(raw, …) — O-001   │
   │                                 │
   │ 1. Bucket del/ins por fp        │
   │ 2. Resolve pares (smart-key     │
   │    only — positional move com   │
   │    múltiplas ops corromperia    │
   │    índices do patcher)          │
   │ 3. Emit em raw-order:           │
   │    - par smart-key → 1 move op  │
   │      + nested = diffJsonInner(  │
   │        a[del.aIdx], ins.bItem)  │
   │    - unpaired → remove/add      │
   │      standalone                 │
   └─────────┬───────────────────────┘
             │
             ▼
   { $ops: [...], <key>: <subDiff>, ... }
```

**O-001 (move generation)** — após o walk, `coalesceMoves` pareia
`(del fp, ins fp)` com mesma fingerprint e emite uma única op `move`
em vez de `remove + add`. Restrito a smart-key (positional move usa
índices relativos ao estado intermediário do patcher, que muta entre
moves — múltiplas ops posicionais corromperiam o resultado). O nested
update do smart-key move usa `diffJsonInner` em vez do seed inteiro,
produzindo wire mínimo: reorder puro (mesmo conteúdo) → nested omitido
via `NO_CHANGE`; reorder + mudança → apenas o delta.

### Fluxo de `patchJson(base, diff)`

```
              base, diff, options
                     │
                     ▼
         ┌───────────────────────┐
         │ diff null/primitive/  │── sim ──▶ retorna diff
         │ array ?               │
         └───────────┬───────────┘
                     │ não (diff é object)
                     ▼
         ┌───────────────────────┐
         │ diff tem $ops?        │── sim ──▶ ─┐
         └───────────┬───────────┘            │
                     │ não                    │
                     ▼                        ▼
         ┌───────────────────────┐    ┌──────────────────────┐
         │ base é object?        │    │ base é array?        │
         └─┬─────────────────┬───┘    └──┬──────────────────┬┘
           │ sim             │ não       │ sim              │ não
           ▼                 ▼           ▼                  ▼
   recurse key-by-key   R2: rebuild   applyArrayOps      throw R6
   ($remove first,      fresh         (3 fases)          OpsBaseNot…
    then merge)
```

### Fluxo de `applyArrayOps(base, opsDiff, options)`

Aplicação em **0 (resolve identity) → 0.5 (assert) → 0.75 (dispatch
one-shot + baseMap) → 3 fases + 1 post**:

```
       base (array), opsDiff.$ops = [Op, Op, Op, ...]
              │
              ▼
   ┌──────────────────────────┐
   │ FASE 0 — Resolve identity│
   │  diff.$identity          │
   │  → options.identity      │
   │  → "id" (default)        │
   │  isPositional =          │
   │    identity === ":index" │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │ FASE 0.5 — Collection    │
   │  assertion (se $assert-  │
   │  Collection: true E NÃO  │
   │  posicional). Throws     │
   │  CollectionAssertionError│
   │  em violação. Silenciada │
   │  quando :index.          │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │ FASE 0.75 — Dispatch     │
   │  one-shot:               │
   │  • baseMap = isPositional│
   │    ? null                │
   │    : buildKeyIndex(base) │
   │  • findInBase = closure  │
   │    (positional inline OU │
   │     baseMap.get())       │
   │  Construído UMA vez —    │
   │  zero overhead per-op.   │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │ Partition ops:           │
   │  - removes               │
   │  - positional moves      │
   │  - adds                  │
   │  (smart-key moves são    │
   │   pre-expandidos em      │
   │   remove + add; lookup   │
   │   via findInBase).       │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │ FASE 1 — Removes         │
   │  ordenados descendente   │
   │  por índice resolvido    │
   │  (smart-key via          │
   │  findInBase — O(1) via   │
   │  Map). Itens removidos   │
   │  por smart-key vão pro   │
   │  removedByKey cache.     │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │ FASE 2 — Positional      │
   │  moves: splice(from,1)   │
   │  + splice(to,0,item)     │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │ FASE 3 — Adds            │
   │  ordenados ascendente.   │
   │  Smart-key: pega do      │
   │  removedByKey OU         │
   │  buildFromSeed (lookup   │
   │  sibling no diff). Strict│
   │  collision check via     │
   │  indexOfSmartKey linear  │
   │  (result já mutou; raro).│
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │ FASE 4 — Nested updates  │
   │  • resultMap rebuilt     │
   │    sobre result mutado   │
   │  • findInResult closure  │
   │    (positional inline OU │
   │     resultMap.get())     │
   │  Pra cada sibling key    │
   │  não-marker: lookup O(1),│
   │  patchJson recursivo no  │
   │  item.                   │
   └──────────────────────────┘
```

**Otimização chave — Map-based lookup ([D-035](./DECISIONS.md#d-035--map-based-lookup-pra-eliminar-onm-nos-hot-paths)):** as 3 chamadas hot (partição de moves, Pass A de removes, fase 4 inteira) que antes faziam scan linear O(N) por sibling/op agora consultam um Map pré-computado. Em array de 1000 items com 50 nested updates: 50.000 comparações → 1.050. Aplicado universalmente em smart-key (não é opt-in); o caminho `:index` pula o Map (usa parse numérico direto).

**Princípio opt-in zero-cost (D-035):** o caminho `:index` não impõe overhead no caminho default. O despacho one-shot é construído via closure no escopo do `applyArrayOps` — V8 inline-cacheia e a função idiomática para smart-key resolve `Map<string, number>.get` direto.

Em modo **strict**, cada fase tem checks adicionais:

| Fase | Check strict | Erro |
|---|---|---|
| 1 (removes) | smart-key não encontrada | `KEY_NOT_FOUND` |
| 1 (removes) | índice fora de range | `INDEX_OUT_OF_RANGE` |
| 2 (moves) | `from === to` | `MOVE_NO_OP` |
| 2 (moves) | índice fora de range | `INDEX_OUT_OF_RANGE` |
| 3 (adds) | smart-key já existe | `KEY_ALREADY_EXISTS` |
| 4 (nested) | smart-key não bate item | `KEY_NOT_FOUND` |
| 4 (nested, `:index`) | sibling não-inteiro / fora de range | `KEY_NOT_FOUND` |

---

## Algoritmo de Myers — implementação

`src/myers.ts` contém a implementação clean-room do algoritmo de
Eugene Myers (1986), *"An O(ND) Difference Algorithm and Its
Variations"*. O algoritmo encontra o **menor** edit script (sequência
de inserções e deleções) que transforma `A` em `B`, onde `D` é a
distância de edição.

### Edit graph

```
       0   1   2   ←  Y (sequência destino B)
     +───+───+───+
   0 │   │ b │ c │
     +───+───+───+
   1 │ a │   │   │       Horizontal (X → X+1): DELETE A[x]
     +───+───+───+       Vertical   (Y → Y+1): INSERT B[y]
     ↓ X (sequência origem A)
                         Diagonal: KEEP (custo zero, "snake")
```

Estado por iteração `D`:

- `v[k]` = **furthest reaching x** alcançável na diagonal `k` com `D` edições
- `k = x - y` (cada caminho está numa única diagonal)
- Trace: snapshot de `v` por iteração, usado no backtracking

### Recorrência

Na iteração `D`, para cada `k ∈ [-D, D]` com passo 2:

```
x = v[k+1]      se k == -D  OR  (k != D  AND  v[k-1] < v[k+1])
                ^ vertical (insert)

x = v[k-1] + 1  caso contrário
                ^ horizontal (delete)

y = x - k

# follow the snake — estende a diagonal enquanto A[x] == B[y]:
while x < N and y < M and A[x] == B[y]:
    x++; y++

v[k] = x

if x >= N and y >= M:
    # alcançou o canto (N, M) — D é a distância mínima
    return backtrack(trace, A, B)
```

### Backtracking

Após encontrar `D` mínimo, walk reverso do `(N, M)` ao `(0, 0)`
usando o trace para reconstruir o edit script:

```
for D from trace.length - 1 down to 0:
    v = trace[D]
    k = x - y
    prev_k = k + 1 se came_from_insert  else  k - 1
    prev_x = v[prev_k]
    prev_y = prev_x - prev_k

    # snake reverso (keeps que vieram antes deste edit)
    while x > prev_x and y > prev_y:
        emit { keep, A[x-1] }
        x--; y--

    if D > 0:
        if x > prev_x:
            emit { del, A[x-1], index: x-1 }   # horizontal
        else:
            emit { ins, B[y-1], index: y-1 }   # vertical
        x, y = prev_x, prev_y
```

### Indexação

`v[k]` é guardado em `v[k + MAX]` onde `MAX = N + M` (offset para
manejar `k` negativo). Tamanho do array `v` = `2 * MAX + 1`.

### Edge cases

- `N === 0` → todos inserts em `B`
- `M === 0` → todos deletes em `A`
- `N === M` e `A === B` → todos keeps (snake completa em D=0)

### Complexidade

| Métrica | Big-O |
|---|---|
| Tempo | O((N + M) · D) |
| Espaço | O((N + M) · D) (trace cheio para backtracking) |
| Best case (A ≡ B) | O(N + M) (snake completa em D=0) |
| Worst case (totalmente diferentes) | O((N + M)²) |

**Trade-off conhecido:** versão linear-space de Myers existe
(divide-and-conquer com middle snake), mas adiciona complexidade. A
versão atual mantém o trace cheio — suficiente até tamanhos de
~10k items.

---

## Fingerprint — FNV-1a recursivo

`src/fingerprint.ts` produz um label estável para qualquer JSON value.

### Forma do fingerprint

```
"p:<tag>:<literal>"   primitivos
"#<key>"              objeto com id/key declarado
"h:<8-char-hex>"      objeto sem identidade OU array (hash de conteúdo)
```

### Tags de tipo (anti-colisão entre tipos)

| Constante | Valor | Tipo |
|---|---|---|
| `TAG_NULL` | `0x10` | `null` |
| `TAG_UNDEFINED` | `0x11` | `undefined` (não-JSON, defensivo) |
| `TAG_BOOLEAN` | `0x12` | `boolean` |
| `TAG_NUMBER` | `0x13` | `number` (incluindo NaN, Infinity) |
| `TAG_STRING` | `0x14` | `string` |
| `TAG_ARRAY` | `0x15` | `Array<unknown>` |
| `TAG_OBJECT` | `0x16` | `Record<string, unknown>` |

Sem essas tags, valores como `boolean true` e `string "true"`
colidiriam ao ser hashados.

### FNV-1a 32-bit

Algoritmo de hash não-criptográfico simples e rápido:

```
FNV_OFFSET = 0x811c9dc5
FNV_PRIME  = 0x01000193

mixByte(h, byte):
    h ^= byte
    h = h * FNV_PRIME   (mod 2^32 — via Math.imul)
    return h
```

Cada byte do conteúdo entra no hash via `mixByte`. Strings → cada char
code via `mixUint16`. Numbers → 8 bytes da representação IEEE-754 (via
`Float64Array` + `Uint8Array` view).

### Determinismo

- **Object keys ordenadas alfabeticamente** antes do mix — `{a:1,b:2}`
  e `{b:2,a:1}` produzem o mesmo hash.
- **Buffer reutilizado** (`NUM_BUF`, `NUM_F64`, `NUM_BYTES`) — evita
  alocação por número.
- **Sem random**, sem timestamps, sem dependência de ordem de
  iteração de Map/Set.

### Smart-key vs hash

```ts
fingerprintItem({ id: "alice", role: "user" })
// id é string → smart-key
// → "#alice"

fingerprintItem({ id: "alice", role: "admin" })
// mesmo id → mesma fingerprint (identidade preservada)
// → "#alice"

fingerprintItem({ role: "user", name: "Bob" })
// sem id/key → content hash
// → "h:7a3f1b2c"

fingerprintItem({ role: "admin", name: "Bob" })
// conteúdo diferente → hash diferente
// → "h:9e4d8c01"   (item "diferente" pelo diff)
```

**Crítico:** `id` aceita `string | number`. Outros tipos (boolean, array,
objeto, etc) caem no content hash — não viram smart-key.

### Anti-colisão entre literal e smart-key

```ts
fingerprintItem("#alice")           // "p:s:#alice"
fingerprintItem({ key: "alice" })   // "#alice"
```

O prefixo `"p:s:"` para strings garante que uma string literal
`"#alice"` nunca colida com a smart-key `"#alice"`. Dispensa o
"escape system" que o `json-myers` v1 precisava ter.

### `refCache` — cache de fingerprint por ref (opt-in)

```ts
diffJson(a, b, { refCache: true });
```

Quando ativado, `diffJson` cria um `WeakMap<object, string>` que é
propagado por toda a recursão (`diffArray`, `diffObject`,
`fingerprintItem`, `fingerprintArray`). O fingerprint de cada objeto
visitado é cacheado:

```ts
// fingerprint.ts — fast path no início de fingerprintItem
if (cache && value !== null && typeof value === "object") {
  const cached = cache.get(value as object);
  if (cached !== undefined) return cached;  // ← skip hash recursion
}
// … computa fp normal, depois:
if (cache && …) cache.set(value as object, fp);
```

Pura otimização: **output bit-idêntico** ao modo sem cache. Em
inputs com referências preservadas (Redux/Immer/Zustand), o cache
hit rate é alto e elimina recursão FNV-1a redundante. Em JSON
desserializado, refs são sempre novas — cache miss dominante, ~50ns
de overhead por lookup sem ganho.

Distinção crítica vs `===` semântico do `jsondiffpatch`:

| | `jsondiffpatch` (linha 20 de `matchItems`) | `refCache` |
|---|---|---|
| O que `ref` significa | "mesmo item" (semântica) | "mesmo fingerprint" (chave de cache) |
| Se user muta in-place | Resultado errado (silenciosamente) | Cache stale, mas violou contrato declarado |
| Determinismo | Depende do heap JS | Preservado (mesmo wire bit-a-bit) |
| Opt-in? | Não — implícito | **Sim** — `{ refCache: true }` |
| Funciona sem refs? | Cai pra posicional | Cache miss → calcula normal |

WeakMap garante GC: ao fim da chamada `diffJson`, refs sem
referência forte são liberadas. Sem leak.

---

## Mutual recursion via ESM

Os módulos de diff se chamam ciclicamente:

```
diffJson  ──┬─→ diffArray  ──→ (recursão via diffJsonInner)
            └─→ diffObject ──→ (recursão via diffJsonInner)
```

ESM lida com isso sem problemas porque:

1. As chamadas são **runtime**, não top-level. Quando o módulo
   carrega, só importa "function references" — não invoca nada.
2. Quando `diffJson` é chamado, todos os módulos já estão carregados.
3. Não há ciclo de inicialização (nenhum módulo precisa do valor de
   outro no top-level).

O `NO_CHANGE` symbol é declarado em `diffJson.ts` e importado por
ambos — não cria ciclo porque é uma constante simples.

---

## Sentinela `NO_CHANGE`

```ts
export const NO_CHANGE: unique symbol = Symbol("json-myers/no-change");
```

Único símbolo (não colidível com qualquer outro), usado **internamente**
pelas funções de diff para sinalizar "este sub-diff é trivial, não
emita".

`diffJsonInner` retorna `NO_CHANGE` quando `a` deep-iguala `b`. Pais
(`diffObject`, `diffArray`) checam e omitem entries triviais — o diff
fica **mínimo**.

A API pública `diffJson` nunca retorna `NO_CHANGE` — quando inputs são
iguais, retorna um patch no-op apropriado (`{ $ops: [] }`, `{}`, ou
`b`).

---

## Cache `removedByKey` na aplicação de ops

Quando o patcher encontra `remove key="X"`, ele guarda o item removido
no cache `removedByKey`. Quando depois encontra `add key="X"` (mesma
chave), reutiliza o item original em vez de construir um novo.

Isso implementa o **açúcar `remove + add` = `move`** sem precisar de
op `move` explícita. O autor pode escrever:

```json
{ "$ops": [
  { "type": "remove", "key": "X" },
  { "type": "add",    "key": "X", "index": 3 }
]}
```

…e obter o mesmo efeito que:

```json
{ "$ops": [{ "type": "move", "key": "X", "to": 3 }] }
```

Ambos preservam identidade e dados completos do item.

A presença do cache **muda o comportamento do add smart-key** se o
mesmo `key` foi removido na mesma transação. Se não foi, o add vai
buildar via `buildFromSeed`.

---

## `buildFromSeed` — construção de itens novos

Quando o patcher adiciona um item smart-key NOVO (que não foi
recém-removido), precisa construir o objeto inicial. A função
`buildFromSeed` faz isso em 2 passos:

1. **Detecta a convenção do array** — varre os itens existentes
   procurando `id` ou `key`. O primeiro encontrado dita o campo. Default
   `key` se array é vazio.
2. **Constrói o objeto** — `{ [field]: smartKey, ...seed }` onde
   `seed` vem da chave-sibling do `$ops` no diff (se existir).

Exemplo:

```ts
// Array existente tem { id: "..." }
const newItem = buildFromSeed(
  [{ id: "alice" }],   // detecta convenção "id"
  "bob",               // smart-key novo
  { role: "admin" },   // seed do sibling diff["bob"]
);
// → { id: "bob", role: "admin" }
```

---

## Identity — resolução per-array via wire (v3.x)

A v3.x abandona o `id ?? key` fallback do legado em favor de uma
**identity única, configurável por array via wire**.

### Ordem de resolução

Pra cada array que o patcher visita:

```
1. diff.$identity   (per-array, marker no wire — vence se presente)
2. options.identity (per-call, global — fallback)
3. "id"             (DEFAULT_IDENTITY)
```

`fingerprintItem(value, identity)` aceita o identity como segundo arg
— internamente `obj[identity]` é inspecionado. Tipos válidos:
`string | number`. Outros tipos (boolean, array, objeto) caem em
content hash.

### Casos de uso

```jsonc
// Caso 1: convenção uniforme em todo doc — só options
patchJson(doc, diff, { identity: "code" });

// Caso 2: arrays heterogêneos — wire per-array
{
  "users": {
    "$ops": [],              // ← usa "id" (default, $identity omitido)
    "alice": { ... }
  },
  "products": {
    "$ops": [],
    "$identity": "sku",      // ← override local
    "X-1": { ... }
  }
}

// Caso 3: combinado — options global + override pontual
patchJson(doc, diff, { identity: "userId" });
// → users[] usa "userId" (do options)
// → products[] também usa "userId" (do options)
// → MAS se products tem "$identity": "sku" no wire, vence local
```

### Diff também emite identity por array

`diffJson` aceita `DiffOptions.identity` (default `"id"`). Esse valor
é propagado em toda a recursão da chamada. Cada `diffArray` emite
`$identity` no output APENAS quando ≠ default — minimiza tamanho.

```ts
diffJson(a, b, { identity: "code" });
// Cada array-diff carrega $identity: "code"
```

### `:index` — identidade reservada para arrays posicionais

`POSITIONAL_IDENTITY = ":index"` é um valor reservado no espaço de
identity (prefixo `:` o distingue de fields de objeto). Quando um
array-diff declara `$identity: ":index"`, o patcher:

1. **Sibling keys de nested update viram índices numéricos.** Em
   `applyArrayOps`, o lookup `findInResult(key)` parseia
   `Number(key)` em vez de varrer o array procurando matching field.
   Não-inteiros, negativos, fracionários ou fora de range degradam
   para `-1` (mesmo "não achou" do smart-key miss).
2. **`$assertCollection` é silenciada.** Matriz posicional não é
   collection homogênea com identity declarada; combiná-las seria
   estruturalmente incoerente — o patcher tolera em vez de lançar.
3. **`$ops` posicional opera inalterado.** Não há interação com a
   identidade; `{type:"add", index, item}` etc. continuam funcionando
   no nível externo de uma matriz.
4. **Smart-key ops dentro de array `:index` degradam graciosamente.**
   `{type:"add", key:"X"}` num array posicional faz `lookup("X")`
   → `Number("X") = NaN` → -1 → silent skip / `KEY_NOT_FOUND` em
   strict. Não recomendado, mas inerte.

Escopo da v3.x: apenas o patcher. O `diffJson` **não emite**
`:index` automaticamente — o gerador é o consumidor (StateMatrix
etc), que declara no wire. Heurística de auto-detect ficaria frágil
(`["foo", "bar"]` confundido com matriz 1×2). Veja [D-034](./DECISIONS.md#d-034--positional_identity-index-para-matrizes-nd).

Exemplo de wire (matriz 2D, edição de uma célula):

```jsonc
{
  "$ops": [],
  "$identity": ":index",
  "1": {
    "$ops": [],
    "$identity": ":index",
    "2": 60
  }
}
// matrix[1][2] = 60
```

Recursão Nd: repete a estrutura — 3D usa 3 níveis, Nd usa N. Sem
regra nova.

---

## `$assertCollection` — contrato de collection homogênea

Quando um array-diff carrega `$assertCollection: true`, o patcher
pré-valida que a base **é uma collection homogênea**:

1. Todo item é um plain object (não primitivo, não array, não null)
2. Todo item carrega o campo `identity` ativo com valor
   `string | number`
3. Não há dois itens com o mesmo valor de identity

Violação de qualquer ponto → `CollectionAssertionError` com um dos 3
códigos:

```ts
type CollectionAssertionCode =
  | "COLLECTION_NON_OBJECT_ITEM"      // item primitivo/array onde devia ser objeto
  | "COLLECTION_MISSING_IDENTITY"     // objeto sem o campo identity
  | "COLLECTION_DUPLICATE_IDENTITY";  // duas identidades iguais
```

### Quando o diff emite `$assertCollection`

Inferência automática no `diffArray`:

```ts
inferAssertCollection(a, b, identity) =
  isCollectionShape(a, identity) && isCollectionShape(b, identity)

isCollectionShape(arr, identity) =
  arr.length > 0
  && todos items são plain objects
  && todos items têm identity como string/number
  && sem duplicatas
```

Quando ambos `a` (source) e `b` (target) passam — emite
`$assertCollection: true` no diff. O patcher recebe e pré-valida na
base antes de aplicar.

### Cascade natural

A inferência cascateia naturalmente porque é per-array. Em
`body: { users: [...], products: [...] }`:

```
diffJson(bodyA, bodyB)
└─ diffObject (objeto)
   ├─ recursa em "users"
   │  └─ diffArray(usersA, usersB)
   │     └─ inferAssertCollection → true (homogeneous)
   │     → emite $assertCollection: true no users-diff
   └─ recursa em "products"
      └─ diffArray(productsA, productsB)
         └─ inferAssertCollection → true
         → emite $assertCollection: true no products-diff
```

Cada array é avaliado independentemente. Arrays mistos
(`tags: ["dev", "admin"]`) não viram collection; ficam híbridos por
default.

### Otimização fast-path

Após a pré-validação passar com sucesso, o `applyArrayOps` opera no
fast-path — sabe que `base[i]` é objeto válido com identity. Pula
checks per-item internos. (Implementação atual ainda valida no
fingerprint por uniformidade; otimização explícita do fast-path é
trabalho futuro.)

---

## Modo strict — implementação

Toda função do pipeline aceita `options.strict?: boolean` (default
`false`). Em strict mode, pontos onde a versão permissiva
silenciosamente ignora viram `throw StrictViolationError`.

A propagação é manual — `options` viaja como parâmetro em todas as
chamadas recursivas. Não é estado global.

Os 5 códigos enumerados:

```ts
type StrictViolationCode =
  | "KEY_NOT_FOUND"          // smart-key lookup miss
  | "INDEX_OUT_OF_RANGE"     // positional remove/move out of bounds
  | "KEY_ALREADY_EXISTS"     // smart-key add collision
  | "MOVE_NO_OP"             // move from === to (or smart-key already at to)
  | "OBJECT_KEY_NOT_FOUND";  // $remove: ["k"] but k not in base
```

`details` carrega dados estruturais por código — útil para handlers que
querem mais que só `code`:

```ts
StrictViolationError {
  code: "KEY_NOT_FOUND",
  details: { op: "remove" | "move" | "nested-update", key: string },
}

StrictViolationError {
  code: "INDEX_OUT_OF_RANGE",
  details: { op: "remove" | "move-from", index: number, length: number },
}

// etc.
```

---

## Conformance suites

Duas suites de spec executável em `conformance/`:

### `json-merge-conformance.json` — aplicação (R1–R11)

Casos `(base, patch, expected | throws | strict_throws | collection_throws)`
testando `patchJson`. Casos com `strict_throws` rodam em ambos os
modos; casos com `collection_throws` validam o erro estrutural
(`CollectionAssertionError`).

Status atual: **107/107 testes** (84 cases base + 11 cases R9/R10 de
identity wire e collection assertion + 10 cases R11 de matrix-positional
com 2 strict double-mode).

### `json-reorder-conformance.json` — geração (RD1–RD4)

16 casos `(base, modified)` testando `diffJson` em 4 invariantes cada
(estabilidade forward, round-trip forward, round-trip backward,
estabilidade reverso) = **64 testes** total.

Status atual: **64/64**.

### Equivalência com git

`tests/myers.git-equivalence.test.ts` valida que `myers` produz a
mesma edit distance que `git diff --diff-algorithm=myers` em 86
cenários (14 fixos + 72 fuzz seedados).

Status: **86/86**.

---

## Performance — observações empíricas

| Operação | Tempo (V8 moderno) |
|---|---|
| `fingerprintItem(primitivo)` | < 1 µs |
| `fingerprintItem(obj com id)` | < 1 µs |
| `fingerprintItem(obj sem id, ~10 keys)` | ~5–10 µs |
| `hashValue(obj ~100 keys)` | ~50 µs |
| `hashValue(obj ~1000 keys)` | ~500 µs |
| `myers(strings, 100x100, D=10)` | ~100 µs |
| `myers(strings, 1000x1000, D=100)` | ~10 ms |
| `diffJson(small JSON)` | ~10–50 µs |
| `patchJson(small JSON)` | ~5–20 µs |
| `patchJson(matriz 1000×1000, 1 cell edit)` | ~2.5 µs |
| `patchJson(1000 users, 50 nested updates)` | ~83 µs |
| `patchJson(10.000 users, 100 nested updates)` | ~1.5 ms |
| `patchJson(strict, 1000×50 nested)` | ~82 µs (= normal) |

**Ganho de Map-based lookup (D-035):** smart-key nested update em
array com `M` items e `N` siblings: lookup era O(M·N), agora é
O(M+N). **Em tempo total**, o speedup empírico é **~3-4×** (não 50×
como a redução de complexidade sozinha sugeriria) — porque o lookup
linear era ~5% do trabalho, os outros ~95% são `patchJson` recursivo
em cada item, que continua igual. Pra arrays pequenos (<16 items),
Map adiciona overhead absoluto de ~100ns (insignificante). Strict
mode tem **zero overhead** no caminho feliz — checks só rodam em
condições anormais. Detalhes empíricos em
[`PATCH-RESULTS.md`](../../json-myers-bench/results/PATCH-RESULTS.md);
análise em [D-035](./DECISIONS.md#d-035--map-based-lookup-pra-eliminar-onm-nos-hot-paths).

A suite completa (483 testes, incluindo 72 invocações de `git diff`
spawn) roda em ~700 ms.

---

## Comandos

```bash
# instalar deps (vai junto com o monorepo)
pnpm install

# typecheck
pnpm --filter json-myers typecheck

# build (tsup — CJS + ESM + DTS)
pnpm --filter json-myers build

# tests
pnpm --filter json-myers test

# tests watch
pnpm --filter json-myers test:watch

# coverage
pnpm --filter json-myers test:coverage
```

Output do build:

```
dist/
├── index.js       (ESM,  ~8 KB minificado)
├── index.cjs      (CJS,  ~8 KB minificado)
├── index.d.ts     (DTS,  ~15 KB)
└── index.d.cts    (DTS,  ~15 KB)
```

---

## Limites conhecidos

- **Coalescência de `move` é smart-key only** — pares `(del fp, ins fp)`
  posicionais (primitivos / content-hash) **não** viram `move` na
  geração; ficam como `remove + add` literal. Razão: positional move
  resolve `from`/`to` contra o estado **atual** do `result` no patcher,
  que muta entre cada move; emitir múltiplos positional moves com
  índices de A original corromperia o resultado. Smart-key move
  identifica items por chave, robusto a reordering intermediário.
  Otimização posicional ficaria viável com simulação do estado do
  patcher durante a geração — trabalho futuro.

- **Myers com trace cheio** — `O((N+M)·D)` em espaço. Para arrays
  muito grandes (10k+ items com D alto), considerar versão
  linear-space (divide-and-conquer com middle snake).

- **`id` aceita só `string | number`** — outros tipos caem em content
  hash. Decisão consciente para evitar smart-keys ambíguas (boolean
  como id é mau cheiro).

- **Mixed-type arrays funcionam, mas heuristics se aplicam por item** —
  detecção da convenção `id`/`key` varre o array procurando o primeiro
  objeto qualificado. Arrays sem nenhum objeto qualificado defaultam
  para `key`.

- **Hash de conteúdo é FNV-1a 32-bit** — probabilidade de colisão é
  ~1 em 4 bilhões. Em pipelines extremamente grandes, considerar
  upgrade para 64-bit (futuro).

- **Wire format verboso** — `{"type":"move","key":"...","to":N}` custa
  ~44 bytes/op vs ~16 bytes/op do `jsondiffpatch` (códigos numéricos).
  Trade-off intencional: legibilidade, schema TypeScript expressivo,
  debuggabilidade. **Gzipado**, a diferença cai pra ~30% (alta
  repetição do wire comprime brutalmente). Em transporte real
  irrelevante na maioria dos casos. Veja
  [`packages/json-myers-bench/results/RESULTS.md`](../../json-myers-bench/results/RESULTS.md)
  para números completos.

---

## Ver também

- [`README.md`](../README.md) — visão, tese, conceitos, API,
  garantias
- [`DECISIONS.md`](./DECISIONS.md) — registro de cada decisão tomada
  e rejeitada, com contexto e razão
- [`conformance/README.md`](../conformance/README.md) — spec
  executável
