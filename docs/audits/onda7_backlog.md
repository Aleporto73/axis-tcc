# AXIS — Onda 7 Backlog

**Criado:** 25/04/2026 (pós-Onda 5.3 staging)
**Última atualização:** 28/04/2026 (pós-Item 21 fase 1 — commit f257c48)
**Status:** Aberto. Onda 5.3 fechada. Item 21 fase 1 fechada (rotação CRON_SECRET em curso, fases 7-9 pendentes).

---

## Como usar

Backlog de TODOs arquiteturais que NÃO foram tratados nas Ondas 1-5.3 mas merecem atenção. Cada item tem prioridade (P0=urgente, P3=quando der). Itens novos da sessão (Onda 5.3) têm detalhamento; itens antigos (Onda 4) são referência rápida — detalhe completo na transcript do handoff Onda 4.

---

## Itens novos desta sessão (Onda 5.3 — 25/04/2026)

| ID | Título | Prioridade | Estimativa | Notas |
|---|---|---|---|---|
| 12 | Bug `team/route.ts` UUID=TEXT — JOIN nunca casa | P2 | 30min | Em `app/api/tdah/team/route.ts:38-49`, JOIN `pc.created_by = p.clerk_user_id` compara UUID (`tdah_patients.created_by`, FK `profiles.id`) com TEXT (`profiles.clerk_user_id`, ex `user_xxxxx`). Resultado: contadores `patient_count` e `session_count` sempre zerados na UI admin TDAH "Equipe". Fix: trocar `p.clerk_user_id` por `p.id`. Bug silencioso, não crítico, mas confunde admin. Detectado no diag principal Onda 5.3 §2.5. |
| 13 | ✅ FECHADO — VPS staging reconciliado com origin/main | P1 | 1h | Reconciliação concluída em 26/04/2026 (cp staging→prod manual + git pull origin main). Confirmado em 28/04/2026 via fast-forward para `f257c48`. Aprendizado: descarte de M idênticos a origin/main + pull é seguro; stash e cherry-pick foram corretamente evitados. |
| 14 | Validar aplicação no DB das migrations 054 e 056 (parcialmente fechado) | P2 | 30min | Migrations 054 (commit `d0dd2d3`) e 056 (commit `a97d986`) já em origin/main. Pendência: validar via psql se tabelas/colunas existem em staging e prod, e grep callers no código pra confirmar uso. Detectado durante diag Item F (Onda 7) em 25/04/2026. |
| 15 | Atualizar `docs/NOTE_TDAH.md` com Onda 5.3 | P3 | 15min | Decisão D3 da Onda 5.3: `NOTE_TDAH.md` não foi atualizada (escopo restrito a `MATRIZ_ACESSO_TDAH.md`). Mencionar Onda 5.3 (remoção fallback `created_by`) no NOTE pra fonte de produto ficar coerente. |
| 16 | ✅ FECHADO — Commit migration 055 em origin/main | P2 | 5min | Migration 055 já estava em origin/main no commit `4f2f980` (verificação retroativa em 26/04/2026 via `git ls-files`). Aprendizado: rodar `git ls-files` antes de assumir que arquivo é órfão. Detectado durante diag Item F (Onda 7) em 25/04/2026. |
| 17 | ✅ FECHADO retroativo — Trabalho concluído sem registro prévio (28/04/2026) | — | — | Investigação plano "v4" + 4 trabalhos executados sem item formal: (a) **Item 18** race condition em `tdah_token_economy` → fix transação atômica com `FOR UPDATE`, commit `3c1f17e`; (b) **Item 19** CSP Report-Only header habilitado, commit `8c1626f`; (c) **Item 20** sync N:N `patient_therapists` → falso alarme, código já atomicamente correto via `withTenant` + `ON CONFLICT`; (d) **Item 21 fase 1** refactor `isValidCronAuth` para `src/lib/cron-auth.ts` + dual-secret support nos 3 endpoints cron, commit `f257c48` (resolve **Item 9** do backlog Onda 4 referência). Plano v4 também avaliou auditoria conceitual v3 — descartada por não-acionável. |

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
- **Cowork autolink corrompe heredoc grande:** clipboard de saída transforma identifiers tipo `x.md`, `x.id` em links markdown `[x](http://x)`. Workaround durante Onda 5.3 prod: `cp` direto staging→prod no mesmo VPS, sem passar por clipboard. Detectado em 26/04/2026.
- **Rotação CRON_SECRET em andamento (Item 21):** fase 1 (refactor + dual-secret deploy prod) fechada em 28/04/2026, commit `f257c48`. Fase 2 (rotação real) iniciada: passos 5a/5b concluídos — crontab usa env var `$CRON_SECRET` (não vaza em syslog) + valor trocado para SECRET_NOVO (`19ea82c6...`). Pendente: passos 7-9 (remover `CRON_SECRET_OLD` do `.env` + restart final + commit), após validação ciclo completo de `renew-webhook` (a cada 6h, próximo ~18:00 BRT). Bug operacional anotado: `reminders` cron rodando 1x/minuto (1440x/dia) — investigar se intencional em sessão futura.
- **pm2 + .env behavior:** confirmado em 28/04/2026 que `pm2 restart axis-tcc` sem ecosystem.config.js relê `.env` automaticamente (Next.js carrega via dotenv interno em runtime). Flag `--update-env` é redundante neste setup mas inofensiva. `pm2 env <id>` mostra apenas envs que estavam na shell no `pm2 start` original — não reflete o `.env`. Dívida técnica: criar `ecosystem.config.js` + `pm2 save` (não-urgente).