# AUDITORIA ABA — Integridade de Dado Clínico + Máquina de Estados

**Data:** 07/07/2026
**Escopo:** módulo ABA (`app/aba/*`, `app/api/aba/*`, schema/migrations ABA, triggers e functions SQL do baseline)
**Método:** somente leitura. Toda afirmação cita `arquivo:linha`. Onde não há evidência, está marcado **LACUNA** ou **NÃO LOCALIZADO**.
**Referência de schema:** `scripts/migrations/000_shared_baseline.sql` (dump consolidado, 10.997 linhas) + migrations 067–075.

> **Limitação declarada:** o estado VIVO do banco não pôde ser verificado nesta sessão
> (o `.env` aponta `DATABASE_HOST=localhost` e o Postgres local não respondeu à conexão;
> os projetos Supabase acessíveis via MCP não correspondem ao AXIS). Todas as evidências
> de banco vêm do baseline versionado — que é um dump — e das migrations. Onde a
> divergência baseline × produção importa, está sinalizado.

---

## EIXO A — INTEGRIDADE DO DADO CLÍNICO

### A1. Status "Dominado" (mastered)

**Q1 — Caminhos que levam a `mastered`:**

| # | Caminho | Evidência | Validação de critério? |
|---|---------|-----------|------------------------|
| 1 | UI: botão "→ Dominado" na tela do aprendiz (`active → mastered` em `validTransitions`) | `app/aba/aprendizes/[id]/page.tsx:21` (mapa), `:475-482` (botões), `:286-314` (`handleTransition`) | Não — só `window.confirm` (`:290-293`) |
| 2 | API: `PATCH /api/aba/protocols/[id]` com `{status:'mastered'}` — aceita o status vindo do body e grava direto | `app/api/aba/protocols/[id]/route.ts:8` (body), `:16-29` (monta SET), `:41-45` (UPDATE) | Nenhuma. Nenhuma consulta a `session_targets`/scores no arquivo inteiro |
| 3 | Trigger de banco: `trg_validate_protocol_transition` permite `active → mastered` sem qualquer checagem de score | `scripts/migrations/000_shared_baseline.sql:2949`; versão 075: `scripts/migrations/075_aba_allow_mastered_to_active.sql:42` | Só valida o **par de estados**, não o critério clínico |
| 4 | Cron/job/webhook que marque `mastered` | **NÃO LOCALIZADO** — `app/api/cron/*` não toca tabelas ABA (grep por `sessions_aba|learner_protocols|session_snapshots|clinical_states_aba` em `app/api/cron/` = 0 resultados) | n/a |

Único gravador de `status='mastered'` no código de aplicação é o `PATCH protocols/[id]` (grep `UPDATE learner_protocols` em `app/`: apenas `app/api/aba/protocols/[id]/route.ts:41`, `app/api/aba/maintenance/route.ts:79,110`, `app/api/aba/generalization/route.ts:60`, `app/api/aba/lgpd/delete/route.ts:417` — nenhum dos outros grava `mastered`).

**Q2 — Existe validação do critério real (X% em N sessões) antes de `mastered`?**

**NÃO.** É confiança no clique, com um `window.confirm` como única barreira:
- `app/aba/aprendizes/[id]/page.tsx:290-293` — texto do confirm pergunta ao humano "Confirma que o critério de domínio foi realmente atingido?"; o sistema não confere nada.
- `app/api/aba/protocols/[id]/route.ts` — zero leitura de `session_targets`, `score_pct` ou `mastery_criteria_*` antes do UPDATE.
- Banco: o trigger (`000_shared_baseline.sql:2939-2962`) valida apenas a transição de estados.

**Q3 — As colunas `mastery_criteria_*` são usadas em cálculo?**

