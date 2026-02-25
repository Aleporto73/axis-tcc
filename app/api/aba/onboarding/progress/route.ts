import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// =====================================================
// Anexo D — Onboarding Progress (Lacuna 9)
//
// GET:  Carrega estado atual do wizard (server-side)
// PATCH: Salva progresso parcial a cada passo
// =====================================================

// GET — Carregar estado do onboarding
export async function GET() {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      // Progresso do wizard
      const progress = await client.query(
        'SELECT * FROM onboarding_progress WHERE tenant_id = $1',
        [tenantId]
      )

      // Dados já preenchidos no tenant
      const tenant = await client.query(
        `SELECT clinic_name, cnpj, phone, address_street, address_city,
                address_state, address_zip, plan_tier, onboarding_completed_at
         FROM tenants WHERE id = $1`,
        [tenantId]
      )

      // Dados do RT (profile admin)
      const profile = await client.query(
        `SELECT name, crp, crp_uf, specialty, email
         FROM profiles WHERE tenant_id = $1 AND role = 'admin' AND is_active = true
         LIMIT 1`,
        [tenantId]
      )

      // Documentos já enviados
      const docs = await client.query(
        'SELECT id, doc_type, filename, verified FROM clinic_documents WHERE tenant_id = $1',
        [tenantId]
      )

      // Compliance aceitos
      const compliance = await client.query(
        'SELECT item_key, label, accepted FROM compliance_checklist WHERE tenant_id = $1',
        [tenantId]
      )

      // Protocolos-modelo disponíveis
      const library = await client.query(
        'SELECT id, title, domain, objective, ebp_practice_name, difficulty_level, tags FROM protocol_library WHERE is_active = true ORDER BY difficulty_level, title'
      )

      // Convites pendentes
      const invites = await client.query(
        `SELECT id, email, role, name, is_active FROM profiles
         WHERE tenant_id = $1 AND clerk_user_id LIKE 'pending_%'`,
        [tenantId]
      )

      return {
        progress: progress.rows[0] || null,
        tenant: tenant.rows[0] || null,
        profile: profile.rows[0] || null,
        documents: docs.rows,
        compliance: compliance.rows,
        protocol_library: library.rows,
        pending_invites: invites.rows,
        completed: !!tenant.rows[0]?.onboarding_completed_at,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH — Salvar progresso parcial
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { current_step, step_id, clinic_data, rt_data, plan_data, compliance_data, skipped } = body

    const result = await withTenant(async ({ client, tenantId }) => {
      // Upsert do progresso
      const existing = await client.query(
        'SELECT tenant_id, steps_completed FROM onboarding_progress WHERE tenant_id = $1',
        [tenantId]
      )

      let stepsCompleted: string[] = []
      if (existing.rows.length > 0) {
        stepsCompleted = existing.rows[0].steps_completed || []
      }

      // Adicionar step_id se fornecido e não duplicado
      if (step_id && !stepsCompleted.includes(step_id)) {
        stepsCompleted.push(step_id)
      }

      const upserted = await client.query(
        `INSERT INTO onboarding_progress (tenant_id, current_step, steps_completed, clinic_data, rt_data, plan_data, compliance_data, skipped, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET
           current_step = COALESCE($2, onboarding_progress.current_step),
           steps_completed = $3,
           clinic_data = COALESCE($4, onboarding_progress.clinic_data),
           rt_data = COALESCE($5, onboarding_progress.rt_data),
           plan_data = COALESCE($6, onboarding_progress.plan_data),
           compliance_data = COALESCE($7, onboarding_progress.compliance_data),
           skipped = COALESCE($8, onboarding_progress.skipped),
           updated_at = NOW()
         RETURNING *`,
        [
          tenantId,
          current_step ?? 0,
          JSON.stringify(stepsCompleted),
          clinic_data ? JSON.stringify(clinic_data) : null,
          rt_data ? JSON.stringify(rt_data) : null,
          plan_data ? JSON.stringify(plan_data) : null,
          compliance_data ? JSON.stringify(compliance_data) : null,
          skipped ?? false,
        ]
      )

      return upserted.rows[0]
    })

    return NextResponse.json({ progress: result })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
