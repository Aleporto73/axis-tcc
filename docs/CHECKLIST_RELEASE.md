## Checklist de Release — AXIS Clínico

### Pré-Deploy

- [ ] Código testado localmente (`npm run next:build` passa)
- [ ] Testes passando (`npx vitest run`)
- [ ] Migrations revisadas (se houver)
- [ ] Commit com mensagem descritiva
- [ ] Push pro GitHub

### Deploy VPS

- [ ] SSH no VPS: `ssh root@vmi2884668.contaboserver.net`
- [ ] `cd /root/axis-tcc`
- [ ] `git pull`
- [ ] Aplicar migrations (se houver): `docker exec -i axis-postgres psql -U axis -d axis_tcc < scripts/migrations/XXX.sql`
- [ ] `npm run next:build`
- [ ] `pm2 restart all`

### Pós-Deploy

- [ ] Testar health check: `curl https://axisclinico.com/api/health`
- [ ] Verificar logs: `pm2 logs axis-tcc --lines 50`
- [ ] Testar fluxo crítico manualmente (login, criar sessão, salvar)
- [ ] Verificar painel admin: `/admin` (alertas, webhooks)

### Rollback (se necessário)

- [ ] `git log --oneline -5` (pegar hash do commit anterior)
- [ ] `git reset --hard <hash>`
- [ ] `npm run next:build`
- [ ] `pm2 restart all`
- [ ] Se migration precisar rollback, executar SQL reverso manualmente
