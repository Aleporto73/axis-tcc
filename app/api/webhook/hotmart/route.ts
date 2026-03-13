import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import pool from '@/src/database/db'
import { Resend } from 'resend'
import { purchaseUpgradeTemplate, purchaseNewUserTemplate } from '@/src/email/purchase-template'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_FROM_MAP: Record<string, string> = {
  tcc: process.env.RESEND_FROM_TCC || 'AXIS TCC <noreply@axisclinico.com>',
  aba: process.env.RESEND_FROM || 'AXIS ABA <noreply@axisclinico.com>',
  tdah: process.env.RESEND_FROM_TDAH || 'AXIS TDAH <noreply@axisclinico.com>',
}

const PRODUCT_LABEL: Record<string, string> = {
  tcc: 'AXIS TCC',
  aba: 'AXIS ABA',
  tdah: 'AXIS TDAH',
}

const DASHBOARD_PATH: Record<string, string> = {
  tcc: '/dashboard',
  aba: '/aba/dashboard',
  tdah: '/tdah/dashboard',
}

// =====================================================
// AXIS — Webhook Hotmart (Postback v2) + Auto-Provisioning
//
// AUTO-PROVISIONING via Clerk Invitation:
//   Quando PURCHASE_APPROVED chega e o email do buyer NÃO existe:
//
//   Caso A — buyer já tem conta Clerk (fez sign-up antes):
//     1. Encontra user no Clerk por email
//     2. Cria tenant + profile (ativo) + licença no banco
//     3. Comprador já pode acessar normalmente
//
//   Caso B — buyer NÃO tem conta Clerk (comprou direto):
//     1. Cria Invitation no Clerk → email com link "Crie sua conta"
//     2. Pre-cria tenant + profile PENDENTE + licença no banco
//        (clerk_user_id = 'pending_hotmart_{email}', is_active = false)
//     3. Comprador recebe email → clica → sign-up → cria senha
//     4. No primeiro login, /api/user/tenant detecta profile
//        pendente por email → ativa com clerk_user_id real
//
//   Público 50+: email claro, sem "esqueci senha", link direto.
//
// Eventos tratados:
//   PURCHASE_APPROVED / COMPLETE  → ativa licença (+ auto-provision)
//   PURCHASE_CANCELED/REFUNDED/CHARGEBACK/PROTEST → desativa
//   SUBSCRIPTION_CANCELLATION → desativa
// =====================================================

// ─── Mapa de produtos Hotmart → product_type AXIS ───

const PRODUCT_MAP: Record<string, string> = {
  '7299808': 'tcc',
  '7285432': 'aba',
  '7291024': 'aba',
  '7380571': 'tdah',
}

// ─── Mapa de ofertas Hotmart → plano AXIS ───

const OFFER_TO_PLAN: Record<string, { plan_tier: string; max_patients: number }> = {
  // ABA offers
  'u2t04kz5': { plan_tier: 'founders', max_patients: 100 },
  '5hz0et4m': { plan_tier: 'founders', max_patients: 100 },
  'iwqieqxc': { plan_tier: 'clinica_100', max_patients: 100 },
  'gona25or': { plan_tier: 'clinica_250', max_patients: 250 },
  // TDAH offers (product_id 7380571)
  'xqzgdn1i': { plan_tier: 'founders', max_patients: 50 },
  'cr3rh0u9': { plan_tier: 'clinica_100', max_patients: 100 },
  'hxzwuwfh': { plan_tier: 'clinica_250', max_patients: 250 },
}

const DEFAULT_PAID_PLAN = { plan_tier: 'founders', max_patients: 100 }

const ACTIVATE_EVENTS = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'])

const DEACTIVATE_EVENTS = new Set([
  'PURCHASE_CANCELED',
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_PROTEST',
  'SUBSCRIPTION_CANCELLATION',
])

// ─── Auto-Provisioning ───

