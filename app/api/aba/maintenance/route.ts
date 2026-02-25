import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const protocolId = searchParams.get('protocol_id')
    const learnerId = searchParams.get('learner_id')
    const result = await withTenant(async ({ client, tenantId }) => {
      let q = `SELECT mp.*, lp.title as protocol_title, l.name as learner_name FROM maintenance_probes mp JOIN learner_protocols lp ON lp.id = mp.protocol_id JOIN learners l ON l.id = lp.learner_id WHERE mp.tenant_id = $1`
      const p: any[] = [tenantId]
      if (protocolId) { p.push(protocolId); q += ` AND mp.protocol_id = $${p.length}` }
      if (learnerId) { p.push(learnerId); q += ` AND lp.learner_id = $${p.length}` }
      q += ' ORDER BY mp.scheduled_at ASC'
      return await client.query(q, p)
    })
    return NextResponse.json({ probes: result.rows })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    if (action === 'schedule') {
      const { protocol_id } = body
      if (!protocol_id) return NextResponse.json({ error: 'protocol_id obrigatório' }, { status: 400 })
      const result = await withTenant(async ({ client, tenantId }) => {
        const proto = await client.query('SELECT id, learner_id, status, maintained_at FROM learner_protocols WHERE id = $1 AND tenant_id = $2', [protocol_id, tenantId])
        if (proto.rows.length === 0) throw new Error('Protocolo não encontrado')
        if (proto.rows[0].status !== 'maintained') throw new Error('Protocolo precisa estar "maintained"')
        const baseDate = proto.rows[0].maintained_at || new Date()
        const schedules = [{ weeks:2, label:'Sonda 2 semanas' }, { weeks:6, label:'Sonda 6 semanas' }, { weeks:12, label:'Sonda 12 semanas' }]
        const probes = []
        for (const s of schedules) {
          const d = new Date(baseDate); d.setDate(d.getDate() + s.weeks * 7)
          const ex = await client.query('SELECT id FROM maintenance_probes WHERE protocol_id=$1 AND tenant_id=$2 AND week_number=$3', [protocol_id, tenantId, s.weeks])
          if (ex.rows.length > 0) continue
          const ins = await client.query(`INSERT INTO maintenance_probes (tenant_id, protocol_id, learner_id, week_number, label, scheduled_at, status) VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`, [tenantId, protocol_id, proto.rows[0].learner_id, s.weeks, s.label, d])
          probes.push(ins.rows[0])
        }
        return { scheduled: probes.length, probes }
      })
      return NextResponse.json(result, { status: 201 })
    } else if (action === 'evaluate') {
      const { probe_id, trials_total, trials_correct, prompt_level, notes } = body
      if (!probe_id || !trials_total) return NextResponse.json({ error: 'probe_id e trials_total obrigatórios' }, { status: 400 })
      const result = await withTenant(async ({ client, tenantId, userId }) => {
        const probe = await client.query('SELECT * FROM maintenance_probes WHERE id=$1 AND tenant_id=$2', [probe_id, tenantId])
        if (probe.rows.length === 0) throw new Error('Sonda não encontrada')
        if (probe.rows[0].status !== 'pending') throw new Error('Sonda já avaliada')
        const score_pct = trials_total > 0 ? Math.round((trials_correct/trials_total)*10000)/100 : 0
        const proto = await client.query('SELECT mastery_criteria_pct FROM learner_protocols WHERE id=$1 AND tenant_id=$2', [probe.rows[0].protocol_id, tenantId])
        const mastery_pct = proto.rows[0]?.mastery_criteria_pct || 80
        const passed = score_pct >= mastery_pct
        const probeResult = passed ? 'passed' : 'failed'

        await client.query(
          `UPDATE maintenance_probes SET status='completed', result=$1, trials_total=$2, trials_correct=$3, score_pct=$4, prompt_level=$5, notes=$6, evaluated_by=$7, evaluated_at=NOW() WHERE id=$8 AND tenant_id=$9`,
          [probeResult, trials_total, trials_correct||0, score_pct, prompt_level||'independent', notes||null, userId||'system', probe_id, tenantId])

        await client.query(
          `INSERT INTO axis_audit_logs (tenant_id,user_id,actor,action,entity_type,metadata,created_at)
           VALUES ($1,$2,'system','MAINTENANCE_PROBE_EVALUATED','maintenance_probes',
           jsonb_build_object('probe_id',$3,'protocol_id',$4,'result',$5,'score_pct',$6),NOW())`,
          [tenantId, userId||'system', probe_id, probe.rows[0].protocol_id, probeResult, score_pct])

        // ─── Bible S3: Regressão automática se score < 70% ───
        // Limiar fixo de 70% (independente do mastery_criteria_pct do protocolo).
        // Transição respeita o lifecycle: status → "regression" (não direto para "active").
        const REGRESSION_THRESHOLD = 70
        let regression = false
        if (score_pct < REGRESSION_THRESHOLD) {
          await client.query(
            `UPDATE learner_protocols SET status='regression', updated_at=NOW(), regression_count=COALESCE(regression_count,0)+1 WHERE id=$1 AND tenant_id=$2`,
            [probe.rows[0].protocol_id, tenantId])

          await client.query(
            `INSERT INTO axis_audit_logs (tenant_id,user_id,actor,action,entity_type,metadata,created_at)
             VALUES ($1,$2,'system','REGRESSION_DETECTED_AUTO','learner_protocols',
             jsonb_build_object('protocol_id',$3,'learner_id',$4,'probe_id',$5,'score_pct',$6,'threshold',70),NOW())`,
            [tenantId, userId||'system', probe.rows[0].protocol_id, probe.rows[0].learner_id, probe_id, score_pct])

          // Cancelar sondas pendentes restantes — protocolo saiu de manutenção
          await client.query(
            `UPDATE maintenance_probes SET status='cancelled', notes=COALESCE(notes,'')||' [Cancelada: regressão detectada]' WHERE protocol_id=$1 AND tenant_id=$2 AND status='pending'`,
            [probe.rows[0].protocol_id, tenantId])

          regression = true
        }

        return { probe_id, result: probeResult, score_pct, passed, regression, regression_threshold: REGRESSION_THRESHOLD }
      })
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: 'action deve ser "schedule" ou "evaluate"' }, { status: 400 })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
