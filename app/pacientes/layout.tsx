import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import pool from '@/src/database/db'

// =====================================================
// AXIS TCC - Layout Pacientes (Gate de licença TCC)
// Mesma lógica do dashboard/layout.tsx
// =====================================================

export default async function PacientesLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/')
  }

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

  try {
    const licenseResult = await pool.query(
      'SELECT is_active FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 AND is_active = true LIMIT 1',
      [tenantId, 'tcc']
    )
    if (licenseResult.rows.length === 0) {
      redirect('/hub')
    }
  } catch (err) {
    console.warn('[TCC Layout] user_licenses query failed, allowing access:', err instanceof Error ? err.message : String(err))
  }

  return <>{children}</>
}
