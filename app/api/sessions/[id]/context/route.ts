import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * GET /api/sessions/[id]/context
 *
 * Retorna contexto clínico da sessão anterior do mesmo paciente:
 * - Último CSO (4 dimensões + flex_trend)
 * - Headline do relatório anterior
 * - Número e data da sessão anterior
 *
 * Se não houver sessão anterior → retorna fallbacks.
 * Padrão: withTenant (RLS compliance)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      // 1. Buscar sessão atual para pegar patient_id e session_number
      const sessionResult = await client.query(
        `SELECT id, patient_id, session_number
         FROM sessions
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      )

      if (sessionResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
      }

      const { patient_id, session_number } = sessionResult.rows[0]

      // 2. Buscar sessão anterior (finalizada, do mesmo paciente, session_number menor)
      const prevSessionResult = await client.query(
        `SELECT s.id, s.session_number, s.scheduled_at, s.cso_id
         FROM sessions s
         WHERE s.patient_id = $1
           AND s.tenant_id = $2
           AND s.session_number < $3
           AND s.status = 'finalizada'
         ORDER BY s.session_number DESC
         LIMIT 1`,
        [patient_id, tenantId, session_number]
      )

      // Sem sessão anterior → fallbacks
      if (prevSessionResult.rows.length === 0) {
        return NextResponse.json({
          context: {
            has_previous: false,
            previous_session: null,
            cso: null,
            headline: null,
          }
        })
      }

      const prevSession = prevSessionResult.rows[0]

      // 3. Buscar CSO da sessão anterior (se tiver cso_id)
      let cso = null
      if (prevSession.cso_id) {
        const csoResult = await client.query(
          `SELECT activation_level, cognitive_rigidity, emotional_load,
                  task_adherence, engagement_trend, clinical_phase
           FROM clinical_states
           WHERE id = $1 AND tenant_id = $2`,
          [prevSession.cso_id, tenantId]
        )
        if (csoResult.rows.length > 0) {
          const row = csoResult.rows[0]
          cso = {
            activation_level: row.activation_level,
            cognitive_rigidity: row.cognitive_rigidity,
            emotional_load: row.emotional_load,
            task_adherence: row.task_adherence,
            flex_trend: row.engagement_trend || null,
            clinical_phase: row.clinical_phase || null,
          }
        }
      }

      // 4. Buscar headline do relatório da sessão anterior
      let headline = null
      const reportResult = await client.query(
        `SELECT headline
         FROM session_reports
         WHERE session_id = $1 AND tenant_id = $2`,
        [prevSession.id, tenantId]
      )
      if (reportResult.rows.length > 0) {
        headline = reportResult.rows[0].headline || null
      }

      return NextResponse.json({
        context: {
          has_previous: true,
          previous_session: {
            id: prevSession.id,
            session_number: prevSession.session_number,
            scheduled_at: prevSession.scheduled_at,
          },
          cso,
          headline,
        }
      })
    })

    return result
  } catch (error: any) {
    console.error('[SESSION-CONTEXT] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
