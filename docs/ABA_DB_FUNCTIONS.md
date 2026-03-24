# AXIS ABA — Database Functions

Referência de todas as funções PL/pgSQL do módulo ABA.

**Engine**: CSO-ABA v2.6.1
**Migration**: `scripts/migrations/042_aba_domain_functions.sql`
**Data**: 2026-03-24

---

## Enums

### aba_prompt_level

Níveis de prompt hierárquicos para DTT (Discrete Trial Training).

| Valor | Sigla | Descrição |
|-------|-------|-----------|
| full_physical | FP | Ajuda física total |
| partial_physical | PP | Ajuda física parcial |
| model | M | Modelação |
| gestural | G | Gesto/Apontamento |
| positional | Pos | Dica posicional |
| verbal | V | Dica verbal |
| independent | I | Sem dica (resposta independente) |

### aba_behavior_intensity

Intensidade do evento comportamental (modelo ABC).

| Valor | Descrição |
|-------|-----------|
| low | Comportamento presente mas com impacto mínimo |
| moderate | Requer intervenção mas é manejável |
| high | Requer intervenção imediata |
| severe | Risco à integridade física |

---

## Functions

### record_target_trial

Registra um trial de alvo durante sessão ABA.

**Assinatura:**
```sql
record_target_trial(
  p_tenant_id    UUID,
  p_session_id   UUID,
  p_protocol_id  UUID,
  p_target_name  TEXT,
  p_trials_total SMALLINT,
  p_trials_correct SMALLINT,
  p_prompt_level aba_prompt_level,
  p_notes        TEXT DEFAULT NULL
) RETURNS session_targets
```

**Lógica:**
1. Valida que sessão existe e pertence ao tenant
2. Valida que trials_total > 0 e trials_correct entre 0 e trials_total
3. Calcula score percentual: `ROUND((correct / total) * 100, 2)`
4. Insere em `session_targets`
5. Retorna a linha inserida

**Chamada no código:**
```typescript
// app/api/aba/sessions/[id]/trials/route.ts
client.query(
  `SELECT * FROM record_target_trial($1, $2, $3, $4, $5::smallint, $6::smallint, $7::aba_prompt_level, $8)`,
  [tenantId, id, protocol_id, target_name, trials_total, trials_correct, prompt_level, notes || null]
)
```

**Erros:**
- `[AXIS ABA] Sessão não encontrada no tenant` (P0002)
- `[AXIS ABA] trials_total deve ser > 0` (P0001)
- `[AXIS ABA] trials_correct deve estar entre 0 e trials_total` (P0001)

---

### record_behavior_event

Registra evento comportamental ABC (Antecedent-Behavior-Consequence) durante sessão ABA.

**Assinatura:**
```sql
record_behavior_event(
  p_tenant_id        UUID,
  p_session_id       UUID,
  p_behavior_type    VARCHAR,
  p_antecedent       TEXT,
  p_behavior         TEXT,
  p_consequence      TEXT,
  p_intensity        aba_behavior_intensity,
  p_duration_seconds INT DEFAULT NULL,
  p_location         TEXT DEFAULT NULL
) RETURNS session_behaviors
```

**Lógica:**
1. Valida que sessão existe e pertence ao tenant
2. Insere em `session_behaviors` com todos os campos
3. Retorna a linha inserida

**Chamada no código:**
```typescript
// app/api/aba/sessions/[id]/behaviors/route.ts
client.query(
  `SELECT * FROM record_behavior_event($1, $2, $3, $4, $5, $6, $7::aba_behavior_intensity, $8, $9)`,
  [tenantId, id, behavior_type, antecedent, behavior, consequence, intensity, duration_seconds || null, location || null]
)
```

**Erros:**
- `[AXIS ABA] Sessão não encontrada no tenant` (P0002)

---

## Functions Substituídas por SQL Direto (P0 Hardening)

As seguintes funções eram chamadas no código original mas foram substituídas por SQL direto na migration P0 (sessão 24/03/2026) por serem lógica simples que não justifica function dedicada:

### open_session_aba (REMOVIDA)

**Substituída por:**
```sql
UPDATE sessions_aba SET status = 'in_progress', started_at = COALESCE(started_at, NOW())
WHERE id = $1 AND tenant_id = $2 RETURNING *
```

Guards: sessão não pode estar `in_progress` ou `completed`.

### close_session_aba (REMOVIDA)

**Substituída por:**
```sql
UPDATE sessions_aba SET status = 'completed', ended_at = NOW()
WHERE id = $1 AND tenant_id = $2 RETURNING *
```

Guard: sessão deve estar `in_progress`.

---

## Tabelas Afetadas

| Tabela | Migration base | Colunas adicionadas (042) |
|--------|---------------|--------------------------|
| session_targets | 007 | — (já completa) |
| session_behaviors | 007 | behavior_type, duration_seconds, location, recorded_at |

---

## Mapa de Colunas: session_behaviors

| Coluna | Migration | Tipo | Descrição |
|--------|-----------|------|-----------|
| id | 007 | UUID PK | ID único |
| tenant_id | 007 | UUID FK | Tenant |
| session_id | 007 | UUID FK | Sessão ABA |
| antecedent | 007 | TEXT | Antecedente (A do ABC) |
| behavior | 007 | TEXT | Comportamento (B do ABC) |
| consequence | 007 | TEXT | Consequência (C do ABC) |
| intensity | 007 | VARCHAR | Intensidade |
| function_hypothesis | 007 | TEXT | Hipótese funcional |
| timestamp | 007 | TIMESTAMPTZ | Timestamp legado |
| created_at | 007 | TIMESTAMPTZ | Data de criação |
| behavior_type | **042** | VARCHAR | Tipo do comportamento |
| duration_seconds | **042** | INT | Duração do episódio |
| location | **042** | TEXT | Local do evento |
| recorded_at | **042** | TIMESTAMPTZ | Timestamp do registro |
