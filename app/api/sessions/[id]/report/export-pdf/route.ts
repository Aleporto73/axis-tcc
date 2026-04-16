import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * POST /api/sessions/[id]/report/export-pdf
 * Retorna metadados da sessao/profissional para geracao de PDF client-side.
 * Atualiza exported_at e export_count.
 * PDF e gerado no frontend com jsPDF (mesmo padrao do relatorio longitudinal).
 * Ref: AXIS TCC Sessao v2 - Fase 5
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant<NextResponse>(async (ctx) => {
      const { client, tenantId, userId } = ctx

      // 1. Buscar sessao + paciente
      const sessionResult = await client.query(
        `SELECT s.id, s.session_number, s.session_type, s.scheduled_at,
                s.started_at, s.duration_minutes,
                p.full_name AS patient_name
         FROM sessions s
         JOIN patients p ON p.id = s.patient_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [id, tenantId]
      )

      if (sessionResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      const session = sessionResult.rows[0]

      // 2. Verificar que relatorio existe
      const reportCheck = await client.query(
        `SELECT id FROM session_reports WHERE session_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      )

      if (reportCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum relatorio encontrado para esta sessao' },
          { status: 400 }
        )
      }

      // 3. Buscar profissional (do perfil logado)
      const profileResult = await client.query(
        `SELECT name, crp, crp_uf FROM profiles
         WHERE clerk_user_id = $1 AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [userId, tenantId]
      )

      const professional = profileResult.rows[0] || { name: 'Profissional', crp: null, crp_uf: null }

      // 4. Atualizar export_count e exported_at
      await client.query(
        `UPDATE session_reports
         SET exported_at = NOW(), export_count = COALESCE(export_count, 0) + 1, updated_at = NOW()
         WHERE session_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      )

      // 5. Retornar metadados para geracao client-side
      return NextResponse.json({
        professional: {
          name: professional.name,
          crp: professional.crp || null,
          crp_uf: professional.crp_uf || null,
        },
        session: {
          number: session.session_number,
          date: session.scheduled_at || session.started_at,
          duration: session.duration_minutes,
          type: session.session_type,
        },
        patient: {
          name: session.patient_name,
        },
      })
    })

    return result
  } catch (error) {
    console.error('Erro ao exportar PDF:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
