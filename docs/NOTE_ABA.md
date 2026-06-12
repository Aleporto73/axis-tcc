# AXIS ABA — NOTE ativo

**Atualizado:** 2026-04-20 (Hub audit 5→9/10 — husky + ESLint boundaries + MIGRATIONS_MAP)
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

### Bugs de produto (descobertos na Fase 2)

- [x] **CORRIGIDO (Onda 8 Bloco 0 — 03/05/2026):** ~~Bug GCal sync ABA — não propaga `declared_site_id` / `service_mode`~~
  (descoberto 17/04 noite). ~~Em `app/api/aba/google/sync/route.ts:172-190` o INSERT de nova sessão via sync não passa `declared_site_id` nem `service_mode`.~~

  **Validação empírica:** já corrigido — INSERT atual (linhas 185-208) inclui `declared_site_id`, `service_mode` e `location`. Comentário "Bug 1 fix" presente na linha 178-180 do código. `matchSiteByLocation` usado para derivar site automaticamente.

- [x] **CORRIGIDO (Onda 8 Bloco 0 — 03/05/2026):** ~~Bug GCal sync ABA — match por `guardians.email` falha silencioso~~
  (descoberto 17/04 noite). ~~`app/api/aba/google/sync/route.ts:97-129` tenta match do `attendee.email` contra `guardians.email` → se não encontrar, evento é ignorado silenciosamente.~~

  **Validação empírica:** já corrigido — array `unmatched` retornado no JSON da resposta da API (linhas 264-268) com `summary`, `attendee_emails`, `scheduled_at` por evento não matched. Audit log inclui `unmatched_count` (linhas 244-258). Comentário "Bug 2 fix" linhas 211-213.

- [ ] **Portal família ABA não mostra resumos** — rota `/api/familia/[token]`
  filtra `source_module = 'tdah'` (linha 150). Mesmo com schema corrigido,
  resumos ABA são excluídos. Decisão de produto: mostrar resumos de todos os
  módulos no portal TDAH? Criar rota `/api/familia/aba/[token]`? Ou o portal
  ABA deveria usar `/api/portal/[token]` (que já funciona via função
  `portal_get_summaries`)? Investigar.
- [ ] **Decisão pendente sobre schema session_summaries:** migration 007
  declara `summary_text` + `is_approved` mas DB real tem `content` + `status`.
  Manter o DB como está (caminho adotado na Fase 2) ou rodar migração
  definitiva algum dia? Hoje há divergência documental entre 007 e realidade.

### Cross-chat (outras sessões)
- [ ] Chat **TDAH**: aplicar mesmo schema sweep em
  `/api/tdah/lgpd/delete/route.ts:244`, `/api/tdah/lgpd/export/route.ts:94`,
  `/api/tdah/sessions/[id]/summary/route.ts` (INSERT+UPDATE+SELECT).
- [ ] Chat **TCC**: atualizar ARCHIVE TCC Contradição #3 — diagnóstico
  original estava baseado em migration que nunca rodou em prod (007), não
  no schema real. Marcar como "contradição resolvida com inversão".

### Melhorias UX (público 50+)
- [ ] **Google Places no cadastro de Locais** — substituir input manual de
  lat/lng por campo CEP com autopreenchimento via ViaCEP + geocoding via
  Nominatim (OpenStreetMap). Zero custo. Público 50+ entende CEP.
  Alternativa premium: Google Places Autocomplete (requer billing Google
  Cloud + `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` com restrição HTTP referrer).
- [ ] **Recorrência de sessões** — feature futura. Decisão pendente entre:
  - **B' (nativo):** dropdown "Recorrência" no modal Nova Sessão
    (Semanal/Quinzenal/Mensal) + campo "Repetir por N ocorrências" (1-12) +
    coluna `recurrence_group_id UUID` em `sessions_aba` para cancelar série.
    Esforço ~4-6h + migration.
  - **Opção 1 (outbound API GCal — PREFERIDA):** quando usuário escolhe
    recorrência, AXIS chama `calendar.events.insert` com
    `RRULE:FREQ=WEEKLY|BIWEEKLY|MONTHLY`. Google expande, sync inbound
    importa instâncias. Zero lógica de recorrência no AXIS. Esforço ~3h
    **APÓS** correção dos 2 bugs de sync abaixo. Requer GCal conectado +
    scope `calendar.events.write`.
  - Referência UI: dropdown padrão Google Calendar/Outlook/Calendly
    (Não se repete / Semanal / Quinzenal / Mensal).

