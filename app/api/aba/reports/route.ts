import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId, userId }) => {
      const { searchParams } = new URL(request.url)
      const learnerId = searchParams.get('learner_id')
      const periodStart = searchParams.get('period_start')
      const periodEnd = searchParams.get('period_end')
      if (!learnerId) throw new Error('learner_id é obrigatório')
      const start = periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const end = periodEnd || new Date().toISOString().split('T')[0]
      const convenio = await client.query(
        'SELECT generate_convenio_data($1::uuid, $2::uuid, $3::date, $4::date, $5::varchar) as data',
        [learnerId, tenantId, start, end, userId]
      )
      const alta = await client.query(
        'SELECT * FROM check_alta_parcial($1::uuid, $2::uuid)',
        [learnerId, tenantId]
      )
      return { convenio: convenio.rows[0]?.data || null, alta_parcial: alta.rows[0] || null }
    })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Erro ao gerar relatório:', error)
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (error.message === 'learner_id é obrigatório') return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { learner_id, report_type, report_data } = body
    if (!learner_id || !report_type || !report_data) {
      return NextResponse.json({ error: 'learner_id, report_type e report_data são obrigatórios' }, { status: 400 })
    }
    const result = await withTenant(async ({ client, tenantId, userId }) => {
      return await client.query(
        'SELECT * FROM register_report_snapshot($1, $2, $3, $4, $5, $6)',
        [learner_id, tenantId, report_type, 'client-generated', userId, JSON.stringify(report_data)]
      )
    })
    return NextResponse.json({ snapshot: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao registrar snapshot:', error)
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
