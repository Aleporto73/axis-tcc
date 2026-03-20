import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Claim Packet [id]
// Ref: skill_axis_aba_v270.md — Sprint 2
//
// GET   — Detalhe com itens
// PATCH — Atualizar status (draft → ready → submitted)
//
// Regras:
//   - IMUTÁVEL após 'submitted' (ajuste = nova versão via POST)
//   - Transições válidas: draft→ready, ready→submitted,
//     submitted→returned, returned→ready
//   - submitted_at registrado automaticamente
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['ready'],
  ready: ['submitted', 'draft'],
  submitted: ['returned', 'accepted', 'disputed'],
  returned: ['ready'],
  accepted: [],
  disputed: ['ready'],
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const packet = await ctx.client.query(
        `SELECT cp.*, l.name as learner_name,
          lcp.payer_name,
          p_gen.name as generated_by_name
        FROM claim_packets cp
        JOIN learners l ON l.id = cp.learner_id
        LEFT JOIN learner_coverage_profiles lcp ON lcp.id = cp.coverage_id
        LEFT JOIN profiles p_gen ON p_gen.id = cp.generated_by
        WHERE cp.id = $1 AND cp.tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (packet.rows.length === 0) {
        throw Object.assign(new Error('Pacote não encontrado'), { statusCode: 404 })
      }

      // Itens do pacote
      const items = await ctx.client.query(
        `SELECT * FROM claim_packet_items WHERE packet_id = $1 ORDER BY created_at`,
        [id]
      )

      // Submissions
      const submissions = await ctx.client.query(
        `SELECT ps.*, p.name as submitted_by_name
        FROM payer_submissions ps
        LEFT JOIN profiles p ON p.id = ps.submitted_by
        WHERE ps.packet_id = $1 AND ps.tenant_id = $2
        ORDER BY ps.submitted_at DESC`,
        [id, ctx.tenantId]
      )

      return {
        packet: packet.rows[0],
        items: items.rows,
        submissions: submissions.rows,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { packet_status, return_reason, submission_method } = body

    if (!packet_status) {
      return NextResponse.json({ error: 'packet_status obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      // Verificar existência e status atual
      const check = await ctx.client.query(
        `SELECT id, packet_status, version FROM claim_packets WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (check.rows.length === 0) {
        throw Object.assign(new Error('Pacote não encontrado'), { statusCode: 404 })
      }

      const currentStatus = check.rows[0].packet_status
      const allowed = VALID_TRANSITIONS[currentStatus] || []

      if (!allowed.includes(packet_status)) {
        throw Object.assign(
          new Error(`Transição ${currentStatus} → ${packet_status} não permitida`),
          { statusCode: 422 }
        )
      }

      // Campos dinâmicos por transição
      const setClauses: string[] = ['packet_status = $3', 'updated_at = NOW()']
      const vals: unknown[] = [id, ctx.tenantId, packet_status]
      let idx = 4

      if (packet_status === 'submitted') {
        setClauses.push(`submitted_at = NOW()`)
      }
      if (packet_status === 'returned') {
        setClauses.push(`returned_at = NOW()`)
        setClauses.push(`return_reason = $${idx}`)
        vals.push(return_reason || null)
        idx++
      }

      const updated = await ctx.client.query(
        `UPDATE claim_packets
        SET ${setClauses.join(', ')}
        WHERE id = $1 AND tenant_id = $2
        RETURNING *`,
        vals
      )

      // Se submitted → criar registro de envio
      if (packet_status === 'submitted') {
        await ctx.client.query(
          `INSERT INTO payer_submissions (
            packet_id, packet_version, tenant_id,
            submission_method, submitted_by
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            check.rows[0].version,
            ctx.tenantId,
            submission_method || 'portal',
            ctx.profileId,
          ]
        )
      }

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'CLAIM_PACKET_STATUS_CHANGED', 'operational', $2,
          jsonb_build_object(
            'packet_id', $3::text,
            'from_status', $4::text,
            'to_status', $5::text
          )
        )`,
        [ctx.tenantId, ctx.profileId, id, currentStatus, packet_status]
      )

      return updated
    })

    return NextResponse.json({ packet: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
