import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const domain = searchParams.get('domain')

    const result = await withTenant(async ({ client }) => {
      // protocol_library é tabela global (sem tenant_id, sem RLS)
      // ebp_practice_id já é integer FK para ebp_practices — não precisa de JOIN
      let query = `
        SELECT pl.id, pl.title, pl.domain, pl.objective,
               pl.ebp_practice_id, ep.name as ebp_practice_name,
               pl.measurement_type, pl.default_mastery_pct, pl.default_mastery_sessions,
               pl.default_mastery_trials, pl.difficulty_level, pl.tags
        FROM protocol_library pl
        LEFT JOIN ebp_practices ep ON ep.id = pl.ebp_practice_id
        WHERE pl.is_active = true
      `
      const params: string[] = []

      if (domain) {
        params.push(domain)
        query += ` AND pl.domain = $${params.length}`
      }

      query += ' ORDER BY pl.difficulty_level ASC, pl.domain ASC, pl.title ASC'

      const res = await client.query(query, params)
      return res.rows
    })

    return NextResponse.json({ protocols: result })
  } catch (error: any) {
    console.error('[Library GET]', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
