import { auth } from '@clerk/nextjs/server'
import pool from './db'
import { PoolClient } from 'pg'

interface TenantContext {
  tenantId: string
  userId: string
  client: PoolClient
}

export async function withTenant<T>(
  callback: (ctx: TenantContext) => Promise<T>
): Promise<T> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error('Não autenticado')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const tenantResult = await client.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )

    if (tenantResult.rows.length === 0) {
      throw new Error('Tenant não encontrado')
    }

    const tenantId = tenantResult.rows[0].id

    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])

    const result = await callback({ tenantId, userId, client })

    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
