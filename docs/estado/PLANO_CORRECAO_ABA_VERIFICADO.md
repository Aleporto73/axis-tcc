# PLANO DE CORREÇÃO — AXIS ABA
## Integridade de Dado Clínico + Máquina de Estados

**Data:** 07/07/2026
**Módulo:** ABA (`app/aba/*`, `app/api/aba/*`, schema/migrations ABA)
**Natureza:** documento de PLANEJAMENTO. Nenhuma correção aplicada. Não executar hoje.
**Método:** todo achado abaixo foi **verificado contra o banco de PRODUÇÃO** (VPS `147.93.191.64`, db `axis_tcc`), não contra o dump. Onde a fonte é só o dump ou só código, está marcado.

---

## 0. COMO LER ESTE DOCUMENTO

Cada achado tem um selo de confiança:

- **[PROVADO]** — confirmado por query no banco vivo em 07/07/2026. Fato.
- **[CÓDIGO]** — confirmado por leitura de código/commit real com `arquivo:linha` ou hash. Fato de código.
- **[A VERIFICAR]** — herdado da auditoria Fable, ainda NÃO confirmado no banco. Tratar como hipótese até provar.

**Regra de ouro deste projeto:** nada entra em execução sem selo [PROVADO] ou [CÓDIGO]. Itens [A VERIFICAR] passam por query antes de virar tarefa.

---

## 1. RESUMO EXECUTIVO — O QUE É VERDADE

Cinco problemas reais foram confirmados no banco de produção. Em ordem de gravidade para uma auditoria de plano de saúde:

| # | Problema | Selo | Reprova seguradora? |
|---|----------|------|---------------------|
| G1 | Motor CSO desligado desde 17/04: ~20 sessões fecham sem snapshot/clinical_state/CSO | **[PROVADO]** | **SIM** |
| G3a | Trilha de auditoria sem autor: 99 mudanças de status, 0 com autor real (tudo "system") | **[PROVADO]** | **SIM** |
| G3b | Sessão concluída editável: 15 sessões `completed` foram alteradas após o fechamento | **[PROVADO]** | **SIM** |
| G2 | Máquina de estados furada: `regression` é estado-zumbi; reprovação de sonda impossível de persistir | **[PROVADO]** | **SIM** |
| G4 | "Dominado" sem validação de critério — só confirmação de clique | **[CÓDIGO]** | SIM (agrava) |
| G2b | 8 botões da UI dão erro 500 (banco rejeita); `regression` inteiro é morto | **[CÓDIGO]** | Não (quebra operação) |
| G2c | Limiar duplo de sonda cria zona morta (critérios reais 70/80/85 vs 70 fixo) | **[PROVADO]** | SIM |
| G3c | Atestação/evidência: 18/49 atestação, 0 presença, 0 evidence bundle | **[PROVADO]** | **SIM** |
| G5 | Meta PEI "atingida" não persiste — só cálculo de tela | **[PROVADO]** | Parcial |

**O que o Fable ERROU (e a verificação corrigiu):** o Fable afirmou "motor CSO totalmente morto, nunca chamado". FALSO. O banco mostra 29 sessões COM snapshot (jan–12/mar) e ~20 SEM (17/abr em diante). O motor funcionava e foi **desligado por um commit específico** (`0d44a0e`, 24/03). Isso muda a correção de "reconstruir motor" para "religar chamada" — muito menor.

---

## 2. EVIDÊNCIAS VERIFICADAS (o que foi provado hoje)

### G1 — Motor CSO desligado [PROVADO + CÓDIGO]
- Banco: 49 sessões `completed`; apenas 29 têm `session_snapshots`; 29 têm `clinical_states_aba`.
- Banco: quebra limpa por data — 100% com snapshot até 12/03; **primeira falha em 17/04/2026**; desde então nenhuma gera. Última furada: hoje 07/07 18:55.
- Código: commit `0d44a0e` (24/03/2026 20:35, "fix: correções P0 regressão ABA") **removeu** a chamada `SELECT * FROM close_session_aba(...)` em `app/api/aba/sessions/[id]/route.ts` e trocou por `UPDATE sessions_aba SET status='completed'` direto (linhas 152-163).
- Causa do commit: `close_session_aba` (o motor) existe **só no dump `000_shared_baseline.sql:534`**, nunca virou migration. Em staging (reconstruído por migrations) a função não existe → estourava erro → o dev fez bypass → desligou o CSO **também em produção**, onde a função existia.
- Nenhum outro caminho de runtime chama o motor (grep confirmou: só o comentário sobrou).

### G3a — Auditoria sem autor [PROVADO]
- Banco: 99 registros `PROTOCOL_STATUS_CHANGE` em `axis_audit_logs`; **0 com `user_id` diferente de 'system'**.
- Causa (código): `withTenant` seta `app.tenant_id` mas nunca `app.user_id`; o trigger cai no `COALESCE(..., 'system')`.

