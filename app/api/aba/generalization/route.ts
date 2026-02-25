import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const protocolId = searchParams.get('protocol_id')
    if (!protocolId) return NextResponse.json({ error: 'protocol_id obrigatório' }, { status: 400 })
    const result = await withTenant(async ({ client, tenantId }) => {
      return await client.query(
        `SELECT gp.*, lp.title as protocol_title FROM generalization_probes gp
         JOIN learner_protocols lp ON lp.id = gp.protocol_id
         WHERE gp.protocol_id = $1 AND gp.tenant_id = $2
         ORDER BY gp.variation_number, gp.context_number, gp.created_at DESC`, [protocolId, tenantId])
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
    const { protocol_id, variation_number, context_number, variation_desc, context_desc, trials_total, trials_correct, prompt_level, notes } = body
    if (!protocol_id || !variation_number || !context_number || !trials_total) return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      const proto = await client.query('SELECT id, learner_id, status, mastery_criteria_pct FROM learner_protocols WHERE id = $1 AND tenant_id = $2', [protocol_id, tenantId])
      if (proto.rows.length === 0) throw new Error('Protocolo não encontrado')
      if (proto.rows[0].status !== 'generalization') throw new Error('Protocolo precisa estar em "generalization"')
      const score_pct = trials_total > 0 ? Math.round((trials_correct / trials_total) * 10000) / 100 : 0
      const insert = await client.query(
        `INSERT INTO generalization_probes (tenant_id, protocol_id, learner_id, variation_number, context_number, variation_desc, context_desc, trials_total, trials_correct, score_pct, prompt_level, notes, evaluated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [tenantId, protocol_id, proto.rows[0].learner_id, variation_number, context_number, variation_desc||null, context_desc||null, trials_total, trials_correct||0, score_pct, prompt_level||'independent', notes||null, userId||'system'])
      const mastery_pct = proto.rows[0].mastery_criteria_pct || 80
      const allCells = await client.query(
        `SELECT DISTINCT ON (variation_number, context_number) variation_number, context_number, score_pct
         FROM generalization_probes WHERE protocol_id = $1 AND tenant_id = $2
         ORDER BY variation_number, context_number, created_at DESC`, [protocol_id, tenantId])
      const cells = allCells.rows
      const filledCells = cells.length
      const passingCells = cells.filter((c: any) => c.score_pct >= mastery_pct).length
      const gridComplete = filledCells === 6 && passingCells === 6

      // Bible S3 — Score de generalização:
      //   Grid 3×2 completo (6/6 aprovadas) = 100%
      //   Grid incompleto = 75%
      const generalization_score = gridComplete ? 100 : 75

      // Bible S3.2 regra 6 — Auto-transição para mastered_validated
      // Só ocorre quando grid 3×2 está 100% completo e aprovado
      let autoTransitioned = false
      if (gridComplete) {
        await client.query(
          `UPDATE learner_protocols SET status = 'mastered_validated', mastered_validated_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [protocol_id, tenantId])
        await client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1,$2,'system','GENERALIZATION_GRID_COMPLETE','learner_protocols',
           jsonb_build_object('protocol_id',$3,'cells_passed',6,'criteria_pct',$4,'generalization_score',100),NOW())`,
          [tenantId, userId||'system', protocol_id, mastery_pct])
        autoTransitioned = true
      }

      return {
        probe: insert.rows[0],
        matrix: { total_cells: 6, filled_cells: filledCells, passing_cells: passingCells },
        generalization_score,
        auto_transitioned: autoTransitioned,
      }
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (error.message.includes('Protocolo')) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
