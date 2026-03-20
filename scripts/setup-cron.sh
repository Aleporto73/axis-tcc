#!/usr/bin/env bash
# =====================================================
# AXIS — Instalar / atualizar cron jobs no servidor
#
# Uso: sudo ./scripts/setup-cron.sh
#
# ESTRATÉGIA: Preserva TODOS os crons existentes.
# Apenas remove e re-adiciona as entradas marcadas com
# AXIS-BACKUP e AXIS-JOBS-V270, preservando qualquer
# outro cron (reminders, webhook renewal, etc).
#
# Crons gerenciados por este script:
#   1. Backup PostgreSQL — diário às 3h
#   2. scan_integrity — diário às 5h (v2.7.0)
#   3. check_expiration — diário às 5:15h (v2.7.0)
#   4. expire_attestations — diário às 5:30h (v2.7.0)
#   5. purge_geo — mensal dia 1 às 4:30h (v2.7.0)
# =====================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_SCRIPT="${SCRIPT_DIR}/backup-postgres.sh"
BACKUP_LOG="/var/log/axis-backup.log"
JOBS_DIR="${SCRIPT_DIR}/jobs"
JOBS_LOG="/var/log/axis-jobs.log"
SCAN_SCRIPT="${JOBS_DIR}/scan_integrity.sh"
SQL_RUNNER="${JOBS_DIR}/run_sql_job.sh"

# ── Pré-requisitos ──────────────────────────────────
if [ ! -x "$BACKUP_SCRIPT" ]; then
  echo "ERRO: Script de backup não encontrado ou não executável: $BACKUP_SCRIPT"
  echo "Execute: chmod +x $BACKUP_SCRIPT"
  exit 1
fi

mkdir -p /backups
touch "$BACKUP_LOG"
touch "$JOBS_LOG" 2>/dev/null || true

# Tornar scripts executáveis
chmod +x "$SCAN_SCRIPT" 2>/dev/null || true
chmod +x "$SQL_RUNNER" 2>/dev/null || true

# ── Ler crontab existente ───────────────────────────
EXISTING_CRON=$(crontab -l 2>/dev/null || true)

# ── Remover APENAS as entradas gerenciadas por este script ──
# Remove linhas de comentário-tag E suas linhas de comando associadas
CLEANED_CRON=$(echo "$EXISTING_CRON" \
  | grep -v "# AXIS-BACKUP" \
  | grep -v "backup-postgres.sh" \
  | grep -v "# AXIS-JOBS-V270" \
  | grep -v "scan_integrity.sh" \
  | grep -v "run_sql_job.sh")

# ── Compor novo crontab ────────────────────────────
NEW_ENTRIES="# AXIS-BACKUP
0 3 * * * ${BACKUP_SCRIPT} >> ${BACKUP_LOG} 2>&1
# AXIS-JOBS-V270
0 5 * * * ${SCAN_SCRIPT} >> ${JOBS_LOG} 2>&1
15 5 * * * ${SQL_RUNNER} check_expiration >> ${JOBS_LOG} 2>&1
30 5 * * * ${SQL_RUNNER} expire_attestations >> ${JOBS_LOG} 2>&1
30 4 1 * * ${SQL_RUNNER} purge_geo >> ${JOBS_LOG} 2>&1"

# Juntar: existentes (limpo) + novos
if [ -n "$CLEANED_CRON" ]; then
  FINAL_CRON="${CLEANED_CRON}
${NEW_ENTRIES}"
else
  FINAL_CRON="$NEW_ENTRIES"
fi

# Limpar linhas vazias duplicadas
FINAL_CRON=$(echo "$FINAL_CRON" | sed '/^$/N;/^\n$/d')

echo "$FINAL_CRON" | crontab -

echo ""
echo "Cron jobs instalados com sucesso!"
echo ""
echo "Crontab atual:"
crontab -l
echo ""
echo "Logs:"
echo "  Backup:  tail -f $BACKUP_LOG"
echo "  Jobs:    tail -f $JOBS_LOG"
