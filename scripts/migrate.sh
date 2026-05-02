#!/usr/bin/env bash
# =====================================================
# AXIS — Migration Runner
#
# Executa migrações SQL pendentes em ordem sequencial.
# Cada migração roda dentro de uma transação via psql.
# Idempotente: migrações já aplicadas são ignoradas.
#
# Item 22 (auditoria sistemática): refator pra alinhar com padrões
# pós-Item 11H/11I:
#   - Loader minimal Caminho C (load_env_var) — substitui
#     `source <(...)` que quebra com valores especiais no .env
#     (Item 11H sub-fix 2 quebrou em RESEND_FROM=AXIS ABA <noreply@...>)
#   - docker exec em vez de pg_dump TCP direto — alinha com
#     run_sql_job.sh / backup-postgres.sh (Item 11I).
#     User 'axis' (SUPERUSER) bypassa RLS forced em DDL/DML migrations.
#   - Coluna applied_by VARCHAR(64) NULL no schema (track who ran each)
#   - Flag --bootstrap pra registrar migrations existentes em prod sem
#     re-executar (one-shot retroativo, idempotente via ON CONFLICT)
#
# Uso:
#   bash scripts/migrate.sh              # aplicar pendentes
#   bash scripts/migrate.sh --dry-run    # mostrar sem executar
#   bash scripts/migrate.sh --status     # alias de --dry-run
#   bash scripts/migrate.sh --target NNN # parar na NNN
#   bash scripts/migrate.sh --verbose    # mostrar SQL de cada
#   bash scripts/migrate.sh --bootstrap  # registrar 001-NNN existentes SEM rodar
#
# DATABASE_NAME (parametrizado em 02/05/2026 — Item 22):
#   Default: lê DATABASE_NAME do .env do projeto (axis_tcc em prod).
#   Pra rodar em outro DB do mesmo container (ex: staging), override inline:
#     DATABASE_NAME=axis_tcc_staging bash scripts/migrate.sh --bootstrap
#   Ambiente real do AXIS: 1 container axis-postgres + 2 databases distintas
#   (axis_tcc prod, axis_tcc_staging staging).
# =====================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
ENV_FILE="$PROJECT_ROOT/.env"

# ─── Cores ─────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${BLUE}[MIGRATE]${NC} $*"; }
ok()    { echo -e "${GREEN}[MIGRATE]${NC} $*"; }
warn()  { echo -e "${YELLOW}[MIGRATE]${NC} $*"; }
fail()  { echo -e "${RED}[MIGRATE]${NC} $*" >&2; }

# ─── Loader minimal (Caminho C) ─────────────────────
# Robusto contra valores com <, >, espaços, multi-line no .env.
# Padrão validado em scripts/jobs/run_sql_job.sh / scripts/backup-postgres.sh.
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

# ─── Flags ─────────────────────────────────────────

DRY_RUN=false
VERBOSE=false
BOOTSTRAP=false
TARGET=""

usage() {
  echo "Uso: $0 [opções]"
  echo ""
  echo "Opções:"
  echo "  --dry-run     Mostra migrações pendentes sem executar"
  echo "  --status      Alias de --dry-run"
  echo "  --verbose     Mostra SQL de cada migração"
  echo "  --target NNN  Executa até a migração NNN (ex: 002)"
  echo "  --bootstrap   Registra migrations existentes como aplicadas SEM rodar"
  echo "                (one-shot retroativo pra ambientes pré-runner; idempotente)"
  echo "  --help        Mostra esta ajuda"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)    DRY_RUN=true; shift ;;
    --verbose)    VERBOSE=true; shift ;;
    --target)     TARGET="$2"; shift 2 ;;
    --status)     DRY_RUN=true; shift ;;
    --bootstrap)  BOOTSTRAP=true; shift ;;
    --help|-h)    usage ;;
    *)            fail "Opção desconhecida: $1"; exit 1 ;;
  esac
done

# ─── Carregar apenas POSTGRES_CONTAINER do .env ─────
# DB user e DB name hardcoded (mesmo padrão de backup-postgres.sh):
# user 'axis' SUPERUSER no container bypassa RLS pra DDL/DML migrations.

