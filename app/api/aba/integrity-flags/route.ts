import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, requireFeature, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Integrity Flags (v2.7.0 Sprint 3)
//
// GET  — Listar flags com filtros
// POST — Disparar scan de integridade (admin/supervisor)
//
// Ref: skill_axis_aba_v270.md — Sprint 3 Integridade
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_SEVERITIES = ['info', 'warning', 'critical'] as const
const VALID_STATUSES = ['open', 'reviewing', 'resolved', 'waived'] as const
const VALID_ENTITY_TYPES = ['session', 'provider', 'packet', 'learner', 'coverage'] as const

// ─────────────────────────────────────────────────────
// GET — Listar flags
// Query params:
//   severity, status, entity_type, entity_id, rule_code
//   limit (default 50), offset (default 0)
// ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const severity = sp.get('severity')
    const status = sp.get('status')
    const entityType = sp.get('entity_type')
    const entityId = sp.get('entity_id')
    const ruleCode = sp.get('rule_code')
    const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200)
    const offset = parseInt(sp.get('offset') || '0', 10)

    const result = await withTenant(async (ctx) => {
      requireFeature(ctx, 'integrityFlags')
      let query = `
        SELECT
          id, entity_type, entity_id, rule_code, severity,
          description, metadata,
          first_detected_at, last_detected_at,
          status, reviewed_by, reviewed_at, review_notes,
          auto_resolved, created_at
        FROM integrity_flags
        WHERE tenant_id = $1
      `
      const params: unknown[] = [ctx.tenantId]
      let idx = 2

      if (severity && VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) {
        query += ` AND severity = $${idx}`
        params.push(severity)
        idx++
      }

      if (status && VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
        query += ` AND status = $${idx}`
        params.push(status)
        idx++
      }

      if (entityType && VALID_ENTITY_TYPES.includes(entityType as typeof VALID_ENTITY_TYPES[number])) {
        query += ` AND entity_type = $${idx}`
        params.push(entityType)
        idx++
      }

      if (entityId) {
        query += ` AND entity_id = $${idx}`
        params.push(entityId)
        idx++
      }

      if (ruleCode) {
        query += ` AND rule_code = $${idx}`
        params.push(ruleCode)
        idx++
      }

      query += ` ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
        last_detected_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}`
      params.push(limit, offset)

      const flags = await ctx.client.query(query, params)

      // Contagem por severidade (para dashboard)
      const counts = await ctx.client.query(`
        SELECT
          severity,
          COUNT(*) FILTER (WHERE status IN ('open', 'reviewing')) as active_count,
          COUNT(*) as total_count
        FROM integrity_flags
        WHERE tenant_id = $1
        GROUP BY severity
      `, [ctx.tenantId])

      return {
        flags: flags.rows,
        counts: counts.rows,
        pagination: { limit, offset, returned: flags.rows.length },
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Disparar scan de integridade
// Body: {} (sem parâmetros — scan completo)
//
// Apenas admin/supervisor pode disparar.
// Retorna estatísticas do scan.
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Evitar warning de unused
    void request

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)
      requireFeature(ctx, 'integrityFlags')

      // Importação dinâmica para evitar carregar engine em todo request
      const { runFullScan } = await import('@/src/engines/integrity-scanner')
      const scanResult = await runFullScan(ctx.client, ctx.tenantId)

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'INTEGRITY_SCAN_TRIGGERED', 'operational', $2,
          jsonb_build_object(
            'total_flags', $3::text,
            'inserted', $4::text,
            'updated', $5::text,
            'auto_resolved', $6::text,
            'duration_ms', $7::text
          )
        )`,
        [
          ctx.tenantId,
          ctx.profileId,
          scanResult.total_flags.toString(),
          scanResult.inserted.toString(),
          scanResult.updated.toString(),
          scanResult.auto_resolved.toString(),
          scanResult.duration_ms.toString(),
        ]
      )

      return scanResult
    })

    return NextResponse.json({ scan: result })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
