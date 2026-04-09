import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

type DecisionType = 'approved' | 'edited' | 'ignored'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return await withTenant(async (ctx) => {
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

      const checkResult = await ctx.client.query(
        'SELECT s.id, s.patient_id FROM suggestions s WHERE s.id = $1 AND s.tenant_id = $2',
        [suggestionId, ctx.tenantId]
      )
      if (checkResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sugestao nao encontrada' }, { status: 404 })
      }
      const patientId = checkResult.rows[0].patient_id

      const existingDecision = await ctx.client.query(
        'SELECT id FROM suggestion_decisions WHERE suggestion_id = $1 AND tenant_id = $2',
        [suggestionId, ctx.tenantId]
      )
      if (existingDecision.rows.length > 0) {
        return NextResponse.json({ error: 'Sugestao ja decidida' }, { status: 409 })
      }

      const insertResult = await ctx.client.query(
        `INSERT INTO suggestion_decisions (
          tenant_id, patient_id, suggestion_id, action, user_id, edited_text, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, suggestion_id, action, user_id, created_at, edited_text`,
        [ctx.tenantId, patientId, suggestionId, decision, ctx.userId, decision === 'edited' ? edited_content : null]
      )

      const auditAction = decision === 'ignored' ? 'SUGGESTION_REJECT' : 'SUGGESTION_ACCEPT'
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'human', $3, 'suggestion', $4, $5)`,
        [ctx.tenantId, ctx.userId, auditAction, suggestionId, JSON.stringify({ decision })]
      )

      return NextResponse.json({ success: true, data: insertResult.rows[0] }, { status: 201 })
    })
  } catch (error) {
    console.error('[AXIS] Erro ao registrar decisao:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
