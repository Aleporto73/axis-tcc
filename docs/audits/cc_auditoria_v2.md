# AXIS — Auditoria Técnica Read-Only v2

**Data:** 2026-04-23
**Escopo:** **F** (Frontend/SSR-CSR), **G** (Testes/coverage), **H** (Infra/CI/deploy)
**Explicitamente fora do escopo:** áreas A–E — já cobertas em `cc_auditoria_v1.md`.
**Modo:** leitura apenas — nenhum patch, refactor, build, teste ou commit.
**Repo:** `C:\Users\evera\Documents\axis-tcc` (workdir `/root/axis-tcc`)

Cada achado traz: **Problema · Evidência (arquivo + trecho literal) · Base · Impacto · Severidade · Classificação · Condição de exploração**.

- **Base:** `EVIDÊNCIA DIRETA` (trecho literal confirma) · `INFERÊNCIA` (dedução por leitura cruzada)
- **Classificação:** `CONFIRMADO` · `PROVÁVEL` · `PRECISA VALIDAÇÃO`
- **Severidade:** P0 (crítico) · P1 (alto) · P2 (médio) · P3 (baixo)

---

## 0. Sumário executivo

| # | Severidade | Bloco | Área | Título | Classificação |
|---|---|---|---|---|---|
| F-1 | **P0** | HUB | F | `sendDefaultPii: true` no Sentry server+edge+client — envio de PII clínica a terceiros | CONFIRMADO |
| F-2 | P1 | HUB | F | `replaysSessionSampleRate: 0.1` + `sendDefaultPii: true` = vídeos de tela com dados clínicos vão para Sentry | CONFIRMADO |
| F-3 | P1 | HUB | F | `tracesSampleRate: 1` em três arquivos Sentry (100% trace) — custo + dados sensíveis em transações | CONFIRMADO |
| F-4 | P1 | HUB | F | Firebase `apiKey` + `projectId` hardcoded em **quatro** lugares, inclusive com VAPID fake em `src/lib/firebase.ts` | CONFIRMADO |
| F-5 | P1 | HUB | F | `app/error.tsx` NÃO captura erro no Sentry (só `console.error`); `ErrorBoundary.tsx` também não | CONFIRMADO |
| F-6 | P1 | ABA | F | Layouts ABA/TDAH usam `pool.query` direto (sem `withTenant`) para checar licença + logar acesso | CONFIRMADO |
| F-7 | P2 | HUB | F | `app/admin/page.tsx` renderiza UI antes de validar `isAdmin` (flash visível) | CONFIRMADO |
| F-8 | P2 | HUB | F | `new Date()` em server components (dashboard, sessoes) sem `suppressHydrationWarning` | CONFIRMADO |
| F-9 | P2 | HUB | F | `router.push(data.redirect)` em `hub/page.tsx` — redirect controlado por response do backend sem whitelist | CONFIRMADO |
| F-10 | P2 | ABA | F | `app/aba/aprendizes/[id]/page.tsx.bak` commitado apesar de `.gitignore` listar `*.bak` | CONFIRMADO |
| F-11 | P2 | HUB | F | `app/lib/firebase.ts` e `src/lib/firebase.ts` duplicados com implementações divergentes (env vs hardcoded) | CONFIRMADO |
| F-12 | P2 | HUB | F | `src/lib/firebase.ts` tem `console.log('FCM Token obtido:', token)` vazando token em DevTools | CONFIRMADO |
| F-13 | P2 | HUB | F | `console.error`/`console.warn` espalhados em 13+ componentes client — vazamento de info em prod | CONFIRMADO |
| G-1 | **P0** | HUB | G | Zero testes cobrindo `/api/webhook/hotmart`, `/api/webhook/clerk`, `/api/cron/*`, `/api/admin/*`, `/api/transcribe*` | CONFIRMADO |
| G-2 | P1 | HUB | G | CI **não roda** Playwright (e2e) — `test:e2e` só existe como script local | CONFIRMADO |
| G-3 | P1 | HUB | G | CI não tem coverage threshold; vitest-config tem `coverage` mas nada exige mínimo | CONFIRMADO |
| G-4 | P1 | HUB | G | Todos os testes são unitários com `vi.mock('@/src/database/db')` — zero testes de integração/RLS real | CONFIRMADO |
| G-5 | P1 | TDAH | G | `tdah-isolation.test.ts` **documenta em teste** o bug do fallback `OR created_by` como se fosse feature, não bug | CONFIRMADO |
| G-6 | P2 | HUB | G | Vitest include cobre `scripts/` mas vitest.config **exclui** `scripts` — workers nunca testados | CONFIRMADO |
| G-7 | P2 | TCC | G | `tcc-isolation.test.ts` tem 4 testes "para uso futuro" / "para expansão" — dead tests | CONFIRMADO |
| H-1 | **P0** | HUB | H | Nenhum security header no app (sem CSP, HSTS, X-Frame-Options, Referrer-Policy) | CONFIRMADO |
| H-2 | **P0** | HUB | H | Zero `Dockerfile`; `docker-compose.yml` é só Postgres+Redis — deploy é "git pull + pm2 restart" | CONFIRMADO |
| H-3 | P1 | HUB | H | `package.json` sem `engines` (versão Node não pinada); tsconfig usa `target: ES2020` mas CI usa Node 22 | CONFIRMADO |
| H-4 | P1 | HUB | H | `ecosystem.config.cjs` roda worker com `npx tsx` em produção (resolução+compile a cada cold-start) | CONFIRMADO |
| H-5 | P1 | HUB | H | CI build recebe `CLERK_SECRET_KEY: "sk_test_placeholder"` — build pode inlinar placeholder no bundle | CONFIRMADO |
| H-6 | P1 | HUB | H | Sentry DSN hardcoded em `.ts` committed (não é segredo, mas é config de ambiente) | CONFIRMADO |
| H-7 | P2 | HUB | H | `tunnelRoute: "/monitoring"` em next.config — rota não listada como pública no middleware | PRECISA VALIDAÇÃO |
| H-8 | P2 | HUB | H | Sem CI stage que rode `npx tsc --noEmit` em `scripts/` (eslint.config ignora `scripts/**`) | CONFIRMADO |
| H-9 | P2 | HUB | H | Dois scripts de backup concorrentes (`backup.sh` Docker + `backup-postgres.sh` pg_dump) podem rodar sobrepostos se ambos no cron | CONFIRMADO |
| H-10 | P2 | HUB | H | `backup.sh` fixa `BACKUP_DIR=/root/backups` e `DOCKER_CONTAINER=axis-postgres` hardcoded | CONFIRMADO |
| H-11 | P3 | HUB | H | Husky `pre-commit` só valida migrations; não roda `typecheck`/`lint` | CONFIRMADO |

