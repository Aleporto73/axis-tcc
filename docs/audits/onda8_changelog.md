# AXIS — Onda 8 Changelog

**Data:** 03/05/2026
**Status:** Concluída e aplicada em produção (HEAD `c4aea45`)
**Commits prod:** 5 (`274fb4d` → `57dafdd` → `804fa91` → `f421ccd` → `c4aea45`)

---

## §1. Resumo executivo

Onda 8 endereçou auditoria CC + Codex sobre AXIS Clínico, fechando 4 achados críticos (HUB-01, HUB-02, TCC-02, HUB-06), refutando 3 fantasmas (TDAH-04, ABA-02 Bug A+B), criando infraestrutura de prevenção (Zod env validation, CI step) e documentando 2 débitos arquiteturais conscientes (HUB-04, HUB-05).

**Padrão estabelecido:** toda Sessão de fix começa com bloco read-only de validação. Custo baixo, evita refator preventivo desnecessário (3 fantasmas economizaram ~3h cada).

**Impacto produção:** 0 quebras, 539/539 testes verdes (era 527 antes), 5 commits aplicados sem rollback.

---

## §2. Sessões e commits

| # | Sessão | Commit | Entrega | Arquivos |
|---|---|---|---|---|
| 1 | HUB-01 — PII redaction | `274fb4d` | Util `log-redaction.ts` + 16 testes + 12 substituições redactEmail em 5 webhooks | 6 arquivos (1 util novo + 1 test novo + 4 webhooks) |
| 2A | HUB-02 + TCC-02 + 3 subs | `57dafdd` | Migration 066 + rate-limit + cross-check OAuth state + middleware cleanup | 9 arquivos (1 migration + 8 routes/middleware) |
| 2B | Housekeeping NOTEs | `804fa91` | NOTE_TDAH (TDAH-04 REFUTADO) + NOTE_ABA (ABA-02 CORRIGIDO) + `PONTOS_ATENCAO_ARQUITETURAL.md` (HUB-04 + HUB-05 + Protocolo de Auditoria) | 3 arquivos |
| 3 | HUB-06 + Zod env validation | `f421ccd` | Senha parametrizada (compose) + bind 127.0.0.1 + 13 envs documentados + Zod schema centralizado + CI step | 5 arquivos (3 mod + 2 novos) |
| 3-cleanup | HUB-06 fallback removido | `c4aea45` | Fallback `AxisTcc2026!` deletado do compose + `.env.example` + senha rotacionada em prod | 2 arquivos |

---

## §3. Achados endereçados

### Resolvidos (fix em prod)

- **HUB-01** — PII (email) em `console.log` de webhooks Hotmart/Clerk/Google → util `log-redaction` com 4 funções (`redactEmail`, `redactCPF`, `redactPhone`, `redactPII`)
- **HUB-02** — `/api/patient/push/authorize` rota pública sem rate-limit, sem `expires_at`, retornava `full_name` → migration 066 versiona schema + rate-limit 10/min + validação expiração 30d + remove PII do response
- **TCC-02** — `/api/sessions/(.*)/finish` em `isPublicRoute` (defense-in-depth quebrada) → removido do middleware, agora privada com `auth.protect()`
- **HUB-06** — Senha Postgres `AxisTcc2026!` hardcoded no `docker-compose` + porta 5432 exposta → senha rotacionada em prod (32 hex random), parametrizada via env, bind 127.0.0.1, fallback removido

### Sub-achados (Sessão 2A)

- **Sub 1** — `/api/push/register` + `/api/push/subscribe` sem `rateLimit` → `rateLimit` 30/min adicionado em ambos
- **Sub 2** — Callbacks Google (TCC + ABA) sem cross-check `state` vs `auth().userId` → adicionado em ambos com redirect para `?google=state_mismatch`
- **Sub 3** — Comentário desatualizado no middleware ("liberadas para desenvolvimento") → atualizado para "APIs com auth interna (Clerk via withTenant, CRON_SECRET, ou push_auth_token)"

### Refutados (fantasmas — estavam corrigidos no código mas docs desatualizados)

- **TDAH-04** — NOTE_TDAH dizia que `lgpd/delete` usava coluna `content` errada. Validação empírica: schema real em prod usa `content` (correto). Migration 007 que define `summary_text` nunca foi aplicada. Confirmado por migrations 043 e 014.
- **ABA-02 Bug A** — INSERT em GCal sync sem `declared_site_id`/`service_mode` → já corrigido com comentário "Bug 1 fix" linhas 178-180 do código
- **ABA-02 Bug B** — Match attendee silencioso → já corrigido, retorna array `unmatched` no JSON + audit log com `unmatched_count`

