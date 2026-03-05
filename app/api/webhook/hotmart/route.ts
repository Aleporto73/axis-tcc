import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

// =====================================================
// AXIS — Webhook Hotmart (Postback v2) + Auto-Provisioning
//
// Recebe eventos de compra/cancelamento/reembolso da Hotmart
// e cria/atualiza registros em user_licenses.
//
// AUTO-PROVISIONING (novo):
//   Quando PURCHASE_APPROVED chega e o email do buyer NÃO existe
//   no banco, o webhook:
//   1. Cria usuário no Clerk (sem senha — comprador define depois)
//   2. Cria tenant + profile + licença no banco
//   3. Clerk envia email automático com link para definir senha
//   Resultado: comprador acessa o sistema sem precisar ter feito
//   cadastro prévio pelo /sign-up.
//
// Eventos tratados:
//   PURCHASE_APPROVED        → ativa licença (+ auto-provisioning)
//   PURCHASE_COMPLETE        → ativa licença (+ auto-provisioning)
//   PURCHASE_CANCELED        → desativa licença
//   PURCHASE_REFUNDED        → desativa licença
//   PURCHASE_CHARGEBACK      → desativa licença
//   PURCHASE_PROTEST         → desativa licença
//   SUBSCRIPTION_CANCELLATION → desativa licença
//
// Segurança:
//   Header X-Hotmart-Hottok validado contra env HOTMART_HOTTOK
// =====================================================

// ─── Mapa de produtos Hotmart → product_type AXIS ───

const PRODUCT_MAP: Record<string, string> = {
  '7299808': 'tcc',
  '7285432': 'aba',
  '7291024': 'aba',
}

// ─── Mapa de ofertas Hotmart → plano AXIS ───

const OFFER_TO_PLAN: Record<string, { plan_tier: string; max_patients: number }> = {
  'u2t04kz5': { plan_tier: 'founders', max_patients: 100 },
  'iwqieqxc': { plan_tier: 'clinica_100', max_patients: 100 },
  'gona25or': { plan_tier: 'clinica_250', max_patients: 250 },
}

const DEFAULT_PAID_PLAN = { plan_tier: 'founders', max_patients: 100 }

// ─── Eventos que ATIVAM licença ───

const ACTIVATE_EVENTS = new Set([
  'PURCHASE_APPROVED',
  'PURCHASE_COMPLETE',
])

// ─── Eventos que DESATIVAM licença ───

const DEACTIVATE_EVENTS = new Set([
  'PURCHASE_CANCELED',
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_PROTEST',
  'SUBSCRIPTION_CANCELLATION',
])

// ─── Auto-Provisioning: criar Clerk user + tenant + profile + licença ───