async function provisionNewBuyer(
  dbClient: any,
  buyer: { email: string; name: string; first_name?: string; last_name?: string },
  productType: string,
  offerCode: string | null,
  transactionId: string,
  event: string,
  planName: string | null,
): Promise<{ tenant_id: string; clerk_user_id: string; method: 'existing_user' | 'invitation' }> {

  const email = buyer.email.toLowerCase().trim()
  const buyerName = buyer.name || `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'Profissional'
  const plan = OFFER_TO_PLAN[offerCode || ''] || DEFAULT_PAID_PLAN
  const now = new Date()

  const clerk = await clerkClient()

  // ── Caso A: buyer já tem conta no Clerk ──
  try {
    const existingUsers = await clerk.users.getUserList({
      emailAddress: [email],
    })

    if (existingUsers.data.length > 0) {
      const clerkUserId = existingUsers.data[0].id
      console.log('[HOTMART PROVISION] Clerk user já existe:', clerkUserId, email)

      // Criar tenant + profile ATIVO + licença
      const tenantId = await createTenantWithLicense(
        dbClient, email, buyerName, clerkUserId, true,
        plan, productType, transactionId, event, offerCode, planName, now,
      )

      return { tenant_id: tenantId, clerk_user_id: clerkUserId, method: 'existing_user' }
    }
  } catch (err: any) {
    console.warn('[HOTMART PROVISION] Erro ao buscar user no Clerk:', err?.message)
    // Continua para invitation
  }

  // ── Caso B: buyer NÃO tem conta → enviar Invitation ──
  const pendingClerkId = `pending_hotmart_${email}`

  try {
    // URL base do app (produção ou dev)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com'

    await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${baseUrl}${DASHBOARD_PATH[productType] || '/dashboard'}`,
      ignoreExisting: true,
      publicMetadata: {
        source: 'hotmart_purchase',
        product_type: productType,
        plan_tier: plan.plan_tier,
        transaction_id: transactionId,
      },
    })

    console.log('[HOTMART PROVISION] Invitation enviada para:', email)
  } catch (invErr: any) {
    // Se invitation falhar (ex: email já convidado), não é bloqueante
    // O profile pendente será criado de qualquer forma
    console.warn('[HOTMART PROVISION] Invitation falhou (não-bloqueante):', invErr?.message)
  }

  // Criar tenant + profile PENDENTE + licença
  // (clerk_user_id = 'pending_hotmart_{email}', is_active = false)
  // O /api/user/tenant já detecta profiles pendentes e ativa no primeiro login
  const tenantId = await createTenantWithLicense(
    dbClient, email, buyerName, pendingClerkId, false,
    plan, productType, transactionId, event, offerCode, planName, now,
  )

  return { tenant_id: tenantId, clerk_user_id: pendingClerkId, method: 'invitation' }
}

// ─── Criar tenant + profile + licença ───