| Coluna | Definição | Uso em cálculo | Veredito |
|--------|-----------|----------------|----------|
| `mastery_criteria_pct` | `000_shared_baseline.sql:3755` | SIM, mas **não para `mastered`**: célula do grid de generalização (`app/api/aba/generalization/route.ts:40,47` e `app/api/aba/protocols/route.ts:56-57`) e aprovação de sonda de manutenção (`app/api/aba/maintenance/route.ts:57-59`) | Parcial |
| `mastery_criteria_sessions` | `000_shared_baseline.sql:3756` | **LACUNA** — grep em `app/`: só formulários de criação (`app/aba/sessoes/[id]/page.tsx:250,534,1008`; `app/api/aba/protocols/route.ts:123,130`). Nenhum cálculo lê | Rótulo decorativo |
| `mastery_criteria_trials` | `000_shared_baseline.sql:3757` | **LACUNA** — idem (`app/aba/sessoes/[id]/page.tsx:535,1012`) | Rótulo decorativo |

Ou seja: o critério "X% em N sessões consecutivas com M trials" é armazenado, exibido e **nunca avaliado por nenhuma linha de código** para a decisão de domínio.

### A2. Fechamento de sessão e motor CSO

**Q4 — `close_session_aba` é chamada no fechamento?**

**NÃO. O fechamento contorna o motor por decisão explícita e documentada no código:**
- `app/api/aba/sessions/[id]/route.ts:12` — comentário do próprio arquivo: `"open/close: SQL direto (functions PL/pgSQL não estão em migrations)"`.
- `app/api/aba/sessions/[id]/route.ts:152-163` — fechamento real: `UPDATE sessions_aba SET status = 'completed', ended_at = NOW()` (linha 158), precedido do comentário `"SQL direto: fechar sessão (substituindo close_session_aba)"` (linha 153).
- Grep de `close_session_aba|compute_full_cso|calculate_cso_aba` em `app/` e `src/`: única ocorrência é o comentário acima. **Nenhuma chamada.**
- O motor TS `src/engines/cso-aba.ts` (citado em `docs/NOTE_ABA.md:524` como "Motor CSO-ABA v2.6.1") é importado **apenas por testes**: `src/engines/__tests__/cso-aba.test.ts:22` e `src/tests/cso-engine.test.ts:16,22`. Nenhuma rota o usa.
- A function SQL existe e está íntegra no baseline (`000_shared_baseline.sql:534-638`), com pipeline completo: valida `in_progress` (555-557), fecha (569-570), calcula CSO via `compute_full_cso` (573), snapshot imutável (599-606), `clinical_states_aba` (609-618), audit `SESSION_ABA_CLOSED_WITH_CSO` (621-634). **Código morto.**

**Q5 — O que deixa de ser gerado com o CSO contornado:**

1. **`session_snapshots`** — nenhum INSERT fora de `close_session_aba` (`000_shared_baseline.sql:599`). Sem snapshot imutável da sessão (dimensões SAS/PIS/BSS/TCM, targets, behaviors, engine_version, closed_by).
2. **`clinical_states_aba`** — nenhum INSERT fora de `close_session_aba` (`000_shared_baseline.sql:609`). Sem estado clínico append-only.
3. **CSO-ABA e banda interpretativa** — `compute_full_cso` (`000_shared_baseline.sql:721-746`) nunca roda; SAS/PIS/BSS/TCM nunca são calculados.
4. **Audit `SESSION_ABA_CLOSED_WITH_CSO`** (`000_shared_baseline.sql:625`) nunca é gravado — resta apenas o `SESSION_ABA_END` do trigger genérico (`000_shared_baseline.sql:2876`).
5. **`detect_regression`** (`000_shared_baseline.sql:1106`) — nunca chamada por ninguém (grep = 0), então a regra "3 sessões < 60% → regressão" (Bible §6) não roda em nenhum lugar.
6. **Efeito composto:** o pipeline do CLAUDE.md ("Session → trials → Engine (CSO) → clinical state → suggestion → human decision") está **interrompido no 3º elo** para toda sessão fechada pela UI.

**Q6 — O "CSO atual" exibido reflete o motor?**

