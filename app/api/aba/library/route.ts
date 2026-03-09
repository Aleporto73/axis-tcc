import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const domain = searchParams.get('domain')

    const result = await withTenant(async ({ client }) => {
      // protocol_library é tabela global (sem tenant_id, sem RLS)
      let query = `
        SELECT id, title, domain, objective, ebp_practice_name,
               measurement_type, default_mastery_pct, default_mastery_sessions,
               default_mastery_trials, difficulty_level, tags
        FROM protocol_library
        WHERE is_active = true
      `
      const params: string[] = []

      if (domain) {
        params.push(domain)
        query += ` AND domain = $${params.length}`
      }

      query += ' ORDER BY difficulty_level ASC, domain ASC, title ASC'

      const res = await client.query(query, params)
      return res.rows
    })

    return NextResponse.json({ protocols: result })
  } catch (error: any) {
    console.error('[Library GET]', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
