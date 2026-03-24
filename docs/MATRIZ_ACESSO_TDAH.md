# AXIS TDAH — Matriz de Acesso por Role

**Atualizado:** 24/03/2026 (hardening v1.0)
**Base:** Migration 038 (tdah_patient_therapists N:N)

---

## Roles

| Role | Descrição | Escopo |
|------|-----------|--------|
| **admin** | Administrador da clínica | Acesso total dentro do tenant |
| **supervisor** | Supervisora clínica | Acesso total dentro do tenant |
| **terapeuta** | Profissional de atendimento | Apenas pacientes vinculados (tdah_patient_therapists) + fallback created_by |

---

## Pacientes

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Listar pacientes (GET /patients) | Apenas vinculados | Todos | Todos |
| Ver paciente por ID (GET /patients/[id]) | Apenas vinculados | Todos | Todos |
| Criar paciente (POST /patients) | N/A (admin/supervisor) | Sim | Sim |
| Editar paciente (PATCH /patients/[id]) | Apenas vinculados | Todos | Todos |
| Vincular terapeuta (POST /patient-therapists) | N/A (admin/supervisor) | Sim | Sim |
| Desvincular terapeuta (DELETE /patient-therapists) | N/A (admin/supervisor) | Sim | Sim |

---

## Sessões

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Listar sessões (GET /sessions) | Apenas de pacientes vinculados | Todas | Todas |
| Ver sessão (GET /sessions/[id]) | Apenas de pacientes vinculados | Todas | Todas |
| Criar sessão (POST /sessions) | Apenas para pacientes vinculados | Sim | Sim |
| Abrir/Fechar/Cancelar (PATCH /sessions/[id]) | Apenas de pacientes vinculados | Todas | Todas |
| Resumo sessão (GET/POST/PUT /sessions/[id]/summary) | Apenas de pacientes vinculados | Todas | Todas |

---

## Observações (Trials)

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Registrar observação (POST /observations) | Apenas em sessões de pacientes vinculados | Sim | Sim |

---

## Protocolos

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Listar protocolos (GET /protocols) | Apenas de pacientes vinculados | Todos | Todos |
| Ver protocolo (GET /protocols/[id]) | Apenas de pacientes vinculados | Todos | Todos |
| Criar protocolo (POST /protocols) | N/A (admin/supervisor) | Sim | Sim |
| Editar protocolo (PATCH /protocols/[id]) | N/A (admin/supervisor) | Sim | Sim |

---

## Estado Clínico (CSO-TDAH)

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Ver estado clínico (GET /clinical-state) | Apenas de pacientes vinculados | Todos | Todos |
| Scores CSO (GET /scores) | Apenas de pacientes vinculados | Todos | Todos |

---

## DRC (Diário de Registro Comportamental)

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Listar DRC (GET /drc) | Apenas de pacientes vinculados | Todos | Todos |
| Ver DRC (GET /drc/[id]) | Apenas de pacientes vinculados | Todos | Todos |
| Editar/Review DRC (PATCH /drc/[id]) | Apenas de pacientes vinculados | Todos | Todos |

---

## Eventos Clínicos

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Listar eventos (GET /events) | Apenas de pacientes vinculados | Todos | Todos |
| Registrar evento (POST /events) | Apenas em sessões de pacientes vinculados | Sim | Sim |

---

## Responsáveis (Guardians)

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Listar responsáveis (GET /guardians) | Apenas de pacientes vinculados | Todos | Todos |
| Editar responsável (PATCH /guardians/[id]) | Apenas de pacientes vinculados | Todos | Todos |
| Desativar responsável (DELETE /guardians/[id]) | Apenas de pacientes vinculados | Todos | Todos |

---

## Planos Terapêuticos

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Listar planos (GET /plans) | Apenas de pacientes vinculados | Todos | Todos |
| Ver plano (GET /plans/[id]) | Apenas de pacientes vinculados | Todos | Todos |
| Criar plano (POST /plans) | Apenas para pacientes vinculados | Sim | Sim |
| Editar plano (PATCH /plans/[id]) | Apenas de pacientes vinculados | Todos | Todos |

---

## Rotinas Domésticas

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Listar rotinas (GET /routines) | Apenas de pacientes vinculados | Todas | Todas |
| Ver rotina (GET /routines/[id]) | Apenas de pacientes vinculados | Todas | Todas |
| Criar rotina (POST /routines) | Apenas para pacientes vinculados | Sim | Sim |
| Editar rotina (PATCH /routines/[id]) | Apenas de pacientes vinculados | Todas | Todas |

---

## Economia de Fichas (Token Economy)

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Listar economia (GET /token-economy) | Apenas de pacientes vinculados | Todas | Todas |
| Ver economia (GET /token-economy/[id]) | Apenas de pacientes vinculados | Todas | Todas |
| Editar economia (PATCH /token-economy/[id]) | Apenas de pacientes vinculados | Todas | Todas |
| Registrar transação (POST /token-economy/[id]/transactions) | Apenas de pacientes vinculados | Sim | Sim |

---

## Dashboard / Relatórios / Alertas

| Ação | Terapeuta | Supervisor | Admin |
|------|-----------|------------|-------|
| Dashboard KPIs (GET /dashboard) | Apenas de pacientes vinculados | Todos | Todos |
| Relatórios (GET /reports) | Apenas de pacientes vinculados | Todos | Todos |
| Alertas clínicos (GET /alerts) | Apenas de pacientes vinculados | Todos | Todos |

---

## Portais Públicos (sem auth Clerk)

| Portal | Método de Acesso | Escopo |
|--------|-----------------|--------|
| Portal Família (/familia/[token]) | Token UUID 90d | Dados do paciente vinculado ao token |
| Portal Escola (/escola/[token]) | Token UUID 90d | Dados do paciente vinculado ao token + DRC |

---

## Mecanismo de Filtragem

O sistema usa 3 helpers em `src/database/with-role.ts`:

1. **`tdahPatientFilter(ctx, startParam)`** — Gera cláusula SQL para WHERE em queries de listagem. Admin/Supervisor: sem filtro. Terapeuta: filtra por `tdah_patient_therapists` OR `created_by`.

2. **`tdahSessionFilter(ctx, startParam, alias)`** — Idem, para sessões (filtra por patient_id dos pacientes vinculados).

3. **`canAccessTdahPatient(ctx, patientId)`** — Verificação pontual: retorna `true/false`. Usado em rotas de item individual `/[id]`.

Fallback `created_by` garante compatibilidade com dados pré-Migration-038.

---

## Regras de Erro

- Acesso negado retorna **404 genérico** ("Não encontrado"), nunca 403 com informação sobre existência
- Nenhuma mensagem de erro revela se o recurso existe ou pertence a outro profissional
- Pattern: `if (!canAccess) → throw 404 genérico`
