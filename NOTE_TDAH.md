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
| 13/03/2026 | API protocol library (GET) | `app/api/tdah/protocol-library/route.ts` |
| 13/03/2026 | API protocolos paciente (GET/POST) | `app/api/tdah/protocols/route.ts` |
| 13/03/2026 | API protocolo por ID (GET/PATCH) | `app/api/tdah/protocols/[id]/route.ts` |
| 13/03/2026 | Seção protocolos na ficha do paciente | `app/tdah/pacientes/[id]/page.tsx` — com modal biblioteca |
| 13/03/2026 | API sessão por ID (GET/PATCH open/close/cancel) | `app/api/tdah/sessions/[id]/route.ts` |
| 13/03/2026 | API observations (POST com validação Bible §7-§9) | `app/api/tdah/observations/route.ts` |
| 13/03/2026 | Página condução de sessão | `app/tdah/sessoes/[id]/page.tsx` — abrir, registrar, fechar |
| 13/03/2026 | CSO-TDAH adapter + snapshot automático | `src/engines/cso-tdah-adapter.ts`, API session close |
| 13/03/2026 | API scores CSO-TDAH (GET) | `app/api/tdah/scores/route.ts` |
| 13/03/2026 | Gráfico SVG evolução CSO na ficha | `app/tdah/pacientes/[id]/page.tsx` |
| 13/03/2026 | Sessões clicáveis (Link → condução) | `app/tdah/sessoes/page.tsx`, ficha paciente |
| 13/03/2026 | Layer AuDHD toggle (API PATCH + UI + audit log) | `app/api/tdah/patients/[id]/route.ts`, ficha paciente |
| 13/03/2026 | Form observação com campos AuDHD condicionais | `app/tdah/sessoes/[id]/page.tsx` — SEN/TRF/RIG se layer ativa |
| 13/03/2026 | Dashboard TDAH API (KPIs reais) | `app/api/tdah/dashboard/route.ts` |
| 13/03/2026 | Dashboard TDAH com métricas reais | `app/tdah/dashboard/page.tsx` — tricontextual, CSO, AuDHD |
| 13/03/2026 | API DRC (GET + POST + PATCH + review) | `app/api/tdah/drc/route.ts`, `app/api/tdah/drc/[id]/route.ts` |
| 13/03/2026 | Página DRC com timeline agrupada | `app/tdah/drc/page.tsx` — metas, toggle, review inline |
| 13/03/2026 | DRC na sidebar + link na ficha | `SidebarTDAH.tsx`, `pacientes/[id]/page.tsx` |
| 13/03/2026 | Página produto TDAH (landing page) | `app/produto/tdah/page.tsx` + layout SEO |
| 13/03/2026 | API relatórios TDAH (dados agregados) | `app/api/tdah/reports/route.ts` |
| 13/03/2026 | Página relatórios TDAH (imprimível) | `app/tdah/relatorios/page.tsx` |
| 13/03/2026 | Fase 7a — Edição paciente (modal + API expandida) | `app/api/tdah/patients/[id]/route.ts`, ficha paciente |
| 13/03/2026 | Fase 7b — API alertas clínicos TDAH | `app/api/tdah/alerts/route.ts` |
| 13/03/2026 | Fase 7c — Página alertas + sidebar alerta | `app/tdah/alertas/page.tsx`, `SidebarTDAH.tsx` |
| 13/03/2026 | Fase 7d — Página detalhe protocolo (transições) | `app/tdah/protocolos/[id]/page.tsx` |
| 13/03/2026 | Fase 7e — Guardians API + UI | `app/api/tdah/guardians/route.ts`, `[id]/route.ts` |
| 13/03/2026 | Fase 7f — Enviar resumo sessão (email) | `app/api/tdah/sessions/[id]/summary/route.ts`, template email |
| 13/03/2026 | Migration 024 — session_summaries multi-módulo | `scripts/migrations/024_*`, `scripts/run-migration-024.ts` |
| 13/03/2026 | Fase 7g — Página de Configurações TDAH | `app/tdah/configuracoes/page.tsx` |
| 13/03/2026 | Fase 7h — Central de Ajuda TDAH | `app/tdah/ajuda/page.tsx` |
| 13/03/2026 | Fase 8a — Gestão de equipe TDAH | `app/api/tdah/team/route.ts`, `app/tdah/equipe/page.tsx` |
| 13/03/2026 | Fase 8b — Onboarding TDAH (overlay 2 telas) | `app/components/OnboardingTDAH.tsx`, layout |
| 13/03/2026 | Fase 8c — Página de Preços TDAH | `app/tdah/precos/page.tsx` |
| 13/03/2026 | Fase 8d — Seletor de Clínica TDAH | `app/tdah/selecionar-clinica/page.tsx` |
| 13/03/2026 | Fase 9a — Free tier gate (UpgradeModalTDAH) | `app/components/UpgradeModalTDAH.tsx` |
| 13/03/2026 | Fase 9b — LGPD Export TDAH (JSON) | `app/api/tdah/lgpd/export/route.ts` |
| 13/03/2026 | Fase 9b — LGPD Delete/Anonimização TDAH | `app/api/tdah/lgpd/delete/route.ts` |

