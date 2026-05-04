# AXIS — Pontos de Atenção Arquitetural

Documento vivo de débitos arquiteturais conhecidos no AXIS Clínico.

Cada entrada = decisão consciente de NÃO refatorar agora, com gatilho explícito de quando refatorar.

**Filosofia:** sistema funciona em produção. Refatorar débito sem gatilho real cria risco maior que mantém. Documentar > refatorar preventivo.

**Última atualização:** Onda 8 / Sessão 2B (03/05/2026)
**HEAD vigente:** 57dafdd

---

## HUB-04 — withTenant fallback admin

### Estado atual

- **Arquivo:** `src/database/with-tenant.ts`
- **Linhas:** 161-186 (bloco `else` quando `profileResult.rows.length === 0`)
- **Comportamento:** se usuário Clerk autenticado não tem profile ativo, busca em `tenants WHERE clerk_user_id = $1`, retorna com `role='admin'` e `planTier='free'` hardcoded

### Por que existe

Compatibilidade pré-migração de profiles. Antes do Onda 5 alguns tenants existiam sem profile correspondente. Fallback evita quebrar acesso desses usuários.

### Estado em produção (validado 03/05/2026)

- 15 tenants órfãos identificados (5 `pending_hotmart_*` + 10 testes/internos)
- 0 usuários reais comerciais afetados
- 0 acesso ativo pelos 15 órfãos
- Risco prático: ZERO hoje

### Quando vira problema (gatilhos para refatorar)

1. Mexer em `/api/webhook/clerk/route.ts` — se signup mudar e parar de criar profile, novo usuário vira admin silencioso
2. Mexer em `/api/webhook/hotmart/route.ts` — idem para fluxo Hotmart
3. Mudar lógica de `profiles.is_active` — se algum fluxo desativar profile mas manter tenant, fallback dispara
4. Adicionar SSO/auth alternativa — qualquer fluxo novo de criação de tenant precisa garantir profile

### Ação quando gatilho disparar

1. Refatorar fallback (linhas 161-186) para `throw new Error('Profile required for tenant access')`
2. Migration de cleanup dos 15 órfãos antes do deploy (delete pending_hotmart sem compra completada, decidir caso-a-caso para tenants de teste)
3. Adicionar teste vitest verificando que usuário sem profile recebe 500 (não admin silencioso)

### Quem decide

Alê (gestor de dev). Refatoração só com aprovação explícita.

---

## HUB-05 — calendar_connections sem RLS forced

### Estado atual

- **Tabela:** `calendar_connections` (criada em migration 056)
- **RLS:** AUSENTE (forced=false, enabled=false)
- **Schema declara explicitamente:** "Sem RLS — prod não tem policies nessas tabelas" (056:4)

### Rotas que tocam a tabela (15 mapeadas)

**Com `withTenant` (8 rotas — OK):**

- `aba/google/{disconnect,status,sync,watch}/route.ts`
- `google/{disconnect,status,sync,watch}/route.ts`

**Com `pool.query` direto (5 rotas — débito):**

- `aba/google/callback/route.ts` — OAuth entry point (chicken-and-egg)
- `cron/renew-webhook/route.ts` — TEM TODO explícito linhas 7-15
- `google/callback/route.ts` (TCC) — OAuth entry point
- `google/webhook/route.ts` (TCC) — webhook Google sem auth Clerk
- `sessions/create/route.ts` — função helper `createGoogleCalendarEvent`

**Pattern misto/Caminho 2 legítimo (2 rotas):**

- `aba/google/webhook/route.ts` — chicken-and-egg correto
- `aba/lgpd/delete/route.ts` — dentro de withTenant

### Por que funciona hoje

Isolamento garantido por `WHERE tenant_id = $1` no app code. Funciona porque devs/IAs incluem o filtro corretamente. Sem defense-in-depth do DB.

### Estado em produção (validado 03/05/2026)

- 0 vazamentos cross-tenant conhecidos
- Todas as 15 rotas têm `WHERE tenant_id` correto

### Quando vira problema (gatilhos para refatorar)

1. Criar rota NOVA que toque `calendar_connections` — risco de esquecer `WHERE tenant_id`
2. Adicionar dev/colaborador novo ao projeto — sem familiaridade com o pattern
3. Refatorar autenticação/multi-tenancy — pode quebrar premissas atuais
4. Auditoria de compliance externa exigir defense-in-depth no DB
5. Bug real de vazamento em qualquer das 5 rotas com `pool.query`

### Ação quando gatilho disparar

1. Refatorar 5 rotas com `pool.query` direto:
   - OAuth callbacks (2): aplicar Caminho 2 (lookup token → set_config app.tenant_id → query)
   - Webhook TCC + cron + sessions/create (3): converter para `withTenant` ou Caminho 2
2. Migration nova ativando `ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + policies por tenant
3. Smoke testes em todas as 15 rotas antes do deploy
4. Estimativa: 4-6h de trabalho

### Quem decide

Alê. RLS quebra prod se ativada antes de refatorar — risco real.

---

## Protocolo de Auditoria

**Aprendizado da Onda 8 Bloco 0 (03/05/2026):** auditorias anteriores (CC + Codex) leram `docs/NOTE_TDAH.md` e `docs/NOTE_ABA.md` como fonte de verdade. Resultado: 2 bugs (TDAH-04 + ABA-02 Bug A + Bug B) marcados como pendentes nos NOTEs já estavam corrigidos no código. Custo evitado: ~3h de trabalho em fantasmas.

### Regras

1. **NOTEs (NOTE_TCC, NOTE_ABA, NOTE_TDAH) são HISTÓRICOS, não fonte de verdade.**
   Servem para entender contexto, não para validar bugs ativos.

2. **Auditoria DEVE ler código real.**
   Todo achado precisa vir com:
   - Caminho do arquivo
   - Linha exata
   - Comando `grep` ou `sed` que confirmou o bug no código atual
   - SHA-PRE do arquivo no momento da auditoria

3. **Auto-declarado em NOTE sem validação no código = REJEITAR achado.**
   Se auditoria diz "auto-declarado em NOTE_X.md" e não valida no código, classificar como INCONCLUSIVO.

4. **Toda Sessão de fix começa com Bloco de validação read-only.**
   - 5-15 min de leitura empírica
   - Se bug é fantasma, REFUTA e cancela Sessão
   - Custo baixo, evita remendo

5. **Após corrigir bug, atualizar NOTE no MESMO commit.**
   - Marcar entrada como `[x] CORRIGIDO` ou `[~] REFUTADO`
   - Adicionar referência ao commit/sessão que corrigiu/refutou
   - Manter histórico, não deletar

### Formato de entrada FECHADA

````markdown
- [x] **CORRIGIDO (Onda X Sessão Y, DD/MM/AAAA):** ~~descrição original do bug~~

  **Validação empírica:** [arquivo:linha onde fix vive ou onde validação ocorreu]
````

````markdown
- [~] **REFUTADO (Onda X Sessão Y, DD/MM/AAAA):** ~~descrição original do bug~~

  **Validação empírica:** [razão pela qual era falso positivo]
````

---

## Padrão para futuros débitos

Adicionar nova entrada com:

- Estado atual (arquivo, linhas, comportamento)
- Por que existe (contexto histórico)
- Estado em produção (dados reais validados)
- Quando vira problema (gatilhos)
- Ação quando gatilho disparar (passos)
- Quem decide

Cada débito documentado = uma decisão consciente registrada.
