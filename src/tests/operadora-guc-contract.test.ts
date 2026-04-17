/**
 * Teste de contrato GUC — AXIS Operadora v2.7.0
 *
 * Bug capturado em produção 16/04/2026:
 *   service_sites e as 4 tabelas de presence (session_presence_proofs,
 *   session_attestations, session_evidence_bundles, session_attachments)
 *   tinham policies RLS que liam current_setting('app.current_org')::uuid,
 *   mas withTenant() (src/database/with-tenant.ts) seta 'app.tenant_id'.
 *   Resultado: SQLSTATE 42704 em toda request que tocasse essas tabelas.
 *
 * Este teste previne regressão validando (via parse estático):
 *   1. O GUC setado em with-tenant.ts é 'app.tenant_id'.
 *   2. Nenhuma migration em scripts/migrations/ usa o GUC banido
 *      'app.current_org'.
 *   3. Toda current_setting('app.*') em migrations referencia apenas
 *      GUCs permitidos (tenant_id, is_worker, worker_mode).
 *
 * Convenção: só adicionar novo GUC aqui depois de alinhar com
 * with-tenant.ts ou com o worker que seta o GUC correspondente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const REPO_ROOT = join(__dirname, '..', '..')
const MIGRATIONS_DIR = join(REPO_ROOT, 'scripts', 'migrations')
const WITH_TENANT_FILE = join(REPO_ROOT, 'src', 'database', 'with-tenant.ts')

// GUCs permitidos em policies RLS (setados em algum lugar do backend):
//   - 'app.tenant_id'   → setado por withTenant() (isolamento multi-tenant)
//   - 'app.is_worker'   → setado por jobs async (ex: transcription-worker)
//   - 'app.worker_mode' → idem (padrão alternativo em migration 050)
const ALLOWED_GUCS = new Set(['app.tenant_id', 'app.is_worker', 'app.worker_mode'])

// GUCs explicitamente banidos (bug histórico — nunca foram setados pelo backend):
const BANNED_GUCS = new Set(['app.current_org'])

function readMigrationFiles(): { file: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      file: f,
      sql: readFileSync(join(MIGRATIONS_DIR, f), 'utf-8'),
    }))
}

/**
 * Extrai todas as chamadas a current_setting('app.*') em um SQL,
 * ignorando as que estão em linhas de comentário (prefixadas por `--`).
 */
function extractCurrentSettingUsages(sql: string): Array<{ guc: string; missingOk: boolean }> {
  const usages: Array<{ guc: string; missingOk: boolean }> = []
  const regex = /current_setting\s*\(\s*'(app\.[a-z_]+)'\s*(?:,\s*(true|false))?\s*\)/gi

  for (const rawLine of sql.split('\n')) {
    // Ignora linhas que são 100% comentário SQL
    if (rawLine.trim().startsWith('--')) continue
    let m: RegExpExecArray | null
    const lineRegex = new RegExp(regex.source, regex.flags)
    while ((m = lineRegex.exec(rawLine)) !== null) {
      usages.push({ guc: m[1], missingOk: m[2] === 'true' })
    }
  }
  return usages
}

describe('Contrato GUC — Operadora v2.7.0', () => {
  it('withTenant() seta exatamente "app.tenant_id"', () => {
    const src = readFileSync(WITH_TENANT_FILE, 'utf-8')
    const match = src.match(/set_config\s*\(\s*'(app\.[a-z_]+)'/)
    expect(match, 'withTenant() não chama set_config com GUC app.*').not.toBeNull()
    expect(match![1]).toBe('app.tenant_id')
  })

  it('Nenhuma migration usa GUC banido "app.current_org"', () => {
    const files = readMigrationFiles()
    const offenders: string[] = []
    for (const { file, sql } of files) {
      const usages = extractCurrentSettingUsages(sql)
      for (const u of usages) {
        if (BANNED_GUCS.has(u.guc)) {
          offenders.push(`${file} usa ${u.guc}`)
        }
      }
    }
    expect(
      offenders,
      `Migrations usando GUC banido:\n  ${offenders.join('\n  ')}\nConvenção: use 'app.tenant_id'.`
    ).toEqual([])
  })

  it('Toda current_setting("app.*") em migrations usa GUC permitido', () => {
    const files = readMigrationFiles()
    const offenders: string[] = []
    for (const { file, sql } of files) {
      const usages = extractCurrentSettingUsages(sql)
      for (const u of usages) {
        if (!ALLOWED_GUCS.has(u.guc)) {
          offenders.push(`${file}: ${u.guc}`)
        }
      }
    }
    expect(
      offenders,
      `Migrations com GUC não-permitido:\n  ${offenders.join('\n  ')}\nPermitidos: ${[...ALLOWED_GUCS].join(', ')}.`
    ).toEqual([])
  })

  it('As 5 tabelas v2.7.0 Operadora têm policy isolando por app.tenant_id', () => {
    const v27Tables = [
      'service_sites',
      'session_presence_proofs',
      'session_attestations',
      'session_evidence_bundles',
      'session_attachments',
    ]

    const combined = readMigrationFiles()
      .map((f) => f.sql)
      .join('\n')

    for (const table of v27Tables) {
      const policyRegex = new RegExp(
        `CREATE POLICY\\s+\\w+\\s+ON\\s+${table}[\\s\\S]*?current_setting\\s*\\(\\s*'(app\\.[a-z_]+)'`,
        'gi'
      )
      const matches = [...combined.matchAll(policyRegex)]
      expect(matches.length, `Nenhuma policy encontrada para ${table}`).toBeGreaterThan(0)

      // Todas as occurrences (incluindo a da migration 052 de fix) devem usar app.tenant_id
      // — depois de aplicar o fix, não pode sobrar nenhuma com app.current_org.
      for (const m of matches) {
        expect(
          m[1],
          `Policy em ${table} usa GUC errado: ${m[1]} (esperado app.tenant_id)`
        ).toBe('app.tenant_id')
      }
    }
  })
})
