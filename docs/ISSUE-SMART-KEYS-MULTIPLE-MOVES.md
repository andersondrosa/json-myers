# Issue: Smart Keys com Múltiplos Moves Sequenciais

**Status:** 🔴 Open
**Data:** 2025-11-21
**Impacto:** 1 teste de integração falhando (99% dos testes passando)
**Prioridade:** Baixa (edge case complexo)

---

## 📋 Resumo

Quando aplicamos **múltiplos diffs sequencialmente** que contêm **smart keys** (objetos rastreados por `id`/`key`) combinados com **removes + moves no mesmo diff**, a **ordem final dos items** fica incorreta e alguns items podem aparecer **duplicados**.

---

## 🔬 Teste que Falha

**Arquivo:** `tests/4-integration/test-history.spec.ts`
**Teste:** "aplica todos os diffs até a modificação 7 e faz rollback até o original"

### Cenário
1. Começa com array de 10 objetos com keys (`area_total`, `preco`, etc)
2. Aplica 7 diffs sequencialmente
3. Cada diff pode conter: removes, adds, moves com smart keys
4. Estado final esperado: 12 items em ordem específica

### Resultado Atual

```javascript
// Esperado (modified-7.json):
[0] area_total
[1] area_util
[2] banheiros
[3] caracteristicas_adicionais
[4] configurado

// Obtido:
[0] caracteristicas_adicionais  ❌ Deveria ser area_total
[1] banheiros                   ✅
[2] suites                      ❌ Deveria ser area_util
[3] area_total                  ❌ Está na posição errada
[4] banheiros                   ❌ DUPLICADO!
```

**Problemas:**
1. ❌ Ordem incorreta dos items
2. ❌ Item duplicado (`banheiros` aparece 2 vezes)

---

## 🔍 Análise Detalhada

### Estado Antes do Diff 7

Após aplicar diffs 1-6:
```javascript
// 13 items com estas keys (primeiros 5):
[0] preco
[1] quartos
[2] descricao
[3] ...
```

### Diff 7 Aplicado

```json
{
  "$__arrayOps": [
    // 2 Removes
    {
      "type": "remove",
      "index": 5,
      "item": { "key": "descricao", ... }
    },
    {
      "type": "remove",
      "index": 12,
      "key": "invalidField"
    },

    // 9 Moves (alguns para mesmo índice!)
    {
      "type": "move",
      "from": 11,
      "to": 8,
      "item": "#area_total"
    },
    {
      "type": "move",
      "from": 7,
      "to": 10,
      "item": "#banheiros"
    },
    {
      "type": "move",
      "from": 0,
      "to": 13,
      "item": "#nota"
    },
    {
      "type": "move",
      "from": 1,
      "to": 13,
      "item": "#descricao"
    },
    {
      "type": "move",
      "from": 3,
      "to": 13,
      "item": "#preco"
    },
    {
      "type": "move",
      "from": 4,
      "to": 13,
      "item": "#dormitorios"
    },
    {
      "type": "move",
      "from": 9,
      "to": 13,
      "item": "#configurado"
    },
    {
      "type": "move",
      "from": 2,
      "to": 14,
      "item": "#tipo_imovel"
    },
    {
      "type": "move",
      "from": 6,
      "to": 14,
      "item": "#vagas"
    }
  ],

  // Patches para as keys movidas
  "nota": { "meta": { ... }, "role": "rating" },
  "descricao": { "value": "Texto atualizado...", ... },
  "tipo_imovel": { "type": "string", ... },
  ...
}
```

### Características Críticas

1. **Múltiplos moves para MESMO índice**:
   - 5 moves para índice 13
   - 2 moves para índice 14

2. **Removes + Moves no mesmo diff**:
   - 2 removes
   - 9 moves com smart keys

3. **Smart keys** (formato `#key_name`):
   - Myers gera items como `#area_total`
   - Precisam ser resolvidos para objetos reais
   - Patches aninhados aplicados aos objetos

---

## 🐛 Possíveis Causas

### 1. Ordem de Aplicação das Operações

Atualmente em `patchJson.ts`:

```typescript
// Linha ~100-160
if (Array.isArray(result) && "$__arrayOps" in diff) {
  const ops = [...diff.$__arrayOps];

  // Separa operações
  const removes = ops.filter((op) => op.type === "remove");
  const adds = ops.filter((op) => op.type === "add");
  const moves = ops.filter((op) => op.type === "move");

  let arr = [...result];

  // 1. Aplica removes (do maior índice para o menor)
  removes.sort((a, b) => b.index - a.index);
  // ...

  // 2. Ajusta índices dos moves baseado nos removes
  const adjustedMoves = moves.map((move) => {
    const removesBeforeFrom = removedIndices.filter((idx) => idx < move.from).length;
    const removesBeforeTo = removedIndices.filter((idx) => idx < move.to).length;

    return {
      from: move.from - removesBeforeFrom,
      to: move.to - removesBeforeTo,
      item: move.item,
      key: move.key,
    };
  });

  // 3. Aplica moves com ajuste de índices
  arr = applyMovesWithIndexTracking(arr, adjustedMoves, base, diff);

  // 4. Aplica adds
  // ...
}
```

