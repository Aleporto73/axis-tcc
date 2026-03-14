import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// =====================================================
// AXIS TDAH — API Plano TDAH (equivalente PEI do ABA)
// Tabelas: tdah_plans + tdah_plan_goals (Bible §13)
//
// Diferenças vs PEI (ABA):
//   - Domínios clínicos TDAH (atencao_sustentada, controle_inibitorio, etc.)
//   - Goal tem status (active/achieved/paused/discontinued) + progress %
//   - Vincula protocolos TDAH (não learner_protocols)
//   - Campos: goal_description + target_criteria (não title + target_pct)
// =====================================================

const VALID_DOMAINS = new Set([
  'atencao_sustentada', 'inicio_tarefa', 'permanencia_tarefa', 'conclusao_tarefa',
  'seguimento_instrucao', 'rotina_domestica', 'rotina_escolar',
  'controle_inibitorio', 'espera_turno', 'organizacao',
  'autorregulacao', 'transicoes', 'integracao_contextual', 'audhd',
])

// GET — Listar planos de um paciente
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')

    const result = await withTenant(async ({ client, tenantId, userId, role }) => {
      let q = `
        SELECT p.*, tp.name as patient_name
        FROM tdah_plans p
        JOIN tdah_patients tp ON tp.id = p.patient_id
        WHERE p.tenant_id = $1
      `
      const params: any[] = [tenantId]

      if (patientId) {
        params.push(patientId)
        q += ` AND p.patient_id = $${params.length}`
      }

      // Role filter: terapeuta vê só seus pacientes
      if (role === 'terapeuta') {
        q += ` AND tp.created_by = '${userId}'`
      }

      q += ' ORDER BY p.created_at DESC'

      const plans = await client.query(q, params)

      // Buscar goals + protocolos vinculados para cada plano
      const result = []
      for (const plan of plans.rows) {
        const goals = await client.query(
          `SELECT * FROM tdah_plan_goals
           WHERE plan_id = $1 AND tenant_id = $2
           ORDER BY domain, goal_description`,
          [plan.id, tenantId]
        )

        // Protocolos ativos do paciente para referência
        const protocols = await client.query(
          `SELECT id, title, status, block FROM tdah_protocols
           WHERE patient_id = $1 AND tenant_id = $2 AND status NOT IN ('archived', 'discontinued')
           ORDER BY title`,
          [plan.patient_id, tenantId]
        )

        result.push({
          ...plan,
          goals: goals.rows,
          active_protocols: protocols.rows,
        })
      }

      return result
    })

    return NextResponse.json({ plans: result })
  } catch (error: any) {
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    console.error('[TDAH PLANS GET] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Criar plano TDAH
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, title, description, start_date, end_date, goals } = body

    if (!patient_id || !title) {
      return NextResponse.json(
        { error: 'patient_id e title são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar domínios das metas
    if (goals && Array.isArray(goals)) {
      for (const g of goals) {
        if (!g.domain || !VALID_DOMAINS.has(g.domain)) {
          return NextResponse.json(
            { error: `Domínio inválido: ${g.domain}. Válidos: ${[...VALID_DOMAINS].join(', ')}` },
            { status: 400 }
          )
        }
        if (!g.goal_description) {
          return NextResponse.json(
            { error: 'goal_description é obrigatório para cada meta' },
            { status: 400 }
          )
        }
      }
    }

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Verificar paciente
      const patient = await client.query(
        'SELECT id FROM tdah_patients WHERE id = $1 AND tenant_id = $2 AND status = $3',
        [patient_id, tenantId, 'active']
      )
      if (patient.rows.length === 0) {
        throw new Error('Paciente não encontrado ou inativo')
      }

      // Buscar profile
      const profile = await client.query(
        'SELECT id FROM profiles WHERE clerk_user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      )
      const profileId = profile.rows[0]?.id || null

      // Criar plano
      const plan = await client.query(
        `INSERT INTO tdah_plans (tenant_id, patient_id, title, description, start_date, end_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [tenantId, patient_id, title, description || null, start_date || null, end_date || null, profileId]
      )

      const planId = plan.rows[0].id

      // Criar metas
      if (goals && goals.length > 0) {
        for (const g of goals) {
          await client.query(
            `INSERT INTO tdah_plan_goals (tenant_id, plan_id, domain, goal_description, target_criteria, progress)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenantId, planId, g.domain, g.goal_description, g.target_criteria || null, g.progress || 0]
          )
        }
      }

      // Audit log
      try {
        await client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, 'user', 'TDAH_PLAN_CREATED', 'tdah_plans',
           jsonb_build_object('plan_id', $3::text, 'patient_id', $4::text, 'title', $5::text, 'goals_count', $6::text), NOW())`,
          [tenantId, userId || 'system', planId, patient_id, title, String(goals?.length || 0)]
        )
      } catch (_) { /* audit non-blocking */ }

      return plan.rows[0]
    })

    return NextResponse.json({ plan: result }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('não encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[TDAH PLANS POST] Erro:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
