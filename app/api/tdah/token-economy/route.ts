import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH — API: Economia de Fichas
// GET — Lista sistemas de fichas por paciente
// POST — Criar novo sistema
// Bible §18: Reforço previsível, concreto e sistemático
// Protocolo E06: economia de fichas em casa
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')

    if (!patientId) {
      return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      const params: any[] = [patientId, ctx.tenantId]
      let roleFilter = ''

      if (ctx.role === 'terapeuta') {
        params.push(ctx.profileId)
        roleFilter = `AND te.patient_id IN (SELECT id FROM tdah_patients WHERE tenant_id = $2 AND created_by = $${params.length})`
      }

      return await ctx.client.query(
        `SELECT te.*,
          p.name as patient_name,
          tp.code as protocol_code, tp.title as protocol_title,
          (SELECT COUNT(*) FROM tdah_token_transactions WHERE economy_id = te.id) as total_transactions,
          (SELECT COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'earn'), 0) FROM tdah_token_transactions WHERE economy_id = te.id) as total_earned,
          (SELECT COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'spend'), 0) FROM tdah_token_transactions WHERE economy_id = te.id) as total_spent
        FROM tdah_token_economy te
        JOIN tdah_patients p ON p.id = te.patient_id
        LEFT JOIN tdah_protocols tp ON tp.id = te.protocol_id
        WHERE te.patient_id = $1 AND te.tenant_id = $2
        ${roleFilter}
        ORDER BY te.status = 'active' DESC, te.created_at DESC`,
        params
      )
    })

    return NextResponse.json({ economies: result.rows })
  } catch (error: any) {
    if (error?.statusCode) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, system_name, token_type, token_label, target_behaviors, reinforcers, protocol_id } = body

    if (!patient_id) {
      return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      const patient = await ctx.client.query(
        'SELECT id FROM tdah_patients WHERE id = $1 AND tenant_id = $2',
        [patient_id, ctx.tenantId]
      )
      if (patient.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      return await ctx.client.query(
        `INSERT INTO tdah_token_economy
          (tenant_id, patient_id, system_name, token_type, token_label, target_behaviors, reinforcers, protocol_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
        RETURNING *`,
        [
          ctx.tenantId, patient_id,
          system_name || 'Economia de Fichas',
          token_type || 'star',
          token_label || null,
          JSON.stringify(target_behaviors || []),
          JSON.stringify(reinforcers || []),
          protocol_id || null,
          ctx.profileId,
        ]
      )
    })

    return NextResponse.json({ economy: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
