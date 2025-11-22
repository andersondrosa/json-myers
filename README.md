# json-myers

[![Tests](https://img.shields.io/badge/tests-146%2F146%20passing-brightgreen)](https://github.com/andersondrosa/json-myers)
[![Coverage](https://img.shields.io/badge/coverage-100%25%20active-brightgreen)](https://github.com/andersondrosa/json-myers)
[![Status](https://img.shields.io/badge/status-stable-green)](https://github.com/andersondrosa/json-myers)
[![Version](https://img.shields.io/badge/version-1.0.0--rc-blue)](https://github.com/andersondrosa/json-myers)

Biblioteca de alta performance para calcular diferenças (diffs) e aplicar patches em estruturas JSON profundas, usando o algoritmo de Myers otimizado (mesmo usado pelo Git).

## O que é o json-myers?

O json-myers é uma solução completa para detectar e aplicar mudanças em dados JSON, permitindo sincronização eficiente, versionamento e rastreamento de alterações. Ele vai além de simples comparações, oferecendo detecção inteligente de movimentações em arrays e suporte especial para objetos com chaves únicas.

## Características Principais

- 🚀 **Alta Performance**: Algoritmo de Myers O(ND) otimizado (mesmo do Git)
- 🔄 **Detecção de Movimentação**: Identifica quando itens são movidos em arrays
- 🔑 **Smart Keys**: Tratamento especial para arrays de objetos com `id` ou `key` (suporta IDs numéricos!)
- 📦 **Patches Mínimos**: Gera apenas as diferenças necessárias
- 🔙 **Reversível**: Permite desfazer mudanças aplicadas (rollback completo)
- 🌳 **Suporte Profundo**: Funciona com estruturas aninhadas complexas
- ✅ **100% Testado**: 146 testes passando, 0 falhas
- 🔄 **Git-like**: Histórico completo forward/backward
- 🎯 **Idempotente**: Aplicar diff múltiplas vezes não causa problemas
- 🌪️ **Suporta Caos**: Mix de strings, números, objetos, null - vida real!

## Instalação

```bash
npm install json-myers
# ou
yarn add json-myers
# ou
pnpm add json-myers
```

## 🆕 Novidade v0.0.4+

**Suporte completo a `id` numérico!** Agora você pode usar arrays de objetos com IDs numéricos (como vêm do banco de dados) sem precisar converter para `key`:

```javascript
// ✅ Funciona automaticamente!
const users = [
  { id: 1, name: "Alice" },  // ID numérico
  { id: 2, name: "Bob" }
];

const diff = diffJson(users, updated);
// Smart keys rastreia por "#1" e "#2" automaticamente
```

**100% compatível** com código existente que usa `key`!

## Como Usar

### Exemplo Básico

```javascript
import { diffJson, patchJson } from 'json-myers';

const original = {
  name: "João",
  age: 30,
  hobbies: ["leitura", "música"]
};

const modified = {
  name: "João Silva",
  age: 30,
  hobbies: ["leitura", "música", "esportes"],
  city: "São Paulo"
};

// Calcular diferenças
const diff = diffJson(original, modified);
// {
//   name: "João Silva",
//   hobbies: {
//     "$__arrayOps": [
//       { type: "add", index: 2, item: "esportes" }
//     ]
//   },
//   city: "São Paulo"
// }

// Aplicar diferenças
const result = patchJson(original, diff);
// result === modified
```

### Trabalhando com Arrays

```javascript
// Arrays simples
const diff1 = diffJson([1, 2, 3], [1, 3, 4]);
// {
//   "$__arrayOps": [
//     { type: "remove", index: 1, item: 2 },
//     { type: "add", index: 2, item: 4 }
//   ]
// }

// Detecção de movimentação
const diff2 = diffJson(["A", "B", "C"], ["B", "C", "A"]);
// {
//   "$__arrayOps": [
//     { type: "move", from: 0, to: 2, item: "A" }
//   ]
// }
```

### Smart Keys - Arrays de Objetos (com IDs numéricos!)

```javascript
const users1 = [
  { id: 1, name: "Alice", role: "admin" },
  { id: 2, name: "Bob", role: "user" }
];

const users2 = [
  { id: 2, name: "Bob", role: "admin" },    // Bob promovido
  { id: 1, name: "Alice", role: "admin" },  // Alice mudou de posição
  { id: 3, name: "Carol", role: "user" }    // Carol adicionada
];

const diff = diffJson(users1, users2);
// {
//   "$__arrayOps": [
//     { type: "move", from: 0, to: 1, item: "#1" },  // Alice move
//     { type: "add", index: 2, key: "3" }             // Carol add
//   ],
//   "2": { role: "admin" },  // Mudança em Bob (id: 2)
//   "3": { name: "Carol", role: "user" }  // Carol nova (id não duplicado)
// }

// ✨ IDs numéricos são automaticamente convertidos para strings nas keys!
```

### Removendo Propriedades

```javascript
const diff = diffJson(
  { a: 1, b: 2, c: 3 },
  { a: 1, c: 3 }
);
// {
//   b: { "$__remove": true }
// }

// Aplicar remoção
const result = patchJson({ a: 1, b: 2, c: 3 }, diff);
// { a: 1, c: 3 }
```

### Diffs Profundos

```javascript
const state1 = {
  user: {
    profile: {
      name: "João",
      settings: {
        theme: "light",
        notifications: true
      }
    }
  }
};

const state2 = {
  user: {
    profile: {
      name: "João",
      settings: {
        theme: "dark",
        notifications: true,
        language: "pt-BR"
      }
    }
  }
};

const diff = diffJson(state1, state2);
// {
//   user: {
//     profile: {
//       settings: {
//         theme: "dark",
//         language: "pt-BR"
//       }
//     }
//   }
// }
```

## API Completa

### diffJson(original, modified)

Calcula a diferença entre dois valores JSON.

```typescript
function diffJson(original: any, modified: any): any
```

**Retornos especiais:**
- `{}`: Nenhuma mudança
- Valor direto: Quando o tipo muda completamente
- Objeto com mudanças: Para objetos e arrays

### patchJson(base, diff)

Aplica um diff a um valor base.

```typescript
function patchJson(base: any, diff: any): any
```

### myersDiff(arrayA, arrayB)

Calcula diff básico entre dois arrays usando algoritmo de Myers.

```typescript
type Operation = 
  | { type: "add", index: number, item: any }
  | { type: "remove", index: number, item: any }

function myersDiff(a: any[], b: any[]): Operation[]
```

### myersDiffOptimization(operations)

Otimiza operações de diff detectando movimentações.

```typescript
type OptimizedOperation = Operation | 
  { type: "move", from: number, to: number, item: any }

function myersDiffOptimization(ops: Operation[]): OptimizedOperation[]
```

### convertJsonMyersToGitDiff(lines, operations, filename)

Converte operações de diff para formato unified diff do Git.

```typescript
function convertJsonMyersToGitDiff(
  lines: string[], 
  operations: Operation[], 
  filename: string
): string
```

## Formatos de Diff

### Operações de Array

```javascript
{
  "$__arrayOps": [
    { type: "add", index: 2, item: "novo" },
    { type: "remove", index: 0, item: "antigo" },
    { type: "move", from: 1, to: 3, item: "movido" }
  ]
}
```

### Modificações com Smart Keys

```javascript
{
  "$__arrayOps": [
    { type: "move", from: 0, to: 2, item: "#user-1" }
  ],
  "user-1": {               // mudanças no objeto com key="user-1"
    name: "Nome Atualizado"
  },
  "user-2": {               // mudanças no objeto com key="user-2"
    email: "novo@email.com"
  }
}
```

### Remoção de Propriedade

```javascript
{
  propriedade: { "$__remove": true }
}
```

## Casos de Uso

### 1. **Sincronização de Estado**

```javascript
// Cliente envia apenas mudanças
const localState = getLocalState();
const remoteState = await fetchRemoteState();
const diff = diffJson(remoteState, localState);

// Servidor aplica mudanças
await sendDiff(diff); // Envia apenas as diferenças
```

### 2. **Sistema de Undo/Redo**

```javascript
class History {
  constructor(initial) {
    this.states = [initial];
    this.diffs = [];
    this.current = 0;
  }
  
  push(newState) {
    const diff = diffJson(this.states[this.current], newState);
    this.diffs.push(diff);
    this.states.push(newState);
    this.current++;
  }
  
  undo() {
    if (this.current > 0) {
      this.current--;
      return this.states[this.current];
    }
  }
  
  redo() {
    if (this.current < this.states.length - 1) {
      this.current++;
      return this.states[this.current];
    }
  }
}
```

### 3. **Auditoria de Mudanças**

```javascript
// Registrar todas as mudanças
const auditLog = [];

function updateData(newData) {
  const oldData = getCurrentData();
  const diff = diffJson(oldData, newData);
  
  auditLog.push({
    timestamp: new Date(),
    user: getCurrentUser(),
    changes: diff
  });
  
  saveData(newData);
}
```

### 4. **Colaboração em Tempo Real**

```javascript
// WebSocket para sincronização
socket.on('state-change', (diff) => {
  const currentState = getState();
  const newState = patchJson(currentState, diff);
  setState(newState);
});

// Enviar mudanças locais
function handleLocalChange(newState) {
  const diff = diffJson(lastSyncedState, newState);
  socket.emit('state-change', diff);
  lastSyncedState = newState;
}
```

## Performance

- **Algoritmo de Myers**: O(ND) onde N = tamanho, D = distância de edição
- **Otimizado para**: Mudanças pequenas em estruturas grandes
- **Smart Keys**: Reduz complexidade em arrays de objetos
- **Caching**: IDs de objetos são cacheados durante o diff

## Limitações

- Não detecta renomeação de propriedades (trata como remove + add)
- Objetos circulares não são suportados
- Arrays muito grandes podem ter performance degradada no pior caso
- Ordem de aplicação de patches importa para arrays

## Comparação com Alternativas

| Feature | json-myers | deep-diff | json-patch |
|---------|-----------|-----------|------------|
| Algoritmo | Myers | Recursivo | RFC 6902 |
| Detecção de movimento | ✅ | ❌ | ❌ |
| Smart Keys | ✅ | ❌ | ❌ |
| Formato de saída | Customizado | Customizado | JSON Patch |
| Performance | Alta | Média | Média |
| Tamanho do diff | Mínimo | Médio | Grande |

## Changelog

### v1.0.0-rc (2025-11-22) ✅

**Status:** Estável - Pronto para Produção

**Bug Fixes:**
- 🐛 Corrigido bug crítico de duplicação ao aplicar moves após removes com smart keys
- 🐛 Corrigido cálculo incorreto de `removedIndices` em `patchJson.ts`

**Features:**
- ✨ 3 suítes completas de teste de histórico Git-like (simple, objects, complex)
- ✨ Validação de round-trip perfeita em todos os cenários
- ✨ Validação de idempotência
- ✨ Suporte a mix caótico de tipos (vida real)

**Tests:**
- ✅ 146/146 testes passando (100%)
- ✅ 0 testes falhando
- ✅ Cobertura completa de casos críticos
- ✅ 3 suítes de histórico (simple, objects, complex)

**Breaking Changes:**
- Nenhum! 100% compatível com versões anteriores

---

## Licença

MIT © 2025 Anderson D. Rosa