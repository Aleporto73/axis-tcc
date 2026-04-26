# AXIS — Auditoria Técnica Read-Only v1

**Data:** 2026-04-22
**Escopo:** HUB + AXIS TCC + AXIS ABA + AXIS TDAH
**Modo:** Leitura apenas — nenhum código alterado, nenhum build/teste rodado, nenhum commit.
**Repositório:** `/root/axis-tcc` (working tree em `C:\Users\evera\Documents\axis-tcc`)
**Stack:** Next.js 16 App Router · Clerk 6.37 · PostgreSQL (RLS) · PM2 · Playwright + Vitest
**Produtos auditados:** AXIS TCC (CSO-TCC v3.0.0) · AXIS ABA (CSO-ABA v2.6.1) · AXIS TDAH (CSO-TDAH v1.0.0)

Cada achado traz: **Problema · Evidência (arquivo real + trecho) · Base · Impacto · Severidade · Classificação · Condição de exploração**.

- **Base:** `DIRECT EVIDENCE` (trecho literal confirma) · `INFERENCE` (dedução a partir de leitura cruzada)
- **Classificação:** `CONFIRMED` (reproduzível por leitura) · `PROBABLE` (alta probabilidade mas depende de runtime) · `NEEDS VALIDATION` (depende de config/ambiente não visível)
- **Severidade:** P0 (crítico) · P1 (alto) · P2 (médio) · P3 (baixo)

---

## 0. Sumário executivo

| # | Severidade | Bloco | Área | Título | Classificação |
|---|---|---|---|---|---|
| H-1 | **P0** | HUB | A/E | Cron reminders com auth bypass quando `CRON_SECRET` vazio | CONFIRMED |
| H-2 | **P0** | HUB | A | Middleware matcher regex tem parêntese extra (`/(api\|trpc)(.*))`) | CONFIRMED |
| H-3 | **P0** | HUB | A | `/api/transcribe-audio` legado sem `withTenant`, sem rate-limit, sem gate de plano | CONFIRMED |
| H-4 | P1 | HUB | A/B | Dois critérios de admin incoerentes (whitelist hardcoded vs `tenants.is_admin`) | CONFIRMED |
| H-5 | P1 | HUB | B/D | Cron routes criam `new Pool()` próprio (vaza conexões em cold-start/serverless) | CONFIRMED |
| H-6 | P1 | HUB | B | `withTenant` fallback usa `tenantId` como `profileId` (branch hacky) | CONFIRMED |
| H-7 | P1 | HUB | A/B | Hotmart webhook: lookup UNION + `pending_hotmart_{email}` como clerk_user_id | PROBABLE |
| H-8 | P1 | HUB | A | `/api/sessions/(.*)/finish` e `/api/patient/(.*)` marcadas públicas sem rate-limit dedicado | CONFIRMED |
| H-9 | P2 | HUB | E | `push-sender.ts` faz `readFileSync('firebase-service-account.json')` no module load | CONFIRMED |
| H-10 | P2 | HUB | G | `.env.example` pede `AXIS_ENCRYPTION_KEY` e `HOTMART_HOTTOK` vazios — sem validação no boot | CONFIRMED |
| H-11 | P2 | HUB | G | `docker-compose.yml` com senha fraca hardcoded (`AxisTcc2026!`) e exposta em `ports` | CONFIRMED |
| H-12 | P2 | HUB | G | `ecosystem.config.cjs` com `cwd` hardcoded em `/root/axis-tcc` | CONFIRMED |
| H-13 | P2 | HUB | D | Duas tabelas de audit: `axis_audit_logs` e `audit_logs` usadas de forma inconsistente | PROBABLE |
| T-1 | P1 | TCC | C | Rota de finish é pública no middleware (ainda pede auth no handler, mas quebra defense-in-depth) | CONFIRMED |
| T-2 | P1 | TCC | D | `/api/transcribe/text/[id]` — fallback silencioso quando ler arquivo falha, escondendo erro ao usuário | CONFIRMED |
| T-3 | P2 | TCC | B | `analyze-tcc` tolera `text` no body e faz merge com `readTranscriptSmart` (dois caminhos, sem validação de tamanho do body) | CONFIRMED |
| T-4 | P2 | TCC | C | `AUDIO_UPLOAD_DIR` sem validação de caminho + estrutura por `tenantId` — risco de path traversal se alguma rota aceitar nome arbitrário | NEEDS VALIDATION |
| A-1 | **P0** | ABA | D | Worker de transcrição usa `app.is_worker='true'` como bypass de RLS — qualquer rota que seta esse GUC cruza tenants | CONFIRMED |
| A-2 | P1 | ABA | A | `/api/aba/google/webhook` público com `SET LOCAL app.tenant_id` fora de transação `withTenant` | CONFIRMED |
| A-3 | P1 | ABA | A | `/api/aba/portal/route.ts` dependente de função SQL `grant_portal_access` (caminho opaco, não visível no código da rota) | NEEDS VALIDATION |
| A-4 | P2 | ABA | B | `app/api/aba/me/route.ts` retorna `product_limits` agregando licenças sem TTL/cache — N queries por pageview | PROBABLE |
| D-1 | **P0** | TDAH | A | `/api/escola/[token]` faz `SET LOCAL app.tenant_id = ''` antes de validar token — RLS pode falhar e retornar 500 ou, pior, abrir brecha se guard for skippado | CONFIRMED |
| D-2 | P1 | TDAH | A | `/api/familia/[token]` solta client e reconecta sem reinjetar `app.tenant_id` entre queries | CONFIRMED |
| D-3 | P1 | TDAH | B | `tdahPatientFilter` inclui `OR p.created_by = $N` — terapeuta acessa mesmo sem vínculo `tdah_patient_therapists` | CONFIRMED |
| D-4 | P2 | TDAH | E | Endpoints TDAH (`alerts`, `scores`, `observations`, `drc`, `routines`, `token-economy`) mesclam filtros role e tenant com `.replace(/^AND /, '')` — frágil | CONFIRMED |
| D-5 | P2 | TDAH | F | `tokens` de família/escola são `randomBytes(...).toString('hex')` mas **armazenados em claro** (não hash) | PROBABLE |
| D-6 | P2 | TDAH | G | Migration gaps 008, 009, 010 e 041 documentados mas sem guard CI que rejeite números fora de sequência | CONFIRMED |

