import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

export async function POST(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      const body = await request.json()
      const { fcm_token, device_info } = body

      if (!fcm_token) {
        return NextResponse.json({ error: 'Token obrigatorio' }, { status: 400 })
      }

      // Upsert: se já existe, atualiza updated_at
      const result = await ctx.client.query(
        `INSERT INTO push_tokens (tenant_id, user_id, fcm_token, device_info)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, fcm_token)
         DO UPDATE SET updated_at = NOW(), device_info = EXCLUDED.device_info
         RETURNING id`,
        [ctx.tenantId, ctx.userId, fcm_token, device_info || null]
      )

      return NextResponse.json({
        success: true,
        token_id: result.rows[0].id
      })
    })
  } catch (error) {
    console.error('Erro ao registrar token push:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
