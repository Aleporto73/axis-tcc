# AXIS ABA — NOTE DE PROJETO (fonte unica de verdade)
## Atualizado: 07/03/2026

---

## FOCO ATUAL: AxisABA — Beta Comercial

> Dois produtos no mesmo repo: **AXIS ABA** (terapia comportamental) e **AXIS TCC** (terapia cognitivo-comportamental).
> Prioridade agora: levar o **AXIS ABA** para venda comercial beta.
> TCC em standby — infraestrutura compartilhada.

---

## ONDE ESTAMOS (verificado no codigo em 07/03/2026)

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
| Portal familia | 100% | Token 90d, consent LGPD, dados filtrados (nunca mostra CSO/trials). UI completa: conquistas, proximas sessoes, resumos, habilidades. Sem login (token-based by design) |
| Push notifications (FCM) | 100% | Lembretes 24h + 10min, cron 60s, token auto-cleanup |
| Google Calendar | 100% | Sync bidirecional. ABA: 7 rotas dedicadas (oauth, callback, status, sync, watch, webhook, disconnect). Multi-terapeuta. Helpers compartilhados com TCC |
| PDF reports | 100% | Logo AXIS, CSO, protocolos, acentos OK, codigo autenticidade |
| CID (Classificacao Diagnostica) | 100% | CIDSelector com CID-10/CID-11, catalogo 50+ codigos, 6 grupos, busca, entrada manual, cross-mapping |
| Dashboard ABA | 90% | KPIs + grafico CSO SVG + alertas regressao. Analytics avancado TBD |
| PEI (Plano Educacional) | 90% | Tela completa + API + dados demo + sidebar + vinculo protocolo. Botao "Vincular ao PEI" so aparece quando existem goals |
| Biblioteca de Protocolos | 10% | Schema protocol_library existe (migration 007). FK em learner_protocols. SEM API, SEM UI, SEM seed data |
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
| Onboarding clinica | 100% | v3: overlay client-side (LGPD → escolha), sem redirect server-side |

### COMERCIAL / BILLING (Hotmart)
| Area | % | Status |
|---|---|---|
| Webhook Hotmart | 100% | v2.1: 7 eventos + auto-provisioning (Clerk Invitation + pending profile/license) |
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
| Resend email | 70% | Template session-summary funcional (auto-gera texto). From corrigido para AXIS ABA <noreply@axisclinico.com>. Dominio verificado (DKIM+SPF). Falta: pos-compra, API key producao na env |
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
- [x] **Auto-provisioning**: comprou antes de cadastrar → Clerk Invitation + pending profile/license ✅ 05/03
- [x] **Popup "Ativar lembretes"**: condicionado a pos-onboarding + rotas de produto ✅ 06/03
- [ ] **Testes criticos**: CSO engine, state machine, webhook Hotmart
- [ ] **Backup automatizado**: pg_dump cron ou servico
- [ ] **Resend API key producao**: trocar re_test_ por re_live_ na env da VPS (dominio ja verificado)
- [ ] **Biblioteca de Protocolos**: seed com templates ABA comuns + API listagem + UI seletor ao criar protocolo

### P2 — Pos-lancamento