async function createTenantWithLicense(
  dbClient: any,
  email: string,
  name: string,
  clerkUserId: string,
  isActive: boolean,
  plan: { plan_tier: string; max_patients: number },
  productType: string,
  transactionId: string,
  event: string,
  offerCode: string | null,
  planName: string | null,
  now: Date,
): Promise<string> {

  // 1. Tenant
  const tenantInsert = await dbClient.query(
    `INSERT INTO tenants (
      name, email, clerk_user_id, role,
      trial_start, trial_end, trial_status,
      plan_tier, max_patients, max_sessions, is_admin
    ) VALUES ($1, $2, $3, 'professional', $4, NULL, 'active', $5, $6, 9999, false)
    RETURNING id as tenant_id`,
    [name, email, clerkUserId, now, plan.plan_tier, plan.max_patients]
  )

  const tenantId = tenantInsert.rows[0].tenant_id

  // 2. Profile (admin) — ativo se user já existe, pendente se invitation
  await dbClient.query(
    `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, is_active)
     VALUES ($1, $2, 'admin', $3, $4, $5)`,
    [tenantId, clerkUserId, name, email, isActive]
  )

  // 3. Licença ativa (UPSERT — mesmo pendente, licença já vale)
  await dbClient.query(
    `INSERT INTO user_licenses (
      tenant_id, clerk_user_id, product_type, is_active,
      valid_from, valid_until,
      hotmart_transaction, hotmart_event, hotmart_offer, hotmart_plan,
      buyer_email, created_at, updated_at
    ) VALUES ($1, $2, $3, true, $4, NULL, $5, $6, $7, $8, $9, NOW(), NOW())
    ON CONFLICT ON CONSTRAINT uq_user_product
    DO UPDATE SET
      is_active = true,
      hotmart_transaction = EXCLUDED.hotmart_transaction,
      hotmart_event = EXCLUDED.hotmart_event,
      hotmart_offer = EXCLUDED.hotmart_offer,
      hotmart_plan = EXCLUDED.hotmart_plan,
      buyer_email = EXCLUDED.buyer_email,
      updated_at = NOW()`,
    [tenantId, clerkUserId, productType, now, transactionId, event, offerCode, planName, email]
  )

  // 4. Audit log
  try {
    await dbClient.query(
      `INSERT INTO axis_audit_logs (
        tenant_id, user_id, actor, action, entity_type, metadata, created_at
      ) VALUES ($1, $2, 'hotmart_webhook', 'AUTO_PROVISION', 'tenant', $3, NOW())`,
      [
        tenantId, clerkUserId,
        JSON.stringify({
          source: 'hotmart_auto_provision',
          method: isActive ? 'existing_user' : 'invitation',
          buyer_email: email, buyer_name: name,
          product_type: productType,
          plan_tier: plan.plan_tier,
          max_patients: plan.max_patients,
          offer_code: offerCode,
          transaction_id: transactionId,
        })
      ]
    )
  } catch (_) { /* audit non-blocking */ }

  console.log('[HOTMART PROVISION] Tenant criado:', {
    tenant_id: tenantId, email,
    plan_tier: plan.plan_tier,
    is_active: isActive,
    method: isActive ? 'existing_user' : 'invitation',
  })

  return tenantId
}

// ─── Handler ───

