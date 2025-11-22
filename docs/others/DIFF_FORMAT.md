# Formato de Diff - Especificação Completa

## 🎯 Visão Geral

O formato de diff do **json-myers** é um **JSON válido** que representa apenas as mudanças necessárias para transformar um valor original em um modificado.

**Princípios**:
- ✅ JSON puro (sem tipos especiais)
- ✅ Mínimo possível (apenas mudanças)
- ✅ Reversível (suporta undo)
- ✅ Composable (diffs podem ser combinados)

## 📋 Tipos de Diff

### 1. Diff Vazio (Sem Mudanças)

```typescript
// Input
const original = { a: 1, b: 2 };
const modified = { a: 1, b: 2 };

// Output
diffJson(original, modified) // {}
```

**Regra**: `{}` representa "sem mudanças".

### 2. Primitivos Diferentes

```typescript
// Tipos primitivos: string, number, boolean, null

// Input
const original = "hello";
const modified = "world";

// Output
diffJson(original, modified) // "world"
```

**Regra**: Se tipos são diferentes ou valores primitivos mudaram, retorna o novo valor diretamente.

### 3. Tipo Mudou Completamente

```typescript
// Input
const original = { a: 1 };
const modified = [1, 2, 3];

// Output
diffJson(original, modified) // [1, 2, 3]
```

**Regra**: Se tipo muda (object → array, array → string, etc), retorna o novo valor completo.

## 🗂️ Objetos

### Propriedades Adicionadas

```typescript
// Input
const original = { a: 1 };
const modified = { a: 1, b: 2 };

// Output
{
  b: 2
}
```

### Propriedades Modificadas

```typescript
// Input
const original = { a: 1, b: 2 };
const modified = { a: 1, b: 3 };

// Output
{
  b: 3
}
```

### Propriedades Removidas

```typescript
// Input
const original = { a: 1, b: 2 };
const modified = { a: 1 };

// Output
{
  b: { "$__remove": true }
}
```

**Regra**: `{ "$__remove": true }` marca remoção de propriedade.

### Objetos Aninhados

```typescript
// Input
const original = {
  user: {
    name: "Alice",
    settings: { theme: "light" }
  }
};

const modified = {
  user: {
    name: "Alice",
    settings: { theme: "dark", lang: "pt" }
  }
};

// Output
{
  user: {
    settings: {
      theme: "dark",
      lang: "pt"
    }
  }
}
```

**Regra**: Diffs são recursivos, apenas caminhos mudados aparecem.

## 📚 Arrays

### Arrays Simples (Primitivos)

```typescript
// Input
const original = [1, 2, 3];
const modified = [1, 3, 4];

// Output
{
  "$__arrayOps": [
    { type: "remove", index: 1, item: 2 },
    { type: "add", index: 2, item: 4 }
  ]
}
```

**Regra**: `$__arrayOps` contém operações de edição.

### Arrays com Movimentação

```typescript
// Input
const original = ["a", "b", "c"];
const modified = ["b", "c", "a"];

// Output
{
  "$__arrayOps": [
    { type: "move", from: 0, to: 3, item: "a" }
  ]
}
```

**Regra**: `move` é otimização de `remove + add` do mesmo item.

**Como Move Funciona Internamente**:
1. Move é convertido para `remove(from)` + `add(to)`
2. Operações são aplicadas **de trás para frente** (como Myers faz)
3. Índices são ajustados considerando deslocamento causado por add/remove
4. Para múltiplos moves, cada move anterior afeta índices dos próximos

**Exemplo de Aplicação**:
```typescript
// Move: from=0, to=3
// Conversão: remove(0) + add(3)

// Array original: ["a", "b", "c"]
// Aplicação reversa:
//   1. add(3): ["a", "b", "c", "a"]  (4 elementos agora!)
//   2. remove(0): ["b", "c", "a"]    ✅

// Note: índice from é ajustado (+1) porque to <= from
```