### 🔄 EM ANDAMENTO

| Item | Status | Bloqueio |
|------|--------|----------|
| - | - | - |

### ❌ PRÓXIMOS

| # | Item | Dependência |
|---|------|-------------|
| 1 | Portal família | Aprovado — implementar (ver ABA como referência) |
| 2 | Módulo escola completo (perfil professor, integração) | Aprovado — implementar |
| 3 | API /tdah/events | Nenhum |
| 4 | API /tdah/clinical-state | Nenhum |
| 5 | Plano TDAH (tdah_plans) — API + páginas | Nenhum |
| 6 | Módulo casa (rotina, treino parental, economia fichas) | Nenhum |
| 7 | Testes E2E | Após desenvolvimento |
| 8 | Deploy beta | Após testes |

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
| ~~1~~ | ~~Logo TDAH~~ | ✅ DECIDIDO | axistdah.png já em public/ |
| ~~2~~ | ~~Pricing TDAH~~ | ✅ DECIDIDO | Founders R$97, Clínica100 R$247, Clínica250 R$497 |
| ~~3~~ | ~~Hotmart product_id TDAH~~ | ✅ DECIDIDO | 7380571 |
| ~~4~~ | ~~v1.0 com módulo escola?~~ | ✅ SIM | Aprovado por Alê |
| ~~5~~ | ~~v1.0 com portal família?~~ | ✅ SIM | Aprovado por Alê (ver ABA como ref) |

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

### 13/03/2026 — Sessão 5
- Fase 3: Gestão de protocolos TDAH
- API protocol-library: GET com filtros block/priority/audhd
- API protocols: GET (lista por paciente com role filter) + POST (ativar da library com validação de duplicata)
- API protocol [id]: GET + PATCH com ciclo de vida (VALID_TRANSITIONS Bible §12)
- PATCH: timestamps automáticos (started_at, mastered_at, archived_at) conforme status
- Ficha do paciente atualizada: seção protocolos ativos + modal biblioteca com 46 protocolos
- Modal mostra código, bloco, priority, badge AuDHD, botão ativar (com proteção de duplicata)

### 13/03/2026 — Sessão 6
- Fase 4: Condução de sessão e registro de observações
- API session [id]: GET (sessão + observações + protocolos ativos), PATCH (open/close/cancel + notes)
- PATCH close: calcula duration_minutes automático a partir de started_at
- Bible §11 enforced: sessão fechada é imutável (rejeita PATCH com action)
- API observations: POST com validação completa de todos os enums (PIS, BSS, EXR, SEN, TRF, RIG)
- Verifica sessão in_progress antes de aceitar observação
- Verifica protocolo ativo do paciente se protocol_id informado
- Página condução de sessão: breadcrumb, status badges, botões abrir/fechar
- Modal registro de observação: protocolo selector, tarefa, camada base (SAS/PIS/BSS), executiva (EXR), notas
- Timeline de observações com badges coloridos por métrica

### 13/03/2026 — Sessão 7
- Fase 5: Motor CSO-TDAH integrado ao pipeline
- Adapter: `src/engines/cso-tdah-adapter.ts` — converte observações do banco → CsoTdahInput
- API scores: GET por paciente (lê tdah_snapshots com role filter)
- PATCH close sessão agora gera snapshot CSO-TDAH automático (append-only)
- Busca pesos do engine_versions, audhd_layer_status do paciente, observações da sessão
- Salva snapshot completo: scores, métricas, flags, source_contexts (tudo JSONB)
- Snapshot é non-blocking: se falhar, sessão já foi fechada (log de erro apenas)
- Gráfico SVG na ficha do paciente: linha final_score + core_score (dashed), zonas de banda
- Tabela de scores com badges por bloco (Base/Exec/AuDHD) e band badge
- Pipeline completo: Obs → Adapter → Motor → Snapshot → Gráfico

