import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// DELETE — Excluir trial de sessão ativa
// Guardrail: só permite exclusão quando sessão está em andamento (in_progress)
// Sessão finalizada (completed) = dados imutáveis, snapshot já gerado
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  try {
    const { id: sessionId, targetId } = await params

    if (!sessionId || !targetId) {
      return NextResponse.json(
        { error: 'session_id e target_id são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // 1. Verificar status da sessão (só permite em in_progress)
      const sessionRes = await client.query(
        `SELECT id, status FROM sessions_aba WHERE id = $1 AND tenant_id = $2`,
        [sessionId, tenantId]
      )

      if (sessionRes.rows.length === 0) {
        throw new Error('[AXIS ABA] Sessão não encontrada')
      }

      const session = sessionRes.rows[0]

      if (session.status !== 'in_progress') {
        throw new Error('[AXIS ABA] Só é possível excluir trials em sessões em andamento. Sessões finalizadas são imutáveis.')
      }

      // 2. Verificar que o target pertence à sessão e ao tenant
      const targetRes = await client.query(
        `SELECT id, target_name, trials_total, trials_correct, prompt_level
         FROM session_targets
         WHERE id = $1 AND session_id = $2 AND tenant_id = $3`,
        [targetId, sessionId, tenantId]
      )

      if (targetRes.rows.length === 0) {
        throw new Error('[AXIS ABA] Trial não encontrado nesta sessão')
      }

      const target = targetRes.rows[0]

      // 3. Excluir o trial
      await client.query(
        `DELETE FROM session_targets WHERE id = $1 AND tenant_id = $2`,
        [targetId, tenantId]
      )

      // 4. Audit log (append-only — registrar que houve exclusão)
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'DELETE_TRIAL', 'session_target', $3, $4)`,
        [
          tenantId,
          userId,
          targetId,
          JSON.stringify({
            session_id: sessionId,
            target_name: target.target_name,
            trials_total: target.trials_total,
            trials_correct: target.trials_correct,
            prompt_level: target.prompt_level,
            reason: 'user_correction'
          })
        ]
      )

      return { deleted: true }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('Erro ao excluir trial:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('[AXIS ABA]')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
