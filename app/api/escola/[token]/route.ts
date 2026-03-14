import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'

// =====================================================
// AXIS TDAH — API Pública: Portal do Professor
// GET — Validar token + retornar dados do paciente (resumo)
// SEM autenticação Clerk — acesso via token único
// Bible §14: Professor vê DRC + progresso resumido apenas
// Visibility: ❌ scores clínicos, ❌ snapshots, ❌ layer AuDHD
// =====================================================

async function validateToken(token: string) {
  const client = await pool.connect()
  try {
    await client.query("SET LOCAL app.tenant_id = ''")

    const res = await client.query(
      `SELECT t.*, p.name as patient_name, p.birth_date,
        p.school_name as patient_school, p.status as patient_status
      FROM tdah_teacher_tokens t
      JOIN tdah_patients p ON p.id = t.patient_id AND p.tenant_id = t.tenant_id
      WHERE t.token = $1 AND t.is_active = true`,
      [token]
    )

    if (res.rows.length === 0) {
      return null
    }

    const tokenData = res.rows[0]

    // Verificar expiração
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return null
    }

    // Atualizar last_used_at
    await client.query(
      'UPDATE tdah_teacher_tokens SET last_used_at = NOW() WHERE id = $1',
      [tokenData.id]
    )

    return tokenData
  } finally {
    client.release()
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const tokenData = await validateToken(token)

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token inválido, expirado ou revogado' },
        { status: 401 }
      )
    }

    const client = await pool.connect()
    try {
      // Protocolos ativos do paciente (professor pode ver apenas título e status)
      const protocols = await client.query(
        `SELECT id, code, title, status, block
        FROM tdah_protocols
        WHERE patient_id = $1 AND tenant_id = $2
          AND status NOT IN ('archived', 'discontinued')
        ORDER BY title`,
        [tokenData.patient_id, tokenData.tenant_id]
      )

      // Últimas 30 DRC entries (professor vê tudo do DRC)
      const drcs = await client.query(
        `SELECT d.id, d.drc_date, d.goal_description, d.goal_met, d.score,
          d.filled_by, d.filled_by_name, d.teacher_notes,
          d.reviewed_by IS NOT NULL as is_reviewed,
          d.protocol_id,
          tp.code as protocol_code, tp.title as protocol_title
        FROM tdah_drc d
        LEFT JOIN tdah_protocols tp ON tp.id = d.protocol_id
        WHERE d.patient_id = $1 AND d.tenant_id = $2
        ORDER BY d.drc_date DESC, d.created_at DESC
        LIMIT 30`,
        [tokenData.patient_id, tokenData.tenant_id]
      )

      // DRC resumo (últimos 30 dias)
      const drcSummary = await client.query(
        `SELECT
          COUNT(*) as total_entries,
          COUNT(*) FILTER (WHERE goal_met = true) as goals_met,
          COUNT(*) FILTER (WHERE goal_met = false) as goals_not_met,
          COUNT(*) FILTER (WHERE goal_met IS NULL) as goals_pending,
          ROUND(AVG(score) FILTER (WHERE score IS NOT NULL), 1) as avg_score
        FROM tdah_drc
        WHERE patient_id = $1 AND tenant_id = $2
          AND drc_date >= CURRENT_DATE - INTERVAL '30 days'`,
        [tokenData.patient_id, tokenData.tenant_id]
      )

      // Log access
      try {
        await client.query(
          `INSERT INTO tdah_teacher_access_log (tenant_id, token_id, patient_id, action, metadata)
           VALUES ($1, $2, $3, 'view_drc', '{}')`,
          [tokenData.tenant_id, tokenData.id, tokenData.patient_id]
        )
      } catch (_) { /* non-blocking */ }

      // Calcular idade
      let age = null
      if (tokenData.birth_date) {
        const bd = new Date(tokenData.birth_date)
        const now = new Date()
        age = now.getFullYear() - bd.getFullYear()
        if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) {
          age--
        }
      }

      return NextResponse.json({
        valid: true,
        teacher_name: tokenData.teacher_name,
        school_name: tokenData.school_name,
        patient: {
          name: tokenData.patient_name,
          age,
          school: tokenData.patient_school,
        },
        protocols: protocols.rows.map((p: any) => ({
          id: p.id, code: p.code, title: p.title, block: p.block
        })),
        drc_entries: drcs.rows,
        drc_summary: drcSummary.rows[0],
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[ESCOLA PORTAL] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
