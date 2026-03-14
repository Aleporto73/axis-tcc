import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH — API: Rotina por ID
// GET — Detalhe da rotina
// PATCH — Atualizar rotina (steps, status, nome)
// =====================================================

const VALID_STATUS = ['active', 'paused', 'completed', 'archived']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const res = await ctx.client.query(
        `SELECT r.*, p.name as patient_name
        FROM tdah_routines r
        JOIN tdah_patients p ON p.id = r.patient_id
        WHERE r.id = $1 AND r.tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (res.rows.length === 0) {
        const err = new Error('Rotina não encontrada') as any
        err.statusCode = 404
        throw err
      }
      return res
    })

    return NextResponse.json({ routine: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode) return NextResponse.json({ error: error.message }, { status: error.statusCode })
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
    const { routine_name, routine_type, steps, reinforcement_plan, status: newStatus } = body

    const result = await withTenant(async (ctx) => {
      const current = await ctx.client.query(
        'SELECT * FROM tdah_routines WHERE id = $1 AND tenant_id = $2',
        [id, ctx.tenantId]
      )
      if (current.rows.length === 0) {
        const err = new Error('Rotina não encontrada') as any
        err.statusCode = 404
        throw err
      }

      const sets: string[] = ['updated_at = NOW()']
      const p: any[] = [id, ctx.tenantId]

      if (routine_name) { p.push(routine_name); sets.push(`routine_name = $${p.length}`) }
      if (routine_type) { p.push(routine_type); sets.push(`routine_type = $${p.length}`) }
      if (reinforcement_plan !== undefined) { p.push(reinforcement_plan || null); sets.push(`reinforcement_plan = $${p.length}`) }
      if (newStatus && VALID_STATUS.includes(newStatus)) { p.push(newStatus); sets.push(`status = $${p.length}`) }
      if (steps && Array.isArray(steps)) {
        const stepsJson = JSON.stringify(steps.map((s: any, i: number) => ({
          order: s.order || i + 1,
          description: s.description || '',
          visual_cue: s.visual_cue || '',
        })))
        p.push(stepsJson)
        sets.push(`steps_json = $${p.length}::jsonb`)
      }

      if (sets.length === 1) return current

      return await ctx.client.query(
        `UPDATE tdah_routines SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        p
      )
    })

    return NextResponse.json({ routine: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
