import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

export async function POST(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      const { subscription } = await request.json()

      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return NextResponse.json({ error: 'Subscription inválida' }, { status: 400 })
      }

      const result = await ctx.client.query(
        `INSERT INTO push_subscriptions (tenant_id, user_id, endpoint, p256dh, auth, device_info)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (endpoint)
         DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [
          ctx.tenantId,
          ctx.userId,
          subscription.endpoint,
          subscription.keys.p256dh,
          subscription.keys.auth,
          JSON.stringify({ userAgent: request.headers.get('user-agent') })
        ]
      )

      return NextResponse.json({ success: true, id: result.rows[0].id })
    })
  } catch (error) {
    console.error('Erro ao salvar subscription:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
