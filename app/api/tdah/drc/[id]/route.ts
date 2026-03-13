import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: DRC por ID
// GET — Detalhe do registro DRC
// PATCH — Atualizar dados + review do clínico
// Bible §14.2 item 4: clínico revisa DRC
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const res = await ctx.client.query(
        `SELECT d.*,
          tp.code as protocol_code,
          tp.title as protocol_title,
          p.name as patient_name,
          rv.first_name || ' ' || rv.last_name as reviewer_name
        FROM tdah_drc d
        JOIN tdah_patients p ON p.id = d.patient_id
        LEFT JOIN tdah_protocols tp ON tp.id = d.protocol_id
        LEFT JOIN profiles rv ON rv.id = d.reviewed_by
        WHERE d.id = $1 AND d.tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (res.rows.length === 0) {
        const err = new Error('Registro DRC não encontrado') as any
        err.statusCode = 404
        throw err
      }
      return res
    })

    return NextResponse.json({ drc_entry: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
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
    const { goal_met, score, clinician_review_notes, teacher_notes, action } = body

    const result = await withTenant(async (ctx) => {
      // Verificar DRC existe
      const current = await ctx.client.query(
        `SELECT * FROM tdah_drc WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (current.rows.length === 0) {
        const err = new Error('Registro DRC não encontrado') as any
        err.statusCode = 404
        throw err
      }

      // ── Ação: review (clínico marca como revisado) ──
      if (action === 'review') {
        return await ctx.client.query(
          `UPDATE tdah_drc
           SET reviewed_by = $3,
               reviewed_at = NOW(),
               clinician_review_notes = COALESCE($4, clinician_review_notes),
               updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2
           RETURNING *`,
          [id, ctx.tenantId, ctx.profileId, clinician_review_notes || null]
        )
      }

      // ── Atualização de campos ──
      const sets: string[] = ['updated_at = NOW()']
      const params: any[] = [id, ctx.tenantId]

      if (goal_met !== undefined) {
        params.push(goal_met)
        sets.push(`goal_met = $${params.length}`)
      }
      if (score !== undefined) {
        if (score !== null && (score < 0 || score > 100)) {
          const err = new Error('score deve ser entre 0 e 100') as any
          err.statusCode = 400
          throw err
        }
        params.push(score)
        sets.push(`score = $${params.length}`)
      }
      if (teacher_notes !== undefined) {
        params.push(teacher_notes)
        sets.push(`teacher_notes = $${params.length}`)
      }
      if (clinician_review_notes !== undefined) {
        params.push(clinician_review_notes)
        sets.push(`clinician_review_notes = $${params.length}`)
      }

      if (sets.length === 1) {
        // Só tem updated_at, nada pra atualizar
        return current
      }

      return await ctx.client.query(
        `UPDATE tdah_drc SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        params
      )
    })

    return NextResponse.json({ drc_entry: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
