# AXIS TCC — Matriz de Acesso

**Atualizado:** 24/03/2026 (hardening v1.0)
**Modo atual:** Single-user (1 tenant = 1 profissional)
**Evolução planejada:** Multi-user (admin/terapeuta/supervisor) em até 6 meses

---

## Estado Atual: Isolamento por Tenant

O TCC opera atualmente como single-user: cada tenant corresponde a um único profissional (psicólogo). O isolamento é garantido via `tenant_id` em todas as queries, resolvido automaticamente pelo `withTenant()` ou manualmente via `pool.query` com Clerk auth + tenant lookup.

| Camada | Mecanismo | Cobertura |
|--------|-----------|-----------|
| **Autenticação** | Clerk JWT (auth()) | 100% das rotas API |
| **Tenant Resolution** | withTenant() ou pool.query + tenants lookup | 100% das rotas (após fix analyze-clinical) |
| **SQL Isolation** | `WHERE tenant_id = $N` em toda query | 100% das queries |
| **Parameterização** | Prepared statements ($1, $2...) | 100% (zero raw SQL) |

---

## Rotas TCC — Padrão de Acesso (Single-User)

### Pacientes

| Ação | Acesso | Padrão |
|------|--------|--------|
| Listar pacientes (GET /patients) | Todos do tenant | withTenant |
| Ver paciente (GET /patients/[id]) | Apenas do tenant | withTenant |
| Criar paciente (POST /patients) | No próprio tenant | withTenant |
| Editar paciente (PATCH /patients/[id]) | Apenas do tenant | withTenant |

### Sessões

| Ação | Acesso | Padrão |
|------|--------|--------|
| Listar sessões (GET /sessions) | Todas do tenant | withTenant |
| Ver sessão (GET /sessions/[id]) | Apenas do tenant | withTenant |
| Criar sessão (POST /sessions) | No próprio tenant | withTenant |
| Editar sessão (PATCH /sessions/[id]) | Apenas do tenant | withTenant |
| Resumo sessão (POST /sessions/[id]/summary) | Apenas do tenant | withTenant |

### Eventos Clínicos

| Ação | Acesso | Padrão |
|------|--------|--------|
| Listar eventos (GET /events) | Todos do tenant | withTenant |
| Criar evento (POST /events/create) | No próprio tenant | pool + tenant lookup |

### Sugestões (IA)

| Ação | Acesso | Padrão |
|------|--------|--------|
| Listar sugestões (GET /suggestions) | Todas do tenant | pool + tenant lookup |
| Decidir sugestão (POST /suggestions/[id]/decide) | Apenas do tenant | pool + tenant lookup |

### Análise Clínica (IA)

| Ação | Acesso | Padrão |
|------|--------|--------|
| Analisar transcrição (POST /analyze-clinical) | Tenant do usuário | pool + tenant lookup (fix hardening v1.0) |
| Analisar sessão TCC (POST /analyze-tcc) | Tenant do usuário | pool + tenant lookup (triple-check session+patient+tenant) |

### Chat Ana (IA)

| Ação | Acesso | Padrão |
|------|--------|--------|
| Chat assistente (POST /chat-ana) | Tenant com licença TCC ativa | pool + tenant + license check |

### Transcrição

| Ação | Acesso | Padrão |
|------|--------|--------|
| Transcrever áudio (POST /transcribe) | Tenant com licença + crédito | pool + tenant + license + usage check |

### Dashboard / Estatísticas

| Ação | Acesso | Padrão |
|------|--------|--------|
| Stats gerais (GET /stats) | Dados do tenant | pool + tenant lookup |
| Audit log (GET /audit) | Logs do tenant | pool + tenant lookup |

### Portais Públicos (sem auth Clerk)

| Portal | Método de Acesso | Escopo |
|--------|-----------------|--------|
| Portal Família (/familia/[token]) | Token UUID 90d | Dados do paciente vinculado ao token |

---

## Regras de Erro

- Acesso negado por tenant retorna **401 "Não autorizado"** (sem detalhes)
- Recurso não encontrado retorna **404 genérico** ("Não encontrado" ou "Paciente não encontrado")
- Nenhuma mensagem de erro revela se recurso existe em outro tenant
- Erros internos retornam **500 "Erro interno"** (sem stack trace)
- Licença inválida retorna **403 "Não autorizado"** (sem revelar tipo de licença)

---

## Gaps Corrigidos (Hardening v1.0)

| Rota | Gap | Fix |
|------|-----|-----|
| `/api/analyze-clinical` | Zero tenant isolation (só Clerk auth) | Adicionado pool.query tenant resolution |
| `/api/chat-ana` | Mensagem "Licença TCC não encontrada" vazava info | Alterado para "Não autorizado" genérico |

---

## Evolução Futura: Multi-User (6 meses)

### Roles Planejados

| Role | Descrição | Escopo Planejado |
|------|-----------|-----------------|
| **admin** | Administrador da clínica | Acesso total dentro do tenant |
| **supervisor** | Supervisora clínica | Acesso total dentro do tenant |
| **terapeuta** | Profissional de atendimento | Apenas pacientes vinculados |

### Infraestrutura Já Disponível

A base para multi-user já existe no módulo compartilhado (`with-tenant.ts` + `with-role.ts`):

- `TenantContext` já inclui campo `role: UserRole`
- `requireRole(ctx, ...roles)` — Verifica role do usuário
- `requireAdmin(ctx)` — Atalho para role admin
- `requireAdminOrSupervisor(ctx)` — Atalho para admin/supervisor
- `handleRouteError()` — Já trata `RoleError` (403)
- `PlanGateError` — Já disponível para feature gating

### Migração Necessária (quando implementar)

1. **Tabela de vínculos TCC** — Criar `tcc_patient_therapists` (N:N), similar a `tdah_patient_therapists`
2. **Helpers TCC** — Criar `tccPatientFilter(ctx, startParam)` e `canAccessTccPatient(ctx, patientId)`
3. **Rotas de listagem** — Adicionar filter em GET /patients, GET /sessions
4. **Rotas de item** — Adicionar `canAccessTccPatient` em GET/PATCH /patients/[id], /sessions/[id], etc.
5. **Rotas de criação** — Admin/Supervisor criam; terapeuta pode criar para pacientes vinculados
6. **Portais** — Sem impacto (já usam token UUID)

### Risco de Regressão

| Risco | Mitigação |
|-------|-----------|
| Query sem tenant_id | Todos os testes validam presença de tenant_id |
| Rota AI sem tenant check | analyze-clinical e chat-ana agora têm check explícito |
| Erro 403 com info leakage | Padrão: sempre 404 genérico para acesso negado |
| Migração multi-user quebra rotas | Helpers reutilizáveis (pattern TDAH testado com 16 testes) |
| withTenant vs pool.query divergência | Ambos patterns validados; withTenant preferido para novas rotas |
