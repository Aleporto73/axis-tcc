# PLANO DE CORREÇÃO — AXIS ABA (v4)
## Integridade de Dado Clínico + Máquina de Estados

**Data:** 07/07/2026
**Versão:** 4 (incorpora 3ª auditoria adversarial + 8 queries de confirmação no banco vivo)
**Módulo:** ABA (`app/aba/*`, `app/api/aba/*`, schema/migrations ABA)
**Natureza:** documento de PLANEJAMENTO. Nenhuma correção aplicada.

**Histórico de versões:**
- v1 → v2: reescrita da Fase D (motor recusa `completed`, reescreve datas), ordem B↔D invertida, Decisão 0 de compliance, queries [PROVADO] coladas. *(9 furos)*
- v2 → v3: CSO retroativo é **fabricável**, não recuperável (`compute_sas` lê status atual; `compute_tcm` ordena por `created_at`). Criou a Decisão 5. Endureceu Fase A (clobber de trigger, CHECK escondido da sonda, 422 genérico) e backfill (FORCE RLS). *(5 furos)*
- **v3 → v4 (esta):** 3ª auditoria adversarial (método localizar→confrontar→simular→quebrar) achou 15 furos novos, e 8 queries no banco vivo confirmaram/refutaram cada um. Resultados decisivos:
  1. **Decisão 5 opção (a) é INEXECUTÁVEL** — `session_snapshots` tem `sas/pis/bss/tcm NOT NULL` + trigger que valida a fórmula, e não existe coluna para marcar "retroativo". Exigiria cirurgia de schema em tabela imutável.
  2. **Armadilha NULL→100 CONFIRMADA em produção:** `calculate_cso_aba(NULL,60,70,NULL)` retorna **100.00** (GREATEST/LEAST ignoram NULL). Dimensão nula ⇒ snapshot permanente de CSO máximo.
  3. **O backfill contamina o FUTURO:** `compute_tcm` lê `clinical_states_aba ORDER BY created_at DESC LIMIT 4`. Linhas de abril inseridas em julho viram "história recente" da próxima sessão real.
  4. **Google Calendar sync está QUEBRADO em produção** (achado que nenhuma auditoria anterior viu) — grava `'agendada'`/`'cancelada'` num enum que só aceita 4 valores em inglês. Enum confirmado íntegro ⇒ todo INSERT/UPDATE de sync ABA falha silenciosamente.
  5. **Correção de erro da v3:** a migration 075 **NÃO está commitada no GitHub** — está apenas *staged*. E não está aplicada (`_migrations` vazio para 075).
  6. **As 15 sessões editadas pós-fechamento não vieram da rota** — o usuário do banco é superuser com `rolbypassrls`. Bloquear a rota (B2) não previne o que já aconteceu nem o que pode acontecer via psql.

---

## 0. COMO LER ESTE DOCUMENTO

Selo de confiança por achado:
- **[PROVADO]** — confirmado por query no banco vivo de produção (VPS `147.93.191.64`, db `axis_tcc`) em 07/07/2026. A query e o resultado estão colados na seção 2.
- **[CÓDIGO]** — confirmado por leitura de código/commit real com `arquivo:linha` ou hash.
- **[A VERIFICAR]** — ainda não confirmado. Não vira tarefa sem prova.

**Regra de ouro:** nada entra em execução sem selo [PROVADO] ou [CÓDIGO]. E — regra nova da v2 — nenhum backfill histórico acontece antes da Decisão 0 estar respondida.

---

## 1. RESUMO EXECUTIVO — O QUE É VERDADE

| # | Problema | Selo | Reprova seguradora? |
|---|----------|------|---------------------|
| G1 | Motor CSO desligado desde 24/03 (commit `0d44a0e`): ~20 sessões fecham sem snapshot/clinical_state/CSO | **[PROVADO]+[CÓDIGO]** | **SIM** |
| G3a | Trilha de auditoria sem autor: 99 mudanças de status, 0 com autor real (tudo "system") | **[PROVADO]** | **SIM** |
| G3b | Sessão concluída editável: 15 sessões `completed` alteradas após o fechamento | **[PROVADO]** | **SIM** |
| G2 | Máquina de estados furada: `regression` é estado-zumbi; reprovação de sonda <70 não persiste | **[PROVADO]+[CÓDIGO]** | **SIM** |
| G2b | 8 botões da UI dão erro 500 (banco rejeita); `regression` inteiro é botão morto | **[CÓDIGO]** | Não (quebra operação) |
| G2c | Limiar duplo de sonda cria zona morta (critérios reais 70/80/85 vs regressão 70 fixo) | **[PROVADO]** | SIM |
| G3c | Atestação/evidência: 18/49 atestação, 0 presença, 0 evidence bundle | **[PROVADO]** | **SIM** |
| G4 | "Dominado" sem validação de critério — só confirmação de clique | **[CÓDIGO]** | SIM (agrava) |
| G5 | Meta PEI "atingida" não persiste — só cálculo de tela | **[PROVADO]** | Parcial |

**O que a auditoria Fable ERROU (corrigido pela verificação):** afirmou "motor CSO totalmente morto, nunca chamado". FALSO. O motor funcionava (29 sessões têm snapshot, jan–12/mar) e foi **desligado por um commit** (`0d44a0e`, 24/03). Correção real = "religar de forma segura", não "reconstruir".

---

## 2. EVIDÊNCIAS VERIFICADAS (queries coladas)

Todas as queries abaixo foram rodadas em produção (`docker exec -it axis-postgres psql -U axis -d axis_tcc`) em 07/07/2026.

### G1 — Motor CSO desligado [PROVADO + CÓDIGO]

```sql
SELECT count(*) FROM sessions_aba WHERE status='completed';        -- 49
SELECT count(*) FROM session_snapshots;                             -- 29
SELECT count(*) FROM clinical_states_aba;                           -- 29
```
49 concluídas, 29 com snapshot → **20 órfãs**.

Linha do tempo (agrupada por dia): 100% com snapshot até 12/03; **primeira falha 17/04/2026**; nenhuma gera desde então. Última órfã: 07/07 18:55.

Comparação furada×ok (mesma query, duas sessões):
- Furada (07/07): 3 trials, snapshot ausente.
- OK (12/03): 0 trials, snapshot presente.
→ Não é conteúdo da sessão; é a **data**. Corte por deploy.

Causa (código): commit `0d44a0e` (24/03/2026 20:35, "fix: correções P0 regressão ABA") removeu `SELECT * FROM close_session_aba(...)` em `app/api/aba/sessions/[id]/route.ts` e trocou por `UPDATE sessions_aba SET status='completed'` direto (linhas 152-163). A função `close_session_aba` existe só no dump `000_shared_baseline.sql:534`, nunca virou migration → quebrava em staging → dev fez bypass → desligou CSO também em prod.

