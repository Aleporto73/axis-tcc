import { NextResponse } from 'next/server'
import pool from '@/src/database/db'

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '123e4567-e89b-12d3-a456-426614174000'

export async function GET() {
  const client = await pool.connect()
  try {
    // Aprendizes
    const learners = await client.query(
      `SELECT id, name as full_name, diagnosis, support_level, is_active
       FROM learners WHERE tenant_id = $1 AND is_active = true ORDER BY name`,
      [TENANT_ID]
    )

    // CSO atual por aprendiz
    const cso = await client.query(
      `SELECT DISTINCT ON (cs.learner_id) cs.learner_id, cs.cso_aba, cs.cso_band, cs.created_at
       FROM clinical_states_aba cs
       WHERE cs.tenant_id = $1
       ORDER BY cs.learner_id, cs.created_at DESC`,
      [TENANT_ID]
    )

    // Protocolos ativos
    const protocols = await client.query(
      `SELECT learner_id, COUNT(*) FILTER (WHERE status='active') as active,
              COUNT(*) FILTER (WHERE status IN ('mastered','maintained')) as mastered
       FROM learner_protocols WHERE tenant_id = $1
       GROUP BY learner_id`,
      [TENANT_ID]
    )

    // Alertas regressão
    const alerts = await client.query(
      `SELECT DISTINCT ON (cs.learner_id) cs.learner_id, cs.cso_band
       FROM clinical_states_aba cs
       WHERE cs.tenant_id = $1 AND cs.cso_band = 'critico'
       ORDER BY cs.learner_id, cs.created_at DESC`,
      [TENANT_ID]
    )

    // Histórico CSO por aprendiz para gráficos
    const csoHistory = await client.query(
      `SELECT cs.learner_id, cs.cso_aba, cs.sas, cs.pis, cs.bss, cs.tcm, cs.cso_band, cs.created_at
       FROM clinical_states_aba cs
       JOIN learners l ON l.id = cs.learner_id
       WHERE cs.tenant_id = $1 AND l.is_active = true
       ORDER BY cs.learner_id, cs.created_at ASC`,
      [TENANT_ID]
    )
    const csoMap = Object.fromEntries(cso.rows.map((r: any) => [r.learner_id, r]))
    const protMap = Object.fromEntries(protocols.rows.map((r: any) => [r.learner_id, r]))
    const alertSet = new Set(alerts.rows.map((r: any) => r.learner_id))
    const historyMap: Record<string, any[]> = {}
    for (const row of csoHistory.rows) {
      if (!historyMap[row.learner_id]) historyMap[row.learner_id] = []
      historyMap[row.learner_id].push(row)
    }
    const result = learners.rows.map((l: any) => ({
      ...l,
      cso: csoMap[l.id] || null,
      protocols: protMap[l.id] || { active: 0, mastered: 0 },
      has_alert: alertSet.has(l.id),
      cso_history: historyMap[l.id] || [],
    }))
    const bandOrder: Record<string,number> = { excelente: 0, bom: 1, atencao: 2, critico: 3 }
    result.sort((a: any, b: any) => (bandOrder[a.cso?.cso_band] ?? 4) - (bandOrder[b.cso?.cso_band] ?? 4))
    return NextResponse.json({ learners: result })
  } catch (err: any) {
    console.error('Demo API error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  } finally {
    client.release()
  }
}