# Respeitar env var pré-setada (override inline) ANTES de tentar .env.
# Permite: DATABASE_NAME=axis_tcc_staging bash scripts/migrate.sh --bootstrap
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-$(load_env_var POSTGRES_CONTAINER)}"
[ -z "$POSTGRES_CONTAINER" ] && POSTGRES_CONTAINER="axis-postgres"

DATABASE_NAME="${DATABASE_NAME:-$(load_env_var DATABASE_NAME)}"
[ -z "$DATABASE_NAME" ] && DATABASE_NAME="axis_tcc"

# DB_USER hardcoded: 'axis' SUPERUSER no container, bypassa RLS pra DDL/DML
DB_USER="axis"

# ─── Validar Docker disponível ─────────────────────

if ! command -v docker > /dev/null 2>&1; then
  fail "docker não encontrado no PATH"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
  fail "Container '${POSTGRES_CONTAINER}' não está rodando"
  fail "docker ps --format '{{.Names}}':"
  docker ps --format '{{.Names}}' | head -10
  exit 1
fi

# ─── Helpers psql via docker exec ──────────────────

psql_cmd() {
  docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DATABASE_NAME" \
    --no-psqlrc -v ON_ERROR_STOP=1 -q "$@"
}

psql_query() {
  docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DATABASE_NAME" \
    --no-psqlrc -t -A "$@"
}

# ─── Verificar conexão ────────────────────────────

log "Conectando via docker exec a ${POSTGRES_CONTAINER} (db=${DATABASE_NAME}, user=${DB_USER})..."
if ! psql_query -c "SELECT 1" > /dev/null 2>&1; then
  fail "Não foi possível conectar ao PostgreSQL via docker exec"
  fail "Container: ${POSTGRES_CONTAINER}"
  exit 1
fi
ok "Conexão OK"

# ─── Criar/atualizar tabela de controle (idempotente) ─

psql_cmd <<'SQL'
CREATE TABLE IF NOT EXISTS _migrations (
  id          SERIAL PRIMARY KEY,
  version     VARCHAR(10) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  filename    VARCHAR(255) NOT NULL,
  checksum    VARCHAR(64) NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  applied_by  VARCHAR(64) NULL DEFAULT NULL
);

-- Item 22: applied_by adicionado retroativamente. ALTER idempotente.
ALTER TABLE _migrations ADD COLUMN IF NOT EXISTS applied_by VARCHAR(64) NULL DEFAULT NULL;

COMMENT ON TABLE _migrations IS 'Controle de migrações SQL — AXIS. NÃO editar manualmente.';
COMMENT ON COLUMN _migrations.applied_by IS 'Quem rodou a migration ($USER ou manual-pre-bootstrap). NULL = pré-runner.';
SQL

# ─── Descobrir migrações disponíveis ──────────────

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  fail "Diretório de migrações não encontrado: $MIGRATIONS_DIR"
  exit 1
fi

mapfile -t MIGRATION_FILES < <(
  find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" -type f | sort
)

