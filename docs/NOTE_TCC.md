# AXIS TCC — NOTE ativo

**Atualizado:** 2026-04-20 (Hub audit 5→9/10 — ESLint boundaries + husky + migration 056)
**Produto:** AXIS TCC (Terapia Cognitivo-Comportamental)
**Motor:** CSO-TCC v3.0.0
**Bible:** Documento Mestre TCC v2.1

> Fonte viva de decisões operacionais. Histórico completo em
> [/docs/archive/NOTE_TCC_ARCHIVE.md](archive/NOTE_TCC_ARCHIVE.md).
> Sessões recentes em [/docs/sessoes/](sessoes/).

---

## FOCO ATUAL

**Preparação pré-beta comercial.** Produto tecnicamente completo desde 12/03/2026
(auditoria declarou 100% pronto para beta), mas checkout comercial ainda não
aparece confirmado como ativo — ver contradição #1 no archive. Infraestrutura
compartilhada com ABA e TDAH: auth, multi-tenant, billing Hotmart, LGPD, audit.

Últimas entregas:
- **Agenda TCC — Entrega 1B (28/09/2026, item 1.4, sem migration, só TCC; ainda não publicada)** —
  fim da sessão duplicada na criação. "Agendar" agora: transação 1 curta (trava do
  paciente + número + INSERT **sem vínculo** + lembretes + COMMIT) → evento no Google
  **fora de transação** (timeout 8 s; renovação de token 4 s em transação própria) →
  transação 2 curta de vínculo. Evento com id `tcc` + uuid da sessão sem hífens
  (base32hex; "axis" é proibido, tem `x`) e marca `extendedProperties.private.axis_session_id`.
  Timeout/409/5xx/rede → `events.get` (4 s): existe (mesmo cancelado) → vincula; senão fica
  sem vínculo. Vínculo = UPDATE só de `google_event_id, google_calendar_id, external_etag,
  external_updated_at, google_meet_link, calendar_source` com `google_event_id IS NULL`, em
  qualquer status (nunca muda status/horário). Webhook/sync (`applyGoogleEvent`): evento com
  marca ou id `^tcc[0-9a-f]{32}$` → vincula a sessão do mesmo tenant e segue a regra da 1A;
  sessão marcada inexistente → pula, **nunca insere**. Resumo ganhou `linked`. Resposta do
  create: `google_synced` + `google_connected`; tela `/sessoes` mostra Toast "Sessão criada,
  mas não foi para o Google Agenda." Sem retry automático; `ensureSessionGoogleEvent` (get
  antes, senão insert) fica pronto para o futuro botão "Enviar ao Google".
  Arquivos: `src/services/google-event-create.ts` (novo), `src/services/google-event-apply.ts`,
  `app/api/sessions/create/route.ts`, `app/sessoes/page.tsx`, `src/tests/tcc-google-agenda.test.ts`.
  Base: Entrega 1A (commit `0859714`).
- **HUB-05.B FECHADO (07/05/2026, Onda 11 — 8 commits sequenciais)** — refator
  `withTenantClient` aplicado em 6 rotas Google Calendar, deploy validado em prod.
  Helper canônico promovido para `src/database/with-tenant.ts:238` (Etapa 0,
  commit `ce789c4`). Arquivos TCC tocados: (1) `app/api/google/callback/route.ts`
  (TCC OAuth, template canônico, commit `a0e3856`); (2) `app/api/sessions/create/route.ts`
  (helper `createGoogleCalendarEvent` recebe `client` transacional, caso híbrido,
  commit `a0d50b7`); (3) `app/api/google/webhook/route.ts` (TCC webhook, mais pesado:
  9 queries em 1 transação, commit `c7de1fc`). Atomicidade real ganha — falha em
  qualquer query agora dispara ROLLBACK total. Deploy 07/05/2026 (commit `5c8ea52`),
  smoke prod sem regressões. Bloco 2 docs (commit `321e593`) atualizou
  `PONTOS_ATENCAO_ARQUITETURAL.md` com HUB-05.A+B FECHADO, Backlog Onda 12
  (HUB-12/13/14) e Padrões observados.
