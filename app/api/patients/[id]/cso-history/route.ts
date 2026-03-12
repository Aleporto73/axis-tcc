import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    return await withTenant(async (ctx) => {
      // Verifica se o paciente pertence ao tenant
      const patientResult = await ctx.client.query(
        'SELECT id, full_name FROM patients WHERE id = $1 AND tenant_id = $2',
        [id, ctx.tenantId]
      )
      if (patientResult.rows.length === 0) {
        return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
      }

      // Busca historico CSO com as 4 dimensoes
      const csoResult = await ctx.client.query(
        `SELECT
          created_at,
          activation_level,
          emotional_load,
          task_adherence,
          flex_trend,
          recovery_time,
          system_confidence,
          clinical_phase
         FROM clinical_states
         WHERE patient_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC`,
        [id, ctx.tenantId]
      )

      const history = csoResult.rows.map((row: any, idx: number) => ({
        index: idx + 1,
        date: row.created_at,
        activation_level: row.activation_level != null ? parseFloat(row.activation_level) : null,
        emotional_load: row.emotional_load != null ? parseFloat(row.emotional_load) : null,
        task_adherence: row.task_adherence != null ? parseFloat(row.task_adherence) : null,
        flex_trend: row.flex_trend || 'flat',
        recovery_time: row.recovery_time,
        system_confidence: row.system_confidence != null ? parseFloat(row.system_confidence) : null,
        clinical_phase: row.clinical_phase || 'avaliacao',
      }))

      // Calcula ultimo CSO e delta
      const latest = history.length > 0 ? history[history.length - 1] : null
      const previous = history.length > 1 ? history[history.length - 2] : null

      let delta = null
      if (latest && previous) {
        const avg = (v: number | null) => v ?? 0
        const latestAvg = (avg(latest.activation_level) + (1 - avg(latest.emotional_load)) + avg(latest.task_adherence)) / 3
        const prevAvg = (avg(previous.activation_level) + (1 - avg(previous.emotional_load)) + avg(previous.task_adherence)) / 3
        delta = Math.round((latestAvg - prevAvg) * 100)
      }

      return NextResponse.json({
        patient_name: patientResult.rows[0].full_name,
        total_records: history.length,
        history,
        latest,
        delta,
      })
    })

  } catch (error) {
    console.error('Erro ao buscar CSO history:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
