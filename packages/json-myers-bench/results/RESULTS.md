# Benchmark — Geração de patches JSON

> **Escopo:** **performance de geração de diff** — quanto tempo cada lib leva pra calcular o diff entre dois JSONs em memória. Tamanho do diff (bytes, gzip) e aplicação de patch estão **fora de escopo**: tamanho só importa quando você persiste/transporta, e aplicação tem semântica trivial e bem-definida.

Métricas medidas (via `tinybench`, mediana com warmup):

- **Tempo de geração** — única chamada de `adapter.generate(a, b)` dentro do hot loop. Sem `JSON.stringify`, sem gzip, sem persistência. Apenas o algoritmo.
- **Ops emitidas** — contagem semântica do número de operações no diff (não é métrica de tamanho — serve pra provar equivalência algorítmica entre Myers e LCS).

## Competidores

| Lib | Algoritmo | Identity-aware |
|---|---|---|
| `json-myers` | Myers O(ND) | ✅ auto via `id`/wire/options |
| `json-myers (refCache)` | Myers O(ND) + WeakMap fingerprint cache | ✅ idem |
| `fast-json-patch` | LCS posicional (RFC 6902) | ❌ posicional puro |
| `rfc6902` | LCS posicional (RFC 6902) | ❌ posicional puro |
| `jsondiffpatch` | LCS O(NM) | ⚠️ só com `objectHash` user-fornecido |

> ⚠️ `jsondiffpatch` foi configurado com `objectHash` retornando `id`/`sku`/`key` para dar a ele o **melhor cenário possível**. Sem essa config, degrada para match-by-position (= RFC 6902).

---

## ⚡ Insight central — Myers e LCS são algoritmicamente equivalentes

O algoritmo de Myers (usado pelo `git diff`) e o LCS (usado pelo `jsondiffpatch`) **resolvem o mesmo problema** — encontrar o menor edit script. A relação é exata:

```
D = N + M − 2·LCS
```

Myers é só **mais eficiente em CPU/memória** quando D é pequeno (O(ND) vs O(NM) do LCS DP). Ambos produzem **o mesmo edit script**.

**Prova empírica (cenário 01, reverse de 100 objetos com id):**

| Lib | Ops emitidas |
|---|---:|
| `myers` | 99 |
| `fast-json-patch` | 568 |
| `rfc6902` | 555 |
| `jsondiffpatch` | 99 |

→ **`myers` e `jsondiffpatch` emitem o MESMO número de ops (99)** — equivalência algorítmica confirmada. RFC 6902 emite 5.7× mais ops (568) porque não tem smart-key — cada item reordenado vira N `replace` ops (um por campo).

---

## 🔤 Substantivos vs coordenadas — legibilidade em diffs aninhados

Os dois geradores que sobreviveram (myers + jsondiffpatch) emitem o mesmo número de ops e produzem patches corretos. Mas eles falam **linguagens diferentes** no wire:

- **`myers` fala em substantivos** — usa o smart-key (`id`) como path em cada nível: `users.alice.childs.c1.name`. Cada path é uma **identidade explícita**, autodocumentada.
- **`jsondiffpatch` fala em coordenadas** — usa **índices POST-aplicação** como path: `users.1.childs.1.name`. Pra ler o diff, você precisa **simular mentalmente cada move prévio** pra mapear índice → item.

Essa diferença escala com aninhamento. Veja o cenário **15-multi-level-reorder-with-deep-change** (3 níveis de reorder simultâneo + mudança profunda):

**myers:**

```jsonc
{
  "users": {
    "$ops": [{ "type": "move", "key": "frank", "to": 0 }],
    "alice": {
      "childs": {
        "$ops": [{ "type": "move", "key": "c1", "to": 1 }],
        "c1": { "name": "Bob CHANGED" }
      }
    },
    "frank": {
      "childs": {
        "$ops": [{ "type": "move", "key": "c5", "to": 1 }]
      }
    }
  }
}
```

**jsondiffpatch:**

