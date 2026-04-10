# AXIS TDAH — Auditoria Completa do Módulo
**Data:** 2026-04-10
**Base:** SKILL_TDAH.md (spec), NOTE_TDAH.md (diário), varredura de código

---

## INVENTÁRIO DO MÓDULO

| Categoria | Qtd | Detalhes |
|-----------|-----|---------|
| Páginas frontend | 21 | dashboard, pacientes, sessões, protocolos, planos, DRC, alertas, relatórios, escola, família, casa, equipe, configurações, preços, ajuda, onboarding, seletor clínica + layout + redirect |
| APIs internas | 34 | patients, sessions, protocols, protocol-library, plans, drc, observations, events, scores, dashboard, guardians, team, alerts, reports, clinical-state, lgpd/export, lgpd/delete, escola/tokens, familia/tokens, patient-therapists, routines, token-economy, chat-ana |
| APIs públicas | 3 | /api/escola/[token], /api/escola/[token]/drc, /api/familia/[token] |
| Componentes | 4 | SidebarTDAH, OnboardingTDAH, UpgradeModalTDAH, TooltipTDAH |
| Engine | 2 | cso-tdah.ts (719 linhas), cso-tdah-adapter.ts (162 linhas) |
| Migrations | 8 | 022, 023, 025, 026, 027, 029, 038, 048 |
| Testes motor | 71 | cso-tdah.test.ts |
| Testes contrato SQL | 9 | tdah-schema-contract.test.ts |
| Testes isolamento | 16 | tdah-isolation.test.ts |

---

## 1. FUNCIONANDO (implementado e no ar)

| Funcionalidade | Arquivos | Status |
|---------------|----------|--------|
| Motor CSO-TDAH v1.0.0 (3 blocos + AuDHD) | `src/engines/cso-tdah.ts` | OK — 71 testes verdes |
| Adapter observações → CsoTdahInput | `src/engines/cso-tdah-adapter.ts` | OK |
| Snapshot automático ao fechar sessão (append-only) | `api/tdah/sessions/[id]/route.ts` | OK |
| Cadastro paciente (nome, diagnóstico, CID, escola, responsável) | `api/tdah/patients/route.ts` | OK |
| Ficha paciente com gráfico SVG CSO | `app/tdah/pacientes/[id]/page.tsx` | OK |
| Edição de dados do paciente (modal) | `api/tdah/patients/[id]/route.ts` PATCH | OK |
| Layer AuDHD toggle (off/core/full) + audit log | `api/tdah/patients/[id]/route.ts` | OK |
| Sessões tricontextuais (clínico/domiciliar/escolar) | `api/tdah/sessions/route.ts` | OK |
| Condução sessão: abrir, observações, eventos, fechar | `app/tdah/sessoes/[id]/page.tsx` | OK |
| Observações com validação enums (SAS/PIS/BSS/EXR/SEN/TRF/RIG) | `api/tdah/observations/route.ts` | OK |
| Eventos (8 tipos, ABC condicional) | `api/tdah/events/route.ts` | OK |
| Biblioteca 46 protocolos (42 P1 + 4 P1.1) | `api/tdah/protocol-library/route.ts` | OK |
| Ciclo de vida protocolo (active→review→mastered→archived + regression/suspended/discontinued) | `api/tdah/protocols/[id]/route.ts` | OK |
| Página detalhe protocolo com transições | `app/tdah/protocolos/[id]/page.tsx` | OK |
| Plano clínico TDAH (14 domínios, metas, lifecycle) | `api/tdah/plans/route.ts` | OK |
| DRC — Daily Report Card (máx 3/dia, review clínico) | `api/tdah/drc/route.ts` | OK |
| Dashboard com KPIs reais (tricontextual, CSO, AuDHD) | `api/tdah/dashboard/route.ts` | OK |
| Alertas clínicos (5 tipos, 3 severidades) | `api/tdah/alerts/route.ts` | OK |
| Relatórios imprimíveis (scores, protocolos, DRC, contextos) | `api/tdah/reports/route.ts` | OK |
| Portal professor (token 64-char, DRC, rate limiting) | `app/escola/[token]/page.tsx` | OK |
| Portal família (LGPD consent, dados simplificados) | `app/familia/[token]/page.tsx` | OK |
| Módulo Casa (rotinas + economia de fichas) | `app/tdah/casa/page.tsx` | OK |
| Gestão equipe (admin/supervisor/terapeuta) | `api/tdah/team/route.ts` | OK |
| Envio resumo sessão (email via Resend) | `api/tdah/sessions/[id]/summary/route.ts` | OK |
| Responsáveis (CRUD + primary) | `api/tdah/guardians/route.ts` | OK |
| LGPD Export (JSON completo) | `api/tdah/lgpd/export/route.ts` | OK |
| LGPD Delete/Anonimização (90d retention) | `api/tdah/lgpd/delete/route.ts` | OK |
| License gate (product_type tdah) | `app/tdah/layout.tsx` | OK |
| Hotmart webhook (product 7380571, 3 offer codes) | `app/api/webhook/hotmart/route.ts` | OK |
| Free tier gate (1 paciente) | `UpgradeModalTDAH.tsx` | OK |
| Onboarding (LGPD + escolha fluxo) | `OnboardingTDAH.tsx` | OK |
| Central de Ajuda (13 seções + Ana chatbot) | `app/tdah/ajuda/page.tsx` | OK |
| Google Calendar (conectar/sync/desconectar) | `app/tdah/configuracoes/page.tsx` | OK |
| Vínculo N:N terapeuta-paciente (migration 038) | `api/tdah/patient-therapists/route.ts` | OK |
| Tooltips clínicos (55 textos) | `lib/tooltips-tdah.ts` + `TooltipTDAH.tsx` | OK |
| Demo TDAH (3 pacientes mock) | `app/demo/tdah/` | OK |
| Landing page /produto/tdah | `app/produto/tdah/page.tsx` | OK |

