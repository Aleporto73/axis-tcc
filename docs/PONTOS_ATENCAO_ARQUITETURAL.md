# AXIS — Pontos de Atenção Arquitetural

Documento vivo de débitos arquiteturais conhecidos no AXIS Clínico.

Cada entrada = decisão consciente de NÃO refatorar agora, com gatilho explícito de quando refatorar.

**Filosofia:** sistema funciona em produção. Refatorar débito sem gatilho real cria risco maior que mantém. Documentar > refatorar preventivo.

**Última atualização:** Onda 8 / Sessão 2B (03/05/2026)
**HEAD vigente:** 57dafdd

---

## HUB-04 — withTenant fallback admin

> **STATUS: FECHADO em 05/05/2026 (Onda 9 Bloco F).**
>
> **Solução aplicada:**
> - Migration 067 (`scripts/migrations/067_shared_tenants_status.sql`) adicionou `tenants.status` (`active|orphan|inactive`)
> - 11 tenants órfãos em prod marcados como `status='orphan'` (auditoria AXIS preservada — sem DELETE)
> - `src/database/with-tenant.ts` agora rejeita fallback admin se `status != 'active'`, emite alerta CRITICAL `TENANT_NOT_ACTIVE`
> - Validação: tsc ✅, eslint ✅, vitest 15/15 (tcc-isolation isolado), prod aplicado em `2de8e49`
>
> Risco anterior (admin silencioso para órfãos) eliminado. Histórico abaixo preservado para contexto.
>
> ---

### Estado atual

- **Arquivo:** `src/database/with-tenant.ts`
- **Linhas:** 161-186 (bloco `else` quando `profileResult.rows.length === 0`)
- **Comportamento:** se usuário Clerk autenticado não tem profile ativo, busca em `tenants WHERE clerk_user_id = $1`, retorna com `role='admin'` e `planTier='free'` hardcoded

### Por que existe

Compatibilidade pré-migração de profiles. Antes do Onda 5 alguns tenants existiam sem profile correspondente. Fallback evita quebrar acesso desses usuários.

### Estado em produção (validado 03/05/2026)

- 15 tenants órfãos identificados (5 `pending_hotmart_*` + 10 testes/internos)
- 0 usuários reais comerciais afetados
- 0 acesso ativo pelos 15 órfãos
- Risco prático: ZERO hoje

### Quando vira problema (gatilhos para refatorar)

1. Mexer em `/api/webhook/clerk/route.ts` — se signup mudar e parar de criar profile, novo usuário vira admin silencioso
2. Mexer em `/api/webhook/hotmart/route.ts` — idem para fluxo Hotmart
3. Mudar lógica de `profiles.is_active` — se algum fluxo desativar profile mas manter tenant, fallback dispara
4. Adicionar SSO/auth alternativa — qualquer fluxo novo de criação de tenant precisa garantir profile

### Ação quando gatilho disparar

1. Refatorar fallback (linhas 161-186) para `throw new Error('Profile required for tenant access')`
2. Migration de cleanup dos 15 órfãos antes do deploy (delete pending_hotmart sem compra completada, decidir caso-a-caso para tenants de teste)
3. Adicionar teste vitest verificando que usuário sem profile recebe 500 (não admin silencioso)

### Quem decide

Alê (gestor de dev). Refatoração só com aprovação explícita.

---

## HUB-05.A (FECHADO) + HUB-05.B (Onda 10): RLS calendar_connections + events

> **STATUS PARCIAL: events resolvido em 05/05/2026 (Onda 9 G.1). calendar_connections adiado para Onda 10 (HUB-05.B).**
>
> **Decisão consciente:** RLS forced em calendar_connections exige refator prévio de 5 rotas runtime (cron renew-webhook, webhook Google TCC + ABA, OAuth callback TCC + ABA, sessions/create createGoogleCalendarEvent). Risco de quebrar feature Google Calendar durante deploy. Sem urgência real (HUB-05 é defesa em profundidade — Clerk auth + queries com WHERE tenant_id já fazem o trabalho hoje, RLS seria reforço).
>
> **Onda 10 — sessão dedicada (CC novo + chat novo):**
> - G.2: refator 5 rotas para usar withTenant ou pattern S3 (DISTINCT tenant_id antes de set_config)
> - G.3: migration 069 RLS forced em calendar_connections
> - Esforço estimado: 4-6h
>
> **Prioridade Onda 10:**
> 1. HUB-09 (baseline migration via pg_dump --schema-only) — bloqueia E2E
> 2. HUB-05.B (refator + RLS calendar_connections)
> 3. Bloco E Playwright nightly (depende de HUB-09)
>
> Histórico abaixo preservado para contexto.
>
> ---

