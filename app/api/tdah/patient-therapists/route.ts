import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Vínculo Terapeuta-Paciente
// Migration 038: tdah_patient_therapists (N:N)
// Paridade com ABA learner_therapists.
// Admin/Supervisor: CRUD completo. Terapeuta: read-only seus.
// =====================================================

/**
 * GET /api/tdah/patient-therapists?patient_id=xxx
 * Lista vínculos. Admin/Supervisor: todos. Terapeuta: apenas seus.
 */
export async function GET(request: NextRequest) {
  try {
    const patientId = request.nextUrl.searchParams.get('patient_id')

    const result = await withTenant(async (ctx) => {
      let query = `
        SELECT
          tpt.id,
          tpt.patient_id,
          tpt.profile_id,
          tpt.is_primary,
          tpt.assigned_at,
          tpt.assigned_by,
          tpt.role_in_case,
          p.name AS therapist_name,
          p.role AS therapist_role,
          p.email AS therapist_email,
          pat.name AS patient_name
        FROM tdah_patient_therapists tpt
        JOIN profiles p ON p.id = tpt.profile_id
        JOIN tdah_patients pat ON pat.id = tpt.patient_id
        WHERE tpt.tenant_id = $1
      `
      const params: string[] = [ctx.tenantId]
      let paramIdx = 2

      if (patientId) {
        query += ` AND tpt.patient_id = $${paramIdx++}`
        params.push(patientId)
      }

      // Terapeuta só vê seus próprios vínculos
      if (ctx.role === 'terapeuta') {
        query += ` AND tpt.profile_id = $${paramIdx++}`
        params.push(ctx.profileId)
      }

      query += ` ORDER BY tpt.is_primary DESC, tpt.assigned_at`

      return await ctx.client.query(query, params)
    })

    return NextResponse.json({ bindings: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * POST /api/tdah/patient-therapists
 * Cria/atualiza vínculo. Admin/Supervisor apenas.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, profile_id, is_primary, role_in_case } = body

    if (!patient_id || !profile_id) {
      return NextResponse.json(
        { error: 'patient_id e profile_id são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      // Verificar que paciente e profile existem no tenant
      const [patCheck, profCheck] = await Promise.all([
        ctx.client.query(
          'SELECT id FROM tdah_patients WHERE id = $1 AND tenant_id = $2',
          [patient_id, ctx.tenantId]
        ),
        ctx.client.query(
          'SELECT id FROM profiles WHERE id = $1 AND tenant_id = $2',
          [profile_id, ctx.tenantId]
        ),
      ])

      if (patCheck.rows.length === 0) {
        throw Object.assign(new Error('Paciente não encontrado neste tenant'), { statusCode: 404 })
      }
      if (profCheck.rows.length === 0) {
        throw Object.assign(new Error('Profissional não encontrado neste tenant'), { statusCode: 404 })
      }

      // Se is_primary=true, desmarcar outros primários
      if (is_primary) {
        await ctx.client.query(
          `UPDATE tdah_patient_therapists SET is_primary = false
           WHERE patient_id = $1 AND tenant_id = $2 AND is_primary = true`,
          [patient_id, ctx.tenantId]
        )
      }

      // Upsert
      const res = await ctx.client.query(
        `INSERT INTO tdah_patient_therapists
          (tenant_id, patient_id, profile_id, is_primary, assigned_by, role_in_case)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id, patient_id, profile_id)
        DO UPDATE SET
          is_primary = EXCLUDED.is_primary,
          role_in_case = COALESCE(EXCLUDED.role_in_case, tdah_patient_therapists.role_in_case),
          assigned_at = NOW()
        RETURNING *`,
        [
          ctx.tenantId,
          patient_id,
          profile_id,
          is_primary ?? false,
          ctx.profileId,
          role_in_case || null,
        ]
      )

      // Audit
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'tdah_therapist_assigned', 'tdah_patient_therapists', $3,
           jsonb_build_object('patient_id', $4::text, 'profile_id', $5::text, 'role_in_case', $6::text))`,
        [ctx.tenantId, ctx.profileId, res.rows[0].id, patient_id, profile_id, role_in_case || '']
      )

      return res
    })

    return NextResponse.json({ binding: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * DELETE /api/tdah/patient-therapists?id=xxx
 * Remove vínculo. Admin/Supervisor apenas.
 */
export async function DELETE(request: NextRequest) {
  try {
    const bindingId = request.nextUrl.searchParams.get('id')
    if (!bindingId) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    }

    await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      const res = await ctx.client.query(
        `DELETE FROM tdah_patient_therapists WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        [bindingId, ctx.tenantId]
      )

      if (res.rows.length === 0) {
        throw Object.assign(new Error('Vínculo não encontrado'), { statusCode: 404 })
      }

      // Audit
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'tdah_therapist_unassigned', 'tdah_patient_therapists', $3,
           jsonb_build_object('patient_id', $4::text, 'profile_id', $5::text))`,
        [ctx.tenantId, ctx.profileId, bindingId, res.rows[0].patient_id, res.rows[0].profile_id]
      )
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
