import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'
import { rateLimit } from '@/src/middleware/rate-limit'

// =====================================================
// AXIS TDAH — API Pública: Portal do Professor
// GET — Validar token + retornar dados do paciente (resumo)
// SEM autenticação Clerk — acesso via token único
// Bible §14: Professor vê DRC + progresso resumido apenas
// Visibility: ❌ scores clínicos, ❌ snapshots, ❌ layer AuDHD
//
// Segurança (Auditoria P1):
//   - Rate limit: 30 req/min por IP
//   - Token format validation
//   - Access log: append-only
// =====================================================

const PORTAL_RATE_LIMIT = { limit: 30, windowMs: 60_000, prefix: 'portal-escola' }

async function validateToken(token: string) {
  const client = await pool.connect()
  try {
    // RLS em tdah_patients exige app.tenant_id setado.
    // Como tenant_id vem do token, separamos em 2 etapas:
    // 1) Buscar token (tdah_teacher_tokens) - descobre tenant_id
    // 2) SET LOCAL app.tenant_id + buscar patient (tdah_patients, com RLS)
    //
    // IMPORTANTE: a Etapa 1 abaixo roda SEM app.tenant_id setado.
    // Funciona hoje porque tdah_teacher_tokens NAO tem RLS.
    // Se RLS for adicionada em tdah_teacher_tokens no futuro, este codigo precisa
    // de outro mecanismo (token e UNIQUE globalmente, entao nao ha vazamento de
    // tenant aqui - mas a query falharia com app_tenant_id() exception).

    // Etapa 1: token + tenant_id (sem RLS necessaria aqui)
    const tokenRes = await client.query(
      `SELECT id, token, tenant_id, patient_id,
              expires_at, is_active
       FROM tdah_teacher_tokens
       WHERE token = $1 AND is_active = true`,
      [token]
    )
    if (tokenRes.rows.length === 0) {
      return null
    }
    const tokenData = tokenRes.rows[0]

    // Verificar expiracao
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return null
    }

    // Guard: tenant_id obrigatorio pra setar GUC. Falha silenciosa se ausente.
    if (!tokenData.tenant_id) {
      console.error('[PORTAL ESCOLA] Token sem tenant_id:', tokenData.id)
      return null
    }

    // Etapa 2: SET LOCAL app.tenant_id + buscar patient (RLS-protected)
    // set_config(..., is_local=true) so vale dentro de transacao aberta (BEGIN).
    await client.query('BEGIN')
    try {
      await client.query(
        `SELECT set_config('app.tenant_id', $1, true)`,
        [tokenData.tenant_id]
      )
      const patientRes = await client.query(
        `SELECT name as patient_name, birth_date,
                school_name as patient_school, status as patient_status
         FROM tdah_patients
         WHERE id = $1 AND tenant_id = $2`,
        [tokenData.patient_id, tokenData.tenant_id]
      )
      if (patientRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return null
      }
      // Merge token + patient (mantem compatibilidade com callers existentes)
      Object.assign(tokenData, patientRes.rows[0])

      // UPDATE last_used_at dentro da mesma tx (mantem SET LOCAL ativo)
      await client.query(
        'UPDATE tdah_teacher_tokens SET last_used_at = NOW() WHERE id = $1',
        [tokenData.id]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }

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
    const blocked = await rateLimit(request, PORTAL_RATE_LIMIT)
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

    const client = await pool.connect()
    try {
      // RLS: tdah_drc/tdah_protocols entram na Fase B futura, e tdah_* nucleo na Fase A.
      // Wrap Promise.all + access_log + return em BEGIN/SET LOCAL/COMMIT pra setar
      // app.tenant_id antes de qualquer query que toque tabela RLS-protected.
      // return DENTRO do try pra preservar escopo das variaveis const do Promise.all.
      await client.query('BEGIN')
      try {
        await client.query(
          `SELECT set_config('app.tenant_id', $1, true)`,
          [tokenData.tenant_id]
        )

      // Queries paralelas — todas independentes
      const [protocols, drcs, drcSummary] = await Promise.all([
        // Protocolos ativos (professor vê título e status apenas)
        client.query(
          `SELECT id, code, title, status, block
          FROM tdah_protocols
          WHERE patient_id = $1 AND tenant_id = $2
            AND status NOT IN ('archived', 'discontinued')
          ORDER BY title`,
          [tokenData.patient_id, tokenData.tenant_id]
        ),
        // Últimas 30 DRC entries
        client.query(
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
        ),
        // DRC resumo (últimos 30 dias)
        client.query(
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
        ),
      ])

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

        await client.query('COMMIT')

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
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[ESCOLA PORTAL] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
