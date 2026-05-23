# json-myers — Registro de Decisões

ADRs (Architecture Decision Records) de cada decisão séria tomada
durante o design e a implementação do `@statedelta/json-myers`. Para
cada decisão, registra-se: **contexto**, **opções consideradas**,
**decisão**, e **razão**. Inclui rejeições — porque saber *por que
algo não foi feito* é tão importante quanto saber o que foi.

Para o panorama de design, veja [`README.md`](./README.md). Para
internals, veja [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## D-001 — Marker `$ops` vs `$__arrayOps`

**Contexto:** o `json-myers` original (v1, no npm) usa `$__arrayOps`
como marker das operações de array dentro de um diff. Discutimos se
manteríamos o nome ou simplificaríamos.

**Opções:**

- A. **`$__arrayOps`** — nome do legacy. Familiar para quem usou v1.
- B. **`$ops`** — mais curto, mais idiomático (`$` é convenção
  estabelecida em JSON para system-reserved: MongoDB, JSON Path, Vue,
  Vuex). `__` é ruído pythonesque.
- C. **`$arrayOps`** — single `$` mas mantém a palavra completa.

**Decisão:** **B — `$ops`**.

**Razão:** o sufixo `Ops` já implica "operações de array" no contexto
(toda op é add/remove/move sobre array). `$` sozinho já comunica
"reservado pelo sistema". O `__` não adicionava informação. O sufixo
"array" no nome era redundante porque o marker só faz sentido em
contexto de array.

**Trade-off:** quebra wire-compat com v1. Mas estamos em pre-1.0;
mudança de protocolo é admissível.

---

## D-002 — `$remove: [...keys]` vs `$__remove: true` per-key

**Contexto:** v1 usa `{ key: { $__remove: true } }` per-chave para
deleção. Verboso quando se quer remover várias chaves:

```json
{ "a": { "$__remove": true }, "b": { "$__remove": true }, "c": { "$__remove": true } }
```

**Opções:**

- A. **Manter per-key** — `$__remove: true` no valor da chave a remover.
  Navegável, "espelha" a base.
- B. **Bulk list no pai** — `$remove: ["a", "b", "c"]`. Conciso para
  bulk; um pouco verboso para single (`["a"]`).
- C. **Manter ambos** — per-key + bulk. Maior surface de marker, mais
  flexibilidade.
- D. **`$omit: [...]`** — evita conflito nominal com a op `{type: "remove"}`
  dentro de `$ops`.

**Decisão:** **B — `$remove: [...keys]`** como única forma.

**Razão:** uma forma única é cognitivamente mais simples que duas. A
bulk list cobre o caso single trivialmente. O nome `$remove` colide
nominalmente com a op de array `{type:"remove"}`, mas em contextos
disjuntos (object-level vs dentro de `$ops`) — não causa ambiguidade
real. `$omit` seria mais limpo mas menos descritivo.

**Trade-off:** sintaxe single-key ganha 1 caractere (`[]` em volta da
key). Aceitável.

**Comportamento adicional decidido:** `$remove` é processado **antes**
das outras entradas no mesmo patch. Logo `{ $remove: ["a"], a: 9 }`
remove `a` e depois reinsere com valor 9 — "reset" idiomático.

---

## D-003 — Forma das ops dentro de `$ops`

**Contexto:** v1 carregava campos redundantes nas ops:
`{ type: "remove", index: 1, item: "b" }` — `item` é redundante porque
`index` já identifica.

**Opções:**

- A. **Manter v1** — flat com `index`/`key` discriminando posicional vs
  smart-key. Com `item` redundante.
- B. **Sem campos redundantes** — `{ type: "remove", index: 1 }`,
  smart-key move sem `from`, positional move sem `item`.
- C. **Aninhado via `at: Target`** — `{ type: "remove", at: { index: 1 } }`
  ou `{ at: { key: "X" } }`. TS-friendly mas mais verboso na wire.

**Decisão:** **B — flat sem redundância**.

**Razão:** wire mais compacta; redundância sem benefício é só
oportunidade de inconsistência. Aninhamento (C) é cleaner em
TypeScript mas mais verboso em JSON — wire wins.

**Forma final:**

```ts
// add
{ type: "add", index: number, item: unknown }       // positional
{ type: "add", key: string, index?: number }        // smart-key

// remove
{ type: "remove", index: number }                   // positional
{ type: "remove", key: string }                     // smart-key

// move
{ type: "move", from: number, to: number }          // positional
{ type: "move", key: string, to: number }           // smart-key
```

---

## D-004 — `move` como op explícita + sugar `remove + add`

**Contexto:** uma reordenação `[A,B]→[B,A]` pode ser expressa de várias
formas equivalentes. Discutimos se `move` seria op de primeira classe
ou só sugar de `remove + add`.

**Opções:**

- A. **Só `add`/`remove`** — sem `move`. Toda reordenação vira
  `remove + add` literal.
- B. **`move` como op de primeira classe** — `{type:"move", ...}` no wire.
- C. **Híbrido** — `move` no wire (legibilidade); patcher trata como
  `remove + add` internamente.

**Decisão:** **C — híbrido**.

**Razão:** wire fica mais legível com `move` explícito. Patcher trata
internamente como sugar — smart-key `move` é desugarado em
`remove + add` (já que a infraestrutura de `removedByKey` cache cobre
ambos). Para positional move, segue como fase própria (sem identidade
pra cachear).

**Consequência:** `remove key="X"` + `add key="X"` no mesmo `$ops` é
**aceito como sugar equivalente a `move key="X"`** — o item é
preservado, não duplicado. Isso é cristalizado no caso
`smart-keys.sugar-remove-add-equals-move` da conformance.

**Status atual:** `diffJson` (v0.1.0) **não emite `move`** —
emite `remove + add` literal. Equivalente em correção, mais verboso.
Otimização para emitir `move` é trabalho futuro (sub-fase opcional).

---

## D-005 — Função de hash — FNV-1a vs JSON.stringify

**Contexto:** para detectar "mesmo conteúdo" em objetos sem identidade
declarada, precisamos converter o conteúdo em um label estável. Três
candidatos.

**Opções:**

- A. **`JSON.stringify` ordenado** — sort de keys + serializar. Simples,
  zero deps. ~50 µs / 100-key object.
- B. **Hash criptográfico (`crypto.subtle`, SHA-256)** — overkill,
  precisamos só de fingerprint, não de propriedades criptográficas.
- C. **Hash não-criptográfico (xxhash, MurmurHash)** — rápido, mas npm dep.
- D. **FNV-1a 32-bit custom recursivo** — visita árvore inline,
  acumula hash, sem stringify intermediário. ~5–10× mais rápido que
  stringify, zero deps.

**Decisão:** **D — FNV-1a 32-bit custom**.

**Razão:**
- Mais rápido que stringify em ~5–10× (especialmente em objetos
  densos — não cria string intermediária).
- Output curto (8 chars hex) — fingerprint compacto, comparações
  posteriores também rápidas.
- Zero dependências.
- ~80 LOC, simples de auditar.
- Criptográfico é overkill.

**Trade-off:** probabilidade de colisão ~1 em 4 bilhões (32-bit). Em
pipelines com bilhões de items, considerar 64-bit. Para a maioria dos
usos, suficiente.

**Decisão adicional:** **keys ordenadas alfabeticamente** antes de
hashar → `{a:1,b:2}` e `{b:2,a:1}` produzem o mesmo hash
(determinismo).

---

## D-006 — Convenção de `id`/`key` no item — auto-detect por item

> **SUPERSEDED em v3.x por [D-028](#d-028--identity-configurável-único-campo-wire-per-array).** Mantido aqui pelo
> registro histórico. A v2 aceitava `id` OU `key` como identity, com
> `id` ganhando sobre `key` quando ambos presentes. A v3 abandona o
> dual-field — uma única identity declarada (default `"id"`).

**Contexto:** itens com `id` ou `key` são smart-keyed. Mas o que se
ambos estiverem presentes? Ou nenhum? Ou só alguns no mesmo array?

**Opções:**

- A. **Spec fixa `key` global** — sempre `key`, ignora `id`. Simples
  mas amarra.
- B. **Spec fixa `id` global** — idem oposto.
- C. **Item declara `$__keyField` no array** — meta-info explícita.
- D. **Auto-detect por item** — cada item é classificado
  individualmente. Tem `id`? Smart-key via `id`. Tem `key`? Via `key`.
  Tem ambos? `id` ganha. Tem nenhum? Content hash.

**Decisão original (v2):** **D — auto-detect por item**.

**Razão (v2):** flexível (suporta DSLs com convenção mista); sem
meta-info extra na wire; comportamento previsível por inspeção do
item. Se o user tem dúvida, pode normalizar antes — o algoritmo aceita
ambos.

**Por que mudou em v3:** o auto-detect dual cria ambiguidade quando
um item tem `id: 999` e `key: "foo"` — qual usar? V2 resolvia
arbitrariamente (`id` ganha), mas isso é convenção, não semântica.
Pior: o legado json-myers fazia o contrário (`key` ganha), causando
divergência. V3 elimina a ambiguidade adotando **uma identity
declarada explicitamente**, configurável pela aplicação.

**Decisão adicional preservada:** **identity só aceita
`string | number`**. Outros tipos (boolean, array, objeto) caem em
content hash. Boolean como id é mau cheiro.

---

## D-007 — Strict mode via `options` vs função separada

**Contexto:** queremos um modo onde divergência entre patch e base é
erro (não silent-ignore). Decisão de design da API.

**Opções:**

- A. **Options object** — `patchJson(base, diff, { strict: true })`.
- B. **Função separada** — `patchJsonStrict(base, diff)`.
- C. **Configuração global** — `setStrict(true)` antes da chamada.

**Decisão:** **A — options object**.

**Razão:**
- Reaproveita a mesma função e mesma signature base.
- Dá espaço para adicionar outras options no futuro
  (`{ strict, freezeOutput, … }`) sem proliferação de funções.
- Default `false` mantém comportamento permissivo retro-compat.
- Configuração global (C) é anti-padrão em libs — frágil em pipelines
  paralelos.

---

## D-008 — Forma do erro strict — códigos enumerados vs discriminator

**Contexto:** quando strict mode detecta violação, queremos comunicar
**qual** divergência. Como modelar o erro?

**Opções:**

- A. **Um erro, discriminator em `details`** — `class
  StrictViolationError { code: "STRICT_VIOLATION", details: { kind:
  "...", ... } }`.
- B. **Códigos enumerados em uma classe** — `class StrictViolationError
  { code: "KEY_NOT_FOUND" | "INDEX_OUT_OF_RANGE" | ..., details: ... }`.
- C. **Classes distintas por violação** — `KeyNotFoundError`,
  `IndexOutOfRangeError`, ...

**Decisão:** **B — códigos enumerados em uma classe**.

**Razão:**
- Casa com o padrão `ResolutionError` do `@statedelta/protocol`
  (`ENGINE_NOT_AVAILABLE`, etc) — reconhecível no monorepo.
- Switch sobre `err.code` é trivial.
- Uma classe = um `isStrictViolationError` guard, em vez de N guards.
- Detalhes estruturais ainda viajam em `details` por código.

**Códigos finais:**
- `KEY_NOT_FOUND` — smart-key lookup miss (remove/move/nested-update)
- `INDEX_OUT_OF_RANGE` — positional remove/move com índice fora
- `KEY_ALREADY_EXISTS` — add com key que já existe
- `MOVE_NO_OP` — move com `from === to`
- `OBJECT_KEY_NOT_FOUND` — `$remove: ["k"]` mas `k` não está no base

---

## D-009 — R6 — `$ops` sobre não-array

**Contexto:** o que fazer se um patch declara `$ops` mas a base na
posição correspondente não é um array? Três opções razoáveis.

**Opções:**

- A. **Throw** — fail-fast, estrita.
- B. **Force-replace** — aplicar ops sobre array vazio, replace.
  Permissivo.
- C. **Ignore marker** — tratar como objeto normal. Mais permissivo.

**Decisão:** **A — throw `OPS_BASE_NOT_ARRAY`**.

**Razão:** `$ops` declara intenção estrutural de array. Se a base não
é array, ou o patch está errado, ou a base não é a esperada. Em
qualquer um dos casos, **silenciar é mascarar bug**. Fail-fast na
fronteira casa com a filosofia do StateDelta.

**Decisão adicional:** R6 é **independente de modo strict** — sempre
lança, em ambos normal e strict. Violação **estrutural** (do tipo),
não inconsistência de conteúdo.

---

## D-010 — R8 — Diff de array sempre carrega `$ops`

**Contexto:** quando um array só tem atualização in-place (smart-key
update sem add/remove/move), o diff teria `$ops: []` vazio. Vale
omitir o `$ops` nesse caso?

**Opções:**

- A. **Sempre carrega `$ops`** mesmo vazio — `{ $ops: [], "alice":
  {role: "admin"} }`.
- B. **Omite `$ops` quando vazio** — `{ "alice": {role: "admin"} }`.

**Decisão:** **A — sempre carrega**.

**Razão:** o `patchJson` usa `$ops` como **discriminador estrutural**:
"este diff é sobre um array". Sem `$ops`, ele cai no fluxo de objeto e
trataria `"alice"` como chave de objeto — quebraria com base array.

R8 cristaliza isso: presença de `$ops` = "base é array".

**Trade-off:** `{ $ops: [] }` carrega 12 bytes a mais que `{}` quando
não há ops. Em diffs grandes, irrelevante.

---

## D-011 — Sentinela `NO_CHANGE` interna

**Contexto:** durante a recursão de `diffJson`, é útil ter um sinal de
"nada a fazer aqui" para o pai filtrar entries triviais.

**Opções:**

- A. **Retornar `undefined`** — caller checa.
- B. **Retornar `{}` vazio** — caller checa "vazio".
- C. **Símbolo único (`NO_CHANGE`)** — caller compara com referência.

**Decisão:** **C — `NO_CHANGE: unique symbol`**.

**Razão:** símbolo é inequívoco, não colide com `undefined` (que pode
ser valor legítimo no JSON via patches malformados) nem com `{}` (que
pode ser legítimo num diff). Não vaza para a API pública —
`diffJson` (público) converte para `{}`, `{ $ops: [] }` ou `b` conforme
o tipo.

---

## D-012 — Escopo da reorder conformance — estabilidade vs canonicidade

**Contexto:** a `reorder conformance` testa geração de diff. Vale fixar
o output exato (canonicidade entre implementações) ou só estabilidade
(determinismo dentro da implementação)?

**Opções:**

- A. **Estabilidade intra-implementação** — `diffJson(a, b)` em N runs
  produz mesmo output. Cada implementação fixa sua convenção interna.
- B. **Canonicidade universal** — fixa `expectedDiff` para cada caso.
  Qualquer implementação alternativa deve emitir o **mesmo** diff
  byte-a-byte.

**Decisão:** **A — só estabilidade**.

**Razão:**
- Para o consumidor (StateDelta launcher), só importa que `Artifact`
  seja content-addressable — depende de **aplicação** determinística,
  já garantida.
- Geração estável basta. Canonicidade universal seria amarra
  prematura sobre implementações alternativas.
- Caminhos diferentes mas mínimos do Myers são igualmente válidos
  matematicamente — não há "única forma certa".

**Trade-off:** se no futuro houver múltiplas implementações que
**precisam** emitir diffs idênticos byte-a-byte (replicação inter-engine
sem renormalização), aí (B) vira requisito. Vamos atravessar quando
chegarmos lá.

---

## D-013 — Localização da conformance — dentro do package vs em `docs/`

**Contexto:** as conformances inicialmente moravam em
`docs/conformance/` no root do statedelta. Faz sentido se torna parte
do package publicável.

**Opções:**

- A. **`docs/conformance/`** no root — neutro, fora do package.
- B. **Dentro do package** — `packages/json-myers/conformance/`,
  publicada no npm.

**Decisão:** **B — dentro do package**.

**Razão:**
- A conformance é **spec do próprio json-myers**. Deve viver com ele.
- Publicada no npm, outras implementações (Rust, Go) podem consumir
  os JSONs diretamente para validar conformidade — não há renormalização.
- Caminho do runner fica curto (`../conformance/...`).
- Aproveita o `files: ["dist", "conformance", "README.md"]` do
  package.json — distribuída automaticamente.

---

## D-014 — Anti-colisão por prefixo `p:s:` em vez de escape system

**Contexto:** o `json-myers` v1 tinha um "escape system" elaborado para
evitar colisão entre string literal `"#abc"` e smart-key `"#abc"` (de
`{key:"abc"}`). O escape transformava `"#abc"` literal em `"\\#abc"`.

**Opções:**

- A. **Manter escape system** — backslash escape para strings que
  começam com `#`.
- B. **Prefixo distinto para primitivos** — todas strings recebem
  prefix `"p:s:"`. `"#abc"` literal vira `"p:s:#abc"`; smart-key
  `"#abc"` continua `"#abc"`. Sem colisão.

**Decisão:** **B — prefixo distinto**.

**Razão:**
- Solução estrutural, não cosmética.
- Sem cálculo de "é preciso escapar?".
- Sem unescape no patch.
- Generaliza para todos os tipos primitivos (booleans, numbers, null),
  não só strings com `#`.

---

## D-015 — Move como sugar interno do patcher

**Contexto:** smart-key `move` poderia ser implementado de várias formas
no patcher.

**Opções:**

- A. **Move como fase distinta** — entre removes e adds.
- B. **Move como pré-normalização para remove + add** — antes do
  processamento principal.

**Decisão:** **B — pré-normalização para smart-key moves; fase própria
para positional**.

**Razão:** smart-key `move` se beneficia do cache `removedByKey` que
já existe para `remove + add` sugar. Normalizar evita lógica
duplicada. Para positional não há identidade pra cachear — fase
própria é necessária.

**Bug pego pela conformance:** a primeira versão da normalização
ingenuamente expandia `move {key: "X"}` em `remove + add` mesmo
quando `X` não existia. Como `remove` falha silenciosamente (key
não acha), o `add` criava item fantasma a partir do seed. **Corrigido:**
verifica existência da key antes de expandir; se não existe, em strict
throw `KEY_NOT_FOUND`, em normal silent skip de toda a operação.

---

## D-016 — `Hash de objetos com id boolean/array/objeto` cai em content hash

**Contexto:** `{ id: true }` — é uma smart-key `#true`?

**Opções:**

- A. **Sim** — qualquer `id` vira smart-key via `String(id)`.
- B. **Não** — só `string | number` viram smart-key. Outros caem em
  content hash.

**Decisão:** **B — só string/number**.

**Razão:** boolean como id é mau cheiro — só dois valores possíveis
(`#true`/`#false`), efetivamente discrimina coleções em 2 grupos.
Arrays/objetos como id são esquisitos e o `String()` produziria
output inútil (`"#[object Object]"`).

Cair em content hash é o comportamento defensivo correto — ainda
funciona, só sem "evolução" semântica.

---

## D-017 — Pacote dentro do monorepo statedelta

**Contexto:** o `json-myers` poderia viver standalone ou como package
do monorepo `@statedelta`.

**Opções:**

- A. **Standalone** — repo próprio, npm direto.
- B. **No monorepo statedelta** — `packages/json-myers/`, publicável
  como `@statedelta/json-myers`.

**Decisão:** **B — no monorepo**.

**Razão:**
- Co-desenvolvimento com o consumidor primário (launcher).
- Convenções do monorepo já estabelecidas (tsup, vitest, tsconfig
  base).
- Workspace permite "drop-in" do launcher consumir via
  `workspace:*` sem npm.
- Pode ser republicado autonomamente quando estabilizar.

---

## D-018 — Sem otimização de `move` na geração — v0.1.0

**Contexto:** uma reordenação `[A,B] → [B,A]` pode ser otimizada para
1 op `move` em vez de `remove + add` (2 ops). Vale fazer essa
otimização agora?

**Opções:**

- A. **Otimizar agora** — adiciona ~80 LOC, mais complexidade.
- B. **Deixar para depois** — emite `remove + add` literal; smart-keys
  são automaticamente "moves" via sugar.

**Decisão:** **B — adiar**.

**Razão:**
- Correção é equivalente — `remove + add` aplica certo.
- Smart-keys ganham efeito de move via sugar do patcher (não há perda
  de identidade).
- Otimização cosmética — JSON do diff só fica ~30% maior em casos
  com reordenação.
- Conformance reorder passa 64/64 sem essa otimização.

**Adiamento:** otimização será uma sub-fase 2.5 opcional, pegando os
pares `(del fp, ins fp)` ao final do walk em `diffArray` e
convertendo em ops `move`.

---

## D-019 — Não usar versão linear-space do Myers

**Contexto:** versão clássica do Myers usa `O((N+M)·D)` em espaço —
guarda o trace inteiro. Versão linear-space (divide-and-conquer com
middle snake) usa só `O(N+M)`.

**Opções:**

- A. **Linear-space** — mais complexa, ~2× mais código.
- B. **Versão clássica com trace cheio** — simples, suficiente para
  inputs até ~10k items.

**Decisão:** **B — clássica**.

**Razão:** json-myers visa diffs de **estados de aplicação**, não
arquivos enormes. Arrays com 10k items em estado de runtime são
edge-case. Versão clássica é mais simples, mais auditável.

**Migração:** versão linear-space pode ser adicionada futuramente como
opção (`myersLinear`). Não substitui a clássica — `myers` continua
sendo a versão default.

---

## D-020 — Spec executável como JSON, runner separado

**Contexto:** a conformance é spec dos comportamentos. Como expressar?

**Opções:**

- A. **TypeScript test file** — direto em vitest.
- B. **JSON puro** — dados consumíveis por qualquer runtime, runner
  separado em qualquer linguagem.
- C. **Markdown com snippets** — bonito mas não-executável.

**Decisão:** **B — JSON puro**.

**Razão:**
- Spec language-agnostic. Outras implementações (Rust, Go, etc) podem
  consumir os JSONs diretamente.
- Separa **o quê** (spec) de **como rodar** (runner).
- Runner em vitest valida nossa implementação; outros runners validam
  outras implementações — todos contra o mesmo JSON.
- JSON publicado junto do package (em `files`) — fica disponível.

---

## D-021 — Categorias na conformance — `category` field

**Contexto:** a conformance tem dezenas de casos. Como organizar?

**Decisão:** field `category` em cada case. Runner agrupa por
categoria para output legível. Categorias atuais:

- `object-merge` — diff/patch de objetos sem array
- `array-replace` — R1 (arrays sempre substituem sem $ops)
- `type-change` — R2 (mudança de tipo replace)
- `null-handling` — edge cases com null
- `array-ops` — R4 positional
- `array-ops-smart-keys` — R4 com identidade
- `remove-property` — R5 ($remove em objeto)
- `realistic-chain` — composições realistas
- `mixed-arrays` — heterogêneos (string + objeto + primitivo)
- `strict-violations` — R7 (casos que viram throw em strict)
- `type-mismatch` — R6 ($ops sobre não-array)

---

## D-022 — Validação dual-mode na conformance via `strict_throws`

**Contexto:** alguns casos têm comportamento diferente entre normal e
strict (ex: `$remove` de chave inexistente → silent ignore vs throw).
Como cobrir ambos no mesmo case?

**Opções:**

- A. **Duplicar o case** — `normal-mode` e `strict-mode` separados.
- B. **Field opcional `strict_throws`** — quando presente, runner roda
  o case duas vezes (normal: espera `expected`; strict: espera throw
  com aquele código).

**Decisão:** **B — `strict_throws` field**.

**Razão:** sem duplicação de dados; afirmação cristalina ("este mesmo
(base, patch) que retorna X em normal, deve throw Y em strict"). Runner
gera 2 testes por case com strict_throws.

---

## D-023 — Equivalência com `git diff` como prova empírica

**Contexto:** queremos provar que nossa implementação de Myers é a
mesma do git. Como?

**Opções:**

- A. **Argumento teórico** — implementar pelo paper de Myers 1986; se
  o paper é o mesmo, o algoritmo é o mesmo.
- B. **Prova empírica** — gerar pares (A, B), rodar `git diff` real, e
  comparar com nossa saída.
- C. **Ambos** — combinar.

**Decisão:** **C — ambos, mas com peso na empírica**.

**Razão:**
- Argumento teórico é necessário (clean-room do paper).
- Prova empírica detecta bugs sutis que o argumento teórico não
  detecta (off-by-one, edge cases, etc).
- 86 cenários (14 fixos + 72 fuzz seedados) dão confiança forte.
- A prova é **executável** — qualquer um pode rodar `pnpm test` e ver.

**Detalhe técnico:** comparamos **edit distance** (D) e o **breakdown**
(del, ins) — não a forma exata do edit script. Múltiplos shortest
paths são matematicamente válidos.

---

## D-024 — `Object.is` para igualdade de primitivos no curto-circuito

**Contexto:** quando dois valores são iguais, `diffJsonInner` retorna
`NO_CHANGE` rápido. Como verificar igualdade?

**Opções:**

- A. **`===`** — falha em `NaN === NaN` (false).
- B. **`Object.is`** — `Object.is(NaN, NaN) === true`. Mais robusto.
- C. **Deep-equal recursivo** — mais correto mas mais custoso.

**Decisão:** **B — `Object.is` para curto-circuito**.

**Razão:** `Object.is` cobre o caso `NaN` corretamente.
Para objetos/arrays, `Object.is` retorna false para refs distintas
(esperado — recursão genuína acontece nas funções específicas).

`Object.is(0, -0)` é false. Em JSON, ambos serializam como `"0"` —
poderia ser considerado igual. Aceitamos a divergência (caso
extremo, raramente importante).

---

## D-025 — Fingerprint expõe internals (`fingerprintItem`, `hashValue`)

**Contexto:** o fingerprint é detalhe de implementação do diffArray.
Vale expor como API pública?

**Opções:**

- A. **Manter privado** — só o diff/patch usa internamente.
- B. **Expor** — public exports.

**Decisão:** **B — expor**.

**Razão:**
- Útil em isolamento (comparação de identidade rápida, content-addressing).
- Combina bem com `myers` exportado (build seu próprio diff
  custom).
- Documentação implícita do contrato de identidade.
- Sem custo de manutenção (já está testada e documentada).

---

## D-026 — Smart-key add cria item com seed dos sibling-fields

**Contexto:** quando `diffJson` detecta um item smart-key NOVO em B,
como representar no diff?

**Opções:**

- A. **Item inteiro como `item` do add** — `{ type: "add", key: "X",
  index: 2, item: { id: "X", role: "admin" } }`.
- B. **Add sem `item`, seed via sibling chaveado pelo smart-key** —
  `{ type: "add", key: "X", index: 2 }` + `"X": { role: "admin" }`.

**Decisão:** **B — seed em sibling**.

**Razão:**
- Coerente com nested updates (também sibling chaveado por smart-key).
- O field de identidade (`id`/`key`) não precisa repetir — patcher
  detecta convenção e re-emite via `buildFromSeed`.
- Forma uniforme entre "criar novo item" e "atualizar item existente"
  — ambos usam o mesmo padrão de sibling chaveado.

---

## D-027 — Casos `indeterminate` da conformance — todos resolvidos como throw (R6)

**Contexto:** inicialmente havia 3 casos marcados `indeterminate: true`
representando decisões pendentes sobre `$ops` em base não-array.

**Decisão:** **todos resolvidos como throw `OPS_BASE_NOT_ARRAY`**.

**Razão:** consistência com o princípio fail-fast. Casos:
- `$ops` em base objeto → throw
- `$ops` em base primitivo → throw
- `$ops` em base ausente (key não está no objeto pai) → throw

Resolvidos no D-009 acima. A categoria virou `type-mismatch` com 3
casos `throws: "OPS_BASE_NOT_ARRAY"`.

---

## D-028 — Identity configurável (único campo) + wire-per-array

**Contexto:** v2 usava `id ?? key` — duas opções de identity com
fallback. Anderson levantou: em sistemas reais com múltiplas
collections no mesmo documento (ex: `body.users` com `id`,
`body.products` com `sku`), uma identity global não basta. Cada
collection pode ter sua própria convenção.

Também: o auto-detect dual (D-006) introduz ambiguidade quando ambos
campos estão presentes — qual ganha? Por que? Decisão arbitrária.

**Opções:**

- A. **Manter dual-field** (`id` + `key` fallback) — v2.
- B. **Identity única, configurável globalmente por chamada** —
  `patchJson(base, diff, { identity: "code" })`. Sem `?? key`. Per-call,
  não per-array.
- C. **Identity per-array via wire** — cada array-diff carrega
  `$identity` no wire. Patch lê do diff específico. Default `"id"`
  quando omitido.
- D. **Per-path via schema** (planejado v4.x) — user declara schema
  com paths → identity. Mais rico, exige schema.

**Decisão:** **C — wire-per-array**, com `PatchOptions.identity` e
`DiffOptions.identity` como override global (fallback quando wire
omite).

**Razão:**
- Wire é **auto-descritivo** — patch recebe diff e sabe como aplicar
  sem depender de config externa. Compatível com o princípio "diff
  é autocontido".
- **Múltiplas convenções no mesmo documento** funcionam — cada
  array-diff declara sua identity local.
- **Default `"id"`** é convenção universal (REST, GraphQL, ORM).
- Options globais (`identity` em `PatchOptions`/`DiffOptions`)
  servem como override conveniente quando todos arrays usam a mesma
  convenção e o user não quer poluir o wire.

**Ordem de resolução no patcher:**
1. `diff.$identity` (per-array, wire)
2. `options.identity` (per-call, global)
3. `DEFAULT_IDENTITY` = `"id"`

**Wire format:**

```jsonc
{
  "$ops": [...],
  "$identity": "sku",   // ← opcional, omitido quando = default "id"
  "X-1": { ... }        // ← nested update por smart-key (= valor de sku)
}
```

**Trade-off:** versão v3.x emite `$identity` apenas quando ≠ default
— minimiza tamanho do diff. Em arrays com identity custom, o marker
é local àquele diff.

---

## D-029 — `$assertCollection` + inferência cascade automática

**Contexto:** muitos sistemas têm arrays que são **collections
homogêneas** — todo item é objeto, todo item tem identity, sem
duplicatas. Verificar isso por item a cada operação é custoso e
silencia bugs (item "errado" passa despercebido).

Anderson propôs: schema-like validation **embutida no diff**.

**Opções:**

- A. **Sem validação** — patcher lida com qualquer entrada
  (comportamento v2).
- B. **Option global `assertCollection: true`** — afeta todos os
  arrays do call.
- C. **Per-array via wire `$assertCollection: true`** — cada
  array-diff decide. Inferido automaticamente pelo `diffJson`.
- D. **Schema completo** (v4.x) — user declara schema, validações
  por path.

**Decisão:** **C — per-array wire + inferência automática**.

**Razão:**
- Per-array (não cascade global) suporta documentos com **arrays de
  naturezas distintas no mesmo lugar** — `users[]` é collection,
  `tags[]` é array híbrido de strings, ambos coexistem.
- **Inferência automática** no `diffJson` cascateia naturalmente —
  cada chamada de `diffArray` analisa SEU par (A, B) e decide
  individualmente. User não precisa anotar.
- Quando há violação, **erro estrutural** (`CollectionAssertionError`)
  é sempre lançado — independente de `strict` mode. Como R6,
  é uma violação de forma do item.
- Otimização: após validação, o algoritmo opera em fast-path.

**Inferência (no `diffJson`):**

Pra cada par `(a, b)` de arrays no diff:
- Todos itens em `a` são plain objects com `identity` field
  (string/number)?
- Idem para `b`?
- Sem duplicatas de identity em `a` ou `b`?

Se todas as 3 condições batem → emite `$assertCollection: true` no
diff daquele array.

**Erros (`CollectionAssertionError`):**
- `COLLECTION_NON_OBJECT_ITEM` — item primitivo/array onde devia ser objeto.
- `COLLECTION_MISSING_IDENTITY` — objeto sem o campo `identity`.
- `COLLECTION_DUPLICATE_IDENTITY` — dois itens com o mesmo valor de identity.

**Trade-off:** inferência roda em CADA `diffArray`. Custo: O(N+M) extra
sobre arrays. Para arrays pequenos, irrelevante. Para arrays gigantes
(10k+ items), considerar opt-out futuro.

---

## D-030 — Schema completo adiado pra v4.x

**Contexto:** durante o design de D-028 e D-029, Anderson propôs uma
direção mais ambiciosa: usar **schema** como input do diff/patch.
Forma do documento declarada, diff sabe onde é collection, qual
identity em cada path, qualquer ambiguidade resolvida.

**Opções:**

- A. **Implementar schema agora (v3.x)** — escopo grande (~400 LOC),
  decisão de schema language (JSON Schema? Zod? custom?), validador,
  resolver de paths.
- B. **Adiar pra v4.x** — v3.x resolve 90% dos casos via D-028 + D-029
  (default `"id"` global, override via wire ou options). Schema fica
  pra próxima major.

**Decisão:** **B — adiar pra v4.x**.

**Razão:**
- v3.x já cobre **maioria dos sistemas** — convenção `id` uniforme +
  override pontual via wire/options.
- v3.x destrava consumidor primário (StateDelta launcher) sem mais
  bloqueios.
- Schema completo tem decisões de design grandes (linguagem, formato,
  validações encadeadas) que merecem fase própria.
- Inferência automática de `$assertCollection` (D-029) já dá uma boa
  parte do valor "schema embutido" sem o custo.

**Roadmap futuro v4.x:**
- Schema opt-in como segundo arg de `diffJson`/`patchJson`.
- Identity por path (substitui wire `$identity` em casos complexos).
- Validações estendidas (tipos de campo, valores permitidos, etc).
- Compatibilidade backward: sem schema, comportamento v3.x.

---

## D-031 — Sub-path export `/patch` (vs packages separados)

**Contexto:** A maioria dos consumidores em runtime só precisa de
**patch** (apps recebendo patches do servidor, launchers consumindo
DeltaDocs, ETL targets). Quem gera diffs (servidores, builders) é
minoria. Carregar todo o módulo de diff/myers/fingerprint quando só
se aplica patches é desperdício de bundle.

**Opções:**

- A. **Sub-path export** — mesmo package, mas
  `@statedelta/json-myers/patch` é um entry-point separado com bundle
  reduzido.
- B. **Packages separados** —
  `@statedelta/json-myers-patch` +
  `@statedelta/json-myers-diff` +
  `@statedelta/json-myers-protocol`.
- C. **Não fazer nada** — tree-shaking moderno cuida disso.

**Decisão:** **A — sub-path export**.

**Razão:**
- **1 codebase, 1 versão, 1 conformance** — sem governança extra de
  múltiplos packages.
- **Bundle assimétrico real** — `/patch` é ~51% do bundle full (~4.9 KB
  vs ~9.5 KB ESM minificado).
- **Padrão moderno estabelecido** — Firebase, Lucide, Lodash Modular
  usam o mesmo pattern (`firebase/firestore`, `lucide-react/icons`).
- **Tree-shaking explícito** — bundlers que não tree-shake bem ainda
  beneficiam, porque o entry-point é fisicamente separado.
- **Documentar é trivial** — `import from "@statedelta/json-myers/patch"`
  é uma linha; auto-discoverable via DTS.

**Configuração:**
- `src/patch-entry.ts` — re-exports do subset necessário pra patch.
- `tsup.config.ts` — dois entries: `index` (full) e `patch`.
- `package.json` — `exports` map com `.` e `./patch`.

**O que está no `/patch`:**
- `patchJson`, `applyArrayOps`
- `OpsBaseNotArrayError`, `StrictViolationError`,
  `CollectionAssertionError` (+ type guards)
- Todos os tipos relevantes (`Op`, `OpsDiff`, `PatchOptions`,
  `StrictViolationCode`, `CollectionAssertionCode`, etc)
- `DEFAULT_IDENTITY`

**O que NÃO está:**
- `diffJson`, `diffArray`, `diffObject`
- `myers`, `Edit`, `EqFn`
- `fingerprintItem`, `fingerprintArray`, `hashValue`, `hashToHex`
- `DiffOptions`

**Trade-off rejeitado:** packages separados (B) adicionariam fricção
de governança (sincronizar versões, peer deps, descobrir qual
instalar) sem ganho técnico real. (A) entrega o mesmo benefício de
bundle size com fração do custo de manutenção.

---

## Decisões em aberto / futuras

Decisões que não tomamos ainda mas estão na fila:

### O-001 — Otimização de `move` na geração

Atualmente `diffJson` emite `remove + add` literal. Detectar pares e
converter em `move` reduz tamanho do diff. **Status:** adiada para
sub-fase 2.5.

### O-002 — Hash 64-bit

FNV-1a 32-bit tem colisão ~1 em 4B. Para sistemas com bilhões de
items, considerar 64-bit. **Status:** não há demanda; adiada.

### O-003 — Myers linear-space

Para arrays >10k items, considerar versão divide-and-conquer com
middle snake. **Status:** sem evidência de necessidade; adiada.

### O-004 — Patches "humanamente editáveis"

Atualmente o formato é gerado, não autoral. Forma alternativa mais
legível (com `move`, com inline content) poderia coexistir. **Status:**
sem demanda clara; especulativa.

### O-005 — Spec contractual universal entre implementações

Hoje a conformance só fixa estabilidade (D-012, escopo A). Se múltiplas
implementações precisarem produzir diffs idênticos byte-a-byte,
escopo B vira requisito. **Status:** adiada até necessidade real.

### O-006 — Schema language pra v4.x

D-030 adiou schema pra v4. Quando chegar, decisões: JSON Schema
(verboso, standard) vs Zod (TS-first, runtime overhead) vs formato
próprio (controle total, learning curve). **Status:** adiada pra
quando v4.x começar.
