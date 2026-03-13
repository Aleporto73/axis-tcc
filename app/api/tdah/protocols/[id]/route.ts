import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Protocolo por ID
// GET — Retorna protocolo completo
// PATCH — Atualiza status (ciclo de vida Bible §12)
// Transições válidas definidas no VALID_TRANSITIONS
// =====================================================

// Transições válidas do ciclo de vida (Bible §12, §22)
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'archived'],
  active: ['mastered', 'suspended', 'discontinued', 'regression'],
  mastered: ['generalization', 'maintenance', 'archived'],
  generalization: ['maintenance', 'regression', 'suspended'],
  maintenance: ['maintained', 'regression', 'suspended'],
  maintained: ['archived'],
  regression: ['active', 'suspended', 'discontinued'],
  suspended: ['active', 'discontinued', 'archived'],
  discontinued: ['archived'],
}

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
        `SELECT tp.*, p.name as patient_name,
                tpl.description as library_description,
                tpl.objective as library_objective,
                tpl.measurement as library_measurement,
                tpl.mastery_criteria as library_mastery_criteria,
                tpl.domain as library_domain
         FROM tdah_protocols tp
         JOIN tdah_patients p ON p.id = tp.patient_id
         LEFT JOIN tdah_protocol_library tpl ON tpl.id = tp.library_protocol_id
         WHERE tp.id = $1 AND tp.tenant_id = $2
         ${roleClause}`,
        queryParams
      )

      if (res.rows.length === 0) {
        const err = new Error('Protocolo não encontrado') as any
        err.statusCode = 404
        throw err
      }

      return res
    })

    return NextResponse.json({ protocol: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return NextResponse.json({ error: 'Protocolo não encontrado' }, { status: 404 })
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
    const { status: newStatus, audhd_adaptation_notes } = body

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      // Buscar protocolo atual
      const current = await ctx.client.query(
        `SELECT id, status FROM tdah_protocols WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )

      if (current.rows.length === 0) {
        const err = new Error('Protocolo não encontrado') as any
        err.statusCode = 404
        throw err
      }

      const currentStatus = current.rows[0].status

      // Se tem mudança de status, validar transição
      if (newStatus && newStatus !== currentStatus) {
        const allowed = VALID_TRANSITIONS[currentStatus] || []
        if (!allowed.includes(newStatus)) {
          return NextResponse.json(
            {
              error: `Transição inválida: ${currentStatus} → ${newStatus}`,
              allowed_transitions: allowed,
            },
            { status: 422 }
          )
        }
      }

      // Montar SET dinâmico
      const sets: string[] = ['updated_at = NOW()']
      const updateParams: any[] = [id, ctx.tenantId]

      if (newStatus) {
        updateParams.push(newStatus)
        sets.push(`status = $${updateParams.length}`)

        // Timestamps automáticos baseados no novo status
        if (newStatus === 'active' && currentStatus === 'draft') {
          sets.push('started_at = NOW()')
        }
        if (newStatus === 'mastered') {
          sets.push('mastered_at = NOW()')
        }
        if (newStatus === 'archived' || newStatus === 'discontinued') {
          sets.push('archived_at = NOW()')
        }
      }

      if (audhd_adaptation_notes !== undefined) {
        updateParams.push(audhd_adaptation_notes)
        sets.push(`audhd_adaptation_notes = $${updateParams.length}`)
      }

      const res = await ctx.client.query(
        `UPDATE tdah_protocols SET ${sets.join(', ')}
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        updateParams
      )

      return res
    })

    // Se o result é um NextResponse (transição inválida), retornar direto
    if (result instanceof NextResponse) return result

    return NextResponse.json({ protocol: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return NextResponse.json({ error: 'Protocolo não encontrado' }, { status: 404 })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