**Nota de precisão (corrige v1):** o commit é de **24/03**; a primeira órfã observável é **17/04**. O backfill deve mirar **sessões fechadas após 24/03**, não após 17/04. [A VERIFICAR: houve fechamento entre 24/03 e 17/04? Confirmar o corte no banco antes do backfill.]

### G3a — Auditoria sem autor [PROVADO]

```sql
SELECT count(*) FROM axis_audit_logs WHERE action='PROTOCOL_STATUS_CHANGE';                        -- 99
SELECT count(*) FROM axis_audit_logs WHERE action='PROTOCOL_STATUS_CHANGE' AND user_id <> 'system'; -- 0
```
99 mudanças de status, 0 com autor real. Causa: `withTenant` seta `app.tenant_id` mas nunca `app.user_id` (`src/database/with-tenant.ts:203`); trigger cai no `COALESCE(..., 'system')`.

### G3b — Sessão concluída editável [PROVADO]

```sql
SELECT count(*) FROM sessions_aba WHERE status='completed' AND duration_minutes_override IS NOT NULL;      -- 13
SELECT count(*) FROM sessions_aba WHERE status='completed' AND updated_at > ended_at + interval '1 minute'; -- 15
```
15 sessões concluídas editadas após o fechamento; 13 com override de duração. `PATCH` de `duration_minutes_override`/`applied_by` não checa status (`app/api/aba/sessions/[id]/route.ts:170-211`).

### G2 — Máquina de estados [PROVADO + CÓDIGO]

Trigger real de produção (`pg_get_functiondef('public.trg_fn_validate_protocol_transition'::regproc)`) — transições permitidas:
```
draft              → active, discontinued
active             → mastered, suspended, discontinued
mastered           → generalization, suspended
generalization     → mastered_validated, maintained, active
mastered_validated → maintenance, maintained, active
maintenance        → maintained, active
maintained         → archived, active
suspended          → active, discontinued
```
`regression` NÃO aparece como origem nem destino. `mastered→active` (075) NÃO está em prod.

```sql
SELECT count(*) FROM learner_protocols WHERE status='regression';  -- 0
SELECT status, count(*) FROM maintenance_probes GROUP BY status;    -- pending: 30 (só)
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname LIKE '%maintenance_probes_status%';
-- CHECK: status IN ('pending','completed')
```

Bug de rollback da sonda: **[CÓDIGO]** — `maintenance/route.ts:77-80` grava `status='regression'` → trigger rejeita → rollback total da transação (`withTenant` single-transaction). "30 pending" é corroboração, não a prova (a prova é o código). *(Correção de interpretação da v1.)*

**Precisão (corrige v1):** a reprovação só é impossível de persistir para **score < 70**. Uma sonda `failed` com score em [70, mastery_pct) **grava normalmente** (`maintenance/route.ts:62-70`, antes do branch de regressão). O que some é só o caso `<70`.

### G2b — 8 botões dão 500 [CÓDIGO]
`validTransitions` (`app/aba/aprendizes/[id]/page.tsx:21`) oferece 19 transições; 8 rejeitadas pelo trigger:
`draft→archived`, `mastered→regression`, `mastered→active`, `generalization→regression`, `mastered_validated→regression`, `maintenance→regression`, `maintained→regression`, `regression→active`.
`regression` inteiro é botão morto. 8 transições válidas estão escondidas da UI. Erro engolido em `protocols/[id]/route.ts:90-94` → 500 genérico (contraste: `sessions/[id]/route.ts:223` trata como 422).

### G2c — Limiar duplo [PROVADO]

```sql
SELECT DISTINCT p.mastery_criteria_pct FROM learner_protocols p JOIN maintenance_probes mp ON mp.protocol_id=p.id ORDER BY 1;
-- 70, 80, 85
```
Aprovação usa `mastery_criteria_pct`; regressão usa 70 fixo. Com critério 80/85, score entre 70 e o critério = zona morta (grava `failed` inócuo, não regride).

### G3c — Atestação/evidência furada [PROVADO]

```sql
SELECT (SELECT count(*) FROM sessions_aba WHERE status='completed') AS completed,
       (SELECT count(*) FROM session_attestations) AS attest,
       (SELECT count(*) FROM session_presence_proofs) AS presence,
       (SELECT count(*) FROM session_evidence_bundles) AS evidence;
-- completed: 49 | attest: 18 | presence: 0 | evidence: 0
```
De 49 concluídas: 18 atestação, 0 presença, 0 evidence bundle. Hook client-side fire-and-forget falha na maioria. 31 sessões sem comprovação.

### G4 — "Dominado" sem validação [CÓDIGO]
`app/api/aba/protocols/[id]/route.ts:16-17` grava `status='mastered'` do body sem ler `session_targets`/scores. `mastery_criteria_sessions`/`trials` nunca avaliados. Única barreira: `window.confirm` (P0, já em produção).

### G5 — Meta PEI não persiste [PROVADO]

```sql
SELECT column_name FROM information_schema.columns WHERE table_name='pei_goals' ORDER BY column_name;
-- created_at, domain, id, notes, pei_plan_id, target_pct, title
```
Sem coluna de status/atingimento. "Meta atingida" é derivação de UI em render, nada gravado.

### Proteção que FUNCIONA [PROVADO]
`session_targets.score_pct` é `GENERATED ALWAYS` — nota não falsificável.

---

## 2b. FATOS NOVOS CONFIRMADOS NO BANCO (3ª rodada, 07/07/2026)

Estas 8 queries foram rodadas em produção para resolver as bifurcações da 3ª auditoria. Cada uma decide o desenho de uma fase.

### ⚠️ NULL→100: a fórmula do CSO retorna nota máxima com dimensão nula [PROVADO]
```sql
SELECT calculate_cso_aba(NULL,60,70,NULL);   -- 100
```
`GREATEST/LEAST` do Postgres ignoram NULL (`000:391-399`). **Consequência:** qualquer tentativa de backfillar snapshot com SAS/TCM nulos produziria **CSO=100 ("excelente")**, imutável, para sessões de abril. A opção (a) da Decisão 5 não é só inexecutável — é **perigosa**.

