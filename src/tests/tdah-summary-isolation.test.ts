import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = join(__dirname, '../..')

const migration = readFileSync(
  join(root, 'scripts/migrations/080_tdah_session_summaries.sql'),
  'utf-8'
)
const summaryRoute = readFileSync(
  join(root, 'app/api/tdah/sessions/[id]/summary/route.ts'),
  'utf-8'
)
const familiaRoute = readFileSync(
  join(root, 'app/api/familia/[token]/route.ts'),
  'utf-8'
)
const lgpdExportRoute = readFileSync(
  join(root, 'app/api/tdah/lgpd/export/route.ts'),
  'utf-8'
)
const lgpdDeleteRoute = readFileSync(
  join(root, 'app/api/tdah/lgpd/delete/route.ts'),
  'utf-8'
)

const sharedSummaryOperation = /\b(?:FROM|UPDATE|INTO)\s+(?:public\.)?session_summaries\b/i

describe('TDAH session summaries isolation contract', () => {
  it('creates an exclusive TDAH table without ABA subject columns', () => {
    expect(migration).toContain('CREATE TABLE public.tdah_session_summaries')
    expect(migration).toContain('UNIQUE (tenant_id, id)')
    expect(migration).toContain('FOREIGN KEY (tenant_id, session_id)')
    expect(migration).toContain('REFERENCES public.tdah_sessions(tenant_id, id)')
    expect(migration).not.toMatch(
      /session_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.tdah_sessions\s*\(\s*id\s*\)/i
    )
    expect(migration).not.toMatch(/\blearner_id\b/i)
    expect(migration).not.toMatch(/\bpatient_id\b/i)
    expect(migration).not.toMatch(/\bsource_module\b/i)
    expect(migration).not.toMatch(sharedSummaryOperation)
  })

  it('uses only tdah_session_summaries in the TDAH summary route', () => {
    expect(summaryRoute).toContain('tdah_session_summaries')
    expect(summaryRoute).not.toMatch(sharedSummaryOperation)
    expect(summaryRoute).not.toMatch(/\blearner_id\b/i)
    expect(summaryRoute).not.toMatch(/\bsource_module\b/i)
  })

  it('blocks accidental resend before changing an existing summary', () => {
    expect(summaryRoute).toMatch(/SELECT\s+id,\s*status,\s*sent_at[\s\S]*?FROM\s+tdah_session_summaries/i)
    expect(summaryRoute).toContain("existing.rows[0].status === 'sent'")
    expect(summaryRoute).toContain('existing.rows[0].sent_at')
    expect(summaryRoute).toContain('Este resumo já foi enviado. Nenhum novo envio foi realizado.')
    expect(summaryRoute).toContain('{ status: 409 }')
    expect(summaryRoute).not.toMatch(/sent_at\s*=\s*NULL/i)
  })

  it('binds PUT actions to summary, tenant, and URL session', () => {
    expect(summaryRoute).toMatch(
      /FROM\s+tdah_session_summaries\s+ss[\s\S]*?WHERE\s+ss\.id\s*=\s*\$1\s+AND\s+ss\.tenant_id\s*=\s*\$2\s+AND\s+ss\.session_id\s*=\s*\$3/i
    )
    expect(summaryRoute).toContain('[summary_id, tenantId, sessionId]')
  })

  it('resolves the portal patient through tdah_sessions', () => {
    expect(familiaRoute).toMatch(/FROM\s+tdah_session_summaries\s+ss/i)
    expect(familiaRoute).toMatch(/JOIN\s+tdah_sessions\s+s/i)
    expect(familiaRoute).toContain('s.patient_id = $1')
    expect(familiaRoute).not.toMatch(sharedSummaryOperation)
  })

  it('uses the exclusive table in TDAH LGPD export and anonymization', () => {
    expect(lgpdExportRoute).toContain('FROM tdah_session_summaries')
    expect(lgpdDeleteRoute).toContain('UPDATE tdah_session_summaries')
    expect(lgpdExportRoute).not.toMatch(sharedSummaryOperation)
    expect(lgpdDeleteRoute).not.toMatch(sharedSummaryOperation)
  })
})
