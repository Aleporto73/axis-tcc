import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH — API: Rotinas Domésticas
// GET — Lista rotinas por paciente
// POST — Criar nova rotina
// Bible §18: Instrução curta, sequência clara, reforço previsível
// =====================================================

const VALID_TYPES = ['morning', 'afternoon', 'evening', 'homework', 'school_prep', 'other']
const VALID_STATUS = ['active', 'paused', 'completed', 'archived']

const TYPE_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
  homework: 'Dever de casa',
  school_prep: 'Preparação escolar',
  other: 'Outra',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const status = searchParams.get('status')

    if (!patientId) {
      return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      const params: any[] = [patientId, ctx.tenantId]
      let roleFilter = ''
      let statusFilter = ''

      if (ctx.role === 'terapeuta') {
        params.push(ctx.profileId)
        roleFilter = `AND r.patient_id IN (SELECT id FROM tdah_patients WHERE tenant_id = $2 AND created_by = $${params.length})`
      }

      if (status && VALID_STATUS.includes(status)) {
        params.push(status)
        statusFilter = `AND r.status = $${params.length}`
      }

      return await ctx.client.query(
        `SELECT r.*, p.name as patient_name
        FROM tdah_routines r
        JOIN tdah_patients p ON p.id = r.patient_id
        WHERE r.patient_id = $1 AND r.tenant_id = $2
        ${roleFilter} ${statusFilter}
        ORDER BY r.routine_type, r.created_at DESC`,
        params
      )
    })

    return NextResponse.json({ routines: result.rows, type_labels: TYPE_LABELS })
  } catch (error: any) {
    if (error?.statusCode) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, routine_type, routine_name, steps, reinforcement_plan } = body

    if (!patient_id || !routine_type || !routine_name) {
      return NextResponse.json({ error: 'patient_id, routine_type e routine_name obrigatórios' }, { status: 400 })
    }

    if (!VALID_TYPES.includes(routine_type)) {
      return NextResponse.json({ error: `routine_type inválido. Valores: ${VALID_TYPES.join(', ')}` }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      // Verificar paciente
      const patient = await ctx.client.query(
        'SELECT id FROM tdah_patients WHERE id = $1 AND tenant_id = $2',
        [patient_id, ctx.tenantId]
      )
      if (patient.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      // Validar steps JSON
      let stepsJson = null
      if (steps && Array.isArray(steps)) {
        stepsJson = JSON.stringify(steps.map((s: any, i: number) => ({
          order: s.order || i + 1,
          description: s.description || '',
          visual_cue: s.visual_cue || '',
        })))
      }

      return await ctx.client.query(
        `INSERT INTO tdah_routines (tenant_id, patient_id, routine_type, routine_name, steps_json, reinforcement_plan)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         RETURNING *`,
        [ctx.tenantId, patient_id, routine_type, routine_name, stepsJson, reinforcement_plan || null]
      )
    })

    return NextResponse.json({ routine: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