### ⚠️ Google Calendar sync ABA está QUEBRADO em produção [PROVADO]
```sql
SELECT unnest(enum_range(NULL::public.aba_session_status));
-- scheduled | in_progress | completed | cancelled  (enum ÍNTEGRO, sem valores em português)

SELECT status, count(*) FROM sessions_aba GROUP BY 1;
-- in_progress: 5 | scheduled: 6 | completed: 49  (nenhum 'agendada'/'cancelada')
```
O enum está íntegro — ninguém o alterou. **Portanto o outro ramo é o real:** `google/sync/route.ts:154-167,191` e `google/webhook/route.ts:126-135,157` gravam `'agendada'`/`'cancelada'` (padrão copiado do TCC, onde `sessions.status` é TEXT). Todo INSERT/UPDATE de sync ABA morre com **22P02** e faz **rollback do batch inteiro**, silenciosamente (catch genérico). Sync de agenda ABA é funcionalidade morta. **Achado que nenhuma auditoria anterior viu. Não está em nenhuma fase do plano.**

### Órfãs cruzam 3 tenants [PROVADO]
```sql
SELECT sa.tenant_id, count(*) FROM sessions_aba sa
LEFT JOIN session_snapshots ss ON ss.session_id=sa.id
WHERE sa.status='completed' AND ss.id IS NULL GROUP BY 1;
-- 123e4567...: 3 | 377c9cd4...: 14 | 9ae1ea81...: 3   (total 20)
```

### O role do backfill é superuser e bypassa RLS [PROVADO]
```sql
SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user;
-- axis | t | t
```
**Duas consequências:** (1) o bullet "setar `app.tenant_id` por órfã" (Furo E) é **código morto** se D3 rodar via psql — o FORCE RLS não protege nada; (2) se D3 rodar pela rota do app (`withTenant`), FORCE RLS **esconde as órfãs dos outros tenants** → backfill parcial reportando sucesso. **D3 precisa DECLARAR por onde roda.**

### Motor correto está ativo [PROVADO — furo neutralizado]
```sql
SELECT engine_name, version, is_current FROM engine_versions ORDER BY is_current DESC;
-- CSO-ABA | 2.6.1 | t
-- CSO-TDAH | CSO-TDAH-v1.0.0 | f
```
`is_current` aponta para `CSO-ABA 2.6.1`. Risco de carimbar engine do TCC nos snapshots ABA **não se materializa hoje** — mas o índice único global (`000:7079,7086`) permite só 1 linha `is_current` na tabela inteira, e `close_session_aba:563` não filtra por `engine_name`. **Fragilidade estrutural: se alguém ativar outro motor, os snapshots ABA passam a mentir sobre a engine.**

### Migration 075: nem commitada, nem aplicada [PROVADO — corrige erro da v3]
```sql
SELECT version, checksum, applied_at FROM _migrations WHERE version='075';
-- (0 rows)
```
Somado ao `git log --all -- scripts/migrations/075_*.sql` = vazio (3ª auditoria): a 075 está **apenas staged**, nunca commitada, nunca aplicada. **A v3 afirmava "P1 commitado no GitHub" — FALSO.** Corrigido aqui. Vantagem: pode ser reescrita livremente, sem conflito de checksum.

### Corte 24/03→17/04: zero sessões [PROVADO]
```sql
SELECT sa.id, sa.ended_at FROM sessions_aba sa LEFT JOIN session_snapshots ss ON ss.session_id=sa.id
WHERE sa.status='completed' AND ss.id IS NULL AND sa.ended_at >= '2026-03-24' AND sa.ended_at < '2026-04-17';
-- (0 rows)
```
Não houve fechamento entre o commit (24/03) e a primeira órfã (17/04). Corte limpo. **Alvo do backfill = as 20 órfãs conhecidas.** [A VERIFICAR] resolvido.

### Universo de B2-bis é 28, não 15 [PROVADO]
```sql
SELECT count(*) FILTER (WHERE duration_minutes_override IS NOT NULL AND updated_at > ended_at + interval '1 minute') AS ambos,
       count(*) FILTER (WHERE duration_minutes_override IS NOT NULL OR  updated_at > ended_at + interval '1 minute') AS uniao
FROM sessions_aba WHERE status='completed';
-- ambos: 0 | uniao: 28
```
Interseção **zero** entre os 13 com override e os 15 editados pós-fim. São conjuntos disjuntos. **B2-bis trata 28 sessões**, não 15.

### Critérios de domínio reais [PROVADO — para C1]
```sql
SELECT mastery_criteria_pct, mastery_criteria_sessions, mastery_criteria_trials, count(*) FROM learner_protocols GROUP BY 1,2,3;
--  90|3|10: 3   88|3|10: 1   85|3|10: 1   80|3|1: 1   70|3|10: 1   80|3|10: 31   80|4|10: 2
```
Os critérios **estão preenchidos e são plausíveis** (não são lixo/nulo). C1 pode validar contra eles. Exceção a investigar: 1 protocolo com `mastery_criteria_trials = 1`.

---

## 3. ACHADOS [A VERIFICAR] (relevância só na fase correspondente)

