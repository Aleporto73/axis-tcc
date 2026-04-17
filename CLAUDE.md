# AXIS Clinical System

This repository contains the AXIS clinical platform.

AXIS includes two major systems:

- **AXIS TCC** - Cognitive Behavioral Therapy clinical management
- **AXIS ABA** - Applied Behavior Analysis clinical management

The system is clinical infrastructure and must follow strict architectural rules.

---

## Load Skills

Claude must load and follow the instructions from the following files:

- skills/skill_axis_architecture.md
- skills/skill_axis_guardrails.md
- skills/skill_axis_prompting.md
- skills/skill_axis_database.md
- skills/skill_axis_governance.md
- skills/skill_axis_ui.md
- skills/skill_axis_tcc.md
- skills/skill_axis_aba.md
- skills/skill_axis_aba_v270.md

These files define the architectural and ethical rules of the AXIS platform.
Note: skill_axis_aba.md = motor clínico v2.6.1 (congelado). skill_axis_aba_v270.md = camada operadora ready.

---

## System Philosophy

AXIS is not a generic SaaS. It is clinical infrastructure designed for:

- Traceability
- Deterministic clinical engines
- Human decision authority
- Immutable clinical history
- Multi-tenant isolation

---

## AXIS Pipeline

All clinical workflows follow this structure:

Session -> Structured events/trials -> Engine processing (CSO) -> Clinical state (append-only) -> Optional suggestion -> Human decision

This pipeline must never be bypassed.

---

## Multi-Tenant System

Every query must respect tenant_id isolation. Cross-tenant access is forbidden.

---

## Engine Versions

- CSO-TCC: v3.0.0
- CSO-ABA: v2.6.1

Historical results are tied to engine version. Never retroactively recompute.

---

## When Uncertain

If a modification may impact clinical engines, database integrity, or historical records, Claude must stop and ask for clarification.

---

**Reference:** AXIS_ABA_BIBLE v2.7.0 Operadora Ready, AXIS_ABA_BIBLE v2.6.1 (motor clínico), Documento Mestre TCC v2.1

---

## Fontes vivas por produto

Cada produto mantem um NOTE ativo enxuto (foco atual, pendencias, arquitetura,
URLs, regras criticas, arquivos-chave). Historico completo em `/docs/archive/`
e sessoes detalhadas em `/docs/sessoes/`.

| Produto | NOTE ativo | Archive | Sessoes |
|---|---|---|---|
| **ABA** | [/docs/NOTE_ABA.md](docs/NOTE_ABA.md) | [/docs/archive/NOTE_ABA_ARCHIVE.md](docs/archive/NOTE_ABA_ARCHIVE.md) | [/docs/sessoes/](docs/sessoes/) |
| **TCC** | `NOTE_TCC.md` (raiz — **pendente migracao** p/ /docs/) | — | — |
| **TDAH** | `NOTE_TDAH.md` (raiz — **pendente migracao** p/ /docs/) | — | — |

**Quando trabalhar em um produto especifico:** carregar o NOTE daquele produto
como primeira fonte de contexto (depois das skills). O NOTE ativo e sempre a
fonte-de-verdade corrente; o archive so deve ser consultado sob demanda.

---

## Changelogs historicos por sessao

> Os blocos abaixo sao changelogs consolidados no CLAUDE.md antes da
> reorganizacao de 17/04/2026. Para ABA, ja foram importados para
> `/docs/archive/NOTE_ABA_ARCHIVE.md` e podem ser removidos daqui
> quando TCC e TDAH tambem forem migrados. Mantidos por seguranca
> ate a migracao completa.

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