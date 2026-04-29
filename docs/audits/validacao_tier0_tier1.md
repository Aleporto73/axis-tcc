# Validação Técnica — Tier 0 / Tier 1

**Data:** 2026-04-23
**Modo:** READ-ONLY (repo local + VPS bloqueado por solicitação do usuário)
**Escopo:** Confirmar/refutar 5 achados P0 das auditorias v1 + v2. Zero correção. Zero patch.

---

## CHECK 1 — Sentry enviando PII clínica (Tier 0)

- **Veredito:** **CONFIRMADO**
- **Achado refutável?** Não — três flags explícitos `sendDefaultPii: true` + Replay ativo + DSN para região US + `enableLogs: true` + sampling 100 %.
- **Severidade confirmada:** **P0 — Tier 0**

### Evidência — `sentry.server.config.ts`

```ts
 7  Sentry.init({
 8    dsn: "https://d08fb0a21eb8ba3e0dca74b16f9134a0@o4511070995742720.ingest.us.sentry.io/4511071001182208",
 9
10    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
11    tracesSampleRate: 1,
12
13    // Enable logs to be sent to Sentry
14    enableLogs: true,
15
16    // Enable sending user PII (Personally Identifiable Information)
17    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
18    sendDefaultPii: true,
19  });
```

### Evidência — `sentry.edge.config.ts`

```ts
 8  Sentry.init({
 9    dsn: "https://d08fb0a21eb8ba3e0dca74b16f9134a0@o4511070995742720.ingest.us.sentry.io/4511071001182208",
10
11    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
12    tracesSampleRate: 1,
13
14    // Enable logs to be sent to Sentry
15    enableLogs: true,
16
17    // Enable sending user PII (Personally Identifiable Information)
18    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
19    sendDefaultPii: true,
20  });
```

### Evidência — `instrumentation-client.ts`

```ts
 7  Sentry.init({
 8    dsn: "https://d08fb0a21eb8ba3e0dca74b16f9134a0@o4511070995742720.ingest.us.sentry.io/4511071001182208",
 9
10    // Add optional integrations for additional features
11    integrations: [Sentry.replayIntegration()],
12
13    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
14    tracesSampleRate: 1,
15    // Enable logs to be sent to Sentry
16    enableLogs: true,
17
18    // Define how likely Replay events are sampled.
19    // This sets the sample rate to be 10%. You may want this to be 100% while
20    // in development and sample at a lower rate in production
21    replaysSessionSampleRate: 0.1,
22
23    // Define how likely Replay events are sampled when an error occurs.
24    replaysOnErrorSampleRate: 1.0,
25
26    // Enable sending user PII (Personally Identifiable Information)
27    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
28    sendDefaultPii: true,
29  });
```

### Observações

- **DSN idêntico** nos três arquivos → todos emitem para o mesmo projeto.
- **Host do DSN:** `o4511070995742720.ingest.us.sentry.io` → **região US**. Dados clínicos brasileiros saem do Brasil para os EUA sem data-processing agreement visível nesta config. Implica contrato LGPD (art. 33) + HIPAA (se houver clínicas US).
- **`sendDefaultPii: true` em 3/3 ambientes** (server, edge, client). Inclui IP, cookies, request body (até `maxRequestBodySize`), user object Clerk.
- **`tracesSampleRate: 1`** (100 %) → toda request produz span com payload. Em produção clínica isso é volume + superfície de PII enorme.
- **`enableLogs: true`** → `console.log/error` são replicados ao Sentry. Se o código loga nome de paciente, transcrição, ou trial data, vai junto.
- **`replaysSessionSampleRate: 0.1`** (10 %) + **`replaysOnErrorSampleRate: 1.0`** (100 % em erro) → Sentry Replay captura **DOM + inputs + texto renderizado**. Em tela de sessão (transcrição visível, nome do paciente no cabeçalho), cada erro UI vira um vídeo replayável na nuvem Sentry US.
- Ausência de `beforeSend` / `beforeSendTransaction` / `denyUrls` / filtros de scrubbing. Nada de `maskAllText`/`blockAllMedia` no replay.

---

## CHECK 2 — Matcher regex middleware malformado (Tier 1)

- **Veredito:** **CONFIRMADO sintaxe inválida — tolerada em runtime (Next 16 aceitou silenciosamente)**
- **Severidade confirmada:** **P1 — Tier 1** (bomba-relógio: quebra em refactor / upgrade de Next)

### Evidência — `middleware.ts` (linhas 54–59)

