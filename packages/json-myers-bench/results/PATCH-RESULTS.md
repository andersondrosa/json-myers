# json-myers — patch bench

Aplicação isolada de `patchJson`. Sem comparação cross-lib — mede só a performance do próprio `json-myers` aplicando diffs pré-construídos.

Cada cenário valida `patchJson(base, diff, options) === expected` antes de medir. Bench via tinybench (mediana de p50).

Total de cenários: **11**.

## :index cell-edit (D-034)

| Cenário | Mediana | Throughput | Samples |
|---|---|---|---|
| Matrix 2D 10×10 — edit 1 cell | 625 ns | 1.57M / s | 279148 |
| Matrix 2D 100×100 — edit 1 cell | 980 ns | 998.27k / s | 176832 |
| Matrix 2D 1000×1000 — edit 1 cell | 2.51 µs | 386.84k / s | 66669 |
| Matrix 3D 50×50×50 — edit 1 cell (Nd recursion) | 1.10 µs | 891.17k / s | 153400 |
| Matrix 2D 100×100 — edit 100 cells (1% density) | 48.39 µs | 18.54k / s | 3074 |

## Map lookup (D-035)

| Cenário | Mediana | Throughput | Samples |
|---|---|---|---|
| Smart-key — 100 users, 10 nested updates | 7.67 µs | 127.08k / s | 23219 |
| Smart-key — 1.000 users, 50 nested updates | 82.99 µs | 11.38k / s | 2071 |
| Smart-key — 10.000 users, 100 nested updates | 1.491 ms | 633 / s | 118 |

## Mode overheads

| Cenário | Mediana | Throughput | Samples |
|---|---|---|---|
| Strict mode — 1.000 users, 50 nested updates | 81.59 µs | 11.59k / s | 2194 |
| $assertCollection — 1.000-item collection validation | 113.72 µs | 8.18k / s | 1414 |

## Realistic composition

| Cenário | Mediana | Throughput | Samples |
|---|---|---|---|
| Multi-level reorder + deep change (cenário 15 reaproveitado) | 2.14 µs | 451.10k / s | 77917 |
