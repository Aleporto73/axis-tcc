import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Biblioteca de Protocolos
// GET — Retorna todos os protocolos da library (P1, P1.1)
// Filtros: block, priority, requires_audhd_layer
// Não depende de tenant (biblioteca é global)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const block = searchParams.get('block')
      const priority = searchParams.get('priority')
      const audhd = searchParams.get('audhd')

      let query = `
        SELECT id, code, title, block, priority, domain,
               requires_audhd_layer, min_audhd_status,
               description, objective, measurement, mastery_criteria,
               status
        FROM tdah_protocol_library
        WHERE status = 'active'
      `
      const params: any[] = []

      if (block) {
        params.push(block)
        query += ` AND block = $${params.length}`
      }

      if (priority) {
        params.push(priority)
        query += ` AND priority = $${params.length}`
      }

      if (audhd === 'true') {
        query += ` AND requires_audhd_layer = true`
      } else if (audhd === 'false') {
        query += ` AND requires_audhd_layer = false`
      }

      query += ` ORDER BY block, code`

      return await ctx.client.query(query, params)
    })

    return NextResponse.json({ protocols: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