if [[ ${#MIGRATION_FILES[@]} -eq 0 ]]; then
  warn "Nenhuma migração encontrada em $MIGRATIONS_DIR"
  exit 0
fi

log "Encontradas ${#MIGRATION_FILES[@]} migração(ões) no diretório"

# ═════════════════════════════════════════════════════
# Modo BOOTSTRAP — registrar migrations existentes SEM rodar
# ═════════════════════════════════════════════════════

if $BOOTSTRAP; then
  log "Modo BOOTSTRAP: registrando migrations existentes sem executar"
  log "Data fictícia: applied_at='2026-04-30 00:00:00' (origem retroativa)"
  log "applied_by='manual-pre-bootstrap'"

  REGISTERED=0
  SKIPPED=0

  for file in "${MIGRATION_FILES[@]}"; do
    filename="$(basename "$file")"
    version="${filename%%_*}"
    name="${filename#*_}"
    name="${name%.sql}"

    if [[ ! "$version" =~ ^[0-9]{3}$ ]]; then
      warn "Pulando arquivo com formato inválido: $filename"
      continue
    fi

    checksum="$(sha256sum "$file" | awk '{print $1}')"

    # Idempotente: ON CONFLICT (version) DO NOTHING
    inserted="$(psql_query -c "
      INSERT INTO _migrations (version, name, filename, checksum, applied_at, duration_ms, applied_by)
      VALUES ('$version', '$name', '$filename', '$checksum', '2026-04-30 00:00:00', NULL, 'manual-pre-bootstrap')
      ON CONFLICT (version) DO NOTHING
      RETURNING version
    ")"

    if [[ -n "$inserted" ]]; then
      log "  ✓ Bootstrapped: $filename (version=$version)"
      REGISTERED=$((REGISTERED + 1))
    else
      if $VERBOSE; then
        log "  ⏭ Já registrado: $filename"
      fi
      SKIPPED=$((SKIPPED + 1))
    fi
  done

  TOTAL="$(psql_query -c "SELECT COUNT(*) FROM _migrations")"
  echo ""
  log "═══════════════════════════════════════"
  ok "  Bootstrap concluído"
  log "  Registradas:    $REGISTERED"
  log "  Já existiam:    $SKIPPED"
  log "  Total na tabela: $TOTAL"
  log "═══════════════════════════════════════"
  exit 0
fi

# ═════════════════════════════════════════════════════
# Modo NORMAL — aplicar migrations pendentes
# ═════════════════════════════════════════════════════

APPLIED=0
SKIPPED=0
FAILED=0

# Quem está rodando (pra applied_by)
RUNNER="${USER:-${USERNAME:-runner}}"

for file in "${MIGRATION_FILES[@]}"; do
  filename="$(basename "$file")"

  version="${filename%%_*}"
  name="${filename#*_}"
  name="${name%.sql}"

  if [[ ! "$version" =~ ^[0-9]{3}$ ]]; then
    warn "Arquivo ignorado (formato inválido): $filename — esperado NNN_nome.sql"
    continue
  fi

  if [[ -n "$TARGET" ]] && [[ "$version" > "$TARGET" ]]; then
    log "Target $TARGET atingido, parando."
    break
  fi

  checksum="$(sha256sum "$file" | awk '{print $1}')"

  existing="$(psql_query -c "SELECT checksum FROM _migrations WHERE version = '$version'" 2>/dev/null || true)"

  if [[ -n "$existing" ]]; then
    if [[ "$existing" == "$checksum" ]]; then
      if $VERBOSE; then
        log "  ⏭ $filename (já aplicada)"
      fi
      SKIPPED=$((SKIPPED + 1))
      continue
    else
      fail "CONFLITO: $filename — checksum diferente do registrado!"
      fail "  Registrado: $existing"
      fail "  Atual:      $checksum"
      fail "  Migrações aplicadas NÃO devem ser editadas."
      fail "  Crie uma nova migração para corrigir."
      exit 1
    fi
  fi

  if $DRY_RUN; then
    warn "  ⏳ PENDENTE: $filename"
    if $VERBOSE; then
      echo "--- SQL ---"
      cat "$file"
      echo "--- FIM ---"
    fi
    APPLIED=$((APPLIED + 1))
    continue
  fi

  log "  ▶ Aplicando: $filename ..."
  start_ms="$(date +%s%N)"

  if psql_cmd -f - < "$file" 2>&1; then
    end_ms="$(date +%s%N)"
    duration_ms=$(( (end_ms - start_ms) / 1000000 ))

    psql_cmd -c "
      INSERT INTO _migrations (version, name, filename, checksum, duration_ms, applied_by)
      VALUES ('$version', '$name', '$filename', '$checksum', $duration_ms, '$RUNNER')
    "

    ok "  ✓ $filename (${duration_ms}ms, by $RUNNER)"
    APPLIED=$((APPLIED + 1))
  else
    fail "  ✗ FALHA ao aplicar: $filename"
    fail "  Abortando. Corrija o SQL e execute novamente."
    FAILED=$((FAILED + 1))
    exit 1
  fi
done

# ─── Resumo ──────────────────────────────────────

echo ""
log "═══════════════════════════════════════"
if $DRY_RUN; then
  log "  Modo: DRY-RUN (nada foi executado)"
  log "  Pendentes:    $APPLIED"
  log "  Já aplicadas: $SKIPPED"
else
  log "  Aplicadas:    $APPLIED"
  log "  Já aplicadas: $SKIPPED"
  log "  Falhas:       $FAILED"
fi
log "═══════════════════════════════════════"

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
