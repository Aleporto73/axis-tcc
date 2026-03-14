import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'

// =====================================================
// AXIS TDAH — API Pública: Professor submete DRC
// POST — Criar registro DRC via token do professor
// SEM autenticação Clerk — acesso via token único
// Bible §17: máximo 3 metas por dia
// Bible §14: Professor registra DRC
// =====================================================

async function validateToken(token: string) {
  const client = await pool.connect()
  try {
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

    // Atualizar last_used_at
    await client.query(
      'UPDATE tdah_teacher_tokens SET last_used_at = NOW() WHERE id = $1',
      [td.id]
    )

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
    const { token } = await params
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
      // Bible §17: máximo 3 metas por data por paciente
      const existingCount = await client.query(
        `SELECT COUNT(*) as cnt FROM tdah_drc
        WHERE patient_id = $1 AND tenant_id = $2 AND drc_date = $3`,
        [tokenData.patient_id, tokenData.tenant_id, drc_date]
      )
      if (parseInt(existingCount.rows[0].cnt) >= 3) {
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

      return NextResponse.json({ drc_entry: res.rows[0] }, { status: 201 })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[ESCOLA DRC POST] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
