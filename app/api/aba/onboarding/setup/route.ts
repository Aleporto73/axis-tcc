import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// =====================================================
// Anexo D — Onboarding Light: Setup Completo
//
// POST: Persiste TODOS os dados do wizard em transação única.
//   Lacuna 1: Dados da clínica (tenants)
//   Lacuna 2: CRP/UF do RT (profiles)
//   Lacuna 3: Convites de equipe (invite batch)
//   Lacuna 4: Seleção de plano
//   Lacuna 6: Checklist de conformidade
//   Lacuna 7: Protocolos-modelo selecionados
//   Lacuna 8: Esta API é a lacuna 8
//   Lacuna 9: Marca onboarding completo (banco)
//
// Lacuna 5 (upload de docs) é tratada em /onboarding/documents
// =====================================================

interface SetupPayload {
  // Lacuna 1: Dados da clínica
  clinic: {
    clinic_name: string
    cnpj?: string
    phone?: string
    address_street?: string
    address_city?: string
    address_state?: string
    address_zip?: string
  }

  // Lacuna 2: Responsável técnico
  rt: {
    name: string
    crp: string
    crp_uf: string
    specialty?: string
  }

  // Lacuna 3: Convites de equipe (emails)
  team_invites?: { email: string; role: 'supervisor' | 'terapeuta'; name?: string }[]

  // Lacuna 4: Plano selecionado
  plan_tier?: 'trial' | 'starter' | 'professional' | 'clinic'

  // Lacuna 6: Itens de compliance aceitos
  compliance_items?: { item_key: string; label: string; accepted: boolean }[]

  // Lacuna 7: IDs de protocolos-modelo selecionados
  selected_protocol_ids?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body: SetupPayload = await request.json()

    if (!body.clinic?.clinic_name) {
      return NextResponse.json({ error: 'clinic_name é obrigatório' }, { status: 400 })
    }
    if (!body.rt?.crp || !body.rt?.crp_uf) {
      return NextResponse.json({ error: 'CRP e UF do responsável técnico são obrigatórios' }, { status: 400 })
    }

