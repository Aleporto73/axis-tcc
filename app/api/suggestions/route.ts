import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

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
      return NextResponse.json({ success: true, count: 0, suggestions: [] })
    }
    const tenantId = tenantResult.rows[0].id

    const result = await pool.query(
      `SELECT 
        s.id as suggestion_id,
        s.patient_id,
        s.type as suggestion_type,
        s.title as content,
        s.reason as reasoning,
        s.confidence as priority,
        s.created_at as suggested_at,
        s.expires_at,
        p.full_name as patient_name
      FROM suggestions s
      LEFT JOIN suggestion_decisions sd 
        ON s.id = sd.suggestion_id
      LEFT JOIN patients p 
        ON s.patient_id = p.id AND s.tenant_id = p.tenant_id
      WHERE s.tenant_id = $1
        AND sd.id IS NULL
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
      ORDER BY s.confidence DESC, s.created_at DESC
      LIMIT 20`,
      [tenantId]
    )

    return NextResponse.json({
      success: true,
      count: result.rows.length,
      suggestions: result.rows.map(row => ({
        ...row,
        reasoning: Array.isArray(row.reasoning) ? row.reasoning.join(', ') : (row.reasoning || 'Sem raciocinio'),
        priority: Math.round((row.priority || 0.5) * 10)
      }))
    })

  } catch (error) {
    console.error('[AXIS] Erro ao buscar sugestoes:', error)
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
  }
}