**Totais:** 30 achados · **3 P0 · 13 P1 · 13 P2 · 1 P3**

---

## 1. Bloco F — Frontend / SSR-CSR / hidratação

### F-1 — Sentry `sendDefaultPii: true` em todos os runtimes

- **Bloco:** HUB · **Área:** F
- **Problema:** envio de PII do usuário a Sentry habilitado em server, edge e client — em plataforma clínica sujeita a LGPD.
- **Evidência:**

```ts
// sentry.server.config.ts
Sentry.init({
  dsn: "https://d08fb0a21eb8ba3e0dca74b16f9134a0@o4511070995742720.ingest.us.sentry.io/4511071001182208",
  tracesSampleRate: 1,
  enableLogs: true,
  sendDefaultPii: true,
});
```

Idêntico em `sentry.edge.config.ts` e `instrumentation-client.ts`.
- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** Sentry recebe headers, URLs (que carregam IDs clínicos), IPs e, pelo fluxo do Next.js, campos de usuário automaticamente. Para uma base clínica (dados de saúde — art. 11 LGPD), isso é **transbordo internacional de dado sensível a processador terceiro sem consentimento específico**. Risco regulatório direto.
- **Severidade:** **P0**
- **Classificação:** CONFIRMADO
- **Condição de exploração:** nenhuma — o dado está sendo enviado agora, a cada erro/trace.

---

### F-2 — Sentry Replay capturando 10% das sessões com PII

- **Bloco:** HUB · **Área:** F
- **Problema:** `Sentry.replayIntegration()` ativo + `replaysSessionSampleRate: 0.1` + `replaysOnErrorSampleRate: 1.0`: 10% das sessões regulares e 100% das sessões com erro gravam vídeo da UI.
- **Evidência:** `instrumentation-client.ts`:

```ts
integrations: [Sentry.replayIntegration()],
tracesSampleRate: 1,
replaysSessionSampleRate: 0.1,
replaysOnErrorSampleRate: 1.0,
sendDefaultPii: true,
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** Sentry recebe vídeo da tela com campos de formulário, transcrições, scores CSO e dados de paciente. Sentry Replay mascara apenas inputs `type="password"` por default; campos `text` com CPF/CRP, textarea de anamnese, relatório de sessão — **tudo não mascarado**.
- **Severidade:** P1 (rebaixado de P0 por depender de config de mask remoto, mas amplifica F-1)
- **Classificação:** CONFIRMADO

---

### F-3 — `tracesSampleRate: 1` (100%)

- **Bloco:** HUB · **Área:** F
- **Problema:** 100% de sampling de traces em todas as runtimes.
- **Evidência:** `grep -n "tracesSampleRate" sentry.*.config.ts instrumentation-client.ts` retorna:

```
sentry.edge.config.ts:12:  tracesSampleRate: 1,
sentry.server.config.ts:11:  tracesSampleRate: 1,
instrumentation-client.ts:16:  tracesSampleRate: 1,
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** custo Sentry escala linearmente com tráfego; combina com F-1/F-2 para transbordo massivo de telemetria com PII. Em prod, a recomendação da própria Sentry é 0.1–0.2.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### F-4 — Firebase config hardcoded em 4 arquivos (e VAPID fake em um)