- **Hub audit (20/04/2026) — SHARED/infra, commit chain ABA-led** — 6 commits no
  hub que beneficiam TCC sem tocar em código do produto. Novas proteções: (1)
  **ESLint boundaries** (`eslint.config.mjs`, commit `af157c9`) impede que código
  TCC importe de `app/aba/**` ou `app/tdah/**`, e protege `src/engines/cso.ts`
  de imports a partir de ABA/TDAH; (2) **Husky pre-commit validator** (commit
  `54312d8`) exige nome `NNN_<modulo>_<descricao>.sql` + tag `-- COMMIT: ...`
  em migrations 057+; (3) **MIGRATIONS_MAP.md** documenta ownership das 52
  migrations; (4) migration 056 (`calendar_connections` + `push_tokens`, commit
  `a97d986`) corrige tabelas órfãs — `calendar_connections` é usada pelo TCC em
  `/api/sessions/create` (débito técnico de RLS documentado na Fase 14).
  CI ganhou passo `ESLint (boundaries)`. Backup tag: `backup-pre-eslint`.
  Sessão detalhada: [sessoes/2026-04-20_hub_audit](sessoes/2026-04-20_hub_audit.md).
- **Fase 14 concluída (19/04/2026, 4 commits + incidente + fix)** — schema sweep TCC:
  6 rotas suspeitas analisadas. Resultado: 3 falsos positivos documentados,
  1 refatorada de verdade (`tdah/plans` usando `ctx.profileId`),
  1 era falso positivo (já estava refatorado — `tdah/events`),
  1 investigada e declarada aceitável (`sessions/create` — `calendar_connections`
  sem RLS, registrado como débito técnico pra quando ativar RLS global).
  **INCIDENTE crítico**: commit `0dbd9cb` sobrescreveu `tdah/plans/route.ts` com
  conteúdo de `tdah/events/route.ts` (corrupção durante edição paralela no Cowork).
  Produção ficou com a rota `/api/tdah/plans` quebrada até detecção ~21:00.
  Recuperado via commit `fbfe283` (restaurado de `05156f4`) e commit `75b57f6`
  aplicou o refactor real. Lição: verificar cabeçalho único de cada arquivo após
  edições paralelas, não confiar só em SHA256+typecheck.
- **Fase 13.2 (19/04/2026, CLOSED as no-op)** — migração de `/api/transcribe`
  POST e `/api/transcribe/status/[jobId]` para `withTenant()`. Pre-check
  mostrou que **ambas já estavam migradas** em fase anterior (provavelmente
  12.2). Inventário do changelog 01/04 ficou desatualizado. Grep global
  `SELECT id FROM tenants WHERE clerk_user_id` retornou **zero ocorrências**
  em todo `app/api/`. Nenhum edit feito.
- **Fase 13.1 (18/04/2026, commit d0dd2d3)** — duração real do áudio em
  produção. Coluna `transcripts.audio_duration_seconds` (migration 054)
  preenchida pelo worker com `segments[last].end` do faster-whisper.
  `getSessionDuration()` virou fonte canônica usada pelo finish endpoint.
  Bug corrigido: estimativa 64kbps era 5× mais rápida que 320kbps real +
  inflação de `duration_minutes` quando o psicólogo demorava a clicar
  "Finalizar". Bônus visuais: aba "Anotações" oculta (sem funcionalidade),
  chip "Base do caso incompleta" virou link discreto `underline-dotted`.
- **Sessão v2 (15-16/04/2026)** — reestruturação completa da página de
  sessão em 4 blocos verticais com camada narrativa IA (ClinicalReport +
  SignalsPreview + InsightsPanel + AnalyticalStructure) + GPT-4o-mini para
  geração de relatório clínico com anti-hallucination prompt (migration 049).

---