### Estado atual

- **Tabela:** `calendar_connections` (criada em migration 056)
- **RLS:** AUSENTE (forced=false, enabled=false)
- **Schema declara explicitamente:** "Sem RLS — prod não tem policies nessas tabelas" (056:4)

### Rotas que tocam a tabela (15 mapeadas)

**Com `withTenant` (8 rotas — OK):**

- `aba/google/{disconnect,status,sync,watch}/route.ts`
- `google/{disconnect,status,sync,watch}/route.ts`

**Com `pool.query` direto (5 rotas — débito):**

- `aba/google/callback/route.ts` — OAuth entry point (chicken-and-egg)
- `cron/renew-webhook/route.ts` — TEM TODO explícito linhas 7-15
- `google/callback/route.ts` (TCC) — OAuth entry point
- `google/webhook/route.ts` (TCC) — webhook Google sem auth Clerk
- `sessions/create/route.ts` — função helper `createGoogleCalendarEvent`

**Pattern misto/Caminho 2 legítimo (2 rotas):**

- `aba/google/webhook/route.ts` — chicken-and-egg correto
- `aba/lgpd/delete/route.ts` — dentro de withTenant

### Por que funciona hoje

Isolamento garantido por `WHERE tenant_id = $1` no app code. Funciona porque devs/IAs incluem o filtro corretamente. Sem defense-in-depth do DB.

### Estado em produção (validado 03/05/2026)

- 0 vazamentos cross-tenant conhecidos
- Todas as 15 rotas têm `WHERE tenant_id` correto

### Quando vira problema (gatilhos para refatorar)

1. Criar rota NOVA que toque `calendar_connections` — risco de esquecer `WHERE tenant_id`
2. Adicionar dev/colaborador novo ao projeto — sem familiaridade com o pattern
3. Refatorar autenticação/multi-tenancy — pode quebrar premissas atuais
4. Auditoria de compliance externa exigir defense-in-depth no DB
5. Bug real de vazamento em qualquer das 5 rotas com `pool.query`

### Ação quando gatilho disparar

1. Refatorar 5 rotas com `pool.query` direto:
   - OAuth callbacks (2): aplicar Caminho 2 (lookup token → set_config app.tenant_id → query)
   - Webhook TCC + cron + sessions/create (3): converter para `withTenant` ou Caminho 2
