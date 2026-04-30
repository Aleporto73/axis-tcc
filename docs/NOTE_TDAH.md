# AXIS TDAH — NOTE ativo

**Atualizado:** 2026-04-30 manhã (Items 11C resolvido + 11D decidido — RESET `app.tenant_id` default global; tokens permanentemente fora de RLS Caminho A documentada em SKILL_TDAH §24; RLS 8 tabelas TDAH no total; migrations 057, 058, 060, 061 versionadas; 059 versionada como tentativa anterior)
**Produto:** AXIS TDAH (Transtorno de Deficit de Atencao e Hiperatividade)
**Motor:** CSO-TDAH v1.0 (3 blocos — base + executive + AuDHD layer)
**Bible:** AXIS_TDAH_BIBLE_v2.5 (congelada), PLANO_TDAH.md

> Fonte viva de decisoes operacionais. Historico completo em
> [/docs/archive/NOTE_TDAH_ARCHIVE.md](archive/NOTE_TDAH_ARCHIVE.md).
> Sessoes recentes em [/docs/sessoes/](sessoes/).

---

## FOCO ATUAL

**Pre-venda.** Fases 1-15 concluidas em 13-14/03/2026 (20 paginas, 37 APIs
internas + 3 portais publicos, 71 testes CSO-TDAH verdes). Bloco pre-venda
executado em 10/04/2026 (auditoria + SidebarTDAH v2 + 4 migracoes
withTenant + expansao portal familia).

**Pendente para producao:** deploy de migrations acumuladas (030, 031, 032,
038, 048) + validacao em producao + `npm audit fix` (17 vulns, 2 critical).

Produto mais novo dos 3 — compartilha infraestrutura com ABA/TCC:
auth Clerk, multi-tenant, billing Hotmart, audit logs, LGPD.

**Hub audit (20/04/2026) — SHARED/infra, commit chain ABA-led.** 6 commits no
hub que beneficiam TDAH sem tocar em código do produto. Novas proteções: (1)
**ESLint boundaries** (`eslint.config.mjs`, commit `af157c9`) impede que código
TDAH importe de `app/aba/**` ou do motor `src/engines/cso.ts` (TCC), e protege
`src/engines/cso-tdah.ts` + `cso-tdah-adapter.ts` de imports a partir de
ABA/TCC; (2) **Husky pre-commit validator** (commit `54312d8`) exige nome
`NNN_<modulo>_<descricao>.sql` + tag `-- COMMIT: ...` em migrations 057+;
(3) **MIGRATIONS_MAP.md** documenta ownership das 52 migrations;
(4) migration 056 (commit `a97d986`) adiciona `push_tokens` — relevante para
o plano de notificações mobile TDAH. CI ganhou passo `ESLint (boundaries)`.
Backup tag: `backup-pre-eslint`. Sessão: [sessoes/2026-04-20_hub_audit](sessoes/2026-04-20_hub_audit.md).

**Atualização 28/04/2026 — Ondas 5.3-5.6 + segurança:** 13 commits em prod cobrindo Ondas 5.3-5.6 (TDAH leak, race token-economy, CSP, cron-auth refactor), Item 12 team UUID bug, Item 21 rotação completa CRON_SECRET, Item 2 rate limit em analyze-clinical, e fix CI (mock rate-limit em vitest.setup). Detalhes em `docs/audits/onda7_backlog.md`.

