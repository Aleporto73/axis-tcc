import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { computeFullCsoTdah, CSO_TDAH_ENGINE_VERSION } from '@/src/engines/cso-tdah'
import { observationsToInput } from '@/src/engines/cso-tdah-adapter'
import type { AudhdLayerStatus, CsoTdahWeights } from '@/src/engines/cso-tdah'

// =====================================================
// AXIS TDAH - API: Sessão por ID
// GET — Sessão com observações e protocolos do paciente
// PATCH — Abrir/fechar sessão, atualizar notas
// CLOSE gera snapshot CSO-TDAH automático (append-only)
// Bible §11: sessão fechada é imutável
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      // Sessão com paciente
      const session = await ctx.client.query(
        `SELECT s.*, p.name as patient_name
         FROM tdah_sessions s
         JOIN tdah_patients p ON p.id = s.patient_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [id, ctx.tenantId]
      )

      if (session.rows.length === 0) {
        const err = new Error('Sessão não encontrada') as any
        err.statusCode = 404
        throw err
      }

      const sess = session.rows[0]

      // Observações desta sessão
      const observations = await ctx.client.query(
        `SELECT o.*, tp.code as protocol_code, tp.title as protocol_title, tp.block as protocol_block
         FROM tdah_observations o
         LEFT JOIN tdah_protocols tp ON tp.id = o.protocol_id
         WHERE o.session_id = $1 AND o.tenant_id = $2
         ORDER BY o.created_at`,
        [id, ctx.tenantId]
      )

      // Protocolos ativos do paciente (para seleção durante registro)
      const protocols = await ctx.client.query(
        `SELECT id, code, title, block, requires_audhd_layer
         FROM tdah_protocols
         WHERE patient_id = $1 AND tenant_id = $2 AND status = 'active'
         ORDER BY block, code`,
        [sess.patient_id, ctx.tenantId]
      )

      return {
        session: sess,
        observations: observations.rows,
        protocols: protocols.rows,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, session_notes } = body

    const result = await withTenant(async (ctx) => {
      // Buscar sessão atual
      const current = await ctx.client.query(
        `SELECT id, status, patient_id FROM tdah_sessions WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )

      if (current.rows.length === 0) {
        const err = new Error('Sessão não encontrada') as any
        err.statusCode = 404
        throw err
      }

      const sess = current.rows[0]

      // Bible §11: sessão fechada é imutável
      if (sess.status === 'completed' && action !== undefined) {
        const err = new Error('Sessão já fechada — dados imutáveis (Bible §11)') as any
        err.statusCode = 422
        throw err
      }

      if (action === 'open') {
        if (sess.status !== 'scheduled') {
          const err = new Error(`Só é possível abrir sessão com status 'scheduled'. Status atual: ${sess.status}`) as any
          err.statusCode = 422
          throw err
        }
        return await ctx.client.query(
          `UPDATE tdah_sessions SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2 RETURNING *`,
          [id, ctx.tenantId]
        )
      }

      if (action === 'close') {
        if (sess.status !== 'in_progress') {
          const err = new Error(`Só é possível fechar sessão 'in_progress'. Status atual: ${sess.status}`) as any
          err.statusCode = 422
          throw err
        }

        // Calcular duração
        const durationRes = await ctx.client.query(
          `SELECT EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 as duration
           FROM tdah_sessions WHERE id = $1`,
          [id]
        )
        const duration = Math.round(durationRes.rows[0]?.duration || 0)

        // Fechar sessão
        const closedSession = await ctx.client.query(
          `UPDATE tdah_sessions SET status = 'completed', ended_at = NOW(), duration_minutes = $3, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2 RETURNING *`,
          [id, ctx.tenantId, duration]
        )

        // ── Gerar snapshot CSO-TDAH (Bible §10, Anexo G) ──
        try {
          // Buscar observações da sessão
          const obsRes = await ctx.client.query(
            `SELECT * FROM tdah_observations WHERE session_id = $1 AND tenant_id = $2 ORDER BY created_at`,
            [id, ctx.tenantId]
          )

          if (obsRes.rows.length > 0) {
            // Buscar AuDHD layer status do paciente
            const patientRes = await ctx.client.query(
              `SELECT audhd_layer_status FROM tdah_patients WHERE id = $1`,
              [sess.patient_id]
            )
            const audhdStatus = (patientRes.rows[0]?.audhd_layer_status || 'off') as AudhdLayerStatus

            // Buscar pesos do engine (se configurados)
            const engineRes = await ctx.client.query(
              `SELECT weights FROM engine_versions WHERE engine_name = 'CSO-TDAH' AND is_current = true`
            )
            const dbWeights = engineRes.rows[0]?.weights as CsoTdahWeights | null

            // Converter observações → input do motor
            const input = observationsToInput(obsRes.rows, {
              audhdLayerStatus: audhdStatus,
              sessionContext: closedSession.rows[0].session_context,
              weights: dbWeights || undefined,
            })

            // Computar CSO-TDAH
            const cso = computeFullCsoTdah(input)

            // Salvar snapshot (append-only, imutável)
            await ctx.client.query(
              `INSERT INTO tdah_snapshots (
                tenant_id, patient_id, session_id, snapshot_type,
                engine_name, engine_version,
                audhd_layer_status, core_score, executive_score,
                audhd_layer_score, final_score, final_band, confidence_flag,
                missing_data_primary_flag, missing_data_flags_json,
                source_contexts_json, core_metrics_json, executive_metrics_json,
                audhd_metrics_json, audhd_flags_json
              ) VALUES ($1, $2, $3, 'session_close',
                $4, $5, $6::audhd_layer_status_enum, $7, $8, $9, $10,
                $11::tdah_final_band_enum, $12::tdah_confidence_enum,
                $13, $14, $15, $16, $17, $18, $19)`,
              [
                ctx.tenantId, sess.patient_id, id,
                cso.engine_name, cso.engine_version,
                cso.audhd_layer_status,
                cso.core_score, cso.executive_score,
                cso.audhd_layer_score, cso.final_score,
                cso.final_band, cso.confidence_flag,
                cso.missing_data_primary_flag,
                JSON.stringify(cso.missing_data_flags),
                JSON.stringify(cso.source_contexts),
                JSON.stringify(cso.base_metrics),
                JSON.stringify(cso.executive_metrics),
                cso.audhd_metrics ? JSON.stringify(cso.audhd_metrics) : null,
                cso.audhd_flags ? JSON.stringify(cso.audhd_flags) : null,
              ]
            )
          }
        } catch (snapshotErr) {
          // Snapshot é non-blocking — sessão já foi fechada
          // Log para debug mas não falha a resposta
          console.error('[CSO-TDAH] Erro ao gerar snapshot:', snapshotErr)
        }

        return closedSession
      }

      if (action === 'cancel') {
        if (sess.status === 'completed') {
          const err = new Error('Não é possível cancelar sessão já concluída') as any
          err.statusCode = 422
          throw err
        }
        return await ctx.client.query(
          `UPDATE tdah_sessions SET status = 'cancelled', updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2 RETURNING *`,
          [id, ctx.tenantId]
        )
      }

      // Atualizar notas (permitido mesmo em sessão concluída — notas != dados clínicos)
      if (session_notes !== undefined) {
        return await ctx.client.query(
          `UPDATE tdah_sessions SET session_notes = $3, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2 RETURNING *`,
          [id, ctx.tenantId, session_notes]
        )
      }

      const err = new Error('Nenhuma ação válida fornecida') as any
      err.statusCode = 400
      throw err
    })

    return NextResponse.json({ session: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
