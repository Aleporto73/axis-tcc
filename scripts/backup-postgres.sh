#!/usr/bin/env bash
# =====================================================
# AXIS — Backup PostgreSQL Automático
#
# Uso: ./scripts/backup-postgres.sh
#
# - pg_dump compactado (gzip)
# - Salva em /backups com data no nome
# - Mantém últimos 7 dias, deleta antigos
# - Lê credenciais do .env (DATABASE_*)
#
# Cron (diário às 3h):
#   0 3 * * * /caminho/para/axis-tcc/scripts/backup-postgres.sh >> /var/log/axis-backup.log 2>&1
# =====================================================

set -euo pipefail

# ─── Configuração ───────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="/backups"
RETENTION_DAYS=7
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"

# ─── Carregar .env ──────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "[BACKUP] ERRO: Arquivo .env não encontrado em $ENV_FILE"
  exit 1
fi

# Exportar variáveis do .env (ignora comentários e linhas vazias)
set -a
# shellcheck disable=SC1090
source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | sed 's/\r$//')
set +a

# ─── Validar variáveis ─────────────────────────────
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USER:-axis}"
DB_PASS="${DATABASE_PASSWORD:-}"
DB_NAME="${DATABASE_NAME:-axis_tcc}"

if [ -z "$DB_PASS" ]; then
  echo "[BACKUP] AVISO: DATABASE_PASSWORD vazia. pg_dump pode solicitar senha."
fi

# ─── Criar diretório de backup ─────────────────────
mkdir -p "$BACKUP_DIR"

# ─── Nome do arquivo ───────────────────────────────
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[BACKUP] Iniciando backup de '${DB_NAME}' em $(date '+%Y-%m-%d %H:%M:%S')"
echo "[BACKUP] Host: ${DB_HOST}:${DB_PORT} | User: ${DB_USER}"
echo "[BACKUP] Destino: ${BACKUP_FILE}"

# ─── Executar pg_dump ──────────────────────────────
export PGPASSWORD="$DB_PASS"

pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-privileges \
  2>/dev/null | gzip > "$BACKUP_FILE"

unset PGPASSWORD

# ─── Verificar resultado ───────────────────────────
if [ ! -s "$BACKUP_FILE" ]; then
  echo "[BACKUP] ERRO: Arquivo de backup vazio ou não criado."
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "[BACKUP] Concluído: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Limpar backups antigos (> 7 dias) ─────────────
echo "[BACKUP] Removendo backups com mais de ${RETENTION_DAYS} dias..."

DELETED=0
while IFS= read -r old_file; do
  echo "[BACKUP]   Removendo: $(basename "$old_file")"
  rm -f "$old_file"
  DELETED=$((DELETED + 1))
done < <(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS})

echo "[BACKUP] ${DELETED} backup(s) antigo(s) removido(s)."

# ─── Listar backups atuais ─────────────────────────
echo "[BACKUP] Backups disponíveis:"
ls -lh "${BACKUP_DIR}/${DB_NAME}_"*.sql.gz 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'

TOTAL_BACKUPS="$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f | wc -l)"
echo "[BACKUP] Total: ${TOTAL_BACKUPS} backup(s) retidos."
echo "[BACKUP] Finalizado em $(date '+%Y-%m-%d %H:%M:%S')"