    const result = await withTenant(async ({ client, tenantId, userId, profileId }) => {
      // ── Lacuna 1: Atualizar dados da clínica no tenant ──
      await client.query(
        `UPDATE tenants SET
           clinic_name = $1, cnpj = $2, phone = $3,
           address_street = $4, address_city = $5, address_state = $6, address_zip = $7,
           updated_at = NOW()
         WHERE id = $8`,
        [
          body.clinic.clinic_name, body.clinic.cnpj || null, body.clinic.phone || null,
          body.clinic.address_street || null, body.clinic.address_city || null,
          body.clinic.address_state || null, body.clinic.address_zip || null,
          tenantId,
        ]
      )

      // ── Lacuna 2: Atualizar CRP/UF do RT no profile ──
      await client.query(
        `UPDATE profiles SET
           name = COALESCE($1, name), crp = $2, crp_uf = $3, specialty = $4, updated_at = NOW()
         WHERE id = $5 AND tenant_id = $6`,
        [body.rt.name, body.rt.crp, body.rt.crp_uf, body.rt.specialty || null, profileId, tenantId]
      )

      // ── Lacuna 3: Enviar convites de equipe ──
      const invitesSent: any[] = []
      if (body.team_invites && body.team_invites.length > 0) {
        for (const invite of body.team_invites.slice(0, 10)) { // max 10
          // Verificar se já existe convite para esse email
          const existing = await client.query(
            `SELECT id FROM profiles WHERE email = $1 AND tenant_id = $2`,
            [invite.email, tenantId]
          )
          if (existing.rows.length > 0) continue

          const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const ins = await client.query(
            `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, is_active, invited_by)
             VALUES ($1, $2, $3, $4, $5, false, $6)
             RETURNING id, email, role`,
            [tenantId, pendingId, invite.role, invite.name || null, invite.email, userId]
          )
          invitesSent.push(ins.rows[0])
        }
      }

      // ── Lacuna 4: Seleção de plano ──
      if (body.plan_tier) {
        const limits: Record<string, { patients: number; sessions: number }> = {
          trial:        { patients: 5,   sessions: 15 },
          starter:      { patients: 15,  sessions: 60 },
          professional: { patients: 50,  sessions: 200 },
          clinic:       { patients: 999, sessions: 9999 },
        }
        const tier = limits[body.plan_tier] || limits.trial
        await client.query(
          `UPDATE tenants SET plan_tier = $1, max_patients = $2, max_sessions = $3, updated_at = NOW()
           WHERE id = $4`,
          [body.plan_tier, tier.patients, tier.sessions, tenantId]
        )
      }

      // ── Lacuna 6: Checklist de conformidade ──
      const complianceItems: any[] = []
      if (body.compliance_items && body.compliance_items.length > 0) {
        for (const item of body.compliance_items) {
          const ins = await client.query(
            `INSERT INTO compliance_checklist (tenant_id, item_key, label, accepted, accepted_by, accepted_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (tenant_id, item_key) DO UPDATE SET
               accepted = EXCLUDED.accepted, accepted_by = EXCLUDED.accepted_by,
               accepted_at = EXCLUDED.accepted_at
             RETURNING *`,
            [tenantId, item.item_key, item.label, item.accepted, item.accepted ? userId : null, item.accepted ? new Date() : null]
          )
          complianceItems.push(ins.rows[0])
        }
      }

      // ── Lacuna 7: Copiar protocolos-modelo selecionados ──
      let protocolsImported = 0
      if (body.selected_protocol_ids && body.selected_protocol_ids.length > 0) {
        // Buscar os modelos selecionados da biblioteca
        const models = await client.query(
          `SELECT * FROM protocol_library WHERE id = ANY($1) AND is_active = true`,
          [body.selected_protocol_ids]
        )

        // Buscar ebp_practice_id por nome (ou usar o primeiro encontrado)
        for (const model of models.rows) {
          const ebp = await client.query(
            `SELECT id FROM ebp_practices WHERE name ILIKE $1 LIMIT 1`,
            [model.ebp_practice_name]
          )
          if (ebp.rows.length === 0) continue

          // Inserir como protocolo-modelo no tenant (sem learner — template)
          await client.query(
            `INSERT INTO protocol_templates (tenant_id, title, domain, objective, ebp_practice_id,
              mastery_criteria_pct, mastery_criteria_sessions, mastery_criteria_trials,
              measurement_type, source_library_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT DO NOTHING`,
            [tenantId, model.title, model.domain, model.objective, ebp.rows[0].id,
             model.default_mastery_pct, model.default_mastery_sessions, model.default_mastery_trials,
             model.measurement_type, model.id, userId]
          )
          protocolsImported++
        }
      }

      // ── Lacuna 8+9: Marcar onboarding como completo ──
      await client.query(
        `UPDATE tenants SET onboarding_completed_at = NOW() WHERE id = $1`,
        [tenantId]
      )

      await client.query(
        `INSERT INTO onboarding_progress (tenant_id, current_step, total_steps, steps_completed, skipped, updated_at)
         VALUES ($1, 8, 8, $2, false, NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET
           current_step = 8, steps_completed = EXCLUDED.steps_completed, skipped = false, updated_at = NOW()`,
        [tenantId, JSON.stringify(['welcome','clinic','rt','team','plan','compliance','protocols','done'])]
      )

      // ── Audit log ──
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
         VALUES ($1, $2, $3, 'ONBOARDING_COMPLETED', 'tenants',
         jsonb_build_object(
           'clinic_name', $4, 'crp', $5, 'crp_uf', $6,
           'invites_sent', $7, 'plan_tier', $8,
           'compliance_count', $9, 'protocols_imported', $10
         ), NOW())`,
        [tenantId, userId, userId,
         body.clinic.clinic_name, body.rt.crp, body.rt.crp_uf,
         invitesSent.length, body.plan_tier || 'trial',
         complianceItems.filter(c => c.accepted).length, protocolsImported]
      )

      return {
        completed: true,
        clinic_name: body.clinic.clinic_name,
        invites_sent: invitesSent.length,
        plan_tier: body.plan_tier || 'trial',
        compliance_accepted: complianceItems.filter(c => c.accepted).length,
        protocols_imported: protocolsImported,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.error('Onboarding setup error:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
