# 📦 Guia de Publicação - json-myers

## ✅ Pré-requisitos

- [x] Conta no npmjs.com
- [x] Estar logado no npm: `npm login`
- [x] Todos os testes passando (146/146) ✅
- [x] Build funcionando ✅
- [x] Documentação atualizada ✅

## 🚀 Passos para Publicar

### 1. Verificar se está logado no npm

```bash
npm whoami
```

Se não estiver logado:
```bash
npm login
```

### 2. Verificar o que será publicado

```bash
npm pack --dry-run
```

Isso mostrará todos os arquivos que serão incluídos no pacote.

### 3. Rodar verificações finais

```bash
pnpm typecheck
pnpm test
pnpm build
```

Tudo deve passar sem erros! ✅

### 4. Publicar no npm

```bash
npm publish
```

Ou com pnpm:
```bash
pnpm publish
```

**Nota:** O script `prepublishOnly` rodará automaticamente antes da publicação:
- Typecheck
- Testes
- Build

### 5. Verificar a publicação

Acesse: https://www.npmjs.com/package/json-myers

Ou instale em um projeto teste:
```bash
npm install json-myers
```

---

## 📋 Checklist de Publicação

- [ ] Versão atualizada no `package.json`
- [ ] CHANGELOG.md atualizado
- [ ] README.md revisado
- [ ] Todos os testes passando (146/146)
- [ ] Build executado sem erros
- [ ] Git commit e push
- [ ] Tag criada: `git tag v1.0.0`
- [ ] Tag enviada: `git push origin v1.0.0`
- [ ] Publicado no npm
- [ ] Verificado no npmjs.com

---

## 🔄 Atualizações Futuras

### Para publicar uma nova versão:

1. **Atualizar versão** (escolha uma):
   ```bash
   npm version patch  # 1.0.0 → 1.0.1 (bug fixes)
   npm version minor  # 1.0.0 → 1.1.0 (new features)
   npm version major  # 1.0.0 → 2.0.0 (breaking changes)
   ```

2. **Commit e push**:
   ```bash
   git push
   git push --tags
   ```

3. **Publicar**:
   ```bash
   npm publish
   ```

---

## 📊 Arquivos Incluídos no Pacote

De acordo com `package.json` > `files`:

```
✅ dist/                    # Arquivos compilados
✅ README.md                # Documentação principal
✅ LICENSE                  # Licença MIT
✅ docs/ARCHITECTURE.md     # Arquitetura
✅ docs/MYERS-LOGIC.md      # Lógica do algoritmo
```

**Tamanho estimado:** ~30-40KB (comprimido)

---

## 🔒 Segurança

- ✅ Não publicamos código fonte TypeScript (`src/`)
- ✅ Não publicamos testes (`tests/`)
- ✅ Não publicamos arquivos de config
- ✅ Apenas dist + documentação essencial

---

## 🐛 Troubleshooting

### Erro: "You do not have permission to publish"
- Verifique se está logado: `npm whoami`
- Verifique se o nome do pacote está disponível

### Erro: "Package already exists"
- O nome `json-myers` já está em uso
- Escolha outro nome ou publique como scoped: `@seu-usuario/json-myers`

### Erro em prepublishOnly
- Rode manualmente: `pnpm typecheck && pnpm test && pnpm build`
- Corrija os erros antes de publicar

---

## 📈 Pós-Publicação

1. **Anunciar** nas redes sociais / comunidades
2. **Monitorar** downloads no npmjs.com
3. **Responder** issues no GitHub
4. **Manter** atualizado com bug fixes

---

**Versão atual:** 1.0.0
**Status:** Pronto para publicação! ✅
**Data:** 2025-11-22
