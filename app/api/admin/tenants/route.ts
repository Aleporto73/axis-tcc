import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

async function isAdmin(userId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT is_admin FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
    [userId]
  )
  return result.rows.length > 0 && result.rows[0].is_admin === true
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const result = await pool.query(`
      SELECT 
        t.id, t.name, t.email, t.crp, t.crp_uf, t.role,
        t.trial_status, t.trial_start, t.trial_end,
        t.max_patients, t.max_sessions, t.is_admin, t.created_at,
        COALESCE(p.count, 0)::int as patient_count,
        COALESCE(s.count, 0)::int as session_count
      FROM tenants t
      LEFT JOIN (SELECT tenant_id, COUNT(*) FROM patients GROUP BY tenant_id) p ON t.id = p.tenant_id
      LEFT JOIN (SELECT tenant_id, COUNT(*) FROM sessions GROUP BY tenant_id) s ON t.id = s.tenant_id
      ORDER BY t.created_at DESC
    `)

    return NextResponse.json({ tenants: result.rows })

  } catch (error) {
    console.error('[ADMIN] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()
    const { tenantId, trialStatus } = body

    if (!tenantId || !trialStatus) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const allowed = ['trial', 'paid', 'expired', 'blocked']
    if (!allowed.includes(trialStatus)) {
      return NextResponse.json({ error: 'Status invalido' }, { status: 400 })
    }

    let maxPatients = 5
    let maxSessions = 15

    if (trialStatus === 'paid') {
      maxPatients = 999999
      maxSessions = 999999
    } else if (trialStatus === 'expired' || trialStatus === 'blocked') {
      maxPatients = 0
      maxSessions = 0
    }

    await pool.query(
      `UPDATE tenants SET trial_status = $1, max_patients = $2, max_sessions = $3 WHERE id = $4`,
      [trialStatus, maxPatients, maxSessions, tenantId]
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[ADMIN] Erro ao atualizar:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
