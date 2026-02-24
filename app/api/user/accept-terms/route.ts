import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function POST() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Atualiza o tenant com a data de aceite
    const result = await pool.query(
      `UPDATE tenants 
       SET terms_accepted_at = NOW() 
       WHERE clerk_user_id = $1 
       RETURNING id, terms_accepted_at`,
      [userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    // Registra na auditoria
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, metadata)
       VALUES ($1, $2, 'human', 'TERMS_ACCEPTED', $3)`,
      [result.rows[0].id, userId, JSON.stringify({ accepted_at: result.rows[0].terms_accepted_at })]
    )

    return NextResponse.json({ 
      success: true, 
      termsAccepted: true,
      acceptedAt: result.rows[0].terms_accepted_at 
    })

  } catch (error) {
    console.error('Erro ao aceitar termos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
