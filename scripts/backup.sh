#!/usr/bin/env bash
# =====================================================
# AXIS ABA — Backup Automatizado PostgreSQL
#
# Faz pg_dump via Docker, comprime com gzip,
# rotaciona mantendo ultimos 7 dias.
#
# Uso:
#   bash scripts/backup.sh          # backup normal
#   bash scripts/backup.sh --quiet  # sem output (cron)
#
# Cron (diario 3h da manha):
#   0 3 * * * /root/axis-tcc/scripts/backup.sh --quiet >> /root/backups/backup.log 2>&1
# =====================================================

set -euo pipefail

# ─── Configuracao ─────────────────────────────────

BACKUP_DIR="/root/backups"
RETENTION_DAYS=7
DOCKER_CONTAINER="axis-postgres"
DB_USER="axis"
DB_NAME="axis_tcc"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/axis_tcc_${TIMESTAMP}.sql.gz"

# ─── Flags ────────────────────────────────────────

QUIET=false
[[ "${1:-}" == "--quiet" ]] && QUIET=true

log() { $QUIET || echo "[BACKUP $(date +%H:%M:%S)] $*"; }
fail() { echo "[BACKUP $(date +%H:%M:%S)] ERRO: $*" >&2; }

# ─── Criar diretorio ─────────────────────────────

mkdir -p "$BACKUP_DIR"

# ─── Verificar Docker ─────────────────────────────

if ! docker ps --format '{{.Names}}' | grep -q "^${DOCKER_CONTAINER}$"; then
  fail "Container '${DOCKER_CONTAINER}' nao esta rodando!"
  exit 1
fi

# ─── Executar pg_dump ─────────────────────────────

log "Iniciando backup de ${DB_NAME}..."

if docker exec "$DOCKER_CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  2>/dev/null | gzip > "$BACKUP_FILE"; then

  SIZE="$(du -h "$BACKUP_FILE" | awk '{print $1}')"
  log "Backup concluido: ${BACKUP_FILE} (${SIZE})"
else
  fail "pg_dump falhou!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# ─── Verificar integridade (arquivo nao vazio) ────

if [[ ! -s "$BACKUP_FILE" ]]; then
  fail "Arquivo de backup vazio! Removendo."
  rm -f "$BACKUP_FILE"
  exit 1
fi

# ─── Rotacao (manter ultimos N dias) ──────────────

DELETED=0
while IFS= read -r old_file; do
  rm -f "$old_file"
  DELETED=$((DELETED + 1))
done < <(find "$BACKUP_DIR" -name "axis_tcc_*.sql.gz" -mtime +${RETENTION_DAYS} -type f 2>/dev/null)

if [[ $DELETED -gt 0 ]]; then
  log "Rotacao: ${DELETED} backup(s) antigo(s) removido(s) (>${RETENTION_DAYS} dias)"
fi

# ─── Resumo ───────────────────────────────────────

TOTAL="$(find "$BACKUP_DIR" -name "axis_tcc_*.sql.gz" -type f | wc -l)"
log "Total de backups armazenados: ${TOTAL}"
log "Proximo backup antigo sera removido em ${RETENTION_DAYS} dias."