2. Migration nova ativando `ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + policies por tenant
3. Smoke testes em todas as 15 rotas antes do deploy
4. Estimativa: 4-6h de trabalho

### Quem decide

Alê. RLS quebra prod se ativada antes de refatorar — risco real.

---

## Protocolo de Auditoria

**Aprendizado da Onda 8 Bloco 0 (03/05/2026):** auditorias anteriores (CC + Codex) leram `docs/NOTE_TDAH.md` e `docs/NOTE_ABA.md` como fonte de verdade. Resultado: 2 bugs (TDAH-04 + ABA-02 Bug A + Bug B) marcados como pendentes nos NOTEs já estavam corrigidos no código. Custo evitado: ~3h de trabalho em fantasmas.

### Regras

1. **NOTEs (NOTE_TCC, NOTE_ABA, NOTE_TDAH) são HISTÓRICOS, não fonte de verdade.**
   Servem para entender contexto, não para validar bugs ativos.

2. **Auditoria DEVE ler código real.**
   Todo achado precisa vir com:
   - Caminho do arquivo
   - Linha exata
   - Comando `grep` ou `sed` que confirmou o bug no código atual
   - SHA-PRE do arquivo no momento da auditoria

3. **Auto-declarado em NOTE sem validação no código = REJEITAR achado.**
   Se auditoria diz "auto-declarado em NOTE_X.md" e não valida no código, classificar como INCONCLUSIVO.

4. **Toda Sessão de fix começa com Bloco de validação read-only.**
   - 5-15 min de leitura empírica
   - Se bug é fantasma, REFUTA e cancela Sessão
   - Custo baixo, evita remendo

5. **Após corrigir bug, atualizar NOTE no MESMO commit.**
   - Marcar entrada como `[x] CORRIGIDO` ou `[~] REFUTADO`
   - Adicionar referência ao commit/sessão que corrigiu/refutou
   - Manter histórico, não deletar

### Formato de entrada FECHADA

````markdown
- [x] **CORRIGIDO (Onda X Sessão Y, DD/MM/AAAA):** ~~descrição original do bug~~

  **Validação empírica:** [arquivo:linha onde fix vive ou onde validação ocorreu]
````

````markdown
- [~] **REFUTADO (Onda X Sessão Y, DD/MM/AAAA):** ~~descrição original do bug~~

  **Validação empírica:** [razão pela qual era falso positivo]
````

---

## HUB-09 (FECHADO): Migrations não rodam de zero em DB virgem

> **STATUS: FECHADO em 06/05/2026 (Onda 10 — 9 commits sequenciais).**
>
> **Solução aplicada (sequência cronológica em main):**
> - `202b2f3` baseline migration via `pg_dump --schema-only --no-owner --no-acl` (350KB, 10997 linhas, 97 tabelas)
> - `c39ab9d` fix CI guardrail: GUC contract aceita `000_shared_baseline.sql`
> - `cf2ea27` mover 62 migrations 001-066 para `scripts/migrations/legacy/`
> - `e894eaa` mover 5 runners TypeScript (024-028) para `scripts/legacy/`
> - `4a808aa` `BASELINE_NOTES.md` + atualizar refs paths `legacy/` em 4 NOTEs vivos
> - `3acd8d2` fix contratos TDAH+Operadora pós-baseline (paths + regex flexibilizado)
> - `eb5b754` smoke CI aplica baseline + 067 + 068 + smoke-seed (alinhado com BASELINE_NOTES)
> - `018de82` smoke-seed compatível com schema real (10 INSERTs respeitando 14 NOT NULLs + 13 FKs + 8 CHECK constraints)
> - `a8d2a2a` migration 069 `axis_audit_logs.user_id` nullable (desbloqueia bug LGPD purge_geo latente)
>
> **Aprendizados-chave:**
>
> - Baseline gerado via `pg_dump --schema-only --no-owner --no-acl --no-tablespaces --no-publications --no-subscriptions --no-security-labels` (Postgres 16.11). Resultado: 97 tabelas, 63 policies, 62 RLS enabled, 48 RLS forced, 78 functions, 14 types/enums, 1 extension (pgcrypto). Migrations 067 e 068 absorvidas no snapshot.
> - 62 migrations 001-066 movidas para `scripts/migrations/legacy/`; 5 runners TypeScript one-shot (024-028) movidos para `scripts/legacy/`.
> - 4 NOTEs vivos atualizados com paths `legacy/` (NOTE_TCC, NOTE_TDAH, NOTE_ABA, ABA_DB_FUNCTIONS). Docs históricos (archive/, audits/, sessoes/) preservados intactos (arqueologia).
> - **Bug LGPD latente descoberto:** `axis_audit_logs.user_id NOT NULL` impedia execução do cron `purge_geo` (compliance LGPD). Validação prod: 0 execuções com sucesso. Migration 069 desbloqueou.
> - 3 guardrails de teste atualizados pós-baseline: `operadora-guc-contract` (regex aceita schema-qualified + função `app_tenant_id()`, baseline excluído dos sub-tests de contrato GUC), `tdah-schema-contract` (lê do baseline em vez de migration 022), `operadora-audit-logs-contract` (não tocado, ainda válido).
> - Smoke CI agora aplica em ordem: baseline + 067 + 068 + 069 + smoke-seed (10 INSERTs com 5 UUIDs fixos respeitando FKs), depois exercita 3 cron jobs SQL ABA reais.
> - Padrão `BASELINE_NOTES.md` documenta convenção operacional: aplicação fresh `psql ... < 000_shared_baseline.sql` + migrations vivas (067+).
>
> Histórico abaixo preservado para contexto da decisão original (Onda 9 Bloco D).
>
> ---

### Estado

Descoberto na Onda 9 Bloco D (Smoke CI). Ao tentar aplicar as 62 migrations sequencialmente em DB virgem (Postgres 16), 13+ migrations falham com erros de schema (coluna inexistente, tipo inexistente, tabela inexistente).

### Por quê

Migrations evoluíram em prod incrementalmente. Algumas migrations referenciam objetos (colunas, tipos, tabelas) que assumem estado prod-evolved que não existe em DB virgem. Sequência não é replay-safe.

### Validação empírica (Onda 9 Bloco D — 05/05/2026)

Replay de 62 migrations em Postgres 16 ephemeral (docker `postgres:16`, DB virgem):

- 013: type `aba_protocol_status` not exist
- 014: column `fpa.access_token` not exist
- 015: column `ebp_practice_id` not exist
- 022: column `effective_date` not exist
- 023, 025-027, 038, 048, 057, 059-062, 064: tabelas `tdah_*` not exist (cascade da 022)
- 029: type `aba_product_type` not exist

Em prod: tudo funciona (foi aplicado progressivamente).
Em DB virgem: 13+ migrations quebram.

### Gatilhos

Refator obrigatório SE:

- Precisar criar staging novo do zero
- Onboarding de novo desenvolvedor (dev environment do zero)
- Postgres precisar ser recriado (upgrade major version, disk failure, troca de servidor)
- Backup restore que perdeu dados mas tem migrations

### Ação proposta (Onda 10 ou quando gatilho disparar)

Criar `scripts/migrations/000_baseline.sql` via `pg_dump --schema-only` da prod atual:

1. Snapshot do schema prod completo
2. Migrations 001-066 viram histórico (renomear para `legacy/`)
3. Migrations futuras (067+) rodam em cima do baseline limpo
4. Documentar em SKILL_TCC.md / SKILL_ABA.md / SKILL_TDAH.md o novo padrão

Esforço estimado: ~4h

### Mitigação parcial (Onda 9 Bloco D)

Smoke CI não tenta replay das 62 migrations. Em vez disso, usa `scripts/ci/smoke-fixture.sql` (schema mínimo dos 11 tabelas que os 3 cron jobs SQL ABA tocam). Captura bug TDAH-04 fantasma sem depender de replay completo.

### Quem decide

Alê. Risco real só dispara em cenários específicos (criar ambiente novo). Backup + prod estável mitigam o problema imediato.

---

## HUB-10: Vitest test flaky por timeout sob carga concorrente

### Estado

Descoberto na Onda 9 Bloco F.3 (validação F.2). O teste `src/tests/tcc-isolation.test.ts > analyze-clinical retorna 401 sem autenticação` falha intermitentemente no full run (`vitest run --exclude='e2e/**'`) por timeout (10s default).

### Por quê

- 17 test files rodam em paralelo no full run
- Carga concorrente faz alguns testes com IO real (DB query) extrapolarem 10s
- Isolado, o mesmo teste passa em ~3s

### Validação empírica

- Full run: 543/544 (1 fail por timeout)
- Run isolado do arquivo: 15/15 passed em 3.3s

### Não é regressão

Stack trace mostra `withTenant:73` lançando "Não autenticado" ANTES do bloco modificado em F.2 (linhas 88-100). F.2 não interfere neste fluxo.

### Gatilhos

Refator obrigatório SE:

- Failure rate exceder 10% das runs CI
- Bloquear merge legítimo de feature
- Estender para 2+ testes flaky

### Ação proposta (Onda 10 ou quando gatilho disparar)

Opção A: aumentar `testTimeout` global em `vitest.config.ts` para 30s (mascara bugs reais futuros, não recomendado)
Opção B: marcar testes IO-real como `test.concurrent(false)` ou separar em arquivo isolado (preferido)
Opção C: investigar causa raiz (pool de connections esgotando? Postgres lento?)

Esforço estimado: ~1h

### Quem decide

Alê. Risco prático baixo (1/544 = 0.18% failure rate atualmente).

---

## Backlog Onda 11

Itens identificados durante HUB-09 (Onda 10) que não bloqueiam fechamento mas merecem registro:

### Pendências repo (housekeeping)

- **`tsconfig.tsbuildinfo` zumbi** — arquivo trackeado historicamente, agora coberto por `.gitignore` mas continua aparecendo em `git status`. Resolver com `git rm --cached tsconfig.tsbuildinfo` em commit chore.
- **`Ale Porto - Atalho.lnk` (Windows shortcut)** — adicionar `*.lnk` ao `.gitignore` (ou local em `.git/info/exclude`).
- **`docs/competitive-brief-2026-04-29.md`** — untracked desde 03/05. Decisão pendente: commitar avulso (cosmético) ou stash.
- **`public/axisTDAH.png`** — modificado 03/05 (37KB → 72KB). Logo TDAH trocado fora de commit relacionado. Decisão: commit chore separado.

### Débitos arquiteturais já documentados acima (mantêm prioridade)

- **HUB-05.B** — Refator 5 rotas `calendar_connections` (cron renew-webhook, webhooks Google TCC+ABA, OAuth callbacks TCC+ABA, sessions/create) → migration RLS forced. Esforço 4-6h. Sessão dedicada (CC novo + chat novo).
- **HUB-10** — Flaky vitest `tcc-isolation > analyze-clinical 401`. Failure rate 0.18% (1/544 sob carga concorrente). Refator opcional (Opção B preferida: `test.concurrent(false)` ou separar arquivo isolado). Esforço ~1h.

### Bloco E (Playwright nightly)

Adiado para Onda 11 — agora desbloqueado pois HUB-09 está fechado e baseline garante DB completo em CI ephemeral. Esforço ~1h30.

---

## Padrão para futuros débitos

Adicionar nova entrada com:

- Estado atual (arquivo, linhas, comportamento)
- Por que existe (contexto histórico)
- Estado em produção (dados reais validados)
- Quando vira problema (gatilhos)
- Ação quando gatilho disparar (passos)
- Quem decide

Cada débito documentado = uma decisão consciente registrada.