A tela lê da fonte certa, mas a fonte está seca:
- `app/aba/aprendizes/[id]/page.tsx:222` busca `/api/aba/learners/[id]/cso-history`; `:365` (`lastCSO`) e `:394` ("CSO atual") usam o último ponto.
- `app/api/aba/learners/[id]/cso-history/route.ts:8-11` — SELECT em `session_snapshots` (tabela que só o motor preenche).
- Logo: para qualquer sessão fechada pelo fluxo atual, **não há dado** — a UI mostra "—" e "Sem dados de CSO" (`app/aba/aprendizes/[id]/page.tsx:508`). Não é um cálculo alternativo enganoso; é ausência de dado. Eventuais pontos históricos seriam de quando o motor ainda era chamado.
- Rota irmã `/api/aba/clinical-state` está **quebrada**: consulta coluna `cso_score` (`app/api/aba/clinical-state/route.ts:28`) que não existe — a tabela tem `cso_aba` (`000_shared_baseline.sql:3346`). Nenhuma página chama essa rota (grep `clinical-state` em `app/aba` = 0). Rota morta e quebrada.

### A3. Consistência de scores e trials

**Q7 — `score_pct` é coluna gerada?**

**SIM — proteção real.** `session_targets.score_pct` é `GENERATED ALWAYS AS (... trials_correct/trials_total ...) STORED` (`000_shared_baseline.sql:2305-2309`), com `CHECK (trials_correct <= trials_total)` (`:2314`). Não pode ser gravada manualmente; sem risco de divergência.
Contraste: `score_pct` de **sondas** é gravado pela aplicação (`maintenance_probes.score_pct`, `000_shared_baseline.sql:3868`, calculado em `app/api/aba/maintenance/route.ts:56`; `generalization_probes.score_pct`, `:3641`, calculado em `app/api/aba/generalization/route.ts:35`) — protegido apenas por CHECK 0–100 (`:3875`, `:3647`).

**Q8 — Trials editáveis/apagáveis após sessão concluída?**

- **Inserir trial:** só com sessão `in_progress` — enforced no banco por `record_target_trial` (`000_shared_baseline.sql:2355-2357`), chamada pela rota (`app/api/aba/sessions/[id]/trials/route.ts:46-49`). Behaviors idem (`record_behavior_event`, `000_shared_baseline.sql:2267`; rota `app/api/aba/sessions/[id]/behaviors/route.ts:45-48`).
- **Apagar trial:** só com sessão `in_progress` (`app/api/aba/sessions/[id]/trials/[targetId]/route.ts:34-36`), com audit log `DELETE_TRIAL` (`:59-75`). Não há rota de UPDATE de trial.
- **BRECHA — sessão concluída ainda é editável em 2 campos:** o `PATCH /api/aba/sessions/[id]` de `duration_minutes_override` e `applied_by` **não verifica status** (`app/api/aba/sessions/[id]/route.ts:170-211` — o check das linhas 174-178 só confere existência/tenant). Duração faturável e profissional responsável de uma sessão `completed` podem ser alterados depois do fechamento, sem audit log específico (nenhum INSERT em `axis_audit_logs` nesse ramo).
- **Sem snapshot** (ver A2), a "imutabilidade" dos dados da sessão concluída depende só desses guardas de rota — não há cópia imutável contra a qual comparar.

### A4. Vínculo PEI ↔ Protocolo

**Q9 — Protocolo `mastered` → meta PEI?**

- **Não existe efeito persistido.** `pei_goals` não tem coluna de status/atingimento — só `title, domain, target_pct, notes` (`000_shared_baseline.sql:4121-4129`). Não há trigger, function ou rota que marque meta como atingida (grep `pei_goal` em `app/api/aba`: apenas o vínculo `pei_goal_id` em `protocols/[id]/route.ts:36-38` e JOIN de exibição em `protocols/route.ts:28`).
- **"Meta atingida" é derivação de UI em tempo de render:** `app/aba/pei/page.tsx:170-173` e `:213` — `linked.some(p => ['mastered','generalization','maintained','archived'].includes(p.status))`.
  - **Inconsistência 1:** o conjunto **omite `mastered_validated` e `maintenance`** — um protocolo que avançou ALÉM de mastered faz a meta voltar a aparecer como "não atingida".
  - **Inconsistência 2:** `.some()` — UMA transição entre N protocolos vinculados marca a meta inteira como atingida.
  - **Inconsistência 3:** `target_pct` da meta (`pei_goals.target_pct`) é exibido (`app/aba/pei/page.tsx:223`) mas nunca comparado com desempenho real.
