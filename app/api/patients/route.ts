import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ patients: [] })
    }

    const tenantId = tenantResult.rows[0].id
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''

    let query = `
      SELECT p.*, 
             p.full_name as name,
             COUNT(DISTINCT s.id) as total_sessions,
             MAX(s.created_at) as last_session,
             COUNT(DISTINCT pt.id) as push_tokens
      FROM patients p
      LEFT JOIN sessions s ON s.patient_id = p.id
      LEFT JOIN patient_push_tokens pt ON pt.patient_id = p.id
      WHERE p.tenant_id = $1
    `
    
    const params: any[] = [tenantId]

    if (search) {
      query += ` AND (p.full_name ILIKE $2 OR p.email ILIKE $2)`
      params.push(`%${search}%`)
    }

    query += `
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `

    const result = await pool.query(query, params)
    return NextResponse.json({ patients: result.rows })
  } catch (error) {
    console.error('Erro ao buscar pacientes:', error)
    return NextResponse.json({ patients: [] })
  }
}
