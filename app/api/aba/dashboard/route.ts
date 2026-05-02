import { NextResponse } from 'next/server'
import { withTenant, TenantContext } from '@/src/database/with-tenant'
import { learnerFilter, sessionFilter, handleRouteError } from '@/src/database/with-role'
import { cache } from '@/src/database/redis'

// =====================================================
// AXIS ABA - Dashboard (Multi-Terapeuta)
// admin/supervisor: KPIs globais. terapeuta: KPIs filtrados.
//
// Cache Redis: 5 min (cache.DEFAULT_TTL = 300s)
// Chave: dashboard:aba:{tenantId}:{profileId}
//   - admin/supervisor: profileId = "clinic" (compartilham mesma view)
//   - terapeuta: profileId real (dados pessoais)
// =====================================================

const CACHE_TTL = cache.DEFAULT_TTL // 300s = 5 min

/**
 * Monta chave de cache scoped por tenant + role.
 * Admin/supervisor compartilham cache (mesmos KPIs clínica inteira).
 * Terapeuta tem cache individual (KPIs pessoais).
 */
function cacheKey(ctx: TenantContext): string {
  const scope = ctx.role === 'terapeuta' ? ctx.profileId : 'clinic'
  return `dashboard:aba:${ctx.tenantId}:${scope}`
}

/**
 * Executa as queries de KPI no PostgreSQL.
 * Extraído para ser usado dentro do cache.wrap.
 */
