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

# Carregar variáveis de ambiente
if [ -f "${SCRIPT_DIR}/../../.env.local" ]; then
  export $(grep -v '^#' "${SCRIPT_DIR}/../../.env.local" | xargs)
fi

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
