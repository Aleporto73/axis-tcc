import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import pool from '@/src/database/db'
import SidebarABA from '../components/SidebarABA'
import { RoleProvider } from '../components/RoleProvider'
import ErrorBoundary from '../components/ErrorBoundary'

// =====================================================
// AXIS ABA - Layout com Role Provider (Multi-Terapeuta)
// Resolve profile via profiles → fallback tenants
// =====================================================

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

  // Resolver tenant via profiles (novo modelo) → fallback tenants (compatibilidade)
  let tenantId: string | null = null

  // Tentar via profiles primeiro
  const profileResult = await pool.query(
    'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
    [userId]
  )

  if (profileResult.rows.length > 0) {
    tenantId = profileResult.rows[0].tenant_id
  } else {
    // Fallback: tenants direta
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
      [userId]
    )
    tenantId = tenantResult.rows[0]?.id || null
  }

  if (!tenantId) {
    redirect('/hub')
  }

  // Verificar licença ABA
  const licenseResult = await pool.query(
    'SELECT is_active FROM user_licenses WHERE clerk_user_id = $1 AND product_type = $2 LIMIT 1',
    [userId, 'aba']
  )

  const hasLicense = licenseResult.rows[0]?.is_active === true

  if (!hasLicense) {
    await logAccessDenied(tenantId, userId, 'no_active_license')
    redirect('/hub')
  }

  // ─── Verificar onboarding ───
  // Se o onboarding não foi concluído, redirecionar para o wizard
  // (exceto se já estiver na rota /aba/onboarding para evitar loop)
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  const isOnboardingRoute = pathname.startsWith('/aba/onboarding')

  if (!isOnboardingRoute) {
    const onboardingResult = await pool.query(
      'SELECT onboarding_completed_at FROM tenants WHERE id = $1',
      [tenantId]
    )

    const onboardingCompleted = onboardingResult.rows[0]?.onboarding_completed_at != null

    if (!onboardingCompleted) {
      redirect('/aba/onboarding')
    }
  }

  return (
    <RoleProvider>
      <div className="min-h-screen bg-white">
        <SidebarABA />
        <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </RoleProvider>
  )
}
