# AXIS ABA — Documentação Técnica (Skill)

Última atualização: 2026-02-28
Versão do sistema: CSO-ABA v1.0.0

---

## 1. VISÃO GERAL

O AXIS ABA é um sistema de gestão clínica para terapia ABA (Análise do Comportamento Aplicada).

**Princípios:**
- IA NÃO decide, NÃO executa, NÃO substitui julgamento clínico
- Decisão final SEMPRE humana
- Dados append-only (nunca sobrescreve histórico)
- Toda ação é auditável (axis_audit_logs)
- Sessão fechada é IMUTÁVEL (snapshot)
- Conforme diretrizes SBNI 2025 e ANS

---

## 2. FLUXO DO SISTEMA

Aprendiz → Protocolos → Sessões → Trials + Comportamentos ABC → CSO-ABA → Relatório → Decisão humana

---

## 3. ENTIDADES PRINCIPAIS

### Aprendiz (learner)
- Cadastro com nome, data de nascimento, diagnóstico, CID, nível de suporte
- Escola, notas, status ativo/inativo
- Vinculação a terapeutas (learner_therapists)

### Responsável (guardian)
- Vínculo com aprendiz (nome, parentesco, email, telefone)
- Consentimentos LGPD (guardian_consents)
- Acesso ao Portal Família

### Equipe (profiles)
- Roles: admin, supervisor, terapeuta
- Admin/supervisor: acesso total. Terapeuta: apenas seus aprendizes
- CRP/CRP_UF para registro profissional

---

## 4. PROTOCOLOS E CICLO DE VIDA

### Criação de Protocolo
- Vinculado a um aprendiz e a uma prática EBP (Evidence-Based Practice)
- Campos: título, domínio, objetivo, critérios de maestria
- Critérios de maestria configuráveis: % acerto, nº sessões, nº trials
- measurement_type configurável
- Pode ser vinculado a uma meta do PEI (pei_goal_id)
- engine_version registrada em cada protocolo (Engine Version Lock)

### 11 Status do Ciclo de Vida (Bible S3)
1. **draft** — rascunho (pode ir para active ou archived)
2. **active** — em aquisição (pode ir para mastered, suspended, discontinued)
3. **mastered** — domínio atingido (pode ir para generalization ou regression)
4. **generalization** — em generalização 3×2 (pode ir para mastered_validated ou regression)
5. **mastered_validated** — generalização validada (pode ir para maintenance ou regression)
6. **maintenance** — em manutenção com sondas (pode ir para maintained ou regression)
7. **maintained** — mantido ao longo do tempo (pode ir para archived ou regression)
8. **regression** — regressão detectada (volta para active)
9. **suspended** — suspenso temporariamente (máximo 30 dias — alerta automático)
10. **discontinued** — descontinuado (terminal — exige motivo obrigatório)
11. **archived** — arquivado (terminal — só a partir de maintained ou draft)

### Regras rígidas (Bible S3.2)
- Transições não listadas são PROIBIDAS
- discontinued exige discontinuation_reason (NOT NULL)
- suspended max 30 dias — após D+30 gera alerta automático
- mastered_validated exige grid de generalização completo (3 alvos × 2 ambientes)
- Toda transição gera registro em axis_audit_logs
- Arquivo: src/engines/protocol-lifecycle.ts

---

## 5. PEI (Plano Educacional Individualizado)

- Planos com título, período de início e metas
- Metas do PEI (pei_goals) com domínio, título, percentual alvo
- Protocolos podem ser vinculados a metas do PEI (rastreabilidade PEI → Protocolo)

---

## 6. SESSÕES ABA

### Registro de Sessão (sessions_aba)
- Vinculada a aprendiz e terapeuta
- Campos: agendamento, início, fim, status, localização, duração, notas
- Integração com Google Calendar (google_event_id, google_meet_link)
- patient_response registrado

### Trials por Sessão (session_targets)
- Registro por alvo: protocol_id, target_name
- trials_correct / trials_total (score calculado)
- prompt_level: independente, gestual, verbal, modelacao, fisica_parcial, fisica_total
- Notas opcionais

