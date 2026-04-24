#!/bin/bash
# Guardrail: app.is_worker so pode aparecer em scripts/workers/ + src/tests/.
# Motivacao: policy worker_access em transcription_jobs (migration 046)
# libera cross-tenant quando esse GUC e 'true'. Set em outro lugar = backdoor.
# Uso: bash scripts/ci/check_is_worker_scope.sh  |  npm run ci:worker-scope
set -euo pipefail
cd "$(dirname "$0")/../.."

UNEXPECTED=$(grep -rn "app\.is_worker" \
  --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=.git \
  . 2>/dev/null \
  | grep -v "^\./scripts/workers/" \
  | grep -v "^\./src/tests/" \
  | grep -v "^\./scripts/ci/" \
  || true)

if [ -n "${UNEXPECTED}" ]; then
  echo "ERRO: app.is_worker fora dos paths permitidos:"
  echo "${UNEXPECTED}"
  echo ""
  echo "Permitidos: scripts/workers/, src/tests/, scripts/ci/"
  echo "Motivo: migration 046_worker_rls_policy.sql + CHECK 4 do relatorio."
  exit 1
fi

echo "OK: app.is_worker confinado corretamente"
exit 0
