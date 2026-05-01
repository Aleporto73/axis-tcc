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

# Loader minimal: extrai apenas vars necessarias dos arquivos .env
# Robusto contra valores com <, >, espacos, multi-line (FIREBASE_PRIVATE_KEY).
# Padrao "set -a + source" (sub-fix anterior) quebrou em valores tipo
# RESEND_FROM=AXIS ABA <noreply@...> porque bash interpreta < como redirect.
# Ver Item 11H em docs/audits/onda7_backlog.md.
load_env_var() {
  local key="$1"
  local val=""
  for envfile in "${SCRIPT_DIR}/../../.env" "${SCRIPT_DIR}/../../.env.local"; do
    if [ -f "$envfile" ]; then
      local found
      found=$(grep -E "^${key}=" "$envfile" 2>/dev/null | tail -1 | cut -d= -f2-)
      if [ -n "$found" ]; then
        val="$found"
      fi
    fi
  done
  echo "$val"
}

# Carregar vars necessarias (apenas as que este script consome via docker exec)
export AXIS_ENCRYPTION_KEY="$(load_env_var AXIS_ENCRYPTION_KEY)"
export POSTGRES_CONTAINER="$(load_env_var POSTGRES_CONTAINER)"
export POSTGRES_DB="$(load_env_var POSTGRES_DB)"
export POSTGRES_USER="$(load_env_var POSTGRES_USER)"

CONTAINER="${POSTGRES_CONTAINER:-axis-postgres}"
DB_NAME="${POSTGRES_DB:-axis}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "[$(date -Iseconds)] Executando job: ${JOB_NAME}"

# Item 11H BUG 4: -v ON_ERROR_STOP=1 garante que ERROR + ROLLBACK propagam
# exit code != 0. Sem isso, psql sai 0 mesmo com falhas SQL silenciadas.
# Como o script tem "set -euo pipefail", bash aborta na falha do psql ANTES
# de chegar nas linhas EXIT_CODE/branches. Mensagem amigavel "ERRO no job"
# nao aparece em falha — exit code do psql propaga diretamente. Aceitavel
# pro objetivo (cron/log mostra exit != 0). Refator com set +e/-e fica
# como item futuro se mensagem amigavel for prioridade.
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -c "SET app.encryption_key = '${AXIS_ENCRYPTION_KEY:-}';" \
  -f - < "$SQL_FILE"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$(date -Iseconds)] Job ${JOB_NAME} concluído com sucesso"
else
  echo "[$(date -Iseconds)] ERRO no job ${JOB_NAME} (exit code: $EXIT_CODE)"
  exit $EXIT_CODE
fi
