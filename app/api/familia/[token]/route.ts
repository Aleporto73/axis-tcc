import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'
import { rateLimit } from '@/src/middleware/rate-limit'

// =====================================================
// AXIS TDAH — API Pública: Portal Familia
// GET — Validar token + retornar dados do paciente
// POST — Aceitar consentimento LGPD
// SEM autenticação Clerk — acesso via token
// Visibility: Progresso resumido, DRC, sessoes, rotinas, token economy
// No Scores CSO-TDAH, No Snapshots, No Layer AuDHD
//
// Segurança (Auditoria P1):
//   - Rate limit: 30 req/min por IP (portal público)
//   - Token: 256-bit random, expiração validada
//   - Access log: append-only (tdah_family_access_log)
// =====================================================

// Rate limit config para portais públicos
const PORTAL_RATE_LIMIT = { limit: 30, windowMs: 60_000, prefix: 'portal-familia' }

async function validateToken(token: string) {
  const client = await pool.connect()
  try {
    // RLS em tdah_patients exige app.tenant_id setado.
    // Como tenant_id vem do token, separamos em 2 etapas:
    // 1) Buscar token (tdah_family_tokens) - descobre tenant_id
    // 2) SET LOCAL app.tenant_id + buscar patient (tdah_patients, com RLS)
    //
    // IMPORTANTE: a Etapa 1 abaixo roda SEM app.tenant_id setado.
    // tdah_family_tokens (e tdah_teacher_tokens) ficam PERMANENTEMENTE FORA de RLS por design.
    // Justificativa: token hex64 globalmente UNIQUE (256 bits entropy), lookup
    // direto descobre tenant_id, RLS criaria chicken-and-egg sem ganho de
    // seguranca real. Decisao documentada em docs/NOTE_TDAH.md e
    // docs/SKILL_TDAH.md.

    // Etapa 1: token + tenant_id (sem RLS necessaria aqui)
    const tokenRes = await client.query(
      `SELECT id, token, tenant_id, patient_id, guardian_name,
              consent_accepted_at, expires_at, is_active
       FROM tdah_family_tokens
       WHERE token = $1 AND is_active = true`,
      [token]
    )
    if (tokenRes.rows.length === 0) return null
    const td = tokenRes.rows[0]
    if (td.expires_at && new Date(td.expires_at) < new Date()) return null

    // Guard: tenant_id obrigatorio pra setar GUC. Falha silenciosa se ausente.
    if (!td.tenant_id) {
      console.error('[PORTAL FAMILIA] Token sem tenant_id:', td.id)
      return null
    }

    // Etapa 2: SET LOCAL app.tenant_id + buscar patient (RLS-protected)
    // set_config(..., is_local=true) so vale dentro de transacao aberta (BEGIN).
    await client.query('BEGIN')
    try {
      await client.query(
        `SELECT set_config('app.tenant_id', $1, true)`,
        [td.tenant_id]
      )
      const patientRes = await client.query(
        `SELECT name as patient_name, birth_date, status as patient_status,
                school_name, diagnosis
         FROM tdah_patients
         WHERE id = $1 AND tenant_id = $2`,
        [td.patient_id, td.tenant_id]
      )
      if (patientRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return null
      }
      // Merge token + patient (mantem compatibilidade com callers existentes)
      Object.assign(td, patientRes.rows[0])

      // UPDATE last_accessed_at dentro da mesma tx (mantem SET LOCAL ativo)
      await client.query(
        'UPDATE tdah_family_tokens SET last_accessed_at = NOW() WHERE id = $1',
        [td.id]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }

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
    // Rate limit por IP
    const blocked = await rateLimit(request, PORTAL_RATE_LIMIT)
    if (blocked) return blocked

    const { token } = await params

    // Validação básica do formato do token (hex 64 chars)
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }
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

      // RLS: session_summaries ja tem RLS, e Fase A futura adiciona RLS nas 5 tabelas TDAH.
      // Wrap Promise.all + access_log + return em BEGIN/SET LOCAL/COMMIT pra setar
      // app.tenant_id antes de qualquer query que toque tabela RLS-protected.
      // return DENTRO do try pra preservar escopo das variaveis const do Promise.all.
      await client.query('BEGIN')
      try {
        await client.query(
          `SELECT set_config('app.tenant_id', $1, true)`,
          [tenantId]
        )

      // Queries paralelas — todas independentes, mesmo paciente/tenant
      const [protocols, drcSummary, upcomingSessions, recentSessions, summaries, achievements, routines, tokenEconomy] = await Promise.all([
        // Protocolos ativos (status simplificado)
        client.query(
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
        ),
        // DRC resumo (30 dias)
        client.query(
          `SELECT
            COUNT(*) as total_entries,
            COUNT(*) FILTER (WHERE goal_met = true) as goals_met,
            COUNT(*) FILTER (WHERE goal_met = false) as goals_not_met,
            ROUND(AVG(score) FILTER (WHERE score IS NOT NULL), 1) as avg_score
          FROM tdah_drc
          WHERE patient_id = $1 AND tenant_id = $2
            AND drc_date >= CURRENT_DATE - INTERVAL '30 days'`,
          [patientId, tenantId]
        ),
        // Sessões futuras (próximas 5)
        client.query(
          `SELECT id, scheduled_at, session_context, status
          FROM tdah_sessions
          WHERE patient_id = $1 AND tenant_id = $2
            AND status = 'scheduled'
            AND scheduled_at >= CURRENT_DATE
          ORDER BY scheduled_at ASC
          LIMIT 5`,
          [patientId, tenantId]
        ),
        // Sessões recentes (últimas 10 completadas)
        client.query(
          `SELECT id, scheduled_at, session_context, duration_minutes, status
          FROM tdah_sessions
          WHERE patient_id = $1 AND tenant_id = $2
            AND status = 'completed'
          ORDER BY scheduled_at DESC
          LIMIT 10`,
          [patientId, tenantId]
        ),
        // Resumos de sessão enviados (schema real em prod: content, sent_at)
        // TODO: source_module='tdah' exclui resumos ABA — revisar filtro (pendência de produto).
        client.query(
          `SELECT id, session_id, content, sent_at, created_at
          FROM session_summaries
          WHERE learner_id = $1 AND tenant_id = $2
            AND source_module = 'tdah'
            AND sent_at IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 10`,
          [patientId, tenantId]
        ),
        // Conquistas (protocolos mastered)
        client.query(
          `SELECT code, title, mastered_at
          FROM tdah_protocols
          WHERE patient_id = $1 AND tenant_id = $2
            AND status IN ('mastered', 'maintenance')
            AND mastered_at IS NOT NULL
          ORDER BY mastered_at DESC
          LIMIT 10`,
          [patientId, tenantId]
        ),
        // Rotinas ativas (Bible S18 — visibilidade familia)
        client.query(
          `SELECT id, routine_type, routine_name, steps_json, reinforcement_plan, status
          FROM tdah_routines
          WHERE patient_id = $1 AND tenant_id = $2
            AND status = 'active'
          ORDER BY routine_type, routine_name`,
          [patientId, tenantId]
        ),
        // Token economy — saldo e configuração (Bible S18, Protocolo E06)
        client.query(
          `SELECT te.id, te.system_name, te.token_type, te.token_label,
            te.target_behaviors, te.reinforcers, te.current_balance, te.status
          FROM tdah_token_economy te
          WHERE te.patient_id = $1 AND te.tenant_id = $2
            AND te.status = 'active'
          ORDER BY te.created_at DESC
          LIMIT 3`,
          [patientId, tenantId]
        ),
      ])

      // Log access (dentro da mesma tx pra herdar GUC)
      try {
        await client.query(
          `INSERT INTO tdah_family_access_log (tenant_id, token_id, patient_id, action)
           VALUES ($1, $2, $3, 'view_portal')`,
          [tenantId, tokenData.id, patientId]
        )
      } catch (_) {}

        await client.query('COMMIT')

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
        routines: routines.rows,
        token_economy: tokenEconomy.rows,
      })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
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
    // Rate limit (mais restritivo para writes)
    const blocked = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'portal-familia-consent' })
    if (blocked) return blocked

    const { token } = await params

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

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
        return NextResponse.json({ error: 'Token inválido ou consentimento ja aceito' }, { status: 400 })
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
