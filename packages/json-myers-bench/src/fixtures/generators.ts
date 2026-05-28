import { mulberry32, pickInt } from "./rng.ts";

const ROLES = ["admin", "user", "guest", "editor", "viewer"];
const STATUSES = ["active", "pending", "disabled", "trial"];
const CATEGORIES = ["electronics", "books", "clothing", "food", "tools"];

export type User = {
  id: string;
  name: string;
  role: string;
  status: string;
  age: number;
  email: string;
};

export type Product = {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
};

export function makeUser(seed: number, idx: number): User {
  const rng = mulberry32(seed + idx);
  return {
    id: `user-${idx.toString().padStart(6, "0")}`,
    name: `User ${idx}`,
    role: ROLES[pickInt(rng, 0, ROLES.length - 1)],
    status: STATUSES[pickInt(rng, 0, STATUSES.length - 1)],
    age: pickInt(rng, 18, 80),
    email: `user${idx}@example.com`,
  };
}

export function makeProduct(seed: number, idx: number): Product {
  const rng = mulberry32(seed + idx);
  return {
    sku: `SKU-${idx.toString().padStart(6, "0")}`,
    name: `Product ${idx}`,
    category: CATEGORIES[pickInt(rng, 0, CATEGORIES.length - 1)],
    price: pickInt(rng, 100, 99999) / 100,
    stock: pickInt(rng, 0, 500),
    active: rng() > 0.2,
  };
}

export function makeUsers(seed: number, count: number): User[] {
  return Array.from({ length: count }, (_, i) => makeUser(seed, i));
}

export function makeProducts(seed: number, count: number): Product[] {
  return Array.from({ length: count }, (_, i) => makeProduct(seed, i));
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