### Comportamentos ABC (session_behaviors)
- Registro ABC completo: antecedente, comportamento, consequência
- behavior_type, intensity (leve/moderada/alta/severa)
- duration_seconds, location opcionais
- function_hypothesis (hipótese funcional)

### Snapshot Imutável (session_snapshots)
- Gerado ao fechar sessão — IMUTÁVEL (Bible S7)
- Contém: cso_aba, sas, pis, bss, tcm, cso_band
- engine_version registrada (Engine Version Lock S12.1)

### Resumo para Responsáveis (session_summaries)
- Texto resumido da sessão para envio ao responsável
- Terapeuta SEMPRE revisa antes do envio (is_approved, approved_by)
- Registro de envio (sent_at)

---

## 7. MOTOR CSO-ABA v1.0.0

### O que é
Clinical State Object para ABA — índice de evolução clínica calculado longitudinalmente.

### Fórmula Principal (Bible S2.1)
CSO-ABA = (0.25 × SAS) + (0.25 × PIS) + (0.25 × BSS) + (0.25 × TCM)

Pesos FIXOS (0.25 cada). NÃO ajustáveis por tenant. Padrão nacional.

### 4 Dimensões (escala 0–100)

1. **SAS (Skill Acquisition Score)** — Aquisição de habilidades
   - SAS_ativos = Σ(score × trials) / Σ(trials) — média ponderada por tentativas
   - mastery_rate = nº alvos dominados / total alvos
   - mastery_score = média dos scores de maestria (maintained=100, mastered_validated=85, mastered=75)
   - SAS = SAS_ativos × (1 - mastery_rate) + mastery_score × mastery_rate

2. **PIS (Prompt Independence Score)** — Independência de dicas
   - Escala de prompt: independente=1.0, gestual=0.8, verbal=0.6, modelação=0.4, física parcial=0.2, física total=0.0
   - PIS = média(prompt_scale por alvo ativo) × 100

3. **BSS (Behavioral Stability Score)** — Estabilidade comportamental
   - Intensidades: leve=0.25, moderada=0.5, alta=0.75, severa=1.0
   - BSS = 100 × (1 - intensidade_atual) × fator_tendência
   - Quanto menor a intensidade comportamental, maior o BSS

4. **TCM (Therapeutic Consistency Metric)** — Consistência terapêutica
   - CV = desvio_padrão / média (das últimas 5 sessões)
   - TCM = 100 × (1 - CV)
   - Se < 2 sessões: TCM = 75 (neutro)

### Faixas de Interpretação (Bible S2.7)
- 85–100: Excelente — evolução consistente
- 70–84: Bom — progresso adequado
- 50–69: Atenção — possível estagnação
- 0–49: Crítico — pouco progresso ou falta de dados

### Características Técnicas
- Escala: 0 a 100 (normalizada com clamp)
- Append-only: nunca faz UPDATE, sempre INSERT (clinical_states_aba)
- engine_version registrada em cada cálculo
- Arquivo: src/engines/cso-aba.ts

---

## 8. GENERALIZAÇÃO 3×2 (Bible S4)

### Grid de Generalização
- 3 variações de estímulo × 2 variações de contexto = 6 células
- Cada célula avaliada com trials_total, trials_correct, prompt_level
- Score % calculado por célula
- Critério: 6/6 células aprovadas (≥ mastery_criteria_pct do protocolo)

### Auto-transição
- Quando grid 3×2 completo e 100% aprovado → auto-transição para mastered_validated
- Registro automático em axis_audit_logs (GENERALIZATION_GRID_COMPLETE)
- Arquivo: app/api/aba/generalization/route.ts

---

## 9. MANUTENÇÃO (Bible S5)

### Sondas de Manutenção
- Agendadas automaticamente: semana 2, semana 6, semana 12 após "maintained"
- Cada sonda avaliada com trials_total, trials_correct, prompt_level
- Resultado: passed ou failed

### Regressão Automática
- Score < 70% em sonda → regressão automática
- Protocolo volta para status "regression" (regression_count incrementado)
- Sondas pendentes restantes são canceladas
- Registro em axis_audit_logs (REGRESSION_DETECTED_AUTO)
- Arquivo: app/api/aba/maintenance/route.ts

---

## 10. ALERTAS

- Regressões detectadas geram alertas automáticos
- Lista protocolo + aprendiz + contagem de regressões
- Filtrado por role: terapeuta só vê seus aprendizes

