# Baseline Notes - scripts/migrations/

## Estado atual (pos-HUB-09, 05/05/2026)

**Migration ativa inicial:** `000_shared_baseline.sql`

Snapshot do schema de producao em 05/05/2026, gerado via `pg_dump --schema-only`.
Inclui 97 tabelas, 63 policies, 62 RLS enabled, 48 RLS forced, 78 functions
explicitas, 14 types/enums, 1 extension (pgcrypto). Migrations 067 e 068 absorvidas.

**Migrations subsequentes:** continuam a partir de 067 (ja em prod).

Proximo numero disponivel: **069**.

## Historico

Migrations 001-066 foram movidas para `scripts/migrations/legacy/` em 05/05/2026
como parte do fechamento do HUB-09 (Onda 10).

As 62 migrations fisicas em `legacy/` (com 4 gaps historicos: 008, 009, 010, 041)
ja foram aplicadas em producao. O `migrate.sh` usa `find -maxdepth 1` em
`scripts/migrations/`, ignorando automaticamente o subdiretorio `legacy/`.
Logo, baseline + 067 + 068 sao as unicas migrations descobertas pelo runner em
ambientes novos.

Os 5 runners TypeScript one-shot (`run-migration-024.ts` ... `028.ts`) foram
movidos para `scripts/legacy/` no mesmo HUB-09.

## Bootstrap em ambientes existentes

Em prod (e mirrors ja com schema), `_migrations` registra todas as 001-066
como aplicadas. Para registrar `000_shared_baseline` retroativamente sem
re-aplicar:

    bash scripts/migrate.sh --bootstrap

(idempotente via ON CONFLICT)

## Aplicacao fresh (dev/CI)

    psql -U axis -d axis_tcc < scripts/migrations/000_shared_baseline.sql
    psql -U axis -d axis_tcc < scripts/migrations/067_shared_tenants_status.sql
    psql -U axis -d axis_tcc < scripts/migrations/068_shared_events_rls_forced.sql

OU usar `migrate.sh` direto, que aplica em ordem.

## Gaps historicos (arqueologia)

Documentados originalmente neste arquivo (antes renomeado de `MIGRATION_GAPS.md`):

| Numero | Status  | Motivo |
|--------|---------|--------|
| 008    | Ausente | Removido durante consolidacao pre-007 full repair |
| 009    | Ausente | Removido durante consolidacao pre-007 full repair |
| 010    | Ausente | Removido durante consolidacao pre-007 full repair |
| 041    | Ausente | Removido/pulado durante desenvolvimento (entre 040 e 042) |

Gaps sao irrelevantes pos-baseline (todo o estado esta em
`000_shared_baseline.sql`). Mantidos aqui apenas para arqueologia.

---

Documentado em: 2026-05-05 (HUB-09 fechado)
