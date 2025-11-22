import { describe, expect, it } from "vitest";
import { patchJson } from "../../src/3-patch/patchJson";

const original = [
  {
    key: "preco",
    type: "number",
    value: 530000,
    meta: { type: "BRL", min: 0, step: 1000 },
    role: "currency",
    label: "Preço de venda",
    as: "currency",
  },
  {
    key: "descricao",
    type: "string",
    value: "Imóvel recém-reformado com varanda gourmet.",
    meta: { maxLength: 1000 },
    role: "description",
  },
  {
    key: "area_total",
    type: "number",
    value: 130,
    meta: { type: "m²", min: 0 },
    role: "area",
    as: "area",
  },
  {
    key: "tipo_imovel",
    type: "string",
    value: "casa",
    meta: {
      options: [
        { key: "apartamento", label: "Apartamento" },
        { key: "casa", label: "Casa térrea" },
        { key: "studio", label: "Studio" },
      ],
    },
    role: "propertyType",
    label: "Tipo de imóvel",
  },
  {
    key: "quartos",
    type: "number",
    value: 4,
    meta: { min: 0, max: 10 },
    role: "bedrooms",
  },
  {
    key: "area_util",
    type: "number",
    value: 105,
    meta: { type: "m²", min: 0 },
    role: "area",
    as: "area",
  },
  {
    key: "banheiros",
    type: "number",
    value: 3,
    meta: { min: 0 },
    role: "bathrooms",
  },
  {
    key: "status",
    type: "string",
    value: "vendido",
    meta: {
      options: [
        { key: "disponivel", label: "Disponível" },
        { key: "vendido", label: "Vendido recentemente" },
      ],
    },
    role: "status",
  },
  { key: "vagas", type: "number", value: 3, meta: { min: 0 }, role: "garages" },
  {
    key: "ano_construcao",
    type: "number",
    value: 2015,
    meta: { min: 1900, max: 2025 },
    role: "constructionYear",
    label: "Ano de construção",
  },
  {
    key: "andares",
    type: "number",
    value: 2,
    meta: { min: 1 },
    role: "floors",
  },
];

const diff = {
  $__arrayOps: [
    { type: "add", index: 11, key: "andar" },
    { type: "add", index: 12, key: "possui_mobiliado" },
  ],
  andar: {
    type: "number",
    value: 3,
    meta: { min: 0 },
    role: "floorNumber",
    label: "Andar",
  },
  possui_mobiliado: {
    type: "boolean",
    value: true,
    role: "furnished",
    label: "Mobiliado",
  },
  preco: { value: 365000 },
  descricao: { value: "Studio compacto ideal para estudantes ou solteiros." },
  area_total: { value: 48 },
  tipo_imovel: {
    value: "studio",
    meta: { options: { $__arrayOps: [], studio: { label: "Studio moderno" } } },
  },
  quartos: { value: 1 },
  banheiros: { value: 1 },
  status: { value: "disponivel" },
  vagas: { value: 1 },
  ano_construcao: { value: 2022 },
  andares: { value: 1 },
  area_util: { value: null },
};

const _modified = [
  {
    key: "preco",
    type: "number",
    value: 365000,
    meta: { type: "BRL", min: 0, step: 1000 },
    role: "currency",
    label: "Preço de venda",
    as: "currency",
  },
  {
    key: "descricao",
    type: "string",
    value: "Studio compacto ideal para estudantes ou solteiros.",
    meta: { maxLength: 1000 },
    role: "description",
  },
  {
    key: "area_total",
    type: "number",
    value: 48,
    meta: { type: "m²", min: 0 },
    role: "area",
    as: "area",
  },
  {
    key: "tipo_imovel",
    type: "string",
    value: "studio",
    meta: {
      options: [
        { key: "apartamento", label: "Apartamento" },
        { key: "casa", label: "Casa térrea" },
        { key: "studio", label: "Studio moderno" },
      ],
    },
    role: "propertyType",
    label: "Tipo de imóvel",
  },
  {
    key: "quartos",
    type: "number",
    value: 1,
    meta: { min: 0, max: 10 },
    role: "bedrooms",
  },
  {
    key: "area_util",
    type: "number",
    value: null,
    meta: { type: "m²", min: 0 },
    role: "area",
    as: "area",
  },
  {
    key: "banheiros",
    type: "number",
    value: 1,
    meta: { min: 0 },
    role: "bathrooms",
  },
  {
    key: "status",
    type: "string",
    value: "disponivel",
    meta: {
      options: [
        { key: "disponivel", label: "Disponível" },
        { key: "vendido", label: "Vendido recentemente" },
      ],
    },
    role: "status",
  },
  {
    key: "vagas",
    type: "number",
    value: 1,
    meta: { min: 0 },
    role: "garages",
  },
  {
    key: "ano_construcao",
    type: "number",
    value: 2022,
    meta: { min: 1900, max: 2025 },
    role: "constructionYear",
    label: "Ano de construção",
  },
  {
    key: "andares",
    type: "number",
    value: 1,
    meta: { min: 1 },
    role: "floors",
  },
  {
    key: "andar",
    type: "number",
    value: 3,
    meta: { min: 0 },
    role: "floorNumber",
    label: "Andar",
  },
  {
    key: "possui_mobiliado",
    type: "boolean",
    value: true,
    role: "furnished",
    label: "Mobiliado",
  },
];

describe("Histórico de modificações com diffs (sem iteração)", () => {
  it("aplica modificação 0", () => {
    const modified = patchJson(original, diff);
    console.log(modified);
    expect(modified).toEqual(_modified);
  });
});
