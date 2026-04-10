import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

export async function POST() {
  try {
    const result = await withTenant(async (ctx) => {
      // Atualiza o tenant ativo com a data de aceite
      const res = await ctx.client.query(
        `UPDATE tenants
         SET terms_accepted_at = NOW()
         WHERE id = $1
         RETURNING id, terms_accepted_at`,
        [ctx.tenantId]
      )

      if (res.rows.length === 0) {
        const err = new Error('Tenant nao encontrado') as any
        err.statusCode = 404
        throw err
      }

      // Registra na auditoria
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, metadata)
         VALUES ($1, $2, 'human', 'TERMS_ACCEPTED', $3)`,
        [ctx.tenantId, ctx.userId, JSON.stringify({ accepted_at: res.rows[0].terms_accepted_at })]
      )

      return res.rows[0]
    })

    return NextResponse.json({
      success: true,
      termsAccepted: true,
      acceptedAt: result.terms_accepted_at,
    })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
