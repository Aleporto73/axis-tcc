/**
 * Teste de contrato SQL — AXIS TDAH
 *
 * Valida que as colunas referenciadas nas queries das APIs públicas
 * (portal família e portal escola) existem no schema real das migrations.
 *
 * Motivação: bug P0 detectado em auditoria 22/03/2026 — portal família
 * consultava `session_date` em `tdah_sessions`, mas schema define `scheduled_at`.
 *
 * Approach: parse estático das migrations para extrair colunas reais,
 * depois valida que as queries das rotas públicas só usam colunas existentes.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// =========================================================
// Helper: extrair colunas de um CREATE TABLE em SQL
// =========================================================
function extractColumns(sql: string, tableName: string): string[] {
  // Match CREATE TABLE ... ( ... )
  const regex = new RegExp(
    `CREATE TABLE[^(]*${tableName}\\s*\\(([^;]+?)\\)\\s*;`,
    'is'
  )
  const match = sql.match(regex)
  if (!match) return []

  const body = match[1]
  const columns: string[] = []

  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    // Skip constraints, indexes, comments, empty lines
    if (
      !trimmed ||
      trimmed.startsWith('--') ||
      trimmed.startsWith('PRIMARY') ||
      trimmed.startsWith('UNIQUE') ||
      trimmed.startsWith('FOREIGN') ||
      trimmed.startsWith('CHECK') ||
      trimmed.startsWith('CONSTRAINT') ||
      trimmed.startsWith('REFERENCES') ||
      trimmed.startsWith(')')
    ) continue

    // Extract column name (first word)
    const colMatch = trimmed.match(/^(\w+)\s+/)
    if (colMatch && !['IF', 'CREATE', 'NOT', 'EXISTS'].includes(colMatch[1].toUpperCase())) {
      columns.push(colMatch[1].toLowerCase())
    }
  }

  return columns
}

// =========================================================
// Helper: extrair colunas referenciadas em SELECT de uma query
// =========================================================
function extractSelectColumns(query: string): string[] {
  const cols: string[] = []

  // Match SELECT ... FROM
  const selectMatch = query.match(/SELECT\s+([\s\S]+?)\s+FROM/i)
  if (!selectMatch) return cols

  const selectPart = selectMatch[1]

  // Split by comma, handle aliases
  for (const expr of selectPart.split(',')) {
    const trimmed = expr.trim()

    // Skip aggregate functions but extract inner column
    // e.g. COUNT(*) FILTER (WHERE goal_met = true) -> goal_met
    // For now, extract simple column refs
    const simpleCol = trimmed.match(/^(\w+)\.(\w+)/)
    if (simpleCol) {
      cols.push(simpleCol[2].toLowerCase())
      continue
    }
    const bareCol = trimmed.match(/^(\w+)\s*$/)
    if (bareCol) {
      cols.push(bareCol[1].toLowerCase())
      continue
    }
    // Column with alias: col as alias
    const aliased = trimmed.match(/^(\w+)\s+as\s+/i)
    if (aliased) {
      cols.push(aliased[1].toLowerCase())
    }
  }

  return cols
}

// =========================================================
// Helper: extrair colunas do WHERE/ORDER BY
// =========================================================
function extractWhereOrderColumns(query: string, tableName: string): string[] {
  const cols: string[] = []
  // Simple extraction: find column references like `column_name =` or `column_name >=` etc.
  const whereMatch = query.match(/WHERE\s+([\s\S]+?)(?:ORDER|LIMIT|GROUP|$)/i)
  if (whereMatch) {
    const matches = whereMatch[1].matchAll(/(?:AND|OR|WHERE)?\s*(\w+)\s*(?:>=|<=|!=|=|>|<|IN|IS|NOT)/gi)
    for (const m of matches) {
      const col = m[1].toLowerCase()
      if (!['and', 'or', 'not', 'status', '$1', '$2', '$3'].includes(col)) {
        cols.push(col)
      }
    }
  }

  const orderMatch = query.match(/ORDER\s+BY\s+([\s\S]+?)(?:LIMIT|$)/i)
  if (orderMatch) {
    for (const part of orderMatch[1].split(',')) {
      const colMatch = part.trim().match(/^(\w+)/)
      if (colMatch) cols.push(colMatch[1].toLowerCase())
    }
  }

  return cols
}

// =========================================================
// Load schema from migrations
// =========================================================
const migrationsDir = join(__dirname, '../../scripts/migrations')

// HUB-09 (Onda 10): ler do baseline em vez de migration 022 diretamente.
// Migration 022 foi movida para scripts/migrations/legacy/ e o snapshot
// vivo do schema agora está em 000_shared_baseline.sql. Vantagens:
//   - Sempre reflete realidade prod (snapshot de pg_dump --schema-only).
//   - Auto-atualiza quando schema TDAH mudar via migration nova.
//   - Mesmo padrão arquitetural do sub-test 4 do operadora-guc-contract.
// Schema-prefix `public.` é compatível com extractColumns() existente.
const baselineSchema = readFileSync(
  join(migrationsDir, '000_shared_baseline.sql'), 'utf-8'
)

const tdahSessionsCols = extractColumns(baselineSchema, 'tdah_sessions')
const tdahProtocolsCols = extractColumns(baselineSchema, 'tdah_protocols')
const tdahDrcCols = extractColumns(baselineSchema, 'tdah_drc')

// =========================================================
// Load API route source files
// =========================================================
const apiDir = join(__dirname, '../../app/api')

const familiaRoute = readFileSync(
  join(apiDir, 'familia/[token]/route.ts'), 'utf-8'
)
const escolaRoute = readFileSync(
  join(apiDir, 'escola/[token]/route.ts'), 'utf-8'
)
const escolaDrcRoute = readFileSync(
  join(apiDir, 'escola/[token]/drc/route.ts'), 'utf-8'
)

// =========================================================
// Tests
// =========================================================

describe('TDAH Schema Contract — Portal Família', () => {
  it('should have extracted tdah_sessions columns from migration', () => {
    expect(tdahSessionsCols.length).toBeGreaterThan(5)
    expect(tdahSessionsCols).toContain('scheduled_at')
    expect(tdahSessionsCols).toContain('tenant_id')
    expect(tdahSessionsCols).toContain('patient_id')
  })

  it('should NOT reference session_date in tdah_sessions queries', () => {
    // Regex: find queries on tdah_sessions that use session_date
    const hasSessionDate = /tdah_sessions[\s\S]*?session_date/i.test(familiaRoute)
    expect(hasSessionDate).toBe(false)
  })

  it('should reference scheduled_at (not session_date) for upcoming sessions', () => {
    const upcomingQuery = familiaRoute.match(
      /Sessões futuras[\s\S]*?`([\s\S]*?)`/
    )
    expect(upcomingQuery).toBeTruthy()
    expect(upcomingQuery![1]).toContain('scheduled_at')
    expect(upcomingQuery![1]).not.toContain('session_date')
  })

  it('should reference scheduled_at (not session_date) for recent sessions', () => {
    const recentQuery = familiaRoute.match(
      /Sessões recentes[\s\S]*?`([\s\S]*?)`/
    )
    expect(recentQuery).toBeTruthy()
    expect(recentQuery![1]).toContain('scheduled_at')
    expect(recentQuery![1]).not.toContain('session_date')
  })

  it('tdah_sessions schema should NOT have session_date column', () => {
    expect(tdahSessionsCols).not.toContain('session_date')
  })
})

describe('TDAH Schema Contract — Portal Escola', () => {
  it('should have extracted tdah_drc columns from migration', () => {
    expect(tdahDrcCols.length).toBeGreaterThan(3)
    expect(tdahDrcCols).toContain('drc_date')
    expect(tdahDrcCols).toContain('patient_id')
  })

  it('should have extracted tdah_protocols columns from migration', () => {
    expect(tdahProtocolsCols.length).toBeGreaterThan(3)
    expect(tdahProtocolsCols).toContain('code')
    expect(tdahProtocolsCols).toContain('title')
  })

  it('escola route should NOT reference tdah_sessions columns incorrectly', () => {
    // Escola route queries tdah_drc and tdah_protocols, not tdah_sessions
    const hasTdahSessions = /FROM\s+tdah_sessions/i.test(escolaRoute)
    expect(hasTdahSessions).toBe(false)
  })

  it('escola DRC POST should use valid tdah_drc columns', () => {
    // Verify INSERT columns match schema
    const insertMatch = escolaDrcRoute.match(
      /INSERT INTO tdah_drc\s*\(([\s\S]*?)\)/i
    )
    expect(insertMatch).toBeTruthy()
    const insertCols = insertMatch![1]
      .split(',')
      .map(c => c.trim().toLowerCase())

    for (const col of insertCols) {
      expect(tdahDrcCols).toContain(col)
    }
  })
})