- **#16/#17** — functions SQL com colunas inexistentes + INSERTs de auditoria inválidos. **Revisão apontou (furo #8):** NENHUMA está no caminho de `close_session_aba` (que chama só `compute_full_cso`→`compute_sas/pis/bss/tcm/calculate_cso_aba/cso_aba_band`, todas puras). Portanto **não bloqueiam a Fase D**. São código morto a limpar à parte. Verificar só se/quando religar `detect_regression`/generalização.
- **#19** — `generalization_status` nunca atualizado → `compute_mastery_score` nunca dá 85. Domínio da Fase A. Verificar na Fase A.
- **#20** — `cancelled` inalcançável via app. Baixa gravidade.
- **`engine_versions.is_current`** — pré-condição da Fase D (ver furo #7 / D0). O motor aborta sem uma linha `is_current=TRUE`. Seeds existem só em `legacy/` com coluna inconsistente (`is_active` vs `is_current`). Provavelmente OK em prod (as 29 antigas ganharam snapshot), mas **verificar explicitamente antes de D**.
- **Corte 24/03 vs 17/04** — confirmar se houve fechamento entre as datas (define o alvo do backfill).

---

## 4. PLANO DE EXECUÇÃO (v2 — ordem corrigida)

Princípio: menor risco e maior alívio primeiro; motor (Fase D) por último, com função de backfill dedicada — nunca o motor cru.

### DECISÃO 0 — obrigatória antes de qualquer backfill (ver seção 5)
Política de remediação histórica. Trava D3, B3 e a remediação das 15 sessões adulteradas.

### FASE A — Máquina de estados [G2 + G2b + G2c]
**Ordem interna corrigida (furo #2 v2 + furo D v3): todas as mudanças de trigger colapsam em UMA definição final da função; só então reconciliar a UI.**

⚠️ **Furo D (v3) — clobber de trigger:** A1 e A2 fazem `CREATE OR REPLACE` da MESMA função `trg_fn_validate_protocol_transition`. A migration 075, como está, reescreve o corpo INTEIRO da função sobre o baseline, SEM a mudança de regression. Se A1 (fix regression) rodar antes de A2 (075), a 075 **apaga** o fix de A1. **Solução:** A1+A2 NÃO são migrations separadas — são UMA única migration com a definição FINAL da função (regression + mastered→active juntos). Nunca duas em sequência sobre a mesma função.

- A1+A2 (unificado). Escrever UMA migration com a definição final do trigger: destino de `regression` (Decisão 1) + `mastered→active` (075) na mesma função. Fecha o P1 pausado.
- A3. Corrigir persistência de reprovação de sonda (Decisão 3). ⚠️ **Furo B (v3) — segundo rollback escondido:** corrigir o trigger NÃO basta. Na mesma transação, `maintenance/route.ts:90` grava `maintenance_probes SET status='cancelled'`, valor que **viola o CHECK** `maintenance_probes_status_check` (só admite `pending`/`completed`, `000:3876`). Hoje está mascarado (o trigger aborta antes na linha 79). Ao liberar `maintenance→regression` no trigger, a execução alcança a linha 90 e **rolla de novo** no CHECK da sonda. **Solução A3 precisa incluir:** `ALTER` do `maintenance_probes_status_check` para admitir `'cancelled'` (ou trocar o valor gravado). Sem isso, "consertar a regressão" continua quebrado.
- A4. Corrigir limiar duplo — eliminar zona morta 70-vs-critério (Decisão 3).
- **A7 (novo v4 — F2.1):** ao expor `maintenance→active` (transição válida que a UI esconde hoje), surge uma bomba: nada cancela as sondas `pending` ao sair de `maintenance`, e a rota de avaliação não recheca o status do protocolo (`maintenance/route.ts:55`). Depois da saída: score<70 tenta `active→regression` (inválida); 3/3 aprovadas tenta `active→maintained` (**não existe no trigger**) → exceção → rollback da avaliação inteira. **A5 precisa incluir:** cancelar/invalidar sondas pending ao sair de maintenance + rota de avaliação rechecar status antes das linhas 79/109.
- **— trigger + constraints congelados aqui —**
- A5. Reconciliar `validTransitions` (UI) contra o trigger FINAL: remover botões que ainda dão 500, expor as transições válidas hoje escondidas. **Cuidado com F2.1 acima.**
- A6. Tratar erro do banco no PATCH → 422 com motivo. ⚠️ **Furo C (v3) + F2.2 (v4) — o 422 é mais delicado do que parece:**
  - `sessions/[id]/route.ts:223` só vira 422 quando a mensagem contém `'[AXIS ABA]'`.
  - Mas o PATCH aceita `status` **cru do body** (`protocols/[id]/route.ts:8,17`) — valor fora do enum dá **22P02**, que não é 23xxx → continua 500 mesmo pós-A6.
  - E mapear "23xxx inteiro" é pior: repassa mensagem do PG com **nome de constraint** ao usuário, e converte violações de FK/NOT NULL (23503/23502 — bugs de programação) em "422 de validação" invisível na telemetria.
  - **Solução A6:** allowlist constraint→mensagem amigável (só 23514 conhecidos + `[AXIS ABA]`); validar enum no body (22P02); demais 23xxx continuam 500 **logado**.
  - Nota (F2.4): o exemplo `ck_discontinued_requires_reason` da v3 **não é alcançável pela UI** (o `window.prompt` obriga o motivo) — é risco de fronteira de API. O caso de UI real é `maintained→archived` com `maintained_at NULL` → `ck_archived_requires_maintained` (`000:3780`) em linhas legadas.
- **A8 (novo v4 — layout):** trocar a caixa preta nativa (`window.confirm`) por modal no CSS do projeto. Serve P0 (Dominado) e P1 (reverter) de uma vez. Baixa prioridade técnica, mas é ajuste real e pendente.

**Correção da justificativa do Furo D (F2.5):** a v3 dizia "se A1 rodar antes de A2, a 075 apaga o fix". A direção estava invertida — a 075 já existe numerada, então uma migration nova seria ≥076 e rodaria **depois**. O clobber real é a **076 escrita a partir do corpo do baseline** (sem a linha da 075) apagar o `mastered→active`. A solução (migration única com definição final) **continua correta**; a justificativa é que estava errada. Pré-check obrigatório: `SELECT * FROM _migrations WHERE version='075';` em prod **e** staging (o runner valida checksum — reescrever migration já aplicada aborta com CONFLITO, `migrate.sh:279-293`). **Em prod: 0 rows — a 075 nunca foi aplicada, pode ser reescrita livremente.**

**Dependência:** A é pré-requisito de **C** (validar Dominado precisa da máquina limpa). NÃO é pré-requisito técnico de D — `close_session_aba` não escreve em `learner_protocols` (furo #3). Fazer A antes de D é ok por prudência, não por dependência.

### FASE B — Rastreabilidade / integridade de registro [G3a + G3b]
- **B1.** Setar `app.user_id` no `withTenant` → auditoria com autor real. ⚠️ **F3.3 (v4) — colide com contrato de teste congelado:** `src/tests/operadora-guc-contract.test.ts:33` define `ALLOWED_GUCS = {'app.tenant_id','app.is_worker','app.worker_mode'}` — **sem `app.user_id`** — e o teste exige que o *primeiro* `set_config` seja `app.tenant_id`. Implementar B1 sem atualizar o contrato ⇒ **CI vermelho** ⇒ executor "conserta" removendo o GUC e desfaz B1. **B1 inclui obrigatoriamente:** atualizar `ALLOWED_GUCS` + ordem dos `set_config`. (Definir qual id: `userId` ou `profileId`.)
  - *Colateral positivo verificado:* `app.user_id` só é lido por `trg_fn_protocol_status_audit` (ABA) e `trg_fn_summary_audit` (multi-módulo), ambos com `COALESCE → 'system'`. Nenhuma POLICY lê. **Não vaza para TCC/TDAH.**
- **B2.** ⚠️ **REDESENHAR — F3.2 + F3.4 (v4):**
  - **F3.2 — a atribuição causal da v3 estava errada.** Nenhum código ATUAL produz `updated_at > ended_at` em sessão `completed`: o PATCH de override **não seta `updated_at`**; o bypass de fechamento também não; não há trigger de `updated_at` em `sessions_aba`. **As 15 vieram de código antigo ou de UPDATE manual via psql.** (E o role `axis` é superuser com bypassrls — psql direto é caminho aberto.) **Consequência:** bloquear a rota não teria prevenido as 15, e não previne futuras via banco.
  - **F3.4 — bloqueio duro MATA um fluxo de compliance vivo.** `duration_minutes_override` é editado **por design pós-fechamento** (`sessoes/[id]/page.tsx:664-669`, rótulo "Corrigida: X min") e alimenta `actual_hours` vs `authorized_hours_week` do integrity-scanner (`src/engines/integrity-scanner.ts:296-301`). 13 de 49 sessões usam. Bloquear ⇒ correção de duração impossível ⇒ **relatório de horas do payer errado**, exatamente o dado que a operadora audita.
  - **Solução B2:** fixar a variante **"motivo obrigatório + audit log"** (carve-out auditado para `duration_minutes_override`/`applied_by`), NÃO bloqueio duro. A v3 apresentava as duas variantes como equivalentes — não são.
  - **Adicional:** considerar trigger de imutabilidade real em `session_targets`/`session_behaviors` para sessões `completed` (F1.8: hoje "trial imutável" é convenção de rota, não propriedade do dado — não existe trigger de imutabilidade nessas tabelas).
- **B2-bis.** Remediar as sessões já adulteradas. ⚠️ **Universo é 28, não 15** [PROVADO]: interseção zero entre os 13 com override e os 15 editados. Conjuntos disjuntos. Tratamento depende da Decisão 0. **Antes de remediar:** identificar QUEM editou (`SELECT * FROM axis_audit_logs WHERE entity_type='sessions_aba' ORDER BY created_at;`) — se não houver log, confirma o caminho psql manual.

### FASE F (nova v4) — Google Calendar sync ABA está QUEBRADO [F3.1]
**Achado que nenhuma das 3 auditorias anteriores viu, e que não estava em nenhuma fase.**
`google/sync/route.ts:154-167,191` e `google/webhook/route.ts:126-135,157` gravam `'agendada'`/`'cancelada'` em `sessions_aba.status`, que é o enum `aba_session_status` (`scheduled|in_progress|completed|cancelled`). Enum confirmado íntegro no banco [PROVADO] ⇒ **todo INSERT/UPDATE do sync ABA morre com 22P02 e faz rollback do batch inteiro**, silenciosamente (catch genérico). Padrão copiado do TCC, onde `sessions.status` é TEXT com default `'agendada'`.
- F1. Corrigir os valores gravados pelo sync/webhook ABA para o enum correto.
- F2. Os UPDATEs do sync **não têm guard de status** — atualizam por `google_event_id` inclusive sessões `completed`. Se um dia o enum aceitasse os valores em português, um evento editado no Google **flipa uma sessão `completed`** reescrevendo `scheduled_at`/`duration_minutes`. Adicionar guard.
- F3. `sessions_aba` **não tem trigger de validação de transição** (só auditoria, `000:8381`). O plano corrige a máquina de estados de `learner_protocols` e **ignora a de `sessions_aba`** — que tem um writer externo automatizado. Avaliar trigger de transição para sessões.
- F4. O trigger de auditoria só loga mudanças para `in_progress/completed/cancelled` (`000:2859-2860`) — valores fora do enum não gerariam log. Rastreabilidade cega para esse writer.

*(B3 — atestação/evidência — foi movido para DEPOIS da Fase D. Ver furo #1.)*

### FASE C — Validação do "Dominado" [G4]
Depende de A.
### FASE C — Validação do "Dominado" [G4]
- **C1.** Sistema confere critério real (X% em N sessões) antes de permitir `mastered`, usando `mastery_criteria_*`. **Critérios reais confirmados** [PROVADO]: `80|3|10` (31 protocolos), `90|3|10` (3), `88|3|10`, `85|3|10`, `70|3|10`, `80|4|10` (2), `80|3|1` (1 — investigar). Não são lixo; C1 pode validar contra eles.
- ⚠️ **C1-a (F2.6, gravidade MÉDIA — 3× confirmado em painel adversarial): C1 precisa de âncora temporal.** A reversão `mastered→active` (Fase A/075) atualiza `activated_at` e limpa `mastered_at` (`protocols/[id]/route.ts:19,29,32`). Sem âncora, o profissional **re-domina no dia seguinte à reversão, validado pelas mesmas sessões antigas que a reversão acabou de invalidar.** A Fase A cria o buraco que C1 não cobre. **Janela correta:** sessões com `ended_at >= activated_at` do ciclo corrente.
- ⚠️ **C1-b (F2.6): não existe rota para editar `mastery_criteria_*` pós-criação.** O PATCH só aceita status/reason/pei_goal_id; o único writer é o INSERT. Um hard-block de C1 transforma critério errado (ex.: 85 quando devia ser 70) em **beco sem saída** ⇒ pressão por UPDATE manual no banco — exatamente o bypass que o plano quer matar. **Solução:** endpoint auditado de edição de critério, ou override com motivo registrado.
- ⚠️ **C1-c (F2.6): "X% em N sessões" está subespecificado.** `session_targets` tem múltiplas linhas por (sessão, protocolo). Média por linha vs `SUM/SUM` dão vereditos **opostos** (ex.: 9/10 + 1/2 → 70% vs 83%). Definir: fórmula, papel de `mastery_criteria_trials`, e filtro de status da sessão.
- **Nota (F2.6):** "C depende de A" **não é dependência técnica** — `active→mastered` já é válida no baseline. A dependência real de C é o item C1-a (âncora), que só existe *por causa* da reversão que a Fase A introduz.
- **Nota (F2.6):** C1 só na rota é bypassável por writer futuro (contrasta com o padrão-ouro do próprio plano: `score_pct GENERATED`). Registrar como decisão consciente, ou mover a validação para o trigger que a Fase A já vai reescrever.
- **Gap de UX (não é furo):** `mastery_criteria_sessions/trials` caem em default 3/10 no fluxo da tela do aprendiz (`page.tsx:323` não os envia; POST usa `|| 3, || 10`). Só a tela de sessão os coleta.

### FASE D — Motor CSO [G1] — REESCRITA v4 (a fase que mais mudou, três vezes)

**A história desta fase é a lição do projeto.** v1: "rodar o motor retroativamente". v2: "não dá, o motor recusa `completed` e reescreve datas — faça função dedicada". v3: "não adianta preservar datas, o CSO é **fabricável**". v4: "e mesmo fabricando, **o schema não deixa** — e se deixasse, daria nota 100".

#### O que a 3ª auditoria + banco vivo estabeleceram

**1. A opção (a) da Decisão 5 é INEXECUTÁVEL.** [CÓDIGO+PROVADO]
`session_snapshots` tem `sas/pis/bss/tcm/cso_aba numeric(5,2) NOT NULL` (`000:4527-4531`) + CHECKs 0-100 (`000:4535-4539`). O trigger `trg_validate_snapshot_cso` (`000:8409→2969-2985`) exige `cso_aba == calculate_cso_aba(sas,pis,bss,tcm)`. **Não existe coluna para marcar "retroativo/backfill"**, e `trg_immutable_session_snapshots` (`000:8367`) impede marcar depois. Guardar "só as dimensões reconstituíveis" exigiria **ALTER em tabela clínica imutável** — não planejado, não trivial, e de risco alto.

**2. E se derrubassem o NOT NULL, o resultado seria pior.** [PROVADO]
`SELECT calculate_cso_aba(NULL,60,70,NULL)` → **100.00**. `GREATEST/LEAST` ignoram NULL. Uma sessão medíocre de abril ganharia snapshot **permanente e imutável** de CSO 100 ("excelente"). É a fabricação na sua forma mais tóxica: parece autêntica, é irreversível, e infla a nota.

**3. O backfill contamina o FUTURO, não só o passado.** [CÓDIGO]
`compute_tcm` lê `clinical_states_aba ORDER BY created_at DESC LIMIT 4` (`000:877-886`), e `created_at DEFAULT now()` (`000:3350`). Se D2 (religar) rodar antes de D3 (backfill), as 20 linhas de abril nascem com `created_at` de julho → **a próxima sessão real fecha e usa abril como "história recente"** → CSO errado num snapshot novo, legítimo e imutável. Dano prospectivo.

**4. Contexto de execução é decisão, não detalhe.** [PROVADO]
O role `axis` é `rolsuper=t, rolbypassrls=t`. As 20 órfãs cruzam **3 tenants**. Logo: rodar D3 via psql ⇒ o bullet "setar `app.tenant_id`" é código morto (RLS não protege). Rodar via rota do app (`withTenant`) ⇒ **FORCE RLS esconde as órfãs dos outros tenants** ⇒ backfill parcial reportando sucesso. **D3 tem que declarar por onde roda.** E `withTenant` é transação única: 19 órfãs OK + 1 falha ⇒ **ROLLBACK dos 19**, operador acredita que ficaram.

**5. "Preservar `closed_at`" é impossível como escrito.** [CÓDIGO]
`closed_at` **não é coluna** de `sessions_aba` — vive dentro do `snapshot_json`, gerado com `NOW()` (`000:576-579`). `closed_by`/`engine_version` são NOT NULL (`000:4532-4533`) e o fechamento original (bypass) não registrou autor. O INSERT carimba a **engine de hoje** (`is_current`), não a da época — o snapshot mentiria sobre qual motor o produziu.

**6. D2 "reverter `0d44a0e`" é irrealizável como revert.** [CÓDIGO]
O commit **mistura** o bypass do motor com fixes P0 de access-control em 4 rotas (591+/429-). E removeu **`open_session_aba`** também, não só o close. D2 = **re-link cirúrgico** da chamada no branch de close atual (`sessions/[id]/route.ts:152-163`), nunca `git revert`. Decidir explicitamente o destino de `open_session_aba` (D1 só fala do fechamento).

**7. Boa notícia: PIS/BSS SÃO reconstituíveis.** [CÓDIGO]
`compute_pis` lê só `session_targets` (`000:781-786`). `compute_bss` lê `session_behaviors` com âncora determinística em `COALESCE(ended_at, scheduled_at)` (`000:658-695`) — independente da ordem do loop. Não são fabricáveis. *(Mas isso não salva a opção (a), que morre por schema.)*

**8. Motor certo está ativo.** [PROVADO] `engine_versions`: `CSO-ABA 2.6.1, is_current=t`. Risco de carimbar engine do TCC não se materializa hoje — mas o índice único é **global** (1 linha `is_current` na tabela inteira) e `close_session_aba:563` não filtra `engine_name`. Fragilidade estrutural a registrar.

#### Passos revisados

- **D0 (pré-checks).** Já respondidos: engine ✅ (CSO-ABA 2.6.1); corte 24/03→17/04 ✅ (zero sessões); role ✅ (superuser, bypassrls); tenants ✅ (3). **Falta:** decidir contexto de execução de D3 (psql vs rota) e obter a **Decisão 5**.
- **D1.** Versionar como migration real o pipeline de fechamento: `close_session_aba` + `compute_*`. Grafo completo (a v3 listava incompleto): `compute_full_cso → compute_sas/pis/bss/tcm/calculate_cso_aba/cso_aba_band`, **mais** `compute_mastery_score` (`000:845`), `intensity_to_scale` (`000:659`), `prompt_to_scale` (`000:781`) — as três verificadas como `IMMUTABLE` puras. Decidir destino de `open_session_aba`. NÃO tocar #16/#17.
- **D2.** Re-link cirúrgico da chamada `close_session_aba` no branch de close (`sessions/[id]/route.ts:152-163`). **Nunca `git revert` do `0d44a0e`** (commit misto). Vale para sessões NOVAS — CSO fiel porque o estado é contemporâneo.
- **D3.** ⚠️ **Depende inteiramente da Decisão 5.** Se (b) — não backfillar — D3 vira apenas *documentar a lacuna*. Se (a) — backfillar parcial — exige, ANTES: migration de schema (nullabilidade ou tabela paralela), ajuste dos 2 triggers de validação, proibição explícita de dimensão NULL na fórmula, e resolução do NULL→100. **Em qualquer caso**, se houver backfill: função dedicada (não o motor cru), transação/SAVEPOINT **por órfã** (não lote), relatório por órfã, contexto de execução declarado, `snapshot_json` especificado campo a campo (closed_at = `ended_at` original; closed_by; engine_version da época ou marcado; flag backfill + data real), e **D3 NÃO pode inserir em `clinical_states_aba`** — ou o TCM das sessões futuras é contaminado (item 3 acima).
- **D4.** Auditoria-prova dedicada + smoke manual antes de deploy. Reusar `compute_*` **por chamada** (proibido copiar fórmula — evita duas fontes de verdade). DROP da função de backfill após o uso.

**Recomendação técnica (não substitui a Decisão 5, que é do Alê):** dada a combinação de (1) schema imutável que não aceita dimensão ausente, (2) NULL→100 confirmado, (3) contaminação do TCM futuro, e (4) o `never retroactively recompute` do CLAUDE.md — a **opção (b)** (não backfillar CSO; documentar honestamente que "sessões de 24/03 até a correção não têm CSO por falha técnica conhecida, identificada e corrigida em [data]") é mais defensável perante uma seguradora do que qualquer número reconstruído. Menos bonito. Muito mais auditável.

### FASE B3 — Atestação/evidência [G3c] — depois de D3
O evidence bundle inclui o snapshot clínico e o funde no SHA256 (`evidence-bundles/route.ts:91-106,238-243`). Gerar bundle antes do snapshot existir = hash sobre dado incompleto. *(Se a Decisão 5 = opção (b) — sem backfill de CSO — este acoplamento precisa ser reavaliado: o bundle nunca terá snapshot para as órfãs, e isso deve ser documentado, não mascarado.)*
- ⚠️ **F4.2 (v4) — a causa afirmada em G3c não está provada.** O hook dispara atestação E bundle no **mesmo** fire-and-forget (`src/lib/session-close-hook.ts:13,48,114`). Mas o resultado é **18 atestações e 0 bundles** — isso não é flakiness de rede (seria proporcional), é **falha determinística do endpoint de bundle**. Candidata documentada: policy RLS com `app.current_org` (bug de 16/04, citado no cabeçalho do teste GUC). **B3 "server-side" corrigiria o lugar errado.**
- **B3 (revisado).** Passo 0: **diagnóstico** — reproduzir o POST do bundle e colar o erro real. Só então decidir o fix. A causa "fire-and-forget" vira corroboração, não conclusão (mesmo tratamento que o plano deu ao "30 pending").

### FASE E — Vínculo PEI [G5]
Por último.
- E1. Se Decisão 2 = persistir: coluna de atingimento + lógica + audit + reversão.

### FORA DE FASE — dívidas listadas para não sumirem
- **GAP #1:** `detect_regression` (Bible §6, "3 sessões <60% → regressão") está morto e **continua morto pós-D** — o motor não o chama. Se a regra clínica importa, é trabalho SEPARADO da Fase D. Decisão de negócio implícita: essa automação deve voltar?
- **GAP #3 / #19:** `generalization_status` nunca gravado. Tratar na Fase A ou marcar como dívida.
- **GAP #4:** `/api/aba/clinical-state` quebrada (`cso_score` vs `cso_aba`). Rota morta. Cosmético.

---

## 5. DECISÕES DE NEGÓCIO (só o Alê decide)

### DECISÃO 0 — Política de remediação histórica [a mais sensível]
Ao recuperar dado histórico (snapshots das 20 órfãs em D3, atestações das 31 em B3, correção das 15 adulteradas em B2-bis):
> Carimba com a **data original** (parece que sempre existiu) ou marca explicitamente como **"recuperado em 07/07/2026"** (honesto, expõe a lacuna)?

Isto é compliance, não técnica — é a primeira pergunta de uma fiscalização, e conflita com a regra `never retroactively recompute` do CLAUDE.md. **Trava D3, B3 e B2-bis.** Responder antes de tudo.

### DECISÃO 1 — `regression` fica ou sai?
Estado clínico legítimo (aluno regrediu), mas hoje inalcançável e sem saída. (a) consertar — dar entradas/saídas no trigger; (b) remover do enum/UI. Muda a Fase A inteira.

### DECISÃO 2 — Meta PEI "atingida" vira dado persistido, ou tela basta?
Define se a Fase E existe.

### DECISÃO 3 — Limiar de reprovação de sonda: qual a regra clínica correta?
Hoje aprovação usa `mastery_criteria_pct`, regressão usa 70 fixo → zona morta [70, critério) e sobreposição possível. Qual o comportamento clínico certo? (afeta A3+A4)

### DECISÃO 5 (reapresentada na v4 — a mais consequente) — CSO retroativo: backfillar ou documentar?
**A 3ª auditoria + banco vivo estreitaram esta decisão drasticamente.** O que sabemos:
- `compute_sas` lê status atual dos protocolos; `compute_tcm` ordena por `created_at` de inserção. SAS/TCM retroativos são **fabricados**, não recuperados. [CÓDIGO]
- PIS/BSS **são** reconstituíveis (leem só `session_targets`/`session_behaviors` com âncora determinística). [CÓDIGO]
- **MAS** `session_snapshots` tem `sas/pis/bss/tcm NOT NULL` + trigger que valida `cso_aba == calculate_cso_aba(...)`, e **nenhuma coluna para marcar "retroativo"**. A tabela é imutável por trigger. [CÓDIGO]
- **E** `calculate_cso_aba(NULL,60,70,NULL)` = **100.00** em produção. Dimensão nula ⇒ nota máxima permanente. [PROVADO]
- **E** inserir linhas de abril em `clinical_states_aba` hoje contamina o TCM das sessões **futuras**. [CÓDIGO]

> **Opção (a) — backfillar dimensões parciais:** exige migration de schema em tabela clínica imutável (nullabilidade ou tabela paralela), ajuste de 2 triggers de validação, e tratamento explícito do NULL→100. Alto risco, muito trabalho, resultado ainda parcial.
> **Opção (b) — não backfillar CSO:** documentar formalmente que "sessões fechadas entre 24/03/2026 e a correção do motor não possuem CSO, por falha técnica identificada, rastreada ao commit `0d44a0e`, e corrigida em [data]". Zero risco de fabricação. Expõe a lacuna — mas de forma auditável e defensável.
> **Opção (c) — outra**, se o Alê enxergar caminho que não vimos.

**Recomendação técnica:** opção (b). Um relatório honesto com lacuna documentada é mais defensável perante uma seguradora do que 20 snapshots reconstruídos que não resistem à pergunta "como você calculou isto em julho para uma sessão de abril?".

### DECISÃO 4 (implícita — GAP #1) — `detect_regression` por sessão deve voltar?
A automação "3 sessões <60% → regressão" está morta. Restaurar (trabalho à parte) ou deixar como está?

---

## 6. PLACAR DE VERIFICAÇÃO (07/07/2026)

| Achado | Selo | Evidência |
|--------|------|-----------|
| G1 motor CSO desligado (commit `0d44a0e`) | PROVADO+CÓDIGO | 29 c/ snapshot até 12/03, 20 s/ após; diff do commit |
| G3a auditoria sem autor | PROVADO | 99 logs, 0 autor real |
| G3b sessão editável pós-fim | PROVADO | 15 editadas após ended_at; 13 override |
| G2 regression zumbi / sonda pending | PROVADO+CÓDIGO | trigger s/ regression; 30 pending; 0 em regression; CHECK |
| G2b 8 botões 500 | CÓDIGO | validTransitions vs trigger |
| G2c limiar duplo | PROVADO | critérios 70/80/85 vs 70 fixo |
| G3c atestação furada | PROVADO | 18/0/0 de 49 |
| G5 meta PEI não persiste | PROVADO | pei_goals sem coluna status |
| G4 Dominado sem validação | CÓDIGO | grava status do body sem checar scores |
| score_pct protegido | PROVADO | GENERATED ALWAYS |
| #16/#17, #19, #20, engine_versions, corte 24/03 | A VERIFICAR | relevância na fase correspondente |

---

## 7. PRÓXIMOS PASSOS

1. ✅ Verificação de achados (banco + código).
2. ✅ 1ª revisão crítica (9 furos → v2).
3. ✅ 2ª auditoria (5 furos → v3) — CSO fabricável.
4. ✅ 3ª auditoria adversarial (15 furos → v4) + 8 queries de confirmação no banco vivo.
5. **Alê responde as 6 decisões (0 a 5).** A **Decisão 5** agora tem recomendação técnica clara (opção b). A **Decisão 0** continua aberta.
6. Alê lê frio, aponta furo final, fecha.
7. Só então executar, um bloco por vez, smoke manual do Alê a cada bloco.

**Ordem de execução sugerida (v4):**
`F` (Google sync quebrado — funcionalidade morta em prod) → `A` (máquina de estados) → `B1/B2/B2-bis` (rastreabilidade) → `C` (Dominado) → `D` (motor, conforme Decisão 5) → `B3` (evidência, com diagnóstico primeiro) → `E` (PEI).

*A Fase F sobe para o topo porque é funcionalidade quebrada em produção agora, com fix pequeno e isolado.*

---

## 8. ESTADO REAL DE PRODUÇÃO (07/07/2026, fim do dia)

**No ar:**
- **P0** — confirmação (`window.confirm`) antes de marcar "Dominado". Commitado (`bc52001`), buildado e deployado no VPS. Testado em produção: funciona.
- **Incêndio da cliente** — protocolo `c7759184-...` (Maria Fernanda, "Foco e Atenção") revertido de `mastered` → `active`, `mastered_at` limpo, via UPDATE manual no psql com trigger desabilitado dentro de transação. `COMMIT` confirmado.

**Pendente / NÃO no ar:**
- **P1 (reverter `mastered→active`)** — código alterado no working tree (`app/aba/aprendizes/[id]/page.tsx`, `app/api/aba/protocols/[id]/route.ts`) + `scripts/migrations/075_aba_allow_mastered_to_active.sql` criada. **O commit foi BARRADO pelo Husky** (validador de migrations: última linha deve ser `COMMIT;`). A migration foi corrigida (fechamento `BEGIN;`/`COMMIT;` — validado: última linha é `COMMIT;`), **mas o commit nunca foi refeito.** Estado: **staged, não commitado, não aplicado.** `SELECT * FROM _migrations WHERE version='075'` → 0 rows. `git log --all -- scripts/migrations/075_*.sql` → vazio.
  - ⚠️ **A v3 afirmava "P1 commitado no GitHub" — ERRO, corrigido aqui.**
  - Vantagem: a 075 pode ser reescrita livremente (sem conflito de checksum), o que a Fase A exige de qualquer forma (migration única com definição final do trigger).

**Ambiente:**
- VPS `147.93.191.64`, db `axis_tcc`, container `axis-postgres`, user `axis` (superuser, `rolbypassrls`).
- Deploy: `cd /root/axis-tcc && git pull && rm -rf .next && npm run next:build && pm2 restart all`.
- `bash` não existe no PowerShell local do Alê — validações de hook rodam via `Get-Content`.

---

## 9. PENDÊNCIAS FORA DO PLANO TÉCNICO
- **Modal bonito** (troca a caixa preta nativa do P0/P1 por modal no CSS do projeto) → virou item **A8**.
- **1 protocolo com `mastery_criteria_trials = 1`** — investigar se é erro de cadastro.
- **Fragilidade estrutural:** índice único **global** de `engine_versions.is_current` (só 1 linha `is_current` na tabela inteira) + `close_session_aba:563` não filtra `engine_name`. Hoje inócuo (CSO-ABA é o current), mas se outro motor for ativado, snapshots ABA carimbam engine errada.
- **F1.9:** a função de backfill (se existir) deve **chamar** `compute_pis/compute_bss`, nunca copiar a fórmula (evita duas fontes de verdade), e ser dropada após D4.

---

## APÊNDICE — Créditos de verificação e o que NÃO foi quebrado

**Trilha de verificação (07/07/2026):**
- Achados confirmados contra banco de produção via psql (3 rodadas de queries).
- Causa-raiz G1 isolada por investigação git (commit `0d44a0e`, 24/03/2026 20:35).
- 1ª revisão crítica: 9 furos → v2 (Fase D impossível/perigosa, ordem B↔D, Decisão 0 ausente).
- 2ª auditoria: 5 furos → v3 (CSO fabricável — `compute_sas`/`compute_tcm` leem estado mutável).
- 3ª auditoria adversarial (método localizar→confrontar→simular→quebrar): 15 furos → v4. Os decisivos: Decisão 5(a) inexecutável no schema; NULL→100; contaminação prospectiva do TCM; Google sync quebrado; 075 não commitada.
- 8 queries de confirmação no banco vivo resolveram todas as bifurcações da 3ª auditoria.

**O que foi atacado e NÃO caiu (registro de robustez):**
- PIS/BSS não são fabricáveis por rota existente (guards de `in_progress` no banco; DELETE de trial guardado; LGPD não toca scores).
- Double-close concorrente / backfill duplicado: `uq_one_snapshot_per_session` + `uq_clinical_state_per_session` + `ON CONFLICT` ⇒ termina em 23505 + rollback, sem corrupção.
- BSS não depende da ordem do backfill (âncora em timestamps imutáveis).
- B1 não vaza para TCC/TDAH (só 2 triggers consomem `app.user_id`, ambos com COALESCE; nenhuma policy lê).
- `close_session_aba` nunca virou migration — confirmado por grep em `scripts/` inteiro.
- Aritmética do G2b exata: 19 transições na UI, 8 rejeitadas, 8 válidas escondidas.
- Todas as citações [CÓDIGO] do plano conferidas linha a linha — batem.
- Nenhuma segunda rota grava `'mastered'` — C1 na rota única fecha G4 na camada de app.
- Números [PROVADO] internamente consistentes: 49−29=20 ✓; 18+31=49 ✓.

**Lição do processo:** cada auditoria achou o que a anterior não viu, e o método importou mais que o modelo. Prompts que mandam *provar/simular/quebrar* cavam fundo; prompts que mandam *revisar* concordam. A Fase D foi reescrita três vezes — e cada reescrita evitou um dano real em produção clínica.
