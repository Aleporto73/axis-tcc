#!/usr/bin/env bash
# =====================================================
# AXIS — Runner genérico para jobs SQL via docker exec
#
# Uso: ./scripts/jobs/run_sql_job.sh <nome_do_job>
# Ex:  ./scripts/jobs/run_sql_job.sh purge_geo
#      ./scripts/jobs/run_sql_job.sh check_expiration
#      ./scripts/jobs/run_sql_job.sh expire_attestations
#
# Ref: skill_axis_aba_v270.md — Jobs Operacionais
#   "Implementação: cron no VPS, scripts bash + SQL
#    via docker exec, mesmo padrão do backup existente"
# =====================================================

set -euo pipefail

JOB_NAME="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/${JOB_NAME}.sql"

if [ -z "$JOB_NAME" ]; then
  echo "[$(date -Iseconds)] ERRO: Nome do job não informado"
  echo "Uso: $0 <nome_do_job>"
  exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
  echo "[$(date -Iseconds)] ERRO: Arquivo SQL não encontrado: $SQL_FILE"
  exit 1
fi

# Carregar .env primeiro (prod), .env.local override (opcional)
for envfile in .env .env.local; do
  if [ -f "${SCRIPT_DIR}/../../${envfile}" ]; then
    export $(grep -v '^#' "${SCRIPT_DIR}/../../${envfile}" | xargs)
  fi
done

CONTAINER="${POSTGRES_CONTAINER:-axis-postgres}"
DB_NAME="${POSTGRES_DB:-axis}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "[$(date -Iseconds)] Executando job: ${JOB_NAME}"

# Configurar encryption key como variável de sessão do PostgreSQL
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "SET app.encryption_key = '${AXIS_ENCRYPTION_KEY:-}';" \
  -f - < "$SQL_FILE"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$(date -Iseconds)] Job ${JOB_NAME} concluído com sucesso"
else
  echo "[$(date -Iseconds)] ERRO no job ${JOB_NAME} (exit code: $EXIT_CODE)"
  exit $EXIT_CODE
fi