### Arrays de Objetos (Sem Smart Keys)

```typescript
// Input
const original = [{ x: 1 }, { x: 2 }];
const modified = [{ x: 2 }, { x: 3 }];

// Output
{
  "$__arrayOps": [
    { type: "remove", index: 0, item: { x: 1 } },
    { type: "add", index: 1, item: { x: 3 } }
  ]
}
```

**Regra**: Sem `id`/`key`, objetos são comparados por valor serializado.

### Arrays de Objetos (Com Smart Keys)

```typescript
// Input
const original = [
  { id: 1, name: "Alice", role: "user" },
  { id: 2, name: "Bob", role: "user" }
];

const modified = [
  { id: 2, name: "Bob", role: "admin" },
  { id: 1, name: "Alice", role: "user" }
];

// Output
{
  "$__arrayOps": [
    { type: "move", from: 1, to: 0, item: "#2" }  // Note: item é "#2", não key
  ],
  "2": {
    role: "admin"
  }
}
```

**Estrutura**:
- `$__arrayOps`: Mudanças de posição/adição/remoção
- `item: "#key"`: Smart key prefixado com `#` indica referência ao objeto
- `"key"`: Diffs internos do objeto com essa key

**Nota sobre Smart Keys**:
- Quando item começa com `#`, é uma referência a um objeto identificado
- O `#` é removido para buscar o diff: `"#2"` → busca `diff["2"]`
- O objeto é resolvido por `id` ou `key` no array base

### Arrays Aninhados

```typescript
// Input
const original = {
  users: [
    { id: 1, tags: ["admin", "user"] }
  ]
};

const modified = {
  users: [
    { id: 1, tags: ["admin", "superuser"] }
  ]
};

// Output
{
  users: {
    "1": {
      tags: {
        "$__arrayOps": [
          { type: "remove", index: 1, item: "user" },
          { type: "add", index: 1, item: "superuser" }
        ]
      }
    }
  }
}
```

## 🔧 Marcadores Especiais

### `$__arrayOps`

**Tipo**: Array de operações

**Operações**:
```typescript
type ArrayOp =
  | { type: "add", index: number, item: any }
  | { type: "add", index: number, key: string }
  | { type: "remove", index: number, item: any }
  | { type: "remove", index: number, key: string }
  | { type: "move", from: number, to: number, item: any }
  | { type: "move", from: number, to: number, key: string };
```

**Ordem de Aplicação** (no `patchJson`):
1. **Removes** (maior índice → menor índice)
2. **Moves** (com ajuste de índices)
3. **Adds** (menor índice → maior índice)
4. **Patches por key** (diffs internos dos objetos)

### `$__remove`

**Tipo**: Boolean (`true`)

**Uso**: Marca remoção de propriedade

```typescript
{
  propriedade: { "$__remove": true }
}
```

### Keys Numéricas (Smart Keys)

**Formato**: String com ID/key do objeto

```typescript
{
  "123": { ... },      // Objeto com id: 123
  "user-abc": { ... }  // Objeto com key: "user-abc"
}
```

## 📖 Exemplos Completos

### Exemplo 1: Sistema de Tarefas

```typescript
const original = {
  project: "Website",
  tasks: [
    { id: 1, title: "Design", status: "done" },
    { id: 2, title: "Development", status: "in-progress" },
    { id: 3, title: "Testing", status: "pending" }
  ]
};

const modified = {
  project: "Website Redesign",
  tasks: [
    { id: 2, title: "Development", status: "done" },
    { id: 3, title: "Testing", status: "in-progress" },
    { id: 4, title: "Deploy", status: "pending" }
  ]
};

const diff = diffJson(original, modified);
// {
//   project: "Website Redesign",
//   tasks: {
//     "$__arrayOps": [
//       { type: "remove", index: 0, key: "1" },
//       { type: "add", index: 2, key: "4" }
//     ],
//     "2": { status: "done" },
//     "3": { status: "in-progress" },
//     "4": { id: 4, title: "Deploy", status: "pending" }
//   }
// }
```