### Documentados como débito consciente (`PONTOS_ATENCAO_ARQUITETURAL.md`)

- **HUB-04** — `withTenant` fallback admin (linhas 161-186 de `src/database/with-tenant.ts`). 15 tenants órfãos em prod (5 `pending_hotmart` + 10 testes), zero usuários reais afetados. Refator agora = risco maior que manter. Gatilho documentado.
- **HUB-05** — `calendar_connections` sem RLS forced. 15 rotas tocam a tabela: 8 com `withTenant` (OK), 5 com `pool.query` direto (débito), 2 com pattern misto legítimo. TODO explícito em `cron/renew-webhook:7-15`. Gatilho documentado.

### Adiados explicitamente

- **HUB-03** (`app.is_worker` escopado a `transcription_jobs`) — risco arquitetural latente, não exploração
- **HUB-07** (CSP Report-Only com `unsafe-inline`) — projeto separado, requer auditoria de inline scripts em todo `app/`
- **HUB-08** (`SENTRY_PROJECT` fallback hardcoded) — P3 cosmético, resolvido naturalmente quando Sessão 4 (smoke CI) entrar
- **HUB-09 + HUB-10** (CI sem E2E + build com placeholders) — Sessão 4 (Onda 9)
- **Redis 6379 sem bind 127.0.0.1** — sub-achado descoberto na Sessão 3, fora de escopo
- **Endurecimento progressivo Zod** (5 envs opcionais: `CLERK_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `INTERNAL_API_KEY`, `HOTMART_HOTTOK`) — endurecer em Onda 9+ após confirmar setado na VPS

---

## §4. Decisões registradas

- **D1: Padrão "validar antes de fixar"** — toda Sessão começa com bloco read-only validando empiricamente os achados. Bloco 0 da Onda 8 economizou ~3h refutando TDAH-04, ABA-02 Bug A, ABA-02 Bug B (3 fantasmas).
- **D2: Refutar > Refatorar** quando débito tem risco prático zero. HUB-04 e HUB-05 viraram documentação (gatilhos explícitos) em vez de refator preventivo.
- **D3: Padrão Python+SHA256 para edits** — Edit tool nativo do CC sofre bug FUSE/virtiofs em arquivos >~24KB (truncamento ~5 linhas no fim). Estabelecido como obrigatório após incidente Sessão 1 em `hotmart/route.ts` (610 linhas).
- **D4: CRLF→LF normalize na leitura** — após bug Sessão 2 onde `text.count(old)` falhou por mismatch de line endings entre heredoc Python (LF) e arquivo (CRLF). Padrão `raw.decode('utf-8').replace('\r\n', '\n')` virou rotina.
- **D5: Afrouxamento híbrido em Zod env validation** — 5 envs (`CLERK_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `INTERNAL_API_KEY`, `HOTMART_HOTTOK`) marcadas como `.optional()` independente de `NODE_ENV`. Risco real: importar `env.ts` em prod sem essas envs setadas quebra boot. Endurecimento progressivo na Onda 9+ após confirmar VPS.
- **D6: HUB-06 fix em 2 etapas** — Sessão 3 parametriza compose (com fallback dev). Cleanup posterior (`c4aea45`) remove fallback após Alê rotacionar senha em prod. Senha histórica `AxisTcc2026!` permanece no histórico git mas não no working tree.
- **D7: Migration 066 com naming `shared_*`** — descoberto em runtime que `validate-migrations.sh` exige prefixo de módulo (`aba|tcc|tdah|shared`). Naming `066_patient_*` rejeitado, renomeado para `066_shared_patient_push_auth_token.sql`.

---

## §5. Surpresas e aprendizados

