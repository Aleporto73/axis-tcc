import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// PATCH — Atualizar PEI (título, datas, status) e/ou metas
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, start_date, period_start, period_end, status, goals } = body

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Verificar existência
      const check = await client.query(
        'SELECT id, status FROM pei_plans WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )
      if (check.rows.length === 0) throw new Error('PEI não encontrado')

      // Validar transição de status
      const validStatusTransitions: Record<string, string[]> = {
        draft: ['active'],
        active: ['completed', 'archived'],
        completed: ['archived'],
        archived: [],
      }
      if (status && status !== check.rows[0].status) {
        const allowed = validStatusTransitions[check.rows[0].status] || []
        if (!allowed.includes(status)) {
          throw new Error(`Transição de "${check.rows[0].status}" para "${status}" não permitida`)
        }
      }

      // Montar UPDATE dinâmico
      const sets: string[] = ['updated_at = NOW()']
      const p: any[] = []

      if (title) { p.push(title); sets.push(`title = $${p.length}`) }
      if (start_date) { p.push(start_date); sets.push(`start_date = $${p.length}::date`) }
      if (period_start !== undefined) { p.push(period_start || null); sets.push(`period_start = $${p.length}::date`) }
      if (period_end !== undefined) { p.push(period_end || null); sets.push(`period_end = $${p.length}::date`) }
      if (status) { p.push(status); sets.push(`status = $${p.length}`) }

      p.push(id, tenantId)
      const updated = await client.query(
        `UPDATE pei_plans SET ${sets.join(', ')} WHERE id = $${p.length - 1} AND tenant_id = $${p.length} RETURNING *`,
        p
      )

      // Atualizar metas se fornecidas
      if (goals && Array.isArray(goals)) {
        for (const g of goals) {
          if (g.id) {
            // Atualizar meta existente
            await client.query(
              `UPDATE pei_goals SET title = COALESCE($1, title), domain = COALESCE($2, domain),
               target_pct = COALESCE($3, target_pct), notes = COALESCE($4, notes), updated_at = NOW()
               WHERE id = $5 AND pei_plan_id = $6`,
              [g.title, g.domain, g.target_pct, g.notes, g.id, id]
            )
          } else if (g.title) {
            // Criar nova meta
            await client.query(
              'INSERT INTO pei_goals (pei_plan_id, title, domain, target_pct, notes) VALUES ($1, $2, $3, $4, $5)',
              [id, g.title, g.domain, g.target_pct || 80, g.notes || null]
            )
          }
        }
      }

      // Audit log para transição de status
      if (status && status !== check.rows[0].status) {
        await client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, 'user', 'PEI_STATUS_CHANGED', 'pei_plans',
           jsonb_build_object('plan_id', $3::text, 'from', $4::text, 'to', $5::text), NOW())`,
          [tenantId, userId || 'system', id, check.rows[0].status, status]
        )
      }

      return updated.rows[0]
    })

    return NextResponse.json({ plan: result })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (error.message === 'PEI não encontrado') return NextResponse.json({ error: error.message }, { status: 404 })
    if (error.message?.includes('não permitida')) return NextResponse.json({ error: error.message }, { status: 422 })
    console.error('PEI PATCH error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