---

## 11. RELATÓRIOS

### Export de Relatórios
- Relatórios para convênio (report_snapshots)
- Hash SHA256 (data_hash) para autenticidade
- engine_version registrada
- PDF gerado com dados do período

### Autenticidade
- Snapshots imutáveis garantem integridade
- Hash de dados no relatório
- Dados append-only garantem rastreabilidade

---

## 12. PORTAL FAMÍLIA

- Responsáveis recebem acesso ao portal via grant/revoke
- Visualização de resumos de sessão aprovados pelo terapeuta
- Rate limit: 100 req/min
- Controle de acesso granular por aprendiz

---

## 13. LGPD E COMPLIANCE

### Base Legal
- Art. 18, Lei 13.709/2018 (LGPD)
- Controlador: Clínica. Operador: Psiform Tecnologia (AXIS ABA)

### Exportação de Dados (Portabilidade)
- Exportação JSON completa de todos os dados do tenant
- Somente admin/supervisor podem solicitar
- Registro no audit log antes da exportação

### Política de Retenção (Bible S13.2)
- Dados clínicos: 7 anos (CFM/CRP)
- Relatórios gerados: 7 anos (CFM/CRP)
- Logs de auditoria: 5 anos (Compliance)
- Portal família: enquanto vínculo ativo (Consentimento)
- Email logs: 5 anos (Compliance)
- Notificações: 1 ano (Operacional)

### Exclusão de Dados
- Endpoint dedicado para exclusão LGPD
- Respeitando períodos de retenção obrigatórios

### Consentimentos (guardian_consents)
- Registro de consentimento com versão, IP, data
- Possibilidade de revogação

---

## 14. INTEGRAÇÕES

### Google Calendar
- Sync de sessões agendadas
- Webhook para atualizações
- Google Meet link integrado
- Configurável por tenant

### Clerk
- Autenticação de usuários
- Multi-tenant por organização/clínica

### OpenAI
- Chat Ana ABA: GPT-4o-mini (assistente virtual do módulo ABA)

---

## 15. ONBOARDING

- Setup inicial da clínica
- Progresso do onboarding rastreado
- Upload de documentos necessários

---

## 16. O QUE O AXIS ABA NÃO FAZ

- NÃO diagnostica
- NÃO prescreve intervenções
- NÃO interpreta resultados automaticamente
- NÃO compartilha dados sem autorização
- NÃO gera laudos — gera relatórios estruturados
- NÃO executa ações automaticamente
- NÃO substitui o julgamento clínico do profissional
- NÃO envia resumo ao responsável sem aprovação do terapeuta

---

## 17. TERMINOLOGIA ABA

| Termo | Significado |
|-------|-------------|
| Aprendiz | Pessoa em atendimento ABA (equivalente a "paciente" na TCC) |
| Protocolo | Programa de ensino vinculado a uma prática EBP |
| Trial | Tentativa discreta — unidade mínima de mensuração |
| Alvo (Target) | Habilidade específica sendo trabalhada dentro de um protocolo |
| Prompt | Dica/ajuda dada ao aprendiz (níveis: independente → física total) |
| Comportamento ABC | Registro de Antecedente-Comportamento-Consequência |
| CSO-ABA | Clinical State Object ABA — índice de evolução (0-100) |
| SAS | Skill Acquisition Score — aquisição de habilidades |
| PIS | Prompt Independence Score — independência de dicas |
| BSS | Behavioral Stability Score — estabilidade comportamental |
| TCM | Therapeutic Consistency Metric — consistência terapêutica |
| PEI | Plano Educacional Individualizado |
| EBP | Evidence-Based Practice — prática baseada em evidência |
| Generalização 3×2 | Grid de 3 variações de estímulo × 2 contextos |
| Manutenção | Sondas em 2, 6 e 12 semanas após maintained |
| Regressão | Queda de desempenho que retorna protocolo para active |
| Snapshot | Registro imutável do estado da sessão no momento do fechamento |
| Faixa | Classificação interpretativa do CSO-ABA (Excelente/Bom/Atenção/Crítico) |
| Maestria | Domínio de um alvo/protocolo (critérios configuráveis) |
