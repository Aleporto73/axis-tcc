import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Paciente por ID
// GET — Retorna dados completos do paciente
// Respeita tenant_id e role (terapeuta só se created_by)
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      let roleClause = ''
      const queryParams: any[] = [id, ctx.tenantId]

      if (ctx.role === 'terapeuta') {
        queryParams.push(ctx.profileId)
        roleClause = `AND p.created_by = $${queryParams.length}`
      }

      const res = await ctx.client.query(
        `SELECT p.*,
          (SELECT COUNT(*) FROM tdah_sessions s WHERE s.patient_id = p.id AND s.tenant_id = p.tenant_id) as total_sessions,
          (SELECT COUNT(*) FROM tdah_protocols tp WHERE tp.patient_id = p.id AND tp.tenant_id = p.tenant_id AND tp.status = 'active') as active_protocols
        FROM tdah_patients p
        WHERE p.id = $1 AND p.tenant_id = $2
        ${roleClause}`,
        queryParams
      )

      if (res.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      return res
    })

    return NextResponse.json({ patient: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.message === 'Paciente não encontrado') {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