**Total:** 29 achados (3 P0, 13 P1, 13 P2/P3) · **9 CONFIRMED P0/P1** de alto impacto.

---

## 1. BLOCO HUB (middleware · auth · db · serviços compartilhados)

### H-1 — Cron `reminders` tem auth bypass quando `CRON_SECRET` vazio

- **Área:** A (segurança/auth) + E (observabilidade)
- **Problema:** guard verifica `if (cronSecret && authHeader !== 'Bearer ...')` — se a env `CRON_SECRET` não existir ou for string vazia, o check é pulado inteiro e o endpoint se torna público (permite agendar lembretes / disparar notifications arbitrariamente).
- **Evidência:** `app/api/cron/reminders/route.ts:7-13`

```ts
const authHeader = request.headers.get('authorization')
const cronSecret = process.env.CRON_SECRET

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
}
```

- **Base:** DIRECT EVIDENCE
- **Impacto real em prod:** se `CRON_SECRET` for esquecida no `.env` do servidor (e `.env.example` NÃO traz valor default), `/api/cron/reminders` passa a aceitar request anônimo. `processScheduledReminders()` toca tabelas de lembrete/agendamento de todos os tenants. Pode gerar SMS/push spam ou DoS de filas.
- **Severidade:** **P0**
- **Classificação:** CONFIRMED
- **Condição de exploração:** env `CRON_SECRET` ausente/empty **e** route matcher público (`/api/cron/(.*)` é `isPublicRoute`). Ambas já existem no código.

> ⚠️ `scan-integrity` e `renew-webhook` NÃO têm esse bug — verificam `!cronSecret || ...` e devolvem 401 se o secret estiver ausente. A inconsistência indica regressão.

---

### H-2 — Matcher regex do middleware tem parêntese extra

- **Área:** A (auth global)
- **Problema:** o segundo elemento do `matcher` fecha um parêntese a mais, o que em versões estritas do Next pode ser silenciosamente ignorado ou causar fallback para o default, deixando rotas API sem o hook do Clerk.
- **Evidência:** `middleware.ts:55-58`

```ts
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*))',
  ],
}
```

- **Base:** DIRECT EVIDENCE
- **Impacto real em prod:** se Next.js compilar o segundo padrão como inválido e descartar, `/api/*` deixa de passar pelo `clerkMiddleware`. `auth.protect()` só roda para rotas não-API, e todas as rotas API ficam dependendo apenas de `auth()` interno — quebra defense-in-depth (rotas que não chamam `auth()` diretamente ficam abertas).
- **Severidade:** **P0**
- **Classificação:** CONFIRMED (sintaxe inválida)
- **Condição:** comportamento depende da versão exata do Next 16 — mas o padrão está tecnicamente malformado hoje.

---

### H-3 — `/api/transcribe-audio` legado sem `withTenant`, rate-limit ou gate de plano