## PENDÊNCIAS (próxima sessão)

### Fase 14 — CONCLUÍDA (19/04, 4 commits + incidente + fix) ✅
Schema sweep TCC concluído com os seguintes resultados (corrigido pós-incidente):

**Refatorados (ctx.profileId):**
- `app/api/tdah/plans/route.ts` ✅ — refactor real aplicado no commit `75b57f6`
  (após restore via `fbfe283` do commit pré-Fase-14 `05156f4`)

**Falso positivo descoberto no pré-check:**
- `app/api/tdah/events/route.ts` ⚠️ — já estava refatorado antes da Fase 14.
  O inventário inicial listou como pendente mas o código já usava `ctx.profileId`.
  Nada foi alterado neste arquivo.

**Falsos positivos documentados (exceções legítimas, não precisam mudar):**
- `app/api/health/route.ts` — `SELECT 1 AS alive` (liveness probe público)
- `app/api/patient/push/authorize/route.ts` — auth via `patient_token` público
  (portal família). Tenant deriva do patient record. Sem Clerk context.
- `app/api/push/send/route.ts` — API interna autenticada via
  `INTERNAL_API_KEY` header. Sem Clerk context.

**Investigado e aceito (sem bug atual, débito futuro):**
- `app/api/sessions/create/route.ts` — usa `pool.query` (L40, L52) em
  `calendar_connections`. Investigação 19/04: tabela **não tem RLS policy**
  (`\d calendar_connections` confirma — só FK pra tenants, sem RLS).
  Query filtra explicitamente `WHERE tenant_id = $1` e funciona correto.
  Fragilidade latente: se RLS for ativada futuramente em
  `calendar_connections`, integração Google Calendar quebraria
  silenciosamente. Correção pré-planejada para esse momento: passar o
  `client` da transação `withTenant` para a função
  `createGoogleCalendarEvent` em vez de usar `pool` direto.

### Débitos técnicos — ativação RLS global (futuro)
Quando ativar RLS em todas as tabelas com `tenant_id`, estas rotas precisam
refactor antes ou junto (senão quebram silenciosamente):
- [ ] `app/api/sessions/create/route.ts` — `createGoogleCalendarEvent`
  precisa receber `client` transacional (ver detalhe acima)
- [ ] `app/api/patient/push/authorize/route.ts` — escreve em
  `patient_push_tokens` + `audit_logs` sem `app.tenant_id` setado
- [ ] `app/api/push/send/route.ts` — consulta `push_tokens` por `user_id`
  sem filtro de tenant (potencial leak cross-tenant se `user_id` colidir
  entre tenants)
- [ ] **`events` — RLS desligado (descoberto 20/04 durante fix CSO)** —
  `relrowsecurity = f` em produção. `events/create` funciona porque usa
  `client.query` com filtro `tenant_id` explícito, mas sem defense-in-depth.
  Ativar policy quando for feito sweep global de RLS.

### Fase 13.1 — DEPLOYADA (18/04, commit d0dd2d3) ✅
Migration 054 aplicada, worker reiniciado, sistema testado manualmente em
produção: duração real do áudio, limite 300 min acumulado, modal único
(UpgradeModalTCC), onboarding sem CPF funcionando. Não há pendência de
deploy da 13.1. Arquivos entregues:
- `scripts/migrations/legacy/054_transcripts_audio_duration.sql` (APLICADA)
- `src/services/session-duration.ts` (helper canônico novo)
- Modificados: `scripts/workers/transcription-worker.ts` (usa
  `segments[last].end` + `realMinutes` em vez de estimativa 64kbps),
  `app/api/sessions/[id]/finish/route.ts` (split UPDATE + helper),
  `app/sessoes/[id]/page.tsx` (aba Anotações oculta),
  `app/sessoes/[id]/components/ClinicalContext.tsx` (chip discreto)

