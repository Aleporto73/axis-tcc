import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Daily Report Card (DRC)
// GET — Lista DRCs por paciente (com filtros data)
// POST — Criar novo registro DRC
// Bible §14, §17: DRC é core do produto TDAH escolar
// Regra: 1-3 metas por DRC (Bible §17)
// =====================================================

const VALID_FILLED_BY = ['teacher', 'mediator', 'parent', 'other']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    if (!patientId) {
      return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      let roleClause = ''
      const params: any[] = [patientId, ctx.tenantId]

      if (ctx.role === 'terapeuta') {
        params.push(ctx.profileId)
        roleClause = `AND d.patient_id IN (SELECT id FROM tdah_patients WHERE tenant_id = $2 AND created_by = $${params.length})`
      }

      let dateFilter = ''
      if (startDate) {
        params.push(startDate)
        dateFilter += ` AND d.drc_date >= $${params.length}`
      }
      if (endDate) {
        params.push(endDate)
        dateFilter += ` AND d.drc_date <= $${params.length}`
      }

      params.push(limit)

      return await ctx.client.query(
        `SELECT d.*,
          tp.code as protocol_code,
          tp.title as protocol_title,
          rv.first_name || ' ' || rv.last_name as reviewer_name
        FROM tdah_drc d
        LEFT JOIN tdah_protocols tp ON tp.id = d.protocol_id
        LEFT JOIN profiles rv ON rv.id = d.reviewed_by
        WHERE d.patient_id = $1 AND d.tenant_id = $2
        ${roleClause}
        ${dateFilter}
        ORDER BY d.drc_date DESC, d.created_at DESC
        LIMIT $${params.length}`,
        params
      )
    })

    return NextResponse.json({ drc_entries: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      patient_id,
      drc_date,
      protocol_id,
      goal_description,
      goal_met,
      score,
      filled_by,
      filled_by_name,
      teacher_notes,
    } = body

    if (!patient_id || !drc_date || !goal_description) {
      return NextResponse.json(
        { error: 'patient_id, drc_date e goal_description são obrigatórios' },
        { status: 400 }
      )
    }

    if (filled_by && !VALID_FILLED_BY.includes(filled_by)) {
      return NextResponse.json(
        { error: `filled_by inválido. Valores: ${VALID_FILLED_BY.join(', ')}` },
        { status: 400 }
      )
    }

    if (score !== undefined && score !== null && (score < 0 || score > 100)) {
      return NextResponse.json(
        { error: 'score deve ser entre 0 e 100' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      // Verificar paciente existe e pertence ao tenant
      const patient = await ctx.client.query(
        `SELECT id FROM tdah_patients WHERE id = $1 AND tenant_id = $2`,
        [patient_id, ctx.tenantId]
      )
      if (patient.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      // Bible §17: máximo 3 metas por data por paciente
      const existingCount = await ctx.client.query(
        `SELECT COUNT(*) as cnt FROM tdah_drc WHERE patient_id = $1 AND tenant_id = $2 AND drc_date = $3`,
        [patient_id, ctx.tenantId, drc_date]
      )
      if (parseInt(existingCount.rows[0].cnt) >= 3) {
        const err = new Error('Bible §17: máximo 3 metas por DRC por dia. Limite atingido.') as any
        err.statusCode = 422
        throw err
      }

      // Se protocol_id informado, verificar pertence ao paciente
      if (protocol_id) {
        const proto = await ctx.client.query(
          `SELECT id FROM tdah_protocols WHERE id = $1 AND patient_id = $2 AND tenant_id = $3`,
          [protocol_id, patient_id, ctx.tenantId]
        )
        if (proto.rows.length === 0) {
          const err = new Error('Protocolo não encontrado para este paciente') as any
          err.statusCode = 404
          throw err
        }
      }

      return await ctx.client.query(
        `INSERT INTO tdah_drc (tenant_id, patient_id, drc_date, protocol_id, goal_description, goal_met, score, filled_by, filled_by_name, teacher_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          ctx.tenantId, patient_id, drc_date,
          protocol_id || null,
          goal_description,
          goal_met ?? null,
          score ?? null,
          filled_by || null,
          filled_by_name || null,
          teacher_notes || null,
        ]
      )
    })

    return NextResponse.json({ drc_entry: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
