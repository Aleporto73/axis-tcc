import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Observações (Trials)
// POST — Registrar observação durante sessão
// Bible §7 (Base), §8 (Executiva), §9.6 (AuDHD)
// Sessão deve estar 'in_progress' para aceitar obs
// =====================================================

// PIS válidos (Bible §7.2)
const VALID_PIS = ['independente', 'gestual', 'verbal', 'modelacao', 'fisica_parcial', 'fisica_total']
// BSS válidos (Bible §7.3)
const VALID_BSS = ['estavel', 'oscilante', 'instavel']
// EXR válidos (Bible §8)
const VALID_EXR = ['independente', 'apoio_minimo', 'apoio_significativo', 'nao_realiza']
// SEN válidos (Bible §9.6)
const VALID_SEN = ['sem_impacto', 'impacto_moderado', 'impacto_significativo']
// TRF válidos (Bible §9.6)
const VALID_TRF = ['transicao_fluida', 'com_resistencia', 'com_ruptura']
// RIG state (Bible §9.6.3)
const VALID_RIG_STATE = ['balanced', 'rigidity_leaning', 'impulsivity_leaning', 'dual_risk']
const VALID_RIG_SEVERITY = ['none', 'mild', 'moderate', 'high']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      session_id, protocol_id,
      task_block_number, task_description,
      sas_score, pis_level, bss_level,
      exr_level,
      sen_level, trf_level, rig_state, rig_severity,
      msk_value,
      observation_notes,
    } = body

    if (!session_id) {
      return NextResponse.json({ error: 'session_id é obrigatório' }, { status: 400 })
    }

    // Validar enums
    if (pis_level && !VALID_PIS.includes(pis_level)) {
      return NextResponse.json({ error: `pis_level inválido. Válidos: ${VALID_PIS.join(', ')}` }, { status: 400 })
    }
    if (bss_level && !VALID_BSS.includes(bss_level)) {
      return NextResponse.json({ error: `bss_level inválido. Válidos: ${VALID_BSS.join(', ')}` }, { status: 400 })
    }
    if (exr_level && !VALID_EXR.includes(exr_level)) {
      return NextResponse.json({ error: `exr_level inválido. Válidos: ${VALID_EXR.join(', ')}` }, { status: 400 })
    }
    if (sen_level && !VALID_SEN.includes(sen_level)) {
      return NextResponse.json({ error: `sen_level inválido` }, { status: 400 })
    }
    if (trf_level && !VALID_TRF.includes(trf_level)) {
      return NextResponse.json({ error: `trf_level inválido` }, { status: 400 })
    }
    if (rig_state && !VALID_RIG_STATE.includes(rig_state)) {
      return NextResponse.json({ error: `rig_state inválido` }, { status: 400 })
    }
    if (rig_severity && !VALID_RIG_SEVERITY.includes(rig_severity)) {
      return NextResponse.json({ error: `rig_severity inválido` }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      // Verificar sessão existe, pertence ao tenant, e está in_progress
      const sessCheck = await ctx.client.query(
        `SELECT id, status, patient_id FROM tdah_sessions WHERE id = $1 AND tenant_id = $2`,
        [session_id, ctx.tenantId]
      )

      if (sessCheck.rows.length === 0) {
        const err = new Error('Sessão não encontrada') as any
        err.statusCode = 404
        throw err
      }

      if (sessCheck.rows[0].status !== 'in_progress') {
        const err = new Error('Sessão não está em andamento. Abra a sessão antes de registrar observações.') as any
        err.statusCode = 422
        throw err
      }

      // Se protocol_id fornecido, verificar que pertence ao paciente e está ativo
      if (protocol_id) {
        const protCheck = await ctx.client.query(
          `SELECT id FROM tdah_protocols WHERE id = $1 AND patient_id = $2 AND tenant_id = $3 AND status = 'active'`,
          [protocol_id, sessCheck.rows[0].patient_id, ctx.tenantId]
        )
        if (protCheck.rows.length === 0) {
          const err = new Error('Protocolo não encontrado ou não está ativo para este paciente') as any
          err.statusCode = 422
          throw err
        }
      }

      return await ctx.client.query(
        `INSERT INTO tdah_observations (
          tenant_id, session_id, protocol_id,
          task_block_number, task_description,
          sas_score, pis_level, bss_level,
          exr_level,
          sen_level, trf_level, rig_state, rig_severity,
          msk_value,
          observation_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          ctx.tenantId, session_id, protocol_id || null,
          task_block_number || null, task_description || null,
          sas_score ?? null, pis_level || null, bss_level || null,
          exr_level || null,
          sen_level || null, trf_level || null, rig_state || null, rig_severity || null,
          msk_value ?? null,
          observation_notes || null,
        ]
      )
    })

    return NextResponse.json({ observation: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
