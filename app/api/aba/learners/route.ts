import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, learnerFilter, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Aprendizes (Multi-Terapeuta)
// admin/supervisor: veem todos. terapeuta: só seus.
// =====================================================

// GET — Listar aprendizes do tenant (filtrado por role)
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const activeOnly = searchParams.get('active') !== 'false'

      // Filtro por role: terapeuta só vê aprendizes vinculados
      const filter = learnerFilter(ctx, 2)

      let query = `
        SELECT l.*,
          (SELECT COUNT(*) FROM sessions_aba s WHERE s.learner_id = l.id AND s.tenant_id = l.tenant_id) as total_sessions,
          (SELECT COUNT(*) FROM learner_protocols lp WHERE lp.learner_id = l.id AND lp.tenant_id = l.tenant_id AND lp.status = 'active') as active_protocols
        FROM learners l
        WHERE l.tenant_id = $1
        ${filter.clause}
      `
      const params: any[] = [ctx.tenantId, ...filter.params]

      if (activeOnly) {
        query += ` AND l.is_active = true AND l.deleted_at IS NULL`
      }

      query += ` ORDER BY l.name`

      return await ctx.client.query(query, params)
    })

    return NextResponse.json({ learners: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// POST — Criar aprendiz (admin/supervisor apenas)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, birth_date, diagnosis, cid_code, support_level, school, notes } = body

    if (!name || !birth_date) {
      return NextResponse.json(
        { error: 'name e birth_date são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      // Terapeuta não pode criar aprendizes
      requireAdminOrSupervisor(ctx)

      // ─── Enforcement de limite do plano ───
      const [tenantRes, countRes] = await Promise.all([
        ctx.client.query(
          'SELECT max_patients, plan_tier FROM tenants WHERE id = $1',
          [ctx.tenantId]
        ),
        ctx.client.query(
          'SELECT COUNT(*)::int as total FROM learners WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL',
          [ctx.tenantId]
        ),
      ])

      const maxPatients = tenantRes.rows[0]?.max_patients ?? 1
      const currentCount = countRes.rows[0]?.total ?? 0

      if (currentCount >= maxPatients) {
        const err = new Error('PLAN_LIMIT_REACHED') as any
        err.planLimit = { current: currentCount, max: maxPatients, plan: tenantRes.rows[0]?.plan_tier || 'free' }
        throw err
      }

      const inserted = await ctx.client.query(
        `INSERT INTO learners (tenant_id, name, birth_date, diagnosis, cid_code, support_level, school, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [ctx.tenantId, name, birth_date, diagnosis || null, cid_code || null, support_level || 2, school || null, notes || null]
      )

      // Auto-vincular o criador como terapeuta primário
      await ctx.client.query(
        `INSERT INTO learner_therapists (tenant_id, learner_id, profile_id, is_primary, assigned_by)
         VALUES ($1, $2, $3, true, $3)
         ON CONFLICT (learner_id, profile_id) DO NOTHING`,
        [ctx.tenantId, inserted.rows[0].id, ctx.profileId]
      )

      return inserted
    })

    return NextResponse.json({ learner: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'PLAN_LIMIT_REACHED') {
      return NextResponse.json(
        {
          error: 'Limite de aprendizes atingido',
          code: 'PLAN_LIMIT_REACHED',
          ...error.planLimit,
        },
        { status: 403 }
      )
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
