# AXIS TCC — NOTE ARCHIVE (historico consolidado)

**Ultima atualizacao:** 2026-04-17
**Fonte viva:** [/docs/NOTE_TCC.md](../NOTE_TCC.md)
**Sessoes recentes:** [/docs/sessoes/](../sessoes/)

> Este arquivo contem o changelog historico e material de referencia consolidado
> do NOTE_TCC.md que nao faz parte do texto ativo. Consulta esporadica, nao
> carrega em sessao normal.
>
> Origem dos conteudos:
> - Snapshots e sessoes 03-04/2026: copia literal do NOTE_TCC.md
> - Changelog abril: importado do CLAUDE.md (sessoes 31/03, 01/04, 10/04)

---

## CONTRADICOES REGISTRADAS (sinalizadas na migracao 17/04/2026)

Ao migrar o NOTE_TCC.md antigo para este archive, pontos de atencao foram
identificados. Preservados aqui por fidelidade historica, mas NAO reproduzidos
no NOTE ativo sem validacao:

1. **"Completude Geral: 100%" vs "COMERCIAL/BILLING 90%"** (auditoria 12/03)
   — o NOTE declarou TCC "100% pronto para beta comercial" mas na mesma
   auditoria BILLING aparecia como 90% com `Pricing page TCC nao conectada`.
   Conflito interno. TCC esta tecnicamente pronto, mas ainda nao ha confirmacao
   de checkout comercial ativo em producao (comparavel ao ABA desde 12/03).

2. **Migrations 031, 032, 049 registradas como "pendentes em producao"** nas
   sessoes de 19/03 e 15-16/04. Sem confirmacao de aplicacao. Se nao aplicadas:
   limite transcricao 120min + onboarding CPF/CRP + Sessao v2 session_reports
   nao funcionam em producao. P0 validar.

3. **Bug `session_summaries` NAO afeta TCC — pendencia da sessao ABA 17/04 estava INVERTIDA.**

   Pendencia original (registrada ontem): "5 arquivos usam `summary_text` e
   `is_approved` (schema real: `content` + `status`)".

   Verificacao da migration 007 em 17/04 (via grep no schema real + nas rotas):
   - Schema REAL de `session_summaries`: `id, tenant_id, session_id, learner_id,
     summary_text, is_approved, approved_by, approved_at, sent_at, created_at`.
   - Colunas `content` e `status` NAO EXISTEM na tabela.
   - Rotas que usam `summary_text` + `is_approved` estao CORRETAS (schema canonico):
     `aba/sessions/[id]/summary`, `tdah/sessions/[id]/summary`, `familia/[token]`.
   - Rotas QUEBRADAS usam `content` (coluna inexistente):
     - `app/api/aba/lgpd/delete/route.ts:466` — `UPDATE session_summaries SET content = '[ANONIMIZADO]'`
     - `app/api/tdah/lgpd/delete/route.ts:244` — `UPDATE session_summaries SET content = '[ANONIMIZADO]'`
     - Ambas falham silenciosamente via SAVEPOINT (bloco safeExec do fix antigo).
   - Rotas com bug silent (nao quebram, mas exportam vazio):
     - `app/api/aba/lgpd/export/route.ts:532-533` — referencia `s.content` e `s.status` no formatador de Excel apos `SELECT *`. Campos chegam undefined, viram string vazia.

   **TCC nao e afetado** — `/api/sessions/[id]/` TCC tem apenas `context`, `finish`,
   `report`, `route.ts`, `start`. Nao existe rota de summary no TCC. A tabela
   `session_summaries` nao e tocada pelo TCC.

   **Acao:** adicionar pendencia nos archives ABA e TDAH (nao este) para
   corrigir as 3 rotas LGPD quebradas. Nao faz parte do escopo TCC.

4. **Cronologia bagunçada em SESSOES DE TRABALHO** — no NOTE original,
   `2026-03-24 Hardening TCC` aparecia DEPOIS de `2026-04-15/16 Sessao v2`
   e `2026-03-12 (tarde) Security Audit` no final. Reorganizado neste archive
   em ordem cronologica reversa.

---

## SNAPSHOT — ONDE ESTAMOS TCC (verificado em 12/03/2026)

> Status das features em 12/03/2026. Preservado como historia. NAO refletir
> sem validacao cruzada com o codigo atual.

## ONDE ESTAMOS — TCC (auditado em 12/03/2026, tarde)

### Completude Geral: 100% ✅ (subiu de ~96% — 6 polish items finalizados)

### CORE ENGINE — 100% ✅
| Area | % | Status |
|---|---|---|
| Motor CSO-TCC v3.0.0 | 100% | 4 dimensoes (activation_level, emotional_load, task_adherence, cognitive_rigidity), escala 0-1, deterministico |
| Suggestion Engine v2.1 | 100% | 12 regras com prioridade 0-10, max 1 sugestao por ciclo, gate of silence |
| Append-only history | 100% | SHA256 hash em eventos, INSERT only |
| 9 tipos de eventos clinicos | 100% | AVOIDANCE/CONFRONTATION/ADJUSTMENT/RECOVERY_OBSERVED, SESSION_START/END, TASK_COMPLETED/INCOMPLETE, MOOD_CHECK |
| Testes engine | 100% | Cobertura em /src/engines/__tests__/ (parte dos 279 testes) |

### DATABASE — 100% ✅
| Area | % | Status |
|---|---|---|
| Schema TCC | 100% | 15+ tabelas (patients, sessions, events, clinical_states, suggestions, tasks, transcripts, etc.) |
| Multi-tenant | 100% | tenant_id em todas as tabelas, RLS enforced |
| Migrations | 100% | 21 migrations (019: patient profile cols, 020: patient clinical cols, 021: session google cols) |
| Audit log | 100% | axis_audit_logs append-only |

