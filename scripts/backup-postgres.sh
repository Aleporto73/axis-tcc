#!/usr/bin/env bash
# =====================================================
# AXIS — Backup PostgreSQL via docker exec
#
# Uso: ./scripts/backup-postgres.sh
#
# - pg_dump via "docker exec" (mesmo padrao de scripts/jobs/run_sql_job.sh
#   e do scripts/backup.sh nao-versionado que ja roda em prod)
# - User 'axis' (SUPERUSER) — bypassa RLS forced para dump completo.
#   Importante: tentativa anterior usando pg_dump direto via TCP como
#   axis_app falhava com dump vazio (~20 bytes) porque axis_app respeita
#   RLS forced em 17 tabelas TDAH + 42 TCC/ABA (Onda 7 RLS).
# - Compactado com gzip
# - Salva em /backups com data no nome (separado de /root/backups
#   usado pelo backup.sh nao-versionado, evita colisao temporaria)
# - Mantem ultimos 7 dias
# - Sanity check: dump < 100KB sinaliza erro de role/RLS e aborta
#
# Cron (diario as 3h):
#   0 3 * * * /caminho/para/axis-tcc/scripts/backup-postgres.sh >> /var/log/axis-backup.log 2>&1
#
# Item 11I (auditoria sistematica crons):
#   - Line endings normalizados pra LF (CRLF impedia execucao via shebang)
#   - Loader trocado pelo Caminho C minimal (load_env_var)
#   - Refatorado pra usar docker exec apos descoberta empirica de RLS
#     bloqueando pg_dump direto via TCP como axis_app
# =====================================================

set -euo pipefail

# ─── Configuração ───────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="/backups"
RETENTION_DAYS=7
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"

# Sanity threshold: dump menor que isto sinaliza falha de role/RLS
# (dump vazio com pg_dump bloqueado por RLS retorna ~20 bytes gzip)
MIN_BACKUP_SIZE_BYTES=102400  # 100KB

# ─── Loader minimal: extrai apenas vars necessarias do .env ─────
# Robusto contra valores com <, >, espacos, multi-line.
# Padrao Caminho C — ver Item 11H em docs/audits/onda7_backlog.md.
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

# ─── Resolver container Docker (override via .env, fallback hardcoded) ─
CONTAINER="$(load_env_var POSTGRES_CONTAINER)"
[ -z "$CONTAINER" ] && CONTAINER="axis-postgres"

# User e DB hardcoded (mesmo padrao scripts/backup.sh nao-versionado)
# 'axis' e SUPERUSER no container — bypassa RLS pra dump completo.
DB_USER="axis"
DB_NAME="axis_tcc"

# ─── Validar Docker disponivel ─────────────────────
if ! command -v docker > /dev/null 2>&1; then
  echo "[BACKUP] ERRO: docker nao encontrado no PATH."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "[BACKUP] ERRO: container '${CONTAINER}' nao esta rodando."
  echo "[BACKUP] docker ps --format '{{.Names}}':"
  docker ps --format '{{.Names}}' | head -10
  exit 1
fi

# ─── Criar diretório de backup ─────────────────────
mkdir -p "$BACKUP_DIR"

# ─── Nome do arquivo ───────────────────────────────
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[BACKUP] Iniciando backup de '${DB_NAME}' em $(date '+%Y-%m-%d %H:%M:%S')"
echo "[BACKUP] Container: ${CONTAINER} | User: ${DB_USER}"
echo "[BACKUP] Destino: ${BACKUP_FILE}"

# ─── Executar pg_dump via docker exec ──────────────
# user 'axis' = SUPERUSER no container, bypassa RLS forced.
#
# Flags --clean --if-exists (porting de scripts/backup.sh ao remover
# crontab nao-versionado de backup duplicado):
#   --clean: gera 'DROP TABLE IF EXISTS' antes dos 'CREATE TABLE' no SQL
#   --if-exists: DROP nao falha se tabela nao existe (idempotente)
# Beneficio: 'psql < backup.sql' funciona em DB existente sem cleanup
# manual. Disaster recovery simples: criar DB vazio + restore direto.
docker exec -i "$CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  2>/dev/null | gzip > "$BACKUP_FILE"

# ─── Verificar resultado: existe e nao-vazio ───────
if [ ! -s "$BACKUP_FILE" ]; then
  echo "[BACKUP] ERRO: Arquivo de backup vazio ou nao criado."
  rm -f "$BACKUP_FILE"
  exit 1
fi

# ─── Sanity check: tamanho minimo ──────────────────
# Se dump retornou < 100KB, provavel que role nao bypassa RLS
# (regressao da causa que motivou Item 11I refator). Aborta.
BACKUP_SIZE_BYTES="$(stat -c '%s' "$BACKUP_FILE")"
if [ "$BACKUP_SIZE_BYTES" -lt "$MIN_BACKUP_SIZE_BYTES" ]; then
  echo "[BACKUP] ERRO: Backup muito pequeno (${BACKUP_SIZE_BYTES} bytes < ${MIN_BACKUP_SIZE_BYTES} bytes minimo)."
  echo "[BACKUP] Provavel causa: role usada pelo pg_dump nao bypassa RLS."
  echo "[BACKUP] Verifique se '${DB_USER}' e SUPERUSER ou tem BYPASSRLS:"
  echo "[BACKUP]   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = '${DB_USER}';"
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "[BACKUP] Concluido: ${BACKUP_FILE} (${BACKUP_SIZE})"

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
echo "[BACKUP] Backups disponiveis:"
ls -lh "${BACKUP_DIR}/${DB_NAME}_"*.sql.gz 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'

TOTAL_BACKUPS="$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f | wc -l)"
echo "[BACKUP] Total: ${TOTAL_BACKUPS} backup(s) retidos."
echo "[BACKUP] Finalizado em $(date '+%Y-%m-%d %H:%M:%S')"