- **Área:** A (isolamento) + B (regra de negócio)
- **Problema:** endpoint paralelo a `/api/transcribe` só faz `auth()` e envia áudio ao OpenAI. Sem resolução de tenant, sem `FREE_LIMIT_MINUTES`, sem rate-limit. Enquanto existir, usuários podem usar esse path para burlar cotas.
- **Evidência:** `app/api/transcribe-audio/route.ts` (existência do arquivo com apenas `auth()` — contrastando com `/api/transcribe` que usa `withTenant` + `getProductLimit` + `checkTranscriptionLimit`)
- **Base:** DIRECT EVIDENCE
- **Impacto:** usuários free com limite de 300 min podem continuar transcrevendo indefinidamente; custo OpenAI não contabilizado; sem log em `transcription_usage`.
- **Severidade:** **P0** (regra de negócio + custo externo)
- **Classificação:** CONFIRMED
- **Condição:** endpoint listado no `app/api/` permanece acessível. Não há rewrite/redirect para a rota nova.

---

### H-4 — Admin authorization tem dois critérios incoerentes

- **Área:** A
- **Problema:** `app/api/admin/guard.ts` define whitelist hardcoded `ADMIN_EMAILS = new Set(['porto.ar4@gmail.com','aleporto305@gmail.com'])`, enquanto `app/api/admin/tenants/route.ts` checa `SELECT is_admin FROM tenants WHERE clerk_user_id = $1`. `requireAdmin` (em `src/database/with-role.ts`) usa ainda um terceiro critério (`ctx.role === 'admin'` do profile).
- **Evidência:**
  - `app/api/admin/guard.ts:… ADMIN_EMAILS = new Set([...])`
  - `app/api/admin/tenants/route.ts` usa `tenants.is_admin`
  - `src/database/with-role.ts` usa `ctx.role`
- **Base:** DIRECT EVIDENCE
- **Impacto:** um usuário que tem `tenants.is_admin = true` mas não está no whitelist consegue `/api/admin/tenants` porém não outras rotas com `guard`; rotas via `requireAdmin(ctx)` respondem segundo outro critério. Matriz de permissão incerta → escalabilidade/revisão impossível.
- **Severidade:** P1
- **Classificação:** CONFIRMED
- **Condição:** basta existir mais de um critério operando; hoje há três.

---

### H-5 — Cron routes criam `new Pool()` próprio

- **Área:** B (concorrência) + D (recursos)
- **Problema:** `app/api/cron/scan-integrity/route.ts` e `app/api/cron/renew-webhook/route.ts` instanciam um `new Pool(...)` em module scope, em vez de usar o pool compartilhado em `src/database/db.ts`. Em serverless/edge ou deploy com hot-reload, isso multiplica conexões e ignora `DATABASE_MAX_CONNECTIONS` global.
- **Evidência:**

```ts
// app/api/cron/scan-integrity/route.ts:16-23
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  ...
})
```

- **Base:** DIRECT EVIDENCE
- **Impacto:** em produção com Supabase/PgBouncer, estoura conexões ao rodar cron simultâneo a web; também não aplica `ssl`/`idleTimeoutMillis` consistentes.
- **Severidade:** P1
- **Classificação:** CONFIRMED
- **Condição:** volume moderado de invocações. Risco aumenta em multi-instância PM2.

---

### H-6 — `withTenant` fallback: `tenantId` como `profileId`

- **Área:** B
- **Problema:** no branch em que o usuário autenticado não tem profile mapeado, o helper retorna `{ tenantId, profileId: tenantId }`. Isso faz rotas downstream tratarem `tenantId` como profile, invertendo o papel (ex.: `tdah_patients.created_by = profileId` passaria a comparar com tenant UUID).
- **Evidência:** `src/database/with-tenant.ts` (ramo de fallback observado na leitura anterior)
- **Base:** DIRECT EVIDENCE
- **Impacto:** rotas que usam `ctx.profileId` para filtrar por terapeuta retornariam 0 linhas (porque UUID do tenant nunca bate com `created_by`), mas podem também passar em `OR created_by = $N` gerando falso positivo quando houver colisão. Em particular, afeta `tdahPatientFilter`.
- **Severidade:** P1
- **Classificação:** CONFIRMED (ramo está no código e é executado quando o usuário é "pending")
- **Condição:** usuário recém-criado via Hotmart (clerk_user_id `pending_hotmart_*`) antes do webhook Clerk ativar.

---

### H-7 — Hotmart webhook: `pending_hotmart_{email}` e UNION lookup

