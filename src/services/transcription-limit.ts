import type { PoolClient } from 'pg'
import { getLicenseStatus } from '@/src/billing/license'

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
 * - Pago (plan_key da licenca TCC, src/billing/license.ts): ilimitado (limit = null)
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
  const [license, usageRes] = await Promise.all([
    getLicenseStatus(client, tenantId, 'tcc'),
    client.query(
      `SELECT COALESCE(SUM(minutes_used), 0)::int AS total
       FROM transcription_usage WHERE tenant_id = $1`,
      [tenantId]
    ),
  ])

  const isFree = !license.paid
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
