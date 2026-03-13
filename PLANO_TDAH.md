# AXIS TDAH — Plano Arquitetural v1.0

## Atualizado: 13/03/2026
## Status: Motor CSO-TDAH v1.0 implementado e testado (71 testes ✅)

---

## 1. VISÃO GERAL

O AXIS TDAH é o terceiro módulo do ecossistema AXIS, ao lado do TCC e ABA.
Baseado na AXIS_TDAH_BIBLE v2.5, ele compartilha o backbone AXIS mas possui motor clínico derivado próprio (CSO-TDAH v1.0).

### Diferença fundamental vs ABA

| Aspecto | AXIS ABA | AXIS TDAH |
|---------|----------|-----------|
| Motor | CSO-ABA v3.0 (4 dimensões lineares) | CSO-TDAH v1.0 (3 blocos + layer AuDHD) |
| Dimensões base | SAS, PIS, BSS, TCM | SAS-TDAH, PIS-TDAH, BSS-TDAH, TCM-TDAH |
| Camada extra | Não tem | Camada Executiva (EXR, CTX) |
| Layer clínica | Não tem | Layer AuDHD (SEN, TRF, RIG, MSK) com 3 estados |
| RIG | Não existe | Categórico (NÃO linear) — 4 estados + severity |
| MSK | Não existe | Em validação operacional (campo opcional) |
| Contextos | Clínica apenas | Casa + Escola + Clínica (tricontextual) |
| DRC/DBRC | Não tem | Core do produto (Daily Report Card) |
| Snapshot | Por sessão | Por sessão OU por revisão clínica/ciclo de monitoramento |
| Perfis de acesso | Admin, Supervisor, Terapeuta | Admin, Supervisor, Clínico, Terapeuta, Professor, Responsável |
| Missing data | Flag simples | Flag composto (primary + array) + source_contexts |
| Confidence | Não tem | high / medium / low |
| Público | Aprendiz (TEA) | Criança TDAH (com ou sem AuDHD) |

---

## 2. O QUE REAPROVEITA DO ABA (copiar e adaptar)

### 2.1 Infraestrutura (100% compartilhada, sem mudança)

- PostgreSQL multi-tenant com RLS
- Clerk autenticação
- `withTenant` wrapper
- `axis_audit_logs` append-only
- `user_licenses` (product_type: 'tdah')
- `engine_versions` table
- Webhook Hotmart (adicionar product_id TDAH)
- Hub page (adicionar card TDAH)
- Email templates (adicionar branding TDAH)
- Push notifications
- LGPD/consentimento framework

### 2.2 Padrão de páginas (copiar estrutura, mudar conteúdo)

| ABA (origem) | TDAH (destino) | O que muda |
|---|---|---|
| `app/aba/page.tsx` (dashboard) | `app/tdah/page.tsx` | KPIs diferentes (tricontextual), chart CSO-TDAH |
| `app/aba/aprendizes/` | `app/tdah/pacientes/` | Terminologia "paciente" vs "aprendiz", campos TDAH |
| `app/aba/sessoes/` | `app/tdah/sessoes/` | Eventos TDAH vs trials ABA, blocos de tarefa |
| `app/aba/configuracoes/` | `app/tdah/configuracoes/` | Google Calendar (já pronto), perfil TDAH |
| `app/aba/equipe/` | `app/tdah/equipe/` | Roles diferentes (professor, responsável) |
| `app/aba/relatorios/` | `app/tdah/relatorios/` | Relatório TDAH com layer AuDHD |
| `app/aba/ajuda/` | `app/tdah/ajuda/` | Conteúdo de ajuda TDAH |
| `app/aba/onboarding/` | `app/tdah/onboarding/` | Steps de onboarding TDAH |
| `app/aba/layout.tsx` | `app/tdah/layout.tsx` | License gate product_type: 'tdah' |
| `SidebarABA.tsx` | `SidebarTDAH.tsx` | Links TDAH + cor TDAH |
| `OnboardingABA.tsx` | `OnboardingTDAH.tsx` | Steps TDAH |

### 2.3 Padrão de APIs (copiar estrutura, mudar queries/lógica)