**Atualização 29/04/2026 — Item 11 Fase A em prod:** RLS forced+enabled em 5 tabelas núcleo TDAH (`tdah_patients`, `tdah_sessions`, `tdah_observations`, `tdah_events`, `tdah_snapshots`) via migration `057_tdah_rls_phase_a.sql` (commit `9c99182`). Padrão policy: `tenant_isolation FOR ALL USING(tenant_id = app_tenant_id()) WITH CHECK(...)`. Caminho 2 (BEGIN/`set_config('app.tenant_id', $1, true)`/COMMIT) aplicado nos portais família+escola v3 (SHAs `92258502...` e `1b15011c...`) + sub-rota escola/drc no Patch 2 desta sessão. Migration `058_shared_app_tenant_id_function.sql` versiona retroativamente a função `app_tenant_id()` que existia em prod sem versionamento. Pendente: **Fase B = 15 tabelas tdah_\* restantes** (mapa completo + fatiamento B.0→B.4 em `docs/audits/onda7_backlog.md` Item 11A). Aprendizados-chave: (a) ler todos os callers ANTES de aplicar RLS; (b) `axis_app` é não-superuser e respeita RLS, `axis` é SUPERUSER e bypassa; (c) build stale após `git pull` exige `rm -rf .next && rebuild` antes de `pm2 restart`; (d) PowerShell sempre `-LiteralPath` em paths com `[colchetes]`.

**Fase B.1 (29/04/2026 — tentativa + correção):** Migration `059_tdah_rls_phase_b_1.sql` (commit `da21614`) tentou RLS em 4 tabelas (`tdah_drc`, `tdah_protocols`, `tdah_teacher_tokens`, `tdah_teacher_access_log`). Falhou no smoke escola GET com HTTP 500 `[AXIS RLS] app.tenant_id não definido` porque `tdah_teacher_tokens` é lida em `validateToken` Etapa 1 ANTES de saber `tenant_id` (chicken-and-egg). Aviso já constava nos comentários dos próprios portais (escola/`[token]`/route.ts e escola/`[token]`/drc/route.ts) mas foi ignorado na 059. Rollback em staging via `DROP POLICY` + `DISABLE+NO FORCE` nas 4 tabelas → ambiente verde. Prod nunca recebeu 059. Migration `060_tdah_rls_phase_b_1_corrected.sql` corrige excluindo `tdah_teacher_tokens` — RLS ativada apenas em 3 tabelas (`tdah_drc`, `tdah_protocols`, `tdah_teacher_access_log`). **Tokens (teacher + family) precisam design dedicado:** `validateToken` Etapa 1 lê token sem `tenant_id` setado, RLS bloqueia. **Decisão tomada em 30/04 manhã — Item 11D fechado (Caminho A):** tokens permanecem permanentemente fora de RLS por design — ver parágrafo "Decisão 30/04/2026 manhã" abaixo + `docs/SKILL_TDAH.md` §24.

**Achado pós-deploy 29/04/2026 (sessão noite — débito 11C aberto):** `pg_db_role_setting` em prod mostra que o database `axis_tcc` tem `app.tenant_id = '00000000-0000-0000-0000-000000000000'` setado como **default global pra todos os roles** via `ALTER DATABASE`. Origem desconhecida (não está em nenhum script versionado, history vazio, foi rodado manualmente em sessão antiga não rastreada). **Não afeta operação real:** middleware (`withTenant` + `set_config('app.tenant_id', ..., true)`) e wrap Caminho 2 nos portais sobrescrevem o zero default em cada request, então RLS funciona em runtime. **Mas mascara fail-loud:** teste de fail em prod retorna `count=0` silencioso em vez de levantar `[AXIS RLS] app.tenant_id não definido` exception. Confirmado empiricamente: 5 tabelas Fase A + 3 tabelas Fase B.1 em prod retornam `count=0` quando consultadas sem GUC; mesmas tabelas em staging (sem o default) levantam exception. **Risco:** qualquer query nova sem `withTenant`/wrap retorna 0 rows em vez de gritar — bug silencioso. **Pendente Item 11C (sessão dedicada):** investigar consumidores diretos do DB que possam estar dependendo do default + criar migration `061` com `ALTER DATABASE axis_tcc RESET app.tenant_id` + smoke pós-RESET pra confirmar fail-loud restaurado em prod sem quebrar nada em runtime.

