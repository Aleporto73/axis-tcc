import { auth } from '@clerk/nextjs/server'
import pool from './db'
import { PoolClient } from 'pg'

// =====================================================
// AXIS ABA - Tenant Context com Roles (Multi-Terapeuta)
// Conforme AXIS ABA Bible v2.6.1
// =====================================================

export type UserRole = 'admin' | 'supervisor' | 'terapeuta'

export interface TenantContext {
  tenantId: string
  userId: string        // clerk_user_id
  profileId: string     // profiles.id
  role: UserRole
  client: PoolClient
}

/**
 * Resolve contexto do tenant via tabela profiles.
 * Fallback: se não encontrar em profiles, tenta tenants (compatibilidade migração).
 * Inclui role e profileId para autorização granular.
 */
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

    // Tentar resolver via profiles (novo modelo multi-terapeuta)
    const profileResult = await client.query(
      `SELECT p.id AS profile_id, p.tenant_id, p.role
       FROM profiles p
       WHERE p.clerk_user_id = $1 AND p.is_active = true
       LIMIT 1`,
      [userId]
    )

    let tenantId: string
    let profileId: string
    let role: UserRole

    if (profileResult.rows.length > 0) {
      tenantId = profileResult.rows[0].tenant_id
      profileId = profileResult.rows[0].profile_id
      role = profileResult.rows[0].role as UserRole
    } else {
      // Fallback: buscar em tenants (compatibilidade pré-migração)
      const tenantResult = await client.query(
        'SELECT id FROM tenants WHERE clerk_user_id = $1',
        [userId]
      )

      if (tenantResult.rows.length === 0) {
        throw new Error('Tenant não encontrado')
      }

      tenantId = tenantResult.rows[0].id
      profileId = tenantId // fallback: usar tenantId como profileId
      role = 'admin'       // fallback: tenant owner = admin
    }

    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])

    const result = await callback({ tenantId, userId, profileId, role, client })

    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