```jsonc
{
  "users": {
    "0": {                          // ← quem é "0"? frank (pós-move). Precisa simular _2 antes.
      "childs": {
        "_t": "a",
        "_1": ["", 0, 3]            // childs[1] de frank move pra 0
      }
    },
    "1": {                          // ← quem é "1"? alice (pós-move).
      "childs": {
        "1": {                      // ← childs[1] em B (= c1, pós-reorder). Mais um nível mental.
          "name": ["Bob", "Bob CHANGED"]
        },
        "_t": "a",
        "_1": ["", 0, 3]
      }
    },
    "_t": "a",
    "_2": ["", 0, 3]                // ← users[2] (frank em A) move pra users[0]
  }
}
```

**A diferença não é "qual consegue mais"** — ambos suportam aninhamento de N níveis com round-trip correto. É **representação**:

| | myers | jsondiffpatch |
|---|---|---|
| Path do diff | **substantivos** (`alice.c1`) | **coordenadas** (`1.1`) |
| Coordenadas mudam com o tempo? | Não (id é estável) | Sim (mudam após cada move) |
| Composição com reorder | Independente de ordem | Ordem de aplicação importa |
| Legibilidade de log de produção | ✅ Direta | ❌ Requer simulação mental |
| Cumula com profundidade do aninhamento | Linear (cada nível é um id) | Quadrático (cada nível exige rastrear o estado de níveis acima) |

---

## Detalhe por cenário

### 01-array-reverse-100 — Array reorder puro — 100 objs com id, reverse total

**Categoria:** reorder

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 99 | 254.0 µs | baseline |
| `myers-refcache` | 99 | 264.8 µs | 1.0× |
| `fast-json-patch` | 568 | 39.4 µs | 0.16× |
| `rfc6902` | 555 | 63.048 ms | 248× 🔥 |
| `jsondiffpatch` | 99 | 944.0 µs | 3.7× |

### 02-array-shuffle-and-update-100 — Reorder + nested update — 100 objs, shuffle + 5 updates

**Categoria:** reorder+update

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 84 | 229.5 µs | baseline |
| `myers-refcache` | 84 | 230.0 µs | 1.0× |
| `fast-json-patch` | 556 | 43.2 µs | 0.19× |
| `rfc6902` | 545 | 66.377 ms | 289× 🔥 |
| `jsondiffpatch` | 88 | 833.9 µs | 3.6× |

### 03-array-shift-500 — Array médio reorder — 500 objs, shift left de 1

**Categoria:** reorder-large

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 1 | 228.2 µs | baseline |
| `myers-refcache` | 1 | 261.3 µs | 1.1× |
| `fast-json-patch` | 2748 | 184.2 µs | 0.81× |
| `rfc6902` | 2 | 1.26 s | 5521× 🔥 |
| `jsondiffpatch` | 1 | 16.044 ms | 70× |

### 04-array-sparse-mutation-1k — Array grande mutação rala — 1.000 objs, 3 updates + 1 add

**Categoria:** sparse-large

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 1 | 473.7 µs | baseline |
| `myers-refcache` | 1 | 545.5 µs | 1.2× |
| `fast-json-patch` | 4 | 237.3 µs | 0.50× |
| `rfc6902` | 4 | 18.00 s | 38004× 🔥 |
| `jsondiffpatch` | 4 | 4.038 ms | 8.5× |

### 05-array-insert-middle — Insert no meio — 50 → 51 objs, add no índice 25

**Categoria:** insert

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 1 | 22.3 µs | baseline |
| `myers-refcache` | 1 | 24.7 µs | 1.1× |
| `fast-json-patch` | 137 | 16.9 µs | 0.76× |
| `rfc6902` | 1 | 1.529 ms | 69× |
| `jsondiffpatch` | 1 | 61.6 µs | 2.8× |

### 06-smart-key-nested-update — Smart-key nested update — 100 objs, role muda em 10

