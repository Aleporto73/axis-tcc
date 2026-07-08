# PLANO DE CORREÇÃO — AXIS ABA (v8)
## Integridade de Dado Clínico + Máquina de Estados

**Data:** 08/07/2026
**Versão:** 8 (7 auditorias adversariais + 3 rodadas de queries + régua clínica)
**Módulo:** ABA (`app/aba/*`, `app/api/aba/*`, schema/migrations ABA)
**Natureza:** documento de PLANEJAMENTO. Nenhuma correção aplicada.
**Status:** **EXECUTÁVEL.** Auditoria final (auditor externo, sem histórico) verificou ~30 citações `[CÓDIGO]` e **não derrubou nenhuma**. Premissa central e recomendação central **sobreviveram** ao ataque. Os 5 refinamentos desta versão estão incorporados.

---

## ⚠️ LEIA ISTO PRIMEIRO

### A régua
**As versões 1 a 5 mediam gravidade por "reprova a auditoria da seguradora?".** Estava errado.

O AXIS ABA existe para que **o profissional acompanhe a evolução do aprendiz e seja avisado quando ele regride**. A operadora é consequência, não propósito.

**A régua é:** *o profissional consegue fazer o trabalho dele, e a criança é protegida?*

**Corolário que a 7ª auditoria provou na prática:** *dado errado que o profissional VÊ é pior que dado ausente.* Foi seguindo esse corolário que ela achou o furo que 6 auditorias não viram — inclusive esta que escreve.

### Os três problemas que definem o projeto

> **1. O alerta de regressão nunca disparou — por DOIS canais paralelos, ambos mortos.**
> - Canal *polled*: `alerts/route.ts:26` filtra `regression_count > 0`. O contador é **0 na clínica inteira** (o único writer, `maintenance/route.ts:79`, acopla o incremento ao `status='regression'`, que o trigger rejeita ⇒ rollback).
> - Canal *push*: `notifications/route.ts:61-78` → `notify_regression_detected` (`000:1879-1896`) → notifica o **supervisor**. **Infra completa, ZERO CALLERS.**
> - ⚠️ **Correção da v7 (7ª auditoria):** eu escrevia que o Canal B também estava morto "porque lê `regression_count`". **Falso.** Lendo o corpo da função: o único early-return é `NOT FOUND OR supervisor_id IS NULL`. `regression_count` **não é gate** — aparece só no texto e na **chave de idempotência**. O Canal B está morto **exclusivamente por zero callers**. (Isso importa — ver a armadilha no FG-1.)
>
> **Precisão sobre o "silêncio":** no *frontline* não é silencioso. O profissional que registra uma sonda <70 recebe **erro 422** e o resultado é **descartado (rollback)**. Ele re-tenta e re-falha. O silêncio é no **agregado**, no **registro persistente**, e no **supervisor**. É *hard block + agregado falso*, não *miss silencioso*.

> **2. O motor CSO está desligado desde 24/03.** O profissional **não vê a curva de evolução de nenhum aprendiz** há mais de 3 meses. Escopo: todo aprendiz, todo protocolo ativo.

> **3. [NOVO — 7ª auditoria] A tela do aprendiz mostra CSO de março rotulado como "CSO atual".**
> `aprendizes/[id]/page.tsx:365` pega `csoHistory[último]` e `:394` o renderiza sob o rótulo **"CSO atual"** — sem data, sem flag de staleness. O endpoint (`cso-history/route.ts:11`, `ORDER BY ended_at ASC`) é honesto: devolve uma série datada. **A página é que mente**, ao rebatizar o último ponto de "atual".
> Para um aprendiz com snapshots até 12/03 e sessões órfãs depois (a população exata do G1), a tela clínica primária exibe um valor de até **4 meses atrás como se fosse de hoje**.
> **Eu descartei `cso-history` como "lacuna honesta, não dado errado" no apêndice da v7. Errado — eu parei no endpoint e não segui o dado até a tela.**

**Nota de precedência:** os problemas 1 e 2 são **ambos CRÍTICOS**. O alerta atinge protocolos em manutenção com sonda <70; o motor cega o profissional sobre **todos**. A ordem entre eles é escolha, não dedução.

Isso é o produto quebrado. A seguradora foi o canário.

---

**Histórico de versões:**
- v1→v2: Fase D reescrita (motor recusa `completed`, reescreve datas). *(9 furos)*
- v2→v3: CSO retroativo é **fabricável**. Criou a Decisão 5. *(5 furos)*
- v3→v4: Decisão 5(a) **inexecutável**; **NULL→100** em prod; backfill contamina o TCM futuro; Google sync quebrado. *(15 furos)*
- v4→v5: relatório de convênio autocontraditório; Fase F é over-correction grave; 0 bundles = feature gate. *(27 agentes)*
- v5→v6: **mudança de régua** (clínica, não contratual) + 3 refinamentos + plano versionado.
- v6→v7: segundo canal de alerta (também morto); A9 (3º modelo da máquina de estados); FG-3 dividido; nomenclatura de-colidida.
- **v7→v8 (esta):** 7ª auditoria — **auditor externo, sem histórico, instruído a reprovar.** Verificou ~30 citações `[CÓDIGO]`: **nenhuma derrubada.** Caçou um terceiro canal de alerta: **não existe.** Confirmou que nenhuma migration pós-baseline altera o trigger (o diagnóstico é rocha, não dump desatualizado). Achou 5 refinamentos:
  1. **[FURO A, MÉDIO-ALTO]** A tela do aprendiz mostra CSO velho como "atual". **FG-2 ampliado.** *Cai exatamente na régua que este plano definiu — e nenhuma das 6 auditorias anteriores viu.*
  2. **[FURO B, MÉDIO]** **FG-4 estava sequenciado antes de D**, mas seu cutoff É a data de correção do motor (D). No passo 5 essa data não existe ⇒ ou a regra é inconfigurável, ou gera a enxurrada de flags que ela existe para evitar. **FG-4 movido para depois de D.**
  3. **[FURO C, MÉDIO]** A razão de morte do Canal B estava errada (zero callers, não a leitura do contador) — **e a razão errada escondia uma over-correction**: a chave de idempotência embute `regression_count`.
  4. **[FURO D, BAIXO]** "19 transições / 8 rejeitadas" descreve o **working tree congelado**. Em produção são **18/7**. *(Mesma classe de defeito que o A9 denuncia. Ironia registrada.)*
  5. **[FURO E, BAIXO]** B1 **vaza** para o TDAH (benignamente): `session_summaries` é escrito por ABA e TDAH, e seu trigger de auditoria lê `app.user_id`.
  6. **[RACHADURA]** Minha alegação "`compute_tcm` retorna 75 neutro com <2 estados" é **off-by-one**: `v_count` já inclui o SAS atual ⇒ neutro só com **zero** estados anteriores. *(Isso reforça a opção (b), não a enfraquece.)*

---

## 0. COMO LER ESTE DOCUMENTO

✅ **Nomenclatura de-colidida (v7).** A v6 tinha `G1` (diagnóstico) e `G-1` (tarefa) diferindo por um hífen — três pares colidiam nas mesmas tabelas. Resolvido por renome, não por aviso:
- **`G1, G2, G3a, G3b, G3c, G4, G5`** = **grupos do DIAGNÓSTICO** (o que está quebrado).
- **`FG-1 … FG-6`** = **tarefas da FASE G** (o que fazer). O prefixo `FG` não colide com nada.
- Demais fases: `A1…A8`, `B1/B2/B2-bis`, `C1`, `D0…D4`, `F1…F4`, `E1`.

Selo de confiança por achado:
- **[PROVADO]** — confirmado por query no banco vivo de produção (VPS `147.93.191.64`, db `axis_tcc`) em 07/07/2026. A query e o resultado estão colados na seção 2.
- **[CÓDIGO]** — confirmado por leitura de código/commit real com `arquivo:linha` ou hash.
- **[A VERIFICAR]** — ainda não confirmado. Não vira tarefa sem prova.

**Regra de ouro:** nada entra em execução sem selo [PROVADO] ou [CÓDIGO]. E — regra nova da v2 — nenhum backfill histórico acontece antes da Decisão 0 estar respondida.

---

## 1. RESUMO EXECUTIVO — ordenado por DANO AO APRENDIZ

