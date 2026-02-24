import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { nome, clinica, email, aprendizes } = await req.json()
    if (!nome || !email) return NextResponse.json({ error: 'nome e email obrigatórios' }, { status: 400 })

    // Envia notificação interna
    await resend.emails.send({
      from: process.env.RESEND_FROM || 'onboarding@resend.dev',
      to: process.env.RESEND_FROM || 'onboarding@resend.dev',
      subject: `[AXIS] Nova solicitação — ${clinica || 'Clínica não informada'}`,
      html: `<p><strong>Nome:</strong> ${nome}</p><p><strong>Clínica:</strong> ${clinica || '—'}</p><p><strong>Email:</strong> ${email}</p><p><strong>Aprendizes:</strong> ${aprendizes || '—'}</p>`,
    })

    // Envia confirmação para o solicitante
    await resend.emails.send({
      from: process.env.RESEND_FROM || 'onboarding@resend.dev',
      to: email,
      subject: 'AXIS ABA — Solicitação recebida',
      html: `<p>Olá, ${nome}.</p><p>Recebemos sua solicitação de acesso ao padrão AXIS ABA.</p><p>Você receberá o link de acesso em breve.</p><p>— Equipe AXIS</p>`,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