```ts
54  export const config = {
55    matcher: [
56      '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
57      '/(api|trpc)(.*))',
58    ],
59  }
```

### Prova literal da malformação

Sem `next build` disponível neste sandbox (`next: not found` — binário ausente), a validação foi feita via construtor `RegExp` nativo do V8, que é um superset estrutural do que Next/path-to-regexp aceita:

```
RegExp OK  :: "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)"
RegExp ERR :: "/(api|trpc)(.*))" -> Invalid regular expression: //(api|trpc)(.*))/: Unmatched ')'
```

Contagem de parênteses na linha 57:
- Abertos: `(api|trpc)` + `(.*)` = **2**
- Fechados: `)` + `)` + `)` = **3**
- **Desbalanceio:** `+1 )` à direita.

### Observações

- `next build` não pôde ser executado no sandbox (node_modules do Next não instalados — `node_modules/.bin/next` ausente). Marcado como **INCONCLUSIVO quanto a warning no build pipeline**, mas **CONFIRMADO estrutural** via análise do literal.
- O fato do app estar em produção hoje indica que **Next 16 tolera silenciosamente** a entrada malformada (provavelmente via `try/catch` no path-to-regexp ou porque a string malformada nunca é compilada como regex pura — Next converte para sua DSL antes).
- Risco: qualquer upgrade de Next (16 → 17) ou de `path-to-regexp` pode tornar isso erro hard. Além disso, matchers são a **primeira linha de defesa para rotas protegidas** — se o parser decidir "falho-aberto" em vez de "falho-fechado" em algum futuro patch, rotas privadas vazam.

---

## CHECK 3 — CRON_SECRET bypass (Tier 1)

- **Veredito:** **CONFIRMADO (2 de 3 rotas vulneráveis)** + **Ação B (VPS) AGUARDANDO INPUT DO USUÁRIO**
- **Severidade confirmada:** **P1 — Tier 1** (se secret estiver ausente/vazio no VPS, vira **P0**)

### Evidência A.1 — `app/api/cron/reminders/route.ts` (linhas 6–12)

```ts
 6  export async function GET(request: NextRequest) {
 7    try {
 8      // Verificar token de segurança (para cron externo)
 9      const authHeader = request.headers.get('authorization')
10      const cronSecret = process.env.CRON_SECRET
11
12      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
```

**Falha:** a guarda é **`cronSecret && ...`**. Se `CRON_SECRET` estiver **undefined/empty** no ambiente, a condição curto-circuita para `false`, o `return 401` **nunca executa**, e a rota fica **aberta sem auth**.

### Evidência A.2 — `app/api/cron/scan-integrity/route.ts` (linhas 27–33)

```ts
27      // ── Auth: CRON_SECRET (mesmo padrão dos outros cron endpoints) ──
28      const authHeader = request.headers.get('authorization')
29      const cronSecret = process.env.CRON_SECRET
30
31      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
32        return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
33      }
```

**OK.** Esta rota usa `!cronSecret || ...` — se o secret não existir, **nega** (fail-closed). Esta é a forma correta.

### Evidência A.3 — `app/api/cron/renew-webhook/route.ts` (linhas 33–38)

```ts
33  export async function GET(request: NextRequest) {
34    try {
35      const authHeader = request.headers.get('authorization')
36      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
37        return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
38      }
```

**Falha parcial:** se `CRON_SECRET` for `undefined`, o template string interpola para literal `"Bearer undefined"`. Um atacante que envie `Authorization: Bearer undefined` **passa**. Em Node, `process.env.VAR_AUSENTE === undefined`, e `` `Bearer ${undefined}` === 'Bearer undefined' ``. Bypass determinístico condicionado à ausência da env.

### Ação B — VPS (AGUARDANDO INPUT DO USUÁRIO)

Bloco reservado para o usuário executar manualmente:

```
ssh root@vmi2884668
cd /root/axis-tcc
printenv | grep -i cron_secret
# ou: cat .env.production | grep -i cron_secret
```

**Formato esperado de retorno (não transcrever valor real):**

- `CRON_SECRET` no VPS: **[PRESENTE / VAZIO / AUSENTE]**

Se **PRESENTE**, o bypass de `reminders` é bloqueado (`cronSecret && ...` vira truthy) mas `renew-webhook` continua dependente da string literal — mantém ok. `scan-integrity` continua ok sempre.

Se **VAZIO/AUSENTE**, `reminders` fica **100 % aberto** (invocação externa inicia jobs) e `renew-webhook` é bypassável com `Bearer undefined`. `scan-integrity` retorna 401 sempre (fail-closed).

