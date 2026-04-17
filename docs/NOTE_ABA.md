# AXIS ABA — NOTE ativo

**Atualizado:** 2026-04-17 (noite — Fase 1 de correção)
**Produto:** AXIS ABA (Applied Behavior Analysis)
**Motor:** CSO-ABA v2.6.1 (congelado)
**Bible:** AXIS_ABA_BIBLE v2.6.1 + v2.7.0 Operadora Ready

> Fonte viva de decisões operacionais. Histórico completo em
> [/docs/archive/NOTE_ABA_ARCHIVE.md](archive/NOTE_ABA_ARCHIVE.md).
> Sessões recentes em [/docs/sessoes/](sessoes/).

---

## FOCO ATUAL

Beta comercial em produção desde 12/03/2026. Camada v2.7.0 Operadora Ready
(service sites, GPS check-in, atestações, bundles de evidência, coverage
profiles, claim packets, integrity scanner, payer profiles) destravada em
produção em **17/04/2026** após resolução de 5 bugs encadeados — ver sessão
[2026-04-17](sessoes/2026-04-17_ABA_fix_operadora_v270.md).

TCC e TDAH em produção paralela compartilhando a mesma infraestrutura
(auth, multi-tenant, billing Hotmart, audit logs).

---

## PENDÊNCIAS (próxima sessão)

### Bugs — Fase 2 schema sweep (`session_summaries`)

**Descoberta crítica em 17/04 noite (validação VPS produção):** o diagnóstico
das Contradições #3 do ARCHIVE TCC estava INVERTIDO em relação ao banco real.
A migration 007 define `summary_text` + `is_approved`, mas **nunca foi
aplicada** nesta tabela — o DB de produção continua com as colunas originais
`content` + `status` (string). Nossos 3 commits da tarde (P0-1 + P1-1) haviam
**regredido** produção ao trocar `content`/`status` por `summary_text`/`is_approved`.

Caminho adotado: **B (alinhar código com DB)**. Fase 1 (esta sessão noite) =
reverter somente as 2 rotas que tocamos. Fase 2 (próxima sessão) = varrer
todas as outras rotas que já estavam usando `summary_text`/`is_approved` e
trazê-las para o schema real do DB.

- [ ] **`app/api/aba/sessions/[id]/summary/route.ts`** — INSERT, UPDATE e
  SELECT usam `summary_text` + `is_approved`. Rota de criação/aprovação de
  resumo para o portal família. Precisa trocar para `content` + `status`.
- [ ] **`app/api/familia/[token]/route.ts:147`** — SELECT com `summary_text`.
  Portal família nunca vê resumos.
- [ ] **`scripts/migrations/043_fix_portal_summaries_schema.sql`** — função
  PL/pgSQL com `ss.summary_text AS content`. Investigar se foi aplicada em
  produção; se sim, função quebrada silenciosa.
- [ ] **Decisão pendente:** migração definitiva (renomear `content` →
  `summary_text`, `status` → `is_approved`) ou congelar schema atual. Hoje
  há divergência entre migration 007 (arquivo) e DB (realidade).

### Cross-chat (fora deste escopo)
- [ ] Chat **TDAH**: aplicar mesmo sweep em `/api/tdah/lgpd/delete/route.ts:244`,
  `/api/tdah/lgpd/export/route.ts:94`, `/api/tdah/sessions/[id]/summary/route.ts`.
- [ ] Chat **TCC**: atualizar ARCHIVE TCC Contradição #3 — diagnóstico original
  estava baseado em migration que nunca rodou, e não em schema real do DB.

### Melhorias UX (público 50+)
- [ ] Google Places Autocomplete no endereço de Locais (hoje pede lat/long
  manual — impraticável para psicólogo 50+)
- [ ] Campo "Local" na Nova Sessão: dropdown dos Locais cadastrados
  (hoje aceita texto livre → quebra GPS/compliance)
- [ ] Recorrência de sessões — levantar o que incomoda
- [ ] Vazio inteligente na aba Trials: botão "Criar Protocolo" quando
  aprendiz não tem protocolo cadastrado

### Ops
- [ ] Remover `ensureLgpdColumns()` de `/api/tdah/lgpd/delete/route.ts`
  (metade ABA resolvida em 17/04 tarde; colunas já existem via 003/007)
