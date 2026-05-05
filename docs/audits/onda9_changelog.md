# AXIS — Onda 9 Changelog

**Data:** 05/05/2026
**Status:** Concluída e aplicada em produção (HEAD `7ac2175`)
**Commits prod:** 11 (`a57ec8a` → `93323e9` → `746f41f` → `db2f460` → `4319528` → `cc921b6` → `5c76e6e` → `2de8e49` → `12d7d51` → `a9583ba` → `7ac2175`)

---

## §1. Resumo executivo

Onda 9 deu sequência ao endurecimento da Onda 8 fechando 2 débitos arquiteturais críticos (HUB-04 + HUB-05.A), expandindo a infraestrutura de Zod env validation (5 envs endurecidas + 11 envs adicionadas ao schema + 37 arquivos migrados para `env.X`), montando smoke CI Postgres real (com fixture mínima após 13+ migrations não-replay-safe), e adiando 2 blocos (E Playwright + G.2/G.3 calendar_connections RLS) para Onda 10 com decisões conscientes documentadas em `PONTOS_ATENCAO_ARQUITETURAL.md`.

**Padrão consolidado:** Trava 1 (read-only sem "vai") + Trava 7 (módulo alvo declarado por etapa) + Python+SHA256 obrigatório + CRLF→LF normalize + pausa entre etapas. Todo edit confirmou SHA-PRE/SHA-POS antes de prosseguir, com re-leitura pós-write para detectar corrupção FUSE.

**Impacto produção:** 0 incidentes, 11 commits aplicados sem rollback, 544/544 testes verdes (era 539 na Onda 8). 2 novos débitos abertos (HUB-09 + HUB-10), 2 fechados (HUB-04 + HUB-05.A).

---

## §2. Blocos e commits

