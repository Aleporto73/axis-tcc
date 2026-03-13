# NOTE_TDAH.md — Diário de Desenvolvimento

## Documento de Referência
- AXIS_TDAH_BIBLE_v2.5 (baseline congelado)
- PLANO_TDAH.md (arquitetura e fases)

---

## STATUS ATUAL

### ✅ CONCLUÍDO

| Data | Item | Arquivos |
|------|------|----------|
| 13/03/2026 | Motor CSO-TDAH v1.0 | `src/engines/cso-tdah.ts` |
| 13/03/2026 | Testes do motor (71 verdes) | `src/engines/__tests__/cso-tdah.test.ts` |
| 13/03/2026 | PLANO_TDAH.md | raiz |
| 13/03/2026 | Migration 022 (schema completo) | `scripts/migrations/022_full_tdah_setup.sql` |
| 13/03/2026 | Seed engine_versions CSO-TDAH v1.0.0 | dentro da migration 022 |
| 13/03/2026 | Seed protocol_library (12 P1 + 2 P1.1) | dentro da migration 022 |
| 13/03/2026 | Migration 022 aplicada na VPS (Docker) | 14 tabelas + enums + indexes OK |
| 13/03/2026 | Fix engine_versions schema real | ALTER TABLE ADD COLUMN engine_name, weights |
| 13/03/2026 | Migration 023 — 45 protocolos completos | `scripts/migrations/023_seed_tdah_protocols_full.sql` |
| 13/03/2026 | Fix 023 block VARCHAR(10) | Nomes longos → códigos A-G |
| 13/03/2026 | Migration 023 aplicada na VPS | 46 protocolos (42 P1 + 4 P1.1) confirmados |
| 13/03/2026 | Skill clone ABA→TDAH | `skills/skill_axis_clone_aba_tdah.md` |
| 13/03/2026 | Hub card TDAH | `app/hub/page.tsx` — cor #0d7377, grid 3 colunas |
| 13/03/2026 | License gate TDAH (layout) | `app/tdah/layout.tsx` — product_type 'tdah' |
| 13/03/2026 | Sidebar TDAH | `app/components/SidebarTDAH.tsx` — cor #0d7377, role-aware |
| 13/03/2026 | Dashboard TDAH (placeholder) | `app/tdah/dashboard/page.tsx` |
| 13/03/2026 | Redirect /tdah → /tdah/dashboard | `app/tdah/page.tsx` |
| 13/03/2026 | API pacientes TDAH (GET + POST) | `app/api/tdah/patients/route.ts` |
| 13/03/2026 | API paciente por ID (GET) | `app/api/tdah/patients/[id]/route.ts` |
| 13/03/2026 | API sessões TDAH (GET + POST) | `app/api/tdah/sessions/route.ts` |
| 13/03/2026 | Página lista pacientes TDAH | `app/tdah/pacientes/page.tsx` |
| 13/03/2026 | Página detalhe paciente TDAH | `app/tdah/pacientes/[id]/page.tsx` |
| 13/03/2026 | Página sessões TDAH (tricontextual) | `app/tdah/sessoes/page.tsx` |

### 🔄 EM ANDAMENTO

| Item | Status | Bloqueio |
|------|--------|----------|
| - | - | - |

### ❌ PRÓXIMOS (Fase 3)

| # | Item | Dependência |
|---|------|-------------|
| 1 | Página produto TDAH (`/produto/tdah`) | - |
| 2 | Gráficos CSO-TDAH na ficha do paciente | Motor CSO + API scores |
| 3 | Gestão de protocolos (ativar/desativar) | API protocolos |
| 4 | Layer AuDHD na ficha do paciente | Motor CSO bloco C |
| 5 | Relatórios TDAH | Sessões + protocolos |

---

## DECISÕES TOMADAS

