# AXIS TCC — NOTE ativo

**Atualizado:** 2026-04-19
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
- **Fase 13.1 (18/04/2026, commit d0dd2d3)** — duração real do áudio em
  produção. Coluna `transcripts.audio_duration_seconds` (migration 054)
  preenchida pelo worker com `segments[last].end` do faster-whisper.
  `getSessionDuration()` virou fonte canônica usada pelo finish endpoint.
  Bug corrigido: estimativa 64kbps era 5× mais rápida que 320kbps real +
  inflação de `duration_minutes` quando o psicólogo demorava a clicar
  "Finalizar". Bônus visuais: aba "Anotações" oculta (sem funcionalidade),
  chip "Base do caso incompleta" virou link discreto `underline-dotted`.
- **Fase 13.2 (19/04/2026, CLOSED as no-op)** — migração de `/api/transcribe`
  POST e `/api/transcribe/status/[jobId]` para `withTenant()`. Pre-check
  mostrou que **ambas já estavam migradas** em fase anterior (provavelmente
  12.2). Inventário do changelog 01/04 ficou desatualizado. Grep global
  `SELECT id FROM tenants WHERE clerk_user_id` retornou **zero ocorrências**
  em todo `app/api/`. Nenhum edit feito.
- **Sessão v2 (15-16/04/2026)** — reestruturação completa da página de
  sessão em 4 blocos verticais com camada narrativa IA (ClinicalReport +
  SignalsPreview + InsightsPanel + AnalyticalStructure) + GPT-4o-mini para
  geração de relatório clínico com anti-hallucination prompt (migration 049).

---

## PENDÊNCIAS (próxima sessão)

### Fase 13.1 — DEPLOYADA (18/04, commit d0dd2d3) ✅
Migration 054 aplicada, worker reiniciado, sistema testado manualmente em
produção: duração real do áudio, limite 300 min acumulado, modal único
(UpgradeModalTCC), onboarding sem CPF funcionando. Não há pendência de
deploy da 13.1. Arquivos entregues:
- `scripts/migrations/054_transcripts_audio_duration.sql` (APLICADA)
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

### P0 — validação em produção (pendências antigas — herdadas)
- [ ] **Migrations 031, 032, 049 em produção** — registradas como "pendentes
  em produção" em 19/03 e 16/04 sem confirmação posterior. Se não aplicadas:
  - `031_tcc_cpf_crp.sql` → onboarding CPF/CRP quebra
  - `032_transcription_usage.sql` → limite 300 min FREE não é enforcado
  - `049_session_reports.sql` → Sessão v2 (report + insights) não persiste
- [ ] **Checkout Hotmart TCC** — validar que links `J104687347A` estão ativos
  e o fluxo de compra completo (cadastro → pagamento → licença) funciona em
  produção (comparável ao ABA destravado 12/03)

### Próximas fases mapeadas
- [ ] **Fase 14 — schema sweep TCC** — sweep preventivo (19/04) achou 6
  rotas não-admin/webhook/cron com `pool.query` ou resolução manual fora
  de `withTenant`. Lista pra investigar:
  - `app/api/health/route.ts` — `SELECT 1 AS alive` (provavelmente OK,
    healthcheck sem dados sensíveis)
  - `app/api/patient/push/authorize/route.ts` — 3× `pool.query`, sem withTenant
  - `app/api/push/send/route.ts` — 2× `pool.query`, sem withTenant
  - `app/api/sessions/create/route.ts` — usa withTenant (3×) E pool.query (2×)
    nas linhas 40 e 52 (possivelmente Google connection setup)
  - `app/api/tdah/events/route.ts` — usa withTenant, mas linha 168 tem
    `SELECT id FROM profiles WHERE clerk_user_id` (verificar se está dentro
    do contexto withTenant)
  - `app/api/tdah/plans/route.ts` — similar (linha 149)
- [ ] **Fase 15 — testes manuais** — infra de test DB (docker-compose pg
  + migrations auto + teardown). Sessão ABA 17/04 descobriu que 17 rotas
  com schema mismatch passaram pelos 480 testes Vitest mockados. TCC tem
  mesma exposição — schema sweep estático (Fase 14) ajuda, mas não substitui
  teste integrado.
- [ ] **Fase 16 — carry-forward Clerk PT-BR + SonarCloud** — traduzir
  mensagens Clerk, ativar quality gate SonarCloud.

### Débitos técnicos (v2.x — não-bloqueantes)
- [ ] `app/api/sessions/create/route.ts` linha 54: `const event: any` no
  Google Calendar event → tipar
- [ ] `/api/stats` não retorna `pending_notes` / `pending_confirmation` mas
  a interface TS `Stats` define os campos (undefined ignorados, dead code)
- [ ] Hex hardcoded em `onboarding` e `evolution` componentes (restantes
  após migração de design tokens)

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
| Free | Gratuito | 1 | 120 min/mês | `/sign-up?produto=tcc` |
| Profissional | R$59/mês | Ilimitado | Ilimitada | pay.hotmart.com/H104687347A?off=J104687347A |

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
| ~~`app/tcc/components/TranscriptionLimitModal.tsx`~~ | REMOVIDO em Fase 12.3 — consolidado em `UpgradeModalTCC.tsx` com `reason` prop |

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
