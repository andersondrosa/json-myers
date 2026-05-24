# Formato de Diff — Especificação

Este documento é a **referência canônica** do formato de saída de `diffJson()` e da entrada esperada por `patchJson()`. Toda outra documentação aponta para cá quando precisa descrever o formato.

A suíte de conformidade que valida estas regras está em [`json-merge-conformance.json`](./json-merge-conformance.json).

---

## Princípios

- O diff é **JSON puro** — sem tipos especiais, classes ou símbolos
- Contém **apenas o que mudou** (mínimo possível)
- É **reversível** — pode-se gerar o diff inverso aplicando `diffJson(modified, original)`
- É **composto recursivamente** — diffs aninhados refletem a estrutura original

---

## As 5 regras semânticas

| Regra | Descrição |
|---|---|
| **R1** | Array no patch (sem `$__arrayOps`) **substitui** o array base inteiramente. Nunca merge posicional. |
| **R2** | Mudança de tipo entre base e patch (array↔object↔primitivo) → **patch wins**, base descartado. |
| **R3** | Recursão estrutural apenas em pares (object, object) cujo patch não carrega `$__arrayOps`. |
| **R4** | `$__arrayOps` é o marcador estrutural de array. **Exige que o base seja array** — se não for, `patchJson` lança `TypeError`. |
| **R5** | `$__remove: true` em uma posição do patch deleta a chave correspondente. |

---

## Diff vazio

Quando não há mudanças:

```js
diffJson({ a: 1 }, { a: 1 }) // {}
```

Regra: `{}` significa "sem mudanças".

---

## Primitivos

Strings, numbers, booleans e `null` são comparados por valor:

```js
diffJson("hello", "world")  // "world"
diffJson(1, 1)              // {} … mas: diffJson aplicado a primitivos top-level retorna o novo valor ou {}
```

Quando o tipo muda completamente (e.g. objeto → array), retorna o novo valor inteiro:

```js
diffJson({ a: 1 }, [1, 2, 3]) // [1, 2, 3]
```

---

## Objetos

### Propriedade nova ou modificada

Atribui o valor novo (ou sub-diff recursivo se for objeto):

```js
diffJson({ a: 1 }, { a: 1, b: 2 })
// { b: 2 }

diffJson({ a: 1 }, { a: 2 })
// { a: 2 }
```

### Propriedade removida

Marcada com `$__remove: true`:

```js
diffJson({ a: 1, b: 2 }, { a: 1 })
// { b: { $__remove: true } }
```

### Recursão

```js
diffJson(
  { user: { name: "Alice", settings: { theme: "light" } } },
  { user: { name: "Alice", settings: { theme: "dark", lang: "pt" } } }
);
// {
//   user: {
//     settings: {
//       theme: "dark",
//       lang: "pt"
//     }
//   }
// }
```

---

## Arrays

Arrays geram um objeto com a chave especial **`$__arrayOps`** contendo a lista de operações.

### Operações disponíveis

```ts
type ArrayOp =
  // Sem smart key (item literal)
  | { type: "add",    index: number, item: any }
  | { type: "remove", index: number, item: any }
  | { type: "move",   from: number,  to: number, item: any }
  // Com smart key (identidade rastreada)
  | { type: "add",    index: number, key: string }
  | { type: "remove", index: number, key: string }
  | { type: "move",   from: number,  to: number, item: "#${key}" };
```

### Regra crítica dos índices

Esta regra vem direto do Myers e **deve ser respeitada** ao gerar ou interpretar diffs:

| Campo | Significado |
|---|---|
| `remove.index` | Posição no array **original** (antes da operação) |
| `add.index` | Posição no array **final** (depois das operações) |
| `move.from` | Posição no array **original** |
| `move.to` | Posição no array **final** |

Veja [`MYERS-LOGIC.md`](./MYERS-LOGIC.md) para a explicação do edit graph que origina essa regra.

### Array de primitivos

```js
diffJson([1, 2, 3], [1, 3, 4]);
// {
//   $__arrayOps: [
//     { type: "remove", index: 1, item: 2 },
//     { type: "add",    index: 2, item: 4 }
//   ]
// }
```

### Detecção de move

Quando um item sai de uma posição e aparece em outra, gera `move`:

```js
diffJson(["a", "b", "c"], ["b", "c", "a"]);
// {
//   $__arrayOps: [
//     { type: "move", from: 0, to: 2, item: "a" }
//   ]
// }
```

### Array de objetos sem identidade

Sem `id`/`key`, objetos são comparados pelo seu `JSON.stringify`:

```js
diffJson([{ x: 1 }, { x: 2 }], [{ x: 2 }, { x: 3 }]);
// {
//   $__arrayOps: [
//     { type: "remove", index: 0, item: { x: 1 } },
//     { type: "add",    index: 1, item: { x: 3 } }
//   ]
// }
```

### Array de objetos com smart keys

Quando objetos têm `id` ou `key` únicos, são rastreados por identidade. Veja [`SMART_KEYS.md`](./SMART_KEYS.md) para detalhes.

```js
diffJson(
  [{ id: 1, role: "user" }, { id: 2, role: "user" }],
  [{ id: 2, role: "admin" }, { id: 1, role: "user" }]
);
// {
//   $__arrayOps: [
//     { type: "move", from: 1, to: 0, item: "#2" }
//   ],
//   "2": { role: "admin" }
// }
```

Observe:
- `item: "#2"` — prefixo `#` indica smart key (referência ao objeto com `id === 2`)
- `"2": { role: "admin" }` — diff aninhado das propriedades internas do objeto `id: 2`

### Arrays aninhados

A recursão funciona em qualquer profundidade:

```js
diffJson(
  { users: [{ id: 1, tags: ["a", "b"] }] },
  { users: [{ id: 1, tags: ["a", "c"] }] }
);
// {
//   users: {
//     "1": {
//       tags: {
//         $__arrayOps: [
//           { type: "remove", index: 1, item: "b" },
//           { type: "add",    index: 1, item: "c" }
//         ]
//       }
//     }
//   }
// }
```

---

## Marcadores especiais — resumo

| Marcador | Onde aparece | Significado |
|---|---|---|
| `$__arrayOps` | Em objetos cujo valor original era array | Lista de operações Myers |
| `$__remove` | Como `{ $__remove: true }` no valor de uma chave | Remover essa propriedade |
| `"#${key}"` | Em `op.item` quando há smart key | Referência indireta ao objeto identificado |

---

## Ordem de aplicação (em `patchJson`)

Para arrays, as operações são aplicadas nesta ordem fixa:

1. **Removes** — do maior índice para o menor (evita deslocamento)
2. **Moves** — com `from`/`to` ajustados pelos removes anteriores
3. **Adds** — do menor índice para o maior
4. **Patches aninhados** — `diff[key]` aplicado a items remanescentes

Detalhes em [`PATCH_LOGIC.md`](./PATCH_LOGIC.md).

---

## Validação

Um diff é válido quando:

- É um valor JSON (sem `undefined`, sem funções, sem ciclos)
- `$__arrayOps`, quando presente, é um array de operações válidas
- `$__remove`, quando presente, é o boolean `true`

`patchJson` é tolerante a diffs malformados em muitos casos (silenciosamente ignora), mas isso não é parte do contrato — sempre prefira diffs gerados por `diffJson`.

---

## Erros

### `$__arrayOps` sobre base não-array

`$__arrayOps` é semanticamente uma operação sobre array. Se o base na posição correspondente não for um array (é object, primitivo, `null`, ou ausente), `patchJson` lança `TypeError`:

```js
patchJson({ list: { x: 1 } }, { list: { $__arrayOps: [...] } });
// TypeError: patchJson: $__arrayOps requires an array base, got object

patchJson({}, { list: { $__arrayOps: [...] } });
// TypeError: patchJson: $__arrayOps requires an array base, got undefined
```

`diffJson` jamais produz `$__arrayOps` para valores que não eram array — então essa situação só ocorre se o patch foi construído manualmente ou está desalinhado com o estado do base.

Para criar um array do zero, use um array literal:

```js
patchJson({}, { list: ["a"] });  // ✅ { list: ["a"] }  (R1)
```

---

## Avisos

### ⚠️ Moves manuais não são suportados

A semântica de `move` é específica do Myers (índices em referenciais diferentes para `from` e `to`). Construir moves manualmente pode gerar resultados incorretos.

```js
// ❌ NÃO faça isso
const diff = {
  $__arrayOps: [{ type: "move", from: 2, to: 0, item: "x" }]
};
```

Para reordenar manualmente, use a tupla `remove + add` que `applyMyersDiff` aceita.

### ⚠️ Composição de diffs

Aplicar dois diffs sequenciais funciona, mas **combinar dois diffs em um terceiro** ("merge de diffs") não é uma operação suportada — não há garantia matemática de que o diff combinado preserve a semântica.

```js
// ✅ OK
state = patchJson(state, diff1);
state = patchJson(state, diff2);

// ❌ Não funciona em geral
patchJson(state, mergeDiffs(diff1, diff2));
```
