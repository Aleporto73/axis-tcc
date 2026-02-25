#!/usr/bin/env bash
# =====================================================
# AXIS — Instalar cron jobs no servidor
#
# Uso: sudo ./scripts/setup-cron.sh
#
# Crons instalados:
#   1. Backup PostgreSQL — diário às 3h
#   2. Renovação webhook Google — diário às 4h (já existente)
# =====================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_SCRIPT="${SCRIPT_DIR}/backup-postgres.sh"
LOG_FILE="/var/log/axis-backup.log"
CRON_TAG="# AXIS-BACKUP"

# Verificar se o script existe e é executável
if [ ! -x "$BACKUP_SCRIPT" ]; then
  echo "ERRO: Script de backup não encontrado ou não executável: $BACKUP_SCRIPT"
  echo "Execute: chmod +x $BACKUP_SCRIPT"
  exit 1
fi

# Criar diretório de backups
mkdir -p /backups
echo "Diretório /backups criado."

# Criar log file
touch "$LOG_FILE"
echo "Log file criado: $LOG_FILE"

# Verificar se cron já existe
EXISTING_CRON=$(crontab -l 2>/dev/null || true)

if echo "$EXISTING_CRON" | grep -q "$CRON_TAG"; then
  echo "Cron job AXIS-BACKUP já existe. Atualizando..."
  # Remover entrada antiga
  EXISTING_CRON=$(echo "$EXISTING_CRON" | grep -v "$CRON_TAG" | grep -v "backup-postgres.sh")
fi

# Adicionar novo cron
NEW_CRON="${EXISTING_CRON}
${CRON_TAG}
0 3 * * * ${BACKUP_SCRIPT} >> ${LOG_FILE} 2>&1"

# Limpar linhas vazias duplicadas
NEW_CRON=$(echo "$NEW_CRON" | sed '/^$/N;/^\n$/d')

echo "$NEW_CRON" | crontab -

echo ""
echo "Cron job instalado com sucesso:"
echo "  Schedule: 0 3 * * * (diariamente às 3h)"
echo "  Script:   $BACKUP_SCRIPT"
echo "  Log:      $LOG_FILE"
echo ""
echo "Crontab atual:"
crontab -l
echo ""
echo "Para testar manualmente: $BACKUP_SCRIPT"
echo "Para ver logs: tail -f $LOG_FILE"
