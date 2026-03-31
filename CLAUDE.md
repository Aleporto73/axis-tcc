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

## Changelog — Sessão 01/04/2026

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

**Endpoints já migrados:** `/api/transcribe/text/[id]`, `/api/analyze-tcc`
**Verificar:** outros endpoints em `app/api/` que ainda usem resolução manual.