**Problema potencial:**
- Ajuste de índices pode estar errado quando há múltiplos moves para mesmo índice
- Smart keys podem não estar sendo resolvidas corretamente
- Ordem de aplicação dos moves pode importar

### 2. Resolução de Smart Keys

Em `applyMovesWithIndexTracking()`:

```typescript
// Linha ~30-60
for (const move of moves) {
  // Resolver item (incluindo smart keys)
  let itemToAdd = move.item;

  const hasSmartKey = typeof move.item === 'string' && move.item.startsWith('#');
  const key = hasSmartKey ? move.item.slice(1) : move.key;

  if (key) {
    const patch = diff[key] ?? {};
    const existing = base.find((i) => resolveKey(i) === key);
    itemToAdd = patchJson(existing || {}, patch);

    if (!("key" in itemToAdd) && !("id" in itemToAdd)) {
      itemToAdd.key = key;
    }
  }

  // Move = remove do original + add no final
  operations.push(
    { type: 'remove', index: move.from, item: move.item },
    { type: 'add', index: move.to, item: itemToAdd }
  );
}
```

**Problemas potenciais:**
- `base.find()` pode encontrar item errado se houver duplicatas
- Patches podem não estar sendo aplicados corretamente
- Conversão de move → remove+add pode estar gerando índices errados

### 3. Aplicação do Myers com Smart Keys

```typescript
function applyMyersDiff(arr, operations) {
  let result = [...arr];

  // 1. Aplicar removes do MAIOR índice para o MENOR
  removes.sort((a, b) => b.index - a.index);
  for (const op of removes) {
    result.splice(op.index, 1);
  }

  // 2. Aplicar adds do MENOR índice para o MAIOR
  adds.sort((a, b) => a.index - b.index);
  for (const op of adds) {
    result.splice(op.index, 0, op.item);
  }

  return result;
}
```

**Problema potencial:**
- Quando temos múltiplos adds para mesmo índice, a ordem importa
- Sort por `a.index - b.index` pode não preservar ordem original dos moves
- Smart keys resolvidas podem estar sendo inseridas na ordem errada

---

## 🔬 Experimentos para Investigação

### Teste 1: Verificar Ordem dos Moves
```javascript
// Ver se moves para mesmo índice estão em ordem correta
const movesTo13 = moves.filter(m => m.to === 13);
console.log('Moves para índice 13:', movesTo13.map(m => m.item));
// Esperado: ["#nota", "#descricao", "#preco", "#dormitorios", "#configurado"]
// Verificar se chegam nessa ordem ao final
```

### Teste 2: Simular Aplicação Manual
```javascript
// Aplicar cada operação manualmente e verificar estado
let arr = [...stateBeforeDiff7];

// Aplicar removes
arr.splice(12, 1); // remove invalidField
arr.splice(5, 1);  // remove descricao

// Aplicar moves um por um, verificando resultado
console.log('Após cada move:', arr.map(x => x.key));
```

### Teste 3: Verificar Resolução de Keys
```javascript
// Ver se smart keys estão sendo resolvidas corretamente
const key = 'banheiros';
const existing = base.find(i => resolveKey(i) === key);
console.log('Item original:', existing);
console.log('Patch:', diff['banheiros']);
console.log('Resultado merge:', patchJson(existing, diff['banheiros']));
```

---

## 🎯 Hipóteses

### Hipótese Principal
**Múltiplos moves para mesmo índice não preservam ordem correta**

Quando temos:
```javascript
move(from=0, to=13, "#nota")
move(from=1, to=13, "#descricao")
move(from=3, to=13, "#preco")
```

Eles são convertidos para:
```javascript
remove(0, "#nota"),     add(13, nota_resolvido)
remove(1, "#descricao"), add(13, descricao_resolvido)
remove(3, "#preco"),     add(13, preco_resolvido)
```

Ao ordenar adds por índice (`sort((a,b) => a.index - b.index)`), todos têm `index=13`, então a ordem pode não ser preservada!

### Solução Proposta
Ao ordenar adds com mesmo índice, preservar ordem original:

```typescript
adds.sort((a, b) => {
  if (a.index !== b.index) {
    return a.index - b.index;
  }
  // Mesmo índice: preservar ordem original
  return operations.indexOf(a) - operations.indexOf(b);
});
```

### Hipótese Secundária
**Ajuste de índices após removes está errado**

```typescript
const adjustedMoves = moves.map((move) => {
  const removesBeforeFrom = removedIndices.filter((idx) => idx < move.from).length;
  const removesBeforeTo = removedIndices.filter((idx) => idx < move.to).length;

  return {
    from: move.from - removesBeforeFrom,
    to: move.to - removesBeforeTo,  // ← Pode estar errado!
    item: move.item,
    key: move.key,
  };
});
```