---

## 2. INCOMPLETO / TODO no código

| Item | Arquivo | Linha | Detalhe |
|------|---------|-------|---------|
| TCM (Treatment Consistency Metric) placeholder | `src/engines/cso-tdah-adapter.ts` | 113 | Comentário: "Refinamento futuro: calcular baseado em protocolo completeness". TCM é hardcoded como valor default — não calcula aderência real ao tratamento |
| Snapshot non-blocking (falha silenciosa) | `api/tdah/sessions/[id]/route.ts` | ~225 | Se snapshot CSO falhar, sessão já foi fechada. Erro só em console.error — sem alerta ao usuário nem system_alert |
| Equipe: texto menciona `created_by` como vínculo | `app/tdah/equipe/page.tsx` | 239 | Texto na UI diz "cada terapeuta vê apenas os pacientes que cadastrou (via created_by)" — desatualizado após migration 038 (agora é N:N via `tdah_patient_therapists`) |
| Team invite: clerk_id temporário | `api/tdah/team/route.ts` | 108 | Usa `pending_${Date.now()}_${randomBytes(4)}` como clerk_user_id temporário até o convidado criar conta — funciona mas é provisório |
| Migrations pendentes em produção | NOTE_TDAH.md | 123 | "Deploy beta + migrations 030-032, 038 em produção" listado como próximo |
| Portais sem instrumentação de monitoramento | NOTE_TDAH.md | 158 | "Nenhuma rota TDAH-específica instrumentada" para system_alerts — candidatas: sessions, observations, DRC |

---

## 3. BUGS CONHECIDOS / Código provisório

| Item | Arquivo(s) | Detalhe |
|------|-----------|---------|
| 21 console.error/warn espalhados | `casa/page.tsx` (7), `escola/page.tsx` (4), `familia/page.tsx` (5), `configuracoes/page.tsx` (2), `layout.tsx` (2), `lgpd/*.ts` (2) | Devem ser migrados para logging estruturado ou `createSystemAlert()` |
| OnboardingTDAH fallback otimista | `OnboardingTDAH.tsx` linhas 66, 78 | "Falha de conexão, assumindo completo" — se API falhar, pula onboarding. Pode mascarar problemas reais de rede |
| Adapter não valida input | `cso-tdah-adapter.ts` | Não tem try/catch — assume que todas as observações do banco são válidas. Se enum corrompido chegar do banco, o motor quebra silenciosamente |
| Chat Ana carrega SKILL_TDAH.md sem fallback | `api/tdah/chat-ana/route.ts` linhas 23, 130 | Se arquivo não existir em disco (deploy sem docs/), `readFileSync` lança exceção. Console.error mas sem graceful degradation |
| Texto equipe desatualizado | `app/tdah/equipe/page.tsx` linha 239 | Referencia "created_by" quando o sistema agora usa `tdah_patient_therapists` |

---

## 4. FUNCIONALIDADES PREVISTAS NA SKILL_TDAH.md NÃO IMPLEMENTADAS

