import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'

// =====================================================
// AXIS — Webhook Hotmart (Postback v2)
//
// Recebe eventos de compra/cancelamento/reembolso da Hotmart
// e cria/atualiza registros em user_licenses.
//
// Eventos tratados:
//   PURCHASE_APPROVED        → ativa licença
//   PURCHASE_COMPLETE        → ativa licença (boleto compensado)
//   PURCHASE_CANCELED        → desativa licença
//   PURCHASE_REFUNDED        → desativa licença
//   PURCHASE_CHARGEBACK      → desativa licença
//   PURCHASE_PROTEST         → desativa licença
//   SUBSCRIPTION_CANCELLATION → desativa licença
//
// Identificação:
//   Produto → product.id mapeado para product_type ('tcc' | 'aba')
//   Usuário → buyer.email vinculado ao tenant via profiles.email
//
// Segurança:
//   Header X-Hotmart-Hottok validado contra env HOTMART_HOTTOK
//
// Idempotência:
//   transaction_id (Hotmart) salvo para evitar duplicatas
// =====================================================

// ─── Mapa de produtos Hotmart → product_type AXIS ───

const PRODUCT_MAP: Record<string, string> = {
  // TCC — Plano Profissional
  '7299808': 'tcc',

  // ABA — Clínica (todas as ofertas usam o mesmo product_id)
  '7285432': 'aba',
}

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
      // Retorna 200 pra Hotmart não ficar retentando
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

    if (tenantResult.rows.length === 0) {
      console.warn('[HOTMART WEBHOOK] Nenhum tenant encontrado para email:', buyerEmail)
      // Retorna 200 — possível compra antes do cadastro
      // TODO: implementar fila de licenças pendentes (buyer comprou mas não se cadastrou ainda)
      return NextResponse.json({ status: 'pending', reason: 'tenant_not_found', email: buyerEmail })
    }

    const { tenant_id, clerk_user_id } = tenantResult.rows[0]

    // 6. Idempotência — verificar transaction_id
    const transactionId = purchase?.transaction || subscription?.subscriber?.code || `${event}_${Date.now()}`

    const existingTx = await client.query(
      `SELECT id FROM user_licenses
       WHERE tenant_id = $1 AND hotmart_transaction = $2`,
      [tenant_id, transactionId]
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
          [validFrom, event, offerCode, planName, tenant_id, transactionId]
        )

        console.log('[HOTMART WEBHOOK] Licença reativada:', { tenant_id, productType, transactionId })
      } else {
        // Desativar licenças antigas do mesmo tipo (evita duplicatas ativas)
        await client.query(
          `UPDATE user_licenses
           SET is_active = false, updated_at = NOW()
           WHERE tenant_id = $1 AND product_type = $2 AND is_active = true`,
          [tenant_id, productType]
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
            tenant_id, clerk_user_id, productType, validFrom,
            transactionId, event, offerCode, planName, buyerEmail
          ]
        )

        console.log('[HOTMART WEBHOOK] Licença criada:', { tenant_id, productType, transactionId, buyerEmail })
      }

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
        [event, tenant_id, productType]
      )

      console.log('[HOTMART WEBHOOK] Licença desativada:', {
        tenant_id, productType, event,
        rows_affected: result.rowCount
      })

    } else {
      // Evento não tratado — ignora silenciosamente
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
        tenant_id,
        clerk_user_id || 'system',
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
    version: '1.0.0',
    products: Object.entries(PRODUCT_MAP).map(([id, type]) => ({ hotmart_id: id, axis_type: type })),
  })
}