- [ ] Generalizacao UI completa (regra 3x2 validada)
- [ ] Manutencao/sondas UI (modelo 2-6-12)
- [ ] Transcricao OpenAI integrada
- [ ] Dashboard analytics avancado (tendencias, predicao)
- [ ] Multi-clinica (terapeuta em mais de um tenant)
- [ ] App mobile (React Native)
- [ ] Skill SEO (buscar skill pronta + customizar)
- [ ] Real-time (WebSocket)
- [ ] Portal Familia com login (atualmente token-based — funcional mas sem conta de pai)

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
| `app/aba/layout.tsx` | Gate licenca → /hub + inclui OnboardingABA overlay |
| `app/aba/precos/page.tsx` | Pagina precos (3 planos) |
| `app/produto/aba/page.tsx` | Landing premium (4 planos, links Hotmart) |
| `app/components/UpgradeModal.tsx` | Modal upgrade (free → pago) |
| `app/components/OnboardingABA.tsx` | Overlay onboarding v3 — 2 telas (LGPD → escolha) |
| `app/aba/onboarding/page.tsx` | Redirect legacy → /aba/dashboard |
| `app/api/aba/onboarding/setup/route.ts` | API setup — salva name+specialty, marca completed |
| `app/api/aba/onboarding/progress/route.ts` | API progress — checa se onboarding ja completou |
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
| 2026-03-04 | Onboarding de 8→2 etapas | Reducao de friccao, acolhimento emocional pos-compra, sem dependencias de tabelas complexas |
| 2026-03-04 | APIs onboarding independentes | Setup e progress so usam tenants+profiles, tolerante a tabelas faltantes |
| 2026-03-05 | Onboarding refeito como overlay client-side | Redirect server-side dependia de x-pathname (middleware) que nao existe em client-side navigation do Next.js App Router → tela branca. Solucao: overlay z-[9999] que checa API, sem nenhum redirect no layout |
| 2026-03-05 | Migration 007 full ABA repair | ~20 tabelas ABA criadas (faltavam no banco), UNIQUE constraint em learner_therapists corrigida |
| 2026-03-05 | Auto-provisioning via Clerk Invitation | Buyer sem conta → invitation email + pending tenant/profile/license. Melhor UX para publico 50+ (evita "esqueci senha") |
| 2026-03-05 | Licencas resolvidas por tenant_id | clerk_user_id mismatch com pending_hotmart_* quebrava Hub e gate. Corrigido para tenant_id em 3 arquivos |
| 2026-03-06 | Login redireciona para /hub | Botao "Entrar" sem ?produto ia direto pro TCC. Agora sem param → /hub (usuario escolhe) |
| 2026-03-06 | Onboarding TCC restrito a rotas TCC | Aparecia "Bem-vindo ao AXIS TCC" para usuarios ABA. Agora so renderiza em /dashboard, /sessoes, /pacientes |
| 2026-03-06 | Push notification pos-onboarding | "Ativar lembretes" aparecia no primeiro acesso. Agora so apos onboarding completo e em rotas de produto |
| 2026-03-06 | Excluir trial em sessao ativa | Nao tinha como apagar trial errado. Agora tem lixeira com confirmacao (so sessao in_progress, audit log) |
| 2026-03-06 | Clerk migrado para producao | IDs mudaram — profiles e tenants atualizados no banco com novos clerk_user_id |
| 2026-03-07 | CID-10/CID-11 implementado | CIDSelector componente, catalogo 50+ codigos, 6 grupos, busca, entrada manual, cross-mapping. Migration 011 (cid_system, cid_label) |
| 2026-03-07 | Resend from corrigido | Todos os from trocados de onboarding@resend.dev para AXIS ABA <noreply@axisclinico.com>. Dominio verificado (DKIM+SPF) |
| 2026-03-07 | Dropdown email resumo corrigido | Bug: "Outro email..." sumia ao digitar. Fix: state summaryCustomEmail separado do valor. Sentinel __custom__ no select |
| 2026-03-07 | Nome clinica editavel | Configuracoes: campo nome agora editavel (admin/supervisor). PUT /api/aba/settings |
| 2026-03-07 | Local sessao pre-fill | Nova sessao pre-preenche "Local" com nome da clinica (tenant_name via useRole) |
| 2026-03-07 | Botao PEI condicional | "Vincular ao PEI" so aparece se existem goals cadastrados (progressive disclosure) |
| 2026-03-07 | Botao "Agendar Sessao" | Estado vazio de sessoes no perfil do aprendiz agora tem botao que redireciona para /aba/sessoes?novo=true |

---

## PROXIMOS PASSOS (07/03/2026)

1. ~~Criar migration user_licenses~~ ✅
2. ~~Alinhar planos~~ ✅
3. ~~UpgradeModal → Hotmart~~ ✅
4. ~~Enforcement max_patients~~ ✅
5. ~~Bug fix /api/aba/me plan_tier~~ ✅
6. ~~Licenca free automatica no cadastro~~ ✅
7. ~~Termos de uso + Privacidade~~ ✅
8. ~~Onboarding v2 (2 etapas acolhedoras)~~ ✅ 04/03
9. ~~Migration 007 full ABA repair~~ ✅ 05/03
10. ~~Onboarding v3 overlay client-side~~ ✅ 05/03
11. ~~Fix tela branca~~ ✅ 05/03
12. ~~CID-10/CID-11~~ ✅ 07/03
13. ~~Resend from corrigido~~ ✅ 07/03
14. ~~Dropdown email resumo~~ ✅ 07/03
15. ~~Nome clinica editavel + local pre-fill~~ ✅ 07/03
16. ~~PEI botao condicional + botao Agendar Sessao~~ ✅ 07/03
17. **Resend API key producao**: trocar re_test_ por re_live_ na env da VPS
18. **Rodar migration 011**: cid_system + cid_label no banco producao
19. **Testar fluxo completo no ambiente real**: cadastro → onboarding → free → upgrade → webhook
20. **Testar checkout Hotmart**: os 3 links reais
21. **Build + deploy final**
22. **LANCAMENTO BETA**

### PRE-TESTE HOTMART (checklist para 05/03)