**Atualização 30/04/2026 manhã — Item 11C resolvido em prod:** 4 etapas concluídas. **Etapa 1** (consumidores) — grep/auditoria mapeou consumidores diretos do DB (workers, scripts ad-hoc, jobs cron); todos seguros, nenhum dependia do default. **Etapa 2** (staging) — simulação de RESET em staging confirmou no-op (staging nunca teve o default). **Etapa 3** (prod) — `ALTER DATABASE axis_tcc RESET app.tenant_id` aplicado direto via psql em prod. Backup pgdump PRE preservado em `/root/backups/061_pre_reset/prod_20260430_101608.sql`. Fail-loud restaurado: `axis_app` sem GUC agora levanta `[AXIS RLS] app.tenant_id não definido` exception em vez de retornar `count=0` silencioso. Smoke prod pós-RESET: escola GET HTTP 200 com dados reais, health 200, zero erros AXIS RLS recentes nos logs. **Etapa 4** (versionar) — migration `061_shared_remove_app_tenant_id_default.sql` (commit `cc41ece`) versiona o RESET retroativamente: no-op em prod (já aplicado), efetiva em ambientes novos / disaster recovery / staging restore que herdem o default via `pg_dump --create` antigo. Decisão técnica documentada no header da migration: `ALTER DATABASE` não roda em bloco transacional (PG rejeita), usa `COMMIT;` literal como sentinela do hook `validate-migrations.sh`. **Aprendizado da resolução:** debt P3 sobre defaults globais via `ALTER DATABASE` agora está mitigado — qualquer outro default desconhecido em GUCs do DB deve ser auditado via `pg_db_role_setting` no próximo audit pass. Item 11C fechado em `docs/audits/onda7_backlog.md`.

**Decisão 30/04/2026 manhã — Item 11D: tokens permanentemente fora de RLS (Caminho A):** decidido em sessão dedicada que `tdah_teacher_tokens` e `tdah_family_tokens` ficam **permanentemente fora de RLS por design** (não é dívida técnica). **Justificativa:** (a) token hex64 globalmente UNIQUE (256 bits entropia), espaço de busca 2^256 torna descoberta cross-tenant infactível; (b) lookup por token descobre `tenant_id` — esse passo viabiliza o `set_config('app.tenant_id', ..., true)` subsequente; (c) RLS em tokens criaria chicken-and-egg sem ganho de segurança real (validado empiricamente pela tentativa 059 que falhou no smoke escola GET HTTP 500). **Defesa-em-profundidade preservada:** wrap Caminho 2 nas queries subsequentes + validação `expires_at + is_active` + rate limit (30 req/min GET, 15 req/min POST DRC). **Não criada migration 062 ADR** — migrations são pra mudanças no banco; decisão de não-aplicar fica em docs + código. Decisão documentada em 4 lugares: comentários dos portais `app/api/escola/[token]/route.ts` + `app/api/familia/[token]/route.ts` (commit `c95cbc3`); seção 24 de `docs/SKILL_TDAH.md` (commit `9ea2431`); este parágrafo; Item 11D em `docs/audits/onda7_backlog.md`. **Próximo passo:** seguir para Fase B.3 (5 tabelas internas baixo risco — `tdah_token_transactions`, `tdah_guardians`, `tdah_patient_therapists`, `tdah_plans`, `tdah_plan_goals`).

---

## PENDENCIAS (proxima sessao)

