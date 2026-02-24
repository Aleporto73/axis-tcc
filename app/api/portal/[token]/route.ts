import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const client = await pool.connect()
  try {
    const { token } = await params
    if (!token) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

    // Valida token — tenant_id é derivado do próprio registro, sem hardcode
    const accessRes = await client.query(
      `SELECT fpa.*, gc.accepted_at as consent_accepted
       FROM family_portal_access fpa
       LEFT JOIN guardian_consents gc ON gc.learner_id = fpa.learner_id AND gc.guardian_id = fpa.guardian_id AND gc.revoked_at IS NULL
       WHERE fpa.access_token = $1 AND fpa.is_active = true
         AND (fpa.token_expires_at IS NULL OR fpa.token_expires_at > NOW())`,
      [token]
    )
    if (!accessRes.rows[0]) return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 403 })
    if (!accessRes.rows[0].consent_accepted) return NextResponse.json({ error: 'Consentimento pendente' }, { status: 403 })

    const { learner_id, tenant_id } = accessRes.rows[0]

    // Atualiza last_accessed_at
    await client.query('UPDATE family_portal_access SET last_accessed_at = NOW() WHERE access_token = $1', [token])

    // Dados do aprendiz (sem scores clínicos)
    const learner = await client.query(
      `SELECT id, full_name, date_of_birth, diagnosis, level FROM learners WHERE id = $1 AND tenant_id = $2`,
      [learner_id, tenant_id]
    )
    if (!learner.rows[0]) return NextResponse.json({ error: 'Aprendiz não encontrado' }, { status: 404 })

    // Resumos de sessão aprovados
    const summaries = await client.query(
      `SELECT ss.id, ss.content, ss.approved_at, s.scheduled_at, s.duration_minutes
       FROM session_summaries ss
       JOIN sessions_aba s ON s.id = ss.session_id
       WHERE ss.learner_id = $1 AND ss.status = 'approved'
       ORDER BY s.scheduled_at DESC LIMIT 10`,
      [learner_id]
    )

    // Protocolos (só nome e status simplificado — sem scores)
    const protocols = await client.query(
      `SELECT title, domain, status,
        CASE
          WHEN status IN ('mastered','maintained','generalization','maintenance') THEN 'conquistado'
          WHEN status = 'active' THEN 'em_progresso'
          WHEN status = 'regression' THEN 'em_revisao'
          ELSE 'outro'
        END as status_simplificado
       FROM learner_protocols
       WHERE learner_id = $1 AND tenant_id = $2 AND status != 'discontinued' AND status != 'archived'
       ORDER BY created_at DESC`,
      [learner_id, tenant_id]
    )

    // Próximas sessões
    const upcoming = await client.query(
      `SELECT scheduled_at, duration_minutes, status
       FROM sessions_aba
       WHERE learner_id = $1 AND tenant_id = $2 AND scheduled_at > NOW() AND status != 'cancelled'
       ORDER BY scheduled_at ASC LIMIT 5`,
      [learner_id, tenant_id]
    )

    // Conquistas (protocolos dominados/mantidos)
    const achievements = await client.query(
      `SELECT title, domain, updated_at
       FROM learner_protocols
       WHERE learner_id = $1 AND tenant_id = $2 AND status IN ('mastered','maintained','generalization','maintenance')
       ORDER BY updated_at DESC LIMIT 10`,
      [learner_id, tenant_id]
    )

    return NextResponse.json({
      learner: learner.rows[0],
      summaries: summaries.rows,
      protocols: protocols.rows,
      upcoming: upcoming.rows,
      achievements: achievements.rows,
    })
  } catch (err: any) {
    console.error('Portal error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  } finally {
    client.release()
  }
}