### Fase 13.2 — CLOSED no-op (19/04) ✅
Premissa do inventário de 01/04 estava desatualizada. Pre-check confirmou:
- `grep -rn "SELECT id FROM tenants WHERE clerk_user_id" app/api/` → vazio
- `app/api/transcribe/route.ts` (POST) já usa `withTenant()` (linha 25)
- `app/api/transcribe/status/[jobId]/route.ts` já usa `withTenant()` (linha 16)
Nenhum edit foi feito nessas rotas. Migração efetiva provavelmente aconteceu
na Fase 12.2 ou 12.3. Não reabrir.

### Migrations em produção — CONFIRMADAS (19/04) ✅
Validação via `docker exec axis-postgres psql`:
- `031_tcc_cpf_crp.sql` ✅ — colunas `cpf`, `crp`, `crp_uf` existem em
  `profiles` + índice único `idx_profiles_cpf_unique`
- `032_transcription_usage.sql` ✅ — tabela `transcription_usage` existe
  com estrutura correta (id, tenant_id, month, minutes_used, updated_at)
  + constraint unique (tenant_id, month)
- `049_session_reports.sql` ✅ — tabela `session_reports` existe com
  estrutura completa + RLS policy `tenant_isolation` ativa

### P0 — pendências comerciais
- [ ] **Checkout Hotmart TCC** — validar que links `J104687347A` estão ativos
  e o fluxo de compra completo (cadastro → pagamento → licença) funciona em
  produção (comparável ao ABA destravado 12/03)

### Próximas fases mapeadas
- [ ] **Fase 15 — testes manuais** — infra de test DB (docker-compose pg
  + migrations auto + teardown). Sessão ABA 17/04 descobriu que 17 rotas
  com schema mismatch passaram pelos 480 testes Vitest mockados. TCC tem
  mesma exposição — schema sweep estático (Fase 14) ajuda, mas não substitui
  teste integrado.
- [ ] **Fase 16 — carry-forward Clerk PT-BR + SonarCloud** — traduzir
  mensagens Clerk, ativar quality gate SonarCloud.

### Débitos técnicos (v2.x — não-bloqueantes)
- [ ] `/api/stats` não retorna `pending_notes` / `pending_confirmation` mas
  a interface TS `Stats` define os campos (undefined ignorados, dead code)
- [ ] Hex hardcoded em `onboarding` e `evolution` componentes (restantes
  após migração de design tokens)

### Backlog polimento (pós-monetização, não-bloqueante)
- [ ] Fonte menor nos cards Fatos/Pensamentos/Emoções
- [ ] "0 sessões hoje" cor neutra (não vermelho)
- [x] ~~Adicionar "despolfiado→desconfiado" no SAFE_CORRECTIONS~~ ✅ feito 19/04 (commit `836b9fa`)
- [ ] Refinar prompt extração emoções (não pegar hesitação como "sei lá")
- [ ] Investigar CSO não calculando (checar cron/trigger do finish)
- [ ] Dropar coluna `profiles.cpf` (opcional, não usada desde Fase 12.1)

### Incidente 19/04 — Corrupção em tdah/plans/route.ts (RESOLVIDO)
**Contexto:** durante a Fase 14 o CC executou edits paralelos em `tdah/events`
e `tdah/plans`. O commit `0dbd9cb` gravou o conteúdo de `events` por cima
de `plans`. Arquivo ficou com estrutura correta (SHA256 válido, UTF-8 OK,
zero null bytes, typecheck passou) mas o **conteúdo semântico estava errado**
— plans virou events literalmente.

**Como foi detectado:**
Ao tentar continuar o refactor na sessão seguinte do CC, os greps começaram
a divergir. Teste no PowerShell local confirmou corrupção real no disco
(hashes plans==events=`7060 bytes` idênticos).

**Recuperação (3 passos):**
1. `git checkout 05156f4 -- app/api/tdah/plans/route.ts` (restaura versão pré-Fase 14)
2. Commit `fbfe283` com o restore
3. Commit `75b57f6` aplica o refactor `ctx.profileId` da Fase 14 corretamente