| # | Bloco | Commit | Entrega | Arquivos |
|---|---|---|---|---|
| 0 | A.0 hotfix CI | `a57ec8a` | fix eslint-disable de regra inexistente em env.ts (quebrava CI da Onda 8) | 1 arquivo |
| 1 | A — Limpezas P3 | `93323e9` | Redis bind 127.0.0.1 (porta 6379) + cleanups env.ts | 2 arquivos |
| 2 | B — Endurecer Zod 5 envs | `746f41f` | `CLERK_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `INTERNAL_API_KEY`, `HOTMART_HOTTOK` rigorosos em prod (`startsWith`/`min`) + 17 testes Vitest | 2 arquivos (env.ts + env.test.ts) |
| 3 | C — Migrar process.env.X → env.X | `db2f460` | 37 arquivos refatorados em 7 lotes (98 refs migradas para usar validator centralizado) | 37 arquivos |
| 4 | C hotfix Build | `4319528` | 12 placeholders válidos no Build job CI (env.ts importado em 37 arquivos faz NODE_ENV=production triggar safeParse rigoroso no build) | 1 arquivo (`.github/workflows/ci.yml`) |
| 5 | D parte 1 — Smoke CI Postgres real | `cc921b6` | Job smoke real com 3 cron jobs SQL ABA (descobriu 13+ migrations não replay-safe) | 1 arquivo (`.github/workflows/ci.yml`) |
| 6 | D parte 2 — Fixture mínima + HUB-09 | `5c76e6e` | `scripts/ci/smoke-fixture.sql` (11 tabelas + dados de teste, 7359 bytes) + HUB-09 documentado em PONTOS_ATENCAO | 2 arquivos |
| 7 | F.1 — Migration 067 | `2de8e49` | `tenants.status` (active/orphan/inactive) + UPDATE marca 11 órfãos em prod (sem DELETE — preserva auditoria AXIS) + partial index | 1 arquivo (migration nova) |
| 8 | C.0.5 (recuperação tardia) | `12d7d51` | 11 envs adicionadas ao schema Zod (`DEFAULT_TENANT_ID`, `AXIS_ENCRYPTION_KEY`, `GOOGLE_REDIRECT_URI*`, `RESEND_FROM*`, `RESEND_ADMIN_EMAIL`, `CRON_SECRET_OLD`, `FIREBASE_*`, `AUDIO_UPLOAD_DIR`) — esquecido na Onda 9 inicial, mudança puramente aditiva (47 inserções, 0 remoções) | 2 arquivos (env.ts + env.test.ts) |
| 9 | F.2/F.3 — HUB-04 fechado | `a9583ba` | `with-tenant.ts` rejeita fallback admin se `status != 'active'` + emite alerta CRITICAL `TENANT_NOT_ACTIVE` + HUB-10 documentado (vitest flaky descoberto na validação) | 2 arquivos (with-tenant.ts + PONTOS_ATENCAO) |
| 10 | G.1 — HUB-05.A events RLS | `7ac2175` | Migration 068 RLS forced em `events` (5 callers já em `withTenant`, 0 órfãos runtime) + HUB-05 renomeado A/B com bloco STATUS PARCIAL | 2 arquivos (migration nova + PONTOS_ATENCAO) |

---

## §3. Achados endereçados

### Fechados em produção

- **HUB-04** — `withTenant.ts` fallback admin silencioso aceitava qualquer tenant Clerk sem profile. **Solução:** migration 067 adiciona `tenants.status` (active/orphan/inactive), 11 tenants órfãos prod marcados `orphan` (sem DELETE), e código rejeita fallback se status != 'active' lançando "Tenant <status>. Contate suporte." + alerta CRITICAL `TENANT_NOT_ACTIVE`. Validado prod (31 active + 11 orphan, app sem restart).
- **HUB-05.A** — `events` sem RLS forced (defesa em profundidade ausente). **Solução:** migration 068 ENABLE+FORCE ROW LEVEL SECURITY + policy `tenant_isolation` USING/WITH CHECK = `app_tenant_id()`. Mapeamento empírico confirmou 5/5 callers runtime (events/create, patients/[id]/evolution, patients/[id], sessions/[id]/finish, sessions/[id]/report/generate) já usam `withTenant` + `ctx.client`. Único impacto offline: `scripts/clean-test-users.sql` precisa rodar como `postgres` superuser pós-068.

### Endurecimento Zod (Bloco B)

- 5 envs server-side migradas de `optional()` para validação rigorosa em prod:
  - `CLERK_WEBHOOK_SECRET`: `min(20)` (38 chars confirmados em prod, prefix `whse_`)
  - `OPENAI_API_KEY`: `startsWith('sk-')` (164 chars, prefix `sk-p`)
  - `RESEND_API_KEY`: `startsWith('re_')` (36 chars, prefix `re_`)
  - `INTERNAL_API_KEY`: `min(20)` (26 chars confirmados)
  - `HOTMART_HOTTOK`: `min(8)` (66 chars confirmados)
- 17 testes Vitest cobrindo casos prod (todos passando + falhar quando ausente/inválido)

### Expansão schema env.ts (C.0.5)

11 envs adicionadas ao schema Zod centralizado (descobertas tardiamente, mudança puramente aditiva):

- `DEFAULT_TENANT_ID` (rota `/api/demo`)
- `AXIS_ENCRYPTION_KEY` (pgcrypto, isProd `min(20)`)
- `GOOGLE_REDIRECT_URI` + `_ABA` + `GOOGLE_WEBHOOK_URL_ABA`
- `RESEND_FROM` + `_TCC` + `_TDAH` + `RESEND_ADMIN_EMAIL`
- `CRON_SECRET_OLD` (rotação cron)
- `FIREBASE_PRIVATE_KEY` + `FIREBASE_CLIENT_EMAIL` (push, isProd rigoroso)
- `AUDIO_UPLOAD_DIR` (default `/var/lib/axis/audio`)

### Migração process.env.X → env.X (Bloco C)

37 arquivos refatorados em 7 lotes para usar `env.X` (validator Zod centralizado) em vez de `process.env.X` cru. 98 referências migradas. Excluiu `src/lib/crypto.ts` após Bloco C.0.5 testar conflito com `crypto.test.ts` (que muta `process.env.AXIS_ENCRYPTION_KEY` em runtime e o snapshot estático de env.ts ficava stale).

### Infraestrutura CI (Bloco D)

- Job `smoke` com Postgres 14 real (postgres-action) testando os 3 cron jobs SQL do ABA contra fixture mínima
- `scripts/ci/smoke-fixture.sql` (7359 bytes, 190 linhas, 11 tabelas + dados de teste) substituiu replay completo das 62 migrations após descoberta de 13+ migrations não replay-safe (HUB-09)
- 5 jobs CI agora: `validate-migrations`, `lint-and-typecheck`, `test`, `build`, `smoke`

### Documentados como débitos novos (`PONTOS_ATENCAO_ARQUITETURAL.md`)

- **HUB-09** — Migrations não rodam de zero em DB virgem. 13+ migrations assumem estado parcial pré-existente (ALTER de coluna que ainda não existe, INSERT em tabela criada por outra migration paralela, DROP de policy criada manualmente em prod). Solução proposta: `000_baseline.sql` via `pg_dump --schema-only` + manter migrations 001+ como deltas.
- **HUB-10** — Vitest test `tcc-isolation > analyze-clinical 401` flaky por timeout sob carga concorrente (10s default). Full-run 17 paralelos: 1/544 (0.18%) failure rate. Isolado: passa em 3.3s. Não-regressão (stack trace mostra fluxo auth pré-RLS check).

### Adiados conscientemente para Onda 10

- **HUB-05.B** — Refator 5 rotas runtime de `calendar_connections` (cron renew-webhook + webhook Google TCC + ABA + OAuth callbacks TCC + ABA + sessions/create createGoogleCalendarEvent) seguido de migration 069 RLS forced. Esforço estimado: 4-6h, sessão dedicada (CC novo + chat novo).
- **Bloco E** — Playwright nightly job. Bloqueado por HUB-09 (E2E exige DB completo, fixture mínima insuficiente).

---

## §4. Decisões registradas (D8–D14)

Numeração contínua da Onda 8 (que terminou em D7).

- **D8: Endurecimento Zod gradual após validação prod** — Bloco B endureceu 5 envs apenas após confirmar valores reais (chars, prefix). Documentado no schema com comentário `// Endurecido (Onda 9): confirmado em prod (XX chars, prefix Y).` Reduz risco de boot fail por surpresa.
- **D9: Migração env.ts em 7 lotes (não big-bang)** — 37 arquivos divididos em lotes de 5-6 por commit/sub-commit, com `tsc --noEmit` validando entre eles. Lote 1 também pegou bug `crypto.ts` (test conflict) cedo, evitando refator quebrado em produção.
- **D10: HUB-04 fix true via `status='orphan'` (não DELETE)** — Regra AXIS: alterações destrutivas em dados clínicos requerem rastreabilidade. Em vez de deletar 11 tenants órfãos, marcar `status='orphan'` preserva auditoria. Acessar como esses tenants gera alerta CRITICAL `TENANT_NOT_ACTIVE`.
- **D11: HUB-05 dividido em A (events agora) + B (calendar Onda 10)** — Plano original Bloco G era migration única RLS em ambas as tabelas. Mapeamento empírico G.0 mostrou 5 callers runtime de `calendar_connections` SEM `withTenant` (cron, webhooks Google públicos, OAuth callbacks). Aplicar RLS sem refator prévio quebraria produção. Decisão: events agora (5/5 callers compatíveis, baixo risco), calendar para Onda 10 com sessão dedicada.
- **D12: Smoke CI fixture mínima > replay completo** — Após smoke job falhar com 13+ migrations não replay-safe, ao invés de refatorar todas as migrations no momento, sintetizar fixture mínima (11 tabelas + dados) e documentar HUB-09 como débito. Custo benefício: smoke testa cron jobs reais em ~30s vs ~5min de replay falho.
- **D13: Build CI placeholders necessários pós-Bloco C** — Após env.ts importado em 37 arquivos, Next.js build (`NODE_ENV=production`) trigga `safeParse` rigoroso no schema. CI job Build precisou 12 placeholders válidos (CLERK secret prefix, password, etc.) injetados via env. Documentado em CI workflow.
- **D14: Trava 7 (módulo alvo declarado por etapa)** — Após Bloco C scope-creep risk, Trava 7 virou obrigatória. Cada etapa começa com "Trava 7: Módulo alvo: X. Arquivo: Y." antes de qualquer ação. Evita que CC/CC tenha entropia de scope quando o usuário diz só "vai".

