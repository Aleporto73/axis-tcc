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
#
# Item 11I (auditoria sistematica crons): line endings normalizados pra LF
# (CRLF impedia execucao via shebang) + loader trocado pelo Caminho C
# minimal (helper load_env_var) — robusto contra valores especiais no .env
# como RESEND_FROM=AXIS ABA <noreply@...> que quebravam o set -a + source.
# =====================================================

set -euo pipefail

# ─── Configuração ───────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="/backups"
RETENTION_DAYS=7
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"

# ─── Loader minimal: extrai apenas vars necessarias do .env ─────
# Robusto contra valores com <, >, espacos, multi-line (FIREBASE_PRIVATE_KEY).
# Padrao "set -a + source" (versao anterior) quebrava em valores tipo
# RESEND_FROM=AXIS ABA <noreply@...> porque bash interpreta < como redirect.
# Ver Item 11H em docs/audits/onda7_backlog.md.
load_env_var() {
  local key="$1"
  local val=""
  if [ -f "$ENV_FILE" ]; then
    local found
    found=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2-)
    if [ -n "$found" ]; then
      val="$found"
    fi
  fi
  echo "$val"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "[BACKUP] ERRO: Arquivo .env não encontrado em $ENV_FILE"
  exit 1
fi

# Carregar apenas as 5 vars que este script consome (DATABASE_*)
export DATABASE_HOST="$(load_env_var DATABASE_HOST)"
export DATABASE_PORT="$(load_env_var DATABASE_PORT)"
export DATABASE_USER="$(load_env_var DATABASE_USER)"
export DATABASE_PASSWORD="$(load_env_var DATABASE_PASSWORD)"
export DATABASE_NAME="$(load_env_var DATABASE_NAME)"

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
