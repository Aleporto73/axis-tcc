import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { CSO_TDAH_ENGINE_VERSION } from '@/src/engines/cso-tdah'

// =====================================================
// AXIS TDAH - API: Paciente por ID
// GET — Retorna dados completos do paciente
// PATCH — Editar dados gerais + toggle AuDHD layer
// Respeita tenant_id e role (terapeuta só se created_by)
// Bible §9.3: mudança de layer SEMPRE gera log (append-only)
// =====================================================

const VALID_AUDHD_STATUS = ['off', 'active_core', 'active_full']
const VALID_GENDERS = ['M', 'F', 'O']

// Campos editáveis do paciente (não inclui AuDHD — tratado separado)
const EDITABLE_FIELDS = [
  'name', 'birth_date', 'gender', 'diagnosis', 'cid_code', 'support_level',
  'school_name', 'school_contact', 'teacher_name', 'teacher_email',
  'clinical_notes', 'status',
] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      let roleClause = ''
      const queryParams: any[] = [id, ctx.tenantId]

      if (ctx.role === 'terapeuta') {
        queryParams.push(ctx.profileId)
        roleClause = `AND p.created_by = $${queryParams.length}`
      }

      const res = await ctx.client.query(
        `SELECT p.*,
          (SELECT COUNT(*) FROM tdah_sessions s WHERE s.patient_id = p.id AND s.tenant_id = p.tenant_id) as total_sessions,
          (SELECT COUNT(*) FROM tdah_protocols tp WHERE tp.patient_id = p.id AND tp.tenant_id = p.tenant_id AND tp.status = 'active') as active_protocols
        FROM tdah_patients p
        WHERE p.id = $1 AND p.tenant_id = $2
        ${roleClause}`,
        queryParams
      )

      if (res.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      return res
    })

    return NextResponse.json({ patient: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.message === 'Paciente não encontrado') {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const result = await withTenant(async (ctx) => {
      // Verificar paciente existe e pertence ao tenant
      let roleClause = ''
      const checkParams: any[] = [id, ctx.tenantId]
      if (ctx.role === 'terapeuta') {
        checkParams.push(ctx.profileId)
        roleClause = `AND created_by = $${checkParams.length}`
      }

      const current = await ctx.client.query(
        `SELECT * FROM tdah_patients WHERE id = $1 AND tenant_id = $2 ${roleClause}`,
        checkParams
      )

      if (current.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      const patient = current.rows[0]

      // ── Toggle AuDHD layer (Bible §9.3, Anexo F) ──
      if (body.audhd_layer_status !== undefined) {
        if (!VALID_AUDHD_STATUS.includes(body.audhd_layer_status)) {
          const err = new Error(`Status AuDHD inválido. Valores: ${VALID_AUDHD_STATUS.join(', ')}`) as any
          err.statusCode = 400
          throw err
        }

        const previousStatus = patient.audhd_layer_status

        if (previousStatus !== body.audhd_layer_status) {
          await ctx.client.query(
            `UPDATE tdah_patients
             SET audhd_layer_status = $3::audhd_layer_status_enum,
                 audhd_layer_activated_by = $4,
                 audhd_layer_activated_at = NOW(),
                 audhd_layer_reason = $5,
                 updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2`,
            [id, ctx.tenantId, body.audhd_layer_status, ctx.profileId, body.audhd_layer_reason || null]
          )

          // Log append-only (Bible §9.3: toda mudança gera log com autoria)
          await ctx.client.query(
            `INSERT INTO tdah_audhd_log (tenant_id, patient_id, previous_status, new_status, changed_by, reason, engine_version)
             VALUES ($1, $2, $3::audhd_layer_status_enum, $4::audhd_layer_status_enum, $5, $6, $7)`,
            [ctx.tenantId, id, previousStatus, body.audhd_layer_status, ctx.profileId, body.audhd_layer_reason || null, CSO_TDAH_ENGINE_VERSION]
          )
        }
      }

      // ── Edição de campos gerais ──
      const setClauses: string[] = []
      const values: any[] = [id, ctx.tenantId]
      let paramIdx = 2

      for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined && field !== 'status') {
          // Validações específicas
          if (field === 'name' && (!body[field] || !String(body[field]).trim())) {
            const err = new Error('Nome não pode ser vazio') as any
            err.statusCode = 400
            throw err
          }
          if (field === 'gender' && body[field] && !VALID_GENDERS.includes(body[field])) {
            const err = new Error(`Gênero inválido. Valores: ${VALID_GENDERS.join(', ')}`) as any
            err.statusCode = 400
            throw err
          }
          if (field === 'support_level' && body[field] != null) {
            const level = Number(body[field])
            if (isNaN(level) || level < 1 || level > 3) {
              const err = new Error('support_level deve ser 1, 2 ou 3') as any
              err.statusCode = 400
              throw err
            }
          }

          paramIdx++
          setClauses.push(`${field} = $${paramIdx}`)
          values.push(body[field] === '' ? null : body[field])
        }
      }

      // Status: admin/supervisor only
      if (body.status !== undefined) {
        if (!['active', 'inactive'].includes(body.status)) {
          const err = new Error('Status inválido. Valores: active, inactive') as any
          err.statusCode = 400
          throw err
        }
        if (ctx.role === 'terapeuta') {
          const err = new Error('Terapeuta não pode alterar status do paciente') as any
          err.statusCode = 403
          throw err
        }
        paramIdx++
        setClauses.push(`status = $${paramIdx}`)
        values.push(body.status)
      }

      // Se tem campos gerais para atualizar
      if (setClauses.length > 0) {
        setClauses.push('updated_at = NOW()')
        await ctx.client.query(
          `UPDATE tdah_patients SET ${setClauses.join(', ')} WHERE id = $1 AND tenant_id = $2`,
          values
        )
      }

      // Se não teve AuDHD toggle nem campos gerais → erro
      if (body.audhd_layer_status === undefined && setClauses.length === 0) {
        const err = new Error('Nenhum campo válido para atualizar') as any
        err.statusCode = 400
        throw err
      }

      // Retornar paciente atualizado
      const updated = await ctx.client.query(
        `SELECT p.*,
          (SELECT COUNT(*) FROM tdah_sessions s WHERE s.patient_id = p.id AND s.tenant_id = p.tenant_id) as total_sessions,
          (SELECT COUNT(*) FROM tdah_protocols tp WHERE tp.patient_id = p.id AND tp.tenant_id = p.tenant_id AND tp.status = 'active') as active_protocols
        FROM tdah_patients p
        WHERE p.id = $1 AND p.tenant_id = $2`,
        [id, ctx.tenantId]
      )

      return updated
    })

    return NextResponse.json({ patient: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