### P0 — validacao em producao
- [ ] **Migrations em producao** — validar que `030`, `031`, `032`, `038`, `048`, `057`, `058`, `060`, `061`
  foram aplicadas. Se nao:
  - `030_cleanup_phantom_licenses.sql` → licencas fantasma removidas
  - `031_tcc_cpf_crp.sql` → onboarding CPF/CRP (usado tambem em TDAH via perfil compartilhado)
  - `032_transcription_usage.sql` → limite transcricao (compartilhado)
  - `038_tdah_patient_therapists.sql` → vinculo N:N terapeuta-paciente TDAH
  - `048_fix_tdah_observation_enums.sql` → enums corretos (PIS/BSS/EXR/SEN/TRF)
  - `057_tdah_rls_phase_a.sql` → RLS Fase A em 5 tabelas nucleo (aplicada em prod 29/04, commit `9c99182`)
  - `058_shared_app_tenant_id_function.sql` → versiona funcao `app_tenant_id()` (no-op em prod, garante existencia em ambiente novo)
  - `059_tdah_rls_phase_b_1.sql` → **NAO aplicar em prod**: tentativa anterior com 4 tabelas, falhou no smoke escola GET (HTTP 500, chicken-and-egg em `tdah_teacher_tokens`), rollback em staging. Versionada como registro historico, prod nunca recebeu.
  - `060_tdah_rls_phase_b_1_corrected.sql` → RLS Fase B.1 em 3 tabelas (`tdah_drc`, `tdah_protocols`, `tdah_teacher_access_log`). **APLICADA EM PROD 29/04 sessão tarde** (commit `453f5dd` mergeado em `6b97ac8`, smoke escola GET HTTP 200 com dados reais).
  - `061_shared_remove_app_tenant_id_default.sql` → RESET `app.tenant_id` default global Item 11C (commit `cc41ece`). **APLICADA EM PROD 30/04 manhã** (smoke escola GET HTTP 200, fail-loud restaurado, backup PRE em `/root/backups/061_pre_reset/prod_20260430_101608.sql`). Versionada retroativamente — no-op em prod, efetiva em ambientes novos/disaster recovery.
- [ ] **`npm audit fix`** + revisao das 2 critical + 4 high identificadas
  em 10/04/2026

### P1 — bugs confirmados
- [ ] **`app/api/tdah/lgpd/delete/route.ts:244`** — `UPDATE session_summaries
  SET content = '[ANONIMIZADO]'` usa coluna `content` que nao existe no schema
  real (migration 007 tem `summary_text`). Falha silenciosa via SAVEPOINT.
  Impacto: LGPD delete nao anonimiza resumos (vazamento). Fix: trocar
  `content` por `summary_text`.

### Infra (P1) — licao sessao 17/04 ABA
- [ ] Adicionar infra de test DB real (docker-compose pg + migrations auto).
  A sessao ABA 17/04 descobriu 17+2+1 bugs que os 480 testes Vitest mockados
  nao detectaram. TDAH tem mesma exposicao — schema sweep pode revelar
  bugs similares em rotas TDAH (candidatas: `/api/tdah/lgpd/*`, `/api/tdah/escola/*`,
  `/api/tdah/familia/*`).

### Migration gaps conhecidos
- `scripts/migrations/MIGRATION_GAPS.md` — gaps 008-010 (consolidacao pre-007)
  e 041 (pulado no dev). Verificar se precisam de backfill.

---

## ARQUITETURA

```
Next.js 16 + React 19 + TypeScript
PostgreSQL 14 (Supabase, multi-tenant, RLS, audit imutavel)
Redis (cache)
Clerk Production Pro (auth multi-tenant, invitation flow)
Firebase Admin SDK (storage + FCM push)
Hotmart (billing webhook, product-aware: TDAH 7380571 + TCC + ABA)
Resend (email — template TDAH teal #0d7377)
OpenAI gpt-4o-mini (Chat Ana TDAH com SKILL_TDAH.md)
Google Calendar API (aprovado Google Brand 20/03)
Playwright (9 testes E2E TDAH — sequenciais)
PM2 (producao VPS)
Docker (container axis-postgres para migrations com permissao elevada)
```

---

## URLs PRODUCAO