- **Bloco:** HUB · **Área:** F
- **Problema:** o mesmo bloco Firebase está duplicado em quatro lugares, e um deles tem um VAPID key que **parece truncado/fake** (`'BLBz5OvYnMqGM3xPQnZPMONlJxAYxYwKxPQnZPMONlJxAYxYwKx'`).
- **Evidência:**
  1. `app/lib/firebase.ts` — via `process.env.NEXT_PUBLIC_FIREBASE_*` (caminho correto).
  2. `src/lib/firebase.ts` — **hardcoded** + `vapidKey: 'BLBz5OvYnMqGM3xPQnZPMONlJxAYxYwKxPQnZPMONlJxAYxYwKx'`.
  3. `app/components/PushNotificationSetup.tsx` — hardcoded dentro de `requestPermission`.
  4. `app/ativar-lembretes/page.tsx` — hardcoded em `handleActivate`.
  5. `public/firebase-messaging-sw.js` — hardcoded (service worker; ok estar exposto, mas sem fonte única).

Trecho `src/lib/firebase.ts`:

```ts
const firebaseConfig = {
  apiKey: "AIzaSyCl15IE6pCSWywO-4IiPX0QtLqy4BiXL4E",
  authDomain: "axis-tcc.firebaseapp.com",
  projectId: "axis-tcc",
  ...
};
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** drift de config inevitável; trocar projeto Firebase exige quatro edições. O `vapidKey` fake em `src/lib/firebase.ts` é silent-bug: qualquer import desse módulo recebe token com VAPID inválido.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### F-5 — `app/error.tsx` e `ErrorBoundary.tsx` não capturam para Sentry

- **Bloco:** HUB · **Área:** F
- **Problema:** `app/error.tsx` só faz `console.error`; `ErrorBoundary.tsx` (classe-componente) só loga. Apenas `app/global-error.tsx` chama `Sentry.captureException`.
- **Evidência:**

```ts
// app/error.tsx
useEffect(() => {
  console.error('Erro na aplicação:', error)
}, [error])
```

```ts
// app/components/ErrorBoundary.tsx
componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
  console.error('[AXIS ErrorBoundary]', error, errorInfo.componentStack)
}
```

Confirmação: `grep -n "Sentry\|captureException" app/error.tsx app/components/ErrorBoundary.tsx` retorna vazio.

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** erros de rota (error.tsx) e de árvore React (ErrorBoundary) **não chegam** ao Sentry. Dada a presença intensiva do Sentry (F-1/2/3), esse é um gap de observabilidade incoerente.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### F-6 — Layouts ABA/TDAH usam `pool.query` direto em SSR

- **Bloco:** ABA / TDAH · **Área:** F (SSR) / B (isolamento) — listado aqui por ser Server Component.
- **Problema:** `app/aba/layout.tsx` e `app/tdah/layout.tsx` fazem `pool.query(...)` direto para resolver tenant e licença, fora de `withTenant`.
- **Evidência:** `app/aba/layout.tsx`:

```ts
const tenantResult = await pool.query(
  'SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
  [userId]
)
tenantId = tenantResult.rows[0]?.id || null
```

E também:

```ts
await pool.query(
  `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at) ...`,
  [tenantId, userId, JSON.stringify({ module: 'aba', reason })]
)
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** mesma raiz dos bugs de 31/03 (v1 relatou em T-1/T-2): resolução manual de tenant ignora cookie `axis_active_tenant` e usuário com múltiplos tenants enxerga o errado em SSR. Também insere `axis_audit_logs` sem `app.tenant_id` setado → a policy RLS de `axis_audit_logs` (se existir) pode bloquear.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### F-7 — `app/admin/page.tsx` renderiza antes de validar admin

- **Bloco:** HUB · **Área:** F
- **Problema:** página marcada `'use client'`; o check `isAdmin` acontece em `useEffect`. Entre o mount e o fetch, a UI pode piscar conteúdo sensível.
- **Evidência:** `app/admin/page.tsx`:

```ts
const [isAdmin, setIsAdmin] = useState(false);
...
useEffect(() => {
  const load = async () => {
    const tenantRes = await fetch('/api/user/tenant');
    const tenantData = await tenantRes.json();
    if (!tenantData.isAdmin) {
      router.push('/dashboard');
      return;
    }
    setIsAdmin(true);
    ...
  };
  load();
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** "flash of unauthorized content" se renderização inicial já incluir partes do admin shell. Dados `/api/admin/tenants` ainda são protegidos no backend, mas esse padrão cheira a bug — e combina com H-4 do v1 (3 critérios diferentes de admin).
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

### F-8 — `new Date()` em páginas SSR/CSR mistas sem `suppressHydrationWarning`

- **Bloco:** HUB · **Área:** F
- **Problema:** `new Date()` / `Date.now()` usado dentro de componentes que podem ser pré-renderizados (ex.: `app/dashboard/page.tsx` mostra `new Date().toLocaleDateString('pt-BR', {...})` inline no JSX).
- **Evidência:** `app/dashboard/page.tsx`:

```tsx
{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
```

Mesmo padrão em `app/sessoes/page.tsx` e `app/components/CoverageProfilesManager.tsx`.

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** se rota for SSG/ISR pré-renderizada (sem `force-dynamic`), timestamp do servidor e do cliente divergem → hydration mismatch. `dashboard/page.tsx` tem `'use client'`, então SSR produz o HTML inicial com uma data e o cliente re-renderiza com outra — warning e potencial flash.
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

### F-9 — `router.push(data.redirect)` sem validação de destino

- **Bloco:** HUB · **Área:** F
- **Problema:** `app/hub/page.tsx` lê `data.redirect` do backend e faz `router.push(data.redirect)` sem whitelist.
- **Evidência:**

```ts
if (res.ok && data.redirect) {
  router.push(data.redirect)
} else if (res.status === 409 && data.redirect) {
  router.push(data.redirect)
}
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** se algum dia `/api/user/activate-free` for comprometido ou refatorado para receber `redirect` do usuário, vira open-redirect. Hoje o backend hardcoda `DASHBOARD_PATH[productType]`, então risco é dependência futura.
- **Severidade:** P2
- **Classificação:** CONFIRMADO (estrutural)

---

### F-10 — `page.tsx.bak` commitado

- **Bloco:** ABA · **Área:** F
- **Problema:** `app/aba/aprendizes/[id]/page.tsx.bak` existe e é rastreado pelo git, apesar de `.gitignore` listar `*.bak`.
- **Evidência:** `ls` retorna o arquivo com permissões `-rwx------`; `grep "\\.bak" .gitignore` retorna `*.bak`.
- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** conteúdo legado visível em `git log` / GitHub; pode divergir da versão viva e confundir leitura. ESLint também foi configurado para ignorar essas rotas específicas.
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

### F-11 — Duplicidade `app/lib/firebase.ts` vs `src/lib/firebase.ts`

- **Bloco:** HUB · **Área:** F
- **Problema:** duas implementações `firebase.ts` coexistem: `app/lib/firebase.ts` usa env vars; `src/lib/firebase.ts` hardcoda e tem VAPID fake.
- **Evidência:** `ls app/lib/ src/lib/` confirma ambos; conteúdos divergem substancialmente.
- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** imports ambíguos (`@/app/lib/firebase` vs `@/src/lib/firebase`) → bugs silenciosos conforme qual caminho foi importado. O ESLint `boundaries` não cobre essa duplicação.
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

### F-12 — `console.log('FCM Token obtido:', token)` em produção

- **Bloco:** HUB · **Área:** F
- **Problema:** `src/lib/firebase.ts` loga o token FCM em claro.
- **Evidência:**

```ts
console.log('FCM Token obtido:', token);
return token;
```

E também:

```ts
onMessage(msg, (payload) => {
  console.log('Mensagem em foreground:', payload);
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** token FCM é suficiente para entregar push notifications arbitrárias àquele dispositivo. Visível em DevTools do usuário, logs do Sentry (por `enableLogs: true`) e análises de telemetria.
- **Severidade:** P2 (token é de sessão, escopo limitado)
- **Classificação:** CONFIRMADO

---

### F-13 — `console.error`/`console.warn` leftover em componentes de produção

- **Bloco:** HUB · **Área:** F
- **Problema:** 13+ componentes client ainda logam erros via `console.*` em vez de roteá-los ao Sentry.
- **Evidência:** `grep -rn "console\\." app/components/ app/hooks/` retorna 13 hits; exemplos: `OnboardingABA.tsx`, `OnboardingTCC.tsx`, `OnboardingTDAH.tsx`, `CaseBaseForm.tsx`, `EvolutionReport.tsx`, `ClinicalReport.tsx`, `RoleProvider.tsx`, `PushNotificationSetup.tsx`, `ErrorBoundary.tsx`.
- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** erros não chegam ao Sentry (exceto via `global-error.tsx`). DevTools mostra mensagens em português prefixadas que podem vazar contexto interno.
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

## 2. Bloco G — Testes / cobertura

### G-1 — Zero testes em rotas críticas externas

- **Bloco:** HUB · **Área:** G
- **Problema:** **nenhum** teste cobre `/api/webhook/hotmart`, `/api/webhook/clerk`, `/api/cron/reminders`, `/api/cron/scan-integrity`, `/api/cron/renew-webhook`, `/api/admin/*`, `/api/transcribe`, `/api/transcribe-audio`, `/api/analyze-tcc`, `/api/patient/push/authorize`, `/api/sessions/[id]/finish`.
- **Evidência:** `grep -rn "hotmart\\|'/webhook\\|cron\\|/api/admin\\|analyze-tcc\\|transcribe-audio\\|escola\\|familia" src/tests/` retorna apenas match em `authorization.test.ts:453` (comentário) e `tdah-schema-contract.test.ts` (apenas lê string do arquivo para checar schema). Nenhum invoca handler real.
- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** justamente os endpoints que a v1 identificou como P0/P1 (auth bypass em cron reminders, auto-provisioning Hotmart, rota legada de transcribe) **nunca** foram exercitados por teste automatizado. Regressão silenciosa a cada deploy.
- **Severidade:** **P0** (para a pirâmide de testes; operacional)
- **Classificação:** CONFIRMADO

---

### G-2 — CI não roda Playwright

- **Bloco:** HUB · **Área:** G
- **Problema:** `.github/workflows/ci.yml` executa `npx vitest run --exclude='e2e/**'` e nada mais. Playwright só é invocável localmente via `npm run test:e2e`.
- **Evidência:** `grep -n "playwright\\|e2e\\|test:e2e" .github/workflows/ci.yml` retorna:

```
47:      - run: npx vitest run --exclude='e2e/**'
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** único teste integrado (629 LOC em `e2e/tdah-flow.spec.ts`) roda apenas se um humano o invocar com `E2E_CLERK_EMAIL`/`E2E_CLERK_PASSWORD`. Hoje, na prática, é shelfware.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### G-3 — Sem coverage threshold

- **Bloco:** HUB · **Área:** G
- **Problema:** `vitest.config.ts` configura `coverage` mas não exige threshold mínimo; CI também não roda coverage.
- **Evidência:** `vitest.config.ts`:

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "html", "lcov"],
  reportsDirectory: "./coverage",
  include: ["src/**/*.ts", "app/**/*.ts"],
  exclude: ["node_modules", ".next", "**/*.test.ts", "**/*.spec.ts", "**/*.d.ts"],
},
```

Sem `thresholds`. CI step: `npx vitest run --exclude='e2e/**'` — coverage nunca disparado.

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** ninguém vê o % de cobertura nem na PR nem em dashboard. Seção de regras conforme CLAUDE.md exige rastreabilidade clínica mas não há métrica.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### G-4 — Todos os testes são unitários com `vi.mock('@/src/database/db')`

- **Bloco:** HUB · **Área:** G
- **Problema:** nenhum teste exercita RLS real. Todos mockam o `pool`.
- **Evidência:** `grep -rn "vi.mock('@/src/database/db')" src/tests/` retorna em `authorization.test.ts`, `tcc-isolation.test.ts`, `tdah-isolation.test.ts`. Nenhum `postgres://` de serviço no CI (apenas `DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder"` em build).
- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** o sistema é fortemente dependente de RLS (`app.tenant_id`, `app.is_worker`, policies `worker_access` em migration 046). **Zero testes rodam contra um Postgres real**, então regressões em policy SQL só explodem em produção.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### G-5 — `tdah-isolation.test.ts` valida o **fallback `created_by` como feature**