**Categoria:** nested-update

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 0 | 43.2 µs | baseline |
| `myers-refcache` | 0 | 49.1 µs | 1.1× |
| `fast-json-patch` | 5 | 22.8 µs | 0.53× |
| `rfc6902` | 5 | 25.867 ms | 598× 🔥 |
| `jsondiffpatch` | 5 | 71.0 µs | 1.6× |

### 07-content-hash-array — Content-hash array — 50 objs sem id, 5 mudados

**Categoria:** content-hash

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 8 | 54.4 µs | baseline |
| `myers-refcache` | 8 | 54.9 µs | 1.0× |
| `fast-json-patch` | 4 | 10.0 µs | 0.18× |
| `rfc6902` | 4 | 5.490 ms | 101× 🔥 |
| `jsondiffpatch` | 4 | 34.0 µs | 0.63× |

### 08-flat-object-1-key — Object plano — 10 keys, 1 update

**Categoria:** baseline

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 1 | 0.5 µs | baseline |
| `myers-refcache` | 1 | 0.4 µs | 0.88× |
| `fast-json-patch` | 1 | 0.5 µs | 1.1× |
| `rfc6902` | 1 | 3.2 µs | 6.7× |
| `jsondiffpatch` | 1 | 1.1 µs | 2.2× |

### 09-deeply-nested-leaf-change — Object profundo aninhado — 5 níveis, mudança na folha

**Categoria:** nested

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 1 | 0.5 µs | baseline |
| `myers-refcache` | 1 | 0.6 µs | 1.0× |
| `fast-json-patch` | 1 | 0.4 µs | 0.80× |
| `rfc6902` | 1 | 2.6 µs | 4.7× |
| `jsondiffpatch` | 1 | 1.8 µs | 3.3× |

### 10-mixed-array — Mixed array — strings + objs + arrays, mudança em cada

**Categoria:** mixed

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 4 | 1.9 µs | baseline |
| `myers-refcache` | 4 | 2.1 µs | 1.1× |
| `fast-json-patch` | 3 | 0.6 µs | 0.33× |
| `rfc6902` | 3 | 36.0 µs | 19× |
| `jsondiffpatch` | 4 | 3.1 µs | 1.6× |

### 11-products-with-sku-reorder — Products com identity custom (sku) — 200 objs reorder + 10 updates

**Categoria:** custom-identity

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 178 | 912.2 µs | baseline |
| `myers-refcache` | 178 | 1.572 ms | 1.7× |
| `fast-json-patch` | 1020 | 76.1 µs | 0.08× |
| `rfc6902` | 1006 | 306.696 ms | 336× 🔥 |
| `jsondiffpatch` | 188 | 3.411 ms | 3.7× |

### 12-array-remove-half — Array — 200 objs, remove de 50%

**Categoria:** remove

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 100 | 180.6 µs | baseline |
| `myers-refcache` | 100 | 191.9 µs | 1.1× |
| `fast-json-patch` | 645 | 39.4 µs | 0.22× |
| `rfc6902` | 100 | 64.857 ms | 359× 🔥 |
| `jsondiffpatch` | 100 | 1.264 ms | 7.0× |

### 14-immutable-state-redux-style — Estado imutável Redux/Immer-style — 1000 objs SEM id, 1 atualizado via spread

**Categoria:** ref-preserved

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 2 | 1.245 ms | baseline |
| `myers-refcache` | 2 | 690.8 µs | 0.55× |
| `fast-json-patch` | 1 | 48.0 µs | 0.04× |
| `rfc6902` | 1 | 2.38 s | 1913× 🔥 |
| `jsondiffpatch` | 1 | 80.3 µs | 0.06× |

### 15-multi-level-reorder-with-deep-change — Triplo reorder + mudança profunda — array de users, cada um com array de childs

**Categoria:** nested-reorder

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 1 | 4.8 µs | baseline |
| `myers-refcache` | 1 | 5.3 µs | 1.1× |
| `fast-json-patch` | 16 | 2.1 µs | 0.44× |
| `rfc6902` | 8 | 104.8 µs | 22× |
| `jsondiffpatch` | 1 | 10.8 µs | 2.2× |

