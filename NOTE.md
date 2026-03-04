# AXIS ABA — NOTE DE PROJETO (fonte unica de verdade)
## Atualizado: 03/03/2026

---

## FOCO ATUAL: AxisABA — Beta Comercial

> Dois produtos no mesmo repo: **AXIS ABA** (terapia comportamental) e **AXIS TCC** (terapia cognitivo-comportamental).
> Prioridade agora: levar o **AXIS ABA** para venda comercial beta.
> TCC em standby — infraestrutura compartilhada.

---

## ONDE ESTAMOS (verificado no codigo em 03/03/2026)

### CORE ENGINE
| Area | % | Status |
|---|---|---|
| Motor CSO-ABA v2.6.1 | 100% | 4 dimensoes (SAS, PIS, BSS, TCM), bandas, formula fixa 25% cada |
| Maquina de estados (protocolos) | 100% | 10 estados, transicoes validadas por trigger, audit imutavel |
| Multi-tenant + RBAC | 100% | tenant_id em tudo, admin/supervisor/terapeuta, learnerFilter |
| Audit log imutavel | 100% | axis_audit_logs append-only, metadata JSONB |
| Regressao automatica | 100% | Detecta queda >15pts ou mudanca de banda, alerta no dashboard |

### MODULOS CLINICOS
| Area | % | Status |
|---|---|---|
| Portal familia | 100% | Token 90d, consent LGPD, dados filtrados (nunca mostra CSO/trials) |
| Push notifications (FCM) | 100% | Lembretes 24h + 10min, cron 60s, token auto-cleanup |
| Google Calendar | 100% | Sync bidirecional |
| PDF reports | 100% | Logo AXIS, CSO, protocolos, acentos OK, codigo autenticidade |
| Dashboard ABA | 90% | KPIs + grafico CSO SVG + alertas regressao. Analytics avancado TBD |
| PEI (Plano Educacional) | 90% | Tela completa + API + dados demo + sidebar + vinculo protocolo |
| Generalizacao tab | 50% | UI existe, validacao 3x2 TBD |
| Manutencao/sondas | 40% | Schema pronto, UI em progresso. Modelo 2-6-12 semanas documentado |
| Transcricao sessao (OpenAI) | 20% | Stub existe |

### UI / UX
| Area | % | Status |
|---|---|---|
| SidebarABA | 100% | Role-aware (admin/supervisor/terapeuta), sem badges, logo circulo "ABA" |
| Central de Ajuda | 100% | 7 secoes accordion + busca + highlight, glossario ABA completo |
| Chat Ana (IA) | 100% | API OpenAI (gpt-4o-mini), personality prompt, carrega SKILL_ABA.md |
| Demo publica | 100% | /demo com tarja coral, layout dedicado, relatorios com chat simulado |
| Landing ABA premium | 100% | /produto/aba — hero, ciclo ABA, relatorio mockup, chat Ana mockup |
| Landing institucional | 100% | /app/page.tsx — TCC + ABA, Psiform Tecnologia, schema.org |
| Pagina de precos | 100% | /aba/precos — 3 cards (Free / Clinica 100 Founders / Clinica 250) |
| Mobile responsivo | 85% | Bottom nav mobile na sidebar, telas principais OK, falta polir |
| Onboarding clinica | 95% | Wizard com selecao plano (4 tiers), salva max_patients/max_sessions |

