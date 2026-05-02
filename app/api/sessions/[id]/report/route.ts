import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * GET /api/sessions/[id]/report
 * Busca relatorio clinico existente para a sessao.
 * Retorna { report: null } se nao existir (nao e erro).
 * Ref: AXIS TCC Sessao v2 - Fase 1
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      const sessionCheck = await client.query(
        'SELECT id FROM sessions WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )

      if (sessionCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      const reportResult = await client.query(
        `SELECT
          id, session_id, headline, objectives, summary,
          intervention, observations, closing, insights,
          status, generated_by, ai_model,
          created_at, updated_at, exported_at, export_count
        FROM session_reports
        WHERE session_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      )

      if (reportResult.rows.length === 0) {
        return NextResponse.json({ report: null })
      }

      return NextResponse.json({ report: reportResult.rows[0] })
    })

    return result
  } catch (error) {
    console.error('Erro ao buscar relatorio:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * PUT /api/sessions/[id]/report
 * Salva edicoes do profissional no relatorio.
 * Aceita campos parciais (nao precisa enviar todos).
 * Faz UPSERT: INSERT se nao existe, UPDATE se existe.
 * Ref: AXIS TCC Sessao v2 - Fase 1
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      const sessionCheck = await client.query(
        'SELECT id FROM sessions WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )

      if (sessionCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      const allowedFields = [
        'headline', 'objectives', 'summary', 'intervention',
        'observations', 'closing', 'status', 'insights'
      ]

      const updates: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field]
        }
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Nenhum campo valido para atualizar' }, { status: 400 })
      }

      const existing = await client.query(
        'SELECT id FROM session_reports WHERE session_id = $1 AND tenant_id = $2',
        [id, tenantId]
      )

      let report

      if (existing.rows.length > 0) {
        const setClauses: string[] = []
        const values: unknown[] = []
        let paramIndex = 1

        for (const [field, value] of Object.entries(updates)) {
          if (field === 'insights') {
            setClauses.push(`${field} = $${paramIndex}::jsonb`)
            values.push(JSON.stringify(value))
          } else {
            setClauses.push(`${field} = $${paramIndex}`)
            values.push(value)
          }
          paramIndex++
        }

        setClauses.push('updated_at = NOW()')
        values.push(id, tenantId)

        const updateResult = await client.query(
          `UPDATE session_reports
           SET ${setClauses.join(', ')}
           WHERE session_id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
           RETURNING id, session_id, headline, objectives, summary,
                     intervention, observations, closing, insights,
                     status, generated_by, ai_model,
                     created_at, updated_at, exported_at, export_count`,
          values
        )

        report = updateResult.rows[0]
      } else {
        const fields = ['session_id', 'tenant_id', ...Object.keys(updates), 'generated_by']
        const values: unknown[] = [id, tenantId]
        const placeholders: string[] = ['$1', '$2']
        let paramIndex = 3

        for (const [field, value] of Object.entries(updates)) {
          if (field === 'insights') {
            placeholders.push(`$${paramIndex}::jsonb`)
            values.push(JSON.stringify(value))
          } else {
            placeholders.push(`$${paramIndex}`)
            values.push(value)
          }
          paramIndex++
        }

        placeholders.push(`$${paramIndex}`)
        values.push('manual')

        const insertResult = await client.query(
          `INSERT INTO session_reports (${fields.join(', ')})
           VALUES (${placeholders.join(', ')})
           RETURNING id, session_id, headline, objectives, summary,
                     intervention, observations, closing, insights,
                     status, generated_by, ai_model,
                     created_at, updated_at, exported_at, export_count`,
          values
        )

        report = insertResult.rows[0]
      }

      return NextResponse.json({ report })
    })

    return result
  } catch (error) {
    console.error('Erro ao salvar relatorio:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
