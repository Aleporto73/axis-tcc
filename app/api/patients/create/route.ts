import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { getProductLimit } from '@/src/database/product-limits'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, birth_date, notes } = body

    const result = await withTenant(async (ctx) => {
      // ─── Enforcement de limite do plano (per-product via user_licenses) ───
      const [limit, countResult] = await Promise.all([
        getProductLimit(ctx.client, ctx.tenantId, 'tcc'),
        ctx.client.query(
          'SELECT COUNT(*)::int AS total FROM patients WHERE tenant_id = $1',
          [ctx.tenantId]
        ),
      ])
      const currentCount = countResult.rows[0]?.total ?? 0

      if (currentCount >= limit.maxPatients) {
        const err = new Error('PLAN_LIMIT_REACHED') as any
        err.statusCode = 403
        throw err
      }

      const inserted = await ctx.client.query(
        `INSERT INTO patients (tenant_id, full_name, email, phone, birth_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [ctx.tenantId, name, email || null, phone || null, birth_date || null, notes || null]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'human', 'PATIENT_CREATE', 'patient', $3, $4)`,
        [ctx.tenantId, ctx.userId, inserted.rows[0].id, JSON.stringify({ has_email: !!email, has_phone: !!phone })]
      )

      return inserted
    })

    return NextResponse.json({ patient: result.rows[0] })
  } catch (error: any) {
    if (error?.message === 'PLAN_LIMIT_REACHED') {
      return NextResponse.json(
        { error: 'Limite de pacientes atingido. Faça upgrade para o plano Profissional.' },
        { status: 403 }
      )
    }
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Erro ao criar paciente:', msg, error)
    return NextResponse.json({ error: `Erro ao criar paciente: ${msg}` }, { status: 500 })
  }
}