async function provisionNewBuyer(
  dbClient: any,
  buyer: { email: string; name: string; first_name?: string; last_name?: string },
  productType: string,
  offerCode: string | null,
  transactionId: string,
  event: string,
  planName: string | null,
): Promise<{ tenant_id: string; clerk_user_id: string }> {

  const email = buyer.email.toLowerCase().trim()
  const firstName = buyer.first_name || buyer.name?.split(' ')[0] || 'Profissional'
  const lastName = buyer.last_name || buyer.name?.split(' ').slice(1).join(' ') || ''

  // 1. Criar usuário no Clerk (sem senha — comprador define depois via email)
  let clerkUserId: string

  const clerk = await clerkClient()

  try {
    // Verificar se já existe no Clerk (pode ter conta de outro produto)
    const existingUsers = await clerk.users.getUserList({
      emailAddress: [email],
    })

    if (existingUsers.data.length > 0) {
      // Usuário já existe no Clerk mas não tem tenant no banco
      clerkUserId = existingUsers.data[0].id
      console.log('[HOTMART AUTO-PROVISION] Clerk user já existe:', clerkUserId)
    } else {
      // Criar novo usuário no Clerk
      const newUser = await clerk.users.createUser({
        emailAddress: [email],
        firstName,
        lastName,
        skipPasswordRequirement: true,
      })
      clerkUserId = newUser.id
      console.log('[HOTMART AUTO-PROVISION] Clerk user criado:', clerkUserId, email)
    }
  } catch (clerkErr: any) {
    console.error('[HOTMART AUTO-PROVISION] Erro ao criar Clerk user:', clerkErr?.message || clerkErr)
    throw new Error(`Clerk createUser failed: ${clerkErr?.message || 'unknown'}`)
  }

  // 2. Criar tenant no banco
  const plan = OFFER_TO_PLAN[offerCode || ''] || DEFAULT_PAID_PLAN
  const now = new Date()

  const tenantInsert = await dbClient.query(
    `INSERT INTO tenants (
      name, email, clerk_user_id, role,
      trial_start, trial_end, trial_status,
      plan_tier, max_patients, max_sessions, is_admin
    ) VALUES ($1, $2, $3, 'professional', $4, $5, 'active', $6, $7, 9999, false)
    RETURNING id as tenant_id`,
    [
      buyer.name || firstName,
      email,
      clerkUserId,
      now,
      null, // sem trial — comprou direto
      plan.plan_tier,
      plan.max_patients,
    ]
  )

  const tenantId = tenantInsert.rows[0].tenant_id

  // 3. Criar profile (admin do tenant)
  await dbClient.query(
    `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, is_active)
     VALUES ($1, $2, 'admin', $3, $4, true)`,
    [tenantId, clerkUserId, buyer.name || firstName, email]
  )

  // 4. Criar licença ativa
  await dbClient.query(
    `INSERT INTO user_licenses (
      tenant_id, clerk_user_id, product_type, is_active,
      valid_from, valid_until,
      hotmart_transaction, hotmart_event, hotmart_offer, hotmart_plan,
      buyer_email, created_at, updated_at
    ) VALUES ($1, $2, $3, true, $4, NULL, $5, $6, $7, $8, $9, NOW(), NOW())`,
    [
      tenantId, clerkUserId, productType, now,
      transactionId, event, offerCode, planName, email,
    ]
  )

  // 5. Audit log
  try {
    await dbClient.query(
      `INSERT INTO axis_audit_logs (
        tenant_id, user_id, actor, action, entity_type, metadata, created_at
      ) VALUES ($1, $2, 'hotmart_webhook', 'AUTO_PROVISION', 'tenant', $3, NOW())`,
      [
        tenantId,
        clerkUserId,
        JSON.stringify({
          source: 'hotmart_auto_provision',
          buyer_email: email,
          buyer_name: buyer.name,
          product_type: productType,
          plan_tier: plan.plan_tier,
          max_patients: plan.max_patients,
          offer_code: offerCode,
          transaction_id: transactionId,
        })
      ]
    )
  } catch (_) { /* audit non-blocking */ }

  console.log('[HOTMART AUTO-PROVISION] Completo:', {
    tenant_id: tenantId,
    clerk_user_id: clerkUserId,
    email,
    plan_tier: plan.plan_tier,
    max_patients: plan.max_patients,
  })

  return { tenant_id: tenantId, clerk_user_id: clerkUserId }
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

    let tenantResult = await client.query(
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
      // Comprador não tem conta. Se é evento de ativação, criar tudo.
      // Se é desativação, ignorar (não faz sentido desativar quem não existe).

      if (!ACTIVATE_EVENTS.has(event)) {
        console.warn('[HOTMART WEBHOOK] Deactivate event para buyer inexistente:', buyerEmail)
        return NextResponse.json({ status: 'ignored', reason: 'no_tenant_for_deactivation', email: buyerEmail })
      }

      console.log('[HOTMART WEBHOOK] Buyer não encontrado, iniciando auto-provisioning:', buyerEmail)

      const offerCode = purchase?.offer?.code || null
      const planName = product?.name || null
      const transactionId = purchase?.transaction || subscription?.subscriber?.code || `${event}_${Date.now()}`

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
          productType,
          offerCode,
          transactionId,
          event,
          planName,
        )

        await client.query('COMMIT')

        return NextResponse.json({
          status: 'provisioned',
          event,
          product_type: productType,
          tenant_id: provision.tenant_id,
          clerk_user_id: provision.clerk_user_id,
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

    // Tenant encontrado — fluxo normal
    tenantId = tenantResult.rows[0].tenant_id
    clerkUserId = tenantResult.rows[0].clerk_user_id

    // 6. Idempotência — verificar transaction_id
    const transactionId = purchase?.transaction || subscription?.subscriber?.code || `${event}_${Date.now()}`

    const existingTx = await client.query(
      `SELECT id FROM user_licenses
       WHERE tenant_id = $1 AND hotmart_transaction = $2`,
      [tenantId, transactionId]
    )

    // 7. Processar evento
    await client.query('BEGIN')

    if (ACTIVATE_EVENTS.has(event)) {
      // ─── ATIVAR LICENÇA ───

      const offerCode = purchase?.offer?.code || null
      const planName = product?.name || null
      const validFrom = new Date()

      if (existingTx.rows.length > 0) {
        // Reativar licença existente (idempotente)
        await client.query(
          `UPDATE user_licenses
           SET is_active = true,
               valid_from = $1,
               valid_until = NULL,
               hotmart_event = $2,
               hotmart_offer = $3,
               hotmart_plan = $4,
               updated_at = NOW()
           WHERE tenant_id = $5 AND hotmart_transaction = $6`,
          [validFrom, event, offerCode, planName, tenantId, transactionId]
        )

        console.log('[HOTMART WEBHOOK] Licença reativada:', { tenantId, productType, transactionId })
      } else {
        // Desativar licenças antigas do mesmo tipo (evita duplicatas ativas)
        await client.query(
          `UPDATE user_licenses
           SET is_active = false, updated_at = NOW()
           WHERE tenant_id = $1 AND product_type = $2 AND is_active = true`,
          [tenantId, productType]
        )

        // Criar nova licença
        await client.query(
          `INSERT INTO user_licenses (
            tenant_id, clerk_user_id, product_type, is_active,
            valid_from, valid_until,
            hotmart_transaction, hotmart_event, hotmart_offer, hotmart_plan,
            buyer_email, created_at, updated_at
          ) VALUES ($1, $2, $3, true, $4, NULL, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [
            tenantId, clerkUserId, productType, validFrom,
            transactionId, event, offerCode, planName, buyerEmail
          ]
        )

        console.log('[HOTMART WEBHOOK] Licença criada:', { tenantId, productType, transactionId, buyerEmail })
      }

      // Atualizar plan_tier do tenant se é upgrade
      const plan = OFFER_TO_PLAN[offerCode || ''] || DEFAULT_PAID_PLAN
      await client.query(
        `UPDATE tenants
         SET plan_tier = $1, max_patients = $2, trial_status = 'active', updated_at = NOW()
         WHERE id = $3`,
        [plan.plan_tier, plan.max_patients, tenantId]
      )

    } else if (DEACTIVATE_EVENTS.has(event)) {
      // ─── DESATIVAR LICENÇA ───

      const result = await client.query(
        `UPDATE user_licenses
         SET is_active = false,
             valid_until = NOW(),
             hotmart_event = $1,
             updated_at = NOW()
         WHERE tenant_id = $2
           AND product_type = $3
           AND is_active = true`,
        [event, tenantId, productType]
      )

      // Rebaixar para free
      await client.query(
        `UPDATE tenants
         SET plan_tier = 'free', max_patients = 1, updated_at = NOW()
         WHERE id = $1`,
        [tenantId]
      )

      console.log('[HOTMART WEBHOOK] Licença desativada:', {
        tenantId, productType, event,
        rows_affected: result.rowCount
      })

    } else {
      // Evento não tratado
      console.log('[HOTMART WEBHOOK] Evento ignorado:', event)
      await client.query('ROLLBACK')
      return NextResponse.json({ status: 'ignored', reason: 'event_not_handled', event })
    }

    // 8. Audit log
    await client.query(
      `INSERT INTO axis_audit_logs (
        tenant_id, user_id, actor, action, entity_type, metadata, created_at
      ) VALUES ($1, $2, 'hotmart_webhook', $3, 'user_licenses', $4, NOW())`,
      [
        tenantId,
        clerkUserId || 'system',
        `HOTMART_${event}`,
        JSON.stringify({
          event,
          product_id: productId,
          product_type: productType,
          transaction_id: transactionId,
          buyer_email: buyerEmail,
          offer: purchase?.offer?.code || null,
        })
      ]
    )

    await client.query('COMMIT')

    return NextResponse.json({ status: 'ok', event, product_type: productType })

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[HOTMART WEBHOOK] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  } finally {
    client.release()
  }
}

// ─── Health check (GET) ───

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'hotmart',
    version: '2.0.0',
    features: ['auto_provisioning', 'plan_sync'],
    products: Object.entries(PRODUCT_MAP).map(([id, type]) => ({ hotmart_id: id, axis_type: type })),
    offers: Object.entries(OFFER_TO_PLAN).map(([code, plan]) => ({ offer_code: code, ...plan })),
  })
}