### Observações

- As 3 rotas compartilham o padrão "Bearer X" mas **divergem na checagem de ausência**. Isso é exatamente o smell clássico de H-1 v1.
- Impacto real de `reminders` aberto: `processScheduledReminders()` processa lembretes de pacientes — se invocado sem auth, pode ser usado como oráculo de enumeração (ver quantos lembretes/resposta) e para flood.
- Impacto de `renew-webhook` bypassado: atacante aciona renovação de canais Google Calendar em loop, queimando quota + gerando eventos `watch` arbitrários.

---

## CHECK 4 — `app.is_worker` como bypass RLS universal (Tier 1)

- **Veredito:** **PARCIALMENTE CONFIRMADO** — backdoor existe e é real, mas **SET é EXCLUSIVO** do worker de transcrição. Não há outra rota/script que escreva o GUC.
- **Severidade confirmada:** **P1 — Tier 1** (monitorar / documentar / fence). Não descalonar para P2 porque o bypass é estruturalmente universal (afeta RLS sistêmica) e qualquer SET futuro em lugar errado é catastrófico.

### Comando literal

```
rg -n "is_worker" --type ts --type sql --type tsx
```

(executado via Grep — `!node_modules/**`)

### Tabela de ocorrências

| Arquivo | Linha | Tipo | Trecho literal |
|---|---|---|---|
| `scripts/workers/transcription-worker.ts` | 95 | **SET** | `await client.query("SELECT set_config('app.is_worker', 'true', true)")` |
| `scripts/migrations/046_worker_rls_policy.sql` | 10 | COMMENT | `-- app.is_worker = 'true'. Apenas o processo worker seta isso.` |
| `scripts/migrations/046_worker_rls_policy.sql` | 20 | **POLICY** | `USING (current_setting('app.is_worker', true) = 'true')` |
| `scripts/migrations/046_worker_rls_policy.sql` | 21 | **POLICY** | `WITH CHECK (current_setting('app.is_worker', true) = 'true')` |
| `src/tests/operadora-guc-contract.test.ts` | 16 | COMMENT | `*      GUCs permitidos (tenant_id, is_worker, worker_mode).` |
| `src/tests/operadora-guc-contract.test.ts` | 31 | COMMENT | `//   - 'app.is_worker'   → setado por jobs async (ex: transcription-worker)` |
| `src/tests/operadora-guc-contract.test.ts` | 33 | ALLOWLIST (teste) | `const ALLOWED_GUCS = new Set(['app.tenant_id', 'app.is_worker', 'app.worker_mode'])` |
| `docs/audits/cc_auditoria_v1.md` | 39, 310, 313, 319, 326, 458, 494 | COMMENT (docs) | — (texto do próprio achado) |
| `docs/audits/cc_auditoria_v2.md` | 405, 447 | COMMENT (docs) | — (texto do próprio achado) |

### Classificação consolidada

- **SET** (escrita): **1 único ponto** → `scripts/workers/transcription-worker.ts:95`. Usa `set_config(..., true)` — o 3º parâmetro `true` = `is_local`, ou seja, **restrito à transação corrente**. Isso limita escopo temporal.
- **READ/POLICY**: `scripts/migrations/046_worker_rls_policy.sql` — a policy `worker_access` na tabela `transcription_jobs` libera `SELECT/UPDATE` quando o GUC for `'true'`. **Não filtra `tenant_id`** — é exatamente o bypass universal descrito em A-1.
- **COMMENT/ALLOWLIST**: test defensivo (`operadora-guc-contract.test.ts`) + docs. Nenhuma escrita de produção.

### Observações

- O teste de contrato `operadora-guc-contract.test.ts` **permite** `app.is_worker` como GUC legítimo (linha 33) — ele não vai flagrar usos indevidos, só bloqueia GUCs fora do trio `tenant_id/is_worker/worker_mode`. **Não é uma salvaguarda anti-expansão.**
- O SET usa `set_config(..., true)` (transação-local). Isso significa:
  - **Pró:** se um pool connection volta ao pool com `is_worker='true'` setado, o próximo uso da conexão **não herda** (o GUC expira ao commit/rollback da transação).
  - **Contra:** dentro da mesma transação, qualquer query posterior tem bypass. Se o worker abrir transação e fizer query cross-tenant acidentalmente (bug), vaza.
