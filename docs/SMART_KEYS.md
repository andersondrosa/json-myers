# Smart Keys — Sistema de Identidade

Smart Keys é o mecanismo pelo qual `json-myers` consegue rastrear **identidade de objetos em arrays**, em vez de tratar arrays como sequências posicionais.

> Para a especificação de como smart keys aparecem no diff, veja [`DIFF_FORMAT.md`](./DIFF_FORMAT.md).
> Para a teoria do algoritmo que opera sobre as identidades, veja [`MYERS-LOGIC.md`](./MYERS-LOGIC.md).

---

## Por que existe

Arrays de objetos em JSON não carregam identidade explícita. Considere:

```js
const original = [{ name: "Alice", role: "user" }, { name: "Bob", role: "user" }];
const modified = [{ name: "Bob", role: "admin" }, { name: "Alice", role: "user" }];
```

Sem smart keys, um diff ingênuo geraria 4 operações (remover ambos, adicionar ambos), perdendo qualquer noção de que Bob é o mesmo Bob, apenas promovido e reposicionado.

Com smart keys, o diff resultante é **uma única operação** de move mais o patch interno de Bob:

```js
{
  $__arrayOps: [{ type: "move", from: 1, to: 0, item: "#bob" }],
  "bob": { role: "admin" }
}
```

---

## Como o sistema decide a identidade

A função interna `getKey(item)` resolve a identidade de um item:

```ts
function getKey(item: any): string | undefined {
  if (!item || typeof item !== "object") return undefined;
  if (typeof item.key === "string") return item.key;        // 1. key (string) tem prioridade
  if (item.id !== undefined && item.id !== null) return String(item.id);  // 2. id (qualquer tipo não-nulo)
  return undefined;                                          // 3. sem identidade
}
```

| Item | Identidade resolvida |
|---|---|
| `{ key: "foo", value: 1 }` | `"foo"` |
| `{ id: 123, name: "Alice" }` | `"123"` *(stringificado)* |
| `{ id: "user-abc" }` | `"user-abc"` |
| `{ key: "foo", id: 999 }` | `"foo"` *(key vence)* |
| `{ name: "Carol" }` | `undefined` *(sem id nem key)* |
| `{ id: null }` | `undefined` *(null não conta)* |
| `{ id: 0 }` | `"0"` *(zero é válido)* |
| `42`, `"text"`, `null` | `undefined` *(não-objeto)* |

---

## Identity hash

A partir de `getKey()`, geramos a **identidade de comparação** usada pelo Myers — uma string que permite comparar items por igualdade:

```ts
function getArrayItemIdentity(item: any): string {
  const key = getKey(item);
  if (key) return `#${key}`;                          // Smart key: "#foo", "#123"
  if (typeof item === "object" && item !== null)
    return JSON.stringify(item);                       // Fallback: serialização
  return escapeIdentity(String(item));                 // Primitivo: string escapada
}
```

Exemplos:

| Item | Identidade |
|---|---|
| `{ key: "foo" }` | `"#foo"` |
| `{ id: 123 }` | `"#123"` |
| `{ name: "Carol" }` | `'{"name":"Carol"}'` |
| `"hello"` | `"hello"` |
| `42` | `"42"` |
| `"#a"` | `"\\#a"` *(escapado — veja abaixo)* |

---

## Sistema de escape — evitando colisão

Como a identidade de um objeto com key `"a"` é `"#a"`, uma **string literal** `"#a"` no array geraria a mesma identidade. Para evitar colisão, strings começando com `#` ou `\` recebem um `\` na frente:

```ts
function escapeIdentity(str: string): string {
  if (str.startsWith("#") || str.startsWith("\\")) return `\\${str}`;
  return str;
}
```

| Valor original | Identidade |
|---|---|
| `"#a"` | `"\\#a"` |
| `"\\#a"` | `"\\\\#a"` |
| `"hello"` | `"hello"` *(sem escape)* |

Ao aplicar o patch, `unescapeIdentity` reverte:

```ts
function unescapeIdentity(str: string): string {
  if (str.startsWith("\\")) return str.slice(1);
  return str;
}
```

Resultado: `"#a"` (string) e `{ key: "a" }` (objeto) coexistem no mesmo array sem ambiguidade.

---

## Diff aninhado por identidade

Quando dois objetos com a **mesma identidade** existem no original e no modificado, suas propriedades internas são comparadas e o resultado vira um diff aninhado no objeto pai, indexado pela própria identidade:

```js
diffJson(
  [{ id: 1, name: "Alice", role: "user"  }, { id: 2, name: "Bob", role: "user" }],
  [{ id: 1, name: "Alice", role: "admin" }, { id: 2, name: "Bob", role: "user" }]
);
// {
//   $__arrayOps: [],
//   "1": { role: "admin" }    // ← diff aninhado de id:1
// }
```

A chave `"1"` (string) corresponde à identidade — `id: 1` foi convertido para `"1"` por `getKey()`.

---

## Limitações

### Identidades duplicadas

Apenas a **primeira ocorrência** de cada identidade é rastreada. Items subsequentes com a mesma identidade caem no caminho de "objeto sem identidade" (serialização JSON).

```js
const arr = [
  { id: 1, name: "First" },
  { id: 1, name: "Second" }   // Tratado como objeto sem identidade
];
```

**Recomendação**: garanta unicidade de `id`/`key` na sua aplicação.

### Identidade mutável

Smart keys assumem que a identidade de um item **não muda**. Se mudar:

```js
const original = [{ id: 1, name: "Alice" }];
const modified = [{ id: 2, name: "Alice" }];  // mesmo nome, id mudou
```

O diff vai detectar `remove(id:1) + add(id:2)`, não um update. Use IDs estáveis.

### Mistura `key` + `id`

Funciona, mas evite. Se um item tem ambos, `key` vence. Útil em migrações graduais (legado → moderno) mas confuso a longo prazo.

```js
{ key: "user-1", id: 42, name: "Alice" }
// → identidade resolvida: "user-1"
```

---

## Implementação

A lógica vive em três pontos:

| Arquivo | Responsabilidade |
|---|---|
| `src/diff/utils.ts` | `getKey`, `getArrayItemIdentity`, `escapeIdentity`, `unescapeIdentity` |
| `src/diff/diffArray.ts` | Constrói as listas de identidade antes de chamar Myers |
| `src/diff/diffSmartKeys.ts` | Gera o diff aninhado entre objetos de mesma identidade |
| `src/patch/patchJson.ts` | Resolve `#key` durante a aplicação, busca objeto base, aplica patch |
