import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * GET /api/patients/[id]/case-base
 *
 * Retorna a Base do Caso TCC do paciente (4 campos).
 * Se nao existir registro, retorna case_base: null.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      // Verificar que paciente pertence ao tenant
      const patientCheck = await client.query(
        'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
        [patientId, tenantId]
      )
      if (patientCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
      }

      const res = await client.query(
        `SELECT chief_complaint, identified_pattern, triggers, core_belief
         FROM case_bases
         WHERE patient_id = $1 AND tenant_id = $2`,
        [patientId, tenantId]
      )

      if (res.rows.length === 0) {
        return NextResponse.json({ case_base: null })
      }

      return NextResponse.json({ case_base: res.rows[0] })
    })

    return result
  } catch (error: any) {
    console.error('[CASE-BASE GET] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * PUT /api/patients/[id]/case-base
 *
 * UPSERT da Base do Caso. Aceita campos parciais.
 * Sempre atualiza updated_at.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params
    const body = await request.json()

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      // Verificar que paciente pertence ao tenant
      const patientCheck = await client.query(
        'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
        [patientId, tenantId]
      )
      if (patientCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
      }

      // Sanitizar: apenas campos permitidos
      const fields: Record<string, string | null> = {
        chief_complaint: body.chief_complaint ?? null,
        identified_pattern: body.identified_pattern ?? null,
        triggers: body.triggers ?? null,
        core_belief: body.core_belief ?? null,
      }

      const res = await client.query(
        `INSERT INTO case_bases (patient_id, tenant_id, chief_complaint, identified_pattern, triggers, core_belief)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (patient_id, tenant_id)
         DO UPDATE SET
           chief_complaint = COALESCE($3, case_bases.chief_complaint),
           identified_pattern = COALESCE($4, case_bases.identified_pattern),
           triggers = COALESCE($5, case_bases.triggers),
           core_belief = COALESCE($6, case_bases.core_belief),
           updated_at = NOW()
         RETURNING chief_complaint, identified_pattern, triggers, core_belief`,
        [patientId, tenantId, fields.chief_complaint, fields.identified_pattern, fields.triggers, fields.core_belief]
      )

      return NextResponse.json({ case_base: res.rows[0] })
    })

    return result
  } catch (error: any) {
    console.error('[CASE-BASE PUT] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
