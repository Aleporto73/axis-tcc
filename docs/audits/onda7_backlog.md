# AXIS — Onda 7 Backlog

**Criado:** 25/04/2026 (pós-Onda 5.3 staging)
**Status:** Aberto. Itens a executar quando Onda 5.3 fechar em prod.

---

## Como usar

Backlog de TODOs arquiteturais que NÃO foram tratados nas Ondas 1-5.3 mas merecem atenção. Cada item tem prioridade (P0=urgente, P3=quando der). Itens novos da sessão (Onda 5.3) têm detalhamento; itens antigos (Onda 4) são referência rápida — detalhe completo na transcript do handoff Onda 4.

---

## Itens novos desta sessão (Onda 5.3 — 25/04/2026)

| ID | Título | Prioridade | Estimativa | Notas |
|---|---|---|---|---|
| 12 | Bug `team/route.ts` UUID=TEXT — JOIN nunca casa | P2 | 30min | Em `app/api/tdah/team/route.ts:38-49`, JOIN `pc.created_by = p.clerk_user_id` compara UUID (`tdah_patients.created_by`, FK `profiles.id`) com TEXT (`profiles.clerk_user_id`, ex `user_xxxxx`). Resultado: contadores `patient_count` e `session_count` sempre zerados na UI admin TDAH "Equipe". Fix: trocar `p.clerk_user_id` por `p.id`. Bug silencioso, não crítico, mas confunde admin. Detectado no diag principal Onda 5.3 §2.5. |
| 13 | VPS staging não-reconciliado com origin/main | P1 | 1h | `/root/axis-tcc-staging` está em HEAD `6454407` (20/04, pré-Onda 1) com 13 modificações M não-commitadas correspondentes aos patches das Ondas 1-4 aplicados manualmente. Esses patches JÁ ESTÃO commitados em origin/main (commits `d9b8f22`, `e129a67`, `b6012b3`, `9dd7bbf`). Após Onda 5.3 fechar em prod, sequência correta: (a) validar via `git diff <arquivo>` que cada M == conteúdo correspondente em origin/main; (b) se OK, `git checkout .` para descartar M (conteúdo idêntico virá via pull); (c) `git pull origin main`; (d) validar SHA dos arquivos == prod. NÃO usar `git stash` ou cherry-pick — stash daria conflito quando pull reaplicar os mesmos patches; cherry-pick é vazio porque os commits já existem. ATENÇÃO: se algum M divergir de origin/main no passo (a), parar e investigar antes de descartar. |
| 14 | Inventário e reconciliação de migrations órfãs (054, 056) | P1 | 1h | Mirror local tem `scripts/migrations/054_transcripts_audio_duration.sql` (criada 18/04, Fase 12.1) e `056_create_orphan_tables.sql` sem investigação. Estado em staging/prod desconhecido. Trabalho: (a) read do conteúdo das duas; (b) verificar via `\d` se tabelas/colunas existem em staging e prod; (c) cross-check com `docs/NOTE_TCC.md` / `docs/` pra ver se mencionadas como pendentes; (d) verificar se há callers no código aguardando; (e) decidir aplicar ou descartar. Detectado durante diag Item F (Onda 7) em 25/04/2026. |
| 15 | Atualizar `docs/NOTE_TDAH.md` com Onda 5.3 | P3 | 15min | Decisão D3 da Onda 5.3: `NOTE_TDAH.md` não foi atualizada (escopo restrito a `MATRIZ_ACESSO_TDAH.md`). Mencionar Onda 5.3 (remoção fallback `created_by`) no NOTE pra fonte de produto ficar coerente. |
| 16 | Commit migration 055 em origin/main | P2 | 5min | `scripts/migrations/055_drop_profiles_cpf.sql` está aplicada em staging E prod (confirmado em 25/04/2026 via `psql`: coluna ausente, índice ausente, `SELECT cpf` retorna `"column does not exist"` nos dois bancos). Arquivo SQL existe no mirror local em `/scripts/migrations/` mas NUNCA foi commitado em `origin/main`. Quando rodar reconciliação geral do staging (Item 13), commitar a 055 junto. SEM risco operacional — é housekeeping de versionamento. Detectado durante diag Item F (Onda 7) em 25/04/2026. |

---

## Backlog Onda 4 (referência — detalhe na transcript handoff)

Itens 1-11 do handoff Onda 4 (commit `9dd7bbf`). Detalhamento completo na transcript original.

| ID | Título | Prioridade |
|---|---|---|
| 1 | Migrar `/api/transcribe-audio` de OpenAI Whisper → faster-whisper local | P2 |
| 2 | Auditar `/api/analyze-clinical` (governance: withTenant + rate-limit + quota) | P1 |
| 3 | HSTS progressivo: 300 → 86400 → 31536000 + preload + includeSubDomains | P2 |
| 4 | Backport `${usage.limit}` em `/api/transcribe/route.ts` (uniformidade Onda 4) | P3 |
| 5 | Atualizar comentário migration 032 (diz "120 min/mês", código diz "300 lifetime") | P3 |
| 6 | Reforçar warning em `scripts/migrations/046_worker_rls_policy.sql` (BACKDOOR RLS ESCOPADO) | P3 |
| 7 | Adicionar seção "Fechamento pós-Onda 3" em `docs/audits/validacao_tier0_tier1.md` | P3 |
| 8 | Reescopar policy `worker_access` em `transcription_jobs` (filtrar status IN) | P2 |
| 9 | Extrair `isValidCronAuth` pra `src/lib/cron-auth.ts` + alinhar `scan-integrity` com `timingSafeEqual` | P2 |
| 10 | Rotacionar DSN Sentry antigo + migrar projeto pra EU | P1 |
| 11 | Ativar RLS em tabelas `tdah_*` (022/025/026/048 — hoje defesa 100% por WHERE manual) | P1 |

---

## Notas operacionais (não-TODO, mas registrado)

- **Comportamento Clerk + Next 16:** rotas autenticadas (`/api/tdah/*`, `/api/aba/*`, `/api/sessions`) retornam HTML 404 quando request não tem cookie de sessão. Middleware Clerk redireciona pra `/sign-in`, que cai no catch-all 404 do Next. Comportamento idêntico em staging e prod. NÃO é regressão da Onda 5.3 nem bug — é o framework. Documentação: ver smoke HTTP staging Onda 5.3.