| Data | Decisão | Impacto |
|------|---------|---------|
| 13/03/2026 | Multi-terapeuta (como ABA) | Arquitetura de perfis e permissões |
| 13/03/2026 | Cor verde (#0d7377) | Branding, UI |
| 13/03/2026 | 3 blocos desde v1.0 | Motor completo desde início |
| 13/03/2026 | Pesos configuráveis via engine_versions | Flexibilidade pós-piloto |

---

## DECISÕES PENDENTES

| # | Decisão | Impacto | Quem decide |
|---|---------|---------|-------------|
| 1 | Logo TDAH (axistdah.png) | Hub, landing | Alê |
| 2 | Pricing TDAH (R$?/mês) | Webhook, modal | Alê |
| 3 | Hotmart product_id TDAH | Webhook | Alê |
| 4 | v1.0 com ou sem módulo escola? | Escopo beta | Alê |
| 5 | v1.0 com ou sem portal família? | Escopo beta | Alê |

---

## LOG DE SESSÕES

### 13/03/2026 — Sessão 1
- Criado motor CSO-TDAH v1.0 (530 linhas, 3 blocos)
- Criados 71 testes (todos passando)
- Criado PLANO_TDAH.md com arquitetura completa
- Decisões: multi-terapeuta, cor verde, 3 blocos, pesos configuráveis
- Push feito

### 13/03/2026 — Sessão 2
- Criada migration 022_full_tdah_setup.sql (726 linhas)
- 5 ENUMs, 14 tabelas, 25 índices, 2 constraints nomeadas
- Seed engine_versions: CSO-TDAH v1.0.0 com pesos JSONB
- Seed protocol_library: 12 P1 + 2 P1.1 candidatos (Bible Anexo B)
- 6 melhorias sobre comando do 4.5: IF NOT EXISTS, sem RLS policy, schema engine_versions correto, colunas úteis extras, seeds completos, tdah_guardians separada
- Aguardando push + aplicação no VPS

### 13/03/2026 — Sessão 3
- Migration 022 aplicada com sucesso na VPS via Docker (axis-postgres)
- Descoberto: schema real `engine_versions` diferente da migration 004 (sem engine_name, sem weights, tem effective_date e is_current)
- Fix: ALTER TABLE ADD COLUMN IF NOT EXISTS para engine_name e weights
- Seed CSO-TDAH v1.0.0 inserido com pesos JSONB
- Migration 023 recebida do 4.5: 45 protocolos completos da BIBLE v2.5
- Fix líder: block VARCHAR(10) não aceita nomes longos — mapeado para códigos A-G
- Fix líder: 3 colunas novas (bible_version, system_fields, is_active) adicionadas via ALTER TABLE
- Problemas do 4.5 nesta sessão: schema engine_versions errado, block com nomes longos em vez de códigos
- Aguardando aplicação da 023 na VPS
- Migration 023 aplicada com sucesso: 46 protocolos no banco (42 P1 + 4 P1.1)
- Criada skill `skills/skill_axis_clone_aba_tdah.md` — guia de conversão ABA→TDAH

### 13/03/2026 — Sessão 4
- Fase 2 completa: APIs + páginas frontend TDAH
- API pacientes: GET (lista com contadores) + POST (com plan limit + auto-guardian)
- API paciente por ID: GET com subqueries total_sessions e active_protocols
- API sessões: GET (filtros patient_id, status, context) + POST (auto session_number)
- Página pacientes: lista com avatar, idade, escola, modal criação completo (dados clínicos + escolares + responsável)
- Página detalhe paciente: métricas, dados clínicos/escolares, sessões recentes, placeholder Fase 3
- Página sessões: tricontextual (clínico/domiciliar/escolar), filtros status + contexto, modal agendamento com seletor visual de contexto
- Todas as páginas usam cor #0d7377, padrão visual consistente com ABA
- Diferenças TDAH: terapeuta filtra por created_by (sem tabela vínculo), sessão tricontextual, campos escola/professor

---

## REGRAS IMUTÁVEIS (da BIBLE v2.5)

1. Backbone compartilhado. Motor clínico derivado.
2. AuDHD NÃO é produto separado — é layer dentro do TDAH
3. RIG é categórico (4 estados), NUNCA escala linear
4. MSK é campo opcional até validação operacional
5. Snapshot registra estado da layer no momento
6. Desativação de layer preserva histórico (append-only)
7. Missing data NUNCA é tratado como melhora
8. Sessão fechada é imutável
9. Julgamento clínico permanece humano
