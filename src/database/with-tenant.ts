import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import pool from './db'
import { PoolClient } from 'pg'

// =====================================================
// AXIS ABA - Tenant Context com Roles (Multi-Terapeuta)
// Conforme AXIS ABA Bible v2.6.1
//
// Suporta múltiplos tenants por usuário:
//   - Auto-ativa convites pendentes por email
//   - Se múltiplos tenants → usa cookie axis_active_tenant
//   - Se nenhum cookie → lança TenantSelectionRequired
// =====================================================

export type UserRole = 'admin' | 'supervisor' | 'terapeuta'

export interface TenantContext {
  tenantId: string
  userId: string        // clerk_user_id
  profileId: string     // profiles.id
  role: UserRole
  client: PoolClient
}

export interface TenantOption {
  tenant_id: string
  tenant_name: string
  role: string
  profile_id: string
}

/**
 * Erro especial: usuário tem múltiplos tenants e precisa escolher.
 */
export class TenantSelectionRequired extends Error {
  public statusCode = 409
  public tenants: TenantOption[]

  constructor(tenants: TenantOption[]) {
    super('Seleção de clínica necessária')
    this.name = 'TenantSelectionRequired'
    this.tenants = tenants
  }
}

/**
 * Resolve contexto do tenant via tabela profiles.
 *
 * Fluxo:
 *   1. Auto-ativa convites pendentes (pending_%) que batem com o email do usuário
 *   2. Busca TODOS os profiles ativos do usuário
 *   3. Se 1 profile → usa direto
 *   4. Se múltiplos → verifica cookie axis_active_tenant para selecionar
 *   5. Fallback: busca em tenants (compatibilidade pré-migração)
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

    // ─── Passo 1: Auto-ativar convites pendentes ───
    // Buscar email do usuário a partir de um profile ativo existente
    const emailCheck = await client.query(
      `SELECT email FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1`,
      [userId]
    )

    if (emailCheck.rows.length > 0 && emailCheck.rows[0].email) {
      const userEmail = emailCheck.rows[0].email
      // Ativar convites pendentes que batem com esse email
      const activated = await client.query(
        `UPDATE profiles
         SET clerk_user_id = $1, is_active = true, updated_at = NOW()
         WHERE LOWER(email) = LOWER($2)
         AND clerk_user_id LIKE 'pending_%'
         AND is_active = false
         RETURNING id, tenant_id`,
        [userId, userEmail]
      )
      if (activated.rows.length > 0) {
        // Registrar audit log para cada ativação
        for (const row of activated.rows) {
          try {
            await client.query(
              `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
               VALUES ($1, $2, 'system', 'INVITE_AUTO_ACTIVATED', 'profile', $3, $4, NOW())`,
              [row.tenant_id, userId, row.id, JSON.stringify({ email: userEmail, source: 'with_tenant_auto_activate' })]
            )
          } catch (_) { /* audit non-blocking */ }
        }
      }
    }

    // ─── Passo 2: Buscar TODOS os profiles ativos ───
    const profileResult = await client.query(
      `SELECT p.id AS profile_id, p.tenant_id, p.role, t.name AS tenant_name
       FROM profiles p
       JOIN tenants t ON t.id = p.tenant_id
       WHERE p.clerk_user_id = $1 AND p.is_active = true
       ORDER BY p.role = 'admin' DESC, p.created_at ASC`,
      [userId]
    )

    let tenantId: string
    let profileId: string
    let role: UserRole

    if (profileResult.rows.length > 1) {
      // ─── Múltiplos tenants: verificar cookie ───
      const cookieStore = await cookies()
      const selectedTenant = cookieStore.get('axis_active_tenant')?.value

      const match = selectedTenant
        ? profileResult.rows.find((r: any) => r.tenant_id === selectedTenant)
        : null

      if (match) {
        tenantId = match.tenant_id
        profileId = match.profile_id
        role = match.role as UserRole
      } else {
        // Sem cookie ou cookie inválido → precisa selecionar
        await client.query('ROLLBACK')
        client.release()
        throw new TenantSelectionRequired(
          profileResult.rows.map((r: any) => ({
            tenant_id: r.tenant_id,
            tenant_name: r.tenant_name,
            role: r.role,
            profile_id: r.profile_id,
          }))
        )
      }
    } else if (profileResult.rows.length === 1) {
      // ─── Um único tenant: usa direto ───
      tenantId = profileResult.rows[0].tenant_id
      profileId = profileResult.rows[0].profile_id
      role = profileResult.rows[0].role as UserRole
    } else {
      // ─── Fallback: buscar em tenants (compatibilidade pré-migração) ───
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
    if (error instanceof TenantSelectionRequired) {
      throw error // já fez rollback e release acima
    }
    await client.query('ROLLBACK')
    throw error
  } finally {
    // Só release se ainda conectado (TenantSelectionRequired já fez release)
    try { client.release() } catch (_) { /* already released */ }
  }
}
