## Checklist de Release — AXIS Clínico

### Pré-Deploy

- [ ] Código testado localmente (`npm run next:build` passa)
- [ ] Testes passando (`npx vitest run`)
- [ ] Migrations revisadas (se houver)
- [ ] Commit com mensagem descritiva
- [ ] Push pro GitHub

### Deploy VPS

- [ ] Publicação (staging e produção, inclusive migrations): seguir [docs/runbooks/PUBLICACAO.md](runbooks/PUBLICACAO.md).

### Pós-Deploy

- [ ] Testar health check: `curl https://axisclinico.com/api/health`
- [ ] Verificar logs: `pm2 logs axis-tcc --lines 50`
- [ ] Testar fluxo crítico manualmente (login, criar sessão, salvar)
- [ ] Verificar painel admin: `/admin` (alertas, webhooks)

### Rollback (se necessário)

- [ ] Volta: seguir [docs/runbooks/PUBLICACAO.md](runbooks/PUBLICACAO.md), passo 3.7.