- **Bloco:** TDAH · **Área:** G
- **Problema:** o próprio teste confirma que terapeuta acessa paciente por `created_by` mesmo sem vínculo em `tdah_patient_therapists` — isto é, o bug D-3 do v1 está blindado por teste, dificultando correção futura.
- **Evidência:** `src/tests/tdah-isolation.test.ts`:

```
76: test('Terapeuta acessa paciente via fallback created_by (pré-migration-038)', async () => {
247: test('canAccessTdahPatient inclui UNION ALL para cobrir created_by', async () => {
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** se engenheiro tentar remover o fallback para fechar o bug do v1 (D-3), dois testes quebram e parecem indicar regressão. Teste virou especificação obsoleta.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### G-6 — Workers nunca cobertos (vitest exclui `scripts`)

- **Bloco:** HUB · **Área:** G
- **Problema:** `vitest.config.ts` tem `exclude: ["node_modules", ".next", "dist", "scripts", "docs"]`. Mas o worker crítico está em `scripts/workers/transcription-worker.ts`.
- **Evidência:**

```ts
// vitest.config.ts
exclude: [
  "node_modules",
  ".next",
  "dist",
  "scripts",
  "docs",
],
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** o worker que usa `app.is_worker='true'` para bypassar RLS (v1 A-1) nunca recebe teste automatizado. Heartbeat recovery, dedupe, cross-tenant — tudo não testado.
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

