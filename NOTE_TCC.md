# AXIS TCC — NOTE DE PROJETO (fonte unica de verdade)
## Atualizado: 11/03/2026 (noite — 9 fixes criticos/altos deployed + build green)

---

## FOCO ATUAL: AxisTCC — Preparacao para Beta Comercial

> Dois produtos no mesmo repo: **AXIS ABA** (beta comercial ativo desde 12/03/2026) e **AXIS TCC** (cognitivo-comportamental).
> Prioridade agora: levar o **AXIS TCC** para o mesmo nivel comercial do ABA.
> Infraestrutura compartilhada ja pronta (auth, multi-tenant, billing base, LGPD, audit).

---

## ONDE ESTAMOS — TCC (auditado em 11/03/2026, noite)

### Completude Geral: ~95% (subiu de ~93% — 9 criticas/altas resolvidas)

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
| /api/transcribe | ✅ | Whisper transcription + chunking >5MB + SSE streaming + failed chunks warning |
| /api/transcribe-audio | ✅ | Registros clinicos |
| /api/analyze-tcc | ✅ | Analise TCC especifica |
| /api/audit | ✅ | Log imutavel |
| /api/push/* | ✅ | FCM register/subscribe/send |
| /api/google/* | ✅ | Calendar sync (7 rotas) — botao desabilitado |
| /api/portal/* | ✅ | Portal Familia token-based |
| /api/user/* | ✅ | Profile, licenses, tenant selection |
| /api/demo/* | ✅ | Demo mode com dados publicos |
| /api/webhook/* | ✅ | Hotmart (product-aware TCC+ABA) + Clerk webhooks |
| /api/cron/* | ✅ | Reminders + renew-webhook |
| /api/chat-ana | ✅ | GPT-4o-mini com historico (10 turnos) + license gate |

### UI / PAGES — 98% ✅
| Rota | Status | Observacao |
|---|---|---|
| /dashboard | ✅ | Dashboard com KPIs + graficos CSO longitudinais + error state |
| /sessoes | ✅ | Lista + filtros + paginacao + modal nova sessao |
| /sessoes/[id] | ✅ | Detalhe com eventos (classes estaticas Tailwind corrigidas) |
| /pacientes | ✅ | Lista + Toast feedback + busca |
| /pacientes/[id] | ✅ | Perfil com interfaces TS tipadas (Patient, PatientSession, EditFormData, ClinicalRecord) |
| /relatorio/[id] | ✅ | Relatorio evolucao (PDF via jsPDF) — acentos corrigidos com stripAccents() |
| /configuracoes | ✅ | Configuracoes |
| /sugestoes | ✅ | Gestao de sugestoes |
| /ajuda | ✅ | Central de ajuda + Chat Ana integrado |
| /produto/tcc | ✅ | Landing page com schema.org |
| /demo | ✅ | Demo mode completo |
| /termos | ✅ | Termos genericos AXIS (TCC + ABA) |
| /privacidade | ✅ | Privacidade generica AXIS (TCC + ABA) |
| /obrigado | ✅ | Thank you page com branding AXIS navy |
| /hub | ✅ | Seletor de modulos (TCC + ABA) |

### COMPONENTS — 100% ✅
| Componente | Status | Arquivo |
|---|---|---|
| Sidebar.tsx | ✅ | Design tokens tcc- migrados (0 hex hardcoded) |
| EvolutionReport.tsx | ✅ | app/components/EvolutionReport.tsx |
| SessionReport.tsx | ✅ | Acentos corrigidos (Relatório, Sessão, etc.) |
| Toast.tsx | ✅ | Componente de feedback reutilizavel |
| (demais 12 componentes) | ✅ | Onboarding, Push, Terms, Error, Skeleton, etc. |

### DESIGN TOKENS — 85%
| Area | % | Status |
|---|---|---|
| Paleta TCC em tailwind.config.ts | ✅ | tcc-50..900 + tcc-accent (#FC608F) |
| Sidebar.tsx | ✅ | 100% migrado para tcc- classes |
| Dashboard, Sessoes, Sugestoes, Pacientes, Obrigado | ✅ | Migrados |
| Hub, Ajuda, Produto/TCC, Landing | ❌ | Usam JS inline style (design debt v2) |

### COMERCIAL / BILLING — 90% (subiu de 80%)
| Area | % | Status |
|---|---|---|
| Webhook Hotmart | ✅ | Product-aware: TCC (ID 7299808), branding/subject/redirect corretos |
| User licenses | ✅ | Tabela + UPSERT on purchase |
| Free tier gate | ✅ | 1 paciente gratis, UpgradeModalTCC apos limite |
| Auto-provision FREE | ✅ | Clerk webhook cria tenant+profile+licenças no cadastro direto (sem Hotmart) |
| Gate no layout | ✅ | License check via tcc-license-gate.ts (DRY, 3 layouts simplificados) |
| Email pos-compra | ✅ | Templates product-aware (navy TCC / coral ABA) |
| /obrigado | ✅ | Thank you page com branding AXIS |
| Pricing page TCC | ❌ | Landing existe mas checkout links nao conectados |
| Tiers/precos TCC | ✅ | Profissional R$59/mes (plano unico) |
| UpgradeModalTCC | ✅ | Componente proprio com branding navy/rosa, checkout Hotmart J104687347A, integrado em /pacientes (403) |

### SEGURANCA — 98% (subiu de ~95%)
| Area | Status | Detalhe |
|---|---|---|
| CSO engine tenant isolation | ✅ | FIX 1: AND tenant_id = $2 adicionado |
| Patient limit enforcement | ✅ | FIX 2: max_patients checado no /create |
| Chat Ana license gate | ✅ | FIX 3: Verifica licenca TCC antes de responder |
| Pipeline warnings | ✅ | FIX 9: CSO/Suggestion errors retornados ao frontend |
| Layout gates DRY | ✅ | FIX 11: tcc-license-gate.ts compartilhado |
| Dashboard error state | ✅ | FIX 13: csoError com feedback visual |
| Suggestion rules alive | ✅ | FIX 7: Regras 6/10/11 reescritas para usar campos reais |

---

## PENDENCIAS ENCONTRADAS NA AUDITORIA DE 11/03/2026 (NOITE)

### CRITICAS — ✅ TODAS CORRIGIDAS (deployed 11/03/2026 noite)

1. ~~**clinical-record/route.ts** — Query SEM tenant_id~~ → ✅ `AND tenant_id = $2` adicionado + pool compartilhado (fix 5 junto)
2. ~~**push/subscribe/route.ts** — SEM autenticacao~~ → ✅ Reescrito com `auth()` do Clerk + validacao de tenant
3. ~~**sessions/create/route.ts** — Session count SEM tenant_id~~ → ✅ `AND tenant_id = $2` adicionado
4. ~~**suggestion.ts** — CRISIS_PROTOCOL dead code~~ → ✅ Reescrito com `activation_level < 0.2 && emotional_load > 0.85`

### ALTAS — ✅ TODAS CORRIGIDAS (deployed 11/03/2026 noite)

5. ~~**clinical-record/route.ts** — `new Pool()` separado~~ → ✅ Migrado para `import pool from '@/src/database/db'`
6. ~~**supervision/route.ts** — Audit log incompleto~~ → ✅ Campos `user_id`, `actor`, `entity_type`, `entity_id` adicionados
7. ~~**relatorio/[patientId]/page.tsx** — Acentos no PDF~~ → ✅ `stripAccents()` no helper `addText`, todas as strings normalizadas
8. ~~**pacientes/page.tsx** — `any[]`~~ → ✅ Interface `PatientListItem` + `formatPhone(string | null)`
9. ~~**sessoes/page.tsx** — `body: any`~~ → ✅ Tipado com `{ patient_id: string; start_now?: boolean; scheduled_at?: string }`

### MEDIAS (melhorar antes do beta)

10. **Erro silencioso em varias APIs** — /api/patients, /api/stats retornam 200 com dados vazios em caso de erro (catch retorna `{ patients: [] }`). Deveria retornar 500.

11. **Console.error sem feedback** — ~15 locais onde erros vao pro console mas o usuario nao ve nada. Pacientes/[id], sessoes/[id], sugestoes.

12. **sessions/create L54** — `const event: any` no Google Calendar event.

13. **Acessibilidade** — Spinners sem aria-label/aria-busy em sessoes, sugestoes, pacientes.

### BAIXAS (pos-lancamento)

14. **Landing page (page.tsx)** — 34 hex hardcoded, mas e pagina de marketing (inline style OK por enquanto).

15. **Unused imports** — AlertCircle em SessionReport.tsx, TrendingUp/TrendingDown em relatorio.

16. **Hub page** — 8 hex em JS constants (inline style, nao Tailwind). Design debt para v2.

---

## SESSOES DE TRABALHO

### 2026-03-11 (manha) — Inicio do foco TCC
- AxisABA finalizado (100%), em venda a partir de 12/03/2026
- Criado NOTE_TCC.md com mapeamento completo do estado atual
- Auditoria de codigo: TCC ~88% pronto
- Core clinico 100%, DB 100%, APIs 100%, UI 95%
- Gaps: billing wiring (70%), team UI (50%), onboarding branding (90%)

### 2026-03-11 — P0 Hardening Transcricao (6 fixes)
- ✅ FIX 1: Nginx client_max_body_size 150m + proxy_request_buffering off
- ✅ FIX 2: jobId unico nos chunks
- ✅ FIX 3: Extensao temporaria correta (.webm preservado)
- ✅ FIX 4: Retry por chunk com backoff (3 tentativas)
- ✅ FIX 5-6: Prompt limpo em ambos endpoints de transcricao

### 2026-03-11 — Wiring Comercial TCC (3 fixes)
- ✅ Auto-license: cria AMBAS licencas (tcc + aba) no primeiro login
- ✅ Gate de licenca TCC: layout.tsx em /dashboard, /sessoes, /pacientes
- ✅ Redirect /produto/tcc → /dashboard para users com licenca ativa

### 2026-03-11 — HARDENING CRITICO (7 fixes, deploy 1)
- ✅ FIX 1: CSO engine — tenant_id isolation na query lastCSO
- ✅ FIX 2: Patient limit enforcement no /create
- ✅ FIX 3: Chat Ana license gate
- ✅ FIX 4: Tailwind dynamic classes → estaticas (micro-eventos sessao)
- ✅ FIX 5: Termos e Privacidade genéricos AXIS
- ✅ FIX 6: Obrigado page — branding AXIS navy
- ✅ FIX 7: Suggestion engine — regras dead 6/10/11 reescritas

### 2026-03-11 — HARDENING ALTO (6 fixes, deploy 2)
- ✅ FIX 8: Acentos em SessionReport + Dashboard
- ✅ FIX 9: Pipeline warnings (CSO + Suggestion)
- ✅ FIX 10: Transcricao failedChunks tracking
- ✅ FIX 11: Layout gate DRY (tcc-license-gate.ts)
- ✅ FIX 12: Toast feedback em pacientes
- ✅ FIX 13: Dashboard csoError state

### 2026-03-11 — HARDENING MEDIO (3 fixes, deploy 3)
- ✅ FIX 14: Design tokens TCC centralizados — paleta em tailwind.config.ts + migração de 6 arquivos
- ✅ FIX 15: TypeScript interfaces em pacientes/[id] (4 any removidos)
- ✅ FIX 17: Email templates product-aware (TCC navy / ABA coral) + webhook atualizado

### 2026-03-11 (noite) — Auditoria Profunda
- 3 agentes de auditoria paralelos (APIs, Pages/Components, Engines/Lib)
- 16 pendencias encontradas (4 criticas, 5 altas, 4 medias, 3 baixas)
- NOTE_TCC.md atualizado com estado real pos-hardening

### 2026-03-11 (noite) — 9 Fixes Criticos/Altos (deploy final)
- ✅ clinical-record: tenant_id na duplicata + pool compartilhado
- ✅ push/subscribe: autenticacao Clerk adicionada
- ✅ sessions/create: tenant_id no count
- ✅ CRISIS_PROTOCOL: reescrito com campos reais (activation_level + emotional_load)
- ✅ supervision: audit log completo
- ✅ relatorio PDF: stripAccents() em todo texto
- ✅ pacientes/page.tsx: interface PatientListItem + formatPhone(string | null)
- ✅ sessoes/page.tsx: body tipado
- ✅ email templates: product-aware TCC/ABA + webhook Hotmart atualizado
- Build green, deployed em producao

### 2026-03-12 (manha) — Polimento Beta
- ✅ Configuracoes: Google Calendar → banner "Em breve" (167 linhas mortas removidas)
- ✅ Configuracoes: Exportar/Excluir desabilitados com "(em breve)"
- ✅ Landing page: logos AXIS TCC/ABA aumentados (h-10 → h-16)
- ✅ UpgradeModalTCC.tsx: componente proprio (navy/rosa, R$59/mes, checkout Hotmart)
- ✅ pacientes/page.tsx: integra UpgradeModalTCC no 403 (limite de pacientes)
- ✅ Clerk webhook v2.0: auto-provisioning FREE (tenant + profile + licenças TCC/ABA) no cadastro direto
- ✅ patients/create: corrigido max_patients (coluna não existe em user_licenses) → regra via hotmart_plan

---

## DECISOES TOMADAS
| Data | Decisao | Motivo |
|---|---|---|
| 11/03/2026 | NOTE_TCC.md separado do NOTE.md (ABA) | Rastreabilidade por produto |
| 11/03/2026 | TCC v1.x sem limite de pacientes | Solo profissional, dados restritos ao psicologo |
| 11/03/2026 | Auto-license cria TCC + ABA | Cada layout verifica seu product_type independente |
| 11/03/2026 | Inline styles em hub/ajuda/landing = debt v2 | Precisam refactor para usar tokens, nao e bloqueante |
| 11/03/2026 | ~~Regra CRISIS_PROTOCOL dead code~~ → CORRIGIDA | Reescrita com activation_level < 0.2 + emotional_load > 0.85 |
| 12/03/2026 | Limite pacientes via hotmart_plan (não max_patients) | v1.x: FREE (NULL) = 1, PRO (NOT NULL) = ilimitado. v2.x tera seats/roles |

---

## PALETA DE CORES TCC (Definida)
| Uso | Token Tailwind | Hex |
|---|---|---|
| Navy (principal) | tcc-700 | #1a1f4e |
| Navy hover | tcc-600 | #2a2f5e |
| Navy light | tcc-50 | #f5f5f8 |
| Accent (rosa) | tcc-accent | #FC608F |
| Muted | tcc-300 | #9a9ab8 |
| Dark | tcc-900 | #0e1030 |

---

## CSO-TCC v3.0.0 — Referencia Rapida

**4 Dimensoes (escala 0-1):**
- `activation_level` — nivel de ativacao comportamental
- `emotional_load` — carga emocional
- `task_adherence` — adesao a tarefas
- `cognitive_rigidity` — rigidez cognitiva (flex_trend como proxy)

**Faixas de interpretacao:**
- 0.85–1.00: Excelente — evolucao consistente
- 0.70–0.84: Bom — progresso adequado
- 0.50–0.69: Atencao — possivel estagnacao
- 0.00–0.49: Critico — pouco progresso ou falta de dados

**9 Tipos de Eventos Clinicos:**
AVOIDANCE_OBSERVED, CONFRONTATION_OBSERVED, ADJUSTMENT_OBSERVED, RECOVERY_OBSERVED, SESSION_START, SESSION_END, TASK_COMPLETED, TASK_INCOMPLETE, MOOD_CHECK

**Suggestion Engine v2.1 — 12 regras:**
CRISIS_PROTOCOL (10, CORRIGIDA — usa activation_level < 0.2 + emotional_load > 0.85), PAUSE_EXPOSURE (9/8), CHECK_ADHERENCE (8), COGNITIVE_INTERVENTION (7), SIMPLIFY_TASK (6), EMOTIONAL_REGULATION (6), CELEBRATE_PROGRESS (5/4), ADJUST_PACE (5/4), BRIDGE_TO_LAST (4)

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
