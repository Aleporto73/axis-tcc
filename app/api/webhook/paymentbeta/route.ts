import { NextRequest, NextResponse } from 'next/server'
import type { PoolClient } from 'pg'
import pool from '@/src/database/db'
import { env } from '@/src/lib/env'
import { createSystemAlert } from '@/src/utils/system-alert'
import {
  PAYMENTBETA_HEADERS,
  parsePaymentBetaPayload,
  verifyPaymentBetaSignature,
} from '@/src/billing/paymentbeta-contract'
import {
  notifyPaymentBetaOutcome,
  processPaymentBetaDelivery,
  type PaymentBetaOutcome,
} from '@/src/billing/paymentbeta-license'

// =====================================================
// AXIS — Webhook PaymentBeta (pagamento P2)
//
// Server-to-server, sem Clerk (público no middleware); quem autentica é a
// assinatura HMAC. Respostas (contrato do PaymentBeta):
//   503 unavailable           sem PAYMENTBETA_WEBHOOK_SECRET (nada é lido)
//   401 unauthorized          assinatura errada ou timestamp fora de 5 min (nada gravado)
//   200 unsupported_version / unsupported_event / unsupported_entitlement (nada gravado)
//   422 invalid_payload       evento nosso malformado (defeito do emissor; ele tenta de novo)
//   200 duplicate             delivery_id já recebido (nada muda)
//   200 accepted              processado (inclusive quando a regra decide não mudar nada)
//   500 error                 erro transitório: nada fica gravado, o PaymentBeta tenta de novo
// Regras: src/billing/paymentbeta-rules.ts. Gravação: src/billing/paymentbeta-license.ts.
// =====================================================

function reply(status: number, body: Record<string, string>) {
  return NextResponse.json(body, { status })
}

// Assinatura inválida: no máximo 1 alerta por hora (robô batendo não enche a tabela).
const SIGNATURE_ALERT_WINDOW_MS = 60 * 60 * 1000
let lastSignatureAlertAt = 0

function alertInvalidSignature(): void {
  const now = Date.now()
  if (now - lastSignatureAlertAt < SIGNATURE_ALERT_WINDOW_MS) return
  lastSignatureAlertAt = now
  createSystemAlert({
    module: 'shared',
    severity: 'warning',
    source: 'webhook/paymentbeta',
    code: 'PAYMENTBETA_SIGNATURE_INVALID',
    message: 'Webhook PaymentBeta com assinatura inválida ou velha (segredo trocado? relógio?)',
  }).catch(() => {})
}

export async function POST(request: NextRequest) {
  const secret = env.PAYMENTBETA_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.error('[PAYMENTBETA WEBHOOK] PAYMENTBETA_WEBHOOK_SECRET não configurado')
    return reply(503, { status: 'unavailable' })
  }

  // Corpo CRU: é exatamente ele que foi assinado (nada de request.json()).
  const rawBody = await request.text()
  const deliveryId = request.headers.get(PAYMENTBETA_HEADERS.delivery)

  const authentic = verifyPaymentBetaSignature({
    rawBody,
    timestamp: request.headers.get(PAYMENTBETA_HEADERS.timestamp),
    deliveryId,
    signature: request.headers.get(PAYMENTBETA_HEADERS.signature),
    secrets: [secret, env.PAYMENTBETA_WEBHOOK_SECRET_PREVIOUS?.trim()],
    nowSeconds: Math.floor(Date.now() / 1000),
  })
  if (!authentic || !deliveryId) {
    console.warn('[PAYMENTBETA WEBHOOK] Assinatura inválida ou timestamp fora da janela')
    alertInvalidSignature()
    return reply(401, { status: 'unauthorized' })
  }

  const parsed = parsePaymentBetaPayload(rawBody, {
    deliveryId,
    event: request.headers.get(PAYMENTBETA_HEADERS.event),
    version: request.headers.get(PAYMENTBETA_HEADERS.version),
  }, env.PAYMENTBETA_TEST_ENTITLEMENTS)
  if (parsed.kind === 'unsupported') {
    console.log('[PAYMENTBETA WEBHOOK]', parsed.status, { delivery_id: deliveryId })
    return reply(200, { status: parsed.status })
  }
  if (parsed.kind === 'invalid') {
    console.warn('[PAYMENTBETA WEBHOOK] Payload inválido:', parsed.reason, { delivery_id: deliveryId })
    return reply(422, { status: 'invalid_payload' })
  }

  const delivery = parsed.delivery
  let outcome: PaymentBetaOutcome
  let client: PoolClient | null = null
  try {
    client = await pool.connect()
    outcome = await processPaymentBetaDelivery(client, delivery)
  } catch (error) {
    console.error('[PAYMENTBETA WEBHOOK] Erro (PaymentBeta vai tentar de novo):', error)
    createSystemAlert({
      module: 'shared',
      severity: 'critical',
      source: 'webhook/paymentbeta',
      code: 'PAYMENTBETA_WEBHOOK_ERROR',
      message: 'Webhook PaymentBeta falhou com erro 500 (o PaymentBeta tenta de novo)',
      context: {
        delivery_id: delivery.deliveryId,
        event: delivery.event,
        error: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
      },
    }).catch(() => {})
    return reply(500, { status: 'error' })
  } finally {
    client?.release()
  }

  if (outcome.duplicate) {
    console.log('[PAYMENTBETA WEBHOOK] duplicate', { delivery_id: delivery.deliveryId })
    return reply(200, { status: 'duplicate' })
  }

  console.log('[PAYMENTBETA WEBHOOK] accepted', {
    delivery_id: delivery.deliveryId,
    event: delivery.event,
    plan_key: delivery.plan.key,
    result: outcome.result,
    tenant_id: outcome.tenantId,
    via: outcome.via,
  })
  await notifyPaymentBetaOutcome(delivery, outcome)
  return reply(200, { status: 'accepted' })
}