### G-7 — Testes "para uso futuro" em `tcc-isolation.test.ts`

- **Bloco:** TCC · **Área:** G
- **Problema:** 4 testes em `tcc-isolation.test.ts` só validam que helpers "estão disponíveis para uso futuro":

```
383: test('TenantContext já suporta campo role com tipos corretos', ...)
392: test('requireRole está disponível para uso futuro em rotas TCC', ...)
400: test('handleRouteError detecta RoleError para futura expansão TCC', ...)
409: test('PlanGateError está disponível para gate de features TCC', ...)
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** inflam a contagem sem testar comportamento real. Sinalizam que a suite foi montada antes do código.
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

## 3. Bloco H — Infra / CI / deploy

### H-1 — Nenhum security header

- **Bloco:** HUB · **Área:** H
- **Problema:** `next.config.ts` não define `headers()`. Middleware apenas injeta `x-pathname`. Não há `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy` nem `Permissions-Policy`.
- **Evidência:**

```ts
// next.config.ts completo
const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
    proxyClientMaxBodySize: '50mb',
  },
}
```

`grep -n "headers" middleware.ts` retorna apenas `requestHeaders = new Headers(req.headers)` — manipulação de request, não response.

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** sem CSP, clickjacking possível (falta de `X-Frame-Options`/`frame-ancestors`); sem HSTS, downgrade de HTTPS; sem Permissions-Policy, toda API do navegador disponível em iframes. Risco de clinical data exfiltration via XSS é maior.
- **Severidade:** **P0** (plataforma clínica pública na internet)
- **Classificação:** CONFIRMADO

---

### H-2 — Sem Dockerfile; deploy é manual em VPS

- **Bloco:** HUB · **Área:** H
- **Problema:** `find . -maxdepth 4 -name "Dockerfile*"` retorna vazio. `docker-compose.yml` orquestra apenas Postgres e Redis. O app roda via PM2 direto em `/root/axis-tcc`.
- **Evidência:** `ecosystem.config.cjs`:

```js
{
  name: 'axis-tcc',
  script: 'node_modules/next/dist/bin/next',
  args: 'start',
  cwd: '/root/axis-tcc',
  ...
}
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** rollback só por `git checkout` + `pm2 restart`; sem reprodutibilidade de build; sem isolamento de sistema operacional; qualquer divergência entre `/root/axis-tcc` e o commit do repo é invisível. Não há pipeline de build de imagem.
- **Severidade:** **P0** (operacional para clínico)
- **Classificação:** CONFIRMADO

---

### H-3 — `package.json` sem `engines`

- **Bloco:** HUB · **Área:** H
- **Problema:** `grep -A 3 "engines" package.json` não retorna nada. CI usa Node 22 mas o servidor não é verificado em boot.
- **Evidência:** `package.json`: sem bloco `"engines": { "node": "..." }`.
- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** deploy em Node diferente (ex.: upgrade do Ubuntu de 20→24) pode ter comportamento divergente; `next@16.1.6` lista requisitos via peer, mas sem pinagem explícita a VPS pode ficar em versão N-1 sem alerta.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### H-4 — Worker em produção via `npx tsx`

- **Bloco:** HUB · **Área:** H
- **Problema:** `ecosystem.config.cjs` executa o worker com `script: 'npx', args: 'tsx scripts/workers/transcription-worker.ts'` — cada restart invoca o resolver de npx, baixa tsx se necessário e transpila on-the-fly.
- **Evidência:**