- **Reversão:** como nada é persistido, reverter `mastered → active` "reverte" a exibição da meta automaticamente — porém sem qualquer registro/auditoria do evento no nível do PEI. **LACUNA** de rastreabilidade nos dois sentidos.
- Máquina de estados do PEI (plano, não meta) é validada só em TS: `app/api/aba/pei/[id]/route.ts:23-34`, com audit `PEI_STATUS_CHANGED` (`:74-81`). Sem trigger de banco correspondente (**NÃO LOCALIZADO** no baseline).

---

## EIXO B — MÁQUINA DE ESTADOS

### B1. Protocolos (`learner_protocols`)

**Q10 — Máquina completa.**

Enum `aba_protocol_status` — 11 valores (`000_shared_baseline.sql:138-150`): `draft, active, mastered, generalization, mastered_validated, maintenance, maintained, regression, suspended, discontinued, archived`.

Trigger `trg_validate_protocol_transition` — `BEFORE UPDATE` em `learner_protocols` (`000_shared_baseline.sql:8402`), função em `:2939-2962`; versão nova em `075_aba_allow_mastered_to_active.sql:32-55`.

Tabela de/para **permitida pelo banco** (✓ = baseline; ✚ = adicionada só na 075, ver Q-obs abaixo):

| DE \ PARA | draft | active | mastered | generalization | mastered_validated | maintenance | maintained | regression | suspended | discontinued | archived |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **draft** | — | ✓ | · | · | · | · | · | · | · | ✓ | · |
| **active** | · | — | ✓ | · | · | · | · | · | ✓ | ✓ | · |
| **mastered** | · | ✚075 | — | ✓ | · | · | · | · | ✓ | · | · |
| **generalization** | · | ✓ | · | — | ✓ | · | ✓ | · | · | · | · |
| **mastered_validated** | · | ✓ | · | · | — | ✓ | ✓ | · | · | · | · |
| **maintenance** | · | ✓ | · | · | · | — | ✓ | · | · | · | · |
| **maintained** | · | ✓ | · | · | · | · | — | · | · | · | ✓ |
| **regression** | · | **NADA** | · | · | · | · | · | — | · | · | · |
| **suspended** | · | ✓ | · | · | · | · | · | · | — | ✓ | · |
| **discontinued** | — | — | — | — | — | — | — | — | — | — | — |
| **archived** | — | — | — | — | — | — | — | — | — | — | — |

(Linhas do trigger: baseline `:2948-2955`; 075 `:41-48`.)
Constraints adicionais: `archived` exige `maintained_at IS NOT NULL` (`:3780`); `discontinued` exige `discontinuation_reason` (`:3781`).
**O trigger só cobre UPDATE — INSERT não é validado** (`:8402`). Via API isso não é explorável (POST cria sempre com default `draft`, sem aceitar `status` do body — `app/api/aba/protocols/route.ts:120-134`; default em `000_shared_baseline.sql:3759`), mas acesso SQL direto pode inserir protocolo já `mastered` sem passar pela máquina.

**Q11 — UI × trigger** (`validTransitions`, `app/aba/aprendizes/[id]/page.tsx:21`):

| Estado | UI oferece | Banco rejeitaria (botão quebrado) | Banco permite mas UI esconde |
|---|---|---|---|
| draft | active, **archived** | **draft→archived** (não listado no trigger; e CHECK `:3780` exige `maintained_at`) | draft→discontinued |
| active | mastered, suspended, discontinued | — | — |
| mastered | generalization, **regression**, active | **mastered→regression**; `mastered→active` só funciona com a 075 aplicada | mastered→suspended |
| generalization | mastered_validated, **regression** | **generalization→regression** | generalization→maintained, generalization→active |
| mastered_validated | maintenance, **regression** | **mastered_validated→regression** | mastered_validated→maintained, →active |
| maintenance | maintained, **regression** | **maintenance→regression** | maintenance→active |
| maintained | archived, **regression** | **maintained→regression** | maintained→active |
| regression | active | **regression→active** (trigger não tem NENHUMA saída de regression) | — |
| suspended | active, discontinued | — | — |