| # | Problema | Selo | Dano clínico | Reprova seguradora? |
|---|----------|------|--------------|---------------------|
| **FG-1** | **O alerta de regressão nunca disparou — por DOIS canais paralelos, ambos mortos** (polled + push ao supervisor) | **[PROVADO]+[CÓDIGO]** | **CRÍTICO — criança piorando sem aviso ao supervisor; profissional bate em 422** | SIM |
| **G1 + FG-2b** | Motor CSO desligado desde 24/03 **e a tela do aprendiz mostra CSO de março rotulado "CSO atual"** | **[PROVADO]+[CÓDIGO]** | **CRÍTICO — profissional cego, e o que ele vê está errado (escopo: TODOS)** | SIM |
| G4 | "Dominado" sem validação — marco clínico por clique | **[CÓDIGO]** | **ALTO — marco falso no prontuário** | SIM |
| G2 | `regression` é estado-zumbi; reprovação de sonda <70 não persiste | **[PROVADO]+[CÓDIGO]** | **ALTO — falha clínica descartada por rollback** | SIM |
| FG-3 | Relatório de convênio autocontraditório | **[CÓDIGO]** | ALTO (dado errado circulando) | **SIM** |
| A9 | 3 modelos divergentes da máquina de estados; **testes certificam o que a produção rejeita** | **[CÓDIGO]** | MÉDIO — falsa confiança | Não |
| G3b | Sessão concluída editável (28 sessões afetadas) | **[PROVADO]** | MÉDIO | SIM |
| G3a | Auditoria sem autor: 99 mudanças, 0 com autor real | **[PROVADO]** | MÉDIO | SIM |
| G2b | **7** botões da UI dão erro 500 em produção (8 no working tree congelado) | **[CÓDIGO]** | MÉDIO — profissional trava | Não |
| G2c | Limiar duplo de sonda cria zona morta (70/80/85 vs 70 fixo) | **[PROVADO]** | MÉDIO | SIM |
| F3.1 | Google sync ABA morto (grava valor fora do enum) | **[PROVADO]** | BAIXO — conveniência | Não |
| G5 | Meta PEI "atingida" não persiste | **[PROVADO]** | BAIXO | Parcial |
| FG-6 | `completeness_pct=0` em claim-packets | **[CÓDIGO]** | NENHUM — maquinaria de convênio | SIM |
| G3c | 0 evidence bundles | **[PROVADO]** | NENHUM — **feature gate, não bug** | Não |

**Mudança de régua (v6):** as versões anteriores ordenavam por "reprova seguradora?". Repare como a coluna de dano clínico reordena tudo. `completeness_pct` e bundles são administrativo.

**Ressalva de precedência (v7):** FG-1 e G1 são **ambos CRÍTICO**. FG-1 tem escopo menor (protocolos em manutenção com sonda <70); G1 cega o profissional sobre **todos**. A ordem entre eles é escolha, não dedução — a v6 afirmava supremacia de FG-1 como se fosse provada.

**O que a auditoria Fable ERROU (corrigido pela verificação):** afirmou "motor CSO totalmente morto, nunca chamado". FALSO. O motor funcionava (29 sessões têm snapshot, jan–12/mar) e foi **desligado por um commit** (`0d44a0e`, 24/03). Correção = "religar de forma segura", não "reconstruir".

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

### G2b — 7 botões dão 500 em PRODUÇÃO (8 no working tree) [CÓDIGO]

⚠️ **CORREÇÃO DA v7 (FURO D, 7ª auditoria) — eu contabilizei código que a produção não executa.**
- **Produção (HEAD):** `git show HEAD:app/aba/aprendizes/[id]/page.tsx` → linha 21 = `mastered:['generalization','regression']` ⇒ **18 transições, 7 rejeitadas pelo trigger.**
- **Working tree (P1 congelado):** `mastered:['generalization','regression','active']` ⇒ 19 transições, 8 rejeitadas. A 8ª (`mastered→active`) **só existe no working tree**, que a seção 8 declara **NÃO no ar**.
- *Ironia registrada:* é a mesma classe de defeito que o **A9** denuncia (certificar comportamento que a produção não roda). A direção do fix (reconciliar UI × trigger) permanece; o número é que estava errado.

`validTransitions` (`app/aba/aprendizes/[id]/page.tsx:21`) em **produção** oferece 18 transições; **7 rejeitadas** pelo trigger:
`draft→archived`, `mastered→regression`, `generalization→regression`, `mastered_validated→regression`, `maintenance→regression`, `maintained→regression`, `regression→active`.
*(O 8º — `mastered→active` — existe só no working tree congelado do P1.)*
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

## 2c. QUERIES DA 4ª RODADA (08/07/2026) — resolvem 3 incertezas

### ✅ Os "0 evidence bundles" são FEATURE GATE, não bug [PROVADO — corrige erro da v4]
```sql
SELECT plan_tier, count(*) FROM tenants t JOIN session_attestations sa ON sa.tenant_id=t.id GROUP BY 1;
-- founders | 18
```
**Todos** os 18 tenants com atestação são `founders`. E `src/lib/operadora-gate.ts:76` define `FOUNDERS_ACCESS.evidenceBundles: false` (contra `attestationsTherapist: true`, linha 74). Ambos os POSTs saem do mesmo hook (`session-close-hook.ts:48` e `:114`), mesma sessão, mesmo tenant, mesmo tier — mas carregam **feature-keys diferentes**. `requireFeature(ctx,'evidenceBundles')` (`evidence-bundles/route.ts:73`) lança **403 PlanGateError antes de qualquer RLS**.
> **0 bundles é correto-por-design.** A v4 acusava "policy RLS com `app.current_org`" — ERRADO. B3 "server-side" consertaria o lugar errado. **G3c rebaixado:** não é bug técnico, é decisão comercial (founders devem ter bundles?). Vira **Decisão 6**.

### ✅ `activated_at` NULL não existe — risco descartado [PROVADO]
```sql
SELECT count(*) FROM learner_protocols WHERE status IN ('active','mastered') AND activated_at IS NULL;
-- 0
```
C1-a não precisa de guarda `activated_at IS NULL`. Furo F2-4 da 4ª auditoria: **refutado pelo banco**.

### ✅ O incêndio NÃO furou o C1-a — mas o vetor é real [PROVADO — refuta F2-2]
```sql
SELECT activated_at, mastered_at, status FROM learner_protocols WHERE id='c7759184-ae0f-4e8a-a0d6-cd5fc95b863e';
-- activated_at: 2026-07-07 13:06:24 | mastered_at: (null) | status: active
```
A 4ª auditoria previu que a reversão manual via psql (que não bumpa `activated_at`) deixaria a âncora velha, furando C1-a. **Não se materializou:** o `activated_at` é de hoje 13:06 — o protocolo foi criado/ativado no mesmo dia do teste.
> **Mas o raciocínio permanece válido em geral:** um revert manual via psql **não** atualiza `activated_at`. Aqui não deu problema por coincidência (protocolo novo). Em protocolo antigo, daria. **Registrar como risco do vetor psql**, não como furo confirmado. C1-a deve ancorar em algo que o psql não contorne — ou o revert deve ser sempre feito pela rota.

---

## 3. ACHADOS [A VERIFICAR] (relevância só na fase correspondente)

