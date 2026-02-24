import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// GET — Calcular/consultar estado clínico CSO-ABA de um aprendiz
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const { searchParams } = new URL(request.url)
      const learnerId = searchParams.get('learner_id')

      if (!learnerId) {
        throw new Error('learner_id é obrigatório')
      }

      // Buscar último estado clínico
      const latest = await client.query(
        `SELECT cs.*, l.name as learner_name
         FROM clinical_states_aba cs
         JOIN learners l ON l.id = cs.learner_id
         WHERE cs.learner_id = $1 AND cs.tenant_id = $2
         ORDER BY cs.created_at DESC
         LIMIT 1`,
        [learnerId, tenantId]
      )

      // Buscar histórico (últimos 10)
      const history = await client.query(
        `SELECT id, cso_score, sas, pis, bss, tcm, created_at
         FROM clinical_states_aba
         WHERE learner_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC
         LIMIT 10`,
        [learnerId, tenantId]
      )

      return {
        current: latest.rows[0] || null,
        history: history.rows,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Erro ao buscar estado clínico:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message === 'learner_id é obrigatório') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
