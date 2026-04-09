# AXIS TCC — MIGRAÇÃO CRÍTICA: withTenant() em todas as rotas

O sistema tem 24 rotas que resolvem tenant manualmente com:

```sql
SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1
```

Isso ignora o cookie `axis_active_tenant` e vai quebrar em multi-tenant. Precisamos migrar todas para usar `withTenant()` de `src/database/with-tenant.ts`.

## Passo 0 — Entender o padrão atual:

```bash
# Como withTenant() funciona
cat src/database/with-tenant.ts

# Exemplo de rota que JÁ usa withTenant() corretamente
grep -rl "withTenant" app/api/ --include="*.ts" | head -1 | xargs head -50

# Como está a resolução manual (pra comparar)
grep -rn "SELECT id FROM tenants WHERE clerk_user_id" app/api/ --include="*.ts" | head -5
```

Me mostra os 3 resultados antes de começar qualquer migração.

---

## FASE 1 — Rotas clínicas (10 rotas, PRIORIDADE MÁXIMA):

Migrar uma por vez. Cada rota: substituir a resolução manual por `withTenant()`, manter a lógica de negócio intacta.

1. `app/api/analyze-clinical/route.ts`
2. `app/api/suggestions/route.ts` (GET)
3. `app/api/suggestions/[id]/decide/route.ts`
4. `app/api/transcribe/route.ts` (POST)
5. `app/api/transcribe/status/[jobId]/route.ts`
6. `app/api/chat-ana/route.ts` (TCC)
7. `app/api/aba/chat-ana/route.ts` (ABA)
8. `app/api/tdah/chat-ana/route.ts` (TDAH)
9. `app/api/audit/route.ts`
10. `app/api/stats/route.ts`

Commit após fase 1:

```bash
git add .
git commit -m "security: migrate 10 clinical routes to withTenant()"
```

---

## FASE 2 — Rotas de usuário/infra (7 rotas):

1. `app/api/user/profile/route.ts`
2. `app/api/user/licenses/route.ts`
3. `app/api/user/tenant/route.ts`
4. `app/api/user/activate-free/route.ts`
5. `app/api/push/register/route.ts`
6. `app/api/push/subscribe/route.ts`
7. `app/api/tcc/onboarding/route.ts` (tem 4x resolução manual — corrigir todas)

Commit após fase 2:

```bash
git add .
git commit -m "security: migrate 7 user/infra routes to withTenant()"
```

---

## FASE 3 — Rotas Google Calendar (5 rotas):

1. `app/api/google/callback/route.ts`
2. `app/api/google/disconnect/route.ts`
3. `app/api/google/status/route.ts`
4. `app/api/google/sync/route.ts`
5. `app/api/google/watch/route.ts`

Commit após fase 3:

```bash
git add .
git commit -m "security: migrate 5 Google Calendar routes to withTenant()"
```

---

## REGRAS:

- NÃO mude lógica de negócio — só a resolução de tenant
- Cada rota: mostra o ANTES (trecho com resolução manual) e DEPOIS (trecho com withTenant) antes de aplicar
- Rotas de webhook externo (ex: `/api/google/callback`, `/api/google/watch`) recebem request do Google, NÃO do browser — não têm cookie. Verificar se essas rotas precisam de tratamento diferente (ex: resolver tenant pelo `state`/token OAuth em vez do cookie). Se sim, me avisa antes de mudar e propõe a abordagem.
- Após cada fase: `npm run next:build` pra garantir que compila sem erros

---

## VERIFICAÇÃO FINAL (após fase 3):

```bash
# Deve retornar ZERO rotas (exceto webhooks externos que legitimamente não usam cookie)
grep -rL "withTenant" app/api/ --include="*.ts" 2>/dev/null
```

---

## DEPLOY (após git push, na VPS):

```bash
cd ~/axis-tcc
git pull
rm -rf .next
npm run next:build
pm2 restart all
```