- [ ] Rotacionar `AXIS_ENCRYPTION_KEY` mensalmente (exposta no chat de 17/04)

### Infra (P1) — lição 17/04
- [ ] Adicionar infra de test DB (docker-compose pg + migrations auto + teardown)
- [ ] Cobertura mínima: rotas v2.7.0 + função `record_target_trial`
- [ ] **Objetivo:** prevenir nova leva de schema mismatch. A sessão 17/04
  descobriu que os 480 testes Vitest mockados não detectam schema mismatch
  entre código e DB real.

---

## REVERTIDOS EM 2026-04-17 (noite) — Fase 1

Validação funcional em VPS de produção mostrou que os 2 fixes LGPD da tarde
(P0-1 e P1-1) **regrediram** produção. A tabela `session_summaries` no DB real
tem colunas `content` + `status` (string), e não `summary_text` + `is_approved`
como a migration 007 sugeria. Migration 007 nunca foi aplicada nesta tabela.

### P0-1 REVERTIDO — `app/api/aba/lgpd/delete/route.ts`
- **Commit original:** troca `content` → `summary_text` no UPDATE de anonimização.
- **Revert:** restaurado `UPDATE session_summaries SET content = '[ANONIMIZADO]'`.
- **Comentário adicionado:** nota explicando que a coluna real em produção é
  `content` e que migration 007 nunca rodou nesta tabela.
- **Estado prod:** LGPD delete volta a funcionar como antes da tarde.

### P1-1 REVERTIDO — `app/api/aba/lgpd/export/route.ts`
- **Commit original:** SELECT e formatador trocados para `summary_text` +
  `is_approved` com label PT-BR (`Aprovado`/`Pendente`).
- **Revert:** SELECT volta a `content, status`; formatador volta a `s.content`
  + `s.status || ''` (string direta do DB — valores reais: `approved`, `sent`).
- **Estado prod:** aba "Resumos" do Excel volta a ser gerada.

---

## CONCLUÍDO EM 2026-04-17 (tarde + noite) — mantidos

Fixes **não relacionados** ao schema mismatch. Preservados na Fase 1.

### P1-5 — Remoção de `ensureLgpdColumns()` (dead code poluindo logs)
- **Arquivo:** `app/api/aba/lgpd/delete/route.ts`
- **Bug:** função rodava `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS` em 4
  call sites; user `axis_app` do Supabase não tem permissão de ALTER → falhas
  silenciosas via SAVEPOINT, mas poluindo logs.
- **Fix:** função + 4 call sites removidos (~23 linhas). Colunas existem desde
  migration 003 (reforço em 007). `PoolClient` e `safeExec` continuam em uso
  por outros helpers — zero imports órfãos.

### P2-3 — Warning deprecado em `next.config.ts`
- **Arquivo:** `next.config.ts:9`
- **Fix:** `experimental.middlewareClientMaxBodySize` → `experimental.proxyClientMaxBodySize`.
  Uma linha. Next.js 16 renomeou a chave.

### Validação pendente (funcional)
- [ ] Subir `npm run dev` e confirmar que warning deprecado sumiu dos logs
- [ ] Confirmar em prod (após deploy Fase 1) que LGPD delete anonimiza
  `content` e LGPD export gera aba "Resumos"

---

## ARQUITETURA

```
Next.js 16 + React 19 + TypeScript
PostgreSQL 14 (Supabase, multi-tenant, RLS, audit imutável, pgcrypto)
Redis (cache 5min)
Clerk Production Pro (auth multi-tenant, invitation flow, emails PT-BR)
Firebase Admin SDK (storage + FCM push)
Hotmart (billing webhook, 4 ofertas ABA + TDAH + TCC)
Resend (email — templates PT-BR)
OpenAI gpt-4o-mini (Chat Ana + transcrição pós-processamento)
Google Calendar API (sync bidirecional, verificação Brand aprovada 20/03)
PM2 (produção VPS)
Docker (container axis-postgres para migrations com permissão elevada)
```

---

## URLs PRODUÇÃO

