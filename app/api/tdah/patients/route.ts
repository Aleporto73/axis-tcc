import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Pacientes (Multi-Terapeuta)
// admin/supervisor: veem todos. terapeuta: só os que criou.
// Tabela: tdah_patients (isolada do ABA)
// =====================================================

// GET — Listar pacientes TDAH do tenant
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const activeOnly = searchParams.get('active') !== 'false'

      // Filtro por role: terapeuta só vê pacientes que criou
      // (v1: sem tabela de vínculo terapeuta-paciente, usa created_by)
      let roleClause = ''
      const params: any[] = [ctx.tenantId]

      if (ctx.role === 'terapeuta') {
        params.push(ctx.profileId)
        roleClause = `AND p.created_by = $${params.length}`
      }

      let query = `
        SELECT p.*,
          (SELECT COUNT(*) FROM tdah_sessions s WHERE s.patient_id = p.id AND s.tenant_id = p.tenant_id) as total_sessions,
          (SELECT COUNT(*) FROM tdah_protocols tp WHERE tp.patient_id = p.id AND tp.tenant_id = p.tenant_id AND tp.status = 'active') as active_protocols
        FROM tdah_patients p
        WHERE p.tenant_id = $1
        ${roleClause}
      `

      if (activeOnly) {
        query += ` AND p.status = 'active' AND p.deleted_at IS NULL`
      }

      query += ` ORDER BY p.name`

      return await ctx.client.query(query, params)
    })

    return NextResponse.json({ patients: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// POST — Criar paciente TDAH (admin/supervisor apenas)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name, birth_date, gender, diagnosis, cid_code, support_level,
      school_name, school_contact, teacher_name, teacher_email,
      clinical_notes, guardian_name, guardian_email, guardian_phone, guardian_relationship
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'name é obrigatório' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      // Terapeuta não pode criar pacientes
      requireAdminOrSupervisor(ctx)

      // ─── Enforcement de limite do plano ───
      const [tenantRes, countRes] = await Promise.all([
        ctx.client.query(
          'SELECT max_patients, plan_tier FROM tenants WHERE id = $1',
          [ctx.tenantId]
        ),
        ctx.client.query(
          `SELECT COUNT(*)::int as total FROM tdah_patients WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL`,
          [ctx.tenantId]
        ),
      ])

      const maxPatients = tenantRes.rows[0]?.max_patients ?? 1
      const currentCount = countRes.rows[0]?.total ?? 0

      if (currentCount >= maxPatients) {
        const err = new Error('PLAN_LIMIT_REACHED') as any
        err.planLimit = { current: currentCount, max: maxPatients, plan: tenantRes.rows[0]?.plan_tier || 'free' }
        throw err
      }

      const inserted = await ctx.client.query(
        `INSERT INTO tdah_patients (
          tenant_id, name, birth_date, gender, diagnosis, cid_code, support_level,
          school_name, school_contact, teacher_name, teacher_email,
          clinical_notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          ctx.tenantId, name, birth_date || null, gender || null,
          diagnosis || null, cid_code || null, support_level || null,
          school_name || null, school_contact || null,
          teacher_name || null, teacher_email || null,
          clinical_notes || null, ctx.profileId
        ]
      )

      // Auto-criar responsável se dados informados
      if (guardian_name && guardian_name.trim()) {
        await ctx.client.query(
          `INSERT INTO tdah_guardians (tenant_id, patient_id, name, email, phone, relationship, is_primary)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [
            ctx.tenantId, inserted.rows[0].id,
            guardian_name.trim(),
            guardian_email?.trim() || null,
            guardian_phone?.trim() || null,
            guardian_relationship || 'Responsável'
          ]
        )
      }

      return inserted
    })

    return NextResponse.json({ patient: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'PLAN_LIMIT_REACHED') {
      return NextResponse.json(
        {
          error: 'Limite de pacientes atingido',
          code: 'PLAN_LIMIT_REACHED',
          ...error.planLimit,
        },
        { status: 403 }
      )
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
