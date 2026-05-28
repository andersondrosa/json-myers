export type GenerateContext = {
  /** Optional identity field name (e.g. "id", "sku") for libs that
   * support per-call identity declaration (currently myers only). */
  identity?: string;
};

export type Adapter = {
  name: string;
  label: string;
  generate: (a: unknown, b: unknown, ctx?: GenerateContext) => unknown;
};

export type AdapterResult = {
  name: string;
  label: string;
  ok: boolean;
  diff?: unknown;
  bytes?: number;
  error?: string;
};
