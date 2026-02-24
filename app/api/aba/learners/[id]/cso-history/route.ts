import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await withTenant(async ({ client, tenantId }) => {
      return await client.query(
        `SELECT sa.ended_at::date as session_date, ss.cso_aba, ss.sas, ss.pis, ss.bss, ss.tcm
         FROM session_snapshots ss JOIN sessions_aba sa ON sa.id = ss.session_id
         WHERE sa.learner_id = $1 AND sa.tenant_id = $2 ORDER BY sa.ended_at ASC`, [id, tenantId])
    })
    return NextResponse.json({ history: result.rows })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
