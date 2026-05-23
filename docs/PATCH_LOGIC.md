# Patch — Lógica de Aplicação

Este documento explica **como `patchJson()` aplica um diff** num valor base. O foco aqui é a parte mais delicada: a ordem de operações em arrays e o ajuste de índices entre `remove`, `move` e `add`.

> Para a teoria do algoritmo que origina os ops, veja [`MYERS-LOGIC.md`](./MYERS-LOGIC.md).
> Para o formato dos ops, veja [`DIFF_FORMAT.md`](./DIFF_FORMAT.md).

Código de referência: `src/patch/patchJson.ts`.

---

## Fluxo principal

```
patchJson(base, diff)
  │
  ├─ diff é primitivo ou null?       → retorna diff (substituição)
  ├─ diff é array?                   → retorna [...diff] (R1: substitui base)
  │
  ├─ diff tem $__arrayOps?
  │     base não é array?            → THROW (R4: estado inconsistente)
  │     base é array?
  │       1. Aplica removes  (maior → menor índice)
  │       2. Ajusta moves    (subtrai removes anteriores)
  │       3. Aplica moves    (convertendo cada um em remove+add)
  │       4. Aplica adds     (menor → maior índice)
  │       5. Aplica patches  (diff[key] em items remanescentes)
  │
  ├─ base é array, diff é object plano sem $__arrayOps?
  │     → descarta base (R2: patch wins) e segue como object merge
  │
  ├─ base é primitivo/null?
  │     → descarta base (R2: patch wins) e segue como object merge
  │
  └─ base é objeto (R3):
      Para cada chave do diff:
        • Valor é { $__remove: true }  → delete a propriedade
        • Valor é objeto/array         → recursão (patchJson)
        • Valor é primitivo            → atribuição direta
```