### API ENDPOINTS — 100% ✅
| Endpoint | Status | Descricao |
|---|---|---|
| /api/patients/* | ✅ | CRUD completo + clinical-record + evolution + sessions + supervision + push-link (TODOS com withTenant) |
| /api/sessions/* | ✅ | CRUD + start + finish + report + create (TODOS com withTenant desde 23/03) |
| /api/suggestions/* | ✅ | GET lista + PATCH decide (aprovar/editar/ignorar) |
| /api/events/create | ✅ | Pipeline de entrada de eventos clinicos |
| /api/stats | ✅ | Dashboard KPIs |
| /api/transcribe | ✅ | Whisper transcription + chunking >5MB + SSE streaming + failed chunks warning |
| /api/transcribe-audio | ✅ | Registros clinicos |
| /api/analyze-tcc | ✅ | Analise TCC especifica |
| /api/audit | ✅ | Log imutavel |
| /api/push/* | ✅ | FCM register/subscribe/send |
| /api/google/* | ✅ | Calendar sync (7 rotas) — ✅ ATIVO (Google Brand verificado 20/03/2026) |
| /api/portal/* | ✅ | Portal Familia token-based |
| /api/user/* | ✅ | Profile, licenses, tenant selection |
| /api/demo/* | ✅ | Demo mode com dados publicos |
| /api/webhook/* | ✅ | Hotmart (product-aware TCC+ABA) + Clerk webhooks |
| /api/cron/* | ✅ | Reminders + renew-webhook |
| /api/sessions/[id]/report | ✅ | **Sessao v2**: GET/PUT relatorio clinico (UPSERT parcial) |
| /api/sessions/[id]/report/generate | ✅ | **Sessao v2**: POST gera relatorio + insights via GPT-4o-mini (auto-analise TCC) |
| /api/sessions/[id]/report/export-pdf | ✅ | **Sessao v2**: POST retorna metadados para PDF client-side + atualiza export_count |
| /api/chat-ana | ✅ | GPT-4o-mini com historico (10 turnos) + license gate |

### UI / PAGES — 100% ✅
| Rota | Status | Observacao |
|---|---|---|
| /dashboard | ✅ | Dashboard com KPIs + graficos CSO longitudinais + error state |
| /sessoes | ✅ | Lista + filtros + paginacao + modal nova sessao |
| /sessoes/[id] | ✅ | **Sessao v2**: 4 blocos verticais (Transcricao, Relatorio Clinico IA, Insights AXIS, Estrutura Analitica) + PDF export |
| /pacientes | ✅ | Lista + Toast feedback + busca |
| /pacientes/[id] | ✅ | Perfil com interfaces TS tipadas + edit modal corrigido (full_name mismatch fix) |
| /relatorio/[id] | ✅ | Relatorio evolucao (PDF via jsPDF) — acentos corrigidos com stripAccents() |
| /configuracoes | ✅ | Configuracoes |
| /sugestoes | ✅ | Gestao de sugestoes |
| /ajuda | ✅ | Central de ajuda + Chat Ana integrado + Sidebar adicionada |
| /produto/tcc | ✅ | Landing page com schema.org |
| /demo | ✅ | Demo mode completo |
| /termos | ✅ | Termos genericos AXIS (TCC + ABA) |
| /privacidade | ✅ | Privacidade generica AXIS (TCC + ABA) |
| /obrigado | ✅ | Thank you page com branding AXIS navy |
| /hub | ✅ | Seletor de modulos (TCC + ABA) |

### COMPONENTS — 100% ✅
| Componente | Status | Arquivo |
|---|---|---|
| Sidebar.tsx | ✅ | Design tokens tcc- migrados (0 hex hardcoded) |
| EvolutionReport.tsx | ✅ | app/components/EvolutionReport.tsx |
| SessionReport.tsx | ✅ | Acentos corrigidos (Relatório, Sessão, etc.) |
| ClinicalReport.tsx | ✅ | **Sessao v2**: Relatorio clinico IA (gerar/editar/aprovar/exportar PDF) + audit logs |
| SignalsPreview.tsx | ✅ | **Sessao v2**: Chips de sinais-chave (emocoes, micro-eventos) com thresholds |
| InsightsPanel.tsx | ✅ | **Sessao v2**: Accordion 6 secoes (emocoes, topicos, distorcoes, tecnicas, micro-eventos, CSO) |
| AnalyticalStructure.tsx | ✅ | **Sessao v2**: Fatos/Pensamentos/Emocoes em accordion colapsado |
| Toast.tsx | ✅ | Componente de feedback reutilizavel |
| (demais 12 componentes) | ✅ | Onboarding, Push, Terms, Error, Skeleton, etc. |

### DESIGN TOKENS — 100% ✅
| Area | % | Status |
|---|---|---|
| Paleta TCC em tailwind.config.ts | ✅ | tcc-50..900 + tcc-accent (#FC608F) |
| Sidebar.tsx | ✅ | 100% migrado para tcc- classes |
| Dashboard, Sessoes, Sugestoes, Pacientes, Obrigado | ✅ | Migrados |
| Hub | ✅ | Partes estáticas migradas (loading, header, badge). Cards dinâmicos mantém inline (TCC vs ABA) |
| Ajuda | ✅ | 14 elementos migrados para tcc-700/tcc-300/tcc-100. Chat dinâmico mantém inline |
| Landing (page.tsx) | ✅ | 34 hex → tcc-700/tcc-600/tcc-500/tcc-300/aba-500/neutral-50 |

### COMERCIAL / BILLING — 90% (subiu de 80%)
| Area | % | Status |
|---|---|---|
| Webhook Hotmart | ✅ | Product-aware: TCC (ID 7299808), branding/subject/redirect corretos |
| User licenses | ✅ | Tabela + UPSERT on purchase |
| Free tier gate | ✅ | 1 paciente gratis, UpgradeModalTCC apos limite |
| Auto-provision FREE | ✅ | Clerk webhook cria tenant+profile+licenças no cadastro direto (sem Hotmart) |
| Gate no layout | ✅ | License check via tcc-license-gate.ts (DRY, 3 layouts simplificados) |
| Email pos-compra | ✅ | Templates product-aware (navy TCC / coral ABA) |
| /obrigado | ✅ | Thank you page com branding AXIS |
| Pricing page TCC | ❌ | Landing existe mas checkout links nao conectados |
| Tiers/precos TCC | ✅ | Profissional R$59/mes (plano unico) |
| UpgradeModalTCC | ✅ | Componente proprio com branding navy/rosa, checkout Hotmart J104687347A, integrado em /pacientes (403). Google Calendar sync (sem "em breve") |

### SEGURANCA — 100% ✅ (subiu de 98% — audit de tenant_id em 12/03)
| Area | Status | Detalhe |
|---|---|---|
| CSO engine tenant isolation | ✅ | FIX 1: AND tenant_id = $2 adicionado |
| Patient limit enforcement | ✅ | FIX 2: max_patients checado no /create |
| Chat Ana license gate | ✅ | FIX 3: Verifica licenca TCC antes de responder |
| Pipeline warnings | ✅ | FIX 9: CSO/Suggestion errors retornados ao frontend |
| Layout gates DRY | ✅ | FIX 11: tcc-license-gate.ts compartilhado |
| Dashboard error state | ✅ | FIX 13: csoError com feedback visual |
| Suggestion rules alive | ✅ | FIX 7: Regras 6/10/11 reescritas para usar campos reais |
| sessions/finish tenant_id | ✅ | UPDATE + 2 SELECTs agora filtram por tenant_id |
| sessions/delete reminders | ✅ | DELETE scheduled_reminders agora filtra por tenant_id |
| suggestions/decide tenant | ✅ | Checagem de decisão existente agora filtra por tenant_id |
| analyze-tcc cross-tenant | ✅ | CRITICO: patient_id/session_id validados contra tenant antes do INSERT. transcript UPDATE com tenant_id |
| Todas as rotas /api/patients/* | ✅ | Migradas para withTenant (RLS compliance) |
| analyze-clinical tenant isolation | ✅ | CRITICO (24/03): zero tenant_id. Adicionado pool.query tenant resolution |
| chat-ana info leakage | ✅ | FIX (24/03): mensagens genéricas (não vaza licença/tenant) |
| Testes isolamento TCC | ✅ | 15 testes em src/tests/tcc-isolation.test.ts |
| Matriz de acesso TCC | ✅ | docs/MATRIZ_ACESSO_TCC.md — roadmap multi-user incluído |

---

---

## PENDENCIAS ENCONTRADAS NA AUDITORIA DE 11/03/2026 (NOITE)

### CRITICAS — ✅ TODAS CORRIGIDAS (deployed 11/03/2026 noite)

1. ~~**clinical-record/route.ts** — Query SEM tenant_id~~ → ✅ `AND tenant_id = $2` adicionado + pool compartilhado (fix 5 junto)
2. ~~**push/subscribe/route.ts** — SEM autenticacao~~ → ✅ Reescrito com `auth()` do Clerk + validacao de tenant
3. ~~**sessions/create/route.ts** — Session count SEM tenant_id~~ → ✅ `AND tenant_id = $2` adicionado
4. ~~**suggestion.ts** — CRISIS_PROTOCOL dead code~~ → ✅ Reescrito com `activation_level < 0.2 && emotional_load > 0.85`

### ALTAS — ✅ TODAS CORRIGIDAS (deployed 11/03/2026 noite)

5. ~~**clinical-record/route.ts** — `new Pool()` separado~~ → ✅ Migrado para `import pool from '@/src/database/db'`
6. ~~**supervision/route.ts** — Audit log incompleto~~ → ✅ Campos `user_id`, `actor`, `entity_type`, `entity_id` adicionados
7. ~~**relatorio/[patientId]/page.tsx** — Acentos no PDF~~ → ✅ `stripAccents()` no helper `addText`, todas as strings normalizadas
8. ~~**pacientes/page.tsx** — `any[]`~~ → ✅ Interface `PatientListItem` + `formatPhone(string | null)`
9. ~~**sessoes/page.tsx** — `body: any`~~ → ✅ Tipado com `{ patient_id: string; start_now?: boolean; scheduled_at?: string }`

### MEDIAS — ✅ TODAS CORRIGIDAS (12/03/2026 noite)

10. ~~**Erro silencioso em varias APIs**~~ → ✅ /api/patients e /api/stats agora retornam 500 com mensagem de erro no catch

11. ~~**Console.error sem feedback**~~ → ✅ 15+ locais agora mostram alert() ou toast ao usuario (pacientes/[id], sessoes/[id], sugestoes, sessoes, pacientes)

12. **sessions/create L54** — `const event: any` no Google Calendar event. (v2.x — não bloqueante)

13. ~~**Acessibilidade — Spinners**~~ → ✅ 11 spinners com role="status" + aria-label em 6 arquivos (sugestoes, sessoes, pacientes, pacientes/[id], sessoes/[id], SessionReport)

14. ~~**Rotas de sessão TCC sem withTenant**~~ → ✅ CORRIGIDO 23/03/2026: todas as 6 rotas migradas para withTenant na auditoria técnica

15. **Dashboard pending_notes/pending_confirmation** — Interface Stats define esses campos mas /api/stats não os retorna. Não causa crash (campos undefined ignorados) mas é dead code.

### BAIXAS — ✅ TODAS CORRIGIDAS (12/03/2026 noite)

14. ~~**Landing page (page.tsx)**~~ → ✅ 34 hex hardcoded substituidos por tokens tcc-700/tcc-600/tcc-500/tcc-300/aba-500/neutral-50

15. ~~**Unused imports**~~ → ✅ Verificados: AlertCircle, TrendingUp, TrendingDown estão TODOS em uso (não são unused)

16. ~~**Hub page**~~ → ✅ Partes estáticas migradas para Tailwind (loading, header, badge). Cards dinâmicos mantêm inline style (necessário para TCC vs ABA)

---

---

# CHANGELOG TCC — SESSOES (cronologico reverso)

## SESSAO 2026-04-10 (continuacao) — Isolamento de planos por produto

> Impacto TCC: `/api/patients/create` passou a usar `getProductLimit('tcc')`
> em vez de `tenants.max_patients` global.

## Changelog — Sessão 10/04/2026 (continuação)

### Fix CRÍTICO: Isolamento de planos entre produtos

**Problema:** `tenants.max_patients` é GLOBAL. Comprar ABA founders (max_patients=100) fazia TDAH free ter 100 pacientes também. Todos os gates de criação de paciente/aprendiz liam de `tenants.max_patients` em vez de `user_licenses` por produto.

**Solução:** Criado `src/database/product-limits.ts` com `getProductLimit(client, tenantId, productType)`:
- Lê de `user_licenses WHERE product_type = $2 AND is_active = true`
- Mapeia `hotmart_plan` → limite: free=1, founders_50=50, founders=100, clinica_100=100, clinica_250=250
- TCC mantém regra histórica: qualquer plano pago = ilimitado (999999)
- Fallback: sem licença ativa = free (1 paciente)

**Arquivos alterados:**
- `src/database/product-limits.ts` — CRIADO. Helper centralizado.
- `app/api/tdah/patients/route.ts` — POST: usa `getProductLimit('tdah')` em vez de `tenants.max_patients`
- `app/api/aba/learners/route.ts` — POST: usa `getProductLimit('aba')` em vez de `tenants.max_patients`
- `app/api/patients/create/route.ts` — POST: unificado para usar `getProductLimit('tcc')` (antes fazia query manual em user_licenses)
- `app/api/aba/me/route.ts` — GET: retorna `product_limits: { tcc, aba, tdah }` com `{ plan, max_patients }` por produto
- `app/components/RoleProvider.tsx` — Adicionadas interfaces `ProductLimitInfo`, `ProductLimits`, campo `product_limits` em `ProfileData`
- `app/tdah/pacientes/page.tsx` — Frontend gate usa `profile?.product_limits?.tdah?.max_patients`
- `app/aba/configuracoes/page.tsx` — Seção "Meu Plano" usa `product_limits.aba`
- `app/tdah/configuracoes/page.tsx` — Seção "Meu Plano" usa `product_limits.tdah`, fetchPlan corrigido (antes chamava /api/aba/plan inexistente)

**Webhook Hotmart:** Continua atualizando `tenants.max_patients` (backward compat + admin view), mas gates de criação agora leem de `user_licenses`.

---

---

## SESSAO 2026-04-10 — Auditoria TDAH + migracoes withTenant

> Impacto TCC: `/api/google/callback` migrado para withTenant()
> (multi-tenant safe, antes tinha fallback em tabela tenants).

## Changelog — Sessão 10/04/2026

### Auditoria completa + Bloco pré-venda AXIS TDAH

**Relatório:** `docs/AUDIT_TDAH_2026-04-10.md` — 35+ features mapeadas, gaps de segurança identificados.

**Fixes P0/P1 aplicados:**
- Audit logs adicionados em: session close (`tdah_session_closed`), protocol transitions (`tdah_protocol_transition`)
- `canAccessTdahPatient` aplicado em `/api/tdah/scores` (antes usava EXISTS subquery frágil)
- Texto da página equipe atualizado para refletir N:N (Migration 038)

**Migração de rotas (withTenant):**
- `/api/google/callback` — tenants → profiles (multi-tenant safe)
- `/api/aba/google/callback` — removido fallback tenants
- `/api/user/accept-terms` — migrado para withTenant() completo
- `/api/user/tenant` — documentado como exceção legítima (é o resolver)

**Portal família expandido:**
- `app/api/familia/[token]/route.ts` — adicionadas queries para `tdah_routines` e `tdah_token_economy` (Bible §18)

**Documentação:**
- `scripts/migrations/MIGRATION_GAPS.md` — gaps 008-010, 041

**Endpoints sem withTenant() restantes (exceções legítimas):**
- `/api/webhook/hotmart` — webhook externo, sem auth Clerk
- `/api/webhook/clerk` — webhook externo
- `/api/cron/*` — jobs internos
- `/api/escola/[token]`, `/api/familia/[token]` — portais públicos via token
- `/api/user/tenant` — é o próprio resolver de tenant

---

---

## SESSAO 2026-04-01 (continuacao) — Pipeline transcricao v1.0.0 + upload 19MB

> **TCC-core.** Pipeline deterministico de pos-processamento de transcricao
> (migration 047). Upload grande corrigido (50MB). Erro 42501 analisado.

## Changelog — Sessão 01/04/2026 (continuação)

### Feature: Pipeline de pós-processamento de transcrição v1.0.0

**Objetivo:** Melhorar legibilidade da transcrição sem alterar sentido clínico. Sem LLM, sem API externa, determinístico, reversível, versionado.

**Arquivos criados:**
- `scripts/migrations/047_transcript_postprocess.sql` — adiciona raw_path, final_path, char_count_raw, char_count_final, postprocess_version, asr_model + backfill legado
- `src/services/transcript-postprocess.ts` — módulo com pipeline: cleanTechnicalNoise → protectClinicalTerms → applySafeDictionaryCorrections → restoreClinicalTerms. applyLightPunctuation existe mas NÃO roda na v1.0. buildPreview() centraliza regra de preview.

**Arquivos alterados:**
- `scripts/workers/transcription-worker.ts` — agora gera rawText + finalText, salva 2 arquivos em disco ({id}.raw.txt e {id}.final.txt), persiste todos os campos novos
- `src/services/transcript-storage.ts` — readTranscriptSmart() agora prioriza final_path → transcript_path → raw_path → text legado, com logs de fallback. saveTranscript() inalterado.
- `app/api/transcribe/text/[transcriptId]/route.ts` — query inclui final_path, raw_path
- `app/api/analyze-tcc/route.ts` — query inclui final_path, raw_path

**Contrato de persistência:**
- transcript_path = aponta para final_path (compatibilidade legada)
- final_path = fonte principal para UI e análise TCC
- raw_path = texto bruto do ASR (auditoria)
- text_preview = gerado a partir de final_text via buildPreview()
- char_count / char_count_final = tamanho do final_text

**Pipeline v1.0 (ordem fixa):**
1. cleanTechnicalNoise — trim, espaços duplos, quebras de linha, aspas, travessões
2. protectClinicalTerms — placeholders por ocorrência (preserva forma original)
3. applySafeDictionaryCorrections — dicionário explícito de erros reais do Whisper
4. restoreClinicalTerms — devolve termos originais
5. applyLightPunctuation — NÃO ATIVA na v1.0 (risco clínico)

---

### Fix: Upload de áudio > 10MB falhava (19MB MP3)

**Problema:** Upload de MP3 de 19.5MB retornava `Request body exceeded 10MB` e `Failed to parse body as FormData`.

**Causa raiz:** O middleware do Clerk bufferiza o body das requests. O limite default é 10MB. A config existente `serverActions.bodySizeLimit: '25mb'` só se aplica a Server Actions, não a Route Handlers do App Router.

**Correção:** `next.config.ts` — adicionado `experimental.middlewareClientMaxBodySize: '50mb'` (limite para sessões de até ~1h em MP3). Atualizado `serverActions.bodySizeLimit` para `'50mb'` para consistência.

### Erro 42501 (PostgreSQL) — Análise

**Contexto:** Erro `code: 42501` (insufficient_privilege) apareceu nos logs junto com o upload. Vem de `ExecWithCheckOptions` = violação de RLS policy.

**Análise:** O `/api/transcribe/route.ts` usa `checkTranscriptionLimit()` com resolução manual de tenant (`SELECT tenant_id FROM profiles WHERE clerk_user_id LIMIT 1`) — mesmo padrão quebrado para multi-tenant. Se pega o tenant errado, o `withTenantClient()` seta `app.tenant_id` com valor incorreto, e a RLS policy em `transcription_jobs` bloqueia o INSERT. **Obs:** o 42501 pode ser de request anterior; o log não garante que veio do mesmo request do upload de 19MB.

**Status:** A rota `/api/transcribe` ainda usa resolução manual de tenant + `withTenantClient()` customizado em vez de `withTenant()`. Migração pendente para próxima sessão.

**Endpoints com resolução manual de tenant (pendentes de migração):**
- `/api/transcribe` (POST) — usa `checkTranscriptionLimit()` com LIMIT 1
- `/api/transcribe/status/[jobId]` — verificar
- Outros em `app/api/` — auditoria pendente

---

---

## SESSAO 2026-03-31 — Fix transcricao + Analisar TCC + Accordion UI

> **TCC-core.** Transcricao nao carregava na tela de sessao (tenant mismatch).
> Botao Analisar TCC silently falhava. Accordion para textos longos.

## Changelog — Sessão 31/03/2026

### Bug fix: Transcrição completa não carregava na tela de sessão

**Problema:** Ao abrir uma sessão concluída, a UI mostrava apenas ~500 chars (text_preview) em vez do texto completo (~9300 chars).

**Causa raiz:** O endpoint `GET /api/transcribe/text/[transcriptId]` usava resolução manual de tenant (`SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1`), ignorando o cookie `axis_active_tenant`. Com multi-tenant, pegava o tenant errado → query `WHERE id = $1 AND tenant_id = $2` retornava 0 rows → **404**. O frontend falhava silenciosamente e mantinha o preview.

**Correções:**

- `app/api/transcribe/text/[transcriptId]/route.ts` — migrado para `withTenant()` com `handleRouteError()`. Adicionado try/catch no `readTranscriptSmart()` com fallback para `row.text` / `row.text_preview`.
- `app/sessoes/[id]/page.tsx` — `loadSession()`: seta preview imediato, depois busca texto completo via fetch paralelo (fire-and-forget) com `setTranscript(prev => ...)`.

### Bug fix: Botão "Analisar TCC" não funcionava

**Problema:** Ao clicar em "Analisar TCC", nada acontecia (falha silenciosa).

**Causa raiz:** Mesmo bug de tenant — `POST /api/analyze-tcc` usava resolução manual em vez de `withTenant()`. Com tenant errado, não achava a transcrição → 400 "Texto obrigatório".

**Correções:**

- `app/api/analyze-tcc/route.ts` — migrado para `withTenant()` com `handleRouteError()`. Todas as queries agora usam `client` da transação (não `pool` direto). Adicionado fallback no `readTranscriptSmart()`.
- `app/sessoes/[id]/page.tsx` — `handleTCC()`: agora envia `text: transcript.text || transcript.text_preview` no body da request (dupla segurança). Mostra mensagem de erro real em vez de alert genérico.

### UI: Accordion na seção TRANSCRIÇÃO

**Motivo:** Com texto completo (~9300 chars), a tela ficava muito longa.

**Implementação:** Accordion expansível — estado inicial colapsado (max-h-96 ~400px), gradiente de fade, botão "Ver transcrição completa" / "Recolher transcrição" com animação suave. Timestamp e "Analisar TCC" ficam fora do accordion, sempre visíveis.

- `app/sessoes/[id]/page.tsx` — novo state `transcriptExpanded`, container com `transition-all duration-300`, gradiente `bg-gradient-to-t from-slate-50`.

### Padrão identificado: endpoints sem withTenant()

**Alerta:** Qualquer endpoint de API que resolva tenant manualmente (`SELECT id FROM tenants WHERE clerk_user_id`) está quebrado para usuários multi-tenant. Todos os endpoints devem usar `withTenant()` do `src/database/with-tenant.ts`, que respeita o cookie `axis_active_tenant` e suporta múltiplos perfis.

**Endpoints já migrados:** `/api/transcribe/text/[id]`, `/api/analyze-tcc`, `/api/sessions/[id]/finish`, `/api/events/create`

**Endpoints pendentes:** `/api/transcribe` (POST), `/api/transcribe/status/[jobId]`

---

---

## SESSAO 2026-03-31 (continuacao) — Micro-eventos + CSO + SessionReport

> **TCC-core.** Micro-eventos nao salvavam (silent), pipeline CSO nao
> atualizava, sugestao nao gerada. Labels flex_trend desalinhados.

## Changelog — Sessão 31/03/2026 (continuação)

### Bug fix: Micro-eventos não salvavam (BUG 1)

**Problema:** Ao marcar micro-eventos na sessão (AVOIDANCE, CONFRONTATION, etc.), nada era salvo. Falha silenciosa.

**Causa raiz:** `/api/events/create/route.ts` usava resolução manual de tenant (`SELECT id FROM tenants WHERE clerk_user_id = $1`) + queries diretas no `pool` sem RLS. Para multi-tenant, pegava tenant errado → `patientCheck` falhava → 404 silencioso.

**Correção:** Reescrito para usar `withTenant()` com `handleRouteError()`. Todas as queries agora usam `client` da transação (não `pool` direto). Auth via `ctx.userId`.

### Bug fix: CSO não atualizava + sugestão não gerada (BUGs 2&3)

**Problema:** Ao finalizar sessão, o CSO não processava e nenhuma sugestão era gerada.

**Causa raiz dupla:**
1. Sem micro-eventos salvos (BUG 1), o finish calculava `totalFlex = 0` → `flexTrend = 'flat'` → CSO recebia payload vazio → resultado neutro → sugestão com confiança baixa → gate of silence.
2. A query de transcrição no finish usava `SELECT text, transcript_path` — faltavam `final_path, raw_path, text_preview`. Sem esses campos, `readTranscriptSmart()` não conseguia ler o texto pós-processado.

**Correções:**
- `app/api/sessions/[id]/finish/route.ts` — query de transcrição agora inclui `text_preview, final_path, raw_path` para compatibilidade com `readTranscriptSmart()`.
- BUG 1 corrigido acima resolve a causa raiz dos micro-eventos.

### UX: Labels de flex_trend desalinhados no SessionReport

**Problema:** O `SessionReport.tsx` comparava flex_trend com `'improving'`/`'declining'`, mas o finish endpoint gera `'up'`/`'down'`/`'flat'`. Valores nunca batiam → sempre mostrava "→ Estável".

**Correção:** `app/components/SessionReport.tsx` — alinhado para usar `'up'`/`'down'`/`'flat'` com labels em português: "↑ Em evolução", "↓ Em declínio", "→ Estável"

---

# SESSOES DE TRABALHO (importadas do NOTE_TCC.md original)

> Ordem original do NOTE_TCC.md — algumas entradas estao fora de ordem
> cronologica estrita (ex: 2026-03-24 aparece apos 2026-04-15/16).
> Preservado como no original para rastreabilidade.

## SESSOES DE TRABALHO

### 2026-03-11 (manha) — Inicio do foco TCC
- AxisABA finalizado (100%), em venda a partir de 12/03/2026
- Criado NOTE_TCC.md com mapeamento completo do estado atual
- Auditoria de codigo: TCC ~88% pronto
- Core clinico 100%, DB 100%, APIs 100%, UI 95%
- Gaps: billing wiring (70%), team UI (50%), onboarding branding (90%)

### 2026-03-11 — P0 Hardening Transcricao (6 fixes)
- ✅ FIX 1: Nginx client_max_body_size 150m + proxy_request_buffering off
- ✅ FIX 2: jobId unico nos chunks
- ✅ FIX 3: Extensao temporaria correta (.webm preservado)
- ✅ FIX 4: Retry por chunk com backoff (3 tentativas)
- ✅ FIX 5-6: Prompt limpo em ambos endpoints de transcricao

### 2026-03-11 — Wiring Comercial TCC (3 fixes)
- ✅ Auto-license: cria AMBAS licencas (tcc + aba) no primeiro login
- ✅ Gate de licenca TCC: layout.tsx em /dashboard, /sessoes, /pacientes
- ✅ Redirect /produto/tcc → /dashboard para users com licenca ativa

### 2026-03-11 — HARDENING CRITICO (7 fixes, deploy 1)
- ✅ FIX 1: CSO engine — tenant_id isolation na query lastCSO
- ✅ FIX 2: Patient limit enforcement no /create
- ✅ FIX 3: Chat Ana license gate
- ✅ FIX 4: Tailwind dynamic classes → estaticas (micro-eventos sessao)
- ✅ FIX 5: Termos e Privacidade genéricos AXIS
- ✅ FIX 6: Obrigado page — branding AXIS navy
- ✅ FIX 7: Suggestion engine — regras dead 6/10/11 reescritas

### 2026-03-11 — HARDENING ALTO (6 fixes, deploy 2)
- ✅ FIX 8: Acentos em SessionReport + Dashboard
- ✅ FIX 9: Pipeline warnings (CSO + Suggestion)
- ✅ FIX 10: Transcricao failedChunks tracking
- ✅ FIX 11: Layout gate DRY (tcc-license-gate.ts)
- ✅ FIX 12: Toast feedback em pacientes
- ✅ FIX 13: Dashboard csoError state

### 2026-03-11 — HARDENING MEDIO (3 fixes, deploy 3)
- ✅ FIX 14: Design tokens TCC centralizados — paleta em tailwind.config.ts + migração de 6 arquivos
- ✅ FIX 15: TypeScript interfaces em pacientes/[id] (4 any removidos)
- ✅ FIX 17: Email templates product-aware (TCC navy / ABA coral) + webhook atualizado

### 2026-03-11 (noite) — Auditoria Profunda
- 3 agentes de auditoria paralelos (APIs, Pages/Components, Engines/Lib)
- 16 pendencias encontradas (4 criticas, 5 altas, 4 medias, 3 baixas)
- NOTE_TCC.md atualizado com estado real pos-hardening

### 2026-03-11 (noite) — 9 Fixes Criticos/Altos (deploy final)
- ✅ clinical-record: tenant_id na duplicata + pool compartilhado
- ✅ push/subscribe: autenticacao Clerk adicionada
- ✅ sessions/create: tenant_id no count
- ✅ CRISIS_PROTOCOL: reescrito com campos reais (activation_level + emotional_load)
- ✅ supervision: audit log completo
- ✅ relatorio PDF: stripAccents() em todo texto
- ✅ pacientes/page.tsx: interface PatientListItem + formatPhone(string | null)
- ✅ sessoes/page.tsx: body tipado
- ✅ email templates: product-aware TCC/ABA + webhook Hotmart atualizado
- Build green, deployed em producao

### 2026-03-12 (manha) — Polimento Beta
- ✅ Configuracoes: Google Calendar → banner "Em breve" (167 linhas mortas removidas)
- ✅ Configuracoes: Exportar/Excluir desabilitados com "(em breve)"
- ✅ Landing page: logos AXIS TCC/ABA aumentados (h-10 → h-16)
- ✅ UpgradeModalTCC.tsx: componente proprio (navy/rosa, R$59/mes, checkout Hotmart)
- ✅ pacientes/page.tsx: integra UpgradeModalTCC no 403 (limite de pacientes)
- ✅ Clerk webhook v2.0: auto-provisioning FREE (tenant + profile + licenças TCC/ABA) no cadastro direto
- ✅ patients/create: corrigido max_patients (coluna não existe em user_licenses) → regra via hotmart_plan

### 2026-03-12 (manha-tarde) — RLS Fix + withTenant Migration
- ✅ Migração de TODOS os 8 arquivos de rota /api/patients/* para withTenant (RLS compliance)
- ✅ Onboarding tooltip: logo corrigido (/favicon_axis.png → /logo-axis-tcc.jpg) + cores navy

### 2026-03-12 (tarde) — Audit Sistematico Frontend↔API
- Rastreamento completo: 94 rotas API auditadas, todas as páginas TCC verificadas
- ✅ FIX: /ajuda sem Sidebar → adicionada (mesmo padrão do dashboard/pacientes/sessões)
- ✅ FIX: Patient edit enviava `name` em vez de `full_name` → API retornava 400 silencioso
- ✅ Migration 020: colunas `gender`, `diagnosis`, `medication` faltavam na tabela patients
- ✅ Migration 021: colunas Google Calendar faltavam na tabela sessions TCC (segurança)
- Resultado: sessions↔API OK, suggestions↔API OK, configurações↔API OK, dashboard↔stats OK
- Rotas de sessão TCC usam pool.query() direto (não withTenant) — funcional porque sessions não tem RLS strict

### 2026-03-12 (noite) — Polish Final: 6 itens para 100%
- ✅ Erros silenciosos: /api/patients e /api/stats agora retornam 500 no catch (não 200 com dados vazios)
- ✅ Console.error feedback: 15+ locais agora mostram alert()/toast ao usuário
- ✅ Spinners acessíveis: 11 spinners com role="status" + aria-label em 6 arquivos
- ✅ Design tokens Landing: 34 hex → tokens tcc-*/aba-*/neutral-* em page.tsx
- ✅ Design tokens Hub: 8 elementos estáticos migrados para Tailwind
- ✅ Design tokens Ajuda: 14 elementos migrados para tcc-700/tcc-300/tcc-100
- ✅ Unused imports: Verificados — todos em uso (AlertCircle, TrendingUp, TrendingDown)
- Completude: 96% → 100%, UI/Pages: 98% → 100%, Design Tokens: 85% → 100%

