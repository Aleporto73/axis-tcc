import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import pool from '@/src/database/db'
import SidebarABA from '../components/SidebarABA'

async function logAccessDenied(
  tenantId: string,
  userId: string,
  reason: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
       VALUES ($1, $2, 'system', 'MODULE_ACCESS_DENIED', 'module', $3, NOW())`,
      [tenantId, userId, JSON.stringify({ module: 'aba', reason })]
    )
  } catch (err) {
    console.error('[AXIS AUDIT] FALHA ao registrar DENIED:', {
      userId, tenantId, reason,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export default async function ABALayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/')
  }

  const tenantResult = await pool.query(
    'SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
    [userId]
  )

  if (!tenantResult.rows[0]?.id) {
    redirect('/hub')
  }

  const tenantId = tenantResult.rows[0].id

  const licenseResult = await pool.query(
    'SELECT is_active FROM user_licenses WHERE clerk_user_id = $1 AND product_type = $2 LIMIT 1',
    [userId, 'aba']
  )

  const hasLicense = licenseResult.rows[0]?.is_active === true

  if (!hasLicense) {
    await logAccessDenied(tenantId, userId, 'no_active_license')
    redirect('/hub')
  }

  return (
    <div className="min-h-screen bg-white">
      <SidebarABA />
      <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
        {children}
      </main>
    </div>
  )
}