- Policy `worker_access` só existe em `transcription_jobs` (por migration 046). Outras tabelas não têm essa porta — então o bypass é **escoped** ao job queue, não universal globalmente. A auditoria v1 A-1 descreveu como "bypass RLS universal" — isso é **exagero**: o bypass só se aplica a tabelas com policy que leia `app.is_worker`. **Hoje: só `transcription_jobs`.**
- **Ainda assim P1** porque: (a) se alguém adicionar policy similar em outra tabela futura, e (b) se um endpoint HTTP acidentalmente setar esse GUC (hoje ninguém faz), o blast radius é por-tabela-com-policy.

---

## CHECK 5 — `/api/escola/[token]` ordem invertida (Tier 1)

> **[ATUALIZAÇÃO 29/04/2026 — RESOLVIDO]**
> Bug descrito abaixo foi resolvido pelos patches v3 dos portais (commit `9c99182`).
> Padrão Caminho 2 (`BEGIN` + `set_config('app.tenant_id', $1, true)` + `COMMIT`)
> implementado em ambos os portais família e escola, em 2 pontos cada
> (validateToken + GET handler com Promise.all + access_log).
> Validação empírica: SHA família `92258502...`, escola `1b15011c33...`.
> Conteúdo abaixo preservado como referência histórica do bug original.

- **Veredito:** **CONFIRMADO ordem invertida** — `app.tenant_id` é setado como **string vazia ANTES** do token ser validado, e a primeira query RLS-dependente roda **dentro** desse contexto tenant-less.
- **Severidade confirmada:** **P1 — Tier 1** (potencial P0 dependendo da policy real da tabela `tdah_teacher_tokens` — precisa runtime check para confirmar se string vazia é fail-open ou fail-closed na policy)

### Evidência literal — `app/api/escola/[token]/route.ts` (linhas 20–55, 57–80)

```ts
20  async function validateToken(token: string) {
21    const client = await pool.connect()
22    try {
23      await client.query("SET LOCAL app.tenant_id = ''")
24
25      const res = await client.query(
26        `SELECT t.*, p.name as patient_name, p.birth_date,
27          p.school_name as patient_school, p.status as patient_status
28        FROM tdah_teacher_tokens t
29        JOIN tdah_patients p ON p.id = t.patient_id AND p.tenant_id = t.tenant_id
30        WHERE t.token = $1 AND t.is_active = true`,
31        [token]
32      )
33
34      if (res.rows.length === 0) {
35        return null
36      }
37
38      const tokenData = res.rows[0]
39
40      // Verificar expiração
41      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
42        return null
43      }
44
45      // Atualizar last_used_at
46      await client.query(
47        'UPDATE tdah_teacher_tokens SET last_used_at = NOW() WHERE id = $1',
48        [tokenData.id]
49      )
50
51      return tokenData
52    } finally {
53      client.release()
54    }
55  }
```

```ts
57  export async function GET(
58    request: NextRequest,
59    { params }: { params: Promise<{ token: string }> }
60  ) {
61    try {
62      const blocked = await rateLimit(request, PORTAL_RATE_LIMIT)
63      if (blocked) return blocked
64
65      const { token } = await params
66
67      if (!/^[a-f0-9]{64}$/i.test(token)) {
68        return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
69      }
70
71      const tokenData = await validateToken(token)
72
73      if (!tokenData) {
74        return NextResponse.json(
75          { error: 'Token inválido, expirado ou revogado' },
76          { status: 401 }
77        )
78      }
```

### Fluxo numerado

1. **Rate-limit + format-check** do token (linhas 62–69) — sem tocar em DB.
2. **`app.tenant_id = ''`** setado via `SET LOCAL` (linha 23) → **ANTES** da 1ª query.
3. **1ª query RLS-dependente** (linhas 25–32) — `SELECT ... FROM tdah_teacher_tokens JOIN tdah_patients ... WHERE t.token = $1`. Esta query é quem revela o `tenant_id` do paciente, mas roda com GUC **vazio**.
4. **Validação** do token (checa `.rows.length === 0` linha 34, `expires_at` linha 41) — **depois** da query.
5. **UPDATE** em `tdah_teacher_tokens` (linha 47) — ainda no contexto `app.tenant_id = ''`.
6. **Retorno para o handler principal** (linha 71), que abre **NOVA conexão do pool** (linha 80) → essa conexão **não tem SET nenhum** (o SET LOCAL da função `validateToken` morreu no `client.release`). As 3 queries em Promise.all (protocols/drcs/drcSummary) usam filtro explícito `tenant_id = $2`, mas `app.tenant_id` da conexão é estado herdado do pool — pode ser qualquer coisa de uma request anterior.

### Observações

