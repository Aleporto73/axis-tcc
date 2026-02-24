import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, discontinuation_reason, pei_goal_id } = body

    if (!status && pei_goal_id === undefined) return NextResponse.json({ error: 'status ou pei_goal_id é obrigatório' }, { status: 400 })

    const result = await withTenant(async ({ client, tenantId }) => {
      const sets: string[] = ['updated_at = NOW()']
      const p: any[] = []

      if (status) {
        p.push(status); sets.push(`status = $${p.length}`)
        const ts: Record<string,string> = { active:'activated_at', mastered:'mastered_at', generalization:'generalized_at', maintained:'maintained_at', suspended:'suspended_at', discontinued:'discontinued_at', archived:'archived_at' }
        if (ts[status]) { p.push(new Date().toISOString()); sets.push(`${ts[status]} = $${p.length}`) }
        if (status === 'discontinued' && discontinuation_reason) { p.push(discontinuation_reason); sets.push(`discontinuation_reason = $${p.length}`) }
      }

      if (pei_goal_id !== undefined) {
        p.push(pei_goal_id || null); sets.push(`pei_goal_id = $${p.length}`)
      }

      p.push(id, tenantId)
      const q = `UPDATE learner_protocols SET ${sets.join(', ')} WHERE id = $${p.length-1} AND tenant_id = $${p.length} RETURNING *`
      return await client.query(q, p)
    })

    if (result.rows.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json({ protocol: result.rows[0] })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.error("PATCH protocol error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
