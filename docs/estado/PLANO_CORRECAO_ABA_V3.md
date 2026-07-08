# PLANO DE CORREÇÃO — AXIS ABA (v3)
## Integridade de Dado Clínico + Máquina de Estados

**Data:** 07/07/2026
**Versão:** 3 (incorpora 2ª auditoria — 5 furos novos, sendo 1 que muda o desenho da Fase D)
**Módulo:** ABA (`app/aba/*`, `app/api/aba/*`, schema/migrations ABA)
**Natureza:** documento de PLANEJAMENTO. Nenhuma correção aplicada. Não executar hoje.

**Histórico de versões:**
- v1 → v2: reescrita da Fase D (motor recusa `completed`, reescreve datas), ordem B↔D invertida, Decisão 0 de compliance, queries [PROVADO] coladas.
- **v2 → v3 (esta):** 2ª auditoria provou 5 furos novos. O mais grave (Furo A): o CSO retroativo **não é recuperável — é fabricável**. `compute_sas` lê status atual dos protocolos; `compute_tcm` ordena por `created_at` (data de inserção, não da sessão). Backfillar em julho uma sessão de abril inventa um CSO que nunca existiu — exatamente o que reprova numa auditoria de seguradora. Isso vira decisão clínica, não passo técnico. Os outros 4 furos endurecem a Fase A e o backfill (RLS, CHECK escondido, clobber de trigger, 422 genérico).

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
- **— trigger + constraints congelados aqui —**
- A5. Reconciliar `validTransitions` (UI) contra o trigger FINAL: remover botões que ainda dão 500, expor as transições válidas hoje escondidas.
- A6. Tratar erro do banco no PATCH → 422 com motivo. ⚠️ **Furo C (v3) — 422 não pode mirar só o trigger:** `sessions/[id]/route.ts:223` só vira 422 quando a mensagem contém `'[AXIS ABA]'`. Mas `learner_protocols` tem CHECKs que estouram com SQLSTATE 23514 SEM esse prefixo — ex.: `ck_discontinued_requires_reason` (`000:3781`): a transição `active→discontinued` é VÁLIDA no trigger e oferecida pela UI, mas sem `discontinuation_reason` no body estoura CHECK → 500 genérico. **Solução A6:** mapear por SQLSTATE (23514, 23xxx) / mensagem do banco, não só a string `'[AXIS ABA]'`.