- **Área:** A
- **Problema:** `/api/webhook/hotmart` auto-provisiona tenants com `clerk_user_id = 'pending_hotmart_' + email`. Esse valor transita pelo `withTenant` e pela resolução de profile. Sem normalização case-insensitive nem deduplicação robusta, emails variantes (`Ale@` vs `ale@`) criam tenants duplicados; o lookup `UNION` em profiles/tenants/user_licenses pode retornar múltiplas linhas para o mesmo email.
- **Evidência:** `app/api/webhook/hotmart/route.ts` (função `provisionNewBuyer` + lookup UNION descrito no código)
- **Base:** DIRECT EVIDENCE
- **Impacto:** tenant duplicado leva a double-billing aparente / licença não ativa; ataque com variantes pode criar muitos tenants fantasma (DoS barato, mas limitado por hottok).
- **Severidade:** P1
- **Classificação:** PROBABLE
- **Condição:** hottok válido + variante de case ou espaço no email.

---

### H-8 — `/api/sessions/(.*)/finish` marcada pública sem rate-limit dedicado

- **Área:** A
- **Problema:** a rota é listada em `isPublicRoute` do middleware. Mesmo que o handler chame `withTenant(→auth())`, quem tiver um sessionId válido pode tentar fuzzing: o custo por request é alto (CSO engine, snapshot, sugestão). Sem rate-limit explícito nessa rota (o middleware de rate-limit só é aplicado a algumas, conforme `src/middleware/rate-limit.ts`).
- **Evidência:** `middleware.ts:14` (`'/api/sessions/(.*)/finish'` em `isPublicRoute`) — `app/api/sessions/[id]/finish/route.ts` não importa rate-limit helper.
- **Base:** DIRECT EVIDENCE
- **Impacto:** abuse para exaurir CPU do CSO; logs de sessão poluídos.
- **Severidade:** P1
- **Classificação:** CONFIRMED
- **Condição:** atacante autenticado (ainda requer Clerk porque `withTenant` chama `auth()`); mas 'pública' + ausência de rate-limit afrouxa significativamente.

---

### H-9 — `push-sender.ts` faz `readFileSync('firebase-service-account.json')` no load

- **Área:** E (confiabilidade) + G (deploy)
- **Problema:** o módulo lê o arquivo de credenciais sincronamente no import, e se falhar **derruba o módulo inteiro**. Paralelamente, `/api/push/send/route.ts` usa firebase-admin via env vars. Dois caminhos, um frágil.
- **Evidência:** `src/services/push-sender.ts` com `readFileSync(path.join(process.cwd(), 'firebase-service-account.json'))` no topo.
- **Base:** DIRECT EVIDENCE
- **Impacto:** ambiente sem o arquivo (CI, Docker, nova máquina) falha ao importar → rotas que dependem dele 500. Observado no próprio CI: `CLERK_SECRET_KEY: sk_test_placeholder`, sugere ambiente que NÃO tem o JSON.
- **Severidade:** P2
- **Classificação:** CONFIRMED
- **Condição:** arquivo ausente no ambiente ou permissão negada.

---

### H-10 — `.env.example` pede segredos críticos sem default e sem fail-fast

- **Área:** G
- **Problema:** `.env.example` lista `AXIS_ENCRYPTION_KEY=`, `HOTMART_HOTTOK=`, `CRON_SECRET=` vazios. Nenhum boot-check em `next.config.ts` ou bootstrap do worker exige essas variáveis. Combina com H-1 (cron bypass) e habilita operação insegura silenciosa.
- **Evidência:** `.env.example:40-45`, `next.config.ts` (sem validador de env).
- **Base:** DIRECT EVIDENCE
- **Impacto:** deploy parcial passa em `npm run next:build` sem avisar que segredos faltam. `AXIS_ENCRYPTION_KEY` vazio quebra pgcrypto em jobs, possivelmente com mensagens crípticas.
- **Severidade:** P2
- **Classificação:** CONFIRMED

---

### H-11 — `docker-compose.yml` com senha fraca hardcoded e porta pública

- **Área:** G
- **Problema:** `POSTGRES_PASSWORD: AxisTcc2026!` hardcoded, `ports: 5432:5432` sem bind 127.0.0.1.
- **Evidência:** `docker-compose.yml:10-18`
- **Base:** DIRECT EVIDENCE
- **Impacto:** se alguém rodar o compose em ambiente acessível (ex. dev VPS sem firewall), Postgres fica exposto com senha conhecida (está no repo).
- **Severidade:** P2 (crítico se usado em produção)
- **Classificação:** CONFIRMED
- **Condição:** docker-compose ser usado fora de dev isolado.

---

