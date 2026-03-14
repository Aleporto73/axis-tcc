import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'

// =====================================================
// AXIS TDAH — API Pública: Portal Família
// GET — Validar token + retornar dados do paciente
// POST — Aceitar consentimento LGPD
// SEM autenticação Clerk — acesso via token
// Visibility: Progresso resumido, DRC, sessões
// ❌ Scores CSO-TDAH, ❌ Snapshots, ❌ Layer AuDHD
// =====================================================

async function validateToken(token: string) {
  const client = await pool.connect()
  try {
    const res = await client.query(
      `SELECT t.*, p.name as patient_name, p.birth_date, p.status as patient_status,
        p.school_name, p.diagnosis
      FROM tdah_family_tokens t
      JOIN tdah_patients p ON p.id = t.patient_id AND p.tenant_id = t.tenant_id
      WHERE t.token = $1 AND t.is_active = true`,
      [token]
    )
    if (res.rows.length === 0) return null
    const td = res.rows[0]
    if (td.expires_at && new Date(td.expires_at) < new Date()) return null

    await client.query(
      'UPDATE tdah_family_tokens SET last_accessed_at = NOW() WHERE id = $1',
      [td.id]
    )
    return td
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

    // Verificar consentimento
    if (!tokenData.consent_accepted_at) {
      return NextResponse.json({
        valid: true,
        needs_consent: true,
        guardian_name: tokenData.guardian_name,
        patient_name: tokenData.patient_name,
      })
    }

    const client = await pool.connect()
    try {
      const patientId = tokenData.patient_id
      const tenantId = tokenData.tenant_id

      // Idade
      let age = null
      if (tokenData.birth_date) {
        const bd = new Date(tokenData.birth_date)
        const now = new Date()
        age = now.getFullYear() - bd.getFullYear()
        if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--
      }

      // Protocolos ativos (status simplificado)
      const protocols = await client.query(
        `SELECT id, code, title, status, block,
          CASE
            WHEN status IN ('mastered', 'maintenance', 'generalization') THEN 'conquistado'
            WHEN status = 'active' THEN 'em_progresso'
            WHEN status = 'regression' THEN 'em_revisao'
            ELSE status
          END as status_label
        FROM tdah_protocols
        WHERE patient_id = $1 AND tenant_id = $2
          AND status NOT IN ('archived', 'discontinued')
        ORDER BY status, title`,
        [patientId, tenantId]
      )

      // DRC resumo (30 dias) — progresso resumido
      const drcSummary = await client.query(
        `SELECT
          COUNT(*) as total_entries,
          COUNT(*) FILTER (WHERE goal_met = true) as goals_met,
          COUNT(*) FILTER (WHERE goal_met = false) as goals_not_met,
          ROUND(AVG(score) FILTER (WHERE score IS NOT NULL), 1) as avg_score
        FROM tdah_drc
        WHERE patient_id = $1 AND tenant_id = $2
          AND drc_date >= CURRENT_DATE - INTERVAL '30 days'`,
        [patientId, tenantId]
      )

      // Sessões futuras (próximas 5)
      const upcomingSessions = await client.query(
        `SELECT id, session_date, session_context, status
        FROM tdah_sessions
        WHERE patient_id = $1 AND tenant_id = $2
          AND status = 'scheduled'
          AND session_date >= CURRENT_DATE
        ORDER BY session_date ASC
        LIMIT 5`,
        [patientId, tenantId]
      )

      // Sessões recentes (últimas 10 completadas — apenas data + contexto + duração)
      const recentSessions = await client.query(
        `SELECT id, session_date, session_context, duration_minutes, status
        FROM tdah_sessions
        WHERE patient_id = $1 AND tenant_id = $2
          AND status = 'completed'
        ORDER BY session_date DESC
        LIMIT 10`,
        [patientId, tenantId]
      )

      // Resumos de sessão aprovados (enviados para família)
      const summaries = await client.query(
        `SELECT id, session_id, summary_text, status, created_at
        FROM session_summaries
        WHERE patient_id = $1 AND tenant_id = $2
          AND source_module = 'tdah'
          AND status = 'sent'
        ORDER BY created_at DESC
        LIMIT 10`,
        [patientId, tenantId]
      )

      // Conquistas (protocolos mastered)
      const achievements = await client.query(
        `SELECT code, title, mastered_at
        FROM tdah_protocols
        WHERE patient_id = $1 AND tenant_id = $2
          AND status IN ('mastered', 'maintenance')
          AND mastered_at IS NOT NULL
        ORDER BY mastered_at DESC
        LIMIT 10`,
        [patientId, tenantId]
      )

      // Log access
      try {
        await client.query(
          `INSERT INTO tdah_family_access_log (tenant_id, token_id, patient_id, action)
           VALUES ($1, $2, $3, 'view_portal')`,
          [tenantId, tokenData.id, patientId]
        )
      } catch (_) {}

      return NextResponse.json({
        valid: true,
        needs_consent: false,
        guardian_name: tokenData.guardian_name,
        relationship: tokenData.relationship,
        patient: {
          name: tokenData.patient_name,
          age,
          school: tokenData.school_name,
          status: tokenData.patient_status,
        },
        protocols: protocols.rows,
        drc_summary: drcSummary.rows[0],
        upcoming_sessions: upcomingSessions.rows,
        recent_sessions: recentSessions.rows,
        session_summaries: summaries.rows,
        achievements: achievements.rows,
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[FAMILIA PORTAL] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Aceitar consentimento LGPD
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { accept_consent } = body

    if (!accept_consent) {
      return NextResponse.json({ error: 'Consentimento não aceito' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
      const res = await client.query(
        `UPDATE tdah_family_tokens
         SET consent_accepted_at = NOW(), consent_version = '1.0'
         WHERE token = $1 AND is_active = true AND consent_accepted_at IS NULL
         RETURNING id, guardian_name`,
        [token]
      )

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Token inválido ou consentimento já aceito' }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: 'Consentimento registrado' })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[FAMILIA CONSENT] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