| URL | O que e |
|---|---|
| `axisclinico.com` | Landing institucional (TCC + ABA + TDAH) |
| `axisclinico.com/produto/tdah` | Landing TDAH premium |
| `axisclinico.com/demo/tdah` | Demo publica (3 pacientes: Lucas, Sofia, Pedro) |
| `axisclinico.com/tdah` | Redirect → `/tdah/dashboard` |
| `axisclinico.com/tdah/dashboard` | Dashboard TDAH (logado) — KPIs tricontextual + CSO + AuDHD |
| `axisclinico.com/tdah/pacientes` | Lista + modal criacao (dados clinicos+escolares+responsavel) |
| `axisclinico.com/tdah/pacientes/[id]` | Ficha completa (protocolos + sessoes + CSO grafico + AuDHD toggle + guardians + DRC) |
| `axisclinico.com/tdah/sessoes` | Lista tricontextual (clinico/domiciliar/escolar) + filtros |
| `axisclinico.com/tdah/sessoes/[id]` | Conducao (observacoes + eventos + fechar + snapshot CSO) |
| `axisclinico.com/tdah/drc` | Daily Report Card (timeline por data, toggle goal_met, review) |
| `axisclinico.com/tdah/protocolos/[id]` | Detalhe protocolo + ciclo de vida (Bible §12) |
| `axisclinico.com/tdah/alertas` | Alertas clinicos (5 tipos, filtros por severidade) |
| `axisclinico.com/tdah/relatorios` | Relatorios imprimiveis por periodo |
| `axisclinico.com/tdah/planos` | Planos + goals (14 dominios Bible §13) |
| `axisclinico.com/tdah/casa` | Modulo casa (rotinas + economia de fichas) |
| `axisclinico.com/tdah/escola` | Gestao tokens de professor (admin/supervisor) |
| `axisclinico.com/tdah/familia` | Gestao tokens de responsavel (admin/supervisor) |
| `axisclinico.com/tdah/equipe` | Gestao terapeutas (admin/supervisor) |
| `axisclinico.com/tdah/configuracoes` | Perfil + Google Calendar + plano + privacidade |
| `axisclinico.com/tdah/ajuda` | Central de ajuda + Chat Ana TDAH |
| `axisclinico.com/tdah/precos` | 5 cards (Free + 3 pagos + Enterprise) |
| `axisclinico.com/tdah/onboarding` | Overlay 2 telas (LGPD + escolha) |
| `axisclinico.com/escola/[token]` | Portal publico professor (DRC) |
| `axisclinico.com/familia/[token]` | Portal publico responsavel (LGPD consent + protocolos + conquistas) |
| `axisclinico.com/sign-up?produto=tdah` | Cadastro TDAH |
| `axisclinico.com/hub` | Seletor TCC / ABA / TDAH |

---

## MODELO COMERCIAL (Hotmart)

**Empresa:** Psiform Tecnologia
**Produto Hotmart TDAH:** `7380571`

| Plano | Preco | Pacientes | Oferta Hotmart |
|---|---|---|---|
| Free | Gratuito | 1 | `/sign-up?produto=tdah` |
| Founders (50) | R$97/mes | 50 | `xqzgdn1i` |
| Clinica 100 | R$247/mes | 100 | `cr3rh0u9` |
| Clinica 250 | R$497/mes | 250 | `hxzwuwfh` |
| Enterprise | Sob consulta | Ilimitado | — |

**Link checkout Founders (recomendado):** `pay.hotmart.com/H?off=xqzgdn1i`

> Limites lidos de `user_licenses` via `src/database/product-limits.ts`
> (desde 10/04/2026 — nao mais `tenants.max_patients` global).

---

## IDS DEMO / DEV

Demo publica em `/demo/tdah` (3 pacientes ficticios com perfis distintos):

| Paciente | Idade | Perfil | Destaque |
|---|---|---|---|
| Lucas Mendes | 8a | AuDHD active_core | Evolucao positiva, SEN/TRF |
| Sofia Almeida | 6a | TDAH desatento | Regressao pos-mudanca escola, DRC escolar |
| Pedro Costa | 10a | TDAH combinado | Plato funcional, economia de fichas + rotina |

