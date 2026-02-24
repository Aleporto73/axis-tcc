import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { Resend } from 'resend'
import { sessionSummaryTemplate } from '@/src/email/session-summary-template'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM || 'onboarding@resend.dev'

// POST — Criar/atualizar resumo (rascunho)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params
    const { content } = await req.json()
    if (!content) return NextResponse.json({ error: 'content obrigatório' }, { status: 400 })

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Busca sessão
      const sess = await client.query(
        'SELECT s.*, l.full_name as learner_name FROM sessions_aba s JOIN learners l ON l.id = s.learner_id WHERE s.id = $1 AND s.tenant_id = $2',
        [sessionId, tenantId]
      )
      if (!sess.rows[0]) throw new Error('Sessão não encontrada')
      const session = sess.rows[0]

      // Upsert resumo
      const existing = await client.query(
        'SELECT id FROM session_summaries WHERE session_id = $1 AND tenant_id = $2',
        [sessionId, tenantId]
      )
      let summaryId: string
      if (existing.rows[0]) {
        await client.query(
          'UPDATE session_summaries SET content = $1, status = $2, updated_at = NOW() WHERE id = $3',
          [content, 'draft', existing.rows[0].id]
        )
        summaryId = existing.rows[0].id
      } else {
        const ins = await client.query(
          `INSERT INTO session_summaries (id, tenant_id, session_id, learner_id, content, status, created_by, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'draft', $5, NOW(), NOW()) RETURNING id`,
          [tenantId, sessionId, session.learner_id, content, userId]
        )
        summaryId = ins.rows[0].id
      }
      return { summary_id: summaryId, learner_name: session.learner_name }
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

// PUT — Aprovar e enviar email
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params
    const { summary_id, recipient_email, recipient_name, action } = await req.json()
    if (!summary_id || !action) return NextResponse.json({ error: 'summary_id e action obrigatórios' }, { status: 400 })

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      const sum = await client.query(
        `SELECT ss.*, s.scheduled_at, s.duration_minutes, l.full_name as learner_name
         FROM session_summaries ss
         JOIN sessions_aba s ON s.id = ss.session_id
         JOIN learners l ON l.id = ss.learner_id
         WHERE ss.id = $1 AND ss.tenant_id = $2`,
        [summary_id, tenantId]
      )
      if (!sum.rows[0]) throw new Error('Resumo não encontrado')
      const s = sum.rows[0]

      if (action === 'approve') {
        await client.query(
          'UPDATE session_summaries SET status = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $3',
          ['approved', userId, summary_id]
        )
        return { status: 'approved' }
      }

      if (action === 'send') {
        if (!recipient_email) throw new Error('recipient_email obrigatório para envio')
        if (s.status !== 'approved') throw new Error('Resumo precisa ser aprovado antes do envio')

        const html = sessionSummaryTemplate({
          learnerName: s.learner_name,
          sessionDate: s.scheduled_at,
          durationMinutes: s.duration_minutes,
          content: s.content,
        })

        const emailRes = await resend.emails.send({
          from: FROM,
          to: recipient_email,
          subject: `Resumo da sessão de ${s.learner_name} — AXIS ABA`,
          html,
        })

        if (emailRes.error) throw new Error(`Erro Resend: ${emailRes.error.message}`)

        await client.query(
          'UPDATE session_summaries SET status = $1, sent_at = NOW(), updated_at = NOW() WHERE id = $2',
          ['sent', summary_id]
        )
        return { status: 'sent', email_id: emailRes.data?.id }
      }

      throw new Error('action inválida — use approve ou send')
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

// GET — Buscar resumo da sessão
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params
    const result = await withTenant(async ({ client, tenantId }) => {
      const res = await client.query(
        'SELECT * FROM session_summaries WHERE session_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1',
        [sessionId, tenantId]
      )
      return { summary: res.rows[0] || null }
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
