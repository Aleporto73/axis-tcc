# AXIS - Database Design Rules

## Multi-Tenant
All tables include tenant_id/organization_id. Queries must ALWAYS filter by tenant. RLS enforced.

## Append-Only for Clinical Data
Clinical data: INSERT only. Never UPDATE/DELETE. Snapshots are immutable.

## Engine Version Lock
Required fields: session_snapshots.engine_version, clinical_states.engine_version, learner_protocols.protocol_engine_version

## Key Tables
Shared: tenants, profiles, axis_audit_logs, notifications, calendar_connections, email_logs
TCC: patients, sessions, events, clinical_states, suggestions
ABA: learners, learner_therapists, guardians, guardian_consents, pei_plans, learner_protocols, sessions_aba, session_targets, session_behaviors, session_snapshots, clinical_states_aba, generalization_probes, maintenance_probes

## Protocol Status Enum (aba_protocol_status)
draft, active, mastered, generalization, mastered_validated, maintenance, maintained, regression, suspended, discontinued, archived

IMPORTANT: `status` column in `learner_protocols` is PostgreSQL ENUM type `aba_protocol_status`.
- Never cast status as `::varchar` or `::text` when writing — PostgreSQL accepts plain string for ENUM.
- All parameterized queries MUST use explicit type casts: `$1::uuid`, `$2::int`, `$3::text`, `$4::numeric`, `$5::timestamptz`.
- `jsonb_build_object()` parameters REQUIRE explicit casts — PostgreSQL cannot infer types inside VARIADIC functions.
- Migration 013 added `mastered_validated` to the ENUM (was missing from initial DB setup).

## Data Retention
Clinical data: 7 years (CFM/CRP). Audit logs: 5 years. After cancellation: 90 days then anonymization.

## NEVER Do
Query without tenant filter. UPDATE/DELETE clinical records. Modify snapshots. Create cross-tenant joins.