### G3b — Sessão concluída editável [PROVADO]
- Banco: 15 sessões `status='completed'` com `updated_at > ended_at + 1min` (editadas após o fechamento).
- Banco: 13 sessões `completed` com `duration_minutes_override` preenchido.
- Colunas existem: `duration_minutes_override` (integer), `applied_by` (uuid). Editáveis via `PATCH` sem checagem de status.

### G2 — Máquina de estados [PROVADO]
- Banco (trigger real de produção, `pg_get_functiondef`): `regression` NÃO aparece como origem nem destino de nenhuma transição. Estado inalcançável e sem saída. Confirmado.
- Banco: 0 protocolos em `regression` (consistente — impossível chegar lá).
- Banco: 30 sondas de manutenção, **todas `pending`**; 0 completed, 0 reprovada.
- Banco: CHECK de `maintenance_probes.status` só permite `pending` e `completed` — o código tenta gravar `cancelled`/dispara `regression`, ambos rejeitados.
- Banco confirmou: `mastered→active` (migration 075) NÃO está aplicado em produção.

### G4 — "Dominado" sem validação [CÓDIGO]
- `app/api/aba/protocols/[id]/route.ts` grava `status='mastered'` do body sem ler `session_targets`/scores.
- `mastery_criteria_sessions` e `mastery_criteria_trials` nunca são avaliados (grep = só formulários).
- Única barreira: `window.confirm` (P0, já em produção).

### G5 — Meta PEI não persiste [PROVADO]
- Banco: `pei_goals` tem apenas `id, pei_plan_id, title, domain, target_pct, notes, created_at`. **Nenhuma coluna de status/atingimento.**
- "Meta atingida" é derivação de UI em tempo de render — nada gravado, nada auditado.

### Proteções que FUNCIONAM (confirmado) [PROVADO]
- `session_targets.score_pct` é `GENERATED ALWAYS` — nota não pode ser falsificada.

---

## 3. ACHADOS VERIFICADOS APÓS A PRIMEIRA VERSÃO (agora PROVADOS)

Confirmados no banco/código em 07/07/2026, depois de escrito o rascunho:

### #8 — Botões da UI que dão erro 500 [CÓDIGO — trigger de prod]
- `validTransitions` (`app/aba/aprendizes/[id]/page.tsx:21`) oferece 19 transições; **8 são rejeitadas pelo trigger real** → erro 500.
- Os 8 quebrados: `draft→archived`, `mastered→regression`, `mastered→active` (falta 075), `generalization→regression`, `mastered_validated→regression`, `maintenance→regression`, `maintained→regression`, `regression→active`.
- `regression` inteiro na UI é botão morto (5 tentam ir PARA ele, 1 tenta sair DELE).
- Além disso, 8 transições que o banco PERMITE estão escondidas da UI (ex.: `maintenance→active`, `mastered→suspended`).
- Agravante: o erro do trigger é engolido em `protocols/[id]/route.ts:90-94` → vira "Erro ao atualizar protocolo" (500 genérico), sem dizer que foi transição inválida. Contraste: `sessions/[id]/route.ts:223` trata corretamente.

### #12 — Limiar duplo das sondas [PROVADO]
- Banco: protocolos com sonda têm critérios reais **70, 80 e 85**.
- Regressão de sonda usa **70 fixo**; aprovação usa `mastery_criteria_pct`.
- Consequência real: com critério 80 ou 85, score entre 70 e o critério = **zona morta** (nem passa, nem regride). Bug confirmado com dados reais.

### #23 — Atestação/evidência não gerada [PROVADO — grave]
- Banco: 49 sessões `completed` → apenas **18 têm atestação, 0 presença, 0 evidence bundle**.
- O hook client-side fire-and-forget falha na maioria. Dado de comprovação (exigido pela seguradora) inexiste para 31 de 49 sessões.

## 3b. ACHADOS AINDA [A VERIFICAR] (relevância só futura)

- **#16/#17** — functions SQL do motor incompatíveis com schema + INSERTs de auditoria inválidos. Relevante SÓ ao religar o motor (Fase D). Verificar no momento da Fase D, não antes.
- **#20** — `cancelled` inalcançável via app. Baixa gravidade. Verificar se/quando tocar sessões.

---

## 4. PLANO DE EXECUÇÃO (ordem proposta — NÃO executar hoje)

Princípio: menor risco e maior alívio primeiro; o motor (mais delicado) por último, com o resto estável.

### FASE A — Máquina de estados (base para tudo) [G2 + G2b + G2c]
Pré-requisito de G1 e G4: não dá para religar motor nem validar Dominado com a máquina furada.
- A1. Decidir destino de `regression` (ver Decisão 1). Corrigir o trigger de acordo (migration versionada).
- A2. Alinhar `validTransitions` (UI) ao trigger real — remover os 8 botões que dão 500; expor as 8 transições válidas hoje escondidas. [G2b]
- A3. Fechar o P1 pausado (reverter `mastered→active`) DENTRO desse redesenho, não isolado. Migration 075 entra aqui, revista.
- A4. Corrigir persistência de reprovação de sonda (CHECK + caminho de regressão) conforme Decisão 3. [G2]
- A5. Corrigir limiar duplo de sonda conforme Decisão 3 — eliminar a zona morta (70 fixo vs critério). [G2c]
- A6. Tratar o erro do trigger no PATCH (retornar 422 com motivo, como já faz `sessions/[id]/route.ts:223`) — o clínico passa a ver "transição inválida", não 500 genérico. [G2b]