### Ops
- [ ] **Rotacionar `AXIS_ENCRYPTION_KEY`** — **prazo: maio/2026**
  (todos os sistemas juntos: TCC + ABA + TDAH). Chave exposta em chat
  durante 17/04. Plano Big Bang (~15-30 min janela manutenção):
  1. Gerar nova chave (`openssl rand -base64 48`)
  2. Ativar `MAINTENANCE_MODE` (middleware — criado em 12/06/2026, gate em
     `middleware.ts` + página `/manutencao`; toggle via `.env` + restart PM2)
  3. Backup DB completo
  4. Script SQL `scripts/jobs/rotate_encryption_key.sql` (criado em
     12/06/2026 — dry-run + pré-flight + transação única + verificação;
     chaves via `app.encryption_key_old` / `app.encryption_key_new`):
     `UPDATE col = pgp_sym_encrypt(pgp_sym_decrypt(col, old_key), new_key)`
     em 7 colunas × 4 tabelas (nomes reais do baseline, sufixo `_encrypted`):
     - `service_sites.address_encrypted`
     - `session_presence_proofs.latitude_encrypted`, `.longitude_encrypted`,
       `.ip_address_encrypted`
     - `session_attestations.ip_address_encrypted`, `.canvas_data_encrypted`
     - `session_attachments.extracted_geo_encrypted`
  5. Trocar `.env` nos 3 sistemas
  6. Restart PM2
  7. Smoke test (ler Local cadastrado, criar sessão nova)
  8. Desativar `MAINTENANCE_MODE`
  - ~~**Blocker 1:** middleware `MAINTENANCE_MODE` não existe — criar antes.~~
    ✅ **RESOLVIDO (12/06/2026, sessão F3):** gate criado em `middleware.ts`
    (APIs → 503, páginas → rewrite `/manutencao`; allowlist `/api/health` +
    `/manutencao`) + `app/manutencao/page.tsx` + entrada em `env.ts`/`.env.example`.
  - ~~**Blocker 2:** `scripts/jobs/purge_geo.sql` usa nomes de coluna
    errados (`latitude`/`longitude`/`ip_address`) vs schema real
    (`latitude_encrypted` etc.). Reconciliar antes da rotação.~~
    ✅ **RESOLVIDO** (commits `84f1b81` + `a77225e`, Item 11H BUGs 3/5):
    purge_geo já usa os nomes `_encrypted` corretos — verificado coluna a
    coluna contra `000_shared_baseline.sql` em 12/06/2026.
  - **NOVO (12/06/2026):** rotação ampliada para 4 segredos —
    `AXIS_ENCRYPTION_KEY`, `DATABASE_PASSWORD`, `INTERNAL_API_KEY` e
    `CRON_SECRET` vazaram em chat em 12/06. `CRON_SECRET` rotaciona a quente
    via `CRON_SECRET_OLD` (padrão já existente, `src/lib/cron-auth.ts`);
    `INTERNAL_API_KEY` é env swap + restart; `DATABASE_PASSWORD` (Supabase)
    entra na mesma janela Big-Bang.
  - **Alternativa descartada:** dual-key versioning (coluna `key_version`
    + re-encrypt gradual). Complexidade não justifica dado volume beta
    (<500 rows estimados).
- [ ] **Teste funcional LGPD export via UI** — gerar Excel em tenant com
  summaries e confirmar aba "Resumos" preenchida com `content` + `status`
  (`approved`/`sent`). Fase 1 aplicada cega — precisa validar em prod.

### Infra (P1) — lição 17/04
- [ ] Adicionar infra de test DB (docker-compose pg + migrations auto + teardown)
- [ ] Cobertura mínima: rotas v2.7.0 + função `record_target_trial`
- [ ] **Objetivo:** prevenir nova leva de schema mismatch. A sessão 17/04
  descobriu que os 480 testes Vitest mockados não detectam schema mismatch
  entre código e DB real.

---

## APLICADO EM 2026-05-07 — HUB-05.B FECHADO (refator withTenantClient)

Refator de 6 rotas Google Calendar para usar helper canônico `withTenantClient`,
fechando débito arquitetural HUB-05.B em produção. **Deploy validado em prod
07/05/2026** (commit `5c8ea52`, smoke sem regressões).

### Arquivos ABA tocados

