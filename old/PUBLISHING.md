# Guia de Publicação — json-myers

Passo a passo para publicar uma nova versão no npm.

---

## Pré-requisitos

- Login no npm: `npm whoami` (ou `npm login`)
- Working tree limpa: `git status`
- Todos os testes passando: `pnpm test`
- Typecheck ok: `pnpm typecheck`
- Build ok: `pnpm build`

---

## Sequência

```bash
# 1. Garantir que tudo passa
pnpm typecheck
pnpm test
pnpm build

# 2. Atualizar versão (escolha um)
npm version patch    # 1.0.4 → 1.0.5  (bug fix)
npm version minor    # 1.0.4 → 1.1.0  (nova feature, sem breaking)
npm version major    # 1.0.4 → 2.0.0  (breaking change)

# Isso atualiza package.json + cria tag git automaticamente

# 3. Inspecionar o que será publicado
npm pack --dry-run

# 4. Publicar
npm publish

# 5. Enviar a tag
git push
git push --tags
```

O script `prepublishOnly` no `package.json` roda automaticamente `typecheck + test + build` antes de publicar — se algo falhar, a publicação aborta.

---

## O que é incluído no pacote

Definido em `package.json` → `files`:

```json
"files": ["dist", "public", "README.md", "LICENSE"]
```

| Incluído | Razão |
|---|---|
| `dist/` | Código compilado (CJS + ESM + DTS) |
| `public/` | Imagem do README (jason-myers.png) |
| `README.md` | Documentação principal exibida no npmjs.com |
| `LICENSE` | Licença MIT |

**Não incluído**: `src/`, `tests/`, `docs/`, configs. Quem instala recebe apenas o necessário pra usar.

---

## Bump de versão (semver)

| De | Para | Quando |
|---|---|---|
| **patch** (1.0.4 → 1.0.5) | Bug fix sem mudar API | Correção em comportamento, sem afetar contratos |
| **minor** (1.0.4 → 1.1.0) | Nova feature aditiva | Novo export, novo parâmetro opcional, nova capacidade |
| **major** (1.0.4 → 2.0.0) | Breaking change | Mudou assinatura, removeu export, mudou formato de diff |

Histórico recente já justifica um **minor**: `applyArrayOps` deixou de ser exportado em `src/index.ts`. Tecnicamente é breaking de API pública, mas como o uso fora desta lib é improvável, um minor (1.1.0) com nota no changelog é defensável.

---

## Pós-publicação

- Confirmar no [npmjs.com/package/json-myers](https://www.npmjs.com/package/json-myers)
- Verificar tag no GitHub
- Atualizar README/issues se houver mudança visível para usuários

---

## Troubleshooting

**`You do not have permission to publish`** — verifique `npm whoami` e se você é o owner do pacote no npm.

**`prepublishOnly` falha** — rode manualmente cada comando (`pnpm typecheck`, `pnpm test`, `pnpm build`) e corrija o erro antes de tentar publicar de novo.

**Versão já existe no npm** — npm não permite republicar a mesma versão. Bump primeiro.