1. **Bug FUSE/virtiofs em CC sandbox** — Edit tool trunca arquivos >~24KB mid-line ao processar último `str_replace`. Recovery via Python+marker matching preservou 5 fixes válidos sem corrupção. Padrão Python+SHA estabelecido como obrigatório daí em diante.
2. **NOTEs desatualizadas como fonte de fantasmas** — auditoria CC original (sem este bloqueio read-only) leu NOTE_TDAH e NOTE_ABA como fonte de verdade. 3 dos 4 achados "P1 críticos" eram fantasmas. Custo evitado: ~3h de fix em código já correto. Gerou Protocolo de Auditoria em `PONTOS_ATENCAO_ARQUITETURAL.md`.
3. **Codex inferior ao CC neste tipo de auditoria** — Codex ficou no documental, CC leu código real e listou linha por linha. Em auditorias futuras: CC primeiro, Codex como sanity check secundário.
4. **`grep -c` conta linhas, não matches** — descoberto na Etapa Fix-TS Sessão 3 quando assert `n_replacements == 51` falhou (real era 54). Solução: `grep -oE | wc -l` para contar matches reais.
5. **`process.env.NODE_ENV = 'X'` é readonly em Node 20+** — `@types/node` marca como `readonly`. Solução: `let mutEnv = process.env as Record<string, string | undefined>` no scope de teste, reatribuído no `beforeEach`. 54 substituições no `env.test.ts`.
6. **Husky `validate-migrations.sh` é rigoroso** — regex `^[0-9]{3}_(aba|tcc|tdah|shared)_[a-z0-9_]+\.sql$`. Migration `066_patient_push_auth_token.sql` rejeitada, renomeada para `shared_*` antes do commit.
7. **`mutEnv` precisa de `let` (não `const`) + reatribuição no `beforeEach`** — porque `process.env = { ...originalEnv }` cria objeto novo, referência de `const mutEnv` ficaria morta.
8. **Sintaxe Compose `${VAR:?error}` para env obrigatório** — falha fast com mensagem customizada se variável não setada. Mais seguro que `${VAR:-fallback}` para secrets.
9. **`tsx` (não `ts-node`)** disponível no `node_modules`. Usado no CI step "Env validation" — `npx tsx src/lib/env.ts`.
10. **15 tenants órfãos em prod** (HUB-04 dimensionado): 5 `pending_hotmart` + 10 testes. Zero usuários comerciais afetados. 14 antigos (>30d), 0 nos últimos 7d. Diagnóstico permitiu decidir entre fix simples (delete fallback) ou migration retroativa.

---

## §6. Validação em produção

| Camada | Resultado |
|---|---|
| `npx tsc --noEmit` (full) | EXIT 0 ✓ |
| `npx vitest run --exclude='e2e/**'` | 17 test files / 539 tests PASSED ✓ |
| `validate-migrations.sh --all` | checked=10, errors=0 ✓ |
| `next:build` | Compiled successfully (154 routes) ✓ |
| `pm2 restart axis-tcc` | online ✓ |
| `curl /api/health` | HTTP 200 ✓ |
| Senha Postgres rotacionada | TCP test EXIT 0 ✓ |

---

## §7. Status final

- ✅ Todos os 5 commits aplicados em produção (HEAD `c4aea45`)
- ✅ Mirror Windows + VPS prod sincronizados
- ✅ NOTEs atualizados (TDAH-04 REFUTADO, ABA-02 CORRIGIDO)
- ✅ `PONTOS_ATENCAO_ARQUITETURAL.md` criado (HUB-04 + HUB-05 + Protocolo)
- ✅ Zod env validation infraestrutura criada (não importada ainda — migração progressiva)
- ✅ HUB-06 fechado (senha rotacionada, fallback removido, bind 127.0.0.1)
- 🟡 Senha histórica `AxisTcc2026!` ainda no histórico git (não-urgente; firewall + rotação mitigam)

---

## §8. Próximos passos

### Onda 9 — Sessão 4 (Smoke CI + Playwright)

- 3.3 Smoke CI Postgres real (~2h) — previne fantasmas TDAH-04 futuros via CI
- 3.4 Playwright job CI nightly (~1h) — exercita 14 testes e2e TDAH

### Onda 9 — Endurecimento progressivo Zod

- Confirmar quais das 5 envs opcionais estão setadas na VPS
- Remover `.optional()` uma a uma com `startsWith()`/`min()` adequados

### Onda 9 — Sub-achados acumulados

- Redis 6379 sem bind 127.0.0.1
- Flake `analyze-clinical retorna 401` (timeout em ~19s sob carga paralela)
- Migrar 115 refs `process.env.X` para `env.X` (uso do validator centralizado)

### Long-term

- HUB-03, HUB-07, HUB-08, HUB-04, HUB-05 — quando gatilhos documentados em `PONTOS_ATENCAO_ARQUITETURAL.md` dispararem
- Limpeza histórica do git (`git filter-repo`) se senha histórica virar risco real