**Estado final em produção:**
- `tdah/plans/route.ts` — 194 linhas, refactor aplicado, funcionando
- `tdah/events/route.ts` — inalterado (já estava OK antes)

**Lição aprendida (regra nova):**
Quando CC edita múltiplos arquivos irmãos (mesmo diretório, padrão parecido),
verificar **cabeçalho único de cada arquivo** após salvar. SHA256+typecheck
não detecta esse tipo de corrupção — o arquivo fica "válido" mas errado.
Comando de validação: `grep -l "API Plano TDAH" app/api/tdah/plans/route.ts`
(deve retornar match, se não → arquivo está com conteúdo de outro módulo).

### Bug Hub (conta admin porto.ar4@gmail.com) — RESOLVIDO operacional (19/04, 20:30)
**Problema:** conta admin tinha 2 profiles ativos em tenants diferentes:
- Admin em `Ana Tunussi Porto` (principal)
- Terapeuta em `Geo Legends` (testes)

`withTenant()` corretamente disparava `TenantSelectionRequired` (409),
mas a tela `/hub` não tratava o erro — parecia usuário novo sem licença.

**Fix operacional via SQL:**
```sql
UPDATE profiles SET is_active = false
WHERE id = '269782c2-611a-4166-9f67-749fe3389a25';
```

Profile de terapeuta do Geo Legends desativado. Login volta a funcionar.
Arquitetura multi-profile continua funcional (mesma pessoa pode ser admin
em TCC + terapeuta em ABA em outra clínica).

**Não há código a mudar** — o fluxo está correto em arquitetura, foi
dado sujo de testes. Se for necessário suportar múltiplos profiles
ativos por usuário no futuro, a tela `/hub` precisará consumir
`TenantSelectionRequired.tenants[]` e mostrar seletor.

### Aviso técnico — Cowork virtiofs (19/04)
Cowork apresentou bug persistente de cache FUSE servindo versão stale de
`docs/NOTE_TCC.md` (14982 bytes no mount vs 15610 bytes no Windows/git).
Touch de `LastWriteTime`, remoção de `.git/index.lock`, fechamento e
reabertura da sessão não resolveram. Edições desta sessão foram feitas
fora do Cowork (PowerShell + VS Code + git direto). Próxima sessão:
verificar se o cache expirou; se persistir, escalar com Anthropic.

---

## ARQUITETURA

```
Next.js 16 + React 19 + TypeScript
PostgreSQL 14 (Supabase, multi-tenant, RLS, audit imutável)
Redis (cache)
Clerk Production Pro (auth multi-tenant, invitation flow)
Firebase Admin SDK (storage + FCM push)
Hotmart (billing webhook, product-aware: TCC 7299808 + ABA)
Resend (email — templates PT-BR product-aware: navy TCC / coral ABA)
OpenAI Whisper (transcrição) + gpt-4o-mini (Chat Ana, geração relatório Sessão v2, análise TCC)
Google Calendar API (sync bidirecional, aprovado Google Brand 20/03)
PM2 (produção VPS)
```

---

## URLs PRODUÇÃO

| URL | O que é |
|---|---|
| `axisclinico.com` | Landing institucional (TCC + ABA + TDAH) |
| `axisclinico.com/produto/tcc` | Landing TCC premium |
| `axisclinico.com/demo` | Demo pública |
| `axisclinico.com/dashboard` | Dashboard TCC (logado) — KPIs + gráficos CSO + transcription usage bar |
| `axisclinico.com/sessoes` | Lista de sessões + modal nova sessão |
| `axisclinico.com/sessoes/[id]` | **Sessão v2** — 4 blocos verticais + export PDF |
| `axisclinico.com/pacientes` | Lista + busca + Toast |
| `axisclinico.com/pacientes/[id]` | Perfil + edit modal |
| `axisclinico.com/sugestoes` | Gestão de sugestões (aprovar/editar/ignorar) |
| `axisclinico.com/relatorio/[id]` | Relatório longitudinal (PDF jsPDF) |
| `axisclinico.com/configuracoes` | Configurações TCC |
| `axisclinico.com/ajuda` | Central de Ajuda + Chat Ana |
| `axisclinico.com/sign-up?produto=tcc` | Cadastro TCC |
| `axisclinico.com/hub` | Seletor TCC / ABA / TDAH |
| `axisclinico.com/portal/[token]` | Portal família (público, token) |
| `axisclinico.com/obrigado` | Página pós-compra Hotmart |
| `axisclinico.com/termos` | Termos de Uso (genéricos AXIS) |
| `axisclinico.com/privacidade` | Política LGPD (genérica AXIS) |

