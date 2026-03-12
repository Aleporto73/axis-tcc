import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const { subscription } = await request.json()

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Subscription inválida' }, { status: 400 })
    }

    const result = await pool.query(
      `INSERT INTO push_subscriptions (tenant_id, user_id, endpoint, p256dh, auth, device_info)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint)
       DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [
        tenantId,
        userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        JSON.stringify({ userAgent: request.headers.get('user-agent') })
      ]
    )

    return NextResponse.json({ success: true, id: result.rows[0].id })
  } catch (error) {
    console.error('Erro ao salvar subscription:', error)
    return NextResponse.json({ success: false, error: 'Erro ao salvar' }, { status: 500 })
  }
}
