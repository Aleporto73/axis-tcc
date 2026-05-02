import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'
import { rateLimit } from '@/src/middleware/rate-limit'

// =====================================================
// AXIS TDAH — API Pública: Professor submete DRC
// POST — Criar registro DRC via token do professor
// SEM autenticação Clerk — acesso via token único
// Bible §17: máximo 3 metas por dia
// Bible §14: Professor registra DRC
//
// Segurança (Auditoria P1):
//   - Rate limit: 15 req/min (write endpoint)
//   - Token format validation
// =====================================================

async function validateToken(token: string) {
  const client = await pool.connect()
  try {
    // Etapa 1: descobrir tenant_id a partir do token (sem RLS necessaria).
    // Funciona hoje porque tdah_teacher_tokens NAO tem RLS. Quando Fase B
    // ativar RLS nessa tabela, esta Etapa 1 vai falhar com app_tenant_id()
    // exception - mas como token e UNIQUE globalmente, nao ha vazamento de
    // tenant aqui (ver mesma nota em escola/[token]/route.ts).
    const res = await client.query(
      `SELECT t.id, t.tenant_id, t.patient_id, t.teacher_name, t.school_name, t.expires_at
      FROM tdah_teacher_tokens t
      WHERE t.token = $1 AND t.is_active = true`,
      [token]
    )

    if (res.rows.length === 0) return null
    const td = res.rows[0]

    // Verificar expiração
    if (td.expires_at && new Date(td.expires_at) < new Date()) return null

    // Guard: tenant_id obrigatorio pra setar GUC. Falha silenciosa se ausente.
    if (!td.tenant_id) {
      console.error('[ESCOLA DRC] Token sem tenant_id:', td.id)
      return null
    }

    // Etapa 2: SET LOCAL app.tenant_id + UPDATE last_used_at (RLS-protected
    // quando Fase B ativar tdah_teacher_tokens). set_config(..., is_local=true)
    // so vale dentro de transacao aberta (BEGIN).
    await client.query('BEGIN')
    try {
      await client.query(
        `SELECT set_config('app.tenant_id', $1, true)`,
        [td.tenant_id]
      )
      await client.query(
        'UPDATE tdah_teacher_tokens SET last_used_at = NOW() WHERE id = $1',
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const blocked = await rateLimit(request, { limit: 15, windowMs: 60_000, prefix: 'portal-escola-drc' })
    if (blocked) return blocked

    const { token } = await params

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

    const body = await request.json()
    const { drc_date, goal_description, goal_met, score, protocol_id, teacher_notes } = body

    if (!drc_date || !goal_description) {
      return NextResponse.json(
        { error: 'drc_date e goal_description são obrigatórios' },
        { status: 400 }
      )
    }

    if (score !== undefined && score !== null && (score < 0 || score > 100)) {
      return NextResponse.json(
        { error: 'score deve ser entre 0 e 100' },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    try {
      // RLS: tdah_drc/tdah_protocols/tdah_teacher_access_log entram na Fase B.
      // Wrap COUNT + verify protocolo + INSERT drc + INSERT access_log em
      // BEGIN/SET LOCAL/COMMIT pra setar app.tenant_id antes de qualquer
      // query que toque tabela RLS-protected. Early returns (422/404) fazem
      // ROLLBACK explicito antes de retornar.
      await client.query('BEGIN')
      try {
        await client.query(
          `SELECT set_config('app.tenant_id', $1, true)`,
          [tokenData.tenant_id]
        )

        // Bible §17: máximo 3 metas por data por paciente
        const existingCount = await client.query(
          `SELECT COUNT(*) as cnt FROM tdah_drc
          WHERE patient_id = $1 AND tenant_id = $2 AND drc_date = $3`,
          [tokenData.patient_id, tokenData.tenant_id, drc_date]
        )
        if (parseInt(existingCount.rows[0].cnt) >= 3) {
          await client.query('ROLLBACK')
          return NextResponse.json(
            { error: 'Bible §17: máximo 3 metas por DRC por dia. Limite atingido.' },
            { status: 422 }
          )
        }

        // Se protocol_id, verificar pertence ao paciente
        if (protocol_id) {
          const proto = await client.query(
            `SELECT id FROM tdah_protocols WHERE id = $1 AND patient_id = $2 AND tenant_id = $3`,
            [protocol_id, tokenData.patient_id, tokenData.tenant_id]
          )
          if (proto.rows.length === 0) {
            await client.query('ROLLBACK')
            return NextResponse.json(
              { error: 'Protocolo não encontrado para este paciente' },
              { status: 404 }
            )
          }
        }

        const res = await client.query(
          `INSERT INTO tdah_drc
            (tenant_id, patient_id, drc_date, protocol_id, goal_description, goal_met, score, filled_by, filled_by_name, teacher_notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'teacher', $8, $9)
          RETURNING *`,
          [
            tokenData.tenant_id,
            tokenData.patient_id,
            drc_date,
            protocol_id || null,
            goal_description,
            goal_met ?? null,
            score ?? null,
            tokenData.teacher_name,
            teacher_notes || null,
          ]
        )

        // Log access
        try {
          await client.query(
            `INSERT INTO tdah_teacher_access_log (tenant_id, token_id, patient_id, action, metadata)
             VALUES ($1, $2, $3, 'submit_drc', jsonb_build_object('drc_id', $4::text))`,
            [tokenData.tenant_id, tokenData.id, tokenData.patient_id, res.rows[0].id]
          )
        } catch (_) { /* non-blocking */ }

        await client.query('COMMIT')

        return NextResponse.json({ drc_entry: res.rows[0] }, { status: 201 })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[ESCOLA DRC POST] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