---

## MODELO COMERCIAL (Hotmart)

**Empresa:** Psiform Tecnologia
**Produto Hotmart TCC:** `7299808`
**Oferta ativa:** `J104687347A`

| Plano | Preço | Pacientes | Transcrição | Link checkout |
|---|---|---|---|---|
| Free | Gratuito | 1 | 300 min lifetime | `/sign-up?produto=tcc` |
| Profissional | R$59/mês | Ilimitado | Ilimitada | pay.hotmart.com/J104687347A?off=sn8ebdqc |

> Limites lidos de `user_licenses` via `src/database/product-limits.ts`
> (desde 10/04/2026 — não mais `tenants.max_patients` global).
> Regra histórica TCC: qualquer `hotmart_plan` NOT NULL = ilimitado.

---

## IDS DEMO / DEV

> **TBD — definir IDs demo TCC depois.**
>
> Pacientes de teste usados durante desenvolvimento não estão documentados no
> NOTE histórico. Próxima sessão de onboarding deve:
> - Identificar pacientes demo/seed em dev
> - Registrar tenant_id de desenvolvimento
> - Adicionar aqui para referência rápida

---

## REGRAS CRÍTICAS (nunca mudar)

1. **IA NÃO decide, NÃO executa, pode ficar em silêncio** (gate of silence)
2. **Clinical history append-only** — `clinical_states`, `events`,
   `axis_audit_logs` → NUNCA UPDATE/DELETE
3. **Engines determinísticos** — CSO-TCC v3.0.0 congelado. Evoluções em
   nova versão com lock histórico
4. **Max 1 sugestão por ciclo** (Suggestion Engine v2.1)
5. **Toda ação auditável** (`axis_audit_logs` com `user_id`, `actor`,
   `entity_type`, `entity_id`, `metadata`, `created_at` — schema canônico)
6. **Multi-tenant isolation** — `tenant_id` obrigatório em toda query.
   Rotas usam `withTenant()` que seta `set_config('app.tenant_id', ..., true)`
7. **Engine version locked em cada registro** — `engine_version` coluna em
   `clinical_states`. Nunca recomputar histórico
8. **Separação de 3 camadas:** dados (DB), texto automatizado (IA), notas
   profissionais (manual). Nunca confundir
9. **Na dúvida, PARAR e perguntar** (guardrail clínico)
10. **Segurança > Conveniência** (princípio maior)

---

## ARQUIVOS-CHAVE

### Engine clínico
| Arquivo | Função |
|---|---|
| `src/engines/cso.ts` | Motor CSO-TCC v3.0.0 (4 dimensões 0-1) |
| `src/engines/suggestion.ts` | Suggestion Engine v2.1 (12 regras) |
| `src/engines/__tests__/` | Testes engine (parte dos 480) |