```js
{
  name: 'axis-worker-transcribe',
  script: 'npx',
  args: 'tsx scripts/workers/transcription-worker.ts',
  cwd: '/root/axis-tcc',
  ...
}
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** cold-start longo; consumo de memória/CPU não-deterministic; dependência de conectividade NPM em restart se cache invalida; sem build step → impossível analisar bundle final do worker.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### H-5 — CI build recebe `CLERK_SECRET_KEY: "sk_test_placeholder"`

- **Bloco:** HUB · **Área:** H
- **Problema:** no step `build` do CI, variáveis de ambiente inclui literalmente `"sk_test_placeholder"` para CLERK_SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
- **Evidência:** `.github/workflows/ci.yml`:

```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  REDIS_URL: ""
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
  CLERK_SECRET_KEY: "sk_test_placeholder"
  GOOGLE_CLIENT_ID: "placeholder"
  GOOGLE_CLIENT_SECRET: "placeholder"
  DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder"
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder"
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** 
  1. `NEXT_PUBLIC_SUPABASE_URL` é **inlinado no bundle client** por Next.js (`NEXT_PUBLIC_*`); o build de CI exporta bundle com `https://placeholder.supabase.co`. Não é usado em prod, pois prod roda `next:build` em outro lugar — mas se alguém publicar artefato do CI, frontend aponta para placeholder.
  2. O build só valida compilação, não validade de env. Se variável faltar em prod, boot quebra silenciosamente.
- **Severidade:** P1
- **Classificação:** CONFIRMADO

---

### H-6 — Sentry DSN hardcoded em `.ts` committed

- **Bloco:** HUB · **Área:** H
- **Problema:** DSN Sentry repetido em três arquivos committed:

```
sentry.server.config.ts:    dsn: "https://d08fb0a21eb8ba3e0dca74b16f9134a0@o4511070995742720.ingest.us.sentry.io/4511071001182208"
sentry.edge.config.ts:      dsn: "..."
instrumentation-client.ts:  dsn: "..."
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** DSN do Sentry não é segredo de autenticação, mas permite a terceiros **forjar eventos** no projeto Sentry (noise + custo). Também acopla o código a uma org Sentry específica. Qualquer troca de org quebra todos os ambientes simultaneamente.
- **Severidade:** P1 (com caveat: DSN Sentry é por design "público")
- **Classificação:** CONFIRMADO

---

### H-7 — `tunnelRoute: "/monitoring"` não está em isPublicRoute

- **Bloco:** HUB · **Área:** H
- **Problema:** `next.config.ts` define `tunnelRoute: "/monitoring"` para que Sentry poste através de uma rota do próprio domínio. `middleware.ts > isPublicRoute` não lista `/monitoring`.
- **Evidência:**

```ts
// next.config.ts
tunnelRoute: "/monitoring",
```

`grep -n "monitoring" middleware.ts` retorna vazio.

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** requests Sentry do client (especialmente antes do Clerk carregar) podem ser **rejeitadas por auth.protect()** → eventos de erro pré-login nunca chegam. Também pode criar loop se Sentry retry em 401.
- **Severidade:** P2
- **Classificação:** PRECISA VALIDAÇÃO (depende de o Next auto-registar `/monitoring` como public ou de Clerk o ignorar pelo padrão do matcher)

---

### H-8 — CI não roda typecheck em `scripts/`

- **Bloco:** HUB · **Área:** H
- **Problema:** `eslint.config.mjs` tem `ignores: [..., 'scripts/**', ...]`. `tsconfig.json` inclui `**/*.ts` e `**/*.tsx` — mas o ESLint boundaries não roda em `scripts/`, e como `scripts/workers/transcription-worker.ts` tem lógica crítica (RLS worker bypass), fica sem checks estáticos de fronteira.
- **Evidência:** `eslint.config.mjs`:

```js
ignores: [
  '.next/**',
  '.husky/**',
  ...
  'scripts/**',
  ...
]
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** workers podem importar `src/engines/cso-aba.ts` e quebrar a boundary (engine → worker) sem alerta.
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

### H-9 — Dois scripts de backup concorrentes

- **Bloco:** HUB · **Área:** H
- **Problema:** `scripts/backup.sh` usa `docker exec axis-postgres pg_dump` e grava em `/root/backups/`. `scripts/backup-postgres.sh` usa `pg_dump` direto (host/port/user do `.env`) e grava em `/backups/`. Se ambos estiverem no cron, concorrem por lock de dump e dobram o espaço.
- **Evidência:** dois arquivos existem e cada um define cron em seu próprio comentário:

```sh
# backup.sh:
#   0 3 * * * /root/axis-tcc/scripts/backup.sh --quiet >> /root/backups/backup.log 2>&1

# backup-postgres.sh:
#   0 3 * * * /caminho/para/axis-tcc/scripts/backup-postgres.sh >> /var/log/axis-backup.log 2>&1
```

E `setup-cron.sh` refere-se apenas a `backup-postgres.sh` — não remove/neutraliza o outro.

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** ambiguidade operacional; sem test de smoke para garantir que backup está sendo feito diariamente.
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

### H-10 — Caminhos hardcoded em scripts de backup/deploy