| Funcionalidade (SKILL_TDAH §) | Status | Gap |
|-------------------------------|--------|-----|
| **Notificações push/email ativas** (§15, §19) | PARCIAL | UI de toggle existe em Configurações, mas NÃO há sistema de disparo real de notificações (push, email, cron). Alertas são apenas leitura na tela — sem envio proativo |
| **Log de acesso professor** visível na gestão (§11) | PARCIAL | Access log é gravado em `tdah_teacher_access_log`, mas a UI de gestão (`/tdah/escola`) não exibe "quando o professor acessou o portal" conforme descrito na spec |
| **Reaproveitamento de token família** (§12) | VERIFICAR | Spec diz "O sistema pode reaproveitar um token existente para o mesmo responsável". API tem lógica de reuse, mas precisa validação E2E |
| **Rotinas visíveis no portal família** (§13) | VERIFICAR | Spec: "Os pais podem seguir a rotina pelo portal família". A API `/api/familia/[token]` não parece retornar dados de `tdah_routines` |
| **Economia de fichas no portal família** (§13) | VERIFICAR | Spec: saldo de fichas visível. Não confirmado se portal família expõe `tdah_token_economy` |
| **Filtro tokens expirados na gestão escola** (§11) | PARCIAL | Filtros existem (ativos/revogados/todos) mas "expirados" como status separado não é explícito |
| **TCM real no motor** (§8) | NÃO | TCM (Treatment Consistency Metric) é placeholder. Spec menciona "Base combina SAS, PIS, BSS e TCM" mas TCM não calcula aderência real |
| **Configurações de notificação por tipo** (§19) | PARCIAL | UI tem toggles mas sem backend que honre as preferências |

---

## 5. SEGURANÇA / LGPD PENDENTES

| Prioridade | Item | Detalhe |
|-----------|------|---------|
| **P0 CRÍTICO** | Audit log ausente em session close | Fechar sessão (gera snapshot CSO) NÃO grava em `axis_audit_logs`. Operação clínica mais crítica do pipeline sem rastreabilidade |
| **P0 CRÍTICO** | Audit log ausente em transição de protocolo | PATCH status protocolo (active→mastered, etc.) não grava audit log. Spec (§5) exige: "Cada transição exige confirmação e gera registro no log de auditoria" |
| **P1 ALTO** | Audit log ausente em review DRC | Revisão clínica de DRC (`/api/tdah/drc/[id]` PATCH) não grava audit. É ação clínica com responsabilidade profissional |
| **P1 ALTO** | Audit log ausente em criação de recursos | Criar paciente, ativar protocolo, agendar sessão — nenhuma dessas operações grava audit log |
| **P1 ALTO** | `/api/tdah/scores` sem `canAccessTdahPatient` | Endpoint aceita `patient_id` como query param mas não verifica vínculo terapeuta. Terapeuta A pode consultar scores do paciente do terapeuta B dentro do mesmo tenant |
| **P2 MÉDIO** | Portais públicos sem rate limit por token | Rate limit é por IP (30/min). Um ator mal-intencionado com IPs rotativos pode enumerar tokens. Considerar rate limit por token também |
| **P2 MÉDIO** | Snapshot failure sem alerta | Se CSO-TDAH snapshot falhar ao fechar sessão, erro vai apenas para console.error. Deveria gravar `createSystemAlert({ module: 'axis-tdah' })` |
| **P2 MÉDIO** | Chat Ana sem sanitização de output | `chat-ana/route.ts` retorna resposta do GPT-4o-mini direto. Se prompt injection via histórico de conversa, resposta pode conter conteúdo impróprio |
| **P3 BAIXO** | Rotas clínicas sem rate limit | Apenas portais públicos têm rate limiting explícito. Rotas autenticadas dependem apenas de auth Clerk — sem proteção contra abuso por usuário autenticado |
| **P3 BAIXO** | LGPD Export não cobre `tdah_teacher_access_log` | Export JSON lista patients, sessions, observations, snapshots, DRC, audhd_log — mas não inclui logs de acesso de professores |

---

## RESUMO EXECUTIVO

| Categoria | Score |
|-----------|-------|
| Funcionalidades implementadas | **35/38** (~92%) |
| Cobertura de testes | Motor 71 + Schema 9 + Isolation 16 + Auth 56 = **152 testes** |
| Segurança (auth/tenant) | **Forte** — withTenant() em todas as rotas, canAccessTdahPatient em 13+ rotas |
| Audit trail | **Fraco** — presente apenas em AuDHD toggle, LGPD ops e team. Ausente em session close, protocols, DRC review, criações |
| LGPD compliance | **Bom** — export/delete/anonimização OK. Falta access_log no export |
| Portais públicos | **Bom** — rate limiting, token validation, visibility constraints OK |
| Monitoramento | **Inexistente** para rotas TDAH — nenhuma rota grava system_alerts |

**Ações prioritárias:**
1. Implementar audit logs em session close + protocol transitions (P0)
2. Adicionar `canAccessTdahPatient` em `/api/tdah/scores` (P1)
3. Implementar sistema de disparo de notificações (push/email) (P1)
4. Instrumentar rotas TDAH com `createSystemAlert()` (P2)
5. Corrigir texto desatualizado "created_by" na página de equipe (P3)
