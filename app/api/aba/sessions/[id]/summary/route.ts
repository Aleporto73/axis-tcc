import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { canAccessLearner, handleRouteError } from '@/src/database/with-role'
import { Resend } from 'resend'
import { sessionSummaryTemplate } from '@/src/email/session-summary-template'
import { env } from '@/src/lib/env'

// =====================================================
// AXIS ABA - API: Resumo de Sessão para Responsáveis
// POST — Cria/atualiza rascunho
// PUT — Aprova ou envia email via Resend
// GET — Busca resumo existente
//
// Schema real em produção (confirmado via \d session_summaries):
//   content       TEXT        (conteúdo do resumo)
//   status        VARCHAR     ('approved' | 'sent' — valores reais em prod)
//   created_by    VARCHAR     NOT NULL, sem default — DEVE ser informado no INSERT
//   approved_by   VARCHAR     (quem aprovou)
//   approved_at   TIMESTAMPTZ
//   sent_at       TIMESTAMPTZ (não-nulo = enviado)
//   learner_id    UUID        (aprendiz)
//   source_module VARCHAR     ('aba', default)
//
// Fluxo atômico (UI dispara 3 chamadas em sequência):
//   POST        → INSERT com status='approved', approved_by, approved_at (salta rascunho)
//   PUT approve → idempotente (no-op se já approved)
//   PUT send    → UPDATE status='sent', sent_at
// =====================================================

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
const FROM = env.RESEND_FROM || 'AXIS ABA <noreply@axisclinico.com>'

// POST — Criar/atualizar resumo (rascunho)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params
    const { content } = await req.json()
    if (!content) return NextResponse.json({ error: 'content obrigatório' }, { status: 400 })

    const result = await withTenant(async (ctx) => {
      const { client, tenantId, userId } = ctx
      // Busca sessão
      const sess = await client.query(
        `SELECT s.*, l.name as learner_name
         FROM sessions_aba s
         JOIN learners l ON l.id = s.learner_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [sessionId, tenantId]
      )
      if (!sess.rows[0]) throw new Error('Não encontrado')
      const session = sess.rows[0]

      // Hardening: verificar acesso ao learner
      const canAccess = await canAccessLearner(ctx, session.learner_id)
      if (!canAccess) throw new Error('Não encontrado')

      // Upsert resumo — cria direto como approved (salta rascunho, alinhado com prod)
      const existing = await client.query(
        'SELECT id FROM session_summaries WHERE session_id = $1 AND tenant_id = $2',
        [sessionId, tenantId]
      )

      let summaryId: string
      if (existing.rows[0]) {
        // Sobrescreve conteúdo e reseta para approved (permite re-edição antes do envio)
        await client.query(
          `UPDATE session_summaries SET content = $1, status = 'approved', approved_by = $2, approved_at = NOW(), sent_at = NULL WHERE id = $3`,
          [content, userId, existing.rows[0].id]
        )
        summaryId = existing.rows[0].id
      } else {
        const ins = await client.query(
          `INSERT INTO session_summaries (id, tenant_id, session_id, learner_id, content, status, created_by, approved_by, approved_at, source_module, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'approved', $5, $5, NOW(), 'aba', NOW()) RETURNING id`,
          [tenantId, sessionId, session.learner_id, content, userId]
        )
        summaryId = ins.rows[0].id
      }

      return { summary_id: summaryId, learner_name: session.learner_name }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const { message, status } = handleRouteError(err)
    if (status < 500) return NextResponse.json({ error: message }, { status })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — Aprovar ou enviar email
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params
    const { summary_id, recipient_email, action } = await req.json()
    if (!summary_id || !action) return NextResponse.json({ error: 'summary_id e action obrigatórios' }, { status: 400 })

    const result = await withTenant(async (ctx) => {
      const { client, tenantId, userId } = ctx
      const sum = await client.query(
        `SELECT ss.id, ss.content, ss.status, ss.sent_at,
                s.scheduled_at, s.duration_minutes, s.learner_id,
                l.name as learner_name, t.name as clinic_name
         FROM session_summaries ss
         JOIN sessions_aba s ON s.id = ss.session_id
         JOIN learners l ON l.id = ss.learner_id
         JOIN tenants t ON t.id = ss.tenant_id
         WHERE ss.id = $1 AND ss.tenant_id = $2`,
        [summary_id, tenantId]
      )
      if (!sum.rows[0]) throw new Error('Não encontrado')
      const s = sum.rows[0]

      // Hardening: verificar acesso ao learner da sessão do resumo
      const canAccess = await canAccessLearner(ctx, s.learner_id)
      if (!canAccess) throw new Error('Não encontrado')

      const clinicName = s.clinic_name || 'AXIS ABA'

      if (action === 'approve') {
        // Idempotente: POST já criou como 'approved'. Se já enviado, retorna estado atual.
        if (s.status === 'approved' || s.status === 'sent') {
          return { status: s.status }
        }
        await client.query(
          `UPDATE session_summaries SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2`,
          [userId, summary_id]
        )
        return { status: 'approved' }
      }

      if (action === 'send') {
        if (!recipient_email) throw new Error('recipient_email obrigatório para envio')
        // Verificar se está aprovado (status='approved', não 'sent')
        if (s.status !== 'approved') throw new Error('Resumo precisa ser aprovado antes do envio')
        if (s.sent_at) throw new Error('Resumo já foi enviado')

        const html = sessionSummaryTemplate({
          learnerName: s.learner_name,
          sessionDate: s.scheduled_at,
          durationMinutes: s.duration_minutes,
          content: s.content, // coluna DB 'content' → param template 'content'
          clinicName,
        })

        if (!resend) throw new Error('Serviço de email não configurado (RESEND_API_KEY ausente)')
        const emailRes = await resend.emails.send({
          from: FROM,
          to: recipient_email,
          subject: `Sessão de ${s.learner_name} — ${clinicName}`,
          html,
        })

        if (emailRes.error) throw new Error(`Erro Resend: ${emailRes.error.message}`)

        await client.query(
          `UPDATE session_summaries SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [summary_id]
        )
        return { status: 'sent', email_id: emailRes.data?.id }
      }

      throw new Error('action inválida — use approve ou send')
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const { message, status } = handleRouteError(err)
    if (status < 500) return NextResponse.json({ error: message }, { status })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET — Buscar resumo da sessão
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params
    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      // Hardening: verificar acesso ao learner da sessão
      const sessCheck = await client.query(
        'SELECT learner_id FROM sessions_aba WHERE id = $1 AND tenant_id = $2',
        [sessionId, tenantId]
      )
      if (sessCheck.rows.length === 0) return { summary: null }
      const canAccess = await canAccessLearner(ctx, sessCheck.rows[0].learner_id)
      if (!canAccess) return { summary: null }

      const res = await client.query(
        `SELECT id, session_id, learner_id, content, status, approved_by, approved_at, sent_at, source_module, created_at
         FROM session_summaries WHERE session_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [sessionId, tenantId]
      )
      return { summary: res.rows[0] || null }
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const { message, status } = handleRouteError(err)
    if (status < 500) return NextResponse.json({ error: message }, { status })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
