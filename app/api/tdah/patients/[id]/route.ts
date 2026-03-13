import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { CSO_TDAH_ENGINE_VERSION } from '@/src/engines/cso-tdah'

// =====================================================
// AXIS TDAH - API: Paciente por ID
// GET — Retorna dados completos do paciente
// PATCH — Atualizar dados + toggle AuDHD layer
// Respeita tenant_id e role (terapeuta só se created_by)
// Bible §9.3: mudança de layer SEMPRE gera log (append-only)
// =====================================================

const VALID_AUDHD_STATUS = ['off', 'active_core', 'active_full']

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { audhd_layer_status, audhd_layer_reason } = body

    const result = await withTenant(async (ctx) => {
      // Verificar paciente existe e pertence ao tenant
      const current = await ctx.client.query(
        `SELECT id, audhd_layer_status FROM tdah_patients WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )

      if (current.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      // ── Toggle AuDHD layer (Bible §9.3, Anexo F) ──
      if (audhd_layer_status !== undefined) {
        if (!VALID_AUDHD_STATUS.includes(audhd_layer_status)) {
          const err = new Error(`Status AuDHD inválido. Valores: ${VALID_AUDHD_STATUS.join(', ')}`) as any
          err.statusCode = 400
          throw err
        }

        const previousStatus = current.rows[0].audhd_layer_status

        // Não faz nada se status é o mesmo
        if (previousStatus === audhd_layer_status) {
          return await ctx.client.query(
            `SELECT * FROM tdah_patients WHERE id = $1`,
            [id]
          )
        }

        // Atualizar paciente
        const updated = await ctx.client.query(
          `UPDATE tdah_patients
           SET audhd_layer_status = $3::audhd_layer_status_enum,
               audhd_layer_activated_by = $4,
               audhd_layer_activated_at = NOW(),
               audhd_layer_reason = $5,
               updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2
           RETURNING *`,
          [id, ctx.tenantId, audhd_layer_status, ctx.profileId, audhd_layer_reason || null]
        )

        // Log append-only (Bible §9.3: toda mudança gera log com autoria)
        await ctx.client.query(
          `INSERT INTO tdah_audhd_log (tenant_id, patient_id, previous_status, new_status, changed_by, reason, engine_version)
           VALUES ($1, $2, $3::audhd_layer_status_enum, $4::audhd_layer_status_enum, $5, $6, $7)`,
          [ctx.tenantId, id, previousStatus, audhd_layer_status, ctx.profileId, audhd_layer_reason || null, CSO_TDAH_ENGINE_VERSION]
        )

        return updated
      }

      const err = new Error('Nenhuma ação válida fornecida') as any
      err.statusCode = 400
      throw err
    })

    return NextResponse.json({ patient: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