---

## §5. Surpresas e aprendizados

11. **Build CI quebrou após Bloco C** porque env.ts importado em 37 arquivos faz Next.js durante build (`NODE_ENV=production`) executar `safeParse` rigoroso. CI usa env vars vazias por padrão → `throw new Error('Env validation failed in production')`. Fix: 12 placeholders válidos (`CLERK_SECRET_KEY=sk_test_xxx`, `DATABASE_PASSWORD=longenoughpassword123`, etc) no Build job. Aprendizado: validador centralizado tem efeito cascata em CI.
12. **`crypto.test.ts` mutava `process.env.AXIS_ENCRYPTION_KEY` em runtime** — incompatível com `env.ts` que faz snapshot estático no module load. Migrar `crypto.ts` para `env.X` quebrou os testes. Reverteu, documentou regra: arquivos com test counterpart que muta `process.env.X` devem ser excluídos da migração C.
13. **13+ migrations não replay-safe** — descoberto quando smoke job tentou aplicar 62 migrations em DB virgem. Causas variadas: DROP de policy criada manualmente em prod, ALTER coluna assumindo outra migration aplicada antes, INSERT em tabela ainda não criada. Sintetizar fixture mínima foi mais barato que refatorar todas as migrations. HUB-09 documentado para Onda 10 (~4h).
14. **`tcc-isolation > 401 sem auth` flaky em full-run** — passa isolado em 3.3s, falha em full-run de 17 test files paralelos por timeout 10s. IO concorrente satura. Failure rate 1/544 = 0.18%. Stack trace prova não-regressão de F.2 (lança "Não autenticado" em `withTenant:73` antes do bloco de status check). HUB-10 documentado com gatilhos (refatorar se rate >10% ou bloquear merge).
15. **Cron `renew-webhook` tinha TODO explícito linhas 7-15** antecipando HUB-05 ("Funciona hoje porque calendar_connections NAO tem RLS forced"). Comentar débito no código preservou contexto crítico para a decisão D11 — sem ele, plano original (RLS em ambas as tabelas) teria quebrado produção. Lição: comentários `TODO Item futuro (RLS X)` no código fonte valem mais que docs externos quando o débito é específico.
16. **F.1 (migration 067) aplicada em prod ANTES de F.2 (with-tenant.ts)** — permitiu rollback fácil (DROP COLUMN status) e validação isolada (31 active + 11 orphan, app sem restart). Padrão "DB primeiro, código depois" para defesa-em-profundidade ficou consolidado.
17. **f-string Python <3.12 não aceita `\r` interno** — bug encontrado no script de criação da migration 068 (último print falhou com SyntaxError parse-time, antes de qualquer execução). Fix: usar variáveis intermediárias (`cr_count = data.count(b'\r')`) ou Python 3.12+. Validador hook detectou que arquivo não foi criado, recovery rodou em segunda execução.
18. **Sandbox CC já sincronizado com origin/main sem `git fetch`** — ao iniciar Bloco H descobriu que HEAD local = HEAD origin (= `7ac2175`) apesar de fetch falhar por falta de credenciais HTTPS. Mecanismo de sincronia interno do workspace mantém worktree atualizado entre sessões PowerShell e CC.
19. **Bloco C.0.5 esquecido no plano original Onda 9** — só descoberto na investigação pré-commit do Bloco F (env.ts + env.test.ts modificados não-commitados). Mudança puramente aditiva (47 inserções, 0 remoções) virou commit avulso `12d7d51` antes do commit F. Lição: verificar `git diff --stat HEAD` antes de cada commit cirúrgico para detectar pendências esquecidas.

