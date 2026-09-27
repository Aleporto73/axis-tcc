import type { PoolClient } from 'pg'

export function sessionNumberLockKey(tenantId: string, patientId: string): string {
  return `axis:tcc:session_number:${tenantId}:${patientId}`
}

/**
 * Próximo session_number do paciente (MAX + 1): nunca repete número existente e nunca renumera.
 */
export async function nextSessionNumber(
  client: PoolClient,
  tenantId: string,
  patientId: string
): Promise<number> {
  // A trava é de transação: fora de uma transação ela seria solta no fim deste próprio SELECT.
  const lock = await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0)), current_setting('app.tenant_id', true) AS tenant_guc",
    [sessionNumberLockKey(tenantId, patientId)]
  )
  if (lock.rows[0]?.tenant_guc !== tenantId) {
    throw new Error('nextSessionNumber exige transação aberta com app.tenant_id do mesmo tenant')
  }

  const result = await client.query(
    'SELECT COALESCE(MAX(session_number), 0) + 1 AS next FROM sessions WHERE tenant_id = $1 AND patient_id = $2',
    [tenantId, patientId]
  )
  return Number(result.rows[0].next)
}