As 5 regras semânticas (R1–R5) estão definidas em [`DIFF_FORMAT.md`](./DIFF_FORMAT.md#as-5-regras-semânticas).

---

## Passo a passo de array

### 1. Removes — do maior para o menor

```ts
removes.sort((a, b) => b.index - a.index);
for (const op of removes) {
  if (op.key) {
    const idx = arr.findIndex(i => getKey(i) === op.key);
    if (idx !== -1) arr.splice(idx, 1);
    removedIndices.push(op.index);   // ← usa índice do Myers, não o dinâmico
  } else {
    arr.splice(op.index, 1);
    removedIndices.push(op.index);
  }
}
```

**Por que do maior para o menor?**

```ts
arr = ["a", "b", "c", "d"];

// Remover índices 1 e 2:

// ❌ Menor → maior:
arr.splice(1, 1); // ["a", "c", "d"]
arr.splice(2, 1); // ["a", "c"]      ← removeu "d" em vez de "c"!

// ✅ Maior → menor:
arr.splice(2, 1); // ["a", "b", "d"]
arr.splice(1, 1); // ["a", "d"]      ← correto
```

**Por que `removedIndices.push(op.index)` e não o `idx` dinâmico?**

Quando removemos por `key`, encontramos o índice atual via `findIndex`. Mas esse índice já reflete o estado *após* outros removes — ele não tem relação com o array original do Myers.

O **ajuste de moves** (passo 2) precisa saber quais **índices originais** foram removidos, para descontar corretamente. Por isso registramos sempre o `op.index` que veio do diff, que é estável no referencial do Myers.

*Esse foi o bug histórico corrigido em 2025-11-22.*

### 2. Ajuste de índices dos moves

```ts
const adjustedMoves = moves.map(move => {
  const removesBeforeFrom = removedIndices.filter(idx => idx < move.from).length;
  return {
    from: move.from - removesBeforeFrom,
    to:   move.to,
    item: move.item,
    key:  move.key
  };
});
```

**Só `from` é ajustado.** `from` é índice no array **original** — após os removes, o item subiu de posição no array atual, então descontamos os removes anteriores.

**`to` NÃO é ajustado.** `to` é índice no array **final** — o array final já reflete as remoções; ajustar `to` pelos removes do original duplica o desconto e insere o item na posição errada (bug histórico corrigido).

### 3. Aplicação dos moves

Cada move é convertido em **um par `remove + add`** dentro de `applyMovesWithIndexTracking`:

```ts
operations.push(
  { type: "remove", index: move.from, item: move.item },
  { type: "add",    index: move.to,   item: itemToAdd }
);
```

Depois passa pelo `applyMyersDiff` padrão (removes maior→menor, adds menor→maior).

**Resolução de smart keys**: se `move.item` começa com `#`, a função busca o objeto correspondente no `base` array, aplica o patch aninhado (`diff[key]`), e usa o resultado como `itemToAdd`. Isso garante que o objeto move *atualizado* — não a versão antiga.

**Resolução de objetos sem smart key**: quando `move.item` é uma string `JSON.stringify` (objeto literal), a função evita o `JSON.parse` buscando o objeto original no `base` array pela mesma identidade. Isso preserva referências e é ~10× mais rápido. Fallback para `JSON.parse` se a busca falhar.

### 4. Adds — do menor para o maior

```ts
adds.sort((a, b) => a.index - b.index);
for (const op of adds) {
  if (op.key) {
    const existing = base.find(i => getKey(i) === op.key);
    const merged = patchJson(existing || {}, diff[op.key] ?? {});
    if (!("key" in merged) && !("id" in merged)) merged.key = op.key;
    arr.splice(op.index, 0, merged);
  } else {
    arr.splice(op.index, 0, op.item);
  }
}
```

Inserir do menor para o maior funciona porque cada insert empurra os subsequentes — e os índices em `add.index` já são do array final, então estão coerentes nessa ordem.

Para adds com `key`:
- Se o objeto já existia no base (caso raro de re-add), reutiliza e re-aplica patch
- Se é um item totalmente novo, parte de `{}` e aplica `diff[key]`
- Injeta `key` apenas se o objeto resultante não tiver `key` nem `id` — evita sujar objetos que já são identificados por `id`

### 5. Patches em items remanescentes

```ts
for (const key in diff) {
  if (key === "$__arrayOps") continue;
  const idx = arr.findIndex(i => getKey(i) === key);
  if (idx !== -1) arr[idx] = patchJson(arr[idx], diff[key]);
}
```

Items que **não foram movidos nem adicionados** mas têm um diff aninhado por identidade são processados aqui. Move e add já chamaram `patchJson` internamente; este passo cobre o resto.

---

## Passo a passo de objeto

Muito mais simples:

```ts
for (const key in diff) {
  const value = diff[key];
  if (value && typeof value === "object" && REMOVE_MARKER in value) {
    delete result[key];                           // { $__remove: true }
  } else if (value && typeof value === "object") {
    result[key] = patchJson(result[key], value);  // recursão
  } else {
    result[key] = value;                          // primitivo direto
  }
}
```

---

## Imutabilidade

`patchJson` **nunca muta** o `base`:

```ts
let result = Array.isArray(base) ? [...base] : { ...base };
```

Clone raso no nível atual; recursão produz novos sub-objetos. Estruturas que não estão no caminho de mudança permanecem por referência (estrutural sharing).

---

## Garantias

- **Round-trip**: `patchJson(original, diffJson(original, modified))` === `modified`
- **Rollback**: `patchJson(modified, diffJson(modified, original))` === `original`
- **Idempotência parcial**: aplicar o mesmo diff duas vezes no resultado dá o mesmo resultado (em casos onde o diff já está totalmente "consumido")

Estas garantias são validadas pelos testes em `tests/3-integration/`.

---

## Erros lançados

`patchJson` lança `TypeError` quando o diff declara `$__arrayOps` mas o base correspondente não é um array. Veja [`DIFF_FORMAT.md`](./DIFF_FORMAT.md#erros).

## Limitações conhecidas

- **Moves manuais**: a semântica assume que os moves foram gerados por Myers. Construir um diff com moves arbitrários pode falhar.
- **Diff malformado em outros aspectos**: além do guard de `$__arrayOps`, `patchJson` é tolerante. Diffs corrompidos em outras formas podem produzir resultados imprevisíveis sem erro.