- **`app/api/aba/google/callback/route.ts`** (Etapa 2, commit `ac462d5`) — ABA OAuth
  callback, espelho do template TCC. 3 `pool.query` direto wrapped em
  `withTenantClient(tenant_id, async (client) => { ... })`. Lookup pré-tenant
  (linha 86 SELECT em `profiles`) preservado por design. Variável `tenant_id`
  (snake_case) usada direto, sem rename.
- **`app/api/aba/google/webhook/route.ts`** — split em **2 commits sequenciais**:
  - **Commit 1 — Bug fix isolado (`e3b0edb`):** path 410 do Google API agora
    persiste DELETE da `calendar_sync_state` via COMMIT (era revertido pelo
    ROLLBACK posterior). **Cleanup self-healing restaurado** — sync após token
    expirado começa do zero sem syncToken inválido. Comentário linha 57 do
    código (`// Se syncToken expirou (410), limpar`) confirma intenção original.
  - **Commit 2 — Refator CANONICAL (`1e703a2`):** Caminho 2 manual em
    `syncCalendarForProfile` (BEGIN/set_config/COMMIT/ROLLBACK explícitos
    linhas 24-25, 71/agora-COMMIT, 222, 225, 228-230) substituído pelo helper
    canônico. Lookup pré-tenant via `webhook_channel_id` (linha 248) preservado.
    `console.log "Sync concluído"` movido para dentro do callback. Outer try/catch
    preservado para Sentry + log estruturado. Auth google-webhook-signature e
    fire-and-forget linha 271 intocados.

### Bug fix 410 — Cleanup self-healing restaurado

Antes do fix (commit `e3b0edb`), quando Google retornava 410 (sync_token
expirado), o código fazia DELETE intencional da `calendar_sync_state` para
forçar próxima sync a recriar do zero. Mas o ROLLBACK explícito posterior
revertia o DELETE, deixando o token expirado persistido no DB → sync ficava em
loop infinito de 410.

Validação prod antes do fix: 1 token velho em 1 tenant teste (sem urgência
operacional). Hotfix aplicado preventivamente no commit isolado para auditoria
limpa. Refator CANONICAL aplicado em commit separado (`1e703a2`) preserva
comportamento idêntico — bug já corrigido + estrutura modernizada.

### Aprendizados-chave

- Helper `withTenantClient` exportado de `src/database/with-tenant.ts:238`
  (Etapa 0 do HUB-05.B, commit `ce789c4`).
- Cópias locais em `src/services/scheduler.ts:57-74` e
  `scripts/workers/transcription-worker.ts:69-86` permanecem (consolidação =
  HUB-12 Backlog Onda 12).
- Tabela `calendar_connections` ainda **sem RLS forced** após HUB-05.B.
  Migration 070 (= HUB-13) aplicará RLS — pré-requisito: bypass GUC
  `app.is_cron` para Query 0 cross-tenant do cron `renew-webhook`.

Bloco 2 docs (commit `321e593`) atualizou `PONTOS_ATENCAO_ARQUITETURAL.md`
com HUB-05.A+B FECHADO, Backlog Onda 12 (HUB-12/13/14) e Padrões observados.

---

## APLICADO EM 2026-04-20 — Auditoria ABA + Hub 5→9/10

Sessão detalhada: [2026-04-20_hub_audit](sessoes/2026-04-20_hub_audit.md).

**Commits (7):**
- `bb171ea` fix migration 006 (`plan_tier` + `max_patients` antes dos UPDATEs)
- `a97d986` migration 056 (tabelas órfãs `calendar_connections` + `push_tokens` — SHARED)
- `161d855` fix 039 (`undefined_table` guard) + remove dead code `notification_preferences` + MIGRATIONS_MAP.md
- `54312d8` convenção migrations 057+ + pre-commit validator (husky) — SHARED
- `dd94285` fix CI (`package-lock.json` sync com husky) — SHARED
- `af157c9` ESLint boundaries (cross-module guard ABA↔TCC↔TDAH) — SHARED
- (inline) typecheck script + 5 arquivos TCC restaurados

**Proteções ativas (novas):**
- **Husky pre-commit** valida nome (`NNN_<modulo>_<descricao>.sql`) + tag `-- COMMIT: ...` em migrations 057+
- **ESLint boundaries** impede imports cruzados entre ABA/TCC/TDAH (`eslint.config.mjs`)
- **MIGRATIONS_MAP.md** documenta ownership das 52 migrations existentes
- Backup tag: `backup-pre-eslint` (em `dd94285`)