async function fetchKPIs(ctx: TenantContext) {
  const { client, tenantId } = ctx

  const engineResult = await client.query(
    'SELECT version FROM engine_versions WHERE is_current = true LIMIT 1'
  )

  if (!engineResult.rows[0]?.version) {
    console.error('[AXIS ABA] CRITICAL: Nenhuma engine_version ativa encontrada.')
    return null // sinaliza erro
  }

  const engineVersion = engineResult.rows[0].version

  // Subquery para filtrar learners por role
  const learnerSubquery = ctx.role === 'terapeuta'
    ? `SELECT learner_id FROM learner_therapists WHERE profile_id = $2 AND tenant_id = $1`
    : `SELECT id FROM learners WHERE tenant_id = $1`

  const baseParams: any[] = ctx.role === 'terapeuta'
    ? [tenantId, ctx.profileId]
    : [tenantId]

  // KPIs básicos
  const metricsResult = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM learners WHERE tenant_id = $1 AND id IN (${learnerSubquery}))::int
        AS total_learners,
      (SELECT COUNT(*) FROM sessions_aba WHERE tenant_id = $1 AND DATE(scheduled_at) = CURRENT_DATE
        ${ctx.role === 'terapeuta' ? 'AND therapist_id = (SELECT clerk_user_id FROM profiles WHERE id = $2)' : ''})::int
        AS sessions_today,
      (SELECT COUNT(*) FROM sessions_aba WHERE tenant_id = $1 AND scheduled_at >= CURRENT_DATE - INTERVAL '7 days'
        ${ctx.role === 'terapeuta' ? 'AND therapist_id = (SELECT clerk_user_id FROM profiles WHERE id = $2)' : ''})::int
        AS sessions_week,
      (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1 AND status = 'active'
        AND learner_id IN (${learnerSubquery}))::int
        AS active_protocols,
      (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1 AND status = 'mastered'
        AND learner_id IN (${learnerSubquery}))::int
        AS mastered_protocols,
      (SELECT ROUND(AVG(cs.cso_aba)) FROM clinical_states_aba cs
        INNER JOIN (SELECT learner_id, MAX(created_at) AS last FROM clinical_states_aba WHERE tenant_id = $1
          AND learner_id IN (${learnerSubquery}) GROUP BY learner_id) latest
        ON cs.learner_id = latest.learner_id AND cs.created_at = latest.last WHERE cs.tenant_id = $1)::int
        AS avg_cso,
      (SELECT COUNT(DISTINCT cs.learner_id) FROM clinical_states_aba cs
        INNER JOIN (SELECT learner_id, MAX(created_at) AS last FROM clinical_states_aba WHERE tenant_id = $1
          AND learner_id IN (${learnerSubquery}) GROUP BY learner_id) latest
        ON cs.learner_id = latest.learner_id AND cs.created_at = latest.last WHERE cs.tenant_id = $1 AND cs.cso_band = 'critico')::int
        AS learners_critical
  `, baseParams)

  // KPIs avançados
  const advancedResult = await client.query(`
    SELECT
      (SELECT CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status IN ('mastered','maintained','generalization','maintenance'))::numeric / COUNT(*)::numeric * 100)
        ELSE 0 END
       FROM learner_protocols WHERE tenant_id = $1 AND learner_id IN (${learnerSubquery}))::int
        AS mastery_rate,

      (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1 AND learner_id IN (${learnerSubquery}))::int
        AS total_protocols,

      (SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (mastered_at - activated_at)) / 86400)), 0)
       FROM learner_protocols WHERE tenant_id = $1 AND mastered_at IS NOT NULL AND activated_at IS NOT NULL
        AND learner_id IN (${learnerSubquery}))::int
        AS avg_days_to_mastery,

      (SELECT COUNT(*) FROM sessions_aba WHERE tenant_id = $1 AND status = 'completed'
        ${ctx.role === 'terapeuta' ? 'AND therapist_id = (SELECT clerk_user_id FROM profiles WHERE id = $2)' : ''})::int
        AS total_sessions_completed,

      (SELECT COALESCE(ROUND(AVG(duration_minutes)), 0)
       FROM sessions_aba WHERE tenant_id = $1 AND status = 'completed' AND duration_minutes IS NOT NULL
        ${ctx.role === 'terapeuta' ? 'AND therapist_id = (SELECT clerk_user_id FROM profiles WHERE id = $2)' : ''})::int
        AS avg_session_duration,

      (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1 AND status = 'regression'
        AND learner_id IN (${learnerSubquery}))::int
        AS protocols_regression,

      (SELECT CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status = 'cancelled')::numeric / COUNT(*)::numeric * 100)
        ELSE 0 END
       FROM sessions_aba WHERE tenant_id = $1 AND scheduled_at >= CURRENT_DATE - INTERVAL '30 days'
        ${ctx.role === 'terapeuta' ? 'AND therapist_id = (SELECT clerk_user_id FROM profiles WHERE id = $2)' : ''})::int
        AS cancel_rate_30d,

      (SELECT COUNT(*) FROM learner_protocols WHERE tenant_id = $1 AND status IN ('generalization','maintenance')
        AND learner_id IN (${learnerSubquery}))::int
        AS protocols_gen_maint,

      (SELECT COALESCE(SUM(regression_count), 0)
       FROM learner_protocols WHERE tenant_id = $1 AND learner_id IN (${learnerSubquery}))::int
        AS total_regressions,

      (SELECT COUNT(DISTINCT learner_id) FROM learner_protocols WHERE tenant_id = $1 AND status = 'active'
        AND learner_id IN (${learnerSubquery}))::int
        AS active_learners
  `, baseParams)

  const row = metricsResult.rows[0]
  const adv = advancedResult.rows[0]

  return {
    total_learners: row.total_learners,
    sessions_today: row.sessions_today,
    sessions_week: row.sessions_week,
    active_protocols: row.active_protocols,
    mastered_protocols: row.mastered_protocols || 0,
    avg_cso: row.avg_cso || null,
    learners_critical: row.learners_critical || 0,
    engine_version: engineVersion,
    mastery_rate: adv.mastery_rate || 0,
    total_protocols: adv.total_protocols || 0,
    avg_days_to_mastery: adv.avg_days_to_mastery || 0,
    total_sessions_completed: adv.total_sessions_completed || 0,
    avg_session_duration: adv.avg_session_duration || 0,
    protocols_regression: adv.protocols_regression || 0,
    cancel_rate_30d: adv.cancel_rate_30d || 0,
    protocols_gen_maint: adv.protocols_gen_maint || 0,
    total_regressions: adv.total_regressions || 0,
    active_learners: adv.active_learners || 0,
    _scope: ctx.role === 'terapeuta' ? 'personal' as const : 'clinic' as const,
    _role: ctx.role,
  }
}

export async function GET() {
  try {
    return await withTenant(async (ctx) => {
      const key = cacheKey(ctx)

      // cache.wrap: busca do Redis, se miss executa fetchKPIs e salva por 5 min
      const data = await cache.wrap(key, CACHE_TTL, () => fetchKPIs(ctx))

      // fetchKPIs retorna null se engine_version não encontrada
      if (data === null) {
        return NextResponse.json(
          { error: 'ENGINE_VERSION_MISSING', message: 'Versão do motor clínico não encontrada. Contacte o suporte.' },
          { status: 503 }
        )
      }

      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
          'X-Cache-Key': key,
        },
      })
    })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