- **#16/#17** — functions SQL com colunas inexistentes + INSERTs de auditoria inválidos. **Revisão apontou (furo #8):** NENHUMA está no caminho de `close_session_aba` (que chama só `compute_full_cso`→`compute_sas/pis/bss/tcm/calculate_cso_aba/cso_aba_band`, todas puras). Portanto **não bloqueiam a Fase D**. São código morto a limpar à parte. Verificar só se/quando religar `detect_regression`/generalização.
- **#19** — `generalization_status` nunca atualizado → `compute_mastery_score` nunca dá 85. Domínio da Fase A. Verificar na Fase A.
- **#20** — `cancelled` inalcançável via app. Baixa gravidade.
- **`engine_versions.is_current`** — pré-condição da Fase D (ver furo #7 / D0). O motor aborta sem uma linha `is_current=TRUE`. Seeds existem só em `legacy/` com coluna inconsistente (`is_active` vs `is_current`). Provavelmente OK em prod (as 29 antigas ganharam snapshot), mas **verificar explicitamente antes de D**.
- **Corte 24/03 vs 17/04** — confirmar se houve fechamento entre as datas (define o alvo do backfill).

---

## 4. PLANO DE EXECUÇÃO (v6 — ver seção 7 para a ordem)

> **A ordem de execução real está na seção 7** — com as dependências honestas (a v5 afirmava que a Fase G era independente; era falso).
> As fases abaixo estão descritas em detalhe, **não em ordem de execução**. A régua da v6 é **dano ao aprendiz**, não risco contratual.

Princípio: menor risco e maior alívio primeiro; motor (Fase D) por último, sob a Decisão 5.

### DECISÃO 0 — obrigatória antes de qualquer backfill (ver seção 5)
Política de remediação histórica. Trava D3, B3 e a remediação das 28 sessões adulteradas.

### FASE A — Máquina de estados [G2 + G2b + G2c]
**Ordem interna corrigida (furo #2 v2 + furo D v3): todas as mudanças de trigger colapsam em UMA definição final da função; só então reconciliar a UI.**

⚠️ **Furo D (v3) — clobber de trigger:** A1 e A2 fazem `CREATE OR REPLACE` da MESMA função `trg_fn_validate_protocol_transition`. A migration 075, como está, reescreve o corpo INTEIRO da função sobre o baseline, SEM a mudança de regression. Se A1 (fix regression) rodar antes de A2 (075), a 075 **apaga** o fix de A1. **Solução:** A1+A2 NÃO são migrations separadas — são UMA única migration com a definição FINAL da função (regression + mastered→active juntos). Nunca duas em sequência sobre a mesma função.

- A1+A2 (unificado). Escrever UMA migration com a definição final do trigger: destino de `regression` (Decisão 1) + `mastered→active` (075) na mesma função. Fecha o P1 pausado.
- A3. Corrigir persistência de reprovação de sonda (Decisão 3). ⚠️ **Furo B (v3) — segundo rollback escondido:** corrigir o trigger NÃO basta. Na mesma transação, `maintenance/route.ts:90` grava `maintenance_probes SET status='cancelled'`, valor que **viola o CHECK** `maintenance_probes_status_check` (só admite `pending`/`completed`, `000:3876`). Hoje está mascarado (o trigger aborta antes na linha 79). Ao liberar `maintenance→regression` no trigger, a execução alcança a linha 90 e **rolla de novo** no CHECK da sonda. **Solução A3 precisa incluir:** `ALTER` do `maintenance_probes_status_check` para admitir `'cancelled'` (ou trocar o valor gravado). Sem isso, "consertar a regressão" continua quebrado.
- A4. Corrigir limiar duplo — eliminar zona morta 70-vs-critério (Decisão 3).
- **A7 (novo v4 — F2.1):** ao expor `maintenance→active` (transição válida que a UI esconde hoje), surge uma bomba: nada cancela as sondas `pending` ao sair de `maintenance`, e a rota de avaliação não recheca o status do protocolo (`maintenance/route.ts:55`). Depois da saída: score<70 tenta `active→regression` (inválida); 3/3 aprovadas tenta `active→maintained` (**não existe no trigger**) → exceção → rollback da avaliação inteira. **A5 precisa incluir:** cancelar/invalidar sondas pending ao sair de maintenance + rota de avaliação rechecar status antes das linhas 79/109.
- **— trigger + constraints congelados aqui —**
- A5. Reconciliar `validTransitions` (UI) contra o trigger FINAL: remover botões que ainda dão 500, expor as transições válidas hoje escondidas. **Cuidado com F2.1 acima.**
  - ⚠️ **OVER-CORRECTION (F3-1, 4ª auditoria): expor as transições escondidas abre atalho para o estado terminal "Mantido" sem nenhuma sonda.** O trigger permite `generalization→maintained` e `mastered_validated→maintained` (`075:44-45`); a UI hoje os esconde. Sondas só nascem ao entrar em `maintenance` (`protocols/[id]/route.ts:52`). Após A5, um clínico clica `→ Mantido` e o protocolo chega ao estado terminal bom **sem nunca criar nem passar uma única sonda** — fabrica um marco auditado pelo pagador, sem evidência. **A7 não cobre isso** (está escopado a `maintenance→active`).
  - **Solução A5:** NÃO expor `generalization→maintained` nem `mastered_validated→maintained` sem antes decidir se o pulo de sondas é clinicamente legítimo.
  - ⚠️ **OVER-CORRECTION DA CORREÇÃO (O-2, 5ª auditoria):** a v5 dizia "se não for legítimo, **remover do trigger**". Cuidado — essas transições **são válidas hoje em produção** (só escondidas na UI). Removê-las do trigger é restrição de comportamento existente. Se algum protocolo já as usa via API, ou se a migration do trigger remover mas o `validTransitions` da UI não for reconciliado **no mesmo passo**, você **re-introduz o G2b** (botão → 500) que a Fase A existe para matar.
  - **Query obrigatória antes de decidir:** `SELECT status, count(*) FROM learner_protocols WHERE status IN ('generalization','mastered_validated') GROUP BY 1;`
- A6. Tratar erro do banco no PATCH → 422 com motivo. ⚠️ **Furo C (v3) + F2.2 (v4) — o 422 é mais delicado do que parece:**
  - `sessions/[id]/route.ts:223` só vira 422 quando a mensagem contém `'[AXIS ABA]'`.
  - Mas o PATCH aceita `status` **cru do body** (`protocols/[id]/route.ts:8,17`) — valor fora do enum dá **22P02**, que não é 23xxx → continua 500 mesmo pós-A6.
  - E mapear "23xxx inteiro" é pior: repassa mensagem do PG com **nome de constraint** ao usuário, e converte violações de FK/NOT NULL (23503/23502 — bugs de programação) em "422 de validação" invisível na telemetria.
  - **Solução A6:** allowlist constraint→mensagem amigável (só 23514 conhecidos + `[AXIS ABA]`); validar enum no body (22P02); demais 23xxx continuam 500 **logado**.
  - Nota (F2.4): o exemplo `ck_discontinued_requires_reason` da v3 **não é alcançável pela UI** (o `window.prompt` obriga o motivo) — é risco de fronteira de API. O caso de UI real é `maintained→archived` com `maintained_at NULL` → `ck_archived_requires_maintained` (`000:3780`) em linhas legadas.
- **A8 (layout):** trocar a caixa preta nativa (`window.confirm`) por modal no CSS do projeto. Serve P0 (Dominado) e P1 (reverter) de uma vez. Baixa prioridade técnica, mas é ajuste real e pendente.
- **A9 (novo v7 — 6ª auditoria) [MÉDIO]: reconciliar o TERCEIRO modelo da máquina de estados.**
  `src/engines/protocol-lifecycle.ts:46-51` define um `VALID_TRANSITIONS` em TypeScript que **inclui `regression` como estado de 1ª classe** (`mastered→regression`, `regression→active`). É importado **só por testes** (`__tests__/`, `src/tests/`).
  **Consequência:** os testes **certificam uma máquina de estados que a produção não roda** — o trigger SQL rejeita exatamente essas transições. Há então 3 modelos divergentes: (1) trigger SQL (produção), (2) `validTransitions` na UI, (3) `protocol-lifecycle.ts` nos testes.
  **A Fase A reescreve o trigger.** Se não reconciliar os três no mesmo passo, os testes continuam validando o que o banco rejeita — e a próxima pessoa confia no teste.

**Correção da justificativa do Furo D (F2.5):** a v3 dizia "se A1 rodar antes de A2, a 075 apaga o fix". A direção estava invertida — a 075 já existe numerada, então uma migration nova seria ≥076 e rodaria **depois**. O clobber real é a **076 escrita a partir do corpo do baseline** (sem a linha da 075) apagar o `mastered→active`. A solução (migration única com definição final) **continua correta**; a justificativa é que estava errada. Pré-check obrigatório: `SELECT * FROM _migrations WHERE version='075';` em prod **e** staging (o runner valida checksum — reescrever migration já aplicada aborta com CONFLITO, `migrate.sh:279-293`). **Em prod: 0 rows — a 075 nunca foi aplicada, pode ser reescrita livremente.**

**Dependência:** A é pré-requisito de **C** (validar Dominado precisa da máquina limpa). NÃO é pré-requisito técnico de D — `close_session_aba` não escreve em `learner_protocols` (furo #3). Fazer A antes de D é ok por prudência, não por dependência.

### FASE B — Rastreabilidade / integridade de registro [G3a + G3b]
- **B1.** Setar `app.user_id` no `withTenant` → auditoria com autor real.
  - ⚠️ **CORREÇÃO (F3-2, 4ª auditoria): a justificativa da v4 era FALSA.** A v4 dizia "sem atualizar `ALLOWED_GUCS` ⇒ CI vermelho". Não é verdade: o teste 1 (`operadora-guc-contract.test.ts:104-107`) checa só o **primeiro** `set_config` de `with-tenant.ts` (via `.match()`); os testes 2/3 (`:111,128`) escaneiam **migrations** via `readMigrationFiles()`, nunca `with-tenant.ts`. **Anexar** `set_config('app.user_id',...)` depois da linha 203 ⇒ **zero testes falham**. Só *reordenar* (user_id antes de tenant_id) quebraria o teste 1.
  - ⚠️ E pior: adicionar `app.user_id` ao `ALLOWED_GUCS` **re-legitima um GUC que o próprio comentário do teste (`:42-44`) marca como legacy-morto**, enfraquecendo o contrato de migrations. **Não fazer.**
  - **Solução B1:** anexar o `set_config` após o `app.tenant_id` (nunca antes). Não tocar `ALLOWED_GUCS`. (Definir qual id: `userId` ou `profileId`.)
  - ⚠️ **FURO E (7ª auditoria) — B1 VAZA para o TDAH, benignamente. A v7 afirmava "não vaza". Errado.**
    - `with-tenant.ts:203` é o resolver **compartilhado** (ABA/TCC/TDAH).
    - O trigger `trg_summary_audit` (baseline `:8388`) dispara em `session_summaries` e **lê `app.user_id`**.
    - `session_summaries` é escrito por **ambos** `app/api/aba/sessions/[id]/summary` **e** `app/api/tdah/sessions/[id]/summary`.
    - ⇒ Pós-B1, as mudanças de resumo do **TDAH** passam a gravar o usuário real em vez de `'system'`.
    - **Efeito: benigno** (auditoria melhor; a coluna aceita texto). **Mas declare**, e note que a sub-decisão `userId` vs `profileId` afeta o TDAH também.
  - ✅ **A outra metade do isolamento SE SUSTENTA (verificado):** `app_user_id()` tem **zero callers** e **nenhuma POLICY** lê `app.user_id`. **Não há vazamento de RLS nem de dado.** O efeito se limita ao campo autor da auditoria.
  - ⚠️ **Sub-decisão técnica não resolvida:** se `axis_audit_logs.user_id` for UUID e B1 injetar o `userId` do Clerk (string tipo `user_3Aaz...`), o insert dá **22P02**. Verificar o tipo da coluna antes de escolher `userId` vs `profileId`.
  - ⚠️ **F4-4 (2º writer não-auditado):** o cron `scan-integrity` usa Pool cru com `set_config` manual e nunca seta `app.user_id`.
- **B2.** ⚠️ **REDESENHAR — F3.2 + F3.4 (v4):**
  - **F3.2 — a atribuição causal da v3 estava errada.** Nenhum código ATUAL produz `updated_at > ended_at` em sessão `completed`: o PATCH de override **não seta `updated_at`**; o bypass de fechamento também não; não há trigger de `updated_at` em `sessions_aba`. **As 15 vieram de código antigo ou de UPDATE manual via psql.** (E o role `axis` é superuser com bypassrls — psql direto é caminho aberto.) **Consequência:** bloquear a rota não teria prevenido as 15, e não previne futuras via banco.
  - **F3.4 — bloqueio duro MATA um fluxo de compliance vivo.** `duration_minutes_override` é editado **por design pós-fechamento** (`sessoes/[id]/page.tsx:664-669`, rótulo "Corrigida: X min") e alimenta `actual_hours` vs `authorized_hours_week` do integrity-scanner (`src/engines/integrity-scanner.ts:296-301`). 13 de 49 sessões usam. Bloquear ⇒ correção de duração impossível ⇒ **relatório de horas do payer errado**, exatamente o dado que a operadora audita.
  - **Solução B2:** fixar a variante **"motivo obrigatório + audit log"** (carve-out auditado para `duration_minutes_override`/`applied_by`), NÃO bloqueio duro. A v3 apresentava as duas variantes como equivalentes — não são.
  - **Adicional:** considerar trigger de imutabilidade real em `session_targets`/`session_behaviors` para sessões `completed` (F1.8: hoje "trial imutável" é convenção de rota, não propriedade do dado — não existe trigger de imutabilidade nessas tabelas).
- **B2-bis.** Remediar as sessões já adulteradas. ⚠️ **Universo é 28, não 15** [PROVADO]: interseção zero entre os 13 com override e os 15 editados. Conjuntos disjuntos. Tratamento depende da Decisão 0. **Antes de remediar:** identificar QUEM editou (`SELECT * FROM axis_audit_logs WHERE entity_type='sessions_aba' ORDER BY created_at;`) — se não houver log, confirma o caminho psql manual.

### FASE G (v7) — O sistema não avisa e não mostra

**A v5 chamava esta fase de "números errados chegando à operadora". Errado.** Sob a régua clínica, ela é: **o profissional está cego e desavisado.** A operadora é o efeito colateral.

Ordenada por dano ao aprendiz, não por risco contratual:

---

#### FG-1 [CRÍTICO — dano clínico direto] O alerta de regressão nunca disparou — por DOIS caminhos

⚠️ **A v6 documentava um canal. Existem dois, ambos mortos.** (6ª auditoria.)

**Canal A — `alerts` (polled):** `alerts/route.ts:26` filtra `regression_count > 0`. O **único writer** (`maintenance/route.ts:79`) acopla o incremento ao `UPDATE ... status='regression'` — que o trigger rejeita (`regression` é estado-zumbi) ⇒ rollback ⇒ **`regression_count` permanece 0 na clínica inteira**. [PROVADO: 0 protocolos em `regression`; 30 sondas todas `pending`]

**Canal B — `notifications` (push ao supervisor):** `notifications/route.ts:61-78` expõe `action:'check_regression'` → chama `notify_regression_detected(protocol_id, tenant_id)` (`000:1879-1896`) → `create_notification_aba` → grava na tabela `notifications` para o **`supervisor_id`**, tipo `'regression_alert'`, com idempotency key. **Infraestrutura completa. ZERO CALLERS.**
- `maintenance/route.ts` (onde a regressão é detectada) **nunca chama** `notify_regression_detected` (grep vazio).
- `check_regression` não tem caller nenhum — nem frontend, nem cron, nem hook.

⚠️ **CORREÇÃO DA v7 (FURO C, 7ª auditoria) — eu dei a razão errada.** A v7 dizia que o Canal B também estava morto *"porque ainda lê `regression_count`"*. **Falso.** O corpo real da função:
```sql
SELECT lp.id, lp.title, lp.supervisor_id, lp.regression_type, lp.regression_count, l.name ...
IF NOT FOUND OR v_protocol.supervisor_id IS NULL THEN RETURN; END IF;
PERFORM create_notification_aba(..., 'regress_' || p_protocol_id::TEXT || '_' || v_protocol.regression_count::TEXT);
```
O **único** early-return é `NOT FOUND OR supervisor_id IS NULL`. `regression_count` **não é gate** — aparece apenas no texto (`#%s`) e na **chave de idempotência** `regress_<protocolo>_<count>`. A função **dispararia** com `count=0` (texto "regressão #0"). Ela só não dispara porque **ninguém a chama**.

🚨 **E a razão errada escondia uma ARMADILHA no fix (over-correction não declarada):**
Se ligarmos `notify_regression_detected` no caminho da sonda **enquanto o contador está em 0**, a chave de idempotência é `regress_<protocolo>_0` para **toda** regressão daquele protocolo ⇒ só a **primeira** é entregue; as seguintes são **silenciosamente deduplicadas**. O supervisor recebe um aviso e nunca mais.
**Portanto:** "desacoplar o contador" (item 1 abaixo) não é só o fix do Canal A — é **pré-requisito de correção do Canal B**. O contador precisa incrementar **e committar** por regressão antes que a chave de idempotência seja confiável.

**Precisão sobre o "silêncio" (correção da v6):** no *frontline* não é silencioso. O profissional que registra uma sonda <70 recebe **erro 422** (`maintenance:77-80` → trigger rejeita → `handleRouteError` → 422) e o resultado é **descartado (rollback)**; a sonda volta a `pending` e re-alerta (`alerts:32-49`), então ele **re-tenta e re-falha**. É **hard block + agregado falso**, não *miss silencioso*.

**Correção FG-1 (completa, na ordem certa):**
1. **[Fase A]** Desacoplar o incremento de `regression_count` do `status='regression'` — o contador sobe e **committa** mesmo que a transição falhe ou não exista. ⚠️ *Pré-requisito do item 3 (chave de idempotência).*
2. **[Fase A / A3]** Fazer a sonda reprovada **persistir** (hoje <70 = rollback total).
3. **Decidir o mecanismo de entrega pretendido** — `alerts` (polled) ou `notifications` (push ao supervisor) — e **ligá-lo em `maintenance/route.ts`**. Se o push é o desenho pretendido (a infra sugere que sim: `supervisor_id`, idempotency), chamar `notify_regression_detected` no caminho da sonda. **Só depois do item 1**, ou a 2ª+ regressão de cada protocolo desaparece na dedup.
4. Se a **Decisão 1** for "regression sai do enum", o gatilho precisa de outra base: ex. "N sondas reprovadas consecutivas". **Dependência implícita:** exige o item 2 (sonda `failed` persistir) — não dá pra contar reprovações que nunca são gravadas.

**Dependências reais:** Fase A + Decisão 1.

---

#### FG-2 [CRÍTICO — o profissional está cego, e o que ele vê está errado] Duas telas mentem

Consequência direta do motor CSO desligado (24/03). **Duas superfícies, não uma.**

**FG-2a — Dashboard (`dashboard/route.ts:74-83`):** `avg_cso` e `learners_critical` calculados sobre o **último** `clinical_states_aba` por learner (`MAX(created_at)`). Aprendiz ativo só desde abril ⇒ seu "último" estado é de **março** ⇒ o profissional vê **CSO de 4 meses atrás como se fosse atual**. Aprendiz só-órfão **some do denominador** (INNER JOIN) — não aparece nem como crítico. Cache de 5 min, sem flag de staleness.
*(`app/aba/page.tsx:59` consome este endpoint — está coberto pelo mesmo fix.)*

🚨 **FG-2b — Tela do aprendiz [FURO A, 7ª auditoria — o furo que 6 auditorias não viram]:**
- `aprendizes/[id]/page.tsx:365` — `const lastCSO = csoHistory[csoHistory.length - 1]`
- `aprendizes/[id]/page.tsx:394` — renderiza `{lastCSO ? lastCSO.cso_aba : '—'}` sob o rótulo **"CSO atual"**. Sem data. Sem flag de staleness.
- Alimentado por `cso-history/route.ts:11` — `SELECT ... FROM session_snapshots ... ORDER BY sa.ended_at ASC` ⇒ `csoHistory[último]` = snapshot **mais recente existente**.

**Cenário concreto:** aprendiz com snapshots até 12/03 **e** sessões órfãs após 24/03 (a população exata do G1). O endpoint devolve honestamente os pontos ≤12/03. **A página pega o último e o rebatiza de "atual".** Até 4 meses de defasagem, na tela clínica primária por-aprendiz, sem nenhum aviso.

⚠️ **Erro meu, registrado:** o apêndice da v7 descartava `cso-history` como *"lacuna honesta, não dado errado"*. **O endpoint é honesto; a página mente.** Eu parei no endpoint e não segui o dado até a tela que o consome. Isso cai **exatamente** na régua que este próprio plano definiu — *dado errado que o profissional VÊ é pior que dado ausente* — e é o tipo de furo que só aparece quando se rastreia o dado até o pixel.
*(O gráfico da aba "Evolução CSO", `page.tsx:528`, está correto: é série datada. Só o **escalar** mente.)*

**Escopo:** FG-2 cobre **todo aprendiz, todo protocolo ativo**. Maior que o do FG-1 (que atinge só protocolos em manutenção com sonda <70).

**Correção (ambas as telas, no mesmo passo):**
- Exibir staleness explícito ("último dado clínico: 12/03/2026") ou marcar "desatualizado".
- Nunca rotular um valor de março como "atual".
- Sob a opção (b) da Decisão 5 (sem backfill), **isso nunca refletirá as 20 órfãs** — o profissional precisa **saber que está cego**, não ser enganado por um número velho.

**Dependências: NENHUMA.** Puro display; sem schema, sem decisão, sem mutação clínica. ✅ **Primeiro código seguro do plano.**

---

#### FG-3 [ALTO — dado errado circulando] Relatório de convênio autocontraditório
`app/api/aba/reports/route.ts:15-18` → `generate_convenio_data` (`000:1516-1631`). **Caller único** (verificado). Para um learner do tenant `377c9cd4` (14 órfãs), período pós-24/03:
- header: `total_sessions=8` (conta todas as `completed`, `000:1517-1525`)
- detalhe: `sessions=[]` **vazio** (INNER JOIN em snapshots, `000:1536-1537`)
- `cso_aba_avg=0.00` (`AVG` sobre zero linhas → `COALESCE(...,0)`, `000:1544`; o CASE em `000:1608` devolve 0.00 e não NULL porque `total_sessions>0`)

⚠️ **REFINAMENTO G-a (5ª auditoria) — o fix da v5 maquiava.** `has_clinical_data` (`000:1604`) e `cso_aba_current` (`000:1609`) derivam **ambos** da query **SEM filtro de período** (`000:1553-1562`). Depois do fix incompleto, o documento **ainda diria "tem dado clínico: sim"** e mostraria um **CSO de março como atual** — a metade que um auditor acredita.

✅ **Verificado implementável (6ª auditoria):** `has_clinical_data=false` **já é estado alcançável hoje** (aprendiz novo sem snapshot ⇒ `v_cso_current` NULL ⇒ `IS NOT NULL`=false). Nenhum consumidor quebra com `false` — não é estado inédito.

⚠️ **DIVIDIDO EM DOIS (6ª auditoria) — a v6 amarrava o código inteiro à Decisão 0 sem necessidade:**

**FG-3a [SEM DEPENDÊNCIA] — corrigir a função** (honestidade dos relatórios **futuros**):
- quando não houver snapshot **no período**: `has_clinical_data = false`
- `cso_aba_current = NULL` (ou explicitamente marcado stale, com a data real)
- expor `orphan_sessions_in_period` (contagem de sessões sem dado clínico)
- reconciliar contagem (seção 3) vs detalhe (seção 4)

**FG-3b [DEPENDE DA DECISÃO 0] — relatórios já persistidos:**
`register_report_snapshot` (`reports:42-45`) **persiste** relatórios emitidos. Corrigir a função muda números de períodos passados. Se um relatório já foi entregue com `CSO 0,00`, reemitir com outro número é **decisão de compliance** (Decisão 0), não técnica.

---

#### FG-4 [MÉDIO] O scanner de integridade dá atestado de saúde na dimensão quebrada
`app/api/cron/scan-integrity/route.ts:37,42-43,63-68` importa `runFullScan` e itera todos os tenants não-expirados (header: "AXIS ABA v2.7.0"). **Roda ABA diariamente** — corrige afirmação falsa repetida desde a 1ª auditoria. E `grep snapshot|cso|clinical_state` em `integrity-scanner.ts` = **0**: nenhuma das 8 regras detecta "sessão `completed` sem snapshot".

⚠️ **REFINAMENTO G-b (5ª auditoria) — a regra nova viraria ruído perpétuo, e isso é dano ao produto.**
`autoResolveStaleFlags` (`integrity-scanner.ts:446`) só resolve flag cuja chave **não aparece** no scan atual. Sob a opção (b), as 20 órfãs **nunca** ganham snapshot ⇒ a regra as re-detecta em **todo scan diário** ⇒ **20 flags 'open' permanentes**, `last_detected_at` bumpado eternamente. Pior: o `ON CONFLICT` usa índice parcial `WHERE status IN ('open','reviewing')` ⇒ **resolver manualmente também é inútil**, o próximo scan reinsere.

**Por que isso importa sob a régua clínica:** um alerta que grita todo dia sobre um problema que você decidiu não corrigir **treina o profissional a ignorar alertas**. Quando um alerta real aparecer, ninguém olha. É o oposto do propósito.

**Correção:** a regra precisa de **cutoff de data** (`ended_at >= <data_de_deploy_do_D>`) ou allowlist das 20 órfãs conhecidas. Detectar o **futuro**, não relitigar o passado já documentado.

🚨 **FURO B (7ª auditoria) — FG-4 DEPENDE DE D, e a v7 o sequenciava antes.**
A v7 punha FG-4 no passo 5 e D no passo 9, dizendo que FG-4 dependia só da Decisão 5. **Errado, e a contradição é interna:** o cutoff do FG-4 **É a data de correção do motor** — que é o próprio D. No passo 5 essa data **não existe**.
- Se a regra entrar no ar no passo 5 com `cutoff = hoje`, ela sinaliza **toda sessão fechada entre o passo 5 e o passo 9** — porque o motor ainda está desligado. Enxurrada de flags por uma condição **conhecida e ainda não corrigida**.
- É exatamente o anti-padrão que o FG-4 cita como dano ao produto: *"treina o profissional a ignorar alertas"*.
- Se o cutoff for "data de correção do motor", ela é **inconfigurável** no passo 5 ⇒ regra inerte.

**Correção do sequenciamento:** FG-4 vai para **depois de D** (ver seção 7). Cutoff = data real de deploy do D.

✅ **Verificado implementável (6ª auditoria):** as 8 regras existentes **já usam filtro de data em SQL** (ex.: `scanExcessiveDuration` com `started_at > NOW() - interval '30 days'`). A regra nova segue o mesmo padrão — **não exige refatorar o scanner**.
*Bônus:* o cron usa Pool cru com `set_config` manual e **nunca seta `app.user_id`** ⇒ 2º writer não-auditado (reforça G3a).

---

#### FG-5 [MÉDIO] `check_alta_parcial` recomenda errado
`reports/route.ts:19-22` → `000:453-477` conta semanas via INNER JOIN em snapshots. Aprendiz com 8+ semanas de sessões, metade órfã, recebe *"Dados insuficientes — menos de 8 semanas"*. Direção conservadora (bloqueia alta), mas **recomendação factualmente errada** — e o profissional não sabe por quê.

---

#### FG-6 [BAIXO — maquinaria de convênio, desce na régua nova] `completeness_pct = 0,00`
⚠️ **CORREÇÃO DE ERRO MEU (G-c, 5ª auditoria).** A v5 arquivava isto sob "`regression_count` zerado, corrigido pela Fase A". **Falso.**
`claim-packets/route.ts:163-165`: `completeness_pct = fullProof/total`, onde `fullProof` (`:154`) conta bundles `status='complete'`, que exige `clinical_snapshot` (`evidence-bundles:250-251`). **`regression_count` não aparece em lugar nenhum do cálculo.** Para founders, o 403 do gate (`:73`) suprime o bundle inteiro.

**A Fase A não move nenhuma variável deste cálculo.** Um executor lendo a v5 rodaria A+G e acharia que resolveu. `completeness_pct` só sai de 0 com **snapshot (Fase D)** ou **decisão do gate (Decisão 6)**.
**Dono único:** Decisão 6 → Fase B3. Não é da Fase G, e não é urgente sob a régua clínica.

---

### FASE F — Google Calendar sync ABA quebrado [F3.1] — ⚠️ F1+F2 SÃO ATÔMICOS

⚠️ **OVER-CORRECTION GRAVE (F2-1, 4ª auditoria): aplicar F1 sem F2 é ESTRITAMENTE PIOR que o estado atual.**
Hoje o sync está morto: `google/sync/route.ts:154-176` e `webhook:125-144` gravam `'agendada'`/`'cancelada'` num enum que só aceita `scheduled|in_progress|completed|cancelled` [PROVADO: enum íntegro] ⇒ todo INSERT/UPDATE morre com **22P02** e faz rollback do batch. **Como nada é inserido, nenhuma sessão carrega `google_event_id` e nada é tocável.**
**Se você corrigir só o enum (F1):** o sync ressuscita e passa a inserir sessões `scheduled`. Terapeuta abre e fecha uma (`completed`). O Google muda o etag. O próximo sync — cujo UPDATE dispara por `google_event_id` **sem nenhum guard de status** — **flipa `completed` → `scheduled`**, reescreve `scheduled_at`/`duration_minutes`, e deixa `ended_at` órfão. **Feature morta vira feature que corrompe uma sessão clínica já registrada.**

- **F1 + F2 (ATÔMICOS — nunca separados; vivem nos mesmos arquivos, commit único).**
  - F1: corrigir os valores gravados pelo sync/webhook ABA para o enum correto.
  - F2: adicionar **guard de status** nos UPDATEs (nunca tocar sessão `in_progress`/`completed`).
  - *Precisão:* o sync **manual** mostra o erro na UI (`sync:276-278`); só o **webhook** engole via Sentry.
- **F3.** `sessions_aba` **não tem trigger de validação de transição** (só auditoria, `000:8381`). O plano endurece a máquina de `learner_protocols` e ignora a de `sessions_aba` — que tem writer externo automatizado. Avaliar trigger.
- **F4.** O trigger de auditoria só loga mudanças para `in_progress/completed/cancelled` (`000:2859-2860`). Rastreabilidade cega para esse writer.

**Custo de adiar F:** enquanto F não roda, o sync continua morto — eventos criados no Google Calendar **não entram** no sistema. É perda de conveniência, não de dado clínico (o profissional cria a sessão pelo app). Aceitável esperar a Fase A.

*(B3 — ver seção própria abaixo. Rebaixada na v5: é feature gate, não bug.)*

### FASE C — Validação do "Dominado" [G4]
- **C1.** Sistema confere critério real (X% em N sessões) antes de permitir `mastered`, usando `mastery_criteria_*`. **Critérios reais confirmados** [PROVADO]: `80|3|10` (31 protocolos), `90|3|10` (3), `88|3|10`, `85|3|10`, `70|3|10`, `80|4|10` (2), `80|3|1` (1 — investigar). Não são lixo; C1 pode validar contra eles.
- ⚠️ **C1-a (F2.6, MÉDIA): C1 precisa de âncora temporal.** A reversão `mastered→active` (Fase A/075) atualiza `activated_at` e limpa `mastered_at` (`protocols/[id]/route.ts:19,29,32`). Sem âncora, o profissional **re-domina no dia seguinte à reversão, validado pelas mesmas sessões antigas que a reversão acabou de invalidar.** **Janela correta:** sessões com `ended_at >= activated_at` do ciclo corrente.
  - ✅ **`activated_at` NULL não existe** [PROVADO: 0 protocolos]. Guarda `IS NULL` desnecessária. *(Furo F2-4 da 4ª auditoria: refutado pelo banco.)*
  - ✅ **O incêndio não furou C1-a** [PROVADO]: o `activated_at` do protocolo `c7759184` é de hoje 13:06 — o protocolo é novo. *(Furo F2-2: refutado.)*
  - ⚠️ **MAS o vetor permanece real:** um revert **manual via psql** (como o do incêndio) **não bumpa `activated_at`**. Em protocolo antigo, a âncora ficaria velha e C1-a seria contornado. Como o role `axis` é superuser com bypassrls, esse caminho está aberto. **Regra operacional:** reverts sempre pela rota, nunca por psql — ou C1-a precisa de âncora que o psql não contorne.
  - ⚠️ **F2-3 (OVER-CORRECTION, BAIXA): `suspended→active` zera a janela.** `route.ts:29` bumpa `activated_at` em **qualquer** transição para `active`, incluindo `suspended→active` (`075:48`). Protocolo suspenso por férias/doença no meio da acumulação ⇒ ao retomar, **todas as sessões pré-suspensão caem fora da janela**. Pode ser política ABA válida (re-demonstrar), mas o plano deve **separar "início de ciclo" de "última ativação"** conscientemente.
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

### FASE B3 — Atestação/evidência [G3c] — ⚠️ REBAIXADA: não é bug, é feature gate

⚠️ **CORREÇÃO DE ERRO DA v4 (F4-2, confirmado no banco).** A v4 acusava "policy RLS com `app.current_org`" como causa dos 0 bundles. **FALSO.**
```sql
SELECT plan_tier, count(*) FROM tenants t JOIN session_attestations sa ON sa.tenant_id=t.id GROUP BY 1;
-- founders | 18
```
Todos os 18 tenants com atestação são `founders`. `src/lib/operadora-gate.ts:76`: `FOUNDERS_ACCESS.evidenceBundles: false` (vs `attestationsTherapist: true`, linha 74). Ambos os POSTs saem do mesmo hook, mesma sessão/tenant/tier — mas **carregam feature-keys diferentes**. `requireFeature(ctx,'evidenceBundles')` (`evidence-bundles/route.ts:73`) lança 403 **antes de qualquer RLS**.

> **0 bundles é correto-por-design.** A simetria que a v4 assumia ("seria proporcional se fosse flakiness") é falsa. **B3 "server-side" consertaria o lugar errado.**

**G3c rebaixado:** deixa de ser "BUG que reprova seguradora" e vira **Decisão 6** (comercial): *founders devem ter evidence bundles?*
- Se **sim** → alterar o gate, e só então avaliar geração retroativa.
- Se **não** → documentar que founders não emitem bundle, e ajustar `claim-packets/route.ts:163-165` para não reportar `completeness_pct = 0,00` (hoje reporta 0% em todo pacote — ver Fase G3).

*Nota:* o acoplamento bundle↔snapshot (`evidence-bundles/route.ts:91-106,238-243`) permanece verdadeiro, mas o POST **não lança** em snapshot ausente — só empurra `'clinical_snapshot'` para `missingItems` e insere assim mesmo. Portanto o furo "#1" da v2 (ordem B3 depois de D3) é **menos grave do que parecia**: o bundle não quebra, fica incompleto. Sob a opção (b) da Decisão 5, ficará incompleto para sempre — e isso deve ser documentado, não mascarado.

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

**✅ VEREDITO DA 4ª AUDITORIA — a opção (b) SOBREVIVEU a 3 tentativas de falsificação:**
- *Tabela paralela `session_snapshots_backfill`?* Construível, contorna a imutabilidade — mas ainda exige as 4 dimensões reais (mesmo muro), e `grep` em `app/`+`src/` = **zero consumidores** de qualquer tabela `*_backfill` ⇒ tabela-túmulo write-only.
- *Reconstruir o status de abril pelo `axis_audit_logs`?* Os dados existem (`000:2845` loga old/new). Mas alimentar `compute_sas` exigiria **mutar `learner_protocols`** (dispara o validador de transição + repolui o log que você está lendo) ou **forkar `compute_sas`** (viola D4). E mesmo reconstruído, **não pode ser gravado** (NOT NULL + validado + imutável + sem coluna de backfill).
- *Ordenar `compute_tcm` por data da sessão?* `clinical_states_aba` tem `session_id`, mas `compute_tcm` **hardcoda** `ORDER BY created_at` (`000:877,884`); mudar forka o motor congelado v2.6.1 e **altera o TCM de todas as sessões futuras**.

⚠️ **RACHADURA NA MINHA ALEGAÇÃO (FURO 7ª auditoria) — off-by-one, e ela REFORÇA (b):** eu escrevia que `compute_tcm` retorna **75 neutro com <2 estados**, logo "a primeira sessão nova não é enviesada". **Falso.** O neutro dispara em `v_count < 2`, mas `v_count` **já inclui o SAS atual sempre anexado** (`000:888-895`) ⇒ o neutro só ocorre com **ZERO** estados anteriores. Um aprendiz com estados de março (a maioria da coorte de 29) recebe, na primeira sessão pós-fix, um **TCM computado com dados de março tratados como recentes**.
> **Mas isso joga a FAVOR da opção (b):** o viés existe *independentemente* do backfill. Backfillar acrescentaria história **fabricada** ao mesmo cálculo — pior. A recomendação sobrevive; o que eu superestimava era a *limpeza* de (b), não sua superioridade.
> **Item novo para o D:** ao religar o motor, considerar se a primeira sessão pós-fix de cada aprendiz deve ter o TCM suprimido/marcado, dado o gap temporal de 4 meses na janela.

**A opção (a) seria pior:** backfillar só `session_snapshots` (sem `clinical_states`) faria `cso-history` mostrar pontos fabricados enquanto o dashboard fica stale-março — **duas telas inconsistentes**.

⚠️ **RESSALVA CRÍTICA:** (b) como escrita na v4 — "documentar que as sessões não têm CSO" — **é insuficiente**. Não cobre os **consumidores vivos**: o relatório de convênio autocontraditório (Fase G1), o dashboard stale (G2), o `completeness_pct=0` (G3), a alta parcial errada (G5). **A opção (b) precisa incluir o tratamento da Fase G inteira**, não só um documento à parte.

### DECISÃO 6 (nova v5 — comercial) — Founders devem ter evidence bundles?
[PROVADO] Todos os 18 tenants com atestação são `founders`, e `FOUNDERS_ACCESS.evidenceBundles: false`. Os "0 bundles" são **feature gate**, não bug.
> (a) Founders passam a ter bundles → alterar `operadora-gate.ts:76`, e só então avaliar geração retroativa.
> (b) Founders não têm bundles → documentar, e ajustar `claim-packets/route.ts:163-165` para não reportar `completeness_pct = 0,00` em todo pacote enviado ao pagador.

É decisão de produto/comercial, não técnica. Destrava a Fase B3 (que hoje "conserta o lugar errado").

### DECISÃO 4 (implícita — GAP #1) — `detect_regression` por sessão deve voltar?
A automação "3 sessões <60% → regressão" está morta. Restaurar (trabalho à parte) ou deixar como está?

---

## 6. PLACAR DE VERIFICAÇÃO (07-08/07/2026)

| Achado | Selo | Evidência |
|--------|------|-----------|
| G1 motor CSO desligado (commit `0d44a0e`) | PROVADO+CÓDIGO | 29 c/ snapshot até 12/03, 20 s/ após; diff do commit |
| G3a auditoria sem autor | PROVADO | 99 logs, 0 autor real |
| G3b sessão editável pós-fim | PROVADO | 15 editadas após ended_at; 13 override |
| G2 regression zumbi / sonda pending | PROVADO+CÓDIGO | trigger s/ regression; 30 pending; 0 em regression; CHECK |
| G2b 7 botões 500 (prod) | CÓDIGO | validTransitions HEAD vs trigger |
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
4. ✅ 3ª auditoria adversarial (15 furos → v4) + 8 queries no banco.
5. ✅ 4ª auditoria adversarial (27 agentes → v5) + 3 queries decisivas.
6. ✅ 5ª auditoria (auditar a **incorporação** das críticas → v6) + mudança de régua.
7. ✅ **Plano versionado** — commits `34cbed0`, `1c24be3`, `ccd4a13`. *(Era bloqueador: "não se executa uma mensagem.")*
8. ✅ 6ª auditoria (verificação final → v7): 4 ajustes.
9. ✅ **7ª auditoria — auditor EXTERNO, sem histórico, instruído a reprovar.** Verificou ~30 citações `[CÓDIGO]`: **nenhuma derrubada**. Caçou um terceiro canal de alerta: **não existe**. Confirmou que nenhuma migration pós-baseline altera o trigger. **Veredito: EXECUTÁVEL, com 2 ajustes** — ambos incorporados na v8.
10. **Alê responde as 7 decisões (0 a 6).** A **Decisão 1** destrava o alerta clínico. A **Decisão 0** destrava tudo que é histórico.
11. Executar na ordem da tabela abaixo, um bloco por vez, smoke manual a cada bloco.

**Os 5 refinamentos da 7ª auditoria, incorporados nesta v8:**
1. ✅ **FG-2 ampliado** — cobre agora a **tela do aprendiz** (`page.tsx:394`), não só o dashboard. *(FURO A — o furo que 6 auditorias não viram, e que cai exatamente na régua deste plano.)*
2. ✅ **FG-4 movido para depois de D** — seu cutoff É a data de correção do motor. *(FURO B.)*
3. ✅ **Razão de morte do Canal B corrigida** (zero callers, não a leitura do contador) — **e a armadilha da chave de idempotência declarada.** *(FURO C.)*
4. ✅ **G2b corrigido: 7 botões em produção**, não 8. O 8º existe só no working tree congelado. *(FURO D.)*
5. ✅ **B1 vaza para o TDAH**, benignamente. Declarado. *(FURO E.)* + sub-decisão `userId` vs `profileId` pode dar 22P02.
6. ✅ **Rachadura do `compute_tcm`** (off-by-one) registrada — e ela **reforça** a opção (b).

### ⚠️ ORDEM DE EXECUÇÃO (v8 — régua clínica, dependências verificadas)

⚠️ **Correção da v7 (FURO B, 7ª auditoria):** a v7 punha **FG-4 no passo 5**, dizendo que dependia só da Decisão 5. **Contradição interna:** o cutoff do FG-4 *é* a data de correção do motor (D), que vinha no passo 9. **FG-4 movido para depois de D.**

| # | Bloco | Depende de | Por que aqui |
|---|-------|-----------|--------------|
| 1 | **FG-2a + FG-2b** — staleness no dashboard **E na tela do aprendiz** | **NENHUMA** | Puro display. Zero schema, zero decisão, zero mutação clínica. **Faz o profissional saber que está cego** em vez de ver um CSO de março rotulado "atual". ✅ *Primeiro código seguro.* ⚠️ **Escopo ampliado pelo FURO A — não esqueça a tela do aprendiz (`page.tsx:394`).** |
| 2 | **FG-3a** — corrigir `generate_convenio_data` (relatórios futuros) | — | Read-heavy, sem schema. Blast radius = 1 rota on-demand. Caller único. |
| 3 | **A** (máquina de estados) — inclui **A9** (reconciliar os 3 modelos) | Decisão 1, 3 | Base de tudo. Contém o **desacoplamento de `regression_count`** (pré-requisito do FG-1) e a persistência da sonda reprovada. |
| 4 | **FG-1** — alerta de regressão dispara (**os DOIS canais**) | A + Decisão 1 | **O item mais importante do plano.** ⚠️ *O item 1 do FG-1 (contador committando) é pré-requisito do item 3 — senão a chave de idempotência `regress_<id>_0` dedupa a 2ª+ regressão de cada protocolo.* |
| 5 | **F1+F2** (sync, atômico) | A | Perigoso isolado. Custo de adiar: sync morto (conveniência, não dado clínico). |
| 6 | **B1/B2/B2-bis** (rastreabilidade) | Decisão 0 (para as 28) | Quem fez o quê. ⚠️ *B1 muda o autor de auditoria do TDAH também (FURO E) — benigno, mas declare.* |
| 7 | **C** (Dominado validado) | A | Impede marco clínico sem critério. |
| 8 | **D** (motor CSO) | Decisão 5 (recomendação: **b**) | Devolve a curva de evolução para sessões **novas**. |
| 9 | **FG-4** — regra de integridade **com cutoff = data de deploy do D** | **D** + Decisão 5 | ⚠️ *Movido para cá pelo FURO B.* Antes de D, o cutoff não existe e a regra vira enxurrada de flags. |
| 10 | **FG-3b** — re-emissão de relatórios persistidos | Decisão 0 | Compliance, não técnica. |
| 11 | **FG-5** (alta parcial) | D | Depende de snapshot existir. |
| 12 | **B3 / FG-6** (`completeness_pct`, bundles) | Decisão 6 | Maquinaria de convênio. Última. |
| 13 | **E** (PEI persistido) | Decisão 2 | Quando fizer sentido de negócio. |

**Sobre a precedência FG-1 vs G1 (motor):** FG-1 tem escopo menor (só protocolos em manutenção com sonda <70); o motor cega o profissional sobre **todos**. **Ambos CRÍTICO.** FG-2 vem primeiro na execução por ser *decision-free e barato*, não por ser mais grave.

**Primeiro comando seguro (read-only)** — reproduz o furo do convênio num learner real, antes de tocar em código:
```sql
SELECT generate_convenio_data(
  '<learner_id_de_uma_órfã>'::uuid,
  '377c9cd4-4348-4fa2-ace1-2aac7d034a23'::uuid,
  '2026-03-24'::date, CURRENT_DATE, 'audit'::varchar
);
-- Esperado: total_sessions > 0, sessions=[], cso_aba_avg=0.00,
--           has_clinical_data=true, cso_aba_current=<valor de março>
```

**Primeiro código a escrever:** **FG-2a + FG-2b** (staleness nas duas telas). Único bloco com dependência "—".

---

## 8. ESTADO REAL DE PRODUÇÃO (08/07/2026)

**Versionado (resolvido o bloqueador da 5ª auditoria):**
- Commit `34cbed0` — `docs/estado/` com V2, V3, V4, V5, VERIFICADO + a auditoria original. **No GitHub.** *(Antes: `?? docs/estado/` — o diretório inteiro estava untracked. "Não se executa uma mensagem.")*

**No ar:**
- **P0** — confirmação (`window.confirm`) antes de marcar "Dominado". Commit `bc52001`, buildado, deployado. Testado em produção: funciona.
- **Incêndio da cliente** — protocolo `c7759184-...` (Maria Fernanda, "Foco e Atenção") revertido `mastered`→`active` via UPDATE manual no psql com trigger desabilitado dentro de transação. `COMMIT` confirmado. [PROVADO: `status=active`, `mastered_at=NULL`, `activated_at=2026-07-07 13:06:24`]

**Pendente / NÃO no ar:**
- **P1 (reverter `mastered→active`)** — código alterado no working tree (`app/aba/aprendizes/[id]/page.tsx`, `app/api/aba/protocols/[id]/route.ts`) + `scripts/migrations/075_aba_allow_mastered_to_active.sql`. **Congelado por decisão:** será reescrito dentro da Fase A (migration única com a definição final do trigger).
- ⚠️ **ARMADILHA CONFIRMADA (F5-1):** o blob **staged** da 075 termina em `$$;` — versão **QUEBRADA**. O fix (`BEGIN;`/`COMMIT;`) está só no working tree. **Um `git commit` cru comitaria a versão quebrada.** O Husky lê o disco, mas o git comita o índice. E o PowerShell local **não tem `bash`**, então o hook pode nem rodar.
  - Estado atual pós-`git reset`: a 075 está **untracked** (`??`), fora do índice. Seguro.
  - `SELECT * FROM _migrations WHERE version='075'` → 0 rows. `git log --all -- 075` → vazio. **Nunca commitada, nunca aplicada.**

**Ambiente:**
- VPS `147.93.191.64`, db `axis_tcc`, container `axis-postgres`, user `axis` (**superuser, `rolbypassrls`**).
- Deploy: `cd /root/axis-tcc && git pull && rm -rf .next && npm run next:build && pm2 restart all`.
- `bash` não existe no PowerShell local — validações de hook via `Get-Content`.
- Tenants com órfãs: `123e4567…` (3), `377c9cd4…` (14), `9ae1ea81…` (3).
- Todos os tenants com atestação: `plan_tier = founders` (18).
- `generate_convenio_data` tem **caller único**: `reports/route.ts:16` (verificado).

---

## 9. PENDÊNCIAS FORA DO PLANO TÉCNICO
- **Modal bonito** (troca a caixa preta nativa do P0/P1 por modal no CSS do projeto) → virou item **A8**.
- **1 protocolo com `mastery_criteria_trials = 1`** — investigar se é erro de cadastro.
- **Fragilidade estrutural:** índice único **global** de `engine_versions.is_current` (só 1 linha `is_current` na tabela inteira) + `close_session_aba:563` não filtra `engine_name`. Hoje inócuo (CSO-ABA é o current), mas se outro motor for ativado, snapshots ABA carimbam engine errada.
- **F1.9:** a função de backfill (se existir) deve **chamar** `compute_pis/compute_bss`, nunca copiar a fórmula (evita duas fontes de verdade), e ser dropada após D4.

---

## APÊNDICE — Trilha de verificação e o que NÃO foi quebrado

**7 auditorias, 3 rodadas de queries, ~45 furos corrigidos (07-08/07/2026):**
- 1ª revisão: 9 furos → v2. 2ª: 5 furos → v3 (CSO fabricável). 3ª adversarial: 15 furos → v4. 4ª (27 agentes): → v5. 5ª (**auditar a incorporação**): → v6. 6ª (verificação): → v7. **7ª (auditor EXTERNO, sem histórico, instruído a reprovar): → v8.**
- A 7ª foi decisiva. Ela entrou para derrubar as citações `[CÓDIGO]` do plano. **Verificou ~30 e não derrubou nenhuma.** E então achou o que ninguém tinha procurado — nas palavras dela:
  > *"a hipótese de que 'documento muito auditado tem ponto cego' se materializou não nas citações, e sim em duas coisas que nenhuma auditoria olha: o dado seguido até a **tela** que o consome, e a **ordem** de execução contra a semântica de cada fase."*

**O que foi atacado e NÃO caiu (registro acumulado de robustez):**
- **A premissa central (dano clínico > risco contratual) — SOBREVIVEU.** A 7ª auditoria caçou ativamente um **terceiro canal** de alerta de regressão: `check_regression` tem zero callers; nenhum path de email/Resend toca "regress"; os únicos crons (`reminders`, `renew-webhook`, `scan-integrity`) não tocam regressão/sondas/snapshots. **Não existe terceiro canal.**
- **A recomendação (não backfillar) — SOBREVIVEU** a 4 tentativas de falsificação em 2 auditorias distintas. As 4 colunas de sustentação foram confirmadas contra o código, não assumidas.
- **Causa-raiz do G1 — ROCHA.** `git show 0d44a0e` prova: removeu `open_session_aba` **e** `close_session_aba`, trocou por `UPDATE` direto, com o comentário literal *"substituindo close_session_aba"*.
- **Trigger de produção = baseline.** **Nenhuma migration pós-`000` altera** `trg_fn_validate_protocol_transition` nem `maintenance_probes_status`. O diagnóstico da máquina de estados não repousa num dump possivelmente desatualizado.
- **Cluster `[CÓDIGO]` inteiro:** ~30 citações verificadas verbatim por auditor externo. **Nenhuma aponta linha que não diz aquilo.**
- **Sem vazamento cross-módulo pelo trigger da Fase A** — o TDAH usa tabelas próprias; a única menção a `learner_protocols` em `tdah/` é um **comentário** que desacopla explicitamente.
- **Sem vazamento de RLS pelo B1** — `app_user_id()` tem zero callers; nenhuma POLICY lê `app.user_id`.
- **Restore inclui o motor** (`close_session_aba` está no baseline). **`regression_count` nunca é divisor.** **Dado clínico ABA não vaza para família/escola.** **`lgpd/export` é admin da própria clínica.**
- **A5 (expor "Mantido" sem sonda) — a ressalva do plano está CORRETA**, confirmada independentemente.
- **`has_clinical_data=false` não é estado inédito.** **Cutoff no scanner é implementável** no padrão atual.
- Aritmética [PROVADO]: 49−29=20 (=3+14+3); 13+15−0=28; 18+31=49. Nenhum número esticado.

**Cinco correções de erro meu, registradas:**
1. v3: "P1 commitado no GitHub" — falso (staged, nunca commitado).
2. v4: RLS causava os 0 bundles — falso (feature gate `founders`).
3. v5: `completeness_pct=0` sob `regression_count`, fix creditado à Fase A — falso (depende de snapshot ou do gate).
4. v6: "ninguém é avisado, o sistema segue em frente" + "FG-1 > G1 provado" — impreciso nos dois pontos.
5. **v7: descartei `cso-history` como "lacuna honesta, não dado errado".** O endpoint é honesto; **a página mente** (`page.tsx:394` rotula o último ponto de "CSO atual"). Parei no endpoint e não segui o dado até a tela. **Este é o erro mais instrutivo dos cinco** — foi cometido *sob a régua que eu mesmo escrevi*, e pego só quando alguém rastreou o dado até o pixel.

Nenhuma das cinco teria sido pega sem auditoria adversarial. É para isso que o processo existe.

**Lições do processo:**
- **O método importou mais que o modelo.** Prompts que mandam *provar / simular / quebrar* cavam fundo; prompts que mandam *revisar* concordam.
- **Auditar a incorporação** das críticas (5ª rodada) é o passo que ninguém dá — e é onde plano bom vira plano ruim.
- **Um auditor externo, sem histórico, vale mais que um veterano** na rodada final. Ele não tem lealdade às conclusões anteriores, e ataca o que o consenso parou de olhar.
- **Documentos muito auditados desenvolvem ponto cego** — não nas afirmações, que todos checam, mas nas **junções**: o dado entre o endpoint e a tela; a ordem entre duas fases corretas.

**E a lição maior:** por cinco versões o plano mediu gravidade pela régua errada — *"reprova a seguradora?"*. A régua certa sempre foi *"o profissional consegue trabalhar e a criança é protegida?"*. Sob ela, o achado mais grave não é o relatório do convênio: é que **o alerta de regressão nunca disparou — por dois caminhos, e o supervisor nunca soube** — e que **a tela do aprendiz mostra um CSO de março como se fosse de hoje.**

A seguradora foi o canário. O canário cantou.