| URL | O que é |
|---|---|
| `axisclinico.com` | Landing institucional (TCC + ABA + TDAH) |
| `axisclinico.com/produto/aba` | Landing ABA premium |
| `axisclinico.com/demo` | Demo pública |
| `axisclinico.com/aba` | Dashboard ABA (logado) |
| `axisclinico.com/aba/ajuda` | Central de Ajuda + Chat Ana |
| `axisclinico.com/aba/precos` | Página de preços |
| `axisclinico.com/aba/onboarding` | Wizard onboarding |
| `axisclinico.com/aba/configuracoes` | Configurações (Meu Plano, Locais, Equipe, LGPD) |
| `axisclinico.com/aba/selecionar-clinica` | Seleção multi-tenant |
| `axisclinico.com/sign-up?produto=aba` | Cadastro ABA |
| `axisclinico.com/hub` | Seletor ABA / TCC / TDAH |
| `axisclinico.com/portal/[token]` | Portal família (público, token 90d) |
| `axisclinico.com/obrigado` | Página pós-compra Hotmart |
| `axisclinico.com/admin/dashboard` | Painel Admin (porto.ar4@ / aleporto305@) |
| `axisclinico.com/termos` | Termos de Uso |
| `axisclinico.com/privacidade` | Política LGPD |

---

## MODELO COMERCIAL (Hotmart)

**Empresa:** Psiform Tecnologia
**Produtos Hotmart ABA:** `7285432`, `7291024` (ambos mapeados para `'aba'`)

| Plano | Preço | Aprendizes | Oferta | Link checkout |
|---|---|---|---|---|
| 1 Aprendiz | Gratuito | 1 | — | `/sign-up?produto=aba` |
| Clínica 100 — Founders | R$147/mês | 100 | `u2t04kz5` | pay.hotmart.com/H104663812P?off=u2t04kz5 |
| Clínica 100 | R$247/mês | 100 | `iwqieqxc` | pay.hotmart.com/H104663812P?off=iwqieqxc |
| Clínica 250 | R$497/mês | 250 | `gona25or` | pay.hotmart.com/H104663812P?off=gona25or |

> Limites de pacientes por produto lidos de `user_licenses` via
> `src/database/product-limits.ts` (desde 10/04/2026 — não mais
> `tenants.max_patients` global).

---

## IDS DEMO / DEV

| Aprendiz | ID | Nível |
|---|---|---|
| João Paulo | `be7bb2ec-a4e2-4609-894c-1577655e23df` | 2 |
| Laura Oliveira | `a2222222-2222-2222-2222-222222222222` | 2 |
| Miguel Santos | `a1111111-1111-1111-1111-111111111111` | 1 |

**Tenant ID dev:** `123e4567-e89b-12d3-a456-426614174000`

---

## REGRAS CRÍTICAS (nunca mudar)

1. `clinical_states_aba` → append-only (NUNCA update/delete)
2. `axis_audit_logs` → append-only
3. `guardian_consents` → NUNCA delete (LGPD)
4. Transições de protocolo validadas por `protocol-lifecycle.ts`
5. Terapeuta só vê aprendizes vinculados em `learner_therapists`
6. Portal família NUNCA mostra CSO, trials, notas clínicas
7. Pesos CSO fixos (25% cada) — padrão nacional, não ajustável
8. Motor CSO-ABA v2.6.1 **congelado**. Evoluções vão em nova versão
   com lock histórico (Bible §12.1)
9. RLS policies v2.7.0 lêem `current_setting('app.tenant_id', true)::uuid`
   (NUNCA `app.current_org` — bug corrigido em 17/04, ver archive)
10. `INSERT INTO axis_audit_logs` usa schema canônico `(tenant_id, user_id,
    actor, action, entity_type, entity_id, metadata, created_at)` —
    NUNCA `category` ou `actor_id` (bug corrigido em 17/04, teste de
    contrato em `src/tests/operadora-audit-logs-contract.test.ts`)

---

## ARQUIVOS-CHAVE

### Engine clínico
| Arquivo | Função |
|---|---|
| `src/engines/cso-aba.ts` | Motor CSO-ABA v2.6.1 |
| `src/engines/protocol-lifecycle.ts` | Máquina de estados (10 transições) |
| `src/engines/suggestion.ts` | Recomendações clínicas |
| `src/engines/integrity-scanner.ts` | 10 regras de integridade (v2.7.0) |
| `src/lib/session-close-hook.ts` | Hook pós-fechamento sessão |
| `src/lib/geo-classifier.ts` | Classificação GPS (v2.7.0) |
| `src/lib/crypto.ts` | Helper pgcrypto (encryptParam/decryptColumn) |

