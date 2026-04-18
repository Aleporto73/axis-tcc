import type { PoolClient } from 'pg'

export const FREE_LIMIT_MINUTES = 300

export interface UsageStatus {
  minutes_used: number
  limit: number | null
  is_free: boolean
  limit_reached: boolean
}

/**
 * Retorna o uso acumulado de transcricao de um tenant (LIFETIME, nao mensal).
 *
 * - Free: limite de FREE_LIMIT_MINUTES (300 min vitalicio)
 * - Pago: ilimitado (limit = null)
 *
 * A leitura agrega SUM(minutes_used) sobre TODOS os meses em transcription_usage.
 * A gravacao (POST /api/tcc/transcription/usage) mantem UPSERT por mes
 * para preservar granularidade historica.
 *
 * Fase 12.2.
 */
export async function getTranscriptionUsage(
  client: PoolClient,
  tenantId: string
): Promise<UsageStatus> {
  const [licenseRes, usageRes] = await Promise.all([
    client.query(
      `SELECT hotmart_plan FROM user_licenses
       WHERE tenant_id = $1 AND product_type = 'tcc' AND is_active = true LIMIT 1`,
      [tenantId]
    ),
    client.query(
      `SELECT COALESCE(SUM(minutes_used), 0)::int AS total
       FROM transcription_usage WHERE tenant_id = $1`,
      [tenantId]
    ),
  ])

  const isFree = !licenseRes.rows[0]?.hotmart_plan || licenseRes.rows[0].hotmart_plan === ''
  const minutesUsed = Number(usageRes.rows[0]?.total ?? 0)
  const limit = isFree ? FREE_LIMIT_MINUTES : null
  const limitReached = isFree && minutesUsed >= FREE_LIMIT_MINUTES

  return {
    minutes_used: minutesUsed,
    limit,
    is_free: isFree,
    limit_reached: limitReached,
  }
}