### Exemplo 2: Configuração de Aplicação

```typescript
const original = {
  theme: "light",
  features: {
    darkMode: false,
    notifications: true,
    analytics: true
  },
  users: ["alice", "bob"]
};

const modified = {
  theme: "dark",
  features: {
    darkMode: true,
    notifications: true
  },
  users: ["bob", "alice", "carol"]
};

const diff = diffJson(original, modified);
// {
//   theme: "dark",
//   features: {
//     darkMode: true,
//     analytics: { "$__remove": true }
//   },
//   users: {
//     "$__arrayOps": [
//       { type: "move", from: 0, to: 1, item: "alice" },
//       { type: "add", index: 2, item: "carol" }
//     ]
//   }
// }
```

### Exemplo 3: CRM Real

```typescript
const original = {
  agent: {
    id: "agent-1",
    name: "João Silva",
    stats: { total: 10, active: 5 }
  },
  referrals: [
    { id: "r1", client: "Maria", status: "AVAILABLE", value: 4500 },
    { id: "r2", client: "Pedro", status: "AVAILABLE", value: 3200 }
  ]
};

const modified = {
  agent: {
    id: "agent-1",
    name: "João Silva",
    stats: { total: 11, active: 4 }
  },
  referrals: [
    { id: "r1", client: "Maria", status: "RENTED", value: 4500 },
    { id: "r2", client: "Pedro", status: "AVAILABLE", value: 3200 },
    { id: "r3", client: "Ana", status: "AVAILABLE", value: 5000 }
  ]
};

const diff = diffJson(original, modified);
// {
//   agent: {
//     stats: {
//       total: 11,
//       active: 4
//     }
//   },
//   referrals: {
//     "$__arrayOps": [
//       { type: "add", index: 2, key: "r3" }
//     ],
//     "r1": { status: "RENTED" },
//     "r3": { id: "r3", client: "Ana", status: "AVAILABLE", value: 5000 }
//   }
// }
```

## 🔄 Aplicação de Patch

### Regras de Aplicação

```typescript
patchJson(base, diff)

// 1. Se diff é primitivo → retorna diff
if (typeof diff !== "object") return diff;

// 2. Se base não é objeto → cria estrutura vazia
if (typeof base !== "object") {
  base = Array.isArray(diff) ? [] : {};
}

// 3. Se é array com $__arrayOps
if (Array.isArray(base) && "$__arrayOps" in diff) {
  // 3a. Aplica operações ordenadas
  // 3b. Aplica diffs internos por key
}

// 4. Se é objeto
for (const key in diff) {
  // 4a. Se tem $__remove → delete
  if (diff[key]?.$__remove) delete result[key];

  // 4b. Se é objeto → recursivo
  else if (typeof diff[key] === "object") {
    result[key] = patchJson(base[key], diff[key]);
  }

  // 4c. Senão → atribui direto
  else result[key] = diff[key];
}
```

### Ordem de Operações em Arrays

```typescript
// CORRETO: Ordena antes de aplicar
ops.sort((a, b) => {
  if (a.type === "remove" && b.type === "remove") {
    return b.index - a.index;  // Removes: maior → menor
  }
  if (a.type === "add" && b.type === "add") {
    return a.index - b.index;  // Adds: menor → maior
  }
  if (a.type === "remove") return -1;  // Removes antes de adds
  if (b.type === "remove") return 1;
  return 0;
});

// ERRADO: Aplicar fora de ordem causa bugs!
```

## ⚠️ Edge Cases

### 1. Diff de Diff

```typescript
const diff1 = { a: 2 };
const diff2 = { a: 3 };

// Diff entre diffs também funciona!
diffJson(diff1, diff2) // { a: 3 }
```

### 2. Null vs Undefined

```typescript
// Null é valor, undefined é ausência
diffJson({ a: 1 }, { a: null })        // { a: null }
diffJson({ a: 1 }, {})                 // { a: { "$__remove": true } }
```

