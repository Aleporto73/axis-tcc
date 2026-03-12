import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''

    const result = await withTenant(async (ctx) => {
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

      const params: any[] = [ctx.tenantId]

      if (search) {
        query += ` AND (p.full_name ILIKE $2 OR p.email ILIKE $2)`
        params.push(`%${search}%`)
      }

      query += `
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `

      return await ctx.client.query(query, params)
    })

    return NextResponse.json({ patients: result.rows })
  } catch (error) {
    console.error('Erro ao buscar pacientes:', error)
    return NextResponse.json({ patients: [] })
  }
}
