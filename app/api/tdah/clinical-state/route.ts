import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// =====================================================
// AXIS TDAH — API Estado Clínico (CSO-TDAH)
// Equivalente a /api/aba/clinical-state
// Tabela: tdah_snapshots (append-only, Bible §7)
//
// Diferenças vs ABA:
//   - 3 blocos (core + executive + audhd) vs 4 dimensões lineares
//   - final_band com confidence_flag
//   - RIG categórico (flag, não score)
//   - source_contexts tricontextual
//   - audhd_layer_status no snapshot
// =====================================================

// GET — Estado clínico atual + histórico de um paciente
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId, userId, role }) => {
      const { searchParams } = new URL(request.url)
      const patientId = searchParams.get('patient_id')

      if (!patientId) {
        throw new Error('patient_id é obrigatório')
      }

      // Verificar paciente pertence ao tenant
      const patient = await client.query(
        `SELECT id, name, audhd_layer_status, created_by
         FROM tdah_patients
         WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
        [patientId, tenantId]
      )

      if (patient.rows.length === 0) {
        throw new Error('Paciente não encontrado')
      }

      // Role filter: terapeuta vê só seus pacientes
      if (role === 'terapeuta') {
        const prof = await client.query(
          'SELECT clerk_user_id FROM profiles WHERE clerk_user_id = $1 AND tenant_id = $2',
          [userId, tenantId]
        )
        if (prof.rows.length > 0 && patient.rows[0].created_by !== userId) {
          throw new Error('Acesso negado — paciente de outro terapeuta')
        }
      }

      const pat = patient.rows[0]

      // Último snapshot (estado clínico atual)
      const latest = await client.query(
        `SELECT
          id, session_id, snapshot_type, engine_version,
          core_score, executive_score, audhd_layer_score, final_score,
          final_band, confidence_flag,
          audhd_layer_status,
          rig_state, rig_severity,
          core_metrics_json, executive_metrics_json, audhd_metrics_json,
          source_contexts_json,
          missing_data_primary_flag, missing_data_flags_json,
          flags_json, created_at
        FROM tdah_snapshots
        WHERE patient_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
        LIMIT 1`,
        [patientId, tenantId]
      )

      // Histórico (últimos 20 snapshots)
      const history = await client.query(
        `SELECT
          id, session_id, snapshot_type,
          core_score, executive_score, audhd_layer_score, final_score,
          final_band, confidence_flag,
          audhd_layer_status, rig_state, rig_severity,
          created_at
        FROM tdah_snapshots
        WHERE patient_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
        LIMIT 20`,
        [patientId, tenantId]
      )

      // Delta vs anterior
      let delta = null
      if (history.rows.length >= 2) {
        const current = history.rows[0]
        const previous = history.rows[1]
        delta = {
          final_score: +(current.final_score - previous.final_score).toFixed(2),
          core_score: +(current.core_score - previous.core_score).toFixed(2),
          executive_score: current.executive_score != null && previous.executive_score != null
            ? +(current.executive_score - previous.executive_score).toFixed(2)
            : null,
          audhd_layer_score: current.audhd_layer_score != null && previous.audhd_layer_score != null
            ? +(current.audhd_layer_score - previous.audhd_layer_score).toFixed(2)
            : null,
          band_changed: current.final_band !== previous.final_band,
          previous_band: previous.final_band,
        }
      }

      // Contadores de sessões por contexto (30 dias)
      const contextCounts = await client.query(
        `SELECT session_context, COUNT(*) as count
         FROM tdah_sessions
         WHERE patient_id = $1 AND tenant_id = $2 AND status = 'completed'
           AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY session_context`,
        [patientId, tenantId]
      )

      const contexts: Record<string, number> = {}
      for (const row of contextCounts.rows) {
        contexts[row.session_context] = parseInt(row.count)
      }

      return {
        patient: {
          id: pat.id,
          name: pat.name,
          audhd_layer_status: pat.audhd_layer_status,
        },
        current: latest.rows[0] || null,
        delta,
        history: history.rows,
        context_distribution: contexts,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('obrigatório')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message === 'Paciente não encontrado') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message?.includes('Acesso negado')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[TDAH CLINICAL-STATE] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