### FASE B — Rastreabilidade / integridade de registro [G3a + G3b + G3c]
Alto valor para seguradora, risco moderado.
- B1. Setar `app.user_id` no `withTenant` → auditoria passa a registrar autor real. [G3a]
- B2. Bloquear edição de sessão `completed` (ou exigir motivo + audit log da alteração). [G3b]
- B3. Tornar geração de atestação/presença/evidence bundle confiável (server-side, não fire-and-forget client). Recuperar as 31 sessões sem comprovação. [G3c]

### FASE C — Validação do "Dominado" [G4]
Depende da máquina de estados limpa (Fase A).
- C1. Fazer o sistema conferir critério real (X% em N sessões) antes de permitir `mastered`, usando `mastery_criteria_*`.

### FASE D — Motor CSO [G1] — POR ÚLTIMO, o mais delicado
Requer as functions do motor versionadas antes de religar (senão staging quebra de novo — foi a causa original).
- D1. Versionar `close_session_aba`/`open_session_aba` (e dependências) como migration real, corrigindo as incompatibilidades de schema (#16/#17) no processo.
- D2. Religar a chamada ao motor no fechamento de sessão (reverter a lógica de `0d44a0e`, mantendo os fixes posteriores).
- D3. Recuperar as ~20 sessões órfãs: rodar o motor retroativamente nelas (o dado bruto — trials — ainda existe).
- D4. Auditoria-prova dedicada antes de deploy.

### FASE E — Vínculo PEI [G5] — quando fizer sentido de negócio
- E1. Decidir se "meta atingida" vira dado persistido (ver Decisão 2). Se sim, coluna + lógica + audit.

---

## 5. DECISÕES DE NEGÓCIO PENDENTES (só o Alê decide)

Estas travam o desenho técnico. Sem elas, a Fase A não fecha.

1. **`regression` — fica ou sai?**
   É estado clínico legítimo do ABA (aluno regrediu), mas hoje está quebrado (inalcançável e sem saída). Opções: (a) consertar para funcionar de verdade — dar entradas e saídas no trigger; (b) remover do enum/UI. Decisão muda a Fase A inteira.

2. **Meta PEI "atingida" — vira dado real e persistido, ou tela basta?**
   Define se a Fase E é grande (coluna + lógica + audit + reversão) ou inexistente.

3. **Limiar de reprovação de sonda — qual é a regra clínica correta?**
   Hoje aprovação usa o critério do protocolo (`mastery_criteria_pct`); regressão usa 70 fixo. Isso cria zona morta (score 75 com critério 80 = nem passa nem regride) e sobreposição (score 65 com critério 60 = passa E regride). Qual o comportamento clínico certo?

---

## 6. PRÓXIMOS PASSOS DESTE DOCUMENTO

1. ✅ Verificação concluída — todos os achados graves confirmados no banco/código de produção (07/07/2026). Restam apenas #16/#17 e #20 (relevância futura, seção 3b).
2. Alê responde as 3 decisões da seção 5.
3. Fable revisa ESTE plano (não os achados originais) — como auditor do plano.
4. Alê lê frio, aponta furos, fecha.
5. Só então: executar, fase por fase, começando pela Fase A, um bloco de cada vez.

**Nada é executado até este documento estar fechado e revisado.**

---

## 7. PLACAR DE VERIFICAÇÃO (07/07/2026)

| Achado | Selo | Evidência |
|--------|------|-----------|
| G1 — motor CSO desligado em 17/04 (commit `0d44a0e`) | PROVADO+CÓDIGO | 29 c/ snapshot até 12/03, 20 s/ snapshot após 17/04; diff do commit |
| G3a — auditoria sem autor | PROVADO | 99 logs, 0 com autor real |
| G3b — sessão editável pós-fim | PROVADO | 15 editadas após ended_at; 13 com override |
| G2 — regression zumbi / sonda só pending | PROVADO | trigger sem regression; 30 sondas todas pending; 0 protocolo em regression |
| G2b — 8 botões dão 500 | CÓDIGO | validTransitions vs trigger de prod |
| G2c — limiar duplo | PROVADO | critérios reais 70/80/85 vs 70 fixo |
| G3c — atestação/evidência furada | PROVADO | 18 atestação, 0 presença, 0 evidence de 49 |
| G5 — meta PEI não persiste | PROVADO | pei_goals sem coluna de status |
| G4 — Dominado sem validação | CÓDIGO | route grava status do body sem checar scores |
| score_pct protegido (proteção OK) | PROVADO | GENERATED ALWAYS |
| #16/#17, #20 | A VERIFICAR | relevância só na Fase D / futura |