### 3. Arrays Vazios

```typescript
diffJson([1, 2], [])
// {
//   "$__arrayOps": [
//     { type: "remove", index: 1, item: 2 },
//     { type: "remove", index: 0, item: 1 }
//   ]
// }
```

### 4. Objetos Vazios

```typescript
diffJson({ a: { b: 1 } }, { a: {} })
// {
//   a: {
//     b: { "$__remove": true }
//   }
// }
```

## 📏 Tamanho de Diff

### Fórmula Aproximada

```
Tamanho ≈ Σ(mudanças) × tamanho_médio_campo

// Arrays: +4 bytes por operação
// Objetos: +tamanho_chave + tamanho_valor
// Primitivos: tamanho_json(novo_valor)
```

### Comparação

| Cenário | Original | Modified | Diff Size | Redução |
|---------|----------|----------|-----------|---------|
| 1 campo | 1 KB | 1 KB | 20 bytes | 98% |
| 10% mudou | 100 KB | 100 KB | 10 KB | 90% |
| 50% mudou | 100 KB | 100 KB | 50 KB | 50% |
| Tudo mudou | 100 KB | 100 KB | 100 KB | 0% |

## 🧪 Validação de Diff

```typescript
function isValidDiff(diff: any): boolean {
  // 1. Primitivo = válido
  if (typeof diff !== "object") return true;

  // 2. Null = válido
  if (diff === null) return true;

  // 3. Array ops válido
  if ("$__arrayOps" in diff) {
    if (!Array.isArray(diff.$__arrayOps)) return false;
    for (const op of diff.$__arrayOps) {
      if (!["add", "remove", "move"].includes(op.type)) {
        return false;
      }
    }
  }

  // 4. Recursivo para objetos
  for (const key in diff) {
    if (!isValidDiff(diff[key])) return false;
  }

  return true;
}
```

## 🎓 Best Practices

### ✅ DO

```typescript
// Valide antes de aplicar
if (!isValidDiff(diff)) throw new Error("Invalid diff");

// Preserve imutabilidade
const result = patchJson(original, diff);
// original permanece inalterado

// Use smart keys para arrays de objetos
const users = [
  { id: generateId(), name: "Alice" }
];
```

### ❌ DON'T

```typescript
// Não modifique diffs manualmente
diff.$__arrayOps.push(...);  // ❌ Pode quebrar ordem!

// Não assuma estrutura
if (diff.users) { ... }  // ❌ Pode não existir!

// Use: isNonEmptyDiff(diff.users)

// Não ignore $__remove
if (diff.prop) { ... }  // ❌ Pode ser remoção!

// NUNCA crie moves manualmente
diff.$__arrayOps = [
  { type: "move", from: 2, to: 0, item: "x" }  // ❌ Semântica diferente!
];
```

## ⚠️ Importante: Moves Gerados vs Manuais

**Esta implementação funciona APENAS com diffs gerados pelo Myers**.

```typescript
// ✅ CORRETO - Gerar diff automaticamente
const diff = diffJson(original, modified);
const result = patchJson(original, diff);

// ❌ ERRADO - Criar moves manualmente
const diff = {
  $__arrayOps: [
    { type: "move", from: 2, to: 0, item: "x" }
  ]
};
// Pode não funcionar corretamente!
```

**Por quê?**
- Moves do Myers seguem semântica de aplicação reversa
- Índices são calculados considerando ordem de execução específica
- Criar moves manualmente pode gerar índices incompatíveis

**Recomendação**: Sempre use `diffJson()` para gerar diffs. Nunca crie diffs manualmente em produção.

---

**Veja também**:
- **[PATCHJSON.md](./PATCHJSON.md)**: Detalhes de como moves são aplicados
- **[PERFORMANCE.md](./PERFORMANCE.md)**: Benchmarks e otimização

**Última Atualização**: 2025-11-21
