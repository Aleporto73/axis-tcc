# AXIS TCC — NOTE DE PROJETO (fonte unica de verdade)
## Atualizado: 11/03/2026 (manha)

---

## FOCO ATUAL: AxisTCC — Preparacao para Beta Comercial

> Dois produtos no mesmo repo: **AXIS ABA** (beta comercial ativo desde 12/03/2026) e **AXIS TCC** (cognitivo-comportamental).
> Prioridade agora: levar o **AXIS TCC** para o mesmo nivel comercial do ABA.
> Infraestrutura compartilhada ja pronta (auth, multi-tenant, billing base, LGPD, audit).

---

## ONDE ESTAMOS — TCC (verificado no codigo em 11/03/2026)

### Completude Geral: ~88%

### CORE ENGINE — 100% ✅
| Area | % | Status |
|---|---|---|
| Motor CSO-TCC v3.0.0 | 100% | 4 dimensoes (activation_level, emotional_load, task_adherence, cognitive_rigidity), escala 0-1, deterministico |
| Suggestion Engine v2.1 | 100% | 12 regras com prioridade 0-10, max 1 sugestao por ciclo, gate of silence |
| Append-only history | 100% | SHA256 hash em eventos, INSERT only |
| 9 tipos de eventos clinicos | 100% | AVOIDANCE/CONFRONTATION/ADJUSTMENT/RECOVERY_OBSERVED, SESSION_START/END, TASK_COMPLETED/INCOMPLETE, MOOD_CHECK |
| Testes engine | 100% | Cobertura em /src/engines/__tests__/ (parte dos 279 testes) |

### DATABASE — 100% ✅
| Area | % | Status |
|---|---|---|
| Schema TCC | 100% | 15+ tabelas (patients, sessions, events, clinical_states, suggestions, tasks, transcripts, etc.) |
| Multi-tenant | 100% | tenant_id em todas as tabelas, RLS enforced |
| Migrations | 100% | 18 migrations aplicadas |
| Audit log | 100% | axis_audit_logs append-only |