| ABA (origem) | TDAH (destino) | O que muda |
|---|---|---|
| `/api/aba/learners` | `/api/tdah/patients` | Schema TDAH, campos AuDHD layer |
| `/api/aba/sessions` | `/api/tdah/sessions` | Session type (sessão/revisão/monitoramento) |
| `/api/aba/sessions/[id]/trials` | `/api/tdah/sessions/[id]/observations` | Observações TDAH vs trials discretos |
| `/api/aba/sessions/[id]/behaviors` | `/api/tdah/sessions/[id]/events` | Eventos TDAH (ABC quando aplicável) |
| `/api/aba/clinical-state` | `/api/tdah/clinical-state` | CSO-TDAH output com 3 blocos + layer |
| `/api/aba/dashboard` | `/api/tdah/dashboard` | KPIs tricontextuais |
| `/api/aba/alerts` | `/api/tdah/alerts` | Alertas TDAH + layer AuDHD |
| `/api/aba/reports` | `/api/tdah/reports` | Relatório TDAH com visibilidade por perfil |
| `/api/aba/protocols` | `/api/tdah/protocols` | Biblioteca P1 TDAH (12 protocolos) |
| `/api/aba/guardians` | `/api/tdah/guardians` | Responsáveis com acesso contextual |
| `/api/aba/team` | `/api/tdah/team` | Roles expandidos (professor, mediador) |
| `/api/aba/pei` | `/api/tdah/plano` | Plano TDAH (não PEI) |

---

## 3. O QUE É NOVO (não existe no ABA)

### 3.1 Motor CSO-TDAH (criar do zero)

**Arquivo:** `src/engines/cso-tdah.ts`

O motor tem 3 blocos com pesos configuráveis:

**Bloco 1 — Camada Base AXIS (4 métricas)**
- SAS-TDAH: aquisição de habilidades (% acerto por sessão)
- PIS-TDAH: independência de prompts (4 níveis)
- BSS-TDAH: estabilidade comportamental (3 pontos)
- TCM-TDAH: consistência de intervenção entre contextos (checklist aderência)

**Bloco 2 — Camada Executiva (2 métricas)**
- EXR: regulação executiva funcional (escala 4 pontos)
- CTX: consistência contextual (comparação entre 2+ contextos)

**Bloco 3 — Layer AuDHD (4 métricas, ativável por caso)**
- SEN: carga sensorial (escala 3 pontos)
- TRF: atrito em transições (escala 3 pontos)
- RIG: rigidez-impulsividade (CATEGÓRICO — 4 estados + severity, NÃO linear)
- MSK: custo de masking (EM VALIDAÇÃO — campo opcional)

**Regras de cálculo:**
- `core_score` = média ponderada de SAS/PIS/BSS/TCM válidos
- `executive_score` = média ponderada de EXR/CTX válidos
- `audhd_layer_score` = média ponderada de SEN/TRF (RIG é flag, MSK é opcional)
- `final_score` = weighted_available_blocks (renormalização quando bloco ausente)
- `final_band` = sem_dados / critico / atencao / bom / excelente
- `confidence_flag` = low / medium / high

**Regra crítica RIG:**
```
rig_state: balanced | rigidity_leaning | impulsivity_leaning | dual_risk
rig_severity: none | mild | moderate | high
```
RIG NÃO entra no score numérico. É flag clínica + modulador interpretativo.

**Regra crítica MSK:**
Campo opcional, não obrigatório. Status: `validation_pending` até piloto.

### 3.2 Layer AuDHD (sistema de ativação por caso)

**Não existe no ABA.** Conceito totalmente novo:
- Ativada por decisão clínica no cadastro do paciente
- 3 estados: `off` | `active_core` | `active_full`
- Estado default para baseline: `active_core`
- `active_full` só quando MSK for validado
- Desativação preserva histórico (append-only)
- Snapshot registra estado da layer no momento

### 3.3 Módulo Escola (páginas e APIs novas)

- DRC/DBRC (Daily Report Card) — core do produto TDAH
- Registro de professor (perfil simplificado)
- Observação contextual escolar
- Integração escola-casa com reforço cruzado