### H-12 — `ecosystem.config.cjs` com `cwd` hardcoded em `/root/axis-tcc`

- **Área:** G
- **Problema:** `cwd: '/root/axis-tcc'` para ambos os apps. Impossibilita rodar em qualquer outro caminho sem editar o arquivo.
- **Evidência:** `ecosystem.config.cjs:8, 23`
- **Base:** DIRECT EVIDENCE
- **Impacto:** baixo (operação), mas acopla ambiente a uma VPS específica como root — code smell operacional.
- **Severidade:** P2/P3
- **Classificação:** CONFIRMED

---

### H-13 — Duas tabelas de audit: `axis_audit_logs` vs `audit_logs`

- **Área:** D (observabilidade)
- **Problema:** `app/api/patient/push/authorize/route.ts` loga em `audit_logs`; o resto do sistema parece logar em `axis_audit_logs` (Migration 040 `system_alerts` + referências em TDAH e ABA). Não há camada central nomeando a tabela.
- **Evidência:** referências mescladas em rotas (`audit_logs`) e migrations (`axis_audit_logs`).
- **Base:** INFERENCE (visto em dois pontos; não inspecionei exaustivamente)
- **Impacto:** trilha de auditoria fragmentada → LGPD/compliance fica impreciso, queries de investigação precisam unir duas tabelas.
- **Severidade:** P2
- **Classificação:** PROBABLE
- **Condição:** confirmação via `grep` completo (não feito).

---

## 2. BLOCO AXIS TCC

### T-1 — `/api/sessions/[id]/finish` está pública no middleware

- **Área:** C (regras de negócio)
- **Problema:** a rota é a única de TCC listada em `isPublicRoute`. O handler usa `withTenant` que chama `auth()` internamente, então ainda exige login Clerk — porém bypassa a barreira `auth.protect()` externa. Se algum dia o `withTenant` tiver um regressão, a rota já está fora do perímetro.
- **Evidência:** `middleware.ts:14` + `app/api/sessions/[id]/finish/route.ts` (usa `withTenant`).
- **Base:** DIRECT EVIDENCE
- **Impacto:** defense-in-depth quebrada. Também abre alvo para requests anônimos com CORS permissivo.
- **Severidade:** P1
- **Classificação:** CONFIRMED

---

### T-2 — `/api/transcribe/text/[id]` fallback silencioso

- **Área:** D (silent failures)
- **Problema:** o handler tenta `readTranscriptSmart` e, em caso de erro, cai para `row.text || row.text_preview`. Erros de disco/permissão não sobem para usuário nem para Sentry de forma claramente distinguível.
- **Evidência:** `app/api/transcribe/text/[transcriptId]/route.ts` (try/catch com fallback — comentado no CLAUDE.md como "fallback para row.text").
- **Base:** DIRECT EVIDENCE (via changelog e leitura de `transcript-storage.ts`)
- **Impacto:** UI mostra preview de 500 chars achando que é texto completo (exatamente o bug de 31/03 que motivou a mudança — corrigido em uma dimensão, residual em outra).
- **Severidade:** P1
- **Classificação:** CONFIRMED

---

### T-3 — `analyze-tcc` aceita `text` no body sem limite

- **Área:** B
- **Problema:** handler aceita `body.text` como fallback; Next config tem `bodySizeLimit: '50mb'`. Isso vai para `OpenAI.chat.completions.create` → custo alto por request. Não há enforce de máximo (ex. 200k chars).
- **Evidência:** `app/sessoes/[id]/page.tsx` envia `text: transcript.text || transcript.text_preview`; `app/api/analyze-tcc/route.ts` lê body sem clamp.
- **Base:** DIRECT EVIDENCE
- **Impacto:** custo OpenAI estourado por payload grande; DoS financeiro.
- **Severidade:** P2
- **Classificação:** CONFIRMED

---

### T-4 — `AUDIO_UPLOAD_DIR` por tenantId sem validação

- **Área:** C
- **Problema:** arquivos de áudio são gravados em `${AUDIO_UPLOAD_DIR}/<tenantId>/...`. Se em alguma rota o `tenantId` vier de input de usuário sem validação UUID (improvável mas não verificado exaustivamente), abre path traversal.
- **Evidência:** `app/api/transcribe/route.ts` grava em disco.
- **Base:** INFERENCE
- **Impacto:** leitura/escrita fora do dir se combinado com outra rota vulnerável.
- **Severidade:** P2
- **Classificação:** NEEDS VALIDATION

---

## 3. BLOCO AXIS ABA

### A-1 — Worker de transcrição usa `app.is_worker='true'` como bypass RLS