Mock: 7 snapshots CSO por paciente, 12 sessoes, 10 DRCs, 21 protocolos.

> **TBD — definir IDs reais de pacientes dev (UUIDs) depois.** Mock do demo
> usa dados hardcoded no `app/demo/tdah/`, nao precisam bater com dev.

---

## REGRAS IMUTAVEIS (BIBLE v2.5)

1. **Backbone compartilhado. Motor clinico derivado.** TDAH usa a mesma
   infraestrutura ABA/TCC mas motor CSO-TDAH e especifico.
2. **AuDHD NAO e produto separado — e layer dentro do TDAH.**
   Toggle no paciente: `off / active_core / active_full`.
3. **RIG e categorico (4 estados), NUNCA escala linear.**
4. **MSK e campo opcional ate validacao operacional.**
5. **Snapshot registra estado da layer no momento.** `audhd_layer_status`
   preservado em `tdah_snapshots`.
6. **Desativacao de layer preserva historico (append-only).**
   `tdah_audhd_log` registra cada mudanca: previous_status, new_status,
   changed_by, reason, engine_version.
7. **Missing data NUNCA e tratado como melhora.** Ausencia de observacoes
   nao significa que paciente esta bem.
8. **Sessao fechada e imutavel.** Bible §11. Rejeita PATCH com action.
9. **Julgamento clinico permanece humano.** IA nunca decide.

---

## REGRAS CRITICAS (compartilhadas com ABA/TCC)

1. `tdah_snapshots` → append-only (NUNCA UPDATE/DELETE)
2. `axis_audit_logs` → append-only, schema canonico
   `(tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)`
3. Portal escola NUNCA mostra CSO, snapshots, layer AuDHD
4. Portal familia NUNCA mostra CSO, snapshots, layer AuDHD, notas clinicas
5. Multi-tenant isolation obrigatorio — `withTenant()` + `canAccessTdahPatient()` (camada aplicacao) **+ RLS forced** em 5 tabelas nucleo desde Fase A (29/04, migration 057): `tdah_patients`, `tdah_sessions`, `tdah_observations`, `tdah_events`, `tdah_snapshots`. Policy `tenant_isolation` usa funcao `app_tenant_id()` (versionada em 058). Fase B vai cobrir 15 tabelas restantes — ver `docs/audits/onda7_backlog.md` Item 11A.
6. Pesos CSO-TDAH configuraveis via `engine_versions` (flexibilidade pos-piloto)
7. `tdah_patient_therapists` (N:N) e fonte-de-verdade desde Migration 038.
   Fallback `created_by` mantido para compatibilidade legada
8. Gate of silence — terapeuta nao autorizado recebe "Paciente nao encontrado"
   (404 generico, sem revelar existencia). Info leakage fix 23/03

---

## ARQUIVOS-CHAVE

### Engine clinico
| Arquivo | Funcao |
|---|---|
| `src/engines/cso-tdah.ts` | Motor CSO-TDAH v1.0 (3 blocos, 530 linhas, 71 testes) |
| `src/engines/cso-tdah-adapter.ts` | Converte observacoes DB → CsoTdahInput |
| `src/engines/__tests__/cso-tdah.test.ts` | 71 testes engine |

### Multi-tenant / Auth (compartilhado)
| Arquivo | Funcao |
|---|---|
| `src/database/with-tenant.ts` | Resolucao multi-tenant + `set_config('app.tenant_id', ..., true)` |
| `src/database/with-role.ts` | RBAC + `tdahPatientFilter()`, `tdahSessionFilter()`, `canAccessTdahPatient()` |
| `src/database/product-limits.ts` | Limite de pacientes por produto (desde 10/04) |

