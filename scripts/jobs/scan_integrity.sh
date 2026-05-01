#!/usr/bin/env bash
# =====================================================
# AXIS ABA v2.7.0 — Job: scan_integrity
# Frequência: Diário
# Ação: Recalcula flags automáticas de integridade
#
# Ref: skill_axis_aba_v270.md — Jobs Operacionais
#   "scan_integrity | Diário | Recalcula flags automáticas"
#
# Executa via API dedicada (/api/cron/scan-integrity).
# Auth: Bearer CRON_SECRET (mesmo token dos outros crons).
# Requer: AXIS_API_URL, CRON_SECRET
# =====================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Carregar vars necessarias (apenas as que este script consome)
export CRON_SECRET="$(load_env_var CRON_SECRET)"
export AXIS_API_URL="$(load_env_var AXIS_API_URL)"

API_URL="${AXIS_API_URL:-http://localhost:3000}"
CRON_TOKEN="${CRON_SECRET:-}"

if [ -z "$CRON_TOKEN" ]; then
  echo "[$(date -Iseconds)] ERRO: CRON_SECRET não definido"
  exit 1
fi

echo "[$(date -Iseconds)] Iniciando scan de integridade..."

# Chamar rota cron dedicada (POST /api/cron/scan-integrity)
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${CRON_TOKEN}" \
  "${API_URL}/api/cron/scan-integrity")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "[$(date -Iseconds)] Scan concluído com sucesso: $BODY"
else
  echo "[$(date -Iseconds)] ERRO no scan (HTTP $HTTP_CODE): $BODY"
  exit 1
fi