- **Bloco:** HUB · **Área:** H
- **Problema:** `backup.sh` fixa `BACKUP_DIR="/root/backups"` e `DOCKER_CONTAINER="axis-postgres"`. `ecosystem.config.cjs` fixa `cwd: '/root/axis-tcc'` (já levantado em v1 H-12). `setup-cron.sh` assume `/backups` e `/var/log/axis-backup.log`.
- **Evidência:** trechos copiados acima.
- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** só roda na VPS específica. Staging ou disaster-recovery em outra máquina exige edit manual.
- **Severidade:** P2
- **Classificação:** CONFIRMADO

---

### H-11 — Husky só valida migrations

- **Bloco:** HUB · **Área:** H
- **Problema:** `.husky/pre-commit` apenas invoca `validate-migrations.sh`. Não roda `typecheck`, `lint`, nem testes.
- **Evidência:**

```sh
#!/usr/bin/env bash
set -e
echo "-> validate-migrations"
bash scripts/hooks/validate-migrations.sh
```

- **Base:** EVIDÊNCIA DIRETA
- **Impacto:** commits passam com TS error ou ESLint error → só detectado no CI pull request (ou pior, só no deploy se CI não for obrigatório).
- **Severidade:** P3
- **Classificação:** CONFIRMADO

---

## 4. Top 3 riscos críticos em F/G/H

1. **F-1 — `sendDefaultPii: true` em Sentry server+edge+client**
   Razão: plataforma clínica enviando PII continuamente a terceiro (`us.sentry.io`) sem consentimento específico. Combinado com F-2 (Replay) vira ingesta de vídeo da tela com dados de paciente. **Risco regulatório direto LGPD Art. 11 (dado sensível de saúde).**

2. **G-1 — Zero testes em rotas externas**
   Razão: os endpoints com maior superfície de ataque (webhook Hotmart, webhook Clerk, cron, admin, transcribe) nunca rodam em CI. Regressões dos bugs P0 já documentados no v1 (ex.: H-1 cron bypass, H-3 legacy transcribe-audio) podem reaparecer sem alerta.

3. **H-1 — Nenhum security header**
   Razão: plataforma público-facing sem CSP/HSTS/X-Frame-Options em 2026. Fronteira básica para defesa de XSS, clickjacking e downgrade de HTTPS não existe. Pré-requisito para qualquer certificação clínica.

---

## 5. Falsos positivos prováveis

1. **F-9 — open redirect via `router.push(data.redirect)`**: hoje o backend hardcoda o destino (`DASHBOARD_PATH[productType]`), então o risco é **estrutural futuro**, não explorável agora.
2. **H-6 — Sentry DSN hardcoded**: DSN do Sentry é por design público no client-side. Considerar P2/P3 em revisão — deixei P1 por acoplamento e potencial forge de eventos.
3. **H-7 — tunnelRoute não público**: o plugin Sentry pode registar a rota automaticamente via middleware próprio do Next. **PRECISA VALIDAÇÃO** antes de classificar como bug.

---

## 6. Áreas sem achados (declaradas explicitamente)

- **Server Actions (`'use server'`):** `grep -rn "'use server'" app/ src/` retorna **vazio** — o codebase não usa Server Actions. Nenhum achado possível nessa subárea.
- **Hidratação com content user-provided em `dangerouslySetInnerHTML`:** único uso é `JSON.stringify(jsonLd)` em landing pages com payload hardcoded (não user input). Nenhum achado.
- **CSRF:** única set de cookie httpOnly secure sameSite=lax é `axis_active_tenant` (`app/api/aba/tenant-select/route.ts`). Endpoints POST em rotas API têm auth via Clerk — não Server Actions, então CSRF tradicional não se aplica. Nenhum achado novo.
- **Dockerfile / containerização:** inexistente, logo não há o que auditar em termos de `USER`, multi-stage, secret injection (declarado em H-2 como ausência estrutural).
- **Playwright coverage:** pulado para TDAH conforme instrução do usuário. Apenas confirmei que CI não roda nenhum Playwright (G-2).

---

## 7. Escopo e limitações desta auditoria v2

- Não rodei build, testes, nem deploy.
- Não acessei a VPS de produção; tudo foi lido no repositório.
- Não inspecionei o dashboard Sentry para verificar quais campos vêm redacted — apenas a config.
- Não confirmei via runtime se `next.config` de fato aplica headers default (verifiquei apenas que nenhum é definido custom).
- Boundary de ESLint (`eslint-plugin-boundaries`) foi listado como gap (H-8) mas sua eficácia atual não foi executada.

Tudo `CONFIRMADO` está no código literalmente. `PRECISA VALIDAÇÃO` (H-7) exige inspeção runtime.

---

**Fim do relatório v2.** Nenhum arquivo fora de `docs/audits/cc_auditoria_v2.md` foi criado ou editado. Sessão termina com zero mudanças no código-fonte.