### Rotas TDAH principais (37 APIs)
| Rota | Funcao |
|---|---|
| `app/api/tdah/patients/` | CRUD pacientes + layer AuDHD toggle |
| `app/api/tdah/patient-therapists/` | N:N terapeuta-paciente (Migration 038) |
| `app/api/tdah/sessions/` | CRUD sessoes + open/close/cancel |
| `app/api/tdah/sessions/[id]/summary/` | Resumo sessao (draft → approve → send) |
| `app/api/tdah/observations/` | Registro observacoes com validacao Bible §7-§9 |
| `app/api/tdah/events/` | Eventos clinicos (8 tipos + ABC condicional) |
| `app/api/tdah/protocols/` + `protocol-library/` | Biblioteca 46 protocolos (42 P1 + 4 P1.1) |
| `app/api/tdah/scores/` | Scores CSO-TDAH (role filter) |
| `app/api/tdah/clinical-state/` | Estado clinico atual + 20 snapshots + delta |
| `app/api/tdah/drc/` | Daily Report Card (maximo 3 metas/dia Bible §17) |
| `app/api/tdah/plans/` | Planos + goals (14 dominios Bible §13) |
| `app/api/tdah/routines/` + `token-economy/` | Modulo casa |
| `app/api/tdah/escola/tokens/` | Tokens professor (gestao admin) |
| `app/api/escola/[token]/` | Portal publico professor (POST DRC) |
| `app/api/tdah/familia/tokens/` | Tokens responsavel (gestao admin) |
| `app/api/familia/[token]/` | Portal publico familia (consent LGPD + dados filtrados) |
| `app/api/tdah/dashboard/` | KPIs agregados + tricontextual + CSO + AuDHD |
| `app/api/tdah/alerts/` | 5 tipos (critical_score, regression, no_session, drc_pending, score_drop) |
| `app/api/tdah/reports/` | Agregado para relatorios imprimiveis |
| `app/api/tdah/team/` | Gestao terapeutas |
| `app/api/tdah/guardians/` | Responsaveis (is_primary, soft delete) |
| `app/api/tdah/chat-ana/` | Chat Ana TDAH (gpt-4o-mini + SKILL_TDAH.md) |
| `app/api/tdah/lgpd/export/` + `delete/` | LGPD (export JSON + delete agendada 90d) |

### Componentes TDAH
| Arquivo | Funcao |
|---|---|
| `app/components/SidebarTDAH.tsx` | v2 com popover "Contextos" (Escola + Familia + Casa) |
| `app/components/OnboardingTDAH.tsx` | Overlay 2 telas (LGPD + escolha) |
| `app/components/UpgradeModalTDAH.tsx` | Modal 403 limite — checkout Hotmart |
| `app/components/TooltipTDAH.tsx` | Tooltip teal com position: fixed |
| `lib/tooltips-tdah.ts` | 55 textos educativos (tom direto, 40+) |

### Billing compartilhado
| Arquivo | Funcao |
|---|---|
| `app/api/webhook/hotmart/route.ts` | Product-aware (TDAH 7380571, 3 ofertas) |
| `app/api/webhook/clerk/route.ts` | Auto-provisioning FREE (tenant + profile + licencas) |

### Base de conhecimento
| Arquivo | Funcao |
|---|---|
| `docs/SKILL_TDAH.md` | 698 linhas, 23 secoes — base da Chat Ana |
| `docs/AUDIT_TDAH_2026-04-10.md` | Auditoria de pre-venda (35+ features mapeadas) |
| `docs/MATRIZ_ACESSO_TDAH.md` | 13 tabelas x mecanismo x regras de erro |

---

## CSO-TDAH v1.0 — Referencia rapida

**3 Blocos (escala 0-1):**
- **Base** — SAS, PIS, BSS (comportamento + autonomia)
- **Executiva** — EXR (funcoes executivas)
- **AuDHD** (layer opcional) — SEN, TRF, RIG (sensorial, transicao, rigidez)