### 3.4 Módulo Casa

- Treino parental (instruções curtas, sequência clara)
- Registro de rotina doméstica
- Economia de fichas
- Portal família expandido (mais que no ABA)

### 3.5 Snapshot expandido

**Diferente do ABA** — snapshot TDAH é mais complexo:

```
snapshot_type: session_close | clinical_review | monitoring_cycle | manual_override
session_id: obrigatório apenas quando snapshot_type = session_close
source_record_id: UUID da origem (revisão, ciclo, override)
generated_by_type: engine | human_override
generated_by_user_id: obrigatório quando human_override
audhd_layer_status: off | active_core | active_full
source_contexts_json: { clinical, home, school } cada um present|missing|not_applicable
missing_data_primary_flag + missing_data_flags (array composto)
```

### 3.6 Visibilidade por perfil (mais granular que ABA)

| Dado | Clínico/Supervisor | Terapeuta | Professor | Responsável | Admin |
|---|---|---|---|---|---|
| Core completo | ✅ | Resumido | ❌ | ❌ | ❌ |
| Executive completo | ✅ | Resumido | ❌ | ❌ | ❌ |
| Layer AuDHD | ✅ | SEN/TRF/RIG | ❌ | ❌ | ❌ |
| RIG detalhado | ✅ | Operacional | Funcional | ❌ | ❌ |
| MSK | ✅ | ❌ | ❌ | ❌ | ❌ |
| DRC/DBRC | ✅ | ✅ | ✅ (registra) | Progresso | ❌ |
| Snapshots completos | ✅ | ❌ | ❌ | ❌ | ❌ |
| Progresso resumido | ✅ | ✅ | ✅ | ✅ | ❌ |
| Logs/sistema | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 4. BANCO DE DADOS — Migration 022

**Arquivo:** `scripts/migrations/022_full_tdah_setup.sql`

### Tabelas novas TDAH

| Tabela | Baseada em (ABA) | Campos novos |
|---|---|---|
| `tdah_patients` | `learners` | `audhd_layer_status`, `audhd_layer_activated_by`, `audhd_layer_activated_at`, `audhd_layer_reason`, `audhd_layer_engine_version`, campos de escola, responsável |
| `tdah_sessions` | `sessions_aba` | `snapshot_type`, `source_record_id`, `session_context` (clinical/home/school) |
| `tdah_observations` | `session_targets` | Observações estruturadas por bloco de tarefa (não trials discretos) |
| `tdah_events` | `session_behaviors` | Eventos TDAH: ABC quando aplicável, eventos de transição, sensorial |
| `clinical_states_tdah` | `clinical_states_aba` | `core_score`, `executive_score`, `audhd_layer_score`, `final_score`, `final_band`, `confidence_flag`, `audhd_layer_status`, `source_contexts_json`, `missing_data_primary_flag`, `missing_data_flags_json`, `rig_state`, `rig_severity`, `core_metrics_json`, `executive_metrics_json`, `audhd_metrics_json` |
| `tdah_snapshots` | `session_snapshots` | Todos os campos do Anexo G da BIBLE |
| `tdah_protocols` | `learner_protocols` | Protocolos P1 TDAH, adaptação AuDHD flag |
| `tdah_drc` | NOVO | Daily Report Cards (professor → sistema → clínico) |
| `tdah_routines` | NOVO | Rotinas domésticas estruturadas |
| `tdah_plans` | `pei_plans` | Plano TDAH (não PEI) |
| `tdah_plan_goals` | `pei_goals` | Metas do plano com domínio TDAH |
| `tdah_audhd_log` | NOVO | Log de ativação/desativação da layer AuDHD |
| `tdah_protocol_library` | `protocol_library` | 12 protocolos P1 seed |

### Tabelas compartilhadas (sem mudança, apenas usar)

- `tenants`, `profiles`, `user_licenses`, `engine_versions`
- `axis_audit_logs`, `guardians`, `guardian_consents`
- `calendar_connections`, `calendar_sync_state`
- `notifications`, `email_logs`

---

## 5. HUB — Adicionar card TDAH

