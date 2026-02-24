import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const body = await request.json()
    const { fcm_token, device_info } = body

    if (!fcm_token) {
      return NextResponse.json({ error: 'Token obrigatorio' }, { status: 400 })
    }

    // Upsert: se já existe, atualiza updated_at
    const result = await pool.query(
      `INSERT INTO push_tokens (tenant_id, user_id, fcm_token, device_info)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, fcm_token) 
       DO UPDATE SET updated_at = NOW(), device_info = EXCLUDED.device_info
       RETURNING id`,
      [tenantId, userId, fcm_token, device_info || null]
    )

    return NextResponse.json({ 
      success: true, 
      token_id: result.rows[0].id 
    })

  } catch (error) {
    console.error('Erro ao registrar token push:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
