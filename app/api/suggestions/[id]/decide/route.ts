import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

type DecisionType = 'approved' | 'edited' | 'ignored'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const suggestionId = (await params).id
    const body = await request.json()
    const { decision, edited_content } = body

    const validDecisions: DecisionType[] = ['approved', 'edited', 'ignored']
    if (!decision || !validDecisions.includes(decision)) {
      return NextResponse.json({ error: 'Decisao invalida. Use: approved, edited ou ignored' }, { status: 400 })
    }

    if (decision === 'edited' && (!edited_content || edited_content.trim() === '')) {
      return NextResponse.json({ error: 'Conteudo editado obrigatorio quando decision = edited' }, { status: 400 })
    }

    const checkResult = await pool.query(
      'SELECT s.id, s.patient_id FROM suggestions s WHERE s.id = $1 AND s.tenant_id = $2',
      [suggestionId, tenantId]
    )
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: 'Sugestao nao encontrada' }, { status: 404 })
    }
    const patientId = checkResult.rows[0].patient_id

    const existingDecision = await pool.query(
      'SELECT id FROM suggestion_decisions WHERE suggestion_id = $1',
      [suggestionId]
    )
    if (existingDecision.rows.length > 0) {
      return NextResponse.json({ error: 'Sugestao ja decidida' }, { status: 409 })
    }

    const insertResult = await pool.query(
      `INSERT INTO suggestion_decisions (
        tenant_id, patient_id, suggestion_id, action, user_id, edited_text, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, suggestion_id, action, user_id, created_at, edited_text`,
      [tenantId, patientId, suggestionId, decision, userId, decision === 'edited' ? edited_content : null]
    )

    const auditAction = decision === 'ignored' ? 'SUGGESTION_REJECT' : 'SUGGESTION_ACCEPT'
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'human', $3, 'suggestion', $4, $5)`,
      [tenantId, userId, auditAction, suggestionId, JSON.stringify({ decision })]
    )

    return NextResponse.json({ success: true, data: insertResult.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[AXIS] Erro ao registrar decisao:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
