# Myers — Lógica do Algoritmo

O algoritmo de Myers (Eugene W. Myers, 1986) calcula o **menor script de edição** entre duas sequências em tempo `O(N·D)`, onde `N` é o tamanho combinado e `D` é a distância de edição. É o mesmo algoritmo que o Git usa para diffs de arquivo.

> Paper original: [*An O(ND) Difference Algorithm and Its Variations*](http://www.xmailserver.org/diff2.pdf).

Este documento explica **a teoria** que o `json-myers` implementa.
Para o formato de saída, veja [`DIFF_FORMAT.md`](./DIFF_FORMAT.md).
Para como o patch aplica os ops, veja [`PATCH_LOGIC.md`](./PATCH_LOGIC.md).

---

## 1. Edit graph

Toda transformação de uma sequência `A` (eixo X) em outra `B` (eixo Y) pode ser modelada como um caminho num grafo:

```
       0   1   2   ← y (array FINAL = b)
     +---+---+---+
   0 |   | b | c |
     +---+---+---+
   1 | a |   |   |   ← x (array ORIGINAL = a)
     +---+---+---+
   2 | b |   |   |
     +---+---+---+
```

Cada movimento no grafo é uma operação:

| Movimento | Significado |
|---|---|
| → (direita) | **Remover** o item em `a[x]` (deletar do original) |
| ↓ (baixo) | **Adicionar** o item em `b[y]` (inserir no final) |
| ↘ (diagonal) | `a[x] === b[y]` — item igual, sem operação |

O algoritmo busca o caminho de `(0, 0)` a `(N, M)` com o **menor número de movimentos não-diagonais**.

---

## 2. A regra dos índices — ponto mais sutil do algoritmo

Quando o caminho desce ou anda direita, o item gerado precisa carregar um índice. **Qual referencial?**

| Operação | Movimento | `index` se refere a |
|---|---|---|
| `remove` | → | Posição no **array original** (`x` anterior) |
| `add` | ↓ | Posição no **array final** (`y` anterior) |

```ts
// Saída canônica do Myers:
{ type: "remove", index: prevX, item: a[prevX] }
{ type: "add",    index: prevY, item: b[prevY] }
```

### Por quê?

Pense semanticamente:

- **Remove** está dizendo "tira da posição X do original" → faz sentido referenciar o original
- **Add** está dizendo "no final, na posição Y, deve estar este item" → faz sentido referenciar o destino

Misturar os referenciais (e.g., usar `x` no `add`) é o **bug clássico** ao implementar Myers — e foi exatamente o bug histórico desta biblioteca, corrigido em `src/core/myersDiff.ts`.

### Exemplo passo a passo

```js
a = ["a", "b", "c"]
b = ["b", "c", "a"]
```

O `"a"` saiu da posição 0 do original e foi para posição 2 do final. `"b"` e `"c"` ficaram no lugar (estão na diagonal de igualdade).

Diff gerado:

```js
[
  { type: "remove", index: 0, item: "a" },  // a[0] removido
  { type: "add",    index: 2, item: "a" }   // b[2] adicionado
]
```

---

## 3. Como o algoritmo encontra o menor caminho

A implementação clássica usa uma estrutura `V[k]` que, para cada `d` (distância já percorrida) e cada `k` (diagonal `k = x - y`), guarda o **maior `x` alcançável**.

```ts
for (let d = 0; d <= max; d++) {
  for (let k = -d; k <= d; k += 2) {
    let x = (k === -d || (k !== d && v[k-1] < v[k+1]))
      ? v[k+1]      // veio de cima (add)
      : v[k-1] + 1; // veio da esquerda (remove)
    let y = x - k;

    // "Snake": anda na diagonal enquanto a[x] === b[y]
    while (x < N && y < M && a[x] === b[y]) { x++; y++; }

    v[k] = x;
    if (x >= N && y >= M) return backtrack(...);
  }
}
```

A cada `d`, o algoritmo expande a fronteira de pontos alcançáveis em exatamente `d` movimentos não-diagonais. Quando atinge `(N, M)`, encontrou o caminho mínimo.

O `backtrack` então percorre a história ao contrário e emite as operações.

Implementação completa em `src/core/myersDiff.ts`.

---

## 4. Optimização: detecção de move

O Myers cru só produz `add` e `remove`. Mas se o mesmo item aparece num par `remove + add`, isso é semanticamente um **move**.

Um pós-processamento (`myersDiffOptimization`) pareia operações:

```ts
// Entrada: [
//   { type: "remove", index: 3, item: "x" },
//   { type: "add",    index: 1, item: "x" }
// ]

// Saída: [
//   { type: "move", from: 3, to: 1, item: "x" }
// ]
```

Implementação em `src/core/myersDiffOptimization.ts`.

> **Limitação conhecida**: com múltiplos moves cujos índices `to` se afetam mutuamente, a saída direta de `myersDiffOptimization` aplicada de forma naive pode dar resultado incorreto. `patchJson` compensa via ajuste de índices (veja [`PATCH_LOGIC.md`](./PATCH_LOGIC.md)).

---

## 5. Aplicação dos ops — o problema dos referenciais

Aplicar diretamente os ops na ordem em que vêm do Myers **não funciona**, porque `remove.index` e `add.index` se referem a arrays diferentes (original vs final).

A estratégia correta é:

```
1. Aplicar removes do MAIOR para o MENOR índice
   (assim, índices ainda não tocados continuam válidos)

2. Aplicar adds do MENOR para o MAIOR índice
   (cada add insere e empurra os subsequentes para a frente —
    o que é correto porque o array já está no estado "pós-remove")
```

Veja `applyMyersDiff` em `src/core/myersDiff.ts` e a aplicação completa (com moves e smart keys) em [`PATCH_LOGIC.md`](./PATCH_LOGIC.md).

---

## 6. Complexidade

| Caso | Tempo | Espaço |
|---|---|---|
| Melhor caso (`A === B`) | O(N) | O(1) |
| Caso médio | O(N·D) | O(N·D) |
| Pior caso (sem overlap) | O(N²) | O(N²) |

Onde `D` é a distância de edição (número de operações não-diagonais no caminho ótimo). Para mudanças pequenas em arrays grandes, Myers é extremamente eficiente — `D` permanece pequeno.

---

## 7. Validação contra o Git

Para confirmar que uma implementação está correta:

```bash
echo -e "a\nb\nc" > original.txt
echo -e "b\nc\na" > final.txt
git diff --no-index --unified=0 original.txt final.txt
```

Saída:

```diff
@@ -1 +0,0 @@
-a              ← Remove linha 1 do original
@@ -3,0 +3 @@
+a              ← Add linha 3 do final
```

Note que o Git mostra explicitamente os referenciais diferentes (`-1` vs `+3`).

---

## Referências

- Eugene W. Myers, *An O(ND) Difference Algorithm and Its Variations* (1986)
- James Coglan, [*The Myers diff algorithm*](https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/) — série de artigos didática
- Robert Elder, [*Myers Diff Algorithm — Code & Interactive Visualization*](https://blog.robertelder.org/diff-algorithm/)
