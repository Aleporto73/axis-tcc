import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'

export async function POST(request: NextRequest) {
  try {
    const { subscription, userId, tenantId } = await request.json()

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
