import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'axis_tcc',
  user: 'axis',
  password: 'AxisTcc2026!',
})

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ sessions: [] })
    }

    const tenantId = tenantResult.rows[0].id

    const result = await pool.query(
      `SELECT 
        s.id,
        s.patient_id,
        s.session_number,
        s.session_type,
        s.scheduled_at,
        s.started_at,
        s.ended_at,
        s.duration_minutes,
        s.status,
        s.created_at,
        s.patient_response,
        p.full_name as patient_name,
        (SELECT COUNT(*) FROM patient_push_tokens ppt WHERE ppt.patient_id = s.patient_id) > 0 as push_enabled
      FROM sessions s
      LEFT JOIN patients p ON s.patient_id = p.id
      WHERE s.tenant_id = $1
      ORDER BY s.scheduled_at DESC NULLS LAST, s.created_at DESC
      LIMIT 50`,
      [tenantId]
    )

    return NextResponse.json({ sessions: result.rows })
  } catch (error) {
    console.error('Erro ao buscar sessoes:', error)
    return NextResponse.json({ sessions: [] })
  }
}
