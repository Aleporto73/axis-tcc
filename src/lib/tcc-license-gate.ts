import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import pool from '@/src/database/db'

/**
 * Gate de licença TCC para layouts do App Router.
 * Verifica: Auth → Tenant → Licença TCC ativa.
 * Redireciona para /hub se qualquer verificação falhar.
 */
export async function requireTCCLicense(): Promise<void> {
  const { userId } = await auth()

  if (!userId) {
    redirect('/')
  }

  // Resolver tenant via profiles → fallback tenants
  let tenantId: string | null = null

  const profileResult = await pool.query(
    'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
    [userId]
  )

  if (profileResult.rows.length > 0) {
    tenantId = profileResult.rows[0].tenant_id
  } else {
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
      [userId]
    )
    tenantId = tenantResult.rows[0]?.id || null
  }

  if (!tenantId) {
    redirect('/hub')
  }

  // Verificar licença TCC ativa
  try {
    const licenseResult = await pool.query(
      'SELECT is_active FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 AND is_active = true LIMIT 1',
      [tenantId, 'tcc']
    )
    if (licenseResult.rows.length === 0) {
      redirect('/hub')
    }
  } catch (err) {
    console.warn('[TCC Gate] user_licenses query failed, blocking access:', err instanceof Error ? err.message : String(err))
    redirect('/hub')
  }
}