**Arquivo:** `app/hub/page.tsx`

Adicionar terceiro produto no array PRODUCTS:

```
{
  id: 'tdah',
  name: 'AXIS TDAH',
  description: 'Estrutura clínica para TDAH com integração escola-casa-clínica',
  logo: '/axistdah.png',
  href: '/tdah',
  accent: COR_TDAH_A_DEFINIR,
  product_type: 'tdah'
}
```

**Decisão pendente:** cor accent do TDAH (TCC = navy #1a1f4e, ABA = coral #c4785a, TDAH = ?)

---

## 6. BRANDING TDAH

### Paleta de cores — A DEFINIR

| Uso | Sugestão | Justificativa |
|---|---|---|
| Primary | Verde-teal? Roxo? | Precisa ser distinto do navy TCC e coral ABA |
| Accent | A definir | |
| Light | A definir | |

### Terminologia

| Conceito | TDAH | ABA (referência) | TCC (referência) |
|---|---|---|---|
| Sujeito | Paciente/Criança | Aprendiz | Paciente |
| Profissional | Clínico | Supervisor BCBA | Psicólogo |
| Encontro | Sessão | Sessão | Sessão |
| Motor | CSO-TDAH v1.0 | CSO-ABA v3.0 | CSO-TCC v3.0 |
| Plano | Plano TDAH | PEI | — |
| Escola | DRC/DBRC | — | — |
| Casa | Rotina/Treino Parental | — | — |

---

## 7. ORDEM DE IMPLEMENTAÇÃO SUGERIDA

### Fase 1 — Fundação (semana 1)
1. Migration 022 (schema completo)
2. Engine CSO-TDAH v1.0 (src/engines/cso-tdah.ts)
3. Testes do engine
4. Seed engine_versions (CSO-TDAH v1.0.0)
5. Seed protocol_library TDAH (12 P1)
6. Hub card TDAH
7. License gate TDAH

### Fase 2 — Core CRUD (semana 1-2)
8. Layout TDAH + SidebarTDAH
9. API /tdah/patients (CRUD + audhd_layer)
10. API /tdah/sessions (CRUD + snapshot_type)
11. API /tdah/observations (blocos de tarefa)
12. API /tdah/events (eventos TDAH)
13. Página pacientes TDAH
14. Página sessões TDAH
15. Página sessão detalhe

### Fase 3 — Motor e Estado Clínico (semana 2)
16. API /tdah/clinical-state (CSO-TDAH)
17. Snapshot pipeline (session_close + clinical_review)
18. Dashboard TDAH com KPIs
19. Alertas clínicos
20. Relatório TDAH (PDF com visibilidade por perfil)

### Fase 4 — Contextos (semana 3)
21. Módulo DRC/DBRC (escola)
22. Módulo rotina doméstica (casa)
23. Portal família expandido
24. Integração escola-casa-clínica
25. Perfil professor (acesso simplificado)

### Fase 5 — Layer AuDHD (semana 3-4)
26. Sistema de ativação/desativação
27. Coleta SEN, TRF, RIG
28. MSK como campo opcional
29. Snapshot com layer status
30. Dashboard com layer toggle
31. Visibilidade por perfil

### Fase 6 — Comercial (semana 4)
32. Onboarding TDAH
33. Webhook Hotmart (product_id TDAH)
34. UpgradeModalTDAH
35. Landing page /produto/tdah
36. Email templates TDAH
37. Configurações TDAH (Google Calendar já pronto)

### Fase 7 — Polish e Beta
38. Testes E2E
39. Bug scan final
40. NOTE_TDAH.md
41. Deploy beta

---

## 8. ESTIMATIVA DE ESFORÇO

| Categoria | Arquivos novos | Baseados em ABA | Totalmente novos |
|---|---|---|---|
| Pages (app/tdah/) | ~18 | 15 (copiar+adaptar) | 3 (DRC, rotina, escola) |
| APIs (app/api/tdah/) | ~25 | 20 (copiar+adaptar) | 5 (DRC, rotina, audhd-log) |
| Engine | 1 | 0 (do zero) | 1 (cso-tdah.ts) |
| Components | ~5 | 3 (copiar+adaptar) | 2 (DRC widget, layer toggle) |
| Migration | 1 | 0 | 1 (022_full_tdah_setup.sql) |
| Testes | ~5 | 2 (copiar+adaptar) | 3 (cso-tdah, layer, snapshot) |
| Total estimado | ~55 arquivos | ~40 adaptados | ~15 novos |

**Tempo estimado:** 3-4 semanas para beta funcional (assumindo ritmo similar ao TCC)

---

## 9. RISCOS E DECISÕES PENDENTES

| # | Decisão | Impacto | Quem decide |
|---|---------|---------|-------------|
| 1 | ~~Cor accent do TDAH~~ | ✅ DECIDIDO | Verde-teal escuro (#0d7377) — profissional, distinto de navy TCC e coral ABA |
| 2 | Logo TDAH (axistdah.png) | Hub, landing | Alê (criar logo) |
| 3 | Pricing TDAH (R$?/mês) | Webhook, modal | Alê |
| 4 | Hotmart product_id TDAH | Webhook | Alê (criar produto) |
| 5 | ~~MSK campo obrigatório ou opcional~~ | ✅ DECIDIDO | Opcional (Bible v2.5: validação operacional) |
| 6 | v1.0 com ou sem módulo escola? | Escopo beta | Alê |
| 7 | v1.0 com ou sem portal família? | Escopo beta | Alê |
| 8 | ~~Solo ou multi-terapeuta~~ | ✅ DECIDIDO | Multi-terapeuta (como ABA) — múltiplos perfis (clínico, terapeuta, professor, supervisor) |
| 9 | ~~Motor: 3 blocos ou só base?~~ | ✅ DECIDIDO | 3 blocos desde v1.0 (Base + Executiva + AuDHD) |
| 10 | ~~Pesos: fixo ou configurável?~~ | ✅ DECIDIDO | Configurável via engine_versions (JSON no banco) |

---

## 10. REGRAS IMUTÁVEIS (da BIBLE v2.5)

1. Backbone compartilhado. Motor clínico derivado.
2. AuDHD NÃO é produto separado — é layer dentro do TDAH
3. RIG é categórico (4 estados), NUNCA escala linear
4. MSK é campo opcional até validação operacional
5. Snapshot registra estado da layer no momento
6. Desativação de layer preserva histórico (append-only)
7. Missing data NUNCA é tratado como melhora
8. TCM-TDAH mede adultos, CTX mede criança (mesmos dados, cálculos diferentes)
9. Sessão fechada é imutável
10. Julgamento clínico permanece humano

---

## PRÓXIMO PASSO

Quando Alê decidir as pendências (especialmente #8 — solo vs multi-terapeuta), criar:
1. `skills/skill_axis_tdah.md` (skill de desenvolvimento)
2. Migration 022
3. Engine CSO-TDAH v1.0

---

---

## SESSÕES DE TRABALHO

### 2026-03-13 (manhã) — Planejamento + Motor CSO-TDAH v1.0
- Lido AXIS_TDAH_BIBLE v2.5 completa (887 parágrafos)
- Mapeado ABA completo (18 páginas, 25+ APIs, 26 tabelas, engine CSO-ABA)
- Cruzamento TDAH vs ABA: ~40 arquivos adaptáveis, ~15 totalmente novos
- PLANO_TDAH.md criado com plano arquitetural completo
- Decisões tomadas: multi-terapeuta, verde-teal #0d7377, 3 blocos v1.0, pesos configuráveis
- ✅ Motor CSO-TDAH v1.0 implementado (src/engines/cso-tdah.ts) — 530 linhas
- ✅ 71 testes passando (src/engines/__tests__/cso-tdah.test.ts)
- Motor híbrido: herda padrão ABA (SAS/PIS/BSS/TCM) + Camada Executiva (EXR/CTX) + Layer AuDHD (SEN/TRF/RIG categórico/MSK)
- Próximo: Migration 022, Hub card TDAH, APIs core

---

**Referência:** AXIS_TDAH_BIBLE v2.5, AXIS_ABA_BIBLE v2.6.1, skill_axis_architecture.md
