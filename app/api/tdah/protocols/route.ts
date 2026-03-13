import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Protocolos do Paciente
// GET — Lista protocolos ativos de um paciente
// POST — Ativa protocolo da library para um paciente
// Bible §12, §22: ciclo de vida do protocolo
// =====================================================

// GET — Listar protocolos de um paciente
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const patientId = searchParams.get('patient_id')
      const status = searchParams.get('status')

      let roleClause = ''
      const params: any[] = [ctx.tenantId]

      // Terapeuta só vê protocolos de pacientes que criou
      if (ctx.role === 'terapeuta') {
        params.push(ctx.profileId)
        roleClause = `AND p.created_by = $${params.length}`
      }

      let query = `
        SELECT tp.*, p.name as patient_name,
               tpl.description as library_description,
               tpl.domain as library_domain,
               tpl.priority as library_priority
        FROM tdah_protocols tp
        JOIN tdah_patients p ON p.id = tp.patient_id
        LEFT JOIN tdah_protocol_library tpl ON tpl.id = tp.library_protocol_id
        WHERE tp.tenant_id = $1
        ${roleClause}
      `

      if (patientId) {
        params.push(patientId)
        query += ` AND tp.patient_id = $${params.length}::uuid`
      }

      if (status) {
        params.push(status)
        query += ` AND tp.status = $${params.length}`
      }

      query += ` ORDER BY tp.block, tp.code`

      return await ctx.client.query(query, params)
    })

    return NextResponse.json({ protocols: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// POST — Ativar protocolo da library para um paciente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, library_protocol_id, audhd_adaptation_notes } = body

    if (!patient_id || !library_protocol_id) {
      return NextResponse.json(
        { error: 'patient_id e library_protocol_id são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      // Validar paciente pertence ao tenant
      const patientCheck = await ctx.client.query(
        `SELECT id FROM tdah_patients WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND deleted_at IS NULL`,
        [patient_id, ctx.tenantId]
      )
      if (patientCheck.rows.length === 0) {
        throw new Error('Paciente não encontrado')
      }

      // Buscar protocolo da library
      const libCheck = await ctx.client.query(
        `SELECT * FROM tdah_protocol_library WHERE id = $1 AND status = 'active'`,
        [library_protocol_id]
      )
      if (libCheck.rows.length === 0) {
        throw new Error('Protocolo da biblioteca não encontrado')
      }

      const lib = libCheck.rows[0]

      // Verificar duplicata: mesmo protocolo ativo para o mesmo paciente
      const dupCheck = await ctx.client.query(
        `SELECT id FROM tdah_protocols
         WHERE patient_id = $1 AND library_protocol_id = $2 AND tenant_id = $3
         AND status NOT IN ('archived', 'discontinued')`,
        [patient_id, library_protocol_id, ctx.tenantId]
      )
      if (dupCheck.rows.length > 0) {
        throw new Error('PROTOCOL_ALREADY_ACTIVE')
      }

      // Buscar engine version atual do TDAH
      const engineResult = await ctx.client.query(
        `SELECT version FROM engine_versions WHERE engine_name = 'CSO-TDAH' AND is_current = true`
      )
      const engineVersion = engineResult.rows[0]?.version || 'v1.0.0'

      // Inserir protocolo ativado (status = 'active', started_at = now)
      return await ctx.client.query(
        `INSERT INTO tdah_protocols (
          tenant_id, patient_id, library_protocol_id,
          code, title, block,
          requires_audhd_layer, audhd_adaptation_notes,
          protocol_engine_version, status, started_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', NOW(), $10)
        RETURNING *`,
        [
          ctx.tenantId, patient_id, library_protocol_id,
          lib.code, lib.title, lib.block,
          lib.requires_audhd_layer || false,
          audhd_adaptation_notes || null,
          engineVersion, ctx.profileId
        ]
      )
    })

    return NextResponse.json({ protocol: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'Paciente não encontrado' || error?.message === 'Protocolo da biblioteca não encontrado') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error?.message === 'PROTOCOL_ALREADY_ACTIVE') {
      return NextResponse.json(
        { error: 'Este protocolo já está ativo para este paciente', code: 'PROTOCOL_ALREADY_ACTIVE' },
        { status: 409 }
      )
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
