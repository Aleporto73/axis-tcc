import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, requireFeature, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Integrity Flag [id] (v2.7.0 Sprint 3)
//
// GET   — Detalhe da flag
// PATCH — Revisar / resolver / waive
//
// Regras (Bible v2.7.0):
//   - Flag critical NÃO pode ser waived sem review_notes
//   - Transições: open→reviewing→resolved/waived
//   - auto_resolved flags NÃO editáveis
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['open', 'reviewing', 'resolved', 'waived'] as const

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['reviewing', 'resolved', 'waived'],
  reviewing: ['resolved', 'waived', 'open'],
  resolved: [],   // Imutável
  waived: [],      // Imutável
}

// ─────────────────────────────────────────────────────
// GET — Detalhe da flag
// ─────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      requireFeature(ctx, 'integrityFlags')
      const flag = await ctx.client.query(`
        SELECT
          f.*,
          p.name as reviewed_by_name
        FROM integrity_flags f
        LEFT JOIN profiles p ON p.id = f.reviewed_by
        WHERE f.id = $1 AND f.tenant_id = $2
      `, [id, ctx.tenantId])

      if (flag.rows.length === 0) {
        throw Object.assign(new Error('Flag não encontrada'), { statusCode: 404 })
      }

      return flag.rows[0]
    })

    return NextResponse.json({ flag: result })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// PATCH — Revisar / resolver / waive
// Body: { status, review_notes? }
// ─────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status: newStatus, review_notes } = body

    if (!newStatus) {
      return NextResponse.json({ error: 'status obrigatório' }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(newStatus as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)
      requireFeature(ctx, 'integrityFlags')

      // Buscar flag atual
      const check = await ctx.client.query(
        `SELECT id, status, severity, auto_resolved, rule_code
        FROM integrity_flags WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (check.rows.length === 0) {
        throw Object.assign(new Error('Flag não encontrada'), { statusCode: 404 })
      }

      const flag = check.rows[0]

      // Auto-resolved não pode ser editado manualmente
      if (flag.auto_resolved) {
        throw Object.assign(
          new Error('Flag auto-resolvida não pode ser editada'),
          { statusCode: 422 }
        )
      }

      // Validar transição
      const allowed = VALID_TRANSITIONS[flag.status] || []
      if (!allowed.includes(newStatus)) {
        throw Object.assign(
          new Error(`Transição ${flag.status} → ${newStatus} não permitida`),
          { statusCode: 422 }
        )
      }

      // Flag critical NÃO pode ser waived sem review_notes (Bible v2.7.0)
      if (newStatus === 'waived' && flag.severity === 'critical' && !review_notes?.trim()) {
        throw Object.assign(
          new Error('Flag critical exige justificativa (review_notes) para waive'),
          { statusCode: 422 }
        )
      }

      // Construir UPDATE dinâmico
      const setClauses: string[] = ['status = $3']
      const vals: unknown[] = [id, ctx.tenantId, newStatus]
      let idx = 4

      // Sempre registrar quem revisou
      if (newStatus !== 'open') {
        setClauses.push(`reviewed_by = $${idx}`)
        vals.push(ctx.profileId)
        idx++
        setClauses.push(`reviewed_at = NOW()`)
      }

      if (review_notes !== undefined) {
        setClauses.push(`review_notes = $${idx}`)
        vals.push(review_notes?.trim() || null)
        idx++
      }

      const updated = await ctx.client.query(
        `UPDATE integrity_flags
        SET ${setClauses.join(', ')}
        WHERE id = $1 AND tenant_id = $2
        RETURNING *`,
        vals
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'INTEGRITY_FLAG_REVIEWED', 'operational', $2,
          jsonb_build_object(
            'flag_id', $3::text,
            'rule_code', $4::text,
            'from_status', $5::text,
            'to_status', $6::text,
            'severity', $7::text
          )
        )`,
        [ctx.tenantId, ctx.profileId, id, flag.rule_code, flag.status, newStatus, flag.severity]
      )

      return updated
    })

    return NextResponse.json({ flag: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
