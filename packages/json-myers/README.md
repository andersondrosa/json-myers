# json-myers — Filosofia

> JSON diff/patch que **entende identidade**, não posição.

`json-myers` é uma biblioteca de diff e patch para valores JSON
arbitrários. Resolve um problema clássico: bibliotecas tradicionais
de `deepMerge` tratam arrays como blobs opacos — quando você "mescla"
duas listas, a do patch substitui a do base inteiramente. Em qualquer
sistema real onde arrays são coleções de objetos com identidade
(usuários, transações, itens, etc), isso é catastrófico.

A tese é simples: **um array de objetos é uma coleção, não uma
sequência aleatória; precisa ser tratado com a semântica certa.**

---

## O problema

Imagine que você quer aplicar a este estado:

```json
{
  "users": [
    { "id": "alice", "role": "user" },
    { "id": "bob", "role": "user" }
  ]
}
```

…uma mudança em que Alice vira admin. Em qualquer ferramenta de
`deepMerge` clássica (lodash, Ramda, ...), o "patch" para refletir essa
mudança vira:

```json
{
  "users": [
    { "id": "alice", "role": "admin" },
    { "id": "bob", "role": "user" }
  ]
}
```

…porque **arrays são substituídos inteiramente, não mesclados**. Você é
forçado a reenviar a lista toda mesmo para mudar uma propriedade de um
item. Pior: se você fizer um patch com `[{ id: "alice", role: "admin" }]`
esperando intuitivamente "atualize só a Alice", o resultado é Bob
desaparecer.

A solução do `deepMerge` ingênuo para arrays é "substituir". A solução
do `json-myers` é **"entender identidade"**: Alice e Bob são entidades
distintas e o patch sabe disso.

---

## A tese — três flavors de identidade

Todo item de um array recebe uma **fingerprint** — uma string-rótulo
estável que define "qual item é este".

A regra de fingerprint é:

| Tipo do item | Fingerprint | Significado |
|---|---|---|
| Primitivo (`string`, `number`, `boolean`, `null`) | `"p:<tag>:<valor>"` | **Igualdade por valor** — `"p:n:42"` é o único `42`. |
| Objeto com `id` ou `key` | `"#<chave>"` | **Identidade declarada** — o objeto pode evoluir. |
| Objeto sem `id`/`key`, ou array aninhado | `"h:<hash>"` | **Identidade por valor** — qualquer mudança no conteúdo = item diferente. |

Esta classificação implícita corresponde a três níveis distintos de
"o que o autor quis dizer":

1. **Primitivo**: "este valor é o que ele é. Mudou? É outro valor."
2. **Smart-key**: "este objeto **é a Alice**. Conforme Alice evolui, é
   sempre Alice."
3. **Hash de conteúdo**: "este objeto sem id não tem identidade
   declarada. Não há 'evolução' — só 'igual' ou 'diferente'."

Sem identidade declarada, **objetos não têm evolução semântica**. Você
precisa marcar a coisa com `id` ou `key` para o `json-myers` saber que
"este é o mesmo X que aquele". Se você não marca, qualquer mudança no
conteúdo faz o objeto virar "outro item" — `diff` emite `remove + add`
em vez de `update`.

Essa fronteira é boa: **identidade exige declaração**. Não há mágica.

---

## O algoritmo — Myers sobre fingerprints

Com cada item mapeado a uma string-fingerprint, o problema de diff de
arrays vira:

> Dado `fpA: string[]` e `fpB: string[]`, qual é a sequência mínima de
> `add`/`remove` que transforma `fpA` em `fpB`?

Esse é exatamente o problema que o **algoritmo de Myers (1986)**
resolve — o mesmo que o `git diff` usa para arquivos. Comparação por
`===` sobre strings é trivialmente barata (versus comparação estrutural
profunda objeto-a-objeto, que custaria O(N·M)).

A saída do Myers é um **edit script** mínimo (sequência de
`keep`/`del`/`ins`). O `diffArray` percorre esse script e converte
cada operação em uma **op do wire format** (`add`/`remove`/`move`).

A garantia matemática é forte: a **distância de edição é única**, e a
implementação do `json-myers` produz a mesma distância que o `git
diff --diff-algorithm=myers` em qualquer entrada (provado
empiricamente em 86 cenários de teste, incluindo 72 fuzz seedados).