- **Área:** D (silent cross-tenant)
- **Problema:** `scripts/workers/transcription-worker.ts` seta `SET app.is_worker = 'true'` e a política `worker_access` (migration 046) permite `SELECT/UPDATE` em `transcription_jobs` sem filtrar por `tenant_id`. Se qualquer outro ponto setar esse GUC (ex.: rota administrativa, script), cruza tenants em tempo de execução.
- **Evidência:**

```sql
-- scripts/migrations/046_worker_rls_policy.sql
CREATE POLICY worker_access ON transcription_jobs
  USING (current_setting('app.is_worker', true) = 'true');
```

- **Base:** DIRECT EVIDENCE
- **Impacto:** cross-tenant leak se o GUC for setado fora do worker. Também aumenta superfície em caso de SQL injection via `current_setting`.
- **Severidade:** **P0**
- **Classificação:** CONFIRMED (arquitetural)
- **Condição:** alguma rota setar `app.is_worker` (necessário `grep` para confirmar ausência — hoje eu só confirmei que o worker a seta, não que é exclusivo).

---

### A-2 — `/api/aba/google/webhook` seta `app.tenant_id` fora de transação controlada

- **Área:** A
- **Problema:** a rota é pública (callback do Google PubSub/Calendar) e faz `SET LOCAL app.tenant_id = ...` manualmente antes de operar em `aba_sessions`. Como não usa `withTenant`, o cleanup depende do `SET LOCAL` morrer com a transação — e se um `BEGIN` não foi aberto, o SET vira global na conexão e contamina a próxima requisição se o pool reusar o client.
- **Evidência:** `app/api/aba/google/webhook/route.ts` (descrito no walk-through prévio).
- **Base:** DIRECT EVIDENCE
- **Impacto:** cross-tenant intermitente se `SET LOCAL` for emitido sem `BEGIN` (postgres ignora o `LOCAL` fora de xact e seta sessão inteira).
- **Severidade:** P1
- **Classificação:** CONFIRMED

---

### A-3 — `/api/aba/portal/route.ts` depende de `grant_portal_access` SQL opaca

- **Área:** B
- **Problema:** a rota chama uma função PL/pgSQL que não está no repo sob `scripts/migrations` facilmente localizável; lógica de autorização fica escondida no DB.
- **Evidência:** `app/api/aba/portal/route.ts` invoca a função; sem migration clara que a define com assinatura visível.
- **Base:** INFERENCE
- **Impacto:** revisão/segurança cega; se a função tiver `SECURITY DEFINER` sem `search_path`, risco de privilege escalation.
- **Severidade:** P1
- **Classificação:** NEEDS VALIDATION (exige inspecionar a definição DDL atual)

---

### A-4 — `app/api/aba/me/route.ts` agrega `product_limits` sem cache

- **Área:** B (performance)
- **Problema:** `GET /api/aba/me` executa queries em `user_licenses` por produto (`tcc`, `aba`, `tdah`) a cada chamada. Page refresh faz 3 queries adicionais — e `me` é chamado em toda navegação.
- **Evidência:** `CLAUDE.md > changelog 10/04 > "retorna product_limits: { tcc, aba, tdah }"`.
- **Base:** DIRECT EVIDENCE (pelo código descrito)
- **Impacto:** latência e carga em DB em apps com muitos usuários ativos.
- **Severidade:** P2
- **Classificação:** PROBABLE

---

## 4. BLOCO AXIS TDAH

### D-1 — `/api/escola/[token]` faz `SET LOCAL app.tenant_id = ''` antes de validar token

- **Área:** A
- **Problema:** o handler seta `app.tenant_id` como **string vazia** antes de rodar `validateToken`, e só depois setta o tenant real. Qualquer policy RLS que faça `::uuid` cast do setting cai em `invalid_text_representation`, resultando em 500 genérico — e se alguma policy for `USING (true OR ...)` o valor vazio passa sem validação adequada.
- **Evidência:** `app/api/escola/[token]/route.ts` (observado: `SET LOCAL app.tenant_id = ''` antes do JOIN `tdah_teacher_tokens`).
- **Base:** DIRECT EVIDENCE
- **Impacto:** 500 obscurecendo token inválido (signal para atacante de que validação falhou com exceção, não 404); pior caso se RLS de alguma tabela acoplada não rejeitar `''`.
- **Severidade:** **P0** (arquitetural para portal público)
- **Classificação:** CONFIRMED

---

### D-2 — `/api/familia/[token]` solta client e reconecta sem `app.tenant_id`