### Sessão v2 (15-16/04/2026)
| Arquivo | Função |
|---|---|
| `app/api/sessions/[id]/report/route.ts` | GET/PUT — UPSERT parcial do relatório |
| `app/api/sessions/[id]/report/generate/route.ts` | POST — GPT-4o-mini com anti-hallucination + auto-análise TCC + SHA256 hash prompt |
| `app/api/sessions/[id]/report/export-pdf/route.ts` | POST — metadados PDF client-side |
| `app/components/ClinicalReport.tsx` | 4 estados visuais, 5 campos editáveis, draft/final |
| `app/components/SignalsPreview.tsx` | Chips de sinais-chave, thresholds |
| `app/components/InsightsPanel.tsx` | Accordion 6 seções (emoções/tópicos/distorções/técnicas/micro-eventos/CSO) |
| `app/components/AnalyticalStructure.tsx` | Fatos/Pensamentos/Emoções em accordion |

### Transcrição
| Arquivo | Função |
|---|---|
| `app/api/transcribe/route.ts` | Whisper + chunking >5MB + SSE + failedChunks |
| `app/api/transcribe/text/[transcriptId]/route.ts` | Fetch transcrição completa |
| `src/services/transcript-postprocess.ts` | Pipeline v1.0.0 (clean + protect + dictionary + restore) |
| `src/services/transcript-storage.ts` | readTranscriptSmart (final_path → raw_path → fallback) |
| `src/services/session-duration.ts` | **Fase 13.1** — getSessionDuration() canônica: lê `transcripts.audio_duration_seconds` → fallback para `sessions.started_at/ended_at` |
| `scripts/workers/transcription-worker.ts` | Worker async, gera raw + final |
| `app/api/tcc/transcription/usage/route.ts` | Limite 300 min lifetime FREE (Fase 12.2) |
| `app/tcc/components/TranscriptionUsageBar.tsx` | Barra dashboard |
| ~~`app/tcc/components/TranscriptionLimitModal.tsx`~~ | **Verificar status** — consolidado em `UpgradeModalTCC.tsx` com `reason` prop (Fase 12.3). Arquivo pode existir localmente mas não é mais referenciado. |

### Análise IA
| Arquivo | Função |
|---|---|
| `app/api/analyze-tcc/route.ts` | Análise TCC específica (pacientes/sessões) |
| `app/api/analyze-clinical/route.ts` | Análise clínica geral (tenant resolution 24/03) |
| `app/api/chat-ana/route.ts` | Chat Ana gpt-4o-mini (10 turnos + license gate) |

### Multi-tenant / Auth (compartilhado)
| Arquivo | Função |
|---|---|
| `src/database/with-tenant.ts` | Resolução multi-tenant + set_config |
| `src/database/with-role.ts` | RBAC + handleRouteError |
| `src/database/product-limits.ts` | Limite de pacientes por produto (10/04) |
| `src/database/tcc-license-gate.ts` | Gate de licença (DRY, layouts TCC) |

### TDAH (Fase 14 — refatorado 19/04, com incidente)
| Arquivo | Função |
|---|---|
| `app/api/tdah/events/route.ts` | Já usava `ctx.profileId` antes da Fase 14 (falso positivo no inventário, inalterado) |
| `app/api/tdah/plans/route.ts` | **Fase 14 (commits `fbfe283` + `75b57f6`)** — usa `ctx.profileId`. Passou por incidente de corrupção, recuperado e refatorado corretamente. Ver seção "Incidente 19/04" acima. |

### Billing (Hotmart)
| Arquivo | Função |
|---|---|
| `app/api/webhook/hotmart/route.ts` | Product-aware: TCC navy / ABA coral |
| `app/api/webhook/clerk/route.ts` | Auto-provisioning FREE (tenant + profile + licenças) |
| `app/components/UpgradeModalTCC.tsx` | Modal 403 limite — checkout Hotmart R$59/mês |

### Onboarding & Termos
| Arquivo | Função |
|---|---|
| `app/components/OnboardingTCC.tsx` | 3 telas (LGPD + CPF/CRP + escolha) |
| `app/api/tcc/onboarding/route.ts` | GET/POST — completude por tenants.onboarding_completed_at (Fase 12.1) |

---

## CSO-TCC v3.0.0 — Referência rápida