**7 dos botões da UI produzem erro do banco** (`RAISE EXCEPTION '[AXIS ABA] Transicao invalida'`, baseline `:2957-2958` / 075 `:50-51`), que a rota devolve como 500 genérico "Erro ao atualizar protocolo" (`app/api/aba/protocols/[id]/route.ts:90-94`) — o clínico vê erro sem explicação.

**Q12 — Estados sem saída (dead-ends):**

| Estado | Situação | Evidência |
|---|---|---|
| `regression` | **Beco sem saída absoluto**: não aparece como `OLD.status` em nenhuma linha do trigger — quem entrar, nunca sai por UPDATE. Agravante: também não aparece como `NEW.status` permitido → **é inalcançável por UPDATE** (toda tentativa dá exceção). Estado zumbi: existe no enum, na UI (label `:17`, botões), no dashboard (`app/api/aba/dashboard/route.ts:112-114` — métrica permanentemente 0), mas é impossível de usar | trigger `:2948-2955` / 075 `:41-48` |
| `discontinued` | Sem saída (terminal por design — aceitável, mas sem transição de reativação) | idem |
| `archived` | Sem saída (terminal por design) | idem |

**Q13 — Sondas de manutenção (2/6/12 semanas):**

- **Transição que dispara:** entrada em `maintenance`, em DOIS lugares TS duplicados:
  1. `PATCH /api/aba/protocols/[id]` quando `status==='maintenance'` (`app/api/aba/protocols/[id]/route.ts:50-83`) — cria 3 sondas week 2/6/12 com dedup por consulta prévia (`:64-67`) e audit `MAINTENANCE_PROBES_AUTO_CREATED` (`:76-82`).
  2. `POST /api/aba/maintenance {action:'schedule'}` (`app/api/aba/maintenance/route.ts:29-48`) — exige `status==='maintenance'` (`:35`), mesma lógica, **sem audit log**.
  - A function SQL `schedule_maintenance_probes` (`000_shared_baseline.sql:2689-2739`) é código morto (grep = 0 chamadas) e **incompatível com o schema**: insere `probe_number` (`:2714`) — coluna que não existe em `maintenance_probes` (`:3856-3878`, que tem `week_number`).
- Duplicidade protegida por UNIQUE `(protocol_id, week_number)` (`000_shared_baseline.sql:6107`).
- **Sondas órfãs — SIM, há risco:**
  - `maintenance → active` (permitido pelo banco, escondido pela UI): nenhum código cancela as sondas `pending` — ficam pendentes para sempre. **NÃO LOCALIZADO** qualquer limpeza fora do caminho de regressão.
  - O único cancelamento existente (`app/api/aba/maintenance/route.ts:89-91`) grava `status='cancelled'` — **valor que viola o CHECK** `maintenance_probes_status_check` (só `pending|completed`, `000_shared_baseline.sql:3876`). Se executasse, daria erro; e está no caminho da regressão, que já quebra antes (ver abaixo).

**Bug composto no caminho de reprovação de sonda** (`POST /api/aba/maintenance {action:'evaluate'}`, score < 70):
1. `:77-80` — `UPDATE learner_protocols SET status='regression'` → trigger rejeita `maintenance→regression` → exceção;
2. `withTenant` roda tudo numa transação única (`src/database/with-tenant.ts:78,207,213`) → **ROLLBACK total: nem a avaliação da sonda é gravada**; a rota devolve 500 (`handleRouteError`, `src/database/with-role.ts:258-259`).
3. Mesmo sem o trigger, `:90` violaria o CHECK de status da sonda.
**Efeito clínico: é impossível registrar uma sonda de manutenção reprovada.** Só resultados positivos persistem — viés otimista estrutural no dado.
4. Inconsistência de limiar: aprovação usa `mastery_criteria_pct` (`:57-59`), regressão usa 70 fixo (`:75`). Com critério 80: score 75 = sonda "failed" **sem consequência nenhuma** (não regride, não mantém). Com critério 60: score 65 = sonda "passed" **e** dispara regressão simultaneamente.

