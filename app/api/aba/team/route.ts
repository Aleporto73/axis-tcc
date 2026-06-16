import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdmin, handleRouteError } from '@/src/database/with-role'
import { Resend } from 'resend'
import { env } from '@/src/lib/env'

// =====================================================
// AXIS ABA - API: Gestão de Equipe (Multi-Terapeuta)
// Conforme AXIS ABA Bible v2.6.1
// Toda ação é auditável — axis_audit_logs
// =====================================================

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
const EMAIL_FROM = env.RESEND_FROM || 'AXIS ABA <noreply@axisclinico.com>'

/**
 * GET /api/aba/team
 * Lista membros da equipe do tenant.
 * Acesso: admin apenas.
 */
export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx
      requireAdmin(ctx)

      const members = await client.query(
        `SELECT
          p.id,
          p.clerk_user_id,
          p.role,
          p.name,
          p.email,
          p.crp,
          p.crp_uf,
          p.is_active,
          p.created_at,
          p.updated_at,
          COALESCE(lt.learner_count, 0)::int AS learner_count,
          COALESCE(sc.session_count, 0)::int AS session_count
        FROM profiles p
        LEFT JOIN (
          SELECT profile_id, COUNT(*) AS learner_count
          FROM learner_therapists
          WHERE tenant_id = $1
          GROUP BY profile_id
        ) lt ON lt.profile_id = p.id
        LEFT JOIN (
          SELECT therapist_id, COUNT(*) AS session_count
          FROM sessions_aba
          WHERE tenant_id = $1 AND status != 'cancelled'
          GROUP BY therapist_id
        ) sc ON sc.therapist_id = p.clerk_user_id
        WHERE p.tenant_id = $1
        ORDER BY
          CASE p.role
            WHEN 'admin' THEN 0
            WHEN 'supervisor' THEN 1
            WHEN 'terapeuta' THEN 2
          END,
          p.name`,
        [tenantId]
      )

      return members.rows
    })

    return NextResponse.json({ team: result })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * POST /api/aba/team
 * Convidar novo membro para a equipe.
 * Acesso: admin apenas.
 * Cria profile pendente (is_active = false até primeiro login do convidado).
 * Envia e-mail de convite via Resend (non-blocking: falha de e-mail não derruba o 201).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, role, crp, crp_uf } = body

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, email, role' },
        { status: 400 }
      )
    }

    const validRoles = ['supervisor', 'terapeuta']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Role inválida. Permitidas: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    let emailSent = false

    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)

      // Verificar se email já existe no tenant
      const existing = await ctx.client.query(
        'SELECT id FROM profiles WHERE email = $1 AND tenant_id = $2',
        [email, ctx.tenantId]
      )
      if (existing.rows.length > 0) {
        throw new Error('DUPLICATE_EMAIL')
      }

      // Criar profile pendente (sem clerk_user_id até o primeiro login)
      // clerk_user_id será preenchido quando o convidado fizer sign-up/login
      const tempClerkId = `pending_${Date.now()}_${randomBytes(4).toString('hex')}`

      // invited_by: usar profile real, ou NULL se fallback (tenantId como profileId)
      const invitedBy = ctx.profileId !== ctx.tenantId ? ctx.profileId : null

      const insert = await ctx.client.query(
        `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, crp, crp_uf, is_active, invited_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
         RETURNING id, name, email, role, is_active, created_at`,
        [ctx.tenantId, tempClerkId, role, name, email, crp || null, crp_uf || null, invitedBy]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'PROFILE_CREATED', 'profile', $4, $5, NOW())`,
        [
          ctx.tenantId,
          ctx.userId,
          ctx.userId,
          insert.rows[0].id,
          JSON.stringify({ role, email, invited_by: ctx.profileId })
        ]
      )

      // Buscar nome da clínica para o e-mail
      const tenantRow = await ctx.client.query(
        'SELECT name FROM tenants WHERE id = $1',
        [ctx.tenantId]
      )
      const clinicName = tenantRow.rows[0]?.name || 'sua clínica'

      // Enviar e-mail de convite (non-blocking)
      const appUrl = env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com'
      const signupUrl = `${appUrl}/sign-up?invite_email=${encodeURIComponent(email)}&produto=aba`

      try {
        if (!resend) throw new Error('RESEND_API_KEY ausente — e-mail de convite não enviado')

        await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject: `Você foi convidado(a) para a equipe — ${clinicName}`,
          html: buildInviteEmailHtml({
            memberName: name,
            memberEmail: email,
            roleName: role === 'supervisor' ? 'Supervisor Clínico' : 'Terapeuta',
            clinicName,
            signupUrl,
          }),
        })
        emailSent = true
        console.log('[ABA TEAM] E-mail de convite enviado:', email)
      } catch (emailErr) {
        // Non-blocking: o INSERT já valeu, o profile pendente existe.
        // Admin pode copiar o link manualmente via botão na UI.
        console.warn('[ABA TEAM] E-mail de convite falhou (non-blocking):', emailErr)
      }

      return insert.rows[0]
    })

    return NextResponse.json({ member: result, email_sent: emailSent }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_EMAIL') {
      return NextResponse.json(
        { error: 'Este email já está cadastrado nesta clínica' },
        { status: 409 }
      )
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// =====================================================
// Template HTML do e-mail de convite
// =====================================================
function buildInviteEmailHtml(params: {
  memberName: string
  memberEmail: string
  roleName: string
  clinicName: string
  signupUrl: string
}): string {
  const { memberName, memberEmail, roleName, clinicName, signupUrl } = params
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
  <div style="background:#10b981;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">AXIS ABA</h1>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6">
      Olá <strong>${memberName}</strong>,
    </p>
    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6">
      Você foi convidado(a) para fazer parte da equipe de <strong>${clinicName}</strong>
      como <strong>${roleName}</strong> no AXIS ABA.
    </p>
    <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.6">
      Para ativar seu acesso, crie sua conta clicando no botão abaixo:
    </p>
    <div style="text-align:center;margin:0 0 24px">
      <a href="${signupUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">
        Criar minha conta
      </a>
    </div>
    <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.5">
      Use o mesmo e-mail (<strong>${memberEmail}</strong>) ao criar a conta para que seu acesso seja ativado automaticamente.
    </p>
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5">
      Se você não esperava este convite, pode ignorar este e-mail.
    </p>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;color:#94a3b8;font-size:11px">AXIS Clínico · axisclinico.com</p>
  </div>
</div>
</body>
</html>`
}
