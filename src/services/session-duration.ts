import type { PoolClient } from 'pg'

interface SessionRow {
  started_at: Date | null
  ended_at: Date | null
}

/**
 * Retorna a duracao canonica de uma sessao em minutos.
 *
 * Regra (Fase 13.1):
 * 1. Se existe transcript com audio_duration_seconds > 0 → duracao real do audio (fonte mais precisa)
 * 2. Senao, se started_at e ended_at existem → (ended - started) em minutos (fallback)
 * 3. Senao → 0
 *
 * Usar dentro de um withTenant() transaction para RLS ativo.
 */
export async function getSessionDuration(
  client: PoolClient,
  sessionId: string,
  tenantId: string
): Promise<number> {
  // 1. Tenta duracao real do audio
  const transcriptRes = await client.query(
    `SELECT audio_duration_seconds
     FROM transcripts
     WHERE session_id = $1
       AND tenant_id = $2
       AND audio_duration_seconds IS NOT NULL
       AND audio_duration_seconds > 0
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId, tenantId]
  )

  if (transcriptRes.rows.length > 0) {
    const seconds = Number(transcriptRes.rows[0].audio_duration_seconds)
    return Math.max(1, Math.ceil(seconds / 60))
  }

  // 2. Fallback: calculo manual via started_at/ended_at da sessao
  const sessionRes = await client.query(
    `SELECT started_at, ended_at FROM sessions WHERE id = $1 AND tenant_id = $2`,
    [sessionId, tenantId]
  )

  if (sessionRes.rows.length === 0) return 0

  const s = sessionRes.rows[0] as SessionRow
  if (!s.started_at) return 0

  const startedAt = new Date(s.started_at)
  const endedAt = s.ended_at ? new Date(s.ended_at) : new Date()

  const diffMs = endedAt.getTime() - startedAt.getTime()
  if (diffMs <= 0) return 0

  return Math.max(1, Math.round(diffMs / 60000))
}
