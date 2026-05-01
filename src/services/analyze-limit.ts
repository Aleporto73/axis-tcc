import type { PoolClient } from 'pg'

// =====================================================
// AXIS Item 2 Onda 7 - Helper de quota/audit pra rotas analyze-*
//
// Espelha src/services/transcription-limit.ts mas em modelo per-row
// (tabela analyze_usage criada na migration 065). Cobre as 2 rotas
// analyze-clinical (/api/analyze-clinical) e analyze-tcc
// (/api/analyze-tcc) + helper server-side runTccAnalysis em
// /api/sessions/[id]/report/generate.
//
// Limite Free: 50 requests por tenant nos ultimos 30 dias (rolling).
// Pago: ilimitado.
// =====================================================

export const FREE_LIMIT_REQUESTS = 50
export const ROLLING_WINDOW_DAYS = 30

export type AnalyzeRoute = 'analyze-clinical' | 'analyze-tcc'

export interface AnalyzeUsageStatus {
  /** Numero de requests no rolling window de 30 dias */
  requests_used: number
  /** Limite (null = ilimitado pra planos pagos) */
  limit: number | null
  /** True se tenant esta no plano free (sem hotmart_plan ativo) */
  is_free: boolean
  /** True se atingiu o limite (so true se is_free) */
  limit_reached: boolean
}

/**
 * Retorna uso acumulado de analyze (analyze-clinical + analyze-tcc) no
 * rolling window de 30 dias.
 *
 * Free: limite de FREE_LIMIT_REQUESTS no rolling 30d.
 * Pago: ilimitado (limit = null).
 *
 * Mensal rolling (nao calendario) pra previsibilidade UX (limite reseta
 * dia a dia, nao todo dia 1).
 */
export async function getAnalyzeUsage(
  client: PoolClient,
  tenantId: string
): Promise<AnalyzeUsageStatus> {
  const [licenseRes, usageRes] = await Promise.all([
    client.query(
      `SELECT hotmart_plan FROM user_licenses
        WHERE tenant_id = $1
          AND product_type = 'tcc'
          AND is_active = true
        LIMIT 1`,
      [tenantId]
    ),
    client.query(
      `SELECT COUNT(*)::int AS total
         FROM analyze_usage
        WHERE tenant_id = $1
          AND created_at >= NOW() - INTERVAL '${ROLLING_WINDOW_DAYS} days'`,
      [tenantId]
    ),
  ])

  const isFree = !licenseRes.rows[0]?.hotmart_plan || licenseRes.rows[0].hotmart_plan === ''
  const requestsUsed = Number(usageRes.rows[0]?.total ?? 0)
  const limit = isFree ? FREE_LIMIT_REQUESTS : null
  const limitReached = isFree && requestsUsed >= FREE_LIMIT_REQUESTS

  return {
    requests_used: requestsUsed,
    limit,
    is_free: isFree,
    limit_reached: limitReached,
  }
}

export interface RecordAnalyzeUsageParams {
  tenantId: string
  /** clerk_user_id do request (mesmo padrao axis_audit_logs.user_id) */
  userId: string
  route: AnalyzeRoute
  /** response.usage.total_tokens do OpenAI */
  tokensUsed: number
  /** Modelo OpenAI usado (default: gpt-4o-mini) */
  model?: string
  /** UUID do paciente (audit + dashboard) */
  patientId?: string | null
  /** Caracteres do input (audit/analytics) */
  transcriptLength?: number | null
}

/**
 * Registra um uso de analyze. Chamado APOS sucesso do OpenAI, antes de
 * retornar a response ao client. Idempotencia: cada request gera 1 row
 * (sem ON CONFLICT - duplicar nao e problema, audit per-row).
 *
 * RLS: tabela tem tenant_isolation forced; client.query precisa estar
 * dentro de withTenant (GUC app.tenant_id setado) ou INSERT lanca
 * [AXIS RLS] exception.
 */
export async function recordAnalyzeUsage(
  client: PoolClient,
  params: RecordAnalyzeUsageParams
): Promise<void> {
  await client.query(
    `INSERT INTO analyze_usage (
       tenant_id, user_id, route, tokens_used, model, patient_id, transcript_length
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.tenantId,
      params.userId,
      params.route,
      params.tokensUsed,
      params.model ?? 'gpt-4o-mini',
      params.patientId ?? null,
      params.transcriptLength ?? null,
    ]
  )
}
