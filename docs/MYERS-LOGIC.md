# Myers Algorithm - Lógica e Funcionamento

## 📚 O que é o Algoritmo de Myers?

O **Algoritmo de Myers** foi criado por Eugene W. Myers em 1986 e é o algoritmo usado pelo **Git** para calcular diferenças entre arquivos. Ele resolve o problema de encontrar o **menor script de edição** para transformar uma sequência em outra.

**Paper Original:** [An O(ND) Difference Algorithm and Its Variations](http://www.xmailserver.org/diff2.pdf)

---

## 🎯 Conceito Fundamental: Edit Graph

Myers modela o problema como um **grafo de edição**:

```
       0   1   2   (y - array FINAL)
     +---+---+---+
   0 |   | b | c | a
     +---+---+---+
   1 | a |   |   |
     +---+---+---+
   2 | b |   |   |
     +---+---+---+
   3 | c |   |   |
     +---+---+---+
 (x - array ORIGINAL)
```

### Movimentos no Grafo

1. **→ Horizontal (direita)**: DELETE do array original (eixo X)
2. **↓ Vertical (baixo)**: INSERT do array final (eixo Y)
3. **↘ Diagonal**: Items IGUAIS (sem operação)

### Coordenadas (x, y)

- **x**: Posição no **array ORIGINAL**
- **y**: Posição no **array FINAL**
- Partimos de (0, 0) e buscamos (N, M)

---

## 🔑 Regra Fundamental dos Índices

Esta é a **regra mais importante** para entender o Myers:

```typescript
// Operações geradas pelo Myers:
{
  type: "remove",
  index: X,        // ← Índice no array ORIGINAL (eixo X)
  item: original[X]
}

{
  type: "add",
  index: Y,        // ← Índice no array FINAL (eixo Y)
  item: final[Y]
}
```

### Por quê?

- **Remove**: Estamos removendo da sequência **original** → índice em X
- **Add**: Estamos adicionando para chegar na sequência **final** → índice em Y

---

## 📋 Exemplo Completo

### Arrays
```typescript
const original = ["a", "b", "c"];  // eixo X
const final    = ["b", "c", "a"];  // eixo Y
```

### O que aconteceu?
- "a" saiu da posição 0 e foi para posição 2
- "b" e "c" ficaram no lugar

### Diff gerado pelo Myers

```typescript
[
  { type: "remove", index: 0, item: "a" },  // remove de original[0]
  { type: "add",    index: 2, item: "a" }   // add em final[2]
]
```

**Observe:**
- Remove index=0: "a" está no índice 0 do **array original** ✅
- Add index=2: "a" vai para índice 2 do **array final** ✅

---

## ⚠️ Bug Comum: Usar Índice Errado no Add

### Implementação ERRADA (bug comum)

```typescript
function backtrack(trace, a, b) {
  // ... código ...

  if (x === prevX) {
    // ❌ ERRADO: usa 'x' (índice no array original)
    result.unshift({ type: "add", index: x, item: b[prevY] });
    y--;
  }
}
```

**Problema:** Usa `x` (posição no original) quando deveria usar `prevY` (posição no final)!

### Implementação CORRETA

```typescript
function backtrack(trace, a, b) {
  // ... código ...

  if (x === prevX) {
    // ✅ CORRETO: usa 'prevY' (índice no array final)
    result.unshift({ type: "add", index: prevY, item: b[prevY] });
    y--;
  } else {
    // ✅ Remove usa 'prevX' (índice no array original)
    result.unshift({ type: "remove", index: prevX, item: a[prevX] });
    x--;
  }
}
```

---

## 🔄 Como Aplicar o Diff?

Aqui está o **desafio**: Como transformar o array original usando operações com índices de arrays diferentes?

### Problema
```typescript
// Diff gerado:
[
  { type: "remove", index: 0, item: "a" },  // índice no original
  { type: "add",    index: 2, item: "a" }   // índice no FINAL!
]

// Como aplicar?
let arr = ["a", "b", "c"];

// 1. Remove índice 0:
arr.splice(0, 1);  // arr = ["b", "c"]

// 2. Add índice 2:
arr.splice(2, 0, "a");  // ❌ índice 2 não existe! arr tem length=2
```

### Solução: Aplicar de Trás para Frente

O Git e outras implementações aplicam as operações **na ordem reversa**:

```typescript
function applyMyersDiff(original, diff) {
  const result = [...original];

  // Aplicar de trás para frente
  for (let i = diff.length - 1; i >= 0; i--) {
    const op = diff[i];

    if (op.type === "remove") {
      result.splice(op.index, 1);
    } else if (op.type === "add") {
      result.splice(op.index, 0, op.item);
    }
  }

  return result;
}
```

**Por que funciona?**

Quando aplicamos de trás para frente:
1. Add é aplicado ANTES de remove
2. O add "prepara" o array para ter o tamanho correto
3. O remove depois ajusta removendo do índice original

### Exemplo Passo a Passo

```typescript
original = ["a", "b", "c"]
diff = [
  { type: "remove", index: 0, item: "a" },
  { type: "add", index: 2, item: "a" }
]

// Aplicar de trás para frente:

// i=1: add(index=2, "a")
["a", "b", "c"].splice(2, 0, "a")
→ ["a", "b", "a", "c"]  // duplicou temporariamente!

// i=0: remove(index=0, "a")
["a", "b", "a", "c"].splice(0, 1)
→ ["b", "a", "c"]  // ❌ ERRADO!
```

**Ainda não funciona!** O problema é que o índice do `add` (2) é para o array **final**, não intermediário!

---

## 🎯 Validação com Git

Para validar se sua implementação está correta:

```bash
# Criar arquivos de teste
echo -e "a\nb\nc" > original.txt
echo -e "b\nc\na" > final.txt

# Ver diff
git diff --no-index --unified=0 original.txt final.txt
```

**Output:**
```diff
@@ -1 +0,0 @@
-a              ← Remove linha 1 do ORIGINAL
@@ -3,0 +3 @@
+a              ← Add após linha 3 do FINAL
```

Git mostra claramente:
- Remove: linha do arquivo **original** (-a.txt)
- Add: linha do arquivo **final** (+b.txt)

---

## 📊 Comparação: Antes vs Depois da Correção

### ANTES (Bug)

```typescript
// myersDiff.ts linha 68
if (x === prevX) {
  result.unshift({ type: "add", index: x, item: b[prevY] });
  //                                    ↑ ERRADO!
}
```

**Output:**
```typescript
original = ["area_total", "area_util", "preco", "tipo_imovel", "descricao", "outros"]
final    = ["preco", "descricao", "area_total", "tipo_imovel", "area_util", "outros"]

// ❌ Gerava 3 adds para MESMO índice:
[
  { type: "remove", index: 0, item: "area_total" },
  { type: "remove", index: 1, item: "area_util" },
  { type: "remove", index: 3, item: "tipo_imovel" },
  { type: "add", index: 5, item: "area_total" },    // ← Todos para 5!
  { type: "add", index: 5, item: "tipo_imovel" },   // ←
  { type: "add", index: 5, item: "area_util" }      // ←
]
```

### DEPOIS (Correto)

```typescript
// myersDiff.ts linha 68
if (x === prevX) {
  result.unshift({ type: "add", index: prevY, item: b[prevY] });
  //                                    ↑↑↑↑↑ CORRETO!
}
```

**Output:**
```typescript
// ✅ Agora gera índices corretos:
[
  { type: "remove", index: 0, item: "area_total" },
  { type: "remove", index: 1, item: "area_util" },
  { type: "remove", index: 3, item: "tipo_imovel" },
  { type: "add", index: 2, item: "area_total" },    // ← Índices corretos!
  { type: "add", index: 3, item: "tipo_imovel" },   // ←
  { type: "add", index: 4, item: "area_util" }      // ←
]
```

---

## 🏗️ Implicações para Implementação

### 1. Myers está Correto Agora ✅

O algoritmo core em `src/1-core/myersDiff.ts` está gerando os índices corretos!

### 2. Aplicação Precisa Ser Ajustada ⚠️

A função `applyMyersDiff()` e a estratégia `[novo, old]` em `patchJson.ts` precisam ser ajustadas para lidar com:
- Remove: índice no array original
- Add: índice no array **final** (não intermediário!)

### 3. Estratégia de Aplicação

Duas abordagens possíveis:

**Opção A:** Converter índices finais para intermediários
```typescript
// Calcular onde o índice final cairia no array intermediário
// (após removes mas antes dos adds)
```

**Opção B:** Aplicar em ordem específica
```typescript
// 1. Aplicar todos os removes
// 2. Recalcular índices dos adds
// 3. Aplicar adds
```

**Opção C:** Estratégia [novo, old] (atual)
```typescript
// Usar estrutura intermediária onde índices nunca mudam
// Precisa ajustar para entender índices do array final
```

---

## 📚 Referências

- **Paper Original**: [An O(ND) Difference Algorithm and Its Variations](http://www.xmailserver.org/diff2.pdf) - Eugene W. Myers (1986)
- **Explicação Visual**: [Myers Diff Algorithm - Code & Interactive Visualization](https://blog.robertelder.org/diff-algorithm/)
- **Série de Artigos**: [The Myers diff algorithm: part 1](https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/) - James Coglan
- **Implementação Python**: [Myers Algorithm Implementation](https://gist.github.com/adamnew123456/37923cf53f51d6b9af32a539cdfa7cc4)
- **Fast Implementation**: [fast-myers-diff (npm)](https://github.com/gliese1337/fast-myers-diff)

---

## 🎓 Conclusão

O Algoritmo de Myers é **matematicamente perfeito** e usado pelo Git há décadas. A chave para implementá-lo corretamente é:

1. ✅ **Entender o Edit Graph**: X = original, Y = final
2. ✅ **Gerar índices corretos**: remove usa X, add usa Y
3. ⚠️ **Aplicar corretamente**: Lidar com índices de arrays diferentes

**Status Atual do Projeto:**
- ✅ Myers CORRIGIDO (linha 68 do `myersDiff.ts`)
- ⚠️ Aplicação precisa ser ajustada
- 🎯 Próximo passo: Ajustar `patchJson.ts` para lidar com índices do array final

---

**Última Atualização:** 2025-11-21
**Autores:** Anderson D. Rosa, Claude (Anthropic)