**Faixas de interpretacao:**
| Banda | Nivel | Interpretacao |
|---|---|---|
| 0.85–1.00 | Excelente | Evolucao consistente |
| 0.70–0.84 | Bom | Progresso adequado |
| 0.50–0.69 | Atencao | Possivel estagnacao |
| 0.00–0.49 | Critico | Pouco progresso ou falta de dados |

**Enums de observacao (Bible §7-§9, corrigidos migration 048 em 31/03):**
- PIS: `independente / minimo / moderado / total`
- BSS: `estavel / leve / desregulado`
- EXR: `excelente / adequado / prejudicado / severamente_prejudicado`
- SEN: `ausente / leve / moderado / severo` (layer AuDHD)
- TRF: `ausente / leve / moderado / severo` (layer AuDHD)
- RIG: categorico 4 estados (layer AuDHD, `active_full` apenas)

**8 tipos de eventos clinicos:**
`transition`, `sensory`, `behavioral`, `abc` (com campos A/B/C), `task_avoidance`,
`emotional_dysregulation`, `executive_function_lapse`, `regression_observed`

**46 protocolos (42 P1 + 4 P1.1)** em `tdah_protocol_library` (Bible Anexo B).
Codigos A-G por bloco.

---

## Contextos tricontextuais (Bible)

TDAH integra 3 contextos de observacao:
- **Clinico** — sessoes no consultorio
- **Domiciliar** — DRC preenchida por responsaveis + modulo casa (rotinas, fichas)
- **Escolar** — DRC preenchida por professores via portal publico

Cada observacao/sessao carrega `session_context` (`clinical` | `home` | `school`).
Dashboard mostra distribuicao tricontextual (30d).

---

## PALETA DE CORES TDAH

| Uso | Hex |
|---|---|
| Brand teal (principal) | `#0d7377` |
| Teal bg claro (tooltip) | `#E0F2F1` |
| AuDHD (diferencial) | `#7c3aed` (roxo) |
| Dashboard bg | `#f8f9fa` |
| Cards borda | `border-gray-100 shadow-sm` |

---

## REFERENCIAS

### Skills (CLAUDE.md carrega automaticamente)
- `skills/skill_axis_architecture.md` · `skill_axis_guardrails.md` ·
  `skill_axis_database.md` · `skill_axis_governance.md` · `skill_axis_ui.md`
- (Nao existe skill TDAH no `skills/` — a base de conhecimento TDAH esta em
  `docs/SKILL_TDAH.md`, carregada sob demanda pela Chat Ana)

### Documentacao tecnica
- [/docs/SKILL_TDAH.md](SKILL_TDAH.md) — 23 secoes, base Chat Ana
- [/docs/AUDIT_TDAH_2026-04-10.md](AUDIT_TDAH_2026-04-10.md) — ultima auditoria
- [/docs/MATRIZ_ACESSO_TDAH.md](MATRIZ_ACESSO_TDAH.md) — isolamento por role
- [/docs/CHECKLIST_RELEASE.md](CHECKLIST_RELEASE.md) — pre/deploy/post
- [/docs/PLAYBOOK_INCIDENTE.md](PLAYBOOK_INCIDENTE.md) — classificacao S1-S4
- [/docs/GOOGLE_CALENDAR_INTEGRATION.md](GOOGLE_CALENDAR_INTEGRATION.md)

### Historico
- [/docs/archive/NOTE_TDAH_ARCHIVE.md](archive/NOTE_TDAH_ARCHIVE.md) — changelog completo + log de 19 sessoes
- [/docs/sessoes/](sessoes/) — sessoes recentes detalhadas

### Bible
- AXIS_TDAH_BIBLE_v2.5 (baseline congelado)
- PLANO_TDAH.md (arquitetura e fases 1-15)

---

*Arquivo vivo. Atualizar a cada sessao significativa. Mover conteudo antigo
para `/docs/archive/NOTE_TDAH_ARCHIVE.md` quando o NOTE passar de ~300 linhas.*