| Item | Comando/Acao | Status |
|---|---|---|
| Migration 006 rodada | `docker exec -i axis-postgres psql -U axis -d axis_tcc -f - < scripts/migrations/006_add_user_licenses.sql` | ❓ |
| HOTMART_HOTTOK no .env | Verificar se esta preenchido na VPS. Pegar em: Hotmart > Configuracoes > Webhooks > Hottok | ❓ |
| URL webhook cadastrada no Hotmart | Confirmar `https://axisclinico.com/api/webhook/hotmart` no painel Hotmart | ❓ |
| Email comprador = email cadastrado | Webhook busca tenant pelo email do buyer. Se email diferente → fica "pending" | ⚠️ |
| Produto ABA ID | Confirmar que `7285432` no webhook bate com o produto real no Hotmart | ❓ |

**Fluxo do teste:**
1. Cadastrar com email X (/sign-up?produto=aba)
2. Completar onboarding (2 etapas)
3. Verificar que esta no plano free (1 aprendiz)
4. Comprar plano Founders (R$147) com o MESMO email X
5. Verificar que webhook ativou licenca: `docker exec -i axis-postgres psql -U axis -d axis_tcc -c "SELECT * FROM user_licenses ORDER BY created_at DESC LIMIT 5;"`
6. Verificar que agora pode criar mais de 1 aprendiz

**Auto-provisioning (implementado 05/03):** se comprar ANTES de cadastrar → Clerk Invitation email + tenant/profile/license pre-criados com `pending_hotmart_*`. Ao criar conta pelo link do email, /api/user/tenant ativa tudo automaticamente.

---

## CONCLUIDO EM 07/03/2026

- [x] CID-10/CID-11: CIDSelector componente com toggle sistema, busca, entrada manual, catalogo 50+ codigos em 6 grupos (TEA, TDAH, DI, Linguagem, Motor, Outro), cross-mapping CID-10↔CID-11. Migration 011 (cid_system, cid_label). Badge no perfil do aprendiz. CID no relatorio PDF e LGPD export/delete
- [x] Resend email from corrigido: todos os from trocados de onboarding@resend.dev para AXIS ABA <noreply@axisclinico.com> (demo/solicitar + sessions/summary). Dominio axisclinico.com verificado (DKIM+SPF). Pendente: trocar RESEND_API_KEY de teste para producao na VPS
- [x] Fix dropdown email "Enviar Resumo": bug onde selecionar "Outro email..." e digitar fazia o input sumir (summaryEmail !== '' escondia o campo). Corrigido com state summaryCustomEmail + sentinel __custom__ no select
- [x] Nome clinica editavel: campo nas configuracoes agora editavel (antes readOnly). PUT /api/aba/settings com requireAdminOrSupervisor
- [x] Local sessao pre-fill: nova sessao pre-preenche campo "Local" com tenant_name via useRole(). Reset do form preserva nome
- [x] Botao PEI condicional: "Vincular ao PEI" so aparece quando peiGoals.length > 0 (progressive disclosure — evita confusao com dropdown vazio)
- [x] Botao "Agendar Sessao": estado vazio de sessoes na pagina do aprendiz agora tem botao que redireciona para /aba/sessoes?novo=true&aprendiz={id}. Modal abre automaticamente com aprendiz pre-selecionado
- [x] Auditoria features: Portal Familia (token-based, 100% funcional), Google Calendar ABA (7 rotas, sync bidirecional, multi-terapeuta, 100% funcional), Biblioteca Protocolos (so schema, 10%)

## CONCLUIDO EM 06/03/2026

