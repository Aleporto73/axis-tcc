import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// =====================================================
// Onboarding Light v2 — Setup simplificado
//
// POST: Salva nome + especialidade, marca onboarding completo.
//   1. Atualiza name/specialty em profiles
//   2. Marca onboarding_completed_at em tenants
//   3. Registra audit log
//
// Não depende de: onboarding_progress, compliance_checklist,
// protocol_library, protocol_templates, invite_tokens
// =====================================================

interface SetupPayload {
  name?: string
  specialty?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SetupPayload = await request.json()

    const displayName = body.name || ''
    const specialty = body.specialty || ''

    const result = await withTenant(async ({ client, tenantId, userId, profileId }) => {
      // ── 1. Atualizar nome e especialidade no profile ──
      await client.query(
        `UPDATE profiles SET
           name = COALESCE(NULLIF($1, ''), name),
           specialty = COALESCE(NULLIF($2, ''), specialty),
           updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [displayName, specialty, profileId, tenantId]
      )

      // ── 2. Marcar onboarding como completo ──
      const updateResult = await client.query(
        `UPDATE tenants SET onboarding_completed_at = NOW() WHERE id = $1 AND onboarding_completed_at IS NULL`,
        [tenantId]
      )
      console.log(`[Onboarding Setup] tenant=${tenantId}, rows_updated=${updateResult.rowCount}`)

      // ── 3. Audit log ──
      try {
        await client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, $3, 'ONBOARDING_COMPLETED', 'tenants',
           jsonb_build_object('name', $4, 'specialty', $5), NOW())`,
          [tenantId, userId, userId, displayName, specialty]
        )
      } catch {
        // audit log is non-critical — don't fail onboarding if table is missing
      }

      return { completed: true, name: displayName }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.error('Onboarding setup error:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
