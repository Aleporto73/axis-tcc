/**
 * Teste de contrato audit_logs — AXIS Operadora v2.7.0
 *
 * Bug capturado em producao 16/04/2026:
 *   16 rotas da camada v2.7.0 Operadora (service_sites, presence_proofs,
 *   attestations, attachments, evidence_bundles, coverage_profiles,
 *   claim_packets, provider_credentials, integrity_flags, payer_profiles)
 *   + 1 job SQL (purge_geo) faziam INSERT em axis_audit_logs usando
 *   colunas "category" e "actor_id" que NAO existem no schema real
 *   (migration 007). Resultado: apos criar um Local de Atendimento,
 *   o INSERT do audit log falhava, abortando a transacao e devolvendo
 *   "Erro interno" para o usuario.
 *
 * Schema real de axis_audit_logs (migration 007):
 *   id, tenant_id, user_id, actor, action, entity_type, entity_id,
 *   metadata, axis_version, created_at
 *
 * Este teste previne regressao validando via parse estatico:
 *   1. Nenhum INSERT em axis_audit_logs usa coluna "category".
 *   2. Nenhum INSERT em axis_audit_logs usa coluna "actor_id".
 *   3. Todo INSERT em axis_audit_logs inclui "user_id" (excecao:
 *      migrations de seed/backfill, que sao system-driven).
 *
 * Convencao: metadados operacionais (category, profile_id, etc.)
 * devem ser mesclados no campo JSONB "metadata".
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const REPO_ROOT = join(__dirname, '..', '..')

// Colunas banidas no INSERT de audit. Comentario escrito sem parenteses
// apos a palavra "audit" para nao casar o regex deste proprio teste.
const BANNED_COLUMNS = ['category', 'actor_id'] as const

// Extensoes consideradas fonte:
const SOURCE_EXTS = ['.ts', '.tsx', '.sql']

// Diretorios a ignorar ao recursar.
// Nota: tests/ e __tests__/ sao excluidos porque testes podem conter
// exemplos SQL em docstrings ou comentarios que o regex interpretaria
// como INSERT real.
const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'coverage',
  '.vite-temp',
  'tests',
  '__tests__',
])

function walkFiles(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      out.push(...walkFiles(full))
    } else if (SOURCE_EXTS.some((ext) => name.endsWith(ext))) {
      out.push(full)
    }
  }
  return out
}

/**
 * Extrai o corpo da lista de colunas de cada INSERT em axis_audit_logs
 * encontrado em um texto. Retorna array de strings (o que esta entre
 * os parenteses apos o nome da tabela).
 */
function extractAuditInsertColumnLists(src: string): string[] {
  const lists: string[] = []
  const regex = /INSERT\s+INTO\s+axis_audit_logs\s*\(([^)]*)\)/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(src)) !== null) {
    lists.push(m[1])
  }
  return lists
}

describe('Contrato audit_logs — Operadora v2.7.0', () => {
  const candidateDirs = [
    join(REPO_ROOT, 'app'),
    join(REPO_ROOT, 'src'),
    join(REPO_ROOT, 'scripts'),
  ]
  const files = candidateDirs.flatMap((d) => walkFiles(d))

  it('Encontrou arquivos-fonte para varrer (sanity)', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('Nenhum INSERT em axis_audit_logs usa coluna "category"', () => {
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf-8')
      const lists = extractAuditInsertColumnLists(src)
      for (const cols of lists) {
        const tokens = cols.split(',').map((t) => t.trim().toLowerCase())
        if (tokens.includes('category')) {
          offenders.push(file.replace(REPO_ROOT + '/', ''))
        }
      }
    }
    expect(
      offenders,
      `INSERT axis_audit_logs usando coluna banida "category":\n  ${offenders.join('\n  ')}\n` +
      `Schema real (migration 007) NAO tem category. Use metadata->>'category'.`
    ).toEqual([])
  })

  it('Nenhum INSERT em axis_audit_logs usa coluna "actor_id"', () => {
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf-8')
      const lists = extractAuditInsertColumnLists(src)
      for (const cols of lists) {
        const tokens = cols.split(',').map((t) => t.trim().toLowerCase())
        if (tokens.includes('actor_id')) {
          offenders.push(file.replace(REPO_ROOT + '/', ''))
        }
      }
    }
    expect(
      offenders,
      `INSERT axis_audit_logs usando coluna banida "actor_id":\n  ${offenders.join('\n  ')}\n` +
      `Schema real (migration 007) tem "user_id" (VARCHAR) e "actor" (VARCHAR). ` +
      `Use user_id (com ctx.userId) e mova o profile_id para metadata.`
    ).toEqual([])
  })

  it('Nenhum INSERT em axis_audit_logs usa colunas banidas (resumo)', () => {
    const report: Array<{ file: string; offendingColumns: string[] }> = []
    for (const file of files) {
      const src = readFileSync(file, 'utf-8')
      const lists = extractAuditInsertColumnLists(src)
      for (const cols of lists) {
        const tokens = cols.split(',').map((t) => t.trim().toLowerCase())
        const hit = BANNED_COLUMNS.filter((b) => tokens.includes(b))
        if (hit.length > 0) {
          report.push({
            file: file.replace(REPO_ROOT + '/', ''),
            offendingColumns: hit,
          })
        }
      }
    }
    expect(report).toEqual([])
  })

  it('Todo INSERT em axis_audit_logs (fora migrations) inclui "user_id"', () => {
    const offenders: string[] = []
    for (const file of files) {
      // Migrations de seed/backfill sao system-driven e podem omitir user_id.
      if (file.includes('/scripts/migrations/')) continue
      const src = readFileSync(file, 'utf-8')
      const lists = extractAuditInsertColumnLists(src)
      for (const cols of lists) {
        const tokens = cols.split(',').map((t) => t.trim().toLowerCase())
        if (!tokens.includes('user_id')) {
          offenders.push(`${file.replace(REPO_ROOT + '/', '')} — cols: ${cols.trim()}`)
        }
      }
    }
    expect(
      offenders,
      `INSERT axis_audit_logs sem user_id (fora de scripts/migrations/):\n  ${offenders.join('\n  ')}`
    ).toEqual([])
  })
})