- [x] Clerk migrado para producao: atualizados clerk_user_id em profiles e tenants no banco
- [x] Fix redirect pos-login: sem ?produto agora vai para /hub (antes ia direto /dashboard TCC)
- [x] Fix sign-up idem: mesma correcao no cadastro
- [x] Onboarding TCC restrito: componente Onboarding.tsx agora verifica pathname — so renderiza em rotas TCC (/dashboard, /sessoes, /pacientes), nunca em /aba/*, /hub, landing
- [x] PushNotificationSetup condicionado: so aparece em rotas de produto + apos onboarding completo (checa axis_onboarding localStorage e axis_onboarding_done cookie)
- [x] Excluir trial em sessao ativa: DELETE /api/aba/sessions/[id]/trials/[targetId] — valida session in_progress + tenant_id + audit log append-only. UI com lixeira hover + confirmacao inline (Sim/Nao). Escondido em sessao finalizada (guardrail 3)
- [x] Fix Hub "Conhecer" vs "Acessar" para admin: profile apontava para tenant errado (c805e92a vs 123e4567). Corrigido no banco

## CONCLUIDO EM 05/03/2026

- [x] Migration 007: full ABA repair — ~20 tabelas ABA criadas que faltavam no banco (62 tabelas agora)
- [x] Fix UNIQUE constraint em learner_therapists (ON CONFLICT falhava)
- [x] Onboarding v3: refeito do zero como overlay client-side (OnboardingABA.tsx)
  - Tela 1: Termo LGPD adaptado para profissionais de saude (generico, sem CRP)
  - Tela 2: Escolha — "Personalizar Clinica" (→ /aba/configuracoes) ou "Cadastrar Aprendiz" (→ /aba/aprendizes)
  - Eliminado redirect server-side do layout (causa raiz da tela branca)
  - Funciona no primeiro load E no refresh (testado com 2 contas Gmail)
- [x] Layout ABA limpo: so faz auth → tenant → licenca → renderiza (sem headers/pathname)
- [x] /aba/onboarding page agora e redirect simples para /aba/dashboard
- [x] Webhook Hotmart v2.1 com auto-provisioning: buyer sem conta → Clerk Invitation + tenant/profile/license pre-criados (pending_hotmart_*)
- [x] Ativacao de perfil pendente: /api/user/tenant sincroniza clerk_user_id em tenants + user_licenses ao ativar pending_*
- [x] Resolucao de licencas por tenant_id: corrigido em /api/user/licenses, /aba/layout.tsx, /produto/aba/layout.tsx (antes filtrava por clerk_user_id que falhava para auto-provisioning)
- [x] Hub /hub: botao "Acessar" vs "Conhecer" agora funciona corretamente com licencas auto-provisionadas
- [x] Bug fix dropdown EBP invisivel: API retorna campo "name" mas select usava "name_pt" (undefined → texto vazio). Corrigido para name_pt || name
- [x] Bug fix resumo sessao vazio: modal "Enviar Resumo aos Pais" agora auto-gera texto a partir dos trials (alvos, acertos, percentual, nivel de dica)
- [x] Bug fix query l.full_name: tabela learners usa "name", nao "full_name". Corrigido em /api/aba/sessions/[id]/summary/route.ts (2 queries)
- [x] Bug fix session_summaries status constraint: INSERT usava 'draft' mas constraint so permite pending/approved/sent/rejected. Corrigido para 'pending'
- [x] Email resumo para pais: remetente noreply@axisclinico.com, titulo/header/rodape dinamicos com tenants.name
- [x] Autocomplete no campo "Alvo" do registro de trial: dropdown com alvos ja registrados + protocolos ativos, mantem ultimo alvo
- [x] Bug fix onboarding aparece em todo refresh: cookie cache (axis_onboarding_done) + fallback para hidden em caso de erro API
- [x] Bug fix LGPD Export v2.0: reescrito com safeQuery (SAVEPOINT) por tabela — falha em 1 tabela nao mata as outras. Corrigido nomes de colunas (content vs summary_text, score_pct vs score, behavior_type vs function_hypothesis)
- [x] Bug fix LGPD Delete v2.0: reescrito com safeExec (SAVEPOINT) + auto-criacao de colunas faltantes (cancellation_scheduled_at, cancelled_at, anonymized_at via ALTER TABLE IF NOT EXISTS). Corrigido session_summaries.summary_text → content. Removido referencias a colunas que podem nao existir (school, deleted_at, crp, crp_uf, google_event_id, patient_response)
- [x] LGPD Export v3.0: exportacao agora gera Excel (.xlsx) com 14 abas organizadas em portugues (Resumo, Aprendizes, Responsaveis, Profissionais, Protocolos, Sessoes, Alvos/Trials, Comportamentos, Snapshots, Estados Clinicos, PEI, Resumos, Consentimentos, Auditoria). Headers formatados, datas dd/mm/yyyy, cores por aba. JSON mantido via ?format=json. Dep: exceljs@4.4.0

## CONCLUIDO EM 04/03/2026

- [x] Onboarding v2: refatorado de 8 etapas burocraticas para 2 etapas acolhedoras (nome+area → termos)
- [x] API setup simplificada: so depende de tabelas tenants + profiles (sem onboarding_progress, compliance_checklist, protocol_library)
- [x] API progress simplificada: apenas checa onboarding_completed_at
- [x] Toast de boas-vindas no dashboard apos onboarding
- [x] Fix vitest.setup.ts: NODE_ENV read-only em Next.js 16
- [x] Fix migration 005: ALTER TABLE IF NOT EXISTS para colunas de protocol_library
- [x] .gitignore corrigido: .next/ removido do tracking do git

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
*Ultima verificacao cruzada com codigo: 07/03/2026*