---

## §6. Validação em produção

| Camada | Resultado |
|---|---|
| `npx tsc --noEmit` (full) | EXIT 0 ✓ |
| `npx vitest run --exclude='e2e/**'` | 17 test files / 544 tests PASSED ✓ (HUB-10 não recidivou em G.3) |
| `validate-migrations.sh` 067 + 068 | OK ✓ |
| `next:build` (CI Build job) | OK pós-hotfix placeholders ✓ |
| `smoke` CI (3 cron SQL ABA contra fixture) | OK ✓ |
| Migration 067 em prod | UPDATE 11 (31 active + 11 orphan), app sem restart ✓ |
| Migration 068 em prod | Aplicada manualmente via psql, `pg_class` confirmou `relrowsecurity=t` + `relforcerowsecurity=t`, 1 policy `tenant_isolation` ALL ✓ |
| 11 commits aplicados sem rollback | ✓ |

---

## §7. Status final

- ✅ 11 commits aplicados em produção (HEAD `7ac2175`)
- ✅ Mirror Windows + VPS prod sincronizados
- ✅ HUB-04 FECHADO (admin fallback rejeita órfãos)
- ✅ HUB-05.A FECHADO (events RLS forced)
- ✅ Schema env.ts expandido (5 endurecidos + 11 adicionados = 16 envs novos/melhorados)
- ✅ 37 arquivos migrados para `env.X` validator
- ✅ Smoke CI Postgres real ativo
- ✅ HUB-09 + HUB-10 documentados em PONTOS_ATENCAO
- 🟡 HUB-05.B (calendar_connections RLS) adiado Onda 10
- 🟡 Bloco E (Playwright nightly) adiado Onda 10 (depende HUB-09)

---

## §8. Próximos passos

### Onda 10 — Prioridades

1. **HUB-09** — `000_baseline.sql` via `pg_dump --schema-only` + manter migrations 001+ como deltas (~4h). Bloqueia Bloco E.
2. **HUB-05.B** — Refator 5 rotas `calendar_connections` (cron, webhooks Google TCC+ABA, OAuth callbacks TCC+ABA, sessions/create) → migration 069 RLS forced em `calendar_connections` (~4-6h).
3. **Bloco E** — Playwright nightly job CI (depende HUB-09) (~1h30).
4. **HUB-10** — Investigar flaky `tcc-isolation > 401`. Opção B preferida (`test.concurrent(false)` ou separar em arquivo isolado). (~1h)

### Long-term

- HUB-03, HUB-07, HUB-08 (gatilhos `PONTOS_ATENCAO_ARQUITETURAL.md`)
- Limpeza histórica do git (senha histórica `AxisTcc2026!` ainda em commits Onda 8 pré-cleanup)
- Pendências repo (`tsconfig.tsbuildinfo` untrack, `.lnk` adicionar ao gitignore, asset `axisTDAH.png`, `competitive-brief-2026-04-29.md` commit avulso)