**4 Dimensões (escala 0-1):**
- `activation_level` — nível de ativação comportamental
- `emotional_load` — carga emocional
- `task_adherence` — adesão a tarefas
- `cognitive_rigidity` — rigidez cognitiva (flex_trend como proxy)

**Faixas de interpretação:**
| Faixa | Nível | Interpretação |
|---|---|---|
| 0.85–1.00 | Excelente | Evolução consistente |
| 0.70–0.84 | Bom | Progresso adequado |
| 0.50–0.69 | Atenção | Possível estagnação |
| 0.00–0.49 | Crítico | Pouco progresso ou falta de dados |

**9 tipos de eventos clínicos:**
`AVOIDANCE_OBSERVED`, `CONFRONTATION_OBSERVED`, `ADJUSTMENT_OBSERVED`,
`RECOVERY_OBSERVED`, `SESSION_START`, `SESSION_END`, `TASK_COMPLETED`,
`TASK_INCOMPLETE`, `MOOD_CHECK`

**Suggestion Engine v2.1 — 12 regras (prioridade 0-10):**
- `CRISIS_PROTOCOL` (10) — `activation_level < 0.2` E `emotional_load > 0.85`
- `PAUSE_EXPOSURE` (9 / 8)
- `CHECK_ADHERENCE` (8)
- `COGNITIVE_INTERVENTION` (7)
- `SIMPLIFY_TASK` (6) · `EMOTIONAL_REGULATION` (6)
- `CELEBRATE_PROGRESS` (5 / 4) · `ADJUST_PACE` (5 / 4)
- `BRIDGE_TO_LAST` (4)

---

## TERMINOLOGIA TCC

| Conceito | Termo TCC | Termo ABA (referência) |
|---|---|---|
| Sujeito | Paciente | Aprendiz |
| Profissional | Psicólogo | Terapeuta / Supervisor BCBA |
| Encontro | Sessão | Sessão |
| Motor | CSO-TCC v3.0.0 | CSO-ABA v2.6.1 |
| Produto | AXIS TCC | AXIS ABA |

---

## PALETA DE CORES TCC

| Uso | Token Tailwind | Hex |
|---|---|---|
| Navy (principal) | `tcc-700` | `#1a1f4e` |
| Navy hover | `tcc-600` | `#2a2f5e` |
| Navy light | `tcc-50` | `#f5f5f8` |
| Accent (rosa) | `tcc-accent` | `#FC608F` |
| Muted | `tcc-300` | `#9a9ab8` |
| Dark | `tcc-900` | `#0e1030` |

---

## REFERÊNCIAS

### Skills (CLAUDE.md carrega automaticamente)
- `skills/skill_axis_tcc.md` — motor clínico TCC
- `skills/skill_axis_architecture.md` · `skill_axis_guardrails.md` ·
  `skill_axis_database.md` · `skill_axis_governance.md` · `skill_axis_ui.md`

### Documentação técnica
- [/docs/REFERENCE_TCC.md](REFERENCE_TCC.md) — referência técnica TCC
- [/docs/MATRIZ_ACESSO_TCC.md](MATRIZ_ACESSO_TCC.md) — isolamento por role + roadmap multi-user
- [/docs/CHECKLIST_RELEASE.md](CHECKLIST_RELEASE.md) — pre/deploy/post
- [/docs/PLAYBOOK_INCIDENTE.md](PLAYBOOK_INCIDENTE.md) — classificação S1-S4
- [/docs/GOOGLE_CALENDAR_INTEGRATION.md](GOOGLE_CALENDAR_INTEGRATION.md)

### Histórico
- [/docs/archive/NOTE_TCC_ARCHIVE.md](archive/NOTE_TCC_ARCHIVE.md) — changelog completo + snapshots + decisões históricas
- [/docs/sessoes/](sessoes/) — sessões recentes detalhadas

---

*Arquivo vivo. Atualizar a cada sessão significativa. Mover conteúdo antigo
para `/docs/archive/NOTE_TCC_ARCHIVE.md` quando o NOTE passar de ~350 linhas.*