### API ENDPOINTS — 100% ✅
| Endpoint | Status | Descricao |
|---|---|---|
| /api/patients/* | ✅ | CRUD completo + clinical-record + evolution + sessions + supervision + push-link |
| /api/sessions/* | ✅ | CRUD + start + finish + report + create |
| /api/suggestions/* | ✅ | GET lista + PATCH decide (aprovar/editar/ignorar) |
| /api/events/create | ✅ | Pipeline de entrada de eventos clinicos |
| /api/stats | ✅ | Dashboard KPIs |
| /api/transcribe | ✅ | Whisper transcription + chunking >5MB + SSE streaming |
| /api/transcribe-audio | ✅ | Registros clinicos |
| /api/analyze-tcc | ✅ | Analise TCC especifica |
| /api/audit | ✅ | Log imutavel |
| /api/push/* | ✅ | FCM register/subscribe/send |
| /api/google/* | ✅ | Calendar sync (7 rotas) — botao desabilitado |
| /api/portal/* | ✅ | Portal Familia token-based |
| /api/user/* | ✅ | Profile, licenses, tenant selection |
| /api/demo/* | ✅ | Demo mode com dados publicos |
| /api/webhook/* | ✅ | Hotmart + Clerk webhooks |
| /api/cron/* | ✅ | Reminders + renew-webhook |

### UI / PAGES — 95% ✅
| Rota | Status | Arquivo | Observacao |
|---|---|---|---|
| /dashboard | ✅ | app/dashboard/page.tsx (17.1 KB) | Dashboard principal com KPIs |
| /sessoes | ✅ | app/sessoes/page.tsx (22.4 KB) | Lista de sessoes |
| /sessoes/[id] | ✅ | app/sessoes/[id]/page.tsx | Detalhe da sessao |
| /pacientes | ✅ | app/pacientes/page.tsx (12.8 KB) | Lista de pacientes |
| /pacientes/[id] | ✅ | app/pacientes/[id]/page.tsx | Perfil clinico do paciente |
| /relatorio/[id] | ✅ | app/relatorio/[patientId]/page.tsx | Relatorio evolucao (PDF via print) |
| /configuracoes | ✅ | app/configuracoes/page.tsx (18.3 KB) | Configuracoes |
| /sugestoes | ✅ | app/sugestoes/ | Gestao de sugestoes |
| /ajuda | ✅ | app/ajuda/ | Central de ajuda |
| /produto/tcc | ✅ | app/produto/tcc/page.tsx | Landing page com schema.org |
| /demo | ✅ | app/demo/ | Demo mode completo |

### COMPONENTS — 100% ✅
| Componente | Status | Arquivo |
|---|---|---|
| Sidebar.tsx | ✅ | app/components/Sidebar.tsx (7.6 KB) |
| EvolutionReport.tsx | ✅ | app/components/EvolutionReport.tsx (23.9 KB) |
| SessionReport.tsx | ✅ | app/components/SessionReport.tsx (7.9 KB) |
| Onboarding.tsx | ✅ | app/components/Onboarding.tsx (2.8 KB) |
| OnboardingChecklist.tsx | ✅ | app/components/OnboardingChecklist.tsx (4.3 KB) |
| OnboardingTooltip.tsx | ✅ | app/components/OnboardingTooltip.tsx (11.9 KB) |
| OnboardingOverlay.tsx | ✅ | app/components/OnboardingOverlay.tsx (3.7 KB) |
| PushNotificationSetup.tsx | ✅ | app/components/PushNotificationSetup.tsx (5.2 KB) |
| TermsModal.tsx | ✅ | app/components/TermsModal.tsx (5.2 KB) |
| RoleProvider.tsx | ✅ | app/components/RoleProvider.tsx (2.9 KB) |
| UpgradeModal.tsx | ✅ | app/components/UpgradeModal.tsx (4.7 KB) |
| CIDSelector.tsx | ✅ | components/CIDSelector.tsx (7.0 KB) |
| ErrorBoundary.tsx | ✅ | app/components/ErrorBoundary.tsx (3.4 KB) |
| Skeleton.tsx | ✅ | app/components/Skeleton.tsx (3.6 KB) |
| Toast.tsx | ✅ | app/components/Toast.tsx (1.5 KB) |

### COMERCIAL / BILLING — 70%
| Area | % | Status |
|---|---|---|
| Webhook Hotmart | ✅ | Compartilhado, reconhece produto TCC (ID 7299808) |
| User licenses | ✅ | Tabela + UPSERT on purchase |
| Free tier gate | ✅ | 1 paciente gratis, UpgradeModal apos limite |
| Gate no layout | ✅ | License check → redirect /hub se inativo |
| Email pos-compra | ✅ | Template compartilhado via Resend |
| /obrigado | ✅ | Thank you page pos-purchase |
| Pricing page TCC | ❌ | Landing existe mas checkout links nao conectados |
| Tiers/precos TCC | ❌ | Precisa definir (modelo ABA: free/founders/clinica_100/clinica_250) |
| UpgradeModal links | ❌ | Precisa apontar para checkout TCC correto |

### ONBOARDING — 90%
| Area | % | Status |
|---|---|---|
| Overlay funcional | ✅ | Codigo generico, funciona para TCC |
| LGPD acceptance | ✅ | TermsModal implementado |
| Setup psicologo | ✅ | Via /api/user/ |
| Progress tracking | ✅ | API + localStorage + cookie |
| Push notification setup | ✅ | Pos-onboarding |
| Branding TCC | ❌ | Copy/cores ainda focados no ABA |

### TEAM / MULTI-USER — 50%
| Area | % | Status |
|---|---|---|
| Multi-tenant DB | ✅ | tenant_id em tudo |
| RBAC | ✅ | admin/supervisor/therapist via with-role.ts |
| Multi-clinic | ✅ | Migration 018, cookie-based routing |
| Middleware role-aware | ✅ | Protege rotas por role |
| Pagina /equipe TCC | ❌ | Nao existe (ABA tem /aba/equipe) |
| Atribuicao paciente↔terapeuta | ❌ | FK nao existe no schema TCC |
| Filtro por terapeuta | ❌ | Todos no tenant veem todos os pacientes |

---

## INFRAESTRUTURA COMPARTILHADA (100% ✅)
| Area | Status |
|---|---|
| PostgreSQL 14 multi-tenant | ✅ |
| Redis cache (5min TTL) | ✅ |
| Clerk auth (Production Pro) | ✅ |
| Firebase Admin (storage + FCM) | ✅ |
| Resend email (3 templates) | ✅ |
| LGPD compliance (export/delete/consent) | ✅ |
| Audit log imutavel | ✅ |
| Multi-clinica (migration 018) | ✅ |
| Hotmart webhook v2.1 | ✅ |

---

## PENDENCIAS PARA BETA COMERCIAL TCC

### P0 — Bloqueantes para vender
- [ ] Definir planos e precos TCC (tiers + limites)
- [ ] Conectar pricing page → checkout Hotmart (produto 7299808)
- [ ] UpgradeModal com links TCC corretos
- [ ] Onboarding TCC — ajustar copy/branding para TCC
- [ ] Teste de fluxo completo (cadastro → onboarding → criar paciente → sessao → eventos → CSO → sugestao → relatorio)
- [ ] Revisao UI/UX — consistencia visual em todas as telas TCC
- [ ] Responsividade mobile (psicologo usa no celular apos sessao presencial)

### P1 — Importantes para beta completo
- [ ] Team management UI — pagina /equipe para TCC
- [ ] Chat Ana TCC — carregar SKILL_TCC.md como personalidade
- [ ] PDF reports server-side (upgrade do window.print)
- [ ] Email templates especificos TCC
- [ ] Dashboard KPIs TCC — graficos CSO longitudinais

### P2 — Pos-lancamento
- [ ] Google Calendar (aguardando brand verification)
- [ ] Transcricao avancada (speaker diarization)
- [ ] Analytics avancado
- [ ] Portal familia adaptado TCC
- [ ] App mobile (React Native)

---

## CSO-TCC v3.0.0 — Referencia Rapida

**4 Dimensoes (escala 0-1):**
- `activation_level` — nivel de ativacao comportamental
- `emotional_load` — carga emocional
- `task_adherence` — adesao a tarefas
- `cognitive_rigidity` — rigidez cognitiva

**Faixas de interpretacao:**
- 0.85–1.00: Excelente — evolucao consistente
- 0.70–0.84: Bom — progresso adequado
- 0.50–0.69: Atencao — possivel estagnacao
- 0.00–0.49: Critico — pouco progresso ou falta de dados

**9 Tipos de Eventos Clinicos:**
AVOIDANCE_OBSERVED, CONFRONTATION_OBSERVED, ADJUSTMENT_OBSERVED, RECOVERY_OBSERVED, SESSION_START, SESSION_END, TASK_COMPLETED, TASK_INCOMPLETE, MOOD_CHECK

**Suggestion Engine v2.1 — 12 regras:**
CRISIS_PROTOCOL (10), PAUSE_EXPOSURE (9/8), CHECK_ADHERENCE (8), COGNITIVE_INTERVENTION (7), SIMPLIFY_TASK (6), EMOTIONAL_REGULATION (6), CELEBRATE_PROGRESS (5/4), ADJUST_PACE (5/4), BRIDGE_TO_LAST (4)

---

## TERMINOLOGIA TCC
| Conceito | Termo TCC | Termo ABA (referencia) |
|---|---|---|
| Sujeito | Paciente | Aprendiz |
| Profissional | Psicologo | Terapeuta/Supervisor BCBA |
| Encontro | Sessao | Sessao |
| Motor | CSO-TCC v3.0.0 | CSO-ABA v2.6.1 |
| Produto | AXIS TCC | AXIS ABA |

---

## PALETA DE CORES TCC
| Uso | Cor | Hex |
|---|---|---|
| Brand (principal) | ? | A definir |
| Brand hover | ? | A definir |
| Brand light | ? | A definir |

> **Nota:** ABA usa coral (#B4532F). TCC deve ter identidade visual propria.

---

## SESSOES DE TRABALHO

### 2026-03-11 (manha) — Inicio do foco TCC
- AxisABA finalizado (100%), em venda a partir de 12/03/2026
- Criado NOTE_TCC.md com mapeamento completo do estado atual
- Auditoria de codigo: TCC ~88% pronto
- Core clinico 100%, DB 100%, APIs 100%, UI 95%
- Gaps: billing wiring (70%), team UI (50%), onboarding branding (90%)

### 2026-03-11 — P0 Hardening Transcricao (6 fixes)
- ✅ FIX 1: Nginx client_max_body_size 150m + proxy_request_buffering off (PENDENTE: executar na VPS)
- ✅ FIX 2: jobId unico nos chunks (sessionId_timestamp evita colisao em retranscricao)
- ✅ FIX 3: Extensao temporaria correta (.webm preservado em vez de forcar .mp3)
- ✅ FIX 4: Retry por chunk com backoff (3 tentativas, 2s/4s/6s)
- ✅ FIX 5: Prompt limpo no endpoint longo (audio pequeno direto) — vocabulary hint sem frase narrativa
- ✅ FIX 6: Prompt limpo no endpoint curto (transcribe-audio) — mesma consistencia
- Suporte ampliado: sessoes de ate 70min (antes ~50min pelo limite Nginx)
- PENDENTE NA VPS: Nginx reload + npm run next:build + restart app

### 2026-03-11 — Wiring Comercial TCC (3 fixes)
- ✅ Fix auto-license: /api/user/tenant agora cria AMBAS licenças (tcc + aba) no primeiro login
- ✅ Gate de licença TCC: layout.tsx criado em /dashboard, /sessoes, /pacientes (auth + license check)
- ✅ Redirect /produto/tcc → /dashboard para users com licença TCC ativa
- ✅ Criado docs/REFERENCE_TCC.md (consolidado dos Documentos Mestres)
- DECISAO: TCC v1.x = Solo, SEM limite de pacientes (sem UpgradeModal)
- DECISAO: Clinica multi-profissional so na v2.x
- PENDENTE NA VPS: git pull --rebase + npm run next:build + pm2 restart all

---

## DECISOES TOMADAS
| Data | Decisao | Motivo |
|---|---|---|
| 11/03/2026 | NOTE_TCC.md separado do NOTE.md (ABA) | Rastreabilidade por produto |
| 11/03/2026 | Mapeamento completo antes de comecar | Saber exatamente onde estamos |
| 11/03/2026 | TCC v1.x sem limite de pacientes | Solo profissional, dados restritos ao psicologo |
| 11/03/2026 | Auto-license cria TCC + ABA | Cada layout verifica seu product_type independente |

---

## REGRAS IMUTAVEIS (Guardrails)

1. IA NAO decide, NAO executa, pode ficar em silencio
2. Clinical history append-only (NUNCA UPDATE/DELETE)
3. Engines deterministicos (CSO-TCC v3.0.0)
4. Max 1 sugestao por ciclo
5. Toda acao auditavel
6. Multi-tenant isolation (tenant_id obrigatorio)
7. Engine version locked em cada registro
8. Separacao de 3 camadas (dados, texto automatizado, notas profissionais)
9. Na duvida, PARAR e perguntar
10. Seguranca > Conveniencia

---

**Referencia:** Documento Mestre TCC v2.1, skill_axis_tcc.md, skill_axis_guardrails.md