**Scores:**
- ABA módulo: **7/10** (features UX pendentes: ViaCEP, RRULE)
- Hub saúde: 5/10 → **9/10**

**Pendências remanescentes (não entraram):**
- ViaCEP + Nominatim (endereço Locais) — Caminho B
- Recorrência sessões (GCal RRULE) — discovery com Bianca
- C-4 landing vs onboarding (ofertas batem, onboarding não gate por `plan_tier`)
- `tsconfig moduleResolution` — erros pré-existentes, CI passa via `next build`

---

## APLICADO EM 2026-04-17 (noite) — Remoção `ensureLgpdColumns()` TDAH

Complemento ao fix análogo aplicado no ABA hoje cedo (P1-5). Função rodava
`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS` em 4 call sites (GET, POST,
DELETE, PATCH); user `axis_app` do Supabase não tem permissão de ALTER →
falhas silenciosas via SAVEPOINT, só poluindo logs.

### Fix — `app/api/tdah/lgpd/delete/route.ts`
- Função `ensureLgpdColumns()` (linhas 40-49) removida.
- 4 call sites removidos (GET:59, POST:105, DELETE:160, PATCH:289).
- Comentário adicionado no topo do arquivo explicando que as 3 colunas
  (`cancellation_scheduled_at`, `cancelled_at`, `anonymized_at`) existem
  em `tenants` desde migration 003 (reforço em 007).
- `PoolClient` import + `safeExec` preservados (ainda usados por 4+
  call sites legítimos de UPDATE/INSERT com SAVEPOINT).

### Impacto
- Zero mudança de comportamento funcional.
- Logs em prod param de poluir com erros 42501 (insufficient_privilege)
  nos 4 call sites de ALTER.

---

## APLICADO EM 2026-04-17 (noite) — Empty state aba Trials

Aba "Trials" dentro da página de sessão (`/aba/sessoes/[id]`) ficava
visualmente vazia quando o aprendiz não tinha nenhum protocolo cadastrado.
Havia só um banner amber fora das tabs (fácil de perder) e um texto
"Nenhum trial registrado" no fim da aba. Usuário 50+ não entendia o
próximo passo.

### Fix — `app/aba/sessoes/[id]/page.tsx`
- **Remoção do banner amber topo** (fora das tabs, redundante).
- **Empty state rico dentro da aba Trials** quando `isActive &&
  protocols.length === 0`: ícone clipboard-check, título "Nenhum
  protocolo cadastrado", explicação curta ("Protocolos definem os alvos
  de aprendizagem (DTT). Crie um para começar a registrar trials nesta
  sessão."), CTA primário "+ Criar Protocolo" que abre o modal
  `showProtocolModal` já existente.
- **"Nenhum trial registrado"** agora condicional a `protocols.length > 0`
  (evita duplicata com o empty state).
- **Sessão `isCompleted` sem protocolo:** renderiza nada extra (não faz
  sentido oferecer criar protocolo em sessão encerrada).

### Impacto
- Zero mudança de schema/backend. Só UX.
- Infraestrutura (`showProtocolModal`, `handleCreateProtocol`) já existia
  — só faltava wireup do empty state.
- Reaproveita o mesmo modal de criação de protocolo usado pelo botão
  "+ Protocolo" no topo do formulário (quando já tem protocolos).

---

## APLICADO EM 2026-04-17 (noite) — Local dropdown Nova Sessão ABA

Campo "Local" no modal de Nova Sessão ABA aceitava texto livre. Para tenants
operadora isso quebrava compliance GPS: `declared_site_id` ficava `NULL`,
integrity scanner flagava `MISSING_GEO`, e o haversine check em
`geo-classifier.ts`/`presence-proofs` não tinha referência para validar.

### Fix — `app/aba/sessoes/page.tsx`
- **UI condicional via `operadora.serviceSites`:**
  - Tenants operadora (founders/clinica_100/clinica_250): dropdown
    obrigatório populado de `/api/aba/service-sites` (filtrado por
    `is_active`).
  - Tenants free: input texto livre mantido (retrocompat).
- **Empty state:** quando operadora não tem nenhum site cadastrado, bloco
  amber com CTA "Cadastre um Local →" apontando para
  `/aba/configuracoes#locais`.
- **Labels PT-BR** para `site_type` (Clínica, Domicílio, Escola, Telehealth,
  Comunidade, Outro) via `siteTypeLabels`.

