import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import pool from '@/src/database/db'

// =====================================================
// AXIS — Clerk Webhook
//
// Eventos tratados:
//   user.created:
//     A) Profile pendente encontrado (Hotmart/convite):
//        Atualiza clerk_user_id em profiles, tenants e user_licenses
//        que estavam com 'pending_hotmart_{email}'.
//        Também ativa o profile (is_active = true).
//
//     B) Nenhum profile pendente (cadastro direto):
//        Auto-provisioning FREE: cria tenant + profile + licenças
//        FREE para TCC (max_patients=1) e ABA (max_learners=1).
//        Garante que usuário já tem tudo pronto no primeiro page load.
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

      // Buscar TODOS os profiles pendentes por email (Hotmart + convites de equipe)
      const pendingProfiles = await pool.query(
        `SELECT p.id, p.tenant_id, p.clerk_user_id
         FROM profiles p
         WHERE LOWER(p.email) = $1 AND p.clerk_user_id LIKE 'pending_%'`,
        [email]
      )

      if (pendingProfiles.rows.length === 0) {
        // ─── AUTO-PROVISIONING: cadastro direto (sem compra Hotmart) ───
        // Cria tenant + profile + licenças FREE para TCC e ABA
        console.log('[CLERK WEBHOOK] Nenhum profile pendente, auto-provisioning FREE:', email)

        const userName = [event.data.first_name, event.data.last_name].filter(Boolean).join(' ') || email.split('@')[0]
        const now = new Date()

        const client = await pool.connect()
        try {
          await client.query('BEGIN')

          // 1. Tenant
          const tenantInsert = await client.query(
            `INSERT INTO tenants (name, email, clerk_user_id, role, trial_start, trial_end, trial_status, plan_tier, max_patients, max_sessions, is_admin)
             VALUES ($1, $2, $3, 'professional', $4, NULL, 'active', 'free', 1, 9999, false)
             RETURNING id as tenant_id`,
            [userName, email, clerkUserId, now]
          )
          const tenantId = tenantInsert.rows[0].tenant_id

          // 2. Profile (admin, ativo)
          const profileInsert = await client.query(
            `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, is_active)
             VALUES ($1, $2, 'admin', $3, $4, true)
             RETURNING id`,
            [tenantId, clerkUserId, userName, email]
          )

          // 3. Licenças FREE — TCC e ABA
          await client.query(
            `INSERT INTO user_licenses (tenant_id, clerk_user_id, product_type, is_active, valid_from, hotmart_event, buyer_email)
             VALUES ($1, $2, 'tcc', true, NOW(), 'CLERK_FREE_TIER', $3)`,
            [tenantId, clerkUserId, email]
          )
          await client.query(
            `INSERT INTO user_licenses (tenant_id, clerk_user_id, product_type, is_active, valid_from, hotmart_event, buyer_email)
             VALUES ($1, $2, 'aba', true, NOW(), 'CLERK_FREE_TIER', $3)`,
            [tenantId, clerkUserId, email]
          )

          // 4. Audit log
          try {
            await client.query(
              `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
               VALUES ($1, $2, 'clerk_webhook', 'FREE_TIER_PROVISIONED', 'tenant', $3, $4, NOW())`,
              [tenantId, clerkUserId, tenantId, JSON.stringify({
                email, name: userName, source: 'clerk_user_created',
                licenses: ['tcc', 'aba'], plan_tier: 'free', max_patients: 1,
              })]
            )
          } catch (_) { /* audit non-blocking */ }

          await client.query('COMMIT')

          console.log('[CLERK WEBHOOK] FREE tier provisioned:', { email, clerkUserId, tenantId })

          return NextResponse.json({
            status: 'provisioned',
            action: 'free_tier_created',
            email,
            tenant_id: tenantId,
            profile_id: profileInsert.rows[0].id,
            licenses: ['tcc', 'aba'],
          })
        } catch (provisionErr) {
          await client.query('ROLLBACK').catch(() => {})
          console.error('[CLERK WEBHOOK] Auto-provision FREE falhou:', provisionErr)
          // Não retorna 500 — fallback para /api/user/tenant criar no primeiro login
          return NextResponse.json({ status: 'ok', action: 'provision_failed_fallback', error: String(provisionErr) })
        } finally {
          client.release()
        }
      }

      const activatedTenants: string[] = []

      for (const profile of pendingProfiles.rows) {
        const oldClerkId = profile.clerk_user_id
        const tenantId = profile.tenant_id

        console.log('[CLERK WEBHOOK] Ativando profile pendente:', {
          email, clerkUserId, oldClerkId, tenantId,
        })

        // Atualizar profile
        await pool.query(
          `UPDATE profiles
           SET clerk_user_id = $1, is_active = true, updated_at = NOW()
           WHERE tenant_id = $2 AND clerk_user_id = $3`,
          [clerkUserId, tenantId, oldClerkId]
        )

        // Atualizar tenants (só se for profile de dono — Hotmart)
        if (oldClerkId.startsWith('pending_hotmart_')) {
          await pool.query(
            `UPDATE tenants
             SET clerk_user_id = $1, updated_at = NOW()
             WHERE id = $2 AND clerk_user_id = $3`,
            [clerkUserId, tenantId, oldClerkId]
          )

          await pool.query(
            `UPDATE user_licenses
             SET clerk_user_id = $1, updated_at = NOW()
             WHERE tenant_id = $2 AND clerk_user_id = $3`,
            [clerkUserId, tenantId, oldClerkId]
          )
        }

        // Audit log
        try {
          await pool.query(
            `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
             VALUES ($1, $2, 'clerk_webhook', 'PENDING_PROFILE_ACTIVATED', 'profile', $3, $4, NOW())`,
            [tenantId, clerkUserId, profile.id, JSON.stringify({
              email, old_clerk_id: oldClerkId, new_clerk_id: clerkUserId,
              source: 'clerk_user_created',
              type: oldClerkId.startsWith('pending_hotmart_') ? 'hotmart_purchase' : 'team_invite',
            })]
          )
        } catch (_) { /* audit non-blocking */ }

        activatedTenants.push(tenantId)
      }

      console.log('[CLERK WEBHOOK] Profiles ativados:', { email, clerkUserId, count: activatedTenants.length })

      return NextResponse.json({
        status: 'activated',
        email,
        activated_count: activatedTenants.length,
        tenant_ids: activatedTenants,
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
    version: '2.0.0',
    events: ['user.created'],
    features: ['pending_profile_activation', 'free_tier_auto_provisioning'],
  })
}