### COMERCIAL / BILLING (Hotmart)
| Area | % | Status |
|---|---|---|
| Webhook Hotmart | 100% | 7 eventos, idempotente, audit log, map produto→tipo |
| Gate de licenca (layout.tsx) | 100% | Bloqueia /aba/* sem licenca ativa → redireciona /hub |
| API licencas (/api/user/licenses) | 100% | Verifica ativas + nao-expiradas por tenant/user |
| UpgradeModal | 90% | Dispara no free (>1 aprendiz). FALTA: botoes sem link Hotmart real |
| Middleware | 100% | Clerk auth, rotas publicas corretas (/produto, /demo, /portal, webhook) |
| Cadastro ABA | 100% | /sign-up?produto=aba diferencia ABA vs TCC |
| Testes automatizados | 30% | Vitest setup, coverage incompleta |

### INFRAESTRUTURA
| Area | % | Status |
|---|---|---|
| PostgreSQL multi-tenant | 100% | Todas tabelas com tenant_id, indices |
| Redis cache | 100% | Dashboard 5min TTL |
| Clerk auth | 100% | Multi-tenant provider |
| Firebase (storage + FCM) | 100% | Admin SDK |
| Resend email | 50% | So tem template session-summary. Falta pos-compra |
| PM2 producao | 100% | ecosystem.config.cjs |

---

## MODELO COMERCIAL (Hotmart)

**Empresa:** Psiform Tecnologia
**URL producao:** axisclinico.com

**Produtos Hotmart:**
- ABA: ID `7285432`
- TCC: ID `7299808`

**Planos ABA (landing page /produto/aba — 4 colunas):**
| Plano | Preco | Aprendizes | Oferta Hotmart | Link |
|---|---|---|---|---|
| 1 Aprendiz | Gratuito | 1 | N/A | /sign-up?produto=aba |
| Clinica 100 — Founders | R$147/mes | 100 | `u2t04kz5` | pay.hotmart.com/H104663812P?off=u2t04kz5 |
| Clinica 100 | R$247/mes | 100 | `iwqieqxc` | pay.hotmart.com/H104663812P?off=iwqieqxc |
| Clinica 250 | R$497/mes | 250 | `gona25or` | pay.hotmart.com/H104663812P?off=gona25or |

**Planos ABA (onboarding — 4 tiers internos):**
| Tier | Pacientes | Sessoes | Preco |
|---|---|---|---|
| trial | 5 | 15 | Gratis 30 dias |
| starter | 15 | 60 | R$97/mes |
| professional | 50 | 200 | R$197/mes |
| clinic | 999 | 9999 | R$497/mes |

> **DIVERGENCIA**: Landing tem 4 planos (Free/Founders R$147/Regular R$247/250 R$497). Onboarding tem 4 tiers diferentes (trial/starter/pro/clinic). Precisa alinhar.

**Fluxo comercial implementado:**
1. Usuario se cadastra (Clerk) com ?produto=aba
2. Onboarding: seleciona plan_tier → salva em tenants (plan_tier, max_patients, max_sessions)
3. Free: 1 aprendiz. UpgradeModal dispara se tentar criar mais
4. Compra Hotmart → webhook POST /api/webhook/hotmart → cria/atualiza user_licenses
5. Layout ABA verifica user_licenses.is_active → redireciona /hub se nao tem
6. Cancelamento/reembolso → webhook desativa licenca automaticamente

---

## CONCLUIDO EM 28/02/2026 (verificado no codigo)

- [x] Central de Ajuda completa (7 secoes + busca + highlight)
- [x] Chat Ana funcional com API OpenAI (gpt-4o-mini + SKILL_ABA.md)
- [x] Chat Ana simulado na demo (pagina relatorios)
- [x] Landing page ABA premium refatorada (/produto/aba)
- [x] Bloco Ciclo ABA (Generalizacao 3x2, Manutencao 2-6-12)
- [x] Bloco "Veja na pratica" com botao para demo
- [x] Tabela de planos com 4 colunas + Free/Founders
- [x] Botoes coral solido
- [x] Landing institucional /app/page.tsx (TCC + ABA, schema.org)
- [x] Middleware corrigido (rotas publicas: /produto, /demo, /portal, webhook)
- [x] Diferenciacao cadastro ABA vs TCC (?produto=aba)
- [x] Tarja demo com cor coral e texto ajustado
- [x] Badges ABA/ADM removidos da sidebar (agora e circulo "ABA")
- [x] Logo sidebar ABA corrigido

---

## O QUE JA FUNCIONA NO BILLING (verificado)

- [x] Webhook Hotmart completo (7 eventos, idempotente, audit log)
- [x] Gate de acesso no layout.tsx (sem licenca → /hub)
- [x] API de verificacao de licencas (/api/user/licenses)
- [x] UpgradeModal no limite free (1 aprendiz)
- [x] Onboarding com selecao de plano (4 tiers, salva limites)
- [x] Landing page com 3 links Hotmart funcionais (Founders, Regular, 250)
- [x] Pagina de precos com 3 planos
- [x] Middleware exempta webhook de Clerk auth

---

## PENDENCIAS PARA BETA COMERCIAL

### P0 — Bloqueantes para vender

- [x] **Migration user_licenses**: 006_add_user_licenses.sql (tabela, indices, seed, migracao tiers antigos) ✅ 03/03
- [x] **Alinhar planos**: tiers unificados → free/founders/clinica_100/clinica_250 em onboarding, setup API, tenant creation, migration ✅ 03/03
- [x] **UpgradeModal links**: botoes linkam direto pro checkout Hotmart (Founders R$147 + Clinica 250 R$497) ✅ 03/03
- [x] **Enforcement max_patients**: API POST learners verifica limite, retorna PLAN_LIMIT_REACHED, frontend abre UpgradeModal ✅ 03/03
- [x] **Bug fix /api/aba/me**: agora retorna plan_tier (antes retornava plan que era sempre 'standard') ✅ 03/03
- [x] **Licenca free automatica**: novo tenant ja nasce com user_licenses (AUTO_FREE_TIER) ✅ 03/03
- [x] **Termos de uso + Privacidade**: /termos e /privacidade criados, LGPD, middleware atualizado, links no footer ✅ 03/03
- [ ] **Testar fluxo cadastro ABA**: verificar se ?produto=aba redireciona corretamente (em producao)
- [ ] **Testar checkout Hotmart**: testar os 3 links reais (em producao)
- [ ] **Rodar migration 006**: executar no banco de producao

### P1 — Importantes para beta

- [ ] **Tela "Meu Plano"**: configuracoes nao mostra plano atual nem upgrade
- [ ] **Email pos-compra**: nenhum template de boas-vindas/ativacao (so tem session-summary)
- [ ] **Fila licencas pendentes**: TODO no webhook (comprou antes de cadastrar)
- [ ] **Popup "Ativar lembretes"**: investigar se faz sentido no ABA ou remover
- [ ] **Testes criticos**: CSO engine, state machine, webhook Hotmart
- [ ] **Backup automatizado**: pg_dump cron ou servico

### P2 — Pos-lancamento

- [ ] Generalizacao UI completa (regra 3x2 validada)
- [ ] Manutencao/sondas UI (modelo 2-6-12)
- [ ] Transcricao OpenAI integrada
- [ ] Dashboard analytics avancado (tendencias, predicao)
- [ ] Multi-clinica (terapeuta em mais de um tenant)
- [ ] App mobile (React Native)
- [ ] Skill SEO (buscar skill pronta + customizar)
- [ ] Real-time (WebSocket)

---

## PALETA DE CORES ABA

| Uso | Cor | Hex |
|---|---|---|
| Brand coral (principal) | coral escuro | `#B4532F` |
| Brand coral hover | coral mais escuro | `#8F3E22` |
| Brand coral light | coral claro | `#c46a50` |
| Ajuda/Chat brand | coral light | `#c46a50` |
| Ajuda brandLight bg | bege rosado | `#f5ebe7` |

> **NOTA**: ROADMAP antigo dizia #C46A2F. Codigo real usa `#c46a50` (light) e `#B4532F` (dark). Cor canonica = **#c46a50**.

---

## ARQUITETURA

```
Next.js 16 + React 19 + TypeScript
PostgreSQL 14 (multi-tenant, audit imutavel)
Redis (cache 5min)
Clerk (auth multi-tenant)
Firebase Admin SDK (storage + FCM push)
Hotmart (billing webhook, 3 ofertas ativas)
Resend (email — 1 template)
OpenAI gpt-4o-mini (Chat Ana + transcricao stub)
Google Calendar API (sync bidirecional)
PM2 (producao)
```

**Bible:** AXIS_ABA_BIBLE_v2.6.1
**Motor:** CSO-ABA v2.6.1

---

## URLs ABA

| URL | O que e |
|---|---|
| axisclinico.com | Landing institucional (TCC + ABA) |
| axisclinico.com/produto/aba | Landing ABA premium |
| axisclinico.com/demo | Demo publica |
| axisclinico.com/demo/relatorios | Demo relatorios + chat Ana simulado |
| axisclinico.com/aba | Dashboard ABA (logado) |
| axisclinico.com/aba/ajuda | Central de Ajuda + chat Ana real |
| axisclinico.com/aba/precos | Pagina de precos |
| axisclinico.com/aba/onboarding | Wizard onboarding |
| axisclinico.com/aba/configuracoes | Configuracoes |
| axisclinico.com/sign-up?produto=aba | Cadastro ABA |
| axisclinico.com/hub | Seletor ABA/TCC |
| axisclinico.com/portal/[token] | Portal familia (publico) |
| axisclinico.com/termos | Termos de Uso |
| axisclinico.com/privacidade | Politica de Privacidade (LGPD) |

---

## ARQUIVOS-CHAVE

### Billing / Comercial
| Arquivo | Funcao |
|---|---|
| `app/api/webhook/hotmart/route.ts` | Webhook — cria/desativa user_licenses |
| `app/api/user/licenses/route.ts` | API verificacao licencas ativas |
| `app/aba/layout.tsx` | Gate — bloqueia sem licenca → /hub |
| `app/aba/precos/page.tsx` | Pagina precos (3 planos) |
| `app/produto/aba/page.tsx` | Landing premium (4 planos, links Hotmart) |
| `app/components/UpgradeModal.tsx` | Modal upgrade (free → pago) |
| `app/aba/onboarding/page.tsx` | Wizard onboarding + selecao plano |
| `app/api/aba/onboarding/setup/route.ts` | API setup — salva plan_tier + limites |
| `app/aba/aprendizes/page.tsx` | Trigger UpgradeModal (free + >1) |
| `middleware.ts` | Clerk auth + rotas publicas |

### UI / Experiencia
| Arquivo | Funcao |
|---|---|
| `app/aba/ajuda/page.tsx` | Central Ajuda (7 secoes + chat Ana) |
| `app/api/aba/chat-ana/route.ts` | API Chat Ana (OpenAI + SKILL_ABA.md) |
| `app/components/SidebarABA.tsx` | Sidebar role-aware |
| `app/demo/layout.tsx` | Layout demo (tarja coral) |
| `app/demo/relatorios/page.tsx` | Demo relatorios + chat simulado |
| `app/page.tsx` | Landing institucional (TCC + ABA) |
| `docs/SKILL_ABA.md` | Documentacao que alimenta Chat Ana |

### Engine
| Arquivo | Funcao |
|---|---|
| `src/engines/cso-aba.ts` | Motor CSO-ABA v2.6.1 |
| `src/engines/protocol-lifecycle.ts` | Maquina estados 10 transicoes |
| `src/engines/suggestion.ts` | Recomendacoes clinicas |

---

## REGRAS CRITICAS (nunca mudar)

1. `clinical_states_aba` → append-only (NUNCA update/delete)
2. `axis_audit_logs` → append-only
3. `guardian_consents` → NUNCA delete (LGPD)
4. Transicoes de protocolo validadas por `protocol-lifecycle.ts`
5. Terapeuta so ve aprendizes vinculados em `learner_therapists`
6. Portal familia NUNCA mostra CSO, trials, notas clinicas
7. Chave OpenAI: mesma do TCC serve para Chat Ana
8. Pesos CSO fixos (25% cada) — padrao nacional, nao ajustavel

---

## IDS DEMO

| Aprendiz | ID | Nivel |
|---|---|---|
| Joao Paulo | be7bb2ec-a4e2-4609-894c-1577655e23df | 2 |
| Laura Oliveira | a2222222-2222-2222-2222-222222222222 | 2 |
| Miguel Santos | a1111111-1111-1111-1111-111111111111 | 1 |

**Tenant ID dev:** `123e4567-e89b-12d3-a456-426614174000`

---

## HISTORICO DE DECISOES

| Data | Decisao | Motivo |
|---|---|---|
| 2026-02-23 | Hotmart em vez de Stripe | Mercado BR, boleto, PIX nativo |
| 2026-02-23 | Free tier = 1 aprendiz | Reduzir friccao, demonstrar valor |
| 2026-02-25 | Portal familia token-based | UX simples, sem login para responsaveis |
| 2026-02-28 | Chat Ana com gpt-4o-mini | Custo baixo, respostas rapidas, personality prompt |
| 2026-02-28 | Landing com 4 colunas de planos | Founders como diferencial |
| 2026-03-03 | Foco AxisABA primeiro para beta | Mais maduro, mercado definido, TCC depois |

---

## PROXIMOS PASSOS (03/03/2026)

1. ~~Criar migration user_licenses~~ ✅
2. ~~Alinhar planos~~ ✅
3. ~~UpgradeModal → Hotmart~~ ✅
4. ~~Enforcement max_patients~~ ✅
5. ~~Bug fix /api/aba/me plan_tier~~ ✅
6. ~~Licenca free automatica no cadastro~~ ✅
7. ~~Termos de uso + Privacidade~~ ✅
8. **Rodar migration 006 no banco de producao**
9. **Testar fluxo completo no ambiente real**: cadastro → onboarding → free → upgrade → webhook
10. **Build + deploy**
11. **LANCAMENTO BETA**

---

## CONCLUIDO EM 03/03/2026

- [x] Migration 006: user_licenses + migracao de tiers antigos
- [x] Alinhamento planos: free/founders/clinica_100/clinica_250 em todo o sistema
- [x] UpgradeModal com links Hotmart reais (Founders R$147, Clinica 250 R$497)
- [x] Enforcement max_patients no POST /api/aba/learners + UpgradeModal automatico
- [x] Bug fix: /api/aba/me agora retorna plan_tier (antes retornava campo errado 'plan')
- [x] Licenca free criada automaticamente no cadastro de novo tenant
- [x] Pagina Termos de Uso (/termos) — 11 secoes cobrindo responsabilidade clinica, pagamento, PI
- [x] Pagina Politica de Privacidade (/privacidade) — 12 secoes, LGPD compliant
- [x] Middleware atualizado com rotas publicas /termos e /privacidade
- [x] Links legais no footer da landing page

---

*Este arquivo e a fonte unica de verdade do projeto. Atualizar a cada sessao de trabalho.*
*Ultima verificacao cruzada com codigo: 03/03/2026*