### 2026-03-12 (noite) — Bug Scan Final
- Rastreamento completo pré-beta: segurança, tipagem, error handling, acessibilidade, design tokens
- ✅ Tenant isolation: 76 rotas verificadas (48 withTenant, 25 pool.query+tenant_id, 3 API key/token) — zero vazamento
- ✅ TypeScript: `tsc --noEmit` limpo, zero erros
- ✅ Frontend↔API fields: todas as interfaces batem (dashboard pending_* já documentado como v2.x)
- ✅ Error handling páginas TCC core: 100% com feedback ao usuário
- ✅ Spinners TCC core: 100% com role="status" + aria-label
- ✅ Design tokens TCC core: 100% migrados (hex restantes são chart SVG inline ou componentes ABA/onboarding)
- Itens v2.x confirmados como não-bloqueantes: sessions `any` type, sessions sem withTenant, dashboard dead fields, hex em onboarding/evolution
- **VEREDICTO: 100% PRONTO PARA BETA COMERCIAL** ✅

### 2026-03-19 — Onboarding TCC + Limite Transcrição + Polish

**Onboarding TCC (novo — 3 telas):**
- [x] Tela 1: Termo LGPD adaptado para psicólogos (inclui transcrição e CSO-TCC)
- [x] Tela 2: CPF + CRP obrigatórios (validação completa, unicidade CPF)
- [x] Tela 3: 3 opções (Personalizar Clínica / Cadastrar Paciente / Ver como funciona)
- [x] API /api/tcc/onboarding (GET/POST) — completude por presença de CPF, não onboarding_completed_at
- [x] Migration 031: CPF + CRP em profiles com índice único
- [x] Removido TermsModal antigo (modal azul conflitante)
- [x] Fix: CPF não salvava — removido withTenant, usa pool direto + RETURNING
- [x] Fix: parseCRP() limpa prefixos ("CRP 99/99999" → crp_uf="99")