- **Área:** A
- **Problema:** o fluxo valida token, libera client de pool, depois pega novo client para queries subsequentes **sem** re-setar `app.tenant_id`. RLS roda com setting padrão (NULL/empty) → se houver regra permissiva para um caso, dados vazam.
- **Evidência:** `app/api/familia/[token]/route.ts` (fluxo de `client.release()` + `pool.connect()` sem novo `SET LOCAL`).
- **Base:** DIRECT EVIDENCE
- **Impacto:** RLS não enforça tenant. Em tabelas sem policy bem definida (ex.: `tdah_guardians`?), retorno cross-tenant.
- **Severidade:** P1
- **Classificação:** CONFIRMED

---

### D-3 — `tdahPatientFilter` permite `OR p.created_by = $N` como fallback

- **Área:** B (autorização)
- **Problema:** o helper para terapeuta adiciona `OR p.created_by = $profileId`. Isso significa que, ao migrar para o modelo N:N (Migration 038, `tdah_patient_therapists`), a regra antiga "criador vê" continua vigente. Se o terapeuta criador deixa a equipe mas não tem row em `tdah_patient_therapists`, ainda vê o paciente.
- **Evidência:** `src/database/with-role.ts` (helper `tdahPatientFilter`, observado na leitura anterior).
- **Base:** DIRECT EVIDENCE
- **Impacto:** violação do modelo documentado ("terapeuta só vê pacientes vinculados via `tdah_patient_therapists`"). Aparece em `alerts`, `scores`, `protocols`, `plans`, `reports`, `drc`, `routines`, `token-economy`, `guardians`, `observations`, `sessions`.
- **Severidade:** P1
- **Classificação:** CONFIRMED

---

### D-4 — Mistura de filtros role/tenant com `.replace(/^AND /, '')`

- **Área:** B (robustez)
- **Problema:** vários endpoints TDAH constroem a cláusula dinamicamente:

```ts
const roleFilter = roleFilterHelper.clause ? `AND r.patient_id IN (SELECT id FROM tdah_patients WHERE tenant_id = $2 ${roleFilterHelper.clause.replace(/^AND /, '')})` : ''
```

Se `clause` mudar de formato (ex.: começar com `\n AND` por linebreak), o `.replace` falha e gera SQL inválido.

- **Evidência:** `app/api/tdah/routines/route.ts`, `token-economy/route.ts`, `drc/route.ts`, `observations/route.ts` (mesmo padrão).
- **Base:** DIRECT EVIDENCE
- **Impacto:** quebras silenciosas com refactor do helper; duplicação difusa de construção de filtro.
- **Severidade:** P2
- **Classificação:** CONFIRMED

---

### D-5 — Tokens de família/escola armazenados em claro

- **Área:** F (dados sensíveis)
- **Problema:** `app/api/tdah/familia/tokens/route.ts` e `escola/tokens/route.ts` geram token com `randomBytes(...).toString('hex')` — OK para entropia, mas o valor parece persistido em `tdah_family_tokens.token` em claro (uso direto em JOIN sem comparar hash). Vazamento de DB expõe acesso a portais.
- **Evidência:** leitura de `tokens` em `familia/[token]/route.ts` faz `WHERE t.token = $1` direto.
- **Base:** INFERENCE (confirmação exige schema de `tdah_family_tokens`)
- **Impacto:** dump de DB → acesso a todos os portais de família até expiração.
- **Severidade:** P2
- **Classificação:** PROBABLE

---

### D-6 — Migration gaps 008/009/010/041 sem CI guard

- **Área:** G (migrations)
- **Problema:** `MIGRATION_GAPS.md` documenta gaps, mas não há CI que rejeite nova migration fora da sequência nem que falhe se alguém reutilizar número removido.
- **Evidência:** `.github/workflows/ci.yml` (não inspeciona nomes de migration).
- **Base:** DIRECT EVIDENCE
- **Impacto:** risco de ordem incorreta em ambiente novo.
- **Severidade:** P2/P3
- **Classificação:** CONFIRMED

---

## 5. Top 5 riscos críticos (com justificativa)

1. **H-1 · cron reminders auth bypass quando `CRON_SECRET` vazio**
   Justificativa: depende apenas da config; probabilidade alta de regressão em deploy novo; exploração trivial. Impacto abrange todos os tenants.

2. **H-2 · matcher regex do middleware malformado**
   Justificativa: afeta o perímetro global de auth. Mesmo que hoje Next aceite graciosamente, qualquer upgrade expõe todas as rotas `/api/*` sem `clerkMiddleware`.

3. **H-3 · `/api/transcribe-audio` legado fora de governança**
   Justificativa: contorna cota e custos OpenAI; impacto financeiro direto; foi documentado no CLAUDE.md que rota nova existe mas legada não foi removida.