Generalização (contexto de B1): `POST /api/aba/generalization` insere sonda e auto-transiciona `generalization → mastered_validated` quando o grid 3×2 fecha 6/6 (`app/api/aba/generalization/route.ts:48,58-67`) — transição válida no trigger (`:2951`). Porém `learner_protocols.generalization_status` **nunca é atualizado** pela rota TS (a function SQL que fazia isso, `evaluate_generalization` `:1219-1223`, é morta e quebrada — atualiza colunas `probe_date/status` inexistentes em `generalization_probes` `:3630-3649`). Consequência: `generalization_status` fica `pending` para sempre e `compute_mastery_score` (`:753-768`) nunca daria 85.

### B2. Sessões (`sessions_aba`)

**Q14 — Máquina de estados:**

Enum `aba_session_status`: `scheduled, in_progress, completed, cancelled` (`000_shared_baseline.sql:179-184`). **Não há trigger de validação de transição para sessões** (nenhum `trg_validate` em `sessions_aba` — `:8381` é só auditoria). As regras vivem na rota:

| Transição | Onde | Regra |
|---|---|---|
| `scheduled → in_progress` (open) | `app/api/aba/sessions/[id]/route.ts:138-151` | bloqueia se `in_progress` (140) ou `completed` (143). **Não bloqueia `cancelled`** → sessão cancelada poderia ser reaberta (hoje teórico, ver abaixo) |
| `in_progress → completed` (close) | `:152-163` | exige `in_progress` (154). SQL direto, sem motor (ver A2) |
| `* → cancelled` | **NÃO LOCALIZADO** — nenhuma rota ABA grava `cancelled` em `sessions_aba` (grep `cancelled` em `app/api/aba`: só dashboard/google/lgpd/probes). Estado inalcançável via app; métrica `cancel_rate_30d` do dashboard (`app/api/aba/dashboard/route.ts:116-121`) é permanentemente 0 |
| Reabrir `completed` | Bloqueado (`:143-145`) | ✓ |
| Excluir sessão | **Não existe** — sem handler DELETE em `sessions/route.ts` nem `sessions/[id]/route.ts`; UI só deleta trial (`app/aba/sessoes/[id]/page.tsx:506`) | ✓ |
| Editar `completed` | **PERMITIDO** para `duration_minutes_override` e `applied_by` (`:170-211`, sem checagem de status) | ✗ brecha (ver A3-Q8) |

Pós-fechamento v2.7.0: atestações + evidence bundle rodam como hook **client-side fire-and-forget** (`app/aba/sessoes/[id]/page.tsx:404-431`; `src/lib/session-close-hook.ts:13,36`) — se o navegador fechar/perder rede após o close, a sessão fica completed **sem** atestação/evidência, com erro apenas em `console.warn` (`:424,429`). Nenhuma reconciliação server-side localizada (crons não tocam ABA).

### B3. Auditoria e rastreabilidade

**Q15 — Toda mudança de status de protocolo é logada (quem, quando, de/para)?**

- **Trigger:** `trg_protocol_status_audit` `AFTER UPDATE` (`000_shared_baseline.sql:8374`), função `:2837-2848` — grava `PROTOCOL_STATUS_CHANGE` com `old_status`/`new_status` em `axis_audit_logs` para **toda** mudança via UPDATE. Cobertura de "quando" e "de/para": ✓.
- **"QUEM" está perdido:** o trigger preenche `user_id` com `COALESCE(current_setting('app.user_id', true),'system')` e `actor='system'` (`:2842-2843`), mas a aplicação **nunca seta `app.user_id`** — `withTenant` só seta `app.tenant_id` (`src/database/with-tenant.ts:203`; grep `app.user_id` em `src/` e `app/` = 0 fora do baseline). Resultado: **todas** as transições de protocolo ficam auditadas como `user_id='system'`, sem autor humano. O `PATCH protocols/[id]` não grava audit próprio da transição (o único INSERT dele é das sondas, `:76-82`) — depende 100% do trigger cego.
- **Transições que escapam:** nenhuma via UPDATE (trigger é incondicional). INSERT não gera log de status (criação em `draft` não é transição — aceitável). Acesso SQL direto com INSERT já-`mastered` escaparia da máquina E do log de transição.
- **Imutabilidade do log:** ✓ tripla — trigger append-only (`:8346`, função `:1469-1473`), RLS bloqueando UPDATE/DELETE (`:2566-2568`). Colunas `entity_type`/`entity_id` existem (`:3125-3126`); `user_id` é nullable desde a 069 (`069_shared_audit_logs_user_id_nullable.sql:32-33`).
- Sessões: `trg_session_aba_audit` (`:8381`, função `:2855-2891`) loga start/end/cancel — mas atribui a `NEW.therapist_id` (quem agendou), não a quem executou a ação.
- **Functions SQL com INSERT de auditoria sintaticamente inválido** — `(action, entity_type, entity_type, metadata, created_at)`: coluna duplicada e 5 colunas × 6 valores (erro 42601/42701 garantido em execução): `detect_regression` (`:1151-1152`), `evaluate_generalization` (`:1226-1228`), `evaluate_maintenance_probe` (`:1319-1321`), `schedule_maintenance_probes` (`:2722-2723`), `register_consent` (`:2412`), `submit_session_summary` (`:2764`), e outras (`:325, :1784, :1836, :2494, :2520`). Hoje é código morto (nada as chama), mas qualquer tentativa futura de "religar o motor" falha na primeira auditoria — e, se o baseline reflete produção, essas functions estão quebradas no banco vivo.