---

## O wire format — dois markers

Diffs gerados por `json-myers` viajam como JSON normal. A única coisa
que distingue um "valor de dado" de uma "instrução de patch" são dois
markers reservados:

### `$ops` — operações de array

Aparece num objeto cuja **base correspondente é um array**. Carrega
uma lista de operações (`add`/`remove`/`move`):

```json
{
  "$ops": [
    { "type": "add", "index": 2, "item": "novo" },
    { "type": "remove", "key": "alice" },
    { "type": "move", "from": 0, "to": 3 }
  ],
  "carol": { "role": "admin" }
}
```

Chaves irmãs do `$ops` (`"carol"` no exemplo) são **nested updates por
smart-key** — referenciam itens no array resultante pela identidade.

### `$identity` — campo de identity por array

Cada array-diff pode declarar seu próprio campo de identity. Default é
`"id"`. Quando o array usa convenção diferente (`code`, `sku`, etc),
declare:

```json
{
  "$ops": [{ "type": "move", "key": "PRD-1", "to": 2 }],
  "$identity": "code",
  "PRD-1": { "name": "Updated" }
}
```

O patcher resolve identity nesta ordem: `diff.$identity` →
`PatchOptions.identity` → `"id"`. Cada array no documento pode ter
sua própria convenção (`users[]` com `id`, `products[]` com `sku`,
etc).

### `$assertCollection` — contrato de collection homogênea

Quando um array é uma collection — todo item é objeto com identity,
sem duplicatas — o diff pode afirmar isso:

```json
{
  "$ops": [],
  "$assertCollection": true,
  "alice": { "role": "admin" }
}
```

`diffJson` infere e emite automaticamente quando a estrutura bate.
Patch pré-valida a base — qualquer violação (item primitivo, objeto
sem identity, duplicata) lança `CollectionAssertionError`.

### `$remove` — remoção de chaves de objeto

Lista de chaves a remover do objeto pai:

```json
{
  "$remove": ["tempField", "legacyFlag"],
  "newField": 42
}
```

Aplicado ao objeto base, primeiro remove as chaves listadas, depois
mescla as demais entradas. Permite "reset" com `{ "$remove": ["x"], "x": 99 }`
— remove `x`, depois adiciona com novo valor.

---

## Os dois modos

`patchJson` opera em dois modos, controlados por `options.strict`:

### Normal (default) — autoral, permissivo

O patch é tratado como um **sketch livre** — base pode ser qualquer
coisa, inconsistências são silenciosamente toleradas. Apropriado para:

- Patches escritos à mão
- Patches que podem não bater exatamente com a base
- Pipelines onde "falha graciosa" é preferível a erro

Inconsistências silenciadas:
- `$remove: ["x"]` quando `x` não existe → ignora
- `remove` por smart-key que não bate → ignora
- `remove` por índice fora de range → pula
- Nested update por smart-key sem matching → ignora

### Strict — gerado por diff, exato

O patch é assumido como produto de um **diff real contra esta base
específica**. Qualquer divergência é violação. Apropriado para:

- Patches gerados via `diffJson(a, b)` aplicados em `a`
- Sistemas onde divergência é sinal de bug
- Pipelines de replicação onde fidelidade é crítica

```ts
patchJson(base, patch, { strict: true });
// throws StrictViolationError com código:
// - OBJECT_KEY_NOT_FOUND
// - KEY_NOT_FOUND
// - INDEX_OUT_OF_RANGE
// - KEY_ALREADY_EXISTS
// - MOVE_NO_OP
```

R6 (`$ops` sobre não-array) **sempre** lança, em ambos os modos — é
violação estrutural, não inconsistência de conteúdo.

---

## API pública

### Dois entry-points — full vs patch-only

```ts
// Full — diff + patch + algoritmo Myers + fingerprint (~9.5 KB ESM)
import { diffJson, patchJson } from "json-myers";

// Patch-only — ~51% do bundle (~4.9 KB ESM). Sem diff, sem fingerprint,
// sem Myers. Pra runtimes que só APLICAM patches recebidos (clientes,
// launchers, ETL targets).
import { patchJson } from "json-myers/patch";
```

