import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Sessões (Multi-Terapeuta)
// admin/supervisor: veem todas. terapeuta: só suas.
// Tabela: tdah_sessions (isolada do ABA)
// Contexto tricontextual: clinical | home | school
// =====================================================

// GET — Listar sessões TDAH do tenant (filtrado por role)
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const patientId = searchParams.get('patient_id')
      const status = searchParams.get('status')
      const sessionContext = searchParams.get('context')

      // Filtro por role: terapeuta só vê suas sessões
      let roleClause = ''
      const params: any[] = [ctx.tenantId]

      if (ctx.role === 'terapeuta') {
        params.push(ctx.userId)
        roleClause = `AND (s.therapist_id = $${params.length} OR s.clinician_id = $${params.length})`
      }

      let query = `
        SELECT s.*, p.name as patient_name
        FROM tdah_sessions s
        JOIN tdah_patients p ON p.id = s.patient_id
        WHERE s.tenant_id = $1
        ${roleClause}
      `

      if (patientId) {
        params.push(patientId)
        query += ` AND s.patient_id = $${params.length}`
      }

      if (status) {
        params.push(status)
        query += ` AND s.status = $${params.length}`
      }

      if (sessionContext) {
        params.push(sessionContext)
        query += ` AND s.session_context = $${params.length}`
      }

      query += ` ORDER BY s.scheduled_at DESC LIMIT 50`

      return await ctx.client.query(query, params)
    })

    return NextResponse.json({ sessions: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// POST — Criar sessão TDAH (agendar)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, scheduled_at, session_context, session_notes } = body

    if (!patient_id || !scheduled_at) {
      return NextResponse.json(
        { error: 'patient_id e scheduled_at são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      // Validar paciente pertence ao tenant
      const patientCheck = await ctx.client.query(
        `SELECT id FROM tdah_patients WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
        [patient_id, ctx.tenantId]
      )

      if (patientCheck.rows.length === 0) {
        throw new Error('Paciente não encontrado')
      }

      // Calcular session_number
      const countRes = await ctx.client.query(
        `SELECT COUNT(*)::int + 1 as next_number FROM tdah_sessions WHERE patient_id = $1 AND tenant_id = $2`,
        [patient_id, ctx.tenantId]
      )
      const sessionNumber = countRes.rows[0]?.next_number || 1

      return await ctx.client.query(
        `INSERT INTO tdah_sessions (
          tenant_id, patient_id, therapist_id, scheduled_at,
          session_context, session_number, session_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          ctx.tenantId, patient_id, ctx.userId, scheduled_at,
          session_context || 'clinical', sessionNumber,
          session_notes || null
        ]
      )
    })

    return NextResponse.json({ session: result.rows[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Paciente não encontrado') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
