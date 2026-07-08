# PLANO DE CORREÇÃO — AXIS ABA (v2)
## Integridade de Dado Clínico + Máquina de Estados

**Data:** 07/07/2026
**Versão:** 2 (incorpora revisão crítica de 07/07 — 9 furos corrigidos)
**Módulo:** ABA (`app/aba/*`, `app/api/aba/*`, schema/migrations ABA)
**Natureza:** documento de PLANEJAMENTO. Nenhuma correção aplicada. Não executar hoje.

**O que mudou da v1 para a v2 (resumo honesto):**
- Os *achados* (G1–G5) continuam válidos — a maioria com dupla evidência (banco + código).
- A **Fase D (motor CSO) foi reescrita**: a v1 mandava "rodar o motor retroativamente", o que é fisicamente impossível (o motor recusa sessão `completed`) e perigoso (reescreveria datas para hoje — padrão de dado fabricado). Corrigido.
- A **ordem B↔D foi invertida**: snapshot (D3) precisa vir ANTES do bundle de evidência (B3), senão o hash SHA256 fecha sobre dado incompleto.
- Adicionada a **Decisão 0 (compliance/backfill)** — a decisão-mãe que amarra toda recuperação histórica.
- As **queries [PROVADO] foram coladas** dentro do documento (seção 2), não só o selo.

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
**Ordem interna corrigida (furo #2): fechar TODAS as mudanças de trigger primeiro, só então reconciliar a UI.**
- A1. Decidir destino de `regression` (Decisão 1). Corrigir o trigger via migration versionada.
- A2. Aplicar/rever migration 075 (`mastered→active`) DENTRO deste redesenho (fecha o P1 pausado).
- A3. Corrigir persistência de reprovação de sonda: CHECK + caminho de regressão (Decisão 3).
- A4. Corrigir limiar duplo — eliminar zona morta 70-vs-critério (Decisão 3).
- **— trigger congelado aqui —**
- A5. Reconciliar `validTransitions` (UI) contra o trigger FINAL: remover os botões que ainda dão 500, expor as transições válidas hoje escondidas.
- A6. Tratar erro do trigger no PATCH → 422 com motivo (como `sessions/[id]/route.ts:223`), fim do 500 genérico.

**Dependência:** A é pré-requisito de **C** (validar Dominado precisa da máquina limpa). NÃO é pré-requisito técnico de D — `close_session_aba` não escreve em `learner_protocols` (furo #3). Fazer A antes de D é ok por prudência, não por dependência.

### FASE B — Rastreabilidade / integridade de registro [G3a + G3b]
- B1. Setar `app.user_id` no `withTenant` → auditoria com autor real. (Definir qual id: `userId` ou `profileId` — ambos disponíveis no contexto. Decisão técnica menor, registrar.)
- B2. Bloquear edição de sessão `completed` (ou exigir motivo + audit log da alteração).
- **B2-bis (novo — GAP #2):** remediar as **15 sessões já adulteradas** + 13 com override. Não basta trancar a porta futura; o dado que já vazou é o que a operadora audita. Tratamento depende da Decisão 0.

*(B3 — atestação/evidência — foi movido para DEPOIS da Fase D. Ver furo #1.)*

### FASE C — Validação do "Dominado" [G4]
Depende de A.
- C1. Sistema confere critério real (X% em N sessões) antes de permitir `mastered`, usando `mastery_criteria_*`.

### FASE D — Motor CSO [G1] — REESCRITA (a parte mais delicada)
A v1 estava errada aqui. O motor `close_session_aba` **recusa** sessão `completed` (aborta em `000:555-557`) e **reescreve `ended_at=NOW()`** (`000:569`) + carimba `closed_at=NOW()` (`000:578`). Rodá-lo cru nas órfãs é impossível e, se forçado, fabrica datas — o padrão que a seguradora reprova.

- **D0.** Verificar pré-condições no banco: (a) `engine_versions` tem linha `is_current=TRUE`? (furo #7); (b) confirmar corte 24/03 vs 17/04; (c) provar que `compute_sas/pis/bss/tcm` leem SÓ dado imutável de trial, não `learner_protocols.status` mutável (furo #9).
- **D1.** Versionar como migration real apenas o pipeline do fechamento: `close_session_aba` + as 6 funções `compute_*` puras. **NÃO** tocar #16/#17 (não estão no caminho — furo #8).
- **D2.** Religar a chamada ao motor no fechamento de sessão (reverter a lógica de `0d44a0e`, mantendo os fixes posteriores). Vale para sessões NOVAS, dali em diante.
- **D3 (reescrito).** Backfill das ~20 órfãs por uma **função de backfill DEDICADA** — não o motor cru. Ela precisa:
  - aceitar sessão `completed` (sem o guard `in_progress`);
  - **preservar `ended_at`/`closed_at` originais** (nunca `NOW()`);
  - **não** re-flipar status (evita a cascata de auditoria — START espúrio + END duplicado, furo #6);
  - marcar o snapshot como **retroativo/backfill**, não como fechamento normal (resolve o conflito com a regra `never retroactively recompute` do CLAUDE.md — furo #9);
  - respeitar a Decisão 0 (data original vs "recuperado em 07/07").
- **D4.** Auditoria-prova dedicada + smoke manual antes de deploy.

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
2. ✅ Revisão crítica do plano concluída (9 furos corrigidos nesta v2).
3. Alê responde as decisões da seção 5 (0 a 4). A Decisão 0 é a que mais trava.
4. (Opcional) Fable revisa ESTA v2 como segunda opinião — agora sobre um plano já endurecido.
5. Alê lê frio, aponta furo final, fecha.
6. Só então executar, fase por fase (A → B1/B2/B2-bis → C → D → B3 → E), um bloco por vez, smoke manual do Alê a cada bloco.

**Nada é executado até este documento estar fechado e as decisões respondidas.**

---

## APÊNDICE — Créditos de verificação
- Achados verificados contra banco de produção via psql (07/07/2026).
- Causa-raiz G1 isolada por investigação git (commit `0d44a0e`).
- Revisão crítica que gerou esta v2: 9 furos (Fase D impossível/perigosa, ordem B↔D, decisão de compliance ausente, + refinamentos de interpretação). Todos com `arquivo:linha`.