A versão `/patch` exporta tudo o que o lado de aplicação precisa:
`patchJson`, `applyArrayOps`, todas as classes de erro (com type
guards), todos os tipos relevantes (`Op`, `OpsDiff`, `PatchOptions`,
etc) e `DEFAULT_IDENTITY`. **Diff e geração não estão lá** — pra
isso, use o entry principal.

### Diff

```ts
import { diffJson, diffArray, diffObject } from "json-myers";

// Top-level — despacha por tipo e produz patch aplicável.
const patch: unknown = diffJson(a, b);

// Para casos onde você sabe o tipo (raro — diffJson cobre tudo):
const arrayPatch = diffArray(a, b);
const objectPatch = diffObject(a, b);
```

**Contrato:** `patchJson(a, diffJson(a, b))` é deep-igual a `b`. Pro
caso degenerado `a === b`, produz um patch no-op (`{ $ops: [] }` para
arrays, `{}` para objetos, `b` em si para primitivos).

### Patch

```ts
import { patchJson } from "json-myers";

const result = patchJson(base, diff);
const strict = patchJson(base, diff, { strict: true });

// Override de identity global — quando todos arrays usam a mesma
// convenção que não é "id" e você não quer poluir o wire com
// $identity em cada array-diff:
const r = patchJson(base, diff, { identity: "code" });
```

### Diff com identity custom

```ts
import { diffJson } from "json-myers";

// Sem options — default identity "id" globalmente.
const patch = diffJson(a, b);

// Override global — pra arrays que usam outra convenção.
const patch2 = diffJson(a, b, { identity: "code" });
```

Quando dois arrays no mesmo documento usam identities diferentes
(`users.id` + `products.sku`), o `diffJson` emite `$identity` no
wire de cada array que precisa override — uma identity local por
array sem precisar de schema completo.

### Algoritmo core (uso direto)

```ts
import { myers, type Edit, type EqFn } from "json-myers";

// Use diretamente Myers sobre qualquer T[] com função de igualdade.
const edits: Edit<string>[] = myers(["a","b","c"], ["a","x","c"]);
//  → [{ keep, "a" }, { del, "b", index: 1 }, { ins, "x", index: 1 }, { keep, "c" }]

// Customizar a igualdade:
const eq: EqFn<User> = (a, b) => a.id === b.id;
const edits2 = myers(usersA, usersB, eq);
```

### Identidade — fingerprint

```ts
import { fingerprintItem, hashValue } from "json-myers";

fingerprintItem(42);                    // "p:n:42"
fingerprintItem("hello");               // "p:s:hello"
fingerprintItem({ id: "alice", v: 1 }); // "#alice"  (identidade evolutiva)
fingerprintItem({ x: 1 });              // "h:1a2b3c4d" (hash de conteúdo)

hashValue({ x: 1 });  // uint32 FNV-1a determinístico
```

`fingerprintItem` é a base sobre a qual o `diffArray` decide quem é
"o mesmo item" entre A e B.

### Erros

```ts
import {
  OpsBaseNotArrayError,
  isOpsBaseNotArrayError,
  StrictViolationError,
  isStrictViolationError,
  CollectionAssertionError,
  isCollectionAssertionError,
  type StrictViolationCode,
  type CollectionAssertionCode,
} from "json-myers";

// R6 — $ops sobre não-array (sempre lança, independente de modo).
try {
  patchJson({ x: 1 }, { $ops: [/* ... */] });
} catch (err) {
  if (isOpsBaseNotArrayError(err)) {
    console.log(err.code);     // "OPS_BASE_NOT_ARRAY"
    console.log(err.baseType); // "object"
  }
}

// R7 — strict mode: divergência entre patch e base.
try {
  patchJson({ a: 1 }, { $remove: ["ghost"] }, { strict: true });
} catch (err) {
  if (isStrictViolationError(err)) {
    console.log(err.code);    // "OBJECT_KEY_NOT_FOUND"
    console.log(err.details); // { key: "ghost" }
  }
}

// R10 — $assertCollection: violação de contrato de collection.
try {
  patchJson(
    [{ id: "alice" }, "stray-string"],
    { $ops: [], $assertCollection: true },
  );
} catch (err) {
  if (isCollectionAssertionError(err)) {
    console.log(err.code);    // "COLLECTION_NON_OBJECT_ITEM"
    console.log(err.details); // { index: 1, item: "stray-string", identity: "id" }
  }
}
```

