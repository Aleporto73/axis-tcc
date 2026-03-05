import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import pool from '@/src/database/db'
import SidebarABA from '../components/SidebarABA'
import { RoleProvider } from '../components/RoleProvider'
import ErrorBoundary from '../components/ErrorBoundary'
import OnboardingABA from '../components/OnboardingABA'

// =====================================================
// AXIS ABA - Layout Limpo (sem redirect de onboarding)
//
// Auth → Tenant → Licença → Renderiza
// Onboarding é um overlay client-side (<OnboardingABA />)
// que checa a API e aparece/desaparece sozinho.
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

  // Verificar licença ABA por tenant_id (não clerk_user_id — suporta auto-provisioning)
  let hasLicense = true
  try {
    const licenseResult = await pool.query(
      'SELECT is_active FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 AND is_active = true LIMIT 1',
      [tenantId, 'aba']
    )
    if (licenseResult.rows.length > 0) {
      hasLicense = true
    } else {
      hasLicense = false
    }
  } catch (err) {
    console.warn('[ABA Layout] user_licenses query failed, allowing access:', err instanceof Error ? err.message : String(err))
    hasLicense = true
  }

  if (!hasLicense) {
    await logAccessDenied(tenantId, userId, 'no_active_license')
    redirect('/hub')
  }

  // Sem redirect de onboarding aqui!
  // O <OnboardingABA /> é um overlay client-side que verifica via API.
  // Se o onboarding não foi feito, ele aparece cobrindo tudo.
  // Quando o usuário completa, ele some e o conteúdo já está pronto abaixo.

  return (
    <RoleProvider>
      <div className="min-h-screen bg-white">
        <OnboardingABA />
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
