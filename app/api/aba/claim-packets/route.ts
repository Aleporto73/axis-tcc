import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, requireFeature, handleRouteError } from '@/src/database/with-role'
import { createSystemAlert } from '@/src/utils/system-alert'

// =====================================================
// AXIS ABA - API: Claim Packets (pacotes documentais)
// Ref: skill_axis_aba_v270.md — Sprint 2
//
// GET  — Listar pacotes (filtro: learner_id, status, coverage_id)
// POST — Gerar novo pacote para um período
//
// Bible v2.7.0:
//   - Coleta sessões do período + bundles + provas
//   - Calcula completeness_pct
//   - Hash de integridade
//   - IMUTÁVEL após 'submitted' — ajuste = nova versão
// =====================================================

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────
// GET — Listar pacotes
// ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const learnerId = request.nextUrl.searchParams.get('learner_id')
    const coverageId = request.nextUrl.searchParams.get('coverage_id')
    const packetStatus = request.nextUrl.searchParams.get('status')

    const result = await withTenant(async (ctx) => {
      // Auditoria ABA P0: role check — apenas admin/supervisor listam pacotes
      requireAdminOrSupervisor(ctx)
      requireFeature(ctx, 'claimPackets')
      let query = `
        SELECT
          cp.*, l.name as learner_name,
          lcp.payer_name,
          p_gen.name as generated_by_name
        FROM claim_packets cp
        JOIN learners l ON l.id = cp.learner_id
        LEFT JOIN learner_coverage_profiles lcp ON lcp.id = cp.coverage_id
        LEFT JOIN profiles p_gen ON p_gen.id = cp.generated_by
        WHERE cp.tenant_id = $1
      `
      const params: unknown[] = [ctx.tenantId]
      let idx = 2

      if (learnerId) {
        query += ` AND cp.learner_id = $${idx}`
        params.push(learnerId)
        idx++
      }
      if (coverageId) {
        query += ` AND cp.coverage_id = $${idx}`
        params.push(coverageId)
        idx++
      }
      if (packetStatus) {
        query += ` AND cp.packet_status = $${idx}`
        params.push(packetStatus)
        idx++
      }

      query += ` ORDER BY cp.period_start DESC, cp.version DESC`

      return ctx.client.query(query, params)
    })

    return NextResponse.json({ packets: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)

    if (status >= 500) {
      createSystemAlert({
        module: 'axis-aba',
        severity: 'critical',
        source: 'api/aba/claim-packets/GET',
        code: 'CLAIM_PACKETS_LIST_ERROR',
        message: 'Erro 500 ao listar claim packets',
        context: { error: error instanceof Error ? error.message : 'unknown' },
      }).catch(() => {})
    }

    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Gerar pacote para um período
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      learner_id,
      coverage_id,
      packet_type,
      period_start,
      period_end,
    } = body

    if (!learner_id) {
      return NextResponse.json({ error: 'learner_id obrigatório' }, { status: 400 })
    }
    if (!period_start || !period_end) {
      return NextResponse.json({ error: 'period_start e period_end obrigatórios' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)
      requireFeature(ctx, 'claimPackets')

      // Verificar aprendiz
      const learnerCheck = await ctx.client.query(
        `SELECT id FROM learners WHERE id = $1 AND tenant_id = $2`,
        [learner_id, ctx.tenantId]
      )
      if (learnerCheck.rows.length === 0) {
        throw Object.assign(new Error('Aprendiz não encontrado'), { statusCode: 404 })
      }

      // Coletar sessões do período
      const sessions = await ctx.client.query(
        `SELECT s.id, s.status
        FROM sessions_aba s
        WHERE s.learner_id = $1 AND s.tenant_id = $2
          AND s.scheduled_at >= $3::date
          AND s.scheduled_at < ($4::date + interval '1 day')
          AND s.status = 'completed'
        ORDER BY s.scheduled_at`,
        [learner_id, ctx.tenantId, period_start, period_end]
      )

      const totalSessions = sessions.rows.length

      // Coletar bundles das sessões
      let fullProof = 0
      let partialProof = 0
      let exceptionCount = 0

      if (totalSessions > 0) {
        const sessionIds = sessions.rows.map((s: { id: string }) => s.id)
        const bundles = await ctx.client.query(
          `SELECT DISTINCT ON (session_id) session_id, status
          FROM session_evidence_bundles
          WHERE session_id = ANY($1) AND tenant_id = $2
          ORDER BY session_id, version DESC`,
          [sessionIds, ctx.tenantId]
        )

        for (const b of bundles.rows) {
          if (b.status === 'complete') fullProof++
          else if (b.status === 'partial') partialProof++
          else exceptionCount++
        }

        // Sessões sem bundle contam como exception
        exceptionCount += totalSessions - bundles.rows.length
      }

      const completenessPct = totalSessions > 0
        ? Math.round((fullProof / totalSessions) * 10000) / 100
        : 0

      // Hash do pacote
      const packetHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({
          learner_id, period_start, period_end,
          total: totalSessions, full: fullProof,
          partial: partialProof, exception: exceptionCount,
          timestamp: new Date().toISOString(),
        }))
        .digest('hex')

      // Verificar versão anterior
      const previousPacket = await ctx.client.query(
        `SELECT id, version FROM claim_packets
        WHERE learner_id = $1 AND tenant_id = $2
          AND period_start = $3::date AND period_end = $4::date
          AND coverage_id IS NOT DISTINCT FROM $5
        ORDER BY version DESC LIMIT 1`,
        [learner_id, ctx.tenantId, period_start, period_end, coverage_id || null]
      )
      const newVersion = previousPacket.rows.length > 0
        ? previousPacket.rows[0].version + 1
        : 1
      const supersedesId = previousPacket.rows.length > 0
        ? previousPacket.rows[0].id
        : null

      // Inserir pacote
      const inserted = await ctx.client.query(
        `INSERT INTO claim_packets (
          tenant_id, learner_id, coverage_id, packet_type,
          period_start, period_end, packet_status, packet_hash,
          total_sessions, sessions_with_full_proof,
          sessions_with_partial_proof, sessions_with_exception,
          completeness_pct, version, supersedes_id,
          generated_at, generated_by
        ) VALUES (
          $1, $2, $3, $4,
          $5::date, $6::date, 'draft', $7,
          $8, $9, $10, $11,
          $12, $13, $14,
          NOW(), $15
        )
        RETURNING *`,
        [
          ctx.tenantId,
          learner_id,
          coverage_id || null,
          packet_type || 'monthly',
          period_start,
          period_end,
          packetHash,
          totalSessions,
          fullProof,
          partialProof,
          exceptionCount,
          completenessPct,
          newVersion,
          supersedesId,
          ctx.profileId,
        ]
      )

      // Gerar itens do pacote
      const packetId = inserted.rows[0].id

      // Item: relatório clínico (sessões do período)
      for (const s of sessions.rows) {
        await ctx.client.query(
          `INSERT INTO claim_packet_items (packet_id, item_type, item_ref_id, item_status)
          VALUES ($1, 'session_evidence', $2, 'included')`,
          [packetId, s.id]
        )
      }

      // Item: cobertura/autorização
      if (coverage_id) {
        await ctx.client.query(
          `INSERT INTO claim_packet_items (packet_id, item_type, item_ref_id, item_status)
          VALUES ($1, 'coverage_auth', $2, 'included')`,
          [packetId, coverage_id]
        )
      }

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
        VALUES ($1, $2, 'user', 'CLAIM_PACKET_GENERATED', 'claim_packet', $3,
          jsonb_build_object(
            'category', 'operational',
            'profile_id', $4::text,
            'learner_id', $5::text,
            'period', $6::text,
            'total_sessions', $7::text,
            'completeness', $8::text
          ),
          NOW()
        )`,
        [
          ctx.tenantId, ctx.userId, packetId, ctx.profileId, learner_id,
          `${period_start} - ${period_end}`,
          String(totalSessions), String(completenessPct),
        ]
      )

      return {
        packet: inserted.rows[0],
        sessions_count: totalSessions,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)

    if (status >= 500) {
      createSystemAlert({
        module: 'axis-aba',
        severity: 'critical',
        source: 'api/aba/claim-packets/POST',
        code: 'CLAIM_PACKET_GENERATE_ERROR',
        message: 'Erro 500 ao gerar claim packet',
        context: { error: error instanceof Error ? error.message : 'unknown' },
      }).catch(() => {})
    }

    return NextResponse.json({ error: message }, { status })
  }
}