### Tipos

```ts
import type {
  // Ops (forma das operações dentro de $ops)
  Op, AddOp, RemoveOp, MoveOp,
  AddOpPositional, AddOpSmartKey,
  RemoveOpPositional, RemoveOpSmartKey,
  MoveOpPositional, MoveOpSmartKey,

  // Diff (genérico)
  OpsDiff, RemoveListMarker, Diff,

  // Options
  PatchOptions, DiffOptions,
  StrictViolationCode, CollectionAssertionCode,

  // Myers core
  Edit, EqFn,
} from "json-myers";

import { DEFAULT_IDENTITY } from "json-myers";
// DEFAULT_IDENTITY === "id"
```

---

## Garantias

### Round-trip

```ts
patchJson(a, diffJson(a, b))  ≡  b
patchJson(b, diffJson(b, a))  ≡  a
```

Verificado em centenas de cenários — primitivos, smart-keys, mixed,
objetos profundamente aninhados, mudanças combinadas.

### Determinismo bit-a-bit

```ts
JSON.stringify(diffJson(a, b)) === JSON.stringify(diffJson(a, b))
```

Para qualquer `(a, b)`, N chamadas consecutivas produzem o **mesmo
output** byte-a-byte. Implementação não usa nada não-determinístico
(sem random, sem ordem de Set/Map, sem timestamps). Object keys são
ordenadas alfabeticamente no hash de conteúdo.

### Equivalência matemática com `git diff`

A função `myers` é uma implementação clean-room do algoritmo de Myers
1986. Testes empíricos validam equivalência com
`git diff --diff-algorithm=myers` em 86 cenários (14 fixos + 72 fuzz
seedados):

- **Edit distance** (D = del + ins) idêntico
- **Breakdown** (del e ins separados) idêntico
- **Edit script** aplica corretamente em todos os casos

### Idempotência de hash

```ts
hashValue(x) === hashValue(x)              // sempre
hashValue({a:1,b:2}) === hashValue({b:2,a:1})  // sort interno de keys
```

---

## Quando usar (e quando não)

### Usar quando

- Arrays são **coleções de objetos com identidade declarada** (`id`/`key`).
- Você precisa de **patches mínimos** que preservem identidade através de
  reordenação.
- O sistema é determinístico — diff/patch precisa ser exato e estável.
- Você quer **content-addressable** (mesmos documentos → mesmo Artifact).
- Você precisa de **modo strict** para detectar divergência entre patch e
  base.

### Não usar quando

- Você só precisa de "atualizações pontuais" em estruturas planas — o
  overhead de markers não compensa.
- Performance extrema sobre arrays gigantes (10k+ items) — Myers é O(ND),
  rápido para D pequeno; para D grande, considere algoritmos
  especializados.
- Você precisa de patches **humanamente editáveis** sem ferramenta — o
  formato `$ops` é gerado, não autoral. (Para patches autorais simples,
  `deepMerge` clássico é mais legível.)
- Você quer ler diffs como `git diff` no terminal — o formato é JSON
  estruturado, não unified-diff textual.

---

## Posicionamento no ecossistema

`json-myers` é uma biblioteca **standalone** — zero dependências, ~8KB
ESM minificado, funciona em qualquer runtime JS (Node, browser,
Deno, edge).

No ecossistema `@statedelta`, é a base do modo `mergeStrategy: "myers"`
do `@statedelta/launcher` — onde cadeias de DeltaDocs são compostas via
patches estruturais sobre o body do StateDoc raiz.

A spec do `json-myers` é **executável**: as conformances JSON em
`conformance/` são consumíveis por qualquer implementação alternativa
(outras linguagens, outras runtimes) que se proponha equivalente.

---

## Documentação

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — internals técnicos:
  camadas, fluxos de `diff`/`patch`, implementação do Myers,
  complexidade, mutual recursion via ESM, performance
- [`DECISIONS.md`](./DECISIONS.md) — ADRs de cada decisão de design
  (27 tomadas, 5 em aberto) com contexto + opções consideradas + razão
- [`conformance/README.md`](./conformance/README.md) — spec
  executável (R1–R8 para `patch`, RD1–RD4 para `diff`); JSON publicado
  no npm pra consumo por outras implementações