### Multi-tenant / Auth
| Arquivo | Função |
|---|---|
| `src/database/with-tenant.ts` | Resolução multi-tenant + set_config('app.tenant_id') |
| `src/database/with-role.ts` | RBAC + handleRouteError (409 seleção clínica) |
| `src/database/product-limits.ts` | Limite de pacientes por produto (desde 10/04) |
| `app/api/aba/tenant-select/route.ts` | GET listar clínicas + POST setar cookie |
| `app/components/RoleProvider.tsx` | Detecta 409 → redirect seleção |

### Billing (Hotmart)
| Arquivo | Função |
|---|---|
| `app/api/webhook/hotmart/route.ts` | Webhook — 7 eventos + auto-provisioning + email |
| `app/api/webhook/clerk/route.ts` | Webhook — `user.created` ativa pending profiles (Svix) |
| `app/aba/layout.tsx` | Gate licença → `/hub` |
| `app/components/UpgradeModal.tsx` | Modal upgrade free → pago |
| `src/email/purchase-template.ts` | Templates email pós-compra |

### v2.7.0 Operadora Ready
| Arquivo | Função |
|---|---|
| `app/api/aba/service-sites/` | Locais de atendimento (endereço pgcrypto) |
| `app/api/aba/presence-proofs/` | GPS check-in/out com classificação |
| `app/api/aba/attestations/` | Atestação terapeuta + magic link responsável |
| `app/api/aba/evidence-bundles/` | Bundle imutável pós-sessão |
| `app/api/aba/coverage-profiles/` | Cobertura por pagador |
| `app/api/aba/claim-packets/` | Pacote documental para operadora |
| `app/api/aba/provider-credentials/` | Credenciais conselho profissional |
| `app/api/aba/integrity-flags/` | Scanner + review workflow |
| `app/api/aba/payer-profiles/` | Requisitos específicos por pagador |

---

## PALETA DE CORES ABA

| Uso | Cor | Hex |
|---|---|---|
| Brand coral (principal) | coral escuro | `#B4532F` |
| Brand coral hover | coral mais escuro | `#8F3E22` |
| Brand coral light | coral claro | `#c46a50` |
| Ajuda / Chat brand | coral light | `#c46a50` |
| Ajuda brandLight bg | bege rosado | `#f5ebe7` |

**Cor canônica:** `#c46a50` (light) + `#B4532F` (dark).

---

## REFERÊNCIAS

### Skills (CLAUDE.md carrega automaticamente)
- `skills/skill_axis_aba.md` — motor clínico v2.6.1 (congelado)
- `skills/skill_axis_aba_v270.md` — camada Operadora Ready
- `skills/skill_axis_architecture.md` · `skill_axis_guardrails.md` ·
  `skill_axis_database.md` · `skill_axis_governance.md` · `skill_axis_ui.md`

### Documentação técnica
- [/docs/ABA_DB_FUNCTIONS.md](ABA_DB_FUNCTIONS.md) — funções DB v2.7.0
- [/docs/MATRIZ_ACESSO_TCC.md](MATRIZ_ACESSO_TCC.md) · [TDAH](MATRIZ_ACESSO_TDAH.md) — isolamento por role
- [/docs/CHECKLIST_RELEASE.md](CHECKLIST_RELEASE.md) — pre/deploy/post
- [/docs/PLAYBOOK_INCIDENTE.md](PLAYBOOK_INCIDENTE.md) — classificação S1-S4
- [/docs/GOOGLE_CALENDAR_INTEGRATION.md](GOOGLE_CALENDAR_INTEGRATION.md)
- [/docs/AUDIT_TDAH_2026-04-10.md](AUDIT_TDAH_2026-04-10.md) — última auditoria TDAH

### Histórico
- [/docs/archive/NOTE_ABA_ARCHIVE.md](archive/NOTE_ABA_ARCHIVE.md) — changelog completo + decisões históricas
- [/docs/sessoes/](sessoes/) — sessões recentes detalhadas

---

*Arquivo vivo. Atualizar a cada sessão significativa. Mover conteúdo antigo
para `/docs/archive/NOTE_ABA_ARCHIVE.md` quando o NOTE passar de ~200 linhas.*