**Limite Transcrição 120 min/mês (FREE):**
- [x] Migration 032: tabela transcription_usage (tenant_id + month)
- [x] API /api/tcc/transcription/usage (GET/POST)
- [x] API /api/transcribe: verifica limite ANTES, incrementa DEPOIS (duração real via ffprobe)
- [x] Frontend: 402 LIMIT_REACHED → TranscriptionLimitModal
- [x] TranscriptionUsageBar no dashboard TCC (barra verde/amarelo/vermelho)
- [x] TranscriptionLimitModal com CTA Hotmart
- [x] Landing page: Free "Transcrição: 120 min/mês", Pago "Transcrição ilimitada"
- [x] Onboarding: nota "O plano gratuito inclui 1 paciente e 120 minutos de transcrição por mês"

**Arquivos criados:**
- app/components/OnboardingTCC.tsx
- app/api/tcc/onboarding/route.ts
- app/api/tcc/transcription/usage/route.ts
- app/tcc/components/TranscriptionUsageBar.tsx
- app/tcc/components/TranscriptionLimitModal.tsx
- scripts/migrations/031_tcc_cpf_crp.sql
- scripts/migrations/032_transcription_usage.sql

**Migrations pendentes em produção:** 031, 032

### 2026-03-20 — Google Calendar liberado

