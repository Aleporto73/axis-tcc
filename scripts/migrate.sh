#!/usr/bin/env bash
# =====================================================
# AXIS ABA — Migration Runner
# Executa migrações SQL pendentes em ordem sequencial.
# Cada migração roda dentro de uma transação.
# Idempotente: migrações já aplicadas são ignoradas.
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

# ─── Flags ─────────────────────────────────────────

DRY_RUN=false
VERBOSE=false
TARGET=""

usage() {
  echo "Uso: $0 [opções]"
  echo ""
  echo "Opções:"
  echo "  --dry-run     Mostra migrações pendentes sem executar"
  echo "  --verbose     Mostra SQL de cada migração"
  echo "  --target NNN  Executa até a migração NNN (ex: 002)"
  echo "  --status      Mostra status de todas as migrações"
  echo "  --help        Mostra esta ajuda"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=true; shift ;;
    --verbose)  VERBOSE=true; shift ;;
    --target)   TARGET="$2"; shift 2 ;;
    --status)   DRY_RUN=true; shift ;;
    --help|-h)  usage ;;
    *)          fail "Opção desconhecida: $1"; exit 1 ;;
  esac
done

# ─── Carregar variáveis de ambiente ────────────────

if [[ -f "$ENV_FILE" ]]; then
  source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | sed 's/\r$//')
  log "Variáveis carregadas de .env"
else
  warn ".env não encontrado, usando variáveis de ambiente do sistema"
fi

# ─── Construir connection string ───────────────────

DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USER:-axis}"
DB_PASS="${DATABASE_PASSWORD:-}"
DB_NAME="${DATABASE_NAME:-axis_tcc}"

export PGPASSWORD="$DB_PASS"

psql_cmd() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-psqlrc -v ON_ERROR_STOP=1 -q "$@"
}

psql_query() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-psqlrc -t -A "$@"
}

# ─── Verificar conexão ────────────────────────────

log "Conectando a ${DB_HOST}:${DB_PORT}/${DB_NAME} como ${DB_USER}..."
if ! psql_query -c "SELECT 1" > /dev/null 2>&1; then
  fail "Não foi possível conectar ao PostgreSQL"
  fail "Verifique DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD e DATABASE_NAME no .env"
  exit 1
fi
ok "Conexão OK"

# ─── Criar tabela de controle (idempotente) ───────

psql_cmd <<'SQL'
CREATE TABLE IF NOT EXISTS _migrations (
  id          SERIAL PRIMARY KEY,
  version     VARCHAR(10) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  filename    VARCHAR(255) NOT NULL,
  checksum    VARCHAR(64) NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER
);

COMMENT ON TABLE _migrations IS 'Controle de migrações SQL — AXIS ABA. NÃO editar manualmente.';
SQL

# ─── Descobrir migrações disponíveis ──────────────

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  fail "Diretório de migrações não encontrado: $MIGRATIONS_DIR"
  exit 1
fi

# Listar arquivos .sql ordenados por nome (001_, 002_, ...)
mapfile -t MIGRATION_FILES < <(
  find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" -type f | sort
)

if [[ ${#MIGRATION_FILES[@]} -eq 0 ]]; then
  warn "Nenhuma migração encontrada em $MIGRATIONS_DIR"
  exit 0
fi

log "Encontradas ${#MIGRATION_FILES[@]} migração(ões) no diretório"

# ─── Processar migrações ─────────────────────────

APPLIED=0
SKIPPED=0
FAILED=0

for file in "${MIGRATION_FILES[@]}"; do
  filename="$(basename "$file")"

  # Extrair versão (3 primeiros dígitos) e nome
  version="${filename%%_*}"
  name="${filename#*_}"
  name="${name%.sql}"

  # Validar formato do arquivo
  if [[ ! "$version" =~ ^[0-9]{3}$ ]]; then
    warn "Arquivo ignorado (formato inválido): $filename — esperado NNN_nome.sql"
    continue
  fi

  # Verificar target
  if [[ -n "$TARGET" ]] && [[ "$version" > "$TARGET" ]]; then
    log "Target $TARGET atingido, parando."
    break
  fi

  # Calcular checksum
  checksum="$(sha256sum "$file" | awk '{print $1}')"

  # Verificar se já foi aplicada
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

  # Migração pendente
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

  # Executar migração dentro de transação
  log "  ▶ Aplicando: $filename ..."
  start_ms="$(date +%s%N)"

  if psql_cmd -f "$file" 2>&1; then
    end_ms="$(date +%s%N)"
    duration_ms=$(( (end_ms - start_ms) / 1000000 ))

    # Registrar na tabela de controle
    psql_cmd -c "
      INSERT INTO _migrations (version, name, filename, checksum, duration_ms)
      VALUES ('$version', '$name', '$filename', '$checksum', $duration_ms)
    "

    ok "  ✓ $filename (${duration_ms}ms)"
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
  log "  Pendentes:  $APPLIED"
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
