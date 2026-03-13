import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Scores CSO-TDAH
// GET — Retorna snapshots (histórico de scores) de um paciente
// Parâmetros: patient_id (obrigatório), limit (default 20)
// Usa tdah_snapshots (append-only, imutável)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const patientId = searchParams.get('patient_id')
      const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)

      if (!patientId) {
        const err = new Error('patient_id é obrigatório') as any
        err.statusCode = 400
        throw err
      }

      // Role check: terapeuta só vê scores de pacientes que criou
      let roleClause = ''
      const params: any[] = [patientId, ctx.tenantId, limit]

      if (ctx.role === 'terapeuta') {
        params.push(ctx.profileId)
        roleClause = `AND EXISTS (SELECT 1 FROM tdah_patients p WHERE p.id = snap.patient_id AND p.created_by = $${params.length})`
      }

      const res = await ctx.client.query(
        `SELECT snap.id, snap.session_id, snap.snapshot_type,
                snap.engine_version, snap.audhd_layer_status,
                snap.core_score, snap.executive_score,
                snap.audhd_layer_score, snap.final_score,
                snap.final_band, snap.confidence_flag,
                snap.missing_data_primary_flag,
                snap.core_metrics_json, snap.executive_metrics_json,
                snap.audhd_metrics_json, snap.audhd_flags_json,
                snap.source_contexts_json,
                snap.snapshot_at,
                s.session_number, s.session_context
         FROM tdah_snapshots snap
         LEFT JOIN tdah_sessions s ON s.id = snap.session_id
         WHERE snap.patient_id = $1 AND snap.tenant_id = $2
         ${roleClause}
         ORDER BY snap.snapshot_at DESC
         LIMIT $3`,
        params
      )

      return res
    })

    return NextResponse.json({ scores: result.rows })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