**Google Brand Verification aprovada pelo Google.**
- [x] UpgradeModalTCC: "Google Calendar (em breve)" → "Google Calendar sync"
- [x] Configurações TCC (/configuracoes): botões conectar/sync/desconectar já estavam funcionais — nenhuma alteração necessária
- [x] API routes /api/google/* sem nenhum feature flag ou bloqueio — código 100% operacional

### 2026-03-23 — Auditoria Técnica TCC (score 6.8 → ~8.5)

**14 correções implementadas, 393/393 testes passando, 0 erros TypeScript.**

- [x] **P0: 6 rotas de sessão migradas para withTenant** — sessions/route.ts (GET), sessions/[id] (GET, DELETE), sessions/[id]/start (POST), sessions/[id]/report (GET), sessions/[id]/finish (POST), sessions/create (POST). Pipeline CSO preservado integralmente na rota finish
- [x] **P0: Error handler silencioso** — sessions/route.ts GET retornava `{ sessions: [] }` com status 200 em caso de erro. Corrigido para propagar via handleRouteError
- [x] **P1: 6 rotas Google Calendar unificadas** — callback, disconnect, status, sync, watch, webhook. Todas removeram `new Pool(...)` e usam `import pool from '@/src/database/db'`
- [x] **P1: Push/send hardened** — Rate limit 60 req/min + guard `!process.env.INTERNAL_API_KEY`
- [x] **Fix build: handleRouteError signature** — 5 rotas chamavam com 3 args (aceita 1). Corrigido para `const { message, status } = handleRouteError(error)`
- [x] **Funil comercial TCC** — Auditoria indicava ausência de checkout, mas `/produto/tcc` já tem CTAs Hotmart. Falso positivo descartado

**Item 14 da auditoria de 11/03 (sessions sem withTenant) → RESOLVIDO nesta sessão.**

### 2026-03-23 — Monitoramento Interno (health check + system_alerts)

**Infraestrutura de monitoramento implementada — impacto direto em TCC:**

- [x] **Health check público** — `GET /api/health` verifica DB, retorna 200/503. Alerta critical se DB unreachable
- [x] **sessions/finish instrumentado** — Erro 500 no pipeline CSO gera alerta critical (SESSION_FINISH_ERROR). Rota mais crítica do TCC
- [x] **with-tenant.ts instrumentado** — JWT ausente (AUTH_MISSING) e tenant não encontrado (TENANT_NOT_FOUND) geram alertas warning. Detecta cenários de mismatch ou dados corrompidos
- [x] **AlertsPanel expandido** — Seção "Erros de Sistema" no admin: contagens por severity, lista pendentes, botão resolver
- [x] **Admin API** — `GET/PATCH /api/admin/system-alerts` com filtros

**Nota:** Webhook Hotmart (compartilhado TCC+ABA) e claim-packets (ABA) também instrumentados — ver NOTE.md

### 2026-03-24 — Testes Autorização + CI/CD + Docs Operacionais

**56 testes de autorização + CI/CD + hardening de env vars. 449/449 testes, CI verde.**

- [x] **Testes autorização TCC** — Guards (requireRole, requireAdmin, requireAdminOrSupervisor), handleRouteError classification, role authorization em sessions/events/suggestions
- [x] **CI/CD GitHub Actions** — 3 jobs: lint (tsc --noEmit), test (vitest), build (next build). Pipeline completo com secrets
- [x] **process.env hardening** — 10 arquivos com `!` non-null assertion corrigidos para `|| ''`. Inclui rotas Google Calendar e sessions/create do TCC
- [x] **Resend fix** — `app/api/demo/solicitar/route.ts` corrigido com instanciação condicional (Resend constructor crashava com undefined)
- [x] **Docs operacionais** — `docs/CHECKLIST_RELEASE.md` (deploy) + `docs/PLAYBOOK_INCIDENTE.md` (resposta a incidentes)

### 2026-04-15/16 — Sessao v2: Reestruturacao completa da pagina de sessao (6 fases)

**Motivacao:** Reclamacao de usuarios do concorrente que nao migravam — interface de sessao era muito tecnica e expunha dados brutos (pipeline, CSO numerico). Redesenhado para 4 blocos verticais com camada narrativa IA.

**Fase 1 — Backend:**
- [x] Migration 049: tabela `session_reports` (relatorio clinico + insights JSONB, RLS, append-only)
- [x] API GET/PUT `/api/sessions/[id]/report` (fetch + UPSERT parcial)
- [x] API POST `/api/sessions/[id]/report/generate` (GPT-4o-mini com anti-hallucination prompt, auto-analise TCC, SHA256 hash do prompt, UPSERT)

**Fase 2 — Frontend Relatorio Clinico:**
- [x] `ClinicalReport.tsx` — 4 estados visuais (vazio, gerando/skeleton, view, edit), headline com destaque azul, 5 campos editaveis, badge draft/final, botoes regenerar/aprovar/exportar
- [x] `SignalsPreview.tsx` — max 2 chips entre relatorio e insights, thresholds (emocao >= 0.5, micro-evento >= 2), normalizacao intensidade 0-10 → 0-1
- [x] Fix: infinite re-render loop (useRef pattern para callback prop)

**Fase 3 — Frontend Insights Panel:**
- [x] `InsightsPanel.tsx` — accordion 6 secoes (emocoes com barras coloridas, topicos #tags, distorcoes com disclaimer obrigatorio, tecnicas identificadas, micro-eventos 3a onda, CSO/flex trend)
- [x] Conexao SignalsPreview → InsightsPanel via `openInsightSection` state compartilhado

**Fase 4 — Migracao Analitico + Limpeza:**
- [x] `AnalyticalStructure.tsx` — Fatos/Pensamentos/Emocoes migrados de grid-cols-3 para accordion colapsado (sky/amber/rose)
- [x] Pipeline Result removido da UI (dados continuam no backend)

**Fase 5 — Exportacao PDF:**
- [x] Tentativa server-side com pdfkit falhou (Turbopack nao resolve .afm fonts)
- [x] Migrado para client-side com jsPDF (mesmo padrao do relatorio longitudinal)
- [x] Endpoint `export-pdf` retorna JSON com metadados (profissional, sessao, paciente) + atualiza export_count
- [x] PDF: A4, Helvetica, stripAccents, header AXIS, 5 secoes numeradas, footer disclaimer IA

**Fase 6 — Polish Final:**
- [x] Tooltips explicativos em todos os componentes v2
- [x] Loading states: skeleton no "gerando", "Gerando PDF..." disabled no export
- [x] Footer seguranca sempre visivel (removido condicional `generated_by === 'ai'`)
- [x] Audit logs: REPORT_GENERATE, REPORT_EDIT, REPORT_APPROVE, REPORT_EXPORT (4 actions adicionadas ao /api/audit)

**Arquivos criados:**
- `scripts/migrations/049_session_reports.sql`
- `app/api/sessions/[id]/report/route.ts` (reescrito)
- `app/api/sessions/[id]/report/generate/route.ts`
- `app/api/sessions/[id]/report/export-pdf/route.ts`
- `app/components/ClinicalReport.tsx`
- `app/components/SignalsPreview.tsx`
- `app/components/InsightsPanel.tsx`
- `app/components/AnalyticalStructure.tsx`

**Arquivos modificados:**
- `app/sessoes/[id]/page.tsx` (integracoes v2, remocao pipeline result e grid analitico)
- `app/api/audit/route.ts` (3 novas actions)

**Migrations pendentes em producao:** 049

### 2026-03-24 — Hardening TCC (isolamento acesso nota 9.0)

**35 rotas auditadas, 1 gap crítico corrigido, 15 testes de isolamento, matriz de acesso. 480/480 testes.**

- [x] **Auditoria 35 rotas TCC** — 34/35 já tinham isolamento correto (withTenant ou pool+tenant lookup). 1 gap crítico encontrado
- [x] **FIX CRÍTICO: /api/analyze-clinical** — Zero tenant isolation (só Clerk auth). Adicionado `pool.query` com `SELECT id FROM tenants WHERE clerk_user_id = $1`
- [x] **FIX: /api/chat-ana mensagens** — "Licença TCC não encontrada" e "Tenant não encontrado" revelavam info interna. Alterados para "Não autorizado" genérico
- [x] **15 testes isolamento** em `src/tests/tcc-isolation.test.ts`: cross-tenant (2), autenticação (3), rota crítica analyze-clinical (3), mensagens erro seguras (4), preparação futura roles (3)
- [x] **Matriz de acesso** — `docs/MATRIZ_ACESSO_TCC.md` com tabelas por recurso (pacientes, sessões, eventos, sugestões, IA, chat, transcrição, dashboard), gaps corrigidos, roadmap multi-user admin/terapeuta/supervisor (6 meses)

**Arquivos criados:**
- `src/tests/tcc-isolation.test.ts`
- `docs/MATRIZ_ACESSO_TCC.md`

**Arquivos modificados:**
- `app/api/analyze-clinical/route.ts` (tenant resolution adicionado)
- `app/api/chat-ana/route.ts` (mensagens genéricas)

---

### 2026-03-12 (tarde) — Security Audit: tenant_id isolation
- Audit de segurança em 17 rotas TCC (sessions, events, suggestions, analyze-tcc, stats, audit)
- ✅ CRITICO: analyze-tcc — patient_id/session_id do body não eram validados contra tenant (cross-tenant injection possível)
- ✅ CRITICO: analyze-tcc — UPDATE transcripts sem tenant_id
- ✅ ALTO: sessions/finish — UPDATE sessions + SELECT transcripts + SELECT tcc_analyses sem tenant_id
- ✅ ALTO: sessions/[id] DELETE — scheduled_reminders sem tenant_id
- ✅ ALTO: suggestions/decide — checagem de decisão existente sem tenant_id
- Total: 7 queries corrigidas em 4 arquivos
- Segurança: 98% → 100%

---

---

## DECISOES TOMADAS
| Data | Decisao | Motivo |
|---|---|---|
| 11/03/2026 | NOTE_TCC.md separado do NOTE.md (ABA) | Rastreabilidade por produto |
| 11/03/2026 | TCC v1.x sem limite de pacientes | Solo profissional, dados restritos ao psicologo |
| 11/03/2026 | Auto-license cria TCC + ABA | Cada layout verifica seu product_type independente |
| 11/03/2026 | Inline styles em hub/ajuda/landing = debt v2 | Precisam refactor para usar tokens, nao e bloqueante |
| 11/03/2026 | ~~Regra CRISIS_PROTOCOL dead code~~ → CORRIGIDA | Reescrita com activation_level < 0.2 + emotional_load > 0.85 |
| 12/03/2026 | Limite pacientes via hotmart_plan (não max_patients) | v1.x: FREE (NULL) = 1, PRO (NOT NULL) = ilimitado. v2.x tera seats/roles |
| 12/03/2026 | Todas as rotas /api/patients/* migradas para withTenant | RLS exige set_config('app.tenant_id') — pool.query() direto falhava em INSERT/UPDATE |
| ~~12/03/2026~~ | ~~Rotas /api/sessions/* mantidas com pool.query()~~ | ~~Migrar para withTenant no v2.x~~ → **RESOLVIDO 23/03/2026**: todas as 6 rotas migradas para withTenant na auditoria técnica |
| 12/03/2026 | Migrations 020/021 criadas para colunas faltantes | gender/diagnosis/medication em patients + google cols em sessions. IF NOT EXISTS para idempotencia |

---

---

*Arquivo-archive do AXIS TCC. Atualizar apenas ao promover NOTE ativo.*
