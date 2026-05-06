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
    // HUB-09 (Onda 10): excluir 000_shared_baseline.sql do contrato GUC.
    // Baseline é snapshot histórico do schema prod (pg_dump --schema-only),
    // contém GUCs antigos (app.user_id, app.user_role, app.engine_version)
    // de policies/functions legacy ainda no schema mas NÃO usados pelo
    // backend moderno. Contrato GUC v2.7.0 aplica-se a migrations 057+
    // (RLS Phase A em diante) e a qualquer migration nova após o baseline.
    // legacy/ já é ignorado naturalmente (readdirSync não-recursivo).
    .filter((f) => f !== '000_shared_baseline.sql')
    .sort()
    .map((f) => ({
      file: f,
      sql: readFileSync(join(MIGRATIONS_DIR, f), 'utf-8'),
    }))
}

/**
 * Variante de readMigrationFiles() que INCLUI 000_shared_baseline.sql.
 *
 * Justificativa (HUB-09 Onda 10):
 *   readMigrationFiles() exclui o baseline porque sub-tests 2 e 3 verificam
 *   contrato sobre migrations NOVAS (não devem usar GUCs banidos/legacy).
 *   Sub-test 4, ao contrário, verifica ESTADO DECLARATIVO do schema vivo
 *   (essas 5 tabelas v2.7.0 Operadora têm policy app.tenant_id?). Após o
 *   move de 001-066 → legacy/, as policies originais (migrations 033/034/052)
 *   só permanecem visíveis ao parser via baseline (snapshot do schema prod).
 *   Excluí-lo do sub-test 4 quebraria a defesa-em-profundidade declarativa.
 *
 * Convenção: usar readMigrationFiles() para checagens de contrato sobre
 * migrations recentes; usar esta variante apenas quando precisar do
 * estado-de-schema-completo (incluindo o snapshot baseline).
 */
function readMigrationFilesIncludingBaseline(): { file: string; sql: string }[] {
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

    // HUB-09 (Onda 10): inclui baseline porque após move 001-066 → legacy/,
    // as policies originais ficam só no baseline (snapshot do schema vivo).
    const combined = readMigrationFilesIncludingBaseline()
      .map((f) => f.sql)
      .join('\n')

    for (const table of v27Tables) {
      // HUB-09 (Onda 10): regex flexibilizado para casar com baseline pos-pg_dump.
      // Baseline tem 2 diferenças vs migrations originais (033/034/052):
      //   1) Schema-qualified names: ON public.${table} (não ON ${table}).
      //   2) Função app_tenant_id() em vez de current_setting('app.X') direto.
      //      A função wrappia current_setting('app.tenant_id') (ver migration 058).
      // Aceita ambos os caminhos: function moderna (m[1] = undefined) ou
      // current_setting() legacy (m[1] = GUC name, deve ser 'app.tenant_id').
      const policyRegex = new RegExp(
        `CREATE POLICY\\s+\\w+\\s+ON\\s+(?:public\\.)?${table}\\b[\\s\\S]*?` +
          `(?:(?:public\\.)?app_tenant_id\\s*\\(\\s*\\)|` +
          `current_setting\\s*\\(\\s*'(app\\.[a-z_]+)'\\s*\\))`,
        'gi'
      )
      const matches = [...combined.matchAll(policyRegex)]
      expect(matches.length, `Nenhuma policy encontrada para ${table}`).toBeGreaterThan(0)

      // Caminho legacy current_setting() — só aceita 'app.tenant_id'.
      // Caminho moderno app_tenant_id() — implicitamente OK (m[1] = undefined).
      for (const m of matches) {
        if (m[1] !== undefined) {
          expect(
            m[1],
            `Policy em ${table} usa GUC errado: ${m[1]} (esperado app.tenant_id)`
          ).toBe('app.tenant_id')
        }
      }
    }
  })
})
