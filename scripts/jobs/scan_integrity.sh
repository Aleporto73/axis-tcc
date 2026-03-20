#!/usr/bin/env bash
# =====================================================
# AXIS ABA v2.7.0 — Job: scan_integrity
# Frequência: Diário
# Ação: Recalcula flags automáticas de integridade
#
# Ref: skill_axis_aba_v270.md — Jobs Operacionais
#   "scan_integrity | Diário | Recalcula flags automáticas"
#
# Executa via API para manter lógica centralizada no engine.
# Requer: AXIS_API_URL, AXIS_CRON_TOKEN
# =====================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Carregar variáveis de ambiente
if [ -f "${SCRIPT_DIR}/../../.env.local" ]; then
  export $(grep -v '^#' "${SCRIPT_DIR}/../../.env.local" | xargs)
fi

API_URL="${AXIS_API_URL:-http://localhost:3000}"
CRON_TOKEN="${AXIS_CRON_TOKEN:-}"

if [ -z "$CRON_TOKEN" ]; then
  echo "[$(date -Iseconds)] ERRO: AXIS_CRON_TOKEN não definido"
  exit 1
fi

echo "[$(date -Iseconds)] Iniciando scan de integridade..."

# Chamar API de scan (POST /api/aba/integrity-flags)
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${CRON_TOKEN}" \
  "${API_URL}/api/aba/integrity-flags")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "[$(date -Iseconds)] Scan concluído com sucesso: $BODY"
else
  echo "[$(date -Iseconds)] ERRO no scan (HTTP $HTTP_CODE): $BODY"
  exit 1
fi