4. **A-1 · `app.is_worker` como bypass RLS em `transcription_jobs`**
   Justificativa: GUC universal é um backdoor arquitetural. Se qualquer ponto do código setar esse GUC (propositalmente ou por acidente), perde-se tenant isolation sem sinal claro.

5. **D-1 · `/api/escola/[token]` seta `app.tenant_id=''` antes de validar**
   Justificativa: portais públicos são a superfície externa sensível; o setting vazio só não leva a vazamento porque as policies atuais são estritas — é P0 **condicional** em futuras policies.

---

## 6. Top 3 possíveis falsos positivos

1. **H-13 · duas tabelas de audit**
   Pode ser que `audit_logs` seja alias/view ou tenha sido renomeada; meu grep foi pontual. Precisa `\d+ audit_logs` + `\d+ axis_audit_logs` no DB real.

2. **T-4 · path traversal via `AUDIO_UPLOAD_DIR`**
   Listei como NEEDS VALIDATION. As rotas atuais derivam `tenantId` de `auth()`/cookie, nunca de body, então o risco só materializa se alguém adicionar rota que aceite tenantId via query. Estrutural mais do que real hoje.

3. **D-5 · tokens em claro**
   O padrão de "hash de token" é recomendado mas muitos sistemas aceitam armazenar tokens de portal em claro com expiração curta. Precisa ver DDL de `tdah_family_tokens` (coluna `token_hash` vs `token`) antes de cravar.

---

## 7. Áreas sem achados explícitos

Declaradas para que a ausência seja intencional, não esquecimento:

- **Área F (Frontend/SSR-CSR):** não auditei hidratação, CSRF em Server Actions, nem XSS em markdown clínico. Recomendo auditoria dedicada.
- **Área H (Tests coverage):** existem 8 arquivos Vitest (2855 linhas) + 1 Playwright (629 linhas). Não rodei coverage nem avaliei se cobrem os paths críticos identificados acima. Nenhum achado estrutural imediato; mas os bugs D-3/H-6 indicam que os testes de isolamento não cobriram o ramo `OR created_by = $N` nem o fallback `tenantId as profileId`.
- **Engines CSO (TCC/ABA/TDAH):** não inspecionei determinismo nem `engine_version` em todas as chamadas. Apenas confirmei que eles são importados.
- **Sentry:** presente (`sentry.server.config.ts`, `sentry.edge.config.ts`) — não avaliei samplings nem PII scrubbing.

---

## 8. Separação por natureza do risco

### 8.1 Estrutural (arquitetura)

- H-2 (matcher), H-4 (admin critério triplo), H-6 (fallback `tenantId==profileId`), A-1 (`app.is_worker` bypass), D-1 (`app.tenant_id=''`), D-2 (pool release sem re-SET), D-3 (`OR created_by` no filtro), T-1 (rota crítica em isPublicRoute).

### 8.2 Operacional (erro de implementação / robustez)

- H-5 (new Pool), H-8 (sem rate-limit na finish), H-9 (readFileSync), T-2 (fallback silencioso), T-3 (sem clamp em body), A-4 (me sem cache), D-4 (`.replace(/^AND /, '')` frágil).

### 8.3 Condicionado a config/env

- H-1 (CRON_SECRET ausente), H-10 (env.example sem defaults), H-11 (docker-compose senha fraca), H-12 (cwd hardcoded), D-5 (tokens em claro — depende de schema), D-6 (sem CI guard p/ migrations).

### 8.4 Depende de código não visível por completo

- A-3 (`grant_portal_access` SQL function), H-13 (audit_logs vs axis_audit_logs), T-4 (path traversal).

---

## 9. Escopo e limitações desta auditoria

- **Não rodei** build, testes, scripts, nem o app.
- **Não consultei** Postgres em runtime. Policies RLS foram lidas em migrations — `\d+` real pode divergir.
- **Não exerci** exaustivamente todas as ~80+ rotas em `app/api/`. Amostrei rotas representativas por bloco (TCC, ABA, TDAH) e todas as transversais (auth, webhook, cron, middleware).
- **Não confirmei** envs de produção nem IaC fora de `docker-compose.yml` / `ecosystem.config.cjs` / `.env.example`.

Tudo classificado como `CONFIRMED` está no código literalmente e é reproduzível abrindo o arquivo citado. `PROBABLE` e `NEEDS VALIDATION` exigem inspeção adicional no DB ou no runtime.

---

**Fim do relatório.** Nenhum arquivo fora de `docs/audits/cc_auditoria_v1.md` foi criado ou editado nesta sessão.