---

## TABELA 1 — Consolidação dos achados

| # | Achado | Eixo | Severidade | BUG ou LACUNA? | Reprova auditoria de seguradora? |
|---|--------|------|-----------|----------------|----------------------------------|
| 1 | Fechamento de sessão contorna `close_session_aba`: sem snapshot, sem `clinical_states_aba`, sem CSO, sem audit com engine_version (`sessions/[id]/route.ts:152-163`) | A2 | Crítico | BUG (arquitetural, deliberado) | **SIM** |
| 2 | Motor CSO inteiro morto: SQL nunca chamado; TS (`src/engines/cso-aba.ts`) importado só por testes | A2 | Crítico | LACUNA | **SIM** |
| 3 | `mastered` sem validação de critério — só `window.confirm` (`aprendizes/[id]/page.tsx:290`) | A1 | Crítico | LACUNA | **SIM** |
| 4 | `mastery_criteria_sessions/trials` decorativos (nunca avaliados) | A1 | Médio | LACUNA | SIM (agrava #3) |
| 5 | Reprovação de sonda de manutenção é IMPOSSÍVEL: trigger rejeita `maintenance→regression`, rollback total da avaliação (`maintenance/route.ts:77-80` + baseline `:2953`) | B1 | Crítico | BUG | **SIM** (só dado positivo persiste) |
| 6 | Cancelamento de sondas viola CHECK (`status='cancelled'` vs `pending|completed`, `maintenance/route.ts:90` vs baseline `:3876`) | B1 | Crítico (mesmo caminho de #5) | BUG | SIM |
| 7 | Estado `regression` é zumbi: inalcançável e sem saída no trigger; UI e dashboard fingem que existe | B1 | Crítico | BUG | SIM |
| 8 | 7 botões da UI rejeitados pelo banco (`draft→archived`, 5× `→regression`, `regression→active`); 8 transições válidas escondidas | B1 | Médio | BUG | Não (mas quebra operação) |
| 9 | `mastered→active` depende da migration 075 — arquivo presente no working tree, **não commitado/aplicação não verificada** | B1 | Médio | Risco operacional | Não |
| 10 | Trilha de auditoria sem autor: `app.user_id` nunca setado → todo `PROTOCOL_STATUS_CHANGE` com `user_id='system'` (`with-tenant.ts:203` vs baseline `:2843`) | B3 | Crítico | BUG | **SIM** (não responde "quem") |
| 11 | Sessão `completed` editável: `duration_minutes_override`/`applied_by` sem checagem de status nem audit (`sessions/[id]/route.ts:170-211`) | A3/B2 | Crítico | BUG | **SIM** (dado de faturamento mutável) |
| 12 | Limiar duplo nas sondas: aprovação por `mastery_criteria_pct`, regressão por 70 fixo → "failed sem consequência" ou "passed com regressão" | B1 | Médio | BUG | SIM |
| 13 | Sondas órfãs: `maintenance→active` não cancela sondas pendentes | B1 | Médio | LACUNA | Não |
| 14 | PEI: meta "atingida" é derivação de UI (`.some()`), omite `mastered_validated`/`maintenance`, ignora `target_pct`, nada persistido/auditado | A4 | Médio | LACUNA | SIM (parcial) |
| 15 | `pei_goals` sem coluna de atingimento — reversão de protocolo não tem o que reverter no PEI | A4 | Médio | LACUNA | Não |
| 16 | Functions SQL do motor incompatíveis com schema real (colunas `probe_number/passed/regression_triggered/completed_at/conducted_by/probe_date` inexistentes) | A2/B1 | Médio | BUG (código morto) | Não |
| 17 | INSERTs de auditoria inválidos (coluna duplicada, 5×6) em ≥10 functions SQL | B3 | Médio | BUG (código morto) | Não |
| 18 | `/api/aba/clinical-state` consulta coluna inexistente `cso_score` (rota morta e quebrada) | A2 | Baixo | BUG | Não |
| 19 | `generalization_status` nunca atualizado por nenhum caminho vivo | A2/B1 | Baixo | LACUNA | Não |
| 20 | Sessão nunca cancelável via app: `cancelled` inalcançável; `cancel_rate_30d` sempre 0; open não bloqueia reabertura de `cancelled` | B2 | Baixo | LACUNA | Não |
| 21 | Contadores "Dominados" da UI omitem `mastered_validated`/`maintenance` (`aprendizes/[id]/page.tsx:363`; `pei/page.tsx:172,213`) | A1 | Baixo | BUG | Não |
| 22 | Trigger de transição não valida INSERT (SQL direto pode criar protocolo já `mastered`) | B1 | Baixo | LACUNA | Não |
| 23 | Atestação/evidence bundle v2.7.0 é hook client-side fire-and-forget, sem reconciliação server-side | B2 | Médio | LACUNA | SIM (para operadora) |
| 24 | Estado vivo do banco não verificado nesta auditoria (DB local inacessível) — divergência baseline×prod possível | — | Médio | LACUNA (de auditoria) | — |

**Proteções que FUNCIONAM (para registro):** `score_pct` gerado (`:2305-2309`); trials/behaviors só em `in_progress` enforced no banco (`:2355`, `:2267`); DELETE de trial guardado e auditado; snapshots/clinical_states/audit_logs imutáveis por trigger+RLS (`:8346-8367`, `:2566-2568`); UNIQUE de sondas (`:6107`); POST de protocolo não aceita status do cliente; trigger de transição e de auditoria disparam para qualquer UPDATE, venha de onde vier.

---

## TABELA 2 — Top 5 riscos priorizados

| # | Risco | Por que importa |
|---|-------|-----------------|
| 1 | **CSO contornado no fechamento de sessão** (#1/#2) | O diferencial clínico do produto (motor determinístico, snapshot imutável, engine_version) não roda em nenhuma sessão real — o pipeline do CLAUDE.md está quebrado no elo central e não há estado clínico defensável para mostrar a uma operadora. |
| 2 | **Reprovação de sonda impossível de registrar** (#5/#6/#7) | O sistema só consegue persistir sucesso: quem tenta registrar falha recebe erro 500 e o dado se perde — viés otimista estrutural que uma auditoria técnica de seguradora identificaria como adulteração involuntária da base. |
| 3 | **"Dominado" é opinião de um clique** (#3/#4) | O status clínico mais importante do ABA não confere o critério que o próprio sistema armazena (X% em N sessões) — indefensável quando a operadora perguntar "prove que dominou". |
| 4 | **Auditoria sem autor** (#10) | A trilha existe e é imutável, mas responde "system" para toda pergunta "quem marcou dominado?" — exatamente a pergunta que uma fiscalização faz primeiro. |
| 5 | **Sessão fechada com faturamento editável** (#11) | Duração e profissional responsável — os dois campos que valem dinheiro num claim — podem ser alterados após o fechamento, sem registro. |

---

*Auditoria somente leitura realizada em 07/07/2026. Nenhuma correção proposta neste documento, conforme escopo.*
