import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// =====================================================
// Onboarding Progress v2 — Simplificado
//
// GET: Verifica se onboarding já foi completado + dados do profile
// PATCH: Não necessário no onboarding de 2 etapas (mantido como no-op)
// =====================================================

export async function GET() {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      // Verificar se onboarding já foi completado
      const tenant = await client.query(
        `SELECT onboarding_completed_at FROM tenants WHERE id = $1`,
        [tenantId]
      )

      // Dados do profile (para pré-preencher nome/specialty)
      const profile = await client.query(
        `SELECT name, specialty
         FROM profiles WHERE tenant_id = $1 AND role = 'admin' AND is_active = true
         LIMIT 1`,
        [tenantId]
      )

      return {
        completed: !!tenant.rows[0]?.onboarding_completed_at,
        profile: profile.rows[0] || null,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.error('Onboarding progress error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH — No-op para onboarding v2 (2 etapas não precisam de progresso parcial)
export async function PATCH() {
  return NextResponse.json({ ok: true })
}
