import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'
import { rateLimit } from '@/src/middleware/rate-limit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Rate limit: 100 req/min por IP (rota pública)
  const blocked = await rateLimit(req, { limit: 100, windowMs: 60_000, prefix: 'rl:portal' })
  if (blocked) return blocked

  const client = await pool.connect()
  try {
    const { token } = await params
    if (!token) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

    // Todas as queries usam SECURITY DEFINER functions — bypass RLS sem precisar de BYPASSRLS no role
    // 1. Lookup do token
    const accessRes = await client.query('SELECT * FROM portal_token_lookup($1)', [token])
    if (!accessRes.rows[0]) return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 403 })
    if (!accessRes.rows[0].consent_accepted) return NextResponse.json({ error: 'Consentimento pendente' }, { status: 403 })

    const { learner_id, tenant_id } = accessRes.rows[0]

    // 2. Atualiza last_accessed_at
    await client.query('SELECT portal_update_last_access($1)', [token])

    // 3. Dados do aprendiz
    const learner = await client.query('SELECT * FROM portal_get_learner($1, $2)', [learner_id, tenant_id])
    if (!learner.rows[0]) return NextResponse.json({ error: 'Aprendiz não encontrado' }, { status: 404 })

    // 4-7. Resumos, protocolos, próximas sessões, conquistas
    const [summaries, protocols, upcoming, achievements] = await Promise.all([
      client.query('SELECT * FROM portal_get_summaries($1, $2)', [learner_id, tenant_id]),
      client.query('SELECT * FROM portal_get_protocols($1, $2)', [learner_id, tenant_id]),
      client.query('SELECT * FROM portal_get_upcoming($1, $2)', [learner_id, tenant_id]),
      client.query('SELECT * FROM portal_get_achievements($1, $2)', [learner_id, tenant_id]),
    ])

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
