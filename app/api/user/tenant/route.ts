import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Busca tenant existente
    const result = await pool.query(
      'SELECT id as tenant_id, name, role, trial_status, is_admin, terms_accepted_at FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
      [userId]
    )

    // Se existe, retorna
    if (result.rows.length > 0) {
      return NextResponse.json({
        tenantId: result.rows[0].tenant_id,
        name: result.rows[0].name,
        role: result.rows[0].role,
        trialStatus: result.rows[0].trial_status,
        isAdmin: result.rows[0].is_admin,
        termsAccepted: result.rows[0].terms_accepted_at !== null,
        userId
      })
    }

    // Se nao existe, cria automaticamente (primeiro login)
    const user = await currentUser()
    const name = user?.fullName || user?.firstName || 'Profissional'
    const email = user?.emailAddresses?.[0]?.emailAddress || ''
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 dias

    const insert = await pool.query(
      `INSERT INTO tenants (name, email, clerk_user_id, role, trial_start, trial_end, trial_status, max_patients, max_sessions, is_admin)
       VALUES ($1, $2, $3, 'professional', $4, $5, 'trial', 5, 15, false)
       RETURNING id as tenant_id`,
      [name, email, userId, now, trialEnd]
    )

    return NextResponse.json({
      tenantId: insert.rows[0].tenant_id,
      name,
      role: 'professional',
      trialStatus: 'trial',
      isAdmin: false,
      termsAccepted: false,
      userId,
      isNew: true
    })

  } catch (error) {
    console.error('Erro ao buscar/criar tenant:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}