- **Confirma v1 D-1 ao pé da letra**: o padrão "`SET app.tenant_id = ''` antes de resolver o tenant" é exatamente o antipadrão flagrado. A justificativa na v1 era "token é public, precisa ler sem saber tenant" — solução correta seria usar **connection com RLS BYPASSED** (superuser ou policy pública específica) ou **excluir a tabela de RLS**, não setar GUC vazio.
- **Risco real depende da policy RLS** de `tdah_teacher_tokens`:
  - Se a policy usar `current_setting('app.tenant_id', true) = tenant_id::text`, então `''` **nunca casa** → SELECT retornaria 0 rows → portal estaria quebrado em produção (o que **não** é o caso, então presumivelmente a policy tem exceção para string vazia, ou a tabela está sem RLS).
  - **INCONCLUSIVO quanto ao comportamento exato da policy** sem inspeção do SQL atual do banco (precisa `\d+ tdah_teacher_tokens` no VPS ou leitura da migration que cria a tabela).
- **Risco de herança de GUC no pool**: as queries no handler principal (linhas 83–120) filtram por `tenant_id` explicitamente na WHERE, o que **mitiga** vazamento horizontal *se* houver bug adicional onde RLS está ativa. Porém, isso é "defesa por filtro explícito" — se qualquer desenvolvedor futuro remover o `tenant_id = $2` confiando em RLS, vaza, porque RLS está efetivamente "desligada" nessa rota.

---

## RESUMO

### Tabela consolidada

| Check | Achado v1/v2 | Status | Severidade final | Ação recomendada |
|---|---|---|---|---|
| 1 | v2 F-1 — Sentry PII | **CONFIRMADO** | **P0 / Tier 0** | Desligar `sendDefaultPii`, Replay, `enableLogs`, baixar `tracesSampleRate` para ≤0.1. Avaliar região EU do DSN. Adicionar `beforeSend` com scrubbing. |
| 2 | v1 H-2 — Matcher malformado | **CONFIRMADO sintaxe / tolerado em runtime** | **P1 / Tier 1** | Corrigir linha 57 de `middleware.ts`: `'/(api|trpc)(.*)'` (remover `)` extra). Validar com `next build` pós-fix. |
| 3A | v1 H-1 — CRON_SECRET bypass | **CONFIRMADO** (2 de 3 rotas) | **P1 / Tier 1** (vira P0 se VPS sem env) | Padronizar guarda `!cronSecret || authHeader !== ...` nas 3 rotas. Usar `timingSafeEqual`. CI gate para env obrigatória. |
| 3B | v1 H-1 — CRON_SECRET no VPS | **AGUARDANDO INPUT DO USUÁRIO** | — | Rodar `printenv \| grep -i cron_secret` no VPS e reportar PRESENTE/VAZIO/AUSENTE. |
| 4 | v1 A-1 — `app.is_worker` bypass | **PARCIALMENTE CONFIRMADO** | **P1 / Tier 1** (monitor) | Documentar backdoor no `worker_access` policy. Adicionar lint/test que falhe se `is_worker` for setado fora de `scripts/workers/`. Reescopar policy para filtrar também `tenant_id`. |
| 5 | v1 D-1 — `/api/escola/[token]` ordem invertida | **CONFIRMADO** (comportamento exato da policy INCONCLUSIVO sem runtime) | **P1 / Tier 1** | Trocar `SET LOCAL app.tenant_id = ''` por conexão com role que bypass RLS **apenas** na query de lookup do token, ou criar policy RLS-exempt explícita. Re-SET `app.tenant_id` com valor real após validar. |

### Recomendação de plano de correção

**Tier 0 (antes de qualquer deploy):**
- C1 (Sentry PII) — único achado com exfiltração ativa de dados clínicos em produção.

**Tier 1 (sprint corrente):**
- C3 (CRON_SECRET) — completar após input VPS. Se VPS sem env → promove para Tier 0.
- C5 (escola[token]) — re-arquitetar validação de token pré-RLS.
- C2 (matcher) — fix trivial, baixo risco, alto valor (blinda upgrade futuro do Next).
- C4 (is_worker) — documentar + adicionar gate de CI.

### Blocos informativos

- **VPS não foi tocado** nesta validação (Check 3 Ação B suspensa por solicitação do usuário).
- **`next build` não foi executado** (binário ausente no sandbox). Check 2 validado via análise literal do regex.
- **Nenhum arquivo do repo foi modificado** exceto este relatório (`docs/audits/validacao_tier0_tier1.md`).
- **Nada foi ampliado além do escopo dos 5 checks.**

---

*Fim do relatório.*