export async function POST(request: NextRequest) {
  const client = await pool.connect()

  try {
    // 1. Validar hottok
    const hottok = request.headers.get('x-hotmart-hottok')
    const expectedHottok = process.env.HOTMART_HOTTOK

    if (!expectedHottok) {
      console.error('[HOTMART WEBHOOK] HOTMART_HOTTOK não configurado no .env')
      return NextResponse.json({ error: 'Webhook não configurado' }, { status: 500 })
    }

    if (hottok !== expectedHottok) {
      console.warn('[HOTMART WEBHOOK] Hottok inválido:', hottok?.substring(0, 8) + '...')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 2. Parsear body
    const body = await request.json()

    const event = body.event
    const product = body.data?.product
    const buyer = body.data?.buyer
    const purchase = body.data?.purchase
    const subscription = body.data?.subscription

    console.log('[HOTMART WEBHOOK] Evento recebido:', event, '| Produto:', product?.id, '| Buyer:', buyer?.email)

    // 3. Validar campos obrigatórios
    if (!event || !product?.id || !buyer?.email) {
      console.warn('[HOTMART WEBHOOK] Payload incompleto:', { event, product_id: product?.id, email: buyer?.email })
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 })
    }

    // 4. Mapear product_id → product_type
    const productId = String(product.id)
    const productType = PRODUCT_MAP[productId]

    if (!productType) {
      console.warn('[HOTMART WEBHOOK] Produto não mapeado:', productId)
      return NextResponse.json({ status: 'ignored', reason: 'product_not_mapped' })
    }

    // 5. Identificar tenant pelo email do buyer
    const buyerEmail = buyer.email.toLowerCase().trim()

    const tenantResult = await client.query(
      `SELECT p.tenant_id, p.id as profile_id, t.clerk_user_id
       FROM profiles p
       JOIN tenants t ON t.id = p.tenant_id
       WHERE LOWER(p.email) = $1
       LIMIT 1`,
      [buyerEmail]
    )

    let tenantId: string
    let clerkUserId: string

    if (tenantResult.rows.length === 0) {
      // ─── AUTO-PROVISIONING ───
      if (!ACTIVATE_EVENTS.has(event)) {
        console.warn('[HOTMART WEBHOOK] Deactivate para buyer inexistente:', buyerEmail)
        return NextResponse.json({ status: 'ignored', reason: 'no_tenant_for_deactivation', email: buyerEmail })
      }

      console.log('[HOTMART WEBHOOK] Buyer não encontrado, auto-provisioning:', buyerEmail)

      const offerCode = purchase?.offer?.code || null
      const planName = product?.name || null
      const txId = purchase?.transaction || subscription?.subscriber?.code || `${event}_${Date.now()}`

      await client.query('BEGIN')

      try {
        const provision = await provisionNewBuyer(
          client,
          {
            email: buyerEmail,
            name: buyer.name || `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim(),
            first_name: buyer.first_name,
            last_name: buyer.last_name,
          },
          productType, offerCode, txId, event, planName,
        )

        await client.query('COMMIT')

        // Email pós-compra (non-blocking)
        try {
          const buyerName = buyer.name || `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'Profissional'
          const planLabel = OFFER_TO_PLAN[offerCode || '']?.plan_tier || 'Founders'
          const isNewUser = provision.method === 'invitation'
          const label = PRODUCT_LABEL[productType] || 'AXIS'
          await resend.emails.send({
            from: EMAIL_FROM_MAP[productType] || EMAIL_FROM_MAP.aba,
            to: buyerEmail,
            subject: isNewUser
              ? `Bem-vindo ao ${label}! Ative sua conta`
              : `Seu plano ${label} foi ativado!`,
            html: isNewUser
              ? purchaseNewUserTemplate({ buyerName, planName: planLabel, productType })
              : purchaseUpgradeTemplate({ buyerName, planName: planLabel, productType }),
          })
          console.log('[HOTMART WEBHOOK] Email pós-compra enviado:', buyerEmail, productType)
        } catch (emailErr) {
          console.warn('[HOTMART WEBHOOK] Email pós-compra falhou (non-blocking):', emailErr)
        }

        return NextResponse.json({
          status: 'provisioned',
          method: provision.method,
          event,
          product_type: productType,
          tenant_id: provision.tenant_id,
          email: buyerEmail,
        })
      } catch (provisionErr) {
        await client.query('ROLLBACK').catch(() => {})
        console.error('[HOTMART WEBHOOK] Auto-provision falhou:', provisionErr)
        return NextResponse.json({
          status: 'provision_failed',
          reason: provisionErr instanceof Error ? provisionErr.message : 'unknown',
          email: buyerEmail,
        }, { status: 500 })
      }
    }

    // ─── Tenant encontrado — fluxo normal ───
    tenantId = tenantResult.rows[0].tenant_id
    clerkUserId = tenantResult.rows[0].clerk_user_id

    const transactionId = purchase?.transaction || subscription?.subscriber?.code || `${event}_${Date.now()}`

    const existingTx = await client.query(
      `SELECT id FROM user_licenses WHERE tenant_id = $1 AND hotmart_transaction = $2`,
      [tenantId, transactionId]
    )

    await client.query('BEGIN')

    if (ACTIVATE_EVENTS.has(event)) {
      const offerCode = purchase?.offer?.code || null
      const planName = product?.name || null
      const validFrom = new Date()

      // UPSERT: se licença já existe (ex: FREE → pago), atualiza em vez de falhar
      await client.query(
        `INSERT INTO user_licenses (
          tenant_id, clerk_user_id, product_type, is_active,
          valid_from, valid_until,
          hotmart_transaction, hotmart_event, hotmart_offer, hotmart_plan,
          buyer_email, created_at, updated_at
        ) VALUES ($1, $2, $3, true, $4, NULL, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT ON CONSTRAINT uq_user_product
        DO UPDATE SET
          is_active = true,
          valid_from = EXCLUDED.valid_from,
          valid_until = NULL,
          hotmart_transaction = EXCLUDED.hotmart_transaction,
          hotmart_event = EXCLUDED.hotmart_event,
          hotmart_offer = EXCLUDED.hotmart_offer,
          hotmart_plan = EXCLUDED.hotmart_plan,
          buyer_email = EXCLUDED.buyer_email,
          updated_at = NOW()`,
        [tenantId, clerkUserId, productType, validFrom,
         transactionId, event, offerCode, planName, buyerEmail]
      )
      console.log('[HOTMART WEBHOOK] Licença ativada (upsert):', { tenantId, productType, transactionId })

      // Sync plan_tier
      const plan = OFFER_TO_PLAN[offerCode || ''] || DEFAULT_PAID_PLAN
      await client.query(
        `UPDATE tenants SET plan_tier = $1, max_patients = $2, trial_status = 'active', updated_at = NOW()
         WHERE id = $3`,
        [plan.plan_tier, plan.max_patients, tenantId]
      )

    } else if (DEACTIVATE_EVENTS.has(event)) {
      const result = await client.query(
        `UPDATE user_licenses
         SET is_active = false, valid_until = NOW(), hotmart_event = $1, updated_at = NOW()
         WHERE tenant_id = $2 AND product_type = $3 AND is_active = true`,
        [event, tenantId, productType]
      )

      await client.query(
        `UPDATE tenants SET plan_tier = 'free', max_patients = 1, updated_at = NOW() WHERE id = $1`,
        [tenantId]
      )

      console.log('[HOTMART WEBHOOK] Licença desativada:', { tenantId, productType, event, rows: result.rowCount })
    } else {
      await client.query('ROLLBACK')
      return NextResponse.json({ status: 'ignored', reason: 'event_not_handled', event })
    }

    // Audit log
    await client.query(
      `INSERT INTO axis_audit_logs (
        tenant_id, user_id, actor, action, entity_type, metadata, created_at
      ) VALUES ($1, $2, 'hotmart_webhook', $3, 'user_licenses', $4, NOW())`,
      [tenantId, clerkUserId || 'system', `HOTMART_${event}`,
       JSON.stringify({ event, product_id: productId, product_type: productType,
         transaction_id: transactionId, buyer_email: buyerEmail, offer: purchase?.offer?.code || null })]
    )

    await client.query('COMMIT')

    // Email pós-compra para upgrade (non-blocking)
    if (ACTIVATE_EVENTS.has(event)) {
      try {
        const buyerName = buyer.name || `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'Profissional'
        const offerCode = purchase?.offer?.code || null
        const planLabel = OFFER_TO_PLAN[offerCode || '']?.plan_tier || 'Founders'
        const label = PRODUCT_LABEL[productType] || 'AXIS'
        await resend.emails.send({
          from: EMAIL_FROM_MAP[productType] || EMAIL_FROM_MAP.aba,
          to: buyerEmail,
          subject: `Seu plano ${label} foi ativado!`,
          html: purchaseUpgradeTemplate({ buyerName, planName: planLabel, productType }),
        })
        console.log('[HOTMART WEBHOOK] Email upgrade enviado:', buyerEmail, productType)
      } catch (emailErr) {
        console.warn('[HOTMART WEBHOOK] Email upgrade falhou (non-blocking):', emailErr)
      }
    }

    return NextResponse.json({ status: 'ok', event, product_type: productType })

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[HOTMART WEBHOOK] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  } finally {
    client.release()
  }
}

// ─── Health check ───

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'hotmart',
    version: '2.1.0',
    features: ['auto_provisioning', 'clerk_invitation', 'plan_sync'],
    products: Object.entries(PRODUCT_MAP).map(([id, type]) => ({ hotmart_id: id, axis_type: type })),
    offers: Object.entries(OFFER_TO_PLAN).map(([code, plan]) => ({ offer_code: code, ...plan })),
  })
}