### Fix — `app/api/aba/sessions/route.ts`
- POST aceita **dois caminhos** no body:
  - `service_site_id` (novo, operadora): valida que site pertence ao tenant
    e está ativo, deriva `service_mode` de `site_type`
    (clinic/community/other → presencial; home → domiciliar; school →
    escolar; telehealth → telehealth), e popula
    `declared_site_id` + `service_mode` + `location` (derivada de
    `site_name`).
  - `location` (legado, free): string livre, `declared_site_id` e
    `service_mode` ficam `NULL` (comportamento anterior).
- Helper `deriveServiceMode(siteType)` isolado no topo do arquivo.
- Novo handler de erro 404 para "Local de atendimento não encontrado
  ou inativo".

### Fix — `app/aba/configuracoes/page.tsx`
- `<section id="locais">` + `scroll-mt-24` na section do
  `ServiceSitesManager` para servir de âncora ao CTA do empty state.

### Impacto
- Sessões novas em tenants operadora passam automaticamente a integrar
  `declared_site_id` → scanner de integridade deixa de flagar `MISSING_GEO`
  (para sessões novas; sessões antigas permanecem flagadas até backfill
  manual, se desejado).
- Free tenants inalterados — path legado preservado.
- Sem migration (colunas `declared_site_id`, `service_mode`, `location` já
  existem em `sessions_aba`).

---

## APLICADO EM 2026-04-17 (noite) — Fix CI GitHub

CI estava vermelho desde commits da tarde. Local e VPS passavam limpo,
CI reportava 10 erros ("Invalid character" + warnings Node deprecated).

### Fix — `app/sessoes/[id]/components/ClinicalContext.tsx`
- **Bug:** arquivo terminava com 8 bytes NUL (`\0`) após o `}\n` de
  fechamento do componente (7463 bytes totais; 8 NULs nos bytes finais).
  Provável corrupção de editor. TSC no CI detectou e reportou 8x
  "Invalid character" (um por NUL).
- **Por que local/VPS passavam:** provavelmente cache incremental (`.next`
  + buildinfo) mascarava. CI faz fresh checkout, sem cache.
- **Fix:** truncate de 7463 → 7455 bytes. Arquivo termina limpo com
  `  </div>\n  )\n}\n`. Zero NUL no arquivo inteiro.

### Fix — `.github/workflows/ci.yml`
- **Bug:** Node 20 deprecated (GitHub Actions warning em 2026). 3 jobs
  usavam `node-version: '20'`.
- **Fix:** todos atualizados para `'22'` (LTS atual).

---

## APLICADO EM 2026-04-17 (noite) — Fase 2 schema sweep

Alinhamento de código com schema real do DB (coluna `content` + `status`
string). Escopo ABA: 3 arquivos de código + 1 migration neutralizada.

### Fix — `app/api/aba/sessions/[id]/summary/route.ts`
- **Bug:** rota inteira (POST/PUT/GET) usava `summary_text` + `is_approved`,
  colunas que não existem no DB prod. Toda escrita silenciosamente falhava
  (SAVEPOINT engolia); feature "Resumo aos Pais" ABA nunca funcionou em prod.
- **Fix:** reescrito para `content` + `status` (VARCHAR, valores
  `'approved' | 'sent'`). Fluxo POST colapsado — cria direto como
  `status='approved'` (salta rascunho, alinhado com realidade prod).
  PUT approve virou idempotente (no-op se já approved/sent).

### Fix — `app/api/familia/[token]/route.ts:147`
- **Bug:** SELECT pedia `summary_text` (inexistente) → portal família TDAH
  nunca mostrava resumos (silent fail).
- **Fix:** SELECT agora usa `content`.
- **Bug lateral descoberto:** filtro `source_module = 'tdah'` exclui ABA
  (ver PENDÊNCIAS → Bugs de produto).

### Fix — `app/familia/[token]/page.tsx:310`
- **Bug:** render `{s.summary_text}` retornava `undefined`.
- **Fix:** `{s.content}`.

### Neutralização — `scripts/migrations/legacy/043_fix_portal_summaries_schema.sql`
- **Bug:** migration (criada 24/03) pretendia sobrescrever função
  `portal_get_summaries` (da migration 014) com versão usando
  `ss.summary_text AS content` — **quebraria** prod se aplicada.
- **Validação prod:** função ativa é a versão 014 (`ss.content` +
  `ss.status = 'approved'`) — correta.
- **Fix:** arquivo 043 substituído por no-op documentado (header explica a
  história, preserva numeração, impede dano futuro).

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
