import { clone, makeUsers, makeProducts } from "./generators.ts";
import { mulberry32, shuffleInPlace } from "./rng.ts";

export type Scenario = {
  id: string;
  title: string;
  category: string;
  /** Override identity field for this scenario (e.g. "sku"). myers
   * uses it via `options.identity`; jsondiffpatch already detects
   * `id ?? sku ?? key` via its objectHash configuration. */
  identity?: string;
  build: () => { a: unknown; b: unknown };
};

export const SCENARIOS: Scenario[] = [
  {
    id: "01-array-reverse-100",
    title: "Array reorder puro — 100 objs com id, reverse total",
    category: "reorder",
    build: () => {
      const a = makeUsers(1, 100);
      const b = clone(a).reverse();
      return { a, b };
    },
  },
  {
    id: "02-array-shuffle-and-update-100",
    title: "Reorder + nested update — 100 objs, shuffle + 5 updates",
    category: "reorder+update",
    build: () => {
      const a = makeUsers(2, 100);
      const b = shuffleInPlace(mulberry32(42), clone(a));
      for (let i = 0; i < 5; i++) b[i * 17].role = "admin";
      return { a, b };
    },
  },
  {
    id: "03-array-shift-500",
    title: "Array médio reorder — 500 objs, shift left de 1",
    category: "reorder-large",
    build: () => {
      const a = makeUsers(3, 500);
      const b = clone(a);
      const first = b.shift()!;
      b.push(first);
      return { a, b };
    },
  },
  {
    id: "04-array-sparse-mutation-1k",
    title: "Array grande mutação rala — 1.000 objs, 3 updates + 1 add",
    category: "sparse-large",
    build: () => {
      const a = makeUsers(4, 1000);
      const b = clone(a);
      b[10].role = "admin";
      b[500].status = "disabled";
      b[999].age = 99;
      b.push({
        id: "user-001000",
        name: "User 1000",
        role: "admin",
        status: "active",
        age: 30,
        email: "user1000@example.com",
      });
      return { a, b };
    },
  },
  {
    id: "05-array-insert-middle",
    title: "Insert no meio — 50 → 51 objs, add no índice 25",
    category: "insert",
    build: () => {
      const a = makeUsers(5, 50);
      const b = clone(a);
      b.splice(25, 0, {
        id: "user-INSERTED",
        name: "Inserted",
        role: "guest",
        status: "trial",
        age: 25,
        email: "ins@example.com",
      });
      return { a, b };
    },
  },
  {
    id: "06-smart-key-nested-update",
    title: "Smart-key nested update — 100 objs, role muda em 10",
    category: "nested-update",
    build: () => {
      const a = makeUsers(6, 100);
      const b = clone(a);
      for (let i = 0; i < 10; i++) b[i * 10].role = "admin";
      return { a, b };
    },
  },
  {
    id: "07-content-hash-array",
    title: "Content-hash array — 50 objs sem id, 5 mudados",
    category: "content-hash",
    build: () => {
      const a = makeUsers(7, 50).map((u) => {
        const { id: _id, ...rest } = u;
        return rest;
      });
      const b = clone(a);
      for (let i = 0; i < 5; i++) b[i * 9].role = "admin";
      return { a, b };
    },
  },
  {
    id: "08-flat-object-1-key",
    title: "Object plano — 10 keys, 1 update",
    category: "baseline",
    build: () => {
      const a = {
        title: "Original",
        version: 1,
        author: "Alice",
        date: "2026-01-01",
        tags: ["a", "b"],
        active: true,
        priority: 5,
        score: 99,
        notes: "none",
        owner: "team",
      };
      const b = { ...a, version: 2 };
      return { a, b };
    },
  },
  {
    id: "09-deeply-nested-leaf-change",
    title: "Object profundo aninhado — 5 níveis, mudança na folha",
    category: "nested",
    build: () => {
      const a = {
        l1: { l2: { l3: { l4: { l5: { value: "old", other: "keep" } } } } },
      };
      const b = {
        l1: { l2: { l3: { l4: { l5: { value: "new", other: "keep" } } } } },
      };
      return { a, b };
    },
  },
  {
    id: "10-mixed-array",
    title: "Mixed array — strings + objs + arrays, mudança em cada",
    category: "mixed",
    build: () => {
      const a = [
        "alpha",
        { id: "x", v: 1 },
        [1, 2, 3],
        "beta",
        { id: "y", v: 2 },
        42,
      ];
      const b = [
        "alpha",
        { id: "x", v: 99 },
        [1, 2, 3, 4],
        "beta-changed",
        { id: "y", v: 2 },
        42,
      ];
      return { a, b };
    },
  },
  {
    id: "11-products-with-sku-reorder",
    title: "Products com identity custom (sku) — 200 objs reorder + 10 updates",
    category: "custom-identity",
    identity: "sku",
    build: () => {
      const a = makeProducts(11, 200);
      const b = shuffleInPlace(mulberry32(101), clone(a));
      for (let i = 0; i < 10; i++) b[i * 19].price = 999.99;
      return { a, b };
    },
  },
  {
    id: "12-array-remove-half",
    title: "Array — 200 objs, remove de 50%",
    category: "remove",
    build: () => {
      const a = makeUsers(12, 200);
      const b = clone(a).filter((_, i) => i % 2 === 0);
      return { a, b };
    },
  },
  {
    id: "14-immutable-state-redux-style",
    title:
      "Estado imutável Redux/Immer-style — 1000 objs SEM id, 1 atualizado via spread",
    category: "ref-preserved",
    build: () => {
      // SEM `id` — força content-hash recursivo (caso onde o refCache
      // realmente brilha). Com smart-key, fingerprint já é O(1).
      const a = makeUsers(14, 1000).map((u) => {
        const { id: _id, ...rest } = u;
        return rest;
      });
      // Immer-style: novo objeto SÓ para o item que mudou. Os outros
      // 999 mantêm a ref original. Cenário típico de Redux/Zustand
      // onde imutabilidade estrutural é convenção.
      const b = a.map((u, i) => (i === 500 ? { ...u, role: "admin" } : u));
      return { a, b };
    },
  },
  {
    id: "15-multi-level-reorder-with-deep-change",
    title:
      "Triplo reorder + mudança profunda — array de users, cada um com array de childs",
    category: "nested-reorder",
    build: () => {
      // Estrutura aninhada com identidades em cada nível.
      // 3 mudanças simultâneas:
      //   1. users[]   reordenado
      //   2. users.alice.childs[] reordenado + mudança em c1.name
      //   3. users.frank.childs[] reordenado
      // Caso decisivo de "substantivos vs coordenadas" — myers fala em
      // ids (alice.childs.c1), jsondiffpatch fala em índices
      // POST-aplicação (1.childs.1), exigindo simulação mental.
      const a = {
        users: [
          {
            id: "alice",
            name: "Alice",
            childs: [
              { id: "c1", name: "Bob" },
              { id: "c2", name: "Carol" },
            ],
          },
          { id: "dave", name: "Dave", childs: [{ id: "c3", name: "Eve" }] },
          {
            id: "frank",
            name: "Frank",
            childs: [
              { id: "c5", name: "Gina" },
              { id: "c6", name: "Hugo" },
            ],
          },
        ],
      };
      const b = {
        users: [
          {
            id: "frank",
            name: "Frank",
            childs: [
              { id: "c6", name: "Hugo" },
              { id: "c5", name: "Gina" },
            ],
          },
          {
            id: "alice",
            name: "Alice",
            childs: [
              { id: "c2", name: "Carol" },
              { id: "c1", name: "Bob CHANGED" },
            ],
          },
          { id: "dave", name: "Dave", childs: [{ id: "c3", name: "Eve" }] },
        ],
      };
      return { a, b };
    },
  },
  {
    id: "13-mutated-and-shuffled-no-identity",
    title: "Reorder + mutação SEM identity (sem id, sem refs compartilhadas)",
    category: "no-identity-shuffle",
    build: () => {
      // Stripped users — no `id`, no `sku`, no `key`. No way for any
      // lib to declare identity. jsondiffpatch's objectHash falls back
      // to `$$index:N` (= positional). myers falls back to content-hash
      // (FNV-1a over the object content).
      //
      // Then: shuffle (refs destroyed by JSON.parse) + mutate 5 items.
      // The non-mutated items still hash to the same content fingerprint
      // — myers detects them as the same item moving; jsondiffpatch
      // can't, and degrades to positional LCS (= RFC 6902).
      const a = makeUsers(13, 100).map((u) => {
        const { id: _id, ...rest } = u;
        return rest;
      });
      const b = shuffleInPlace(mulberry32(913), clone(a));
      for (let i = 0; i < 5; i++) b[i * 17].role = "admin";
      return { a, b };
    },
  },
];
