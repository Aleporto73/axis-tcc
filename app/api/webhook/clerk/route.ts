import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import pool from '@/src/database/db'

// =====================================================
// AXIS — Clerk Webhook
//
// Eventos tratados:
//   user.created — Quando usuário aceita convite e cria conta.
//     Atualiza clerk_user_id em profiles, tenants e user_licenses
//     que estavam com 'pending_hotmart_{email}'.
//     Também ativa o profile (is_active = true).
//
// Verificação: Svix signature (CLERK_WEBHOOK_SECRET)
// =====================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar assinatura Svix
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
    if (!WEBHOOK_SECRET) {
      console.error('[CLERK WEBHOOK] CLERK_WEBHOOK_SECRET não configurado')
      return NextResponse.json({ error: 'Webhook não configurado' }, { status: 500 })
    }

    const svixId = req.headers.get('svix-id')
    const svixTimestamp = req.headers.get('svix-timestamp')
    const svixSignature = req.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('[CLERK WEBHOOK] Headers Svix ausentes')
      return NextResponse.json({ error: 'Headers inválidos' }, { status: 400 })
    }

    const body = await req.text()
    const wh = new Webhook(WEBHOOK_SECRET)
    let event: any

    try {
      event = wh.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      })
    } catch (err) {
      console.warn('[CLERK WEBHOOK] Verificação Svix falhou:', err)
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    // 2. Processar evento
    console.log('[CLERK WEBHOOK] Evento:', event.type, '| User:', event.data?.id)

    if (event.type === 'user.created') {
      const clerkUserId = event.data.id
      const email = event.data.email_addresses?.[0]?.email_address?.toLowerCase()?.trim()

      if (!email) {
        console.warn('[CLERK WEBHOOK] user.created sem email:', clerkUserId)
        return NextResponse.json({ status: 'ignored', reason: 'no_email' })
      }

      // Buscar profile pendente por email
      const pendingProfile = await pool.query(
        `SELECT p.id, p.tenant_id, p.clerk_user_id
         FROM profiles p
         WHERE LOWER(p.email) = $1 AND p.clerk_user_id LIKE 'pending_hotmart_%'
         LIMIT 1`,
        [email]
      )

      if (pendingProfile.rows.length === 0) {
        console.log('[CLERK WEBHOOK] Nenhum profile pendente para:', email)
        return NextResponse.json({ status: 'ok', action: 'no_pending_profile' })
      }

      const profile = pendingProfile.rows[0]
      const oldClerkId = profile.clerk_user_id
      const tenantId = profile.tenant_id

      console.log('[CLERK WEBHOOK] Ativando profile pendente:', {
        email, clerkUserId, oldClerkId, tenantId,
      })

      // Atualizar profiles
      await pool.query(
        `UPDATE profiles
         SET clerk_user_id = $1, is_active = true, updated_at = NOW()
         WHERE tenant_id = $2 AND clerk_user_id = $3`,
        [clerkUserId, tenantId, oldClerkId]
      )

      // Atualizar tenants
      await pool.query(
        `UPDATE tenants
         SET clerk_user_id = $1, updated_at = NOW()
         WHERE id = $2 AND clerk_user_id = $3`,
        [clerkUserId, tenantId, oldClerkId]
      )

      // Atualizar user_licenses
      await pool.query(
        `UPDATE user_licenses
         SET clerk_user_id = $1, updated_at = NOW()
         WHERE tenant_id = $2 AND clerk_user_id = $3`,
        [clerkUserId, tenantId, oldClerkId]
      )

      // Audit log
      try {
        await pool.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, 'clerk_webhook', 'PENDING_PROFILE_ACTIVATED', 'profile', $3, NOW())`,
          [tenantId, clerkUserId, JSON.stringify({
            email, old_clerk_id: oldClerkId, new_clerk_id: clerkUserId,
            source: 'clerk_user_created',
          })]
        )
      } catch (_) { /* audit non-blocking */ }

      console.log('[CLERK WEBHOOK] Profile ativado com sucesso:', { email, clerkUserId, tenantId })

      return NextResponse.json({
        status: 'activated',
        email,
        tenant_id: tenantId,
      })
    }

    // Eventos não tratados
    return NextResponse.json({ status: 'ignored', event_type: event.type })

  } catch (error) {
    console.error('[CLERK WEBHOOK] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'clerk',
    version: '1.0.0',
    events: ['user.created'],
  })
}