### 13/03/2026 — Sessão 8
- Fase 6a: Layer AuDHD completa
- API PATCH paciente: toggle audhd_layer_status (off / active_core / active_full)
- Audit log: toda mudança grava em tdah_audhd_log (append-only, Bible §9.3)
- Registra: previous_status, new_status, changed_by, reason, engine_version
- Ficha do paciente: card AuDHD com 3 botões de estado + badge
- Modal de confirmação com campo "motivo clínico" (opcional)
- Borda roxa (#7c3aed) diferencia visualmente da cor TDAH
- Condução de sessão: campos SEN + TRF aparecem se layer ≠ off
- Campos RIG (estado + severidade) só aparecem se layer = active_full
- Badge "AuDHD Core/Full" no header da sessão
- Badge TRF adicionado na timeline de observações
- API session GET agora inclui audhd_layer_status do paciente

### 13/03/2026 — Sessão 8b
- Fase 6b: Dashboard TDAH com métricas reais
- API dashboard: KPIs agregados com role filter (terapeuta vê só seus pacientes)
- Métricas: total_patients, audhd_active, sessions_month/today, active/mastered_protocols
- CSO-TDAH médio: avg_cso (último snapshot por paciente), patients_critical (banda crítica)
- Distribuição tricontextual: barras clínico/domiciliar/escolar com % (30 dias)
- KPIs avançados: avg_session_duration, protocols_regression, total_sessions_completed
- Quick stats row + atalhos rápidos (novo paciente, agendar sessão, etc.)
- Substituiu placeholder por dashboard funcional completo

### 13/03/2026 — Sessão 8c
- Fase 6c: Daily Report Card (DRC) completo
- API DRC: GET (lista por paciente com filtros data), POST (com limite Bible §17: máx 3 metas/dia)
- API DRC [id]: GET detalhe, PATCH (atualizar dados + ação review clínico)
- Validações: filled_by enum, score 0-100, protocolo pertence ao paciente
- Página DRC: seletor de paciente, timeline agrupada por data, toggle goal_met (3 estados)
- Review inline: clínico revisa DRC com notas (Bible §14.2 item 4)
- Modal criação: meta, data, protocolo vinculado, score, quem preencheu, notas professor
- DRC adicionado na sidebar TDAH (acessível para todos os roles)
- Link "Ver DRCs" na ficha do paciente com ícone escolar
- Decisão registrada: free tier TDAH = 1 paciente ativo (mesma regra ABA)

### 13/03/2026 — Sessão 8d
- Fase 6d: Página produto TDAH (landing page /produto/tdah)
- Layout SEO: metadata, Open Graph, JSON-LD, keywords TDAH
- Redirect: se logado com licença TDAH ativa → /tdah/dashboard
- Hero: "TDAH não é só clínica. É escola, casa e contexto."
- Bloco tricontextual: 3 cards (Clínico, Domiciliar, Escolar) com ícones
- Fluxo operacional: 5 passos (Cadastro → Protocolo → Sessão → Motor → DRC)
- DRC mockup: 3 metas com barra de progresso, nota da professora, badge revisado
- Layer AuDHD: 3 modos (Off, Core, Completa) explicados
- Ana (chatbot) mockup com pergunta sobre AuDHD
- Tabela de planos: Free (1 paciente) + Clínica (em breve)
- CTA final + footer com links institucionais
- Usa imagem axisTDAH.transparente.png do public/

### 13/03/2026 — Sessão 9
- Fase 7a: Edição de dados do paciente
- API PATCH paciente expandida: campos editáveis (nome, nascimento, gênero, diagnóstico, CID, suporte, escola, notas clínicas, status)
- Validações: nome obrigatório, gênero M/F/O, support_level 1-3, status change admin/supervisor only
- Role check: terapeuta só edita seus pacientes (created_by)
- Modal de edição na ficha do paciente (só envia campos alterados)
- Fase 7b: Alertas clínicos TDAH
- API alerts: 5 tipos (critical_score, regression, no_session, drc_pending, score_drop)
- Severidade (high/medium/low) com sort automático
- Dashboard atualizado com seção de alertas
- Fase 7c: Página Alertas dedicada
- Filtros por severidade, cards resumo, links para ficha do paciente
- Sidebar atualizada com ícone de alertas (sino)
- Relatórios agora acessível por terapeuta também
- Fase 7d: Página detalhe protocolo
- Ciclo de vida completo com VALID_TRANSITIONS (Bible §12)
- Botões de transição com confirmação e warnings
- Timestamps automáticos por status
- Observações vinculadas ao protocolo
- Notas AuDHD com borda roxa
- Fase 7e: Gestão de responsáveis (guardians)
- APIs: GET/POST guardians + PATCH/DELETE guardian por ID
- is_primary support, soft delete
- Seção guardians na ficha do paciente com modal criação
- Fase 7f: Enviar Resumo da Sessão aos Pais
- Migration 024: session_summaries multi-módulo (DROP FK, ADD source_module)
- Script run-migration-024.ts com pattern Pool do projeto
- Template email TDAH (teal header, contexto, LGPD)
- API summary: POST draft → PUT approve → PUT send (Resend)
- Modal envio na sessão: seletor guardians, textarea, fluxo 3 etapas
- Fase 7g: Página de Configurações TDAH
- Perfil (nome + CRP), Notificações (toggles), Clínica (admin), Plano (tier), Privacidade
- Reusa APIs ABA (/api/aba/me, /api/aba/settings, /api/aba/plan)
- Role-aware visibility
- Fase 7h: Central de Ajuda TDAH
- 6 seções FAQ: Primeiros Passos, Sessões, Protocolos, AuDHD, DRC, Privacidade
- Accordion UI com busca, contato suporte

### 13/03/2026 — Sessão 10
- Fase 8a: Gestão de equipe TDAH
- API /api/tdah/team GET/POST: lista membros com contadores TDAH (patient_count via created_by, session_count via tdah_sessions)
- API /api/tdah/team/[id] PATCH/DELETE: alterar role, desativar (sem vínculos learner_therapists)
- Página equipe: lista, convite, role change, desativação. Sem seção vínculos (TDAH usa created_by)
- Fase 8b: Onboarding TDAH
- OnboardingTDAH overlay: Termo LGPD + escolha (Clínica ou Paciente)
- LGPD adaptado: menção CSO-TDAH, sessões tricontextuais, scores
- Reutiliza APIs /api/aba/onboarding (profiles compartilhados)
- Fase 8c: Página de preços TDAH
- Free (1 paciente) + Clínica (em breve, Hotmart pendente) + Enterprise
- Fase 8d: Seletor de clínica TDAH (multi-tenant)
- Reutiliza /api/aba/tenant-select, redireciona para /tdah
- Fase 9a: Free tier gate
- UpgradeModalTDAH: modal específico ao atingir limite de pacientes
- Substituiu UpgradeModal genérico (ABA) na página de pacientes
- Fase 9b: LGPD compliance TDAH
- Export: /api/tdah/lgpd/export — JSON completo (patients, sessions, observations, snapshots, DRC, AuDHD log)
- Delete: /api/tdah/lgpd/delete — GET status, POST agendar (90d), DELETE anonimizar, PATCH cancelar
- Preserva tdah_snapshots (Bible §7 — imutável) e audit_logs (5 anos)
- Anonimiza PII em todas as tabelas TDAH

### 13/03/2026 — Sessão 11
- Decisões respondidas por Alê:
  - Logo TDAH: axistdah.png já existe em public/
  - Módulo escola: SIM (perfil professor + integração escola-casa)
  - Portal família: SIM (ver ABA como referência)
  - Hotmart product_id: 7380571
  - Planos: Founders R$97 (50 pac), Clínica 100 R$247, Clínica 250 R$497
- Fase 10a: Pricing TDAH com planos reais
  - 5 cards: Free, Founders, Clínica 100, Clínica 250, Enterprise
  - Links Hotmart reais com offer codes
- Fase 10b: UpgradeModalTDAH com link Hotmart
  - Mostra plano Founders como recomendado (R$97/mês)
  - Link direto para Hotmart checkout
  - Link secundário para /tdah/precos (outros planos)
- Fase 10c: Webhook Hotmart — product_id TDAH
  - PRODUCT_MAP: 7380571 → 'tdah'
  - OFFER_TO_PLAN: xqzgdn1i (founders 50), cr3rh0u9 (clinica_100), hxzwuwfh (clinica_250)
  - EMAIL_FROM_MAP, PRODUCT_LABEL, DASHBOARD_PATH atualizados com 'tdah'

### 13/03/2026 — Sessão 8e
- Fase 6e: Relatórios TDAH
- API reports: agrega dados completos (paciente, protocolos, sessões, scores, DRCs) por período
- Resumos calculados: score_summary (delta, primeiro/último), session_summary (por contexto), drc_summary (taxa sucesso)
- Role filter: terapeuta vê só seus pacientes
- Página relatórios: seletor paciente + período, gera relatório imprimível
- Layout print-friendly: header AXIS TDAH, tabela scores, protocolos, sessões, DRC
- Botão "Imprimir / PDF" usa window.print()
- Footer com engine version + disclaimer clínico

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