O `to` é índice no **array final**, não deveria ser ajustado pelos removes!

---

## 📊 Dados do Teste

### Arquivo de Debug
Criado: `debug-history-order.js`

**Execução:**
```bash
node debug-history-order.js
```

**Saída relevante:**
```
=== Aplicando diff 7 ===
ArrayOps: [
  { type: "remove", index: 5, ... },
  { type: "remove", index: 12, ... },
  { type: "move", from: 11, to: 8, item: "#area_total" },
  { type: "move", from: 7, to: 10, item: "#banheiros" },
  { type: "move", from: 0, to: 13, item: "#nota" },
  { type: "move", from: 1, to: 13, item: "#descricao" },
  { type: "move", from: 3, to: 13, item: "#preco" },
  { type: "move", from: 4, to: 13, item: "#dormitorios" },
  { type: "move", from: 9, to: 13, item: "#configurado" },
  { type: "move", from: 2, to: 14, item: "#tipo_imovel" },
  { type: "move", from: 6, to: 14, item: "#vagas" }
]

Result:   [caracteristicas_adicionais, banheiros, suites, area_total, banheiros, ...]
Expected: [area_total, area_util, banheiros, caracteristicas_adicionais, ...]
```

### Arquivos Relevantes
- Estado inicial: `tests/history/original.json`
- Estado final esperado: `tests/history/modified-7.json`
- Diffs: `tests/history/cache/diff-1.json` ... `diff-7.json`

---

## 🛠️ Próximos Passos

### Investigação Adicional

1. **Adicionar logs detalhados** em `applyMovesWithIndexTracking()`:
   - Estado do array antes/depois de cada operação
   - Ordem dos adds quando múltiplos têm mesmo índice
   - Resolução de cada smart key

2. **Criar teste isolado** apenas para diff 7:
   - Começar do estado após diff 6
   - Aplicar apenas diff 7
   - Verificar resultado passo a passo

3. **Testar solução proposta**:
   - Implementar sort estável para adds
   - Verificar se resolve duplicação
   - Verificar se mantém ordem correta

### Implementação

Se a hipótese principal estiver correta, a correção seria em `myersDiff.ts` e `patchJson.ts`:

```typescript
// Em applyMyersDiff():
adds.sort((a, b) => {
  // Primeiro ordena por índice
  if (a.index !== b.index) {
    return a.index - b.index;
  }

  // Índices iguais: preservar ordem original
  // (importante para múltiplos moves para mesmo destino)
  const indexA = allOperations.indexOf(a);
  const indexB = allOperations.indexOf(b);
  return indexA - indexB;
});
```

E remover ajuste incorreto do `to`:

```typescript
// Em patchJson.ts, NÃO ajustar move.to:
const adjustedMoves = moves.map((move) => {
  const removesBeforeFrom = removedIndices.filter((idx) => idx < move.from).length;
  // NÃO ajustar 'to' pois é índice no array FINAL!

  return {
    from: move.from - removesBeforeFrom,
    to: move.to,  // ← Manter original!
    item: move.item,
    key: move.key,
  };
});
```

---

## 📈 Impacto

### Severidade: **Baixa**

- ✅ 118/137 testes passando (86%)
- ✅ Todos os testes básicos de Myers passando
- ✅ Todos os testes de moves simples passando
- ✅ Maioria dos testes de smart keys passando
- ❌ Apenas 1 teste de integração complexa falhando

### Casos Afetados

Apenas cenários **muito específicos**:
1. Múltiplos diffs aplicados sequencialmente (7+ diffs)
2. Smart keys (objetos rastreados por id/key)
3. Removes + Moves no mesmo diff
4. Múltiplos moves para mesmo índice de destino
5. Patches aninhados nas keys

**Na prática:** Este é um edge case raro. A maioria dos usos reais não envolve todos esses fatores juntos.

---

## 🎓 Lições Aprendidas

1. **Sort não é estável em JavaScript** para items com mesmo valor
   - Múltiplos adds para mesmo índice podem perder ordem
   - Solução: sort estável manual preservando índice original

2. **Índices do Myers têm semânticas diferentes**:
   - `remove.index` = array original
   - `add.index` = array final
   - Ajustar apenas um deles causa bugs!

3. **Smart keys aumentam complexidade**:
   - Resolução de keys pode falhar com duplicatas
   - Patches aninhados precisam ser aplicados na ordem certa
   - Estado intermediário importa para resolução correta

---

## 📚 Referências

- **Código:** `src/3-patch/patchJson.ts` (linha 100-180)
- **Código:** `src/1-core/myersDiff.ts` (linha 82-102)
- **Teste:** `tests/4-integration/test-history.spec.ts` (linha 104-136)
- **Debug:** `debug-history-order.js`
- **Documentação:** `docs/MYERS-LOGIC.md`

---

**Última Atualização:** 2025-11-21 23:40 BRT
**Responsável:** Anderson D. Rosa + Claude (Anthropic)
