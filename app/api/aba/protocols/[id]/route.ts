import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { canAccessLearner } from '@/src/database/with-role'
import { isValidStatus } from '@/src/engines/protocol-lifecycle'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, discontinuation_reason, pei_goal_id } = body
    const reason = (body.reason ?? body.motivo ?? '').toString().trim()

    if (!status && pei_goal_id === undefined) return NextResponse.json({ error: 'status ou pei_goal_id é obrigatório' }, { status: 400 })
    // A6: validar o status ANTES do SQL — evita que um valor fora do enum vire 22P02 → 500.
    if (status && !isValidStatus(status)) return NextResponse.json({ error: `Status inválido: "${status}".` }, { status: 400 })
    // Fase A: 'regression' foi descontinuado da máquina de estados ABA (Decisão 1). Ainda
    // existe no enum como tombstone, mas não é destino funcional. Bloquear aqui, sem SQL.
    if (status === 'regression') return NextResponse.json({ error: 'O status "regressão" foi descontinuado na máquina de estados ABA e não é mais um destino válido. Uma sonda de manutenção abaixo do critério agora retorna o protocolo para "Ativo".' }, { status: 422 })

    const result = await withTenant(async (ctx) => {
      const { client, tenantId, userId } = ctx

      // C1: buscar o protocolo ANTES de qualquer UPDATE (learner, âncora do ciclo, critérios).
      const protoRes = await client.query(
        `SELECT id, tenant_id, learner_id, status AS current_status,
                activated_at, created_at,
                mastery_criteria_pct, mastery_criteria_sessions, mastery_criteria_trials
         FROM learner_protocols WHERE id = $1::uuid AND tenant_id = $2::uuid`,
        [id, tenantId]
      )
      if (protoRes.rows.length === 0) return { protocol: null, maintenance_probes: [] }
      const proto = protoRes.rows[0]

      // Hardening: acesso ao learner. 404 genérico (não vazar 403).
      const canAccess = await canAccessLearner(ctx, proto.learner_id)
      if (!canAccess) return { protocol: null, maintenance_probes: [] }

      // C1 (Fase C): validar critério real de domínio antes de permitir 'mastered'.
      // Sessão qualificada = completed, no ciclo atual (ended_at >= âncora), com targets do
      // protocolo somando >= mastery_criteria_trials e % ponderado (SUM/SUM) >= mastery_criteria_pct.
      let masteredOverride:
        | null
        | { qualified: number; required: number; completedWithTargets: number; bestPct: number; maxTrials: number; anchor: string } = null
      if (status === 'mastered') {
        const anchor: Date = proto.activated_at || proto.created_at
        const crit = await client.query(
          `SELECT
             count(*)::int AS completed_sessions_with_targets,
             count(*) FILTER (WHERE qualifies)::int AS qualified_sessions,
             COALESCE(max(pct), 0)::numeric AS best_session_pct,
             COALESCE(max(trials_total), 0)::int AS max_trials_in_session
           FROM (
             SELECT
               s.id AS session_id,
               SUM(st.trials_total)::int AS trials_total,
               SUM(st.trials_correct)::int AS trials_correct,
               CASE WHEN SUM(st.trials_total) > 0
                    THEN ROUND((100.0 * SUM(st.trials_correct) / SUM(st.trials_total))::numeric, 2)
                    ELSE 0 END AS pct,
               (SUM(st.trials_total) >= $4
                AND (100.0 * SUM(st.trials_correct) / NULLIF(SUM(st.trials_total), 0)) >= $5) AS qualifies
             FROM sessions_aba s
             JOIN session_targets st
               ON st.tenant_id = s.tenant_id AND st.session_id = s.id AND st.protocol_id = $1::uuid
             WHERE s.tenant_id = $2::uuid
               AND s.learner_id = $3::uuid
               AND s.status = 'completed'
               AND s.ended_at IS NOT NULL
               AND s.ended_at >= $6::timestamptz
             GROUP BY s.id
           ) q`,
          [id, tenantId, proto.learner_id, proto.mastery_criteria_trials, proto.mastery_criteria_pct, anchor]
        )
        const c = crit.rows[0]
        const qualifiedSessions: number = c.qualified_sessions
        const requiredSessions: number = proto.mastery_criteria_sessions

        if (qualifiedSessions < requiredSessions) {
          if (!reason) {
            return {
              validationError: {
                status: 422,
                error: `Critério de domínio não atingido (${qualifiedSessions}/${requiredSessions} sessões qualificadas). Informe um motivo para marcar como Dominado mesmo assim.`,
                details: {
                  qualified_sessions: qualifiedSessions,
                  required_sessions: requiredSessions,
                  completed_sessions_with_targets: c.completed_sessions_with_targets,
                  mastery_criteria_pct: proto.mastery_criteria_pct,
                  mastery_criteria_trials: proto.mastery_criteria_trials,
                  best_session_pct: c.best_session_pct,
                  max_trials_in_session: c.max_trials_in_session,
                },
              },
            }
          }
          // Critério não batido, mas com motivo → override auditado (registrado após o UPDATE).
          masteredOverride = {
            qualified: qualifiedSessions,
            required: requiredSessions,
            completedWithTargets: c.completed_sessions_with_targets,
            bestPct: c.best_session_pct,
            maxTrials: c.max_trials_in_session,
            anchor: anchor instanceof Date ? anchor.toISOString() : String(anchor),
          }
        }
      }

      const sets: string[] = ['updated_at = NOW()']
      const p: any[] = []

      if (status) {
        p.push(status); sets.push(`status = $${p.length}`)
        const ts: Record<string,string> = {
          active: 'activated_at',
          mastered: 'mastered_at',
          generalization: 'generalized_at',
          mastered_validated: 'mastered_validated_at',
          maintenance: 'maintenance_started_at',
          maintained: 'maintained_at',
          suspended: 'suspended_at',
          discontinued: 'discontinued_at',
          archived: 'archived_at',
        }
        if (ts[status]) { p.push(new Date().toISOString()); sets.push(`${ts[status]} = $${p.length}::timestamptz`) }
        // [P1] Reversao mastered->active: limpa mastered_at SOMENTE se o protocolo estava 'mastered'.
        // No UPDATE do Postgres, `status` no RHS refere-se ao valor ANTIGO (pre-update).
        if (status === 'active') { sets.push(`mastered_at = CASE WHEN status = 'mastered' THEN NULL ELSE mastered_at END`) }
        if (status === 'discontinued' && discontinuation_reason) { p.push(discontinuation_reason); sets.push(`discontinuation_reason = $${p.length}::text`) }
      }

      if (pei_goal_id !== undefined) {
        p.push(pei_goal_id || null); sets.push(`pei_goal_id = $${p.length}::uuid`)
      }

      p.push(id, tenantId)
      const q = `UPDATE learner_protocols SET ${sets.join(', ')} WHERE id = $${p.length-1}::uuid AND tenant_id = $${p.length}::uuid RETURNING *`

      const updated = await client.query(q, p)
      if (updated.rows.length === 0) return { protocol: null, maintenance_probes: [] }

      const protocol = updated.rows[0]

      // C1: 'mastered' concedido sem bater o critério (override com motivo) → audit explícito.
      if (status === 'mastered' && masteredOverride) {
        await client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
           VALUES ($1::uuid, $2::text, 'human', 'PROTOCOL_MASTERED_OVERRIDE', 'learner_protocols', $3::uuid, $4::jsonb, NOW())`,
          [tenantId, userId || 'system', id, JSON.stringify({
            reason,
            previous_status: proto.current_status,
            new_status: 'mastered',
            qualified_sessions: masteredOverride.qualified,
            required_sessions: masteredOverride.required,
            completed_sessions_with_targets: masteredOverride.completedWithTargets,
            mastery_criteria_pct: proto.mastery_criteria_pct,
            mastery_criteria_sessions: proto.mastery_criteria_sessions,
            mastery_criteria_trials: proto.mastery_criteria_trials,
            best_session_pct: masteredOverride.bestPct,
            max_trials_in_session: masteredOverride.maxTrials,
            cycle_anchor: masteredOverride.anchor,
            source: 'aba_protocols_patch',
          })]
        )
      }

      // ─── Bible S3: Auto-criar 3 sondas ao entrar em "maintenance" ───
      let maintenanceProbes: any[] = []
      if (status === 'maintenance') {
        const baseDate = protocol.maintenance_started_at || new Date()
        const schedules = [
          { weeks: 2,  label: 'Sonda 2 semanas' },
          { weeks: 6,  label: 'Sonda 6 semanas' },
          { weeks: 12, label: 'Sonda 12 semanas' },
        ]

        for (const s of schedules) {
          const scheduledAt = new Date(baseDate)
          scheduledAt.setDate(scheduledAt.getDate() + s.weeks * 7)

          const existing = await client.query(
            'SELECT id FROM maintenance_probes WHERE protocol_id = $1::uuid AND tenant_id = $2::uuid AND week_number = $3::int',
            [id, tenantId, s.weeks])
          if (existing.rows.length > 0) continue

          const ins = await client.query(
            `INSERT INTO maintenance_probes (tenant_id, protocol_id, learner_id, week_number, label, scheduled_at, status)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::int, $5::text, $6::timestamptz, 'pending') RETURNING *`,
            [tenantId, id, protocol.learner_id, s.weeks, s.label, scheduledAt])
          maintenanceProbes.push(ins.rows[0])
        }

        if (maintenanceProbes.length > 0) {
          await client.query(
            `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
             VALUES ($1::uuid, $2::text, 'system', 'MAINTENANCE_PROBES_AUTO_CREATED', 'maintenance_probes',
             jsonb_build_object('protocol_id', $3::text, 'probes_created', $4::int, 'weeks', ARRAY[2,6,12]::int[]), NOW())`,
            [tenantId, userId || 'system', id, maintenanceProbes.length])
        }
      }

      return { protocol, maintenance_probes: maintenanceProbes }
    })

    if ('validationError' in result && result.validationError) {
      return NextResponse.json(
        { error: result.validationError.error, details: result.validationError.details },
        { status: result.validationError.status }
      )
    }
    if (!result.protocol) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    // A6: erro de transição do trigger (RAISE '[AXIS ABA] ...') → 422 amigável com o motivo.
    // Demais erros (FK/NOT NULL 23xxx, bugs) seguem 500 logado — não viram 422 genérico.
    if (typeof error?.message === 'string' && error.message.includes('[AXIS ABA]')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error("PATCH protocol error:", error)
    return NextResponse.json({ error: 'Erro ao atualizar protocolo' }, { status: 500 })
  }
}
