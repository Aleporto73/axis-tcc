import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// =====================================================
// AXIS TDAH — API Plano TDAH por ID
// PATCH — Atualizar plano (título, datas, status) + metas
// Ciclo de vida: draft → active → completed → archived
// =====================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['completed', 'archived'],
  completed: ['archived'],
  archived: [],
}

const VALID_GOAL_STATUSES = new Set(['active', 'achieved', 'paused', 'discontinued'])

// GET — Detalhe do plano com metas
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async ({ client, tenantId }) => {
      const plan = await client.query(
        `SELECT p.*, tp.name as patient_name
         FROM tdah_plans p
         JOIN tdah_patients tp ON tp.id = p.patient_id
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [id, tenantId]
      )

      if (plan.rows.length === 0) {
        throw new Error('Plano não encontrado')
      }

      const goals = await client.query(
        `SELECT * FROM tdah_plan_goals
         WHERE plan_id = $1 AND tenant_id = $2
         ORDER BY domain, goal_description`,
        [id, tenantId]
      )

      // Protocolos ativos do paciente
      const protocols = await client.query(
        `SELECT id, title, status, block FROM tdah_protocols
         WHERE patient_id = $1 AND tenant_id = $2 AND status NOT IN ('archived', 'discontinued')
         ORDER BY title`,
        [plan.rows[0].patient_id, tenantId]
      )

      // Snapshot mais recente (para contexto clínico)
      const snapshot = await client.query(
        `SELECT final_score, final_band, confidence_flag, created_at
         FROM tdah_snapshots
         WHERE patient_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [plan.rows[0].patient_id, tenantId]
      )

      return {
        ...plan.rows[0],
        goals: goals.rows,
        active_protocols: protocols.rows,
        latest_snapshot: snapshot.rows[0] || null,
      }
    })

    return NextResponse.json({ plan: result })
  } catch (error: any) {
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message === 'Plano não encontrado') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[TDAH PLAN GET] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH — Atualizar plano e/ou metas
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, start_date, end_date, status, goals } = body

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Verificar existência
      const check = await client.query(
        'SELECT id, status FROM tdah_plans WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )
      if (check.rows.length === 0) {
        throw new Error('Plano não encontrado')
      }

      const currentStatus = check.rows[0].status

      // Validar transição de status
      if (status && status !== currentStatus) {
        const allowed = VALID_TRANSITIONS[currentStatus] || []
        if (!allowed.includes(status)) {
          throw new Error(`Transição de "${currentStatus}" para "${status}" não permitida`)
        }
      }

      // Montar UPDATE dinâmico
      const sets: string[] = ['updated_at = NOW()']
      const p: any[] = []

      if (title) { p.push(title); sets.push(`title = $${p.length}`) }
      if (description !== undefined) { p.push(description || null); sets.push(`description = $${p.length}`) }
      if (start_date !== undefined) { p.push(start_date || null); sets.push(`start_date = $${p.length}::date`) }
      if (end_date !== undefined) { p.push(end_date || null); sets.push(`end_date = $${p.length}::date`) }
      if (status) { p.push(status); sets.push(`status = $${p.length}`) }

      p.push(id, tenantId)
      const updated = await client.query(
        `UPDATE tdah_plans SET ${sets.join(', ')} WHERE id = $${p.length - 1} AND tenant_id = $${p.length} RETURNING *`,
        p
      )

      // Atualizar metas se fornecidas
      if (goals && Array.isArray(goals)) {
        for (const g of goals) {
          if (g.id) {
            // Atualizar meta existente
            const goalSets: string[] = ['updated_at = NOW()']
            const gp: any[] = []

            if (g.goal_description) { gp.push(g.goal_description); goalSets.push(`goal_description = $${gp.length}`) }
            if (g.domain) { gp.push(g.domain); goalSets.push(`domain = $${gp.length}`) }
            if (g.target_criteria !== undefined) { gp.push(g.target_criteria || null); goalSets.push(`target_criteria = $${gp.length}`) }
            if (g.progress !== undefined) { gp.push(g.progress); goalSets.push(`progress = $${gp.length}`) }
            if (g.status && VALID_GOAL_STATUSES.has(g.status)) { gp.push(g.status); goalSets.push(`status = $${gp.length}`) }

            gp.push(g.id, id)
            await client.query(
              `UPDATE tdah_plan_goals SET ${goalSets.join(', ')} WHERE id = $${gp.length - 1} AND plan_id = $${gp.length}`,
              gp
            )
          } else if (g.goal_description && g.domain) {
            // Criar nova meta
            await client.query(
              `INSERT INTO tdah_plan_goals (tenant_id, plan_id, domain, goal_description, target_criteria, progress)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [tenantId, id, g.domain, g.goal_description, g.target_criteria || null, g.progress || 0]
            )
          }
        }
      }

      // Audit log para transição de status
      if (status && status !== currentStatus) {
        try {
          await client.query(
            `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
             VALUES ($1, $2, 'user', 'TDAH_PLAN_STATUS_CHANGED', 'tdah_plans',
             jsonb_build_object('plan_id', $3::text, 'from', $4::text, 'to', $5::text), NOW())`,
            [tenantId, userId || 'system', id, currentStatus, status]
          )
        } catch (_) { /* audit non-blocking */ }
      }

      return updated.rows[0]
    })

    return NextResponse.json({ plan: result })
  } catch (error: any) {
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message === 'Plano não encontrado') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message?.includes('não permitida')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('[TDAH PLAN PATCH] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