**Dependência:** A é pré-requisito de **C** (validar Dominado precisa da máquina limpa). NÃO é pré-requisito técnico de D — `close_session_aba` não escreve em `learner_protocols` (furo #3). Fazer A antes de D é ok por prudência, não por dependência.

### FASE B — Rastreabilidade / integridade de registro [G3a + G3b]
- B1. Setar `app.user_id` no `withTenant` → auditoria com autor real. (Definir qual id: `userId` ou `profileId` — ambos disponíveis no contexto. Decisão técnica menor, registrar.)
- B2. Bloquear edição de sessão `completed` (ou exigir motivo + audit log da alteração).
- **B2-bis (novo — GAP #2):** remediar as **15 sessões já adulteradas** + 13 com override. Não basta trancar a porta futura; o dado que já vazou é o que a operadora audita. Tratamento depende da Decisão 0.

*(B3 — atestação/evidência — foi movido para DEPOIS da Fase D. Ver furo #1.)*

### FASE C — Validação do "Dominado" [G4]
Depende de A.
- C1. Sistema confere critério real (X% em N sessões) antes de permitir `mastered`, usando `mastery_criteria_*`.

### FASE D — Motor CSO [G1] — REESCRITA v3 (a parte mais delicada, e a que mais mudou)

⚠️ **Furo A (v3) — o achado mais grave do dia. O CSO retroativo NÃO é recuperável — é FABRICÁVEL.**
A v2 assumia que bastava backfillar preservando datas. A 2ª auditoria rodou a verificação D0(c) e ela **FALHA**: 2 das 4 dimensões do CSO leem estado MUTÁVEL, não dado imutável de trial:
- **`compute_sas`** (`000:828-851`) lê `learner_protocols.status` e `generalization_status` **correntes**. Backfillar em julho uma sessão de abril usa o status dos protocolos de HOJE (que mudaram desde abril) → SAS diferente (quase sempre maior) do valor real da época.
- **`compute_tcm`** (`000:877-886`) lê `clinical_states_aba ORDER BY created_at DESC LIMIT 4`. `created_at` é a hora de INSERÇÃO da linha, não a data da sessão. No backfill de julho, as linhas novas nascem com `created_at` de julho → o TCM pega as "4 últimas" erradas → tendência lixo.

**Consequência:** preservar `ended_at`/`closed_at` (bom) NÃO conserta um score fabricado. Um snapshot com data real de abril mas SAS/TCM derivados do estado de julho é **pior** que não ter snapshot — é dado fabricado com aparência de autêntico. Conflita frontalmente com `never retroactively recompute` do CLAUDE.md.

**Isto deixa de ser passo técnico e vira DECISÃO CLÍNICA (Decisão 5).** O CSO retroativo (SAS/TCM) é reconstituível de forma fiel? Provavelmente NÃO. Então o backfill só pode guardar as dimensões que SÃO reconstituíveis a partir de trial imutável (PIS/BSS — confirmar quais) e marcar SAS/TCM como **"não reconstituível / sessão anterior à correção do motor"**. Nunca inventar o número.

O motor `close_session_aba` também **recusa** sessão `completed` (`000:555-557`) e **reescreve `ended_at=NOW()`** (`000:569`) + `closed_at=NOW()` (`000:578`). Rodá-lo cru é impossível e fabrica datas.

- **D0.** Verificar pré-condições no banco: (a) `engine_versions` tem `is_current=TRUE`? (seeds só em `legacy/` com coluna inconsistente `is_active` vs `is_current`); (b) confirmar corte 24/03 vs 17/04; (c) ⚠️ **já respondido pela auditoria: `compute_sas`/`compute_tcm` NÃO leem só imutável — ver Furo A**; (d) **Furo E (v3):** as ~20 órfãs são de quantos tenants? `session_snapshots` e `clinical_states_aba` têm **FORCE ROW LEVEL SECURITY** com `WITH CHECK (tenant_id = app_tenant_id())` (`000:10762`, `000:10636`). Se o backfill roda num loop único sem resetar `app.tenant_id` por órfã, o insert de tenant diferente do GUC corrente é REJEITADO. A função de backfill precisa setar `app.tenant_id` por órfã.
- **D1.** Versionar como migration real só o pipeline do fechamento (`close_session_aba` + `compute_*` puras). NÃO tocar #16/#17 (fora do caminho).
- **D2.** Religar a chamada ao motor no fechamento de sessão (reverter `0d44a0e`, mantendo fixes posteriores). Vale para sessões NOVAS — essas terão CSO fiel porque o estado é contemporâneo.
- **D3 (reescrito v3).** Backfill das ~20 órfãs por **função dedicada** — NÃO o motor cru. Ela precisa:
  - aceitar sessão `completed` (sem o guard `in_progress`);
  - **preservar `ended_at`/`closed_at` originais** (nunca `NOW()`);
  - **não** re-flipar status (evita cascata de auditoria);
  - setar `app.tenant_id` por órfã (Furo E — RLS);
  - **guardar só dimensões reconstituíveis; marcar SAS/TCM como não-reconstituível** (Furo A — Decisão 5);
  - marcar o snapshot como **retroativo/backfill**, respeitando a Decisão 0.
- **D4.** Auditoria-prova dedicada + smoke manual antes de deploy.

**Alternativa honesta a considerar (Decisão 5):** se o CSO retroativo não é fiel, talvez o mais defensável perante a seguradora seja NÃO backfillar CSO nenhum — apenas documentar que "sessões entre 24/03 e a correção não têm CSO por falha técnica conhecida", em vez de gerar números fabricados. Menos bonito, mais honesto, mais auditável.

### FASE B3 — Atestação/evidência [G3c] — AGORA depois de D3 (furo #1)
O evidence bundle inclui o snapshot clínico e o funde no SHA256 (`evidence-bundles/route.ts:91-106,238-243`). Gerar bundle antes do snapshot existir = hash sobre dado incompleto, permanentemente defasado.
- B3. Tornar geração de atestação/presença/bundle confiável (server-side, não fire-and-forget). Recuperar as 31 sessões — **só após D3 ter criado os snapshots**, e sob a Decisão 0.

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

### DECISÃO 5 (nova na v3 — Furo A) — CSO retroativo é reconstituível de forma fiel?
A 2ª auditoria provou que `compute_sas` e `compute_tcm` leem estado MUTÁVEL (status corrente dos protocolos + `created_at` de inserção), não dado imutável de trial. Backfillar o CSO de sessões antigas **fabrica** SAS/TCM que nunca existiram.
> Opções: (a) backfillar só as dimensões reconstituíveis (PIS/BSS) e marcar SAS/TCM como "não reconstituível"; (b) NÃO backfillar CSO nenhum e documentar a lacuna técnica honestamente; (c) outra.
É decisão clínica + compliance, não técnica. **Trava a Fase D inteira.** Junto com a Decisão 0, é a mais sensível para passar na seguradora.

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

1. ✅ Verificação de achados concluída (banco + código).
2. ✅ 1ª revisão crítica (9 furos → v2).
3. ✅ 2ª auditoria (5 furos novos → v3), sendo o Furo A o que muda o desenho da Fase D.
4. Alê responde as decisões da seção 5 (**0 a 5** — 6 decisões). As mais sensíveis: **Decisão 0** (compliance/backdate) e **Decisão 5** (CSO retroativo fabricável). Ambas travam a Fase D.
5. (Opcional) 3ª auditoria com CC limpo, como validação final.
6. Alê lê frio, aponta furo final, fecha.
7. Só então executar, fase por fase (A → B1/B2/B2-bis → C → D → B3 → E), um bloco por vez, smoke manual do Alê a cada bloco.

**Nada é executado até este documento estar fechado e as 6 decisões respondidas.**

**Fora do plano técnico, ainda pendente (do dia de hoje):**
- Modal bonito no CSS do projeto (troca a caixa preta nativa do P0/P1). Ajuste de layout, menor prioridade, mas real. Entra na Fase A (junto de A5/A6).
- Estado de produção: P0 no ar; P1 commitado no GitHub mas **migration 075 NÃO aplicada**; incêndio resolvido só no banco. (Detalhar no handoff.)

---

## APÊNDICE — Créditos de verificação
- Achados verificados contra banco de produção via psql (07/07/2026).
- Causa-raiz G1 isolada por investigação git (commit `0d44a0e`).
- 1ª revisão crítica: 9 furos (Fase D impossível/perigosa, ordem B↔D, decisão de compliance ausente) → v2.
- 2ª auditoria: 5 furos novos → v3. Furo A (CSO retroativo fabricável — `compute_sas`/`compute_tcm` leem estado mutável) muda o desenho da Fase D e cria a Decisão 5. Furos B/C/D/E endurecem Fase A e backfill (CHECK escondido da sonda, 422 genérico, clobber de trigger, FORCE RLS por tenant). Todos com `arquivo:linha`.