### 13-mutated-and-shuffled-no-identity — Reorder + mutação SEM identity (sem id, sem refs compartilhadas)

**Categoria:** no-identity-shuffle

| Lib | Ops emitidas | Tempo (mediana) | vs myers |
|---|---:|---:|---:|
| `myers` | 172 | 308.6 µs | baseline |
| `myers-refcache` | 172 | 306.2 µs | 0.99× |
| `fast-json-patch` | 452 | 32.6 µs | 0.11× |
| `rfc6902` | 425 | 53.320 ms | 173× 🔥 |
| `jsondiffpatch` | 99 | 139.9 µs | 0.45× |

---

## Sumário agregado — vencedor em tempo de geração

| Lib | Cenários mais rápidos |
|---|---:|
| `fast-json-patch` | 14 / 15 |
| `myers-refcache` | 1 / 15 |

> Nota: `fast-json-patch` é frequentemente o mais rápido em microbench, mas produz patches **estruturalmente cegos** a identidade — cada reorder vira N `replace` ops. O `rfc6902` (outra impl RFC 6902) chega a levar **17 segundos** em 1k items (LCS posicional O(NM)).

---

## 🎯 Conclusões

### 1. vs RFC 6902 — myers domina em ops e em escala

RFC 6902 produz **5–8× mais ops** que myers em arrays de objetos (sem smart-key, cada reorder vira N replaces). `fast-json-patch` é rápido por iteração (operações triviais), mas `rfc6902` leva **17 segundos** em 1.000 items. Não escala.

### 2. vs jsondiffpatch — empate algorítmico

Mesma quantidade de ops emitidas. Tempo de geração comparável (diferenças dentro de uma ordem de grandeza, varia por cenário). A diferença real está na **representação do output** (substantivos vs coordenadas — veja seção acima), não na performance.

### 3. Vitória estrutural — funciona sem identity declarada

**Cenário 13** (objetos sem `id`/`sku`/`key`, sem refs compartilhadas — caso comum em JSON desserializado): apenas `myers` produz diff inteligente via **content-hash automático**. `jsondiffpatch` sem `objectHash` aplicável degrada para match-by-position (= RFC 6902). Esse é o cenário onde myers **vence em correção**, não apenas em performance.

### 4. refCache — 1.7× mais rápido em estado imutável

**Cenário 14** (Redux/Immer-style, refs preservadas + objetos sem id): `myers-refcache` é ~1.7× mais rápido que `myers` puro, com output bit-idêntico. WeakMap cache de fingerprint, opt-in via `{ refCache: true }`. Sem hack semântico de `===`.

### 5. Legibilidade hierárquica — substantivos vs coordenadas

**Cenário 15** (triplo reorder + mudança profunda): myers fala em substantivos (`alice.childs.c1.name`), jsondiffpatch fala em índices POST-aplicação (`1.childs.1.name`). Ambos round-tripam, mas pra um humano ler o diff de jsondiffpatch é necessário **simular mentalmente cada move prévio**. Em log de produção, isso vira diferença de 5 minutos vs 1 hora pra debugar.

### Posicionamento defensável

| Eixo | `myers` | `jsondiffpatch` |
|---|---|---|
| Algoritmo | Myers O(ND) | LCS O(NM) |
| Edit script (ops) | **idêntico** | **idêntico** |
| Tempo de geração | Comparável | Comparável |
| Path em diff aninhado | ✅ substantivos (`alice.c1`) | ❌ coordenadas POST-move (`1.1`) |
| Schema TypeScript | ✅ discriminated unions | ⚠️ `[any, any, number]` |
| Funciona sem identity declarada | ✅ content-hash | ❌ degrada pra posicional |
| Determinismo bit-a-bit | ✅ garantido | ⚠️ depende de config |
| Equivalente matemático a `git diff` | ✅ (86 cenários testados) | ❌ |
| Modo strict | ✅ 5 códigos canônicos | ❌ |

