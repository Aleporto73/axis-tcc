import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import * as Sentry from '@sentry/nextjs'

export async function GET(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      const result = await ctx.client.query(
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
        [ctx.tenantId]
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
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[AXIS] Erro ao buscar sugestoes:', error)
    const { message, status } = handleRouteError(error)
    if (status === 401 || status === 409) {
      return NextResponse.json({ error: message }, { status })
    }
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
  }
}
