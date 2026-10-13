import { createHmac, timingSafeEqual } from 'crypto'
import { planByEntitlement, type PlanDef, type PlanKey } from './plans'

// =====================================================
// AXIS — Contrato com o PaymentBeta (pagamento P2): a borda
//
// Fonte: paymentbeta/supabase/functions/_shared/
//   webhookSignature.ts        → assinatura
//   buildEntitlementPayload.ts → corpo (event_version 2026-06-10)
//   webhookRetryPolicy.ts      → resposta: 200 {status: accepted | duplicate |
//                                unsupported_*}; fora de 2xx o PaymentBeta tenta de novo
//
// Assinatura:  hex(hmac_sha256(segredo, `${timestamp}.${delivery_id}.${corpo_cru}`))
//              header X-PaymentBeta-Signature: sha256=<hex>
// Timestamp (segundos) fora de 5 min → recusa. Aceita o segredo atual OU o anterior
// (troca de segredo sem janela de recusa).
//
// Também monta o link do checkout (?product=&price=&partner_reference=).
// =====================================================

export const PAYMENTBETA_EVENT_VERSION = '2026-06-10'
export const SIGNATURE_WINDOW_SECONDS = 300

export const PAYMENTBETA_EVENTS = [
  'sale.confirmed',
  'subscription.pending',
  'subscription.payment_failed',
  'subscription.cancelled',
  'subscription.reactivated',
  'subscription.access_revoked',
] as const

export type PaymentBetaEvent = (typeof PAYMENTBETA_EVENTS)[number]

/** Eventos que dão acesso a quem ainda não tem (podem criar licença e comprador). */
export const GRANTING_EVENTS: ReadonlySet<PaymentBetaEvent> = new Set(['sale.confirmed', 'subscription.pending'])

export const PAYMENTBETA_HEADERS = {
  signature: 'x-paymentbeta-signature',
  timestamp: 'x-paymentbeta-timestamp',
  delivery: 'x-paymentbeta-delivery',
  event: 'x-paymentbeta-event',
  version: 'x-paymentbeta-version',
} as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HEX_SIGNATURE_RE = /^sha256=([0-9a-f]{64})$/i

// ─── Assinatura ───

export interface SignatureInput {
  rawBody: string
  timestamp: string | null
  deliveryId: string | null
  signature: string | null
  /** Segredo atual e (se houver) o anterior. Vazios são ignorados. */
  secrets: Array<string | null | undefined>
  nowSeconds: number
}

/** true = corpo autêntico e recente. Comparação em tempo constante. */
export function verifyPaymentBetaSignature(input: SignatureInput): boolean {
  const { rawBody, timestamp, deliveryId, signature, nowSeconds } = input
  if (!timestamp || !deliveryId || !signature) return false
  if (!/^\d{1,12}$/.test(timestamp)) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_WINDOW_SECONDS) return false

  const match = HEX_SIGNATURE_RE.exec(signature.trim())
  if (!match) return false
  const provided = Buffer.from(match[1].toLowerCase(), 'hex')

  let valid = false
  for (const secret of input.secrets) {
    if (!secret) continue
    const expected = createHmac('sha256', secret).update(`${timestamp}.${deliveryId}.${rawBody}`, 'utf8').digest()
    // Sem atalho: os dois segredos são sempre conferidos.
    if (timingSafeEqual(expected, provided)) valid = true
  }
  return valid
}

// ─── Corpo ───

export type RevokeKind = 'refund' | 'chargeback'

export interface PaymentBetaDelivery {
  deliveryId: string
  event: PaymentBetaEvent
  eventVersion: string
  occurredAt: string | null
  transactionId: string
  asaasPaymentId: string | null
  partnerReference: string | null
  plan: PlanDef
  subscriptionId: string | null
  expiresAt: Date
  cycleFrom: string | null
  customerEmail: string | null
  customerName: string | null
  paymentStatus: string | null
  revokeKind: RevokeKind | null
}

export type UnsupportedStatus = 'unsupported_version' | 'unsupported_event' | 'unsupported_entitlement'

export type PaymentBetaParse =
  | { kind: 'event'; delivery: PaymentBetaDelivery }
  | { kind: 'unsupported'; status: UnsupportedStatus }
  | { kind: 'invalid'; reason: string }

/**
 * Refund x chargeback pelo payment.status (o PaymentBeta só manda REFUNDED e
 * CHARGEBACK_REQUESTED). Chargeback corta de vez; o resto vale como estorno.
 */
export function classifyRevocation(paymentStatus: string | null): RevokeKind {
  return /^(AWAITING_)?CHARGEBACK/i.test(paymentStatus ?? '') ? 'chargeback' : 'refund'
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function isoDate(v: unknown): Date | null {
  const t = text(v)
  if (!t) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

const invalid = (reason: string): PaymentBetaParse => ({ kind: 'invalid', reason })

/**
 * Lê o corpo JÁ AUTENTICADO. Ordem (igual ao receptor do AbaMinds):
 *   versão/evento/entitlement desconhecidos → unsupported_* (200, nada gravado);
 *   evento nosso malformado → invalid (422: defeito do emissor, ele tenta de novo e alarma).
 */
export function parsePaymentBetaPayload(
  rawBody: string,
  signed: { deliveryId: string; event: string | null; version: string | null },
): PaymentBetaParse {
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return invalid('json')
  }
  if (!isRecord(body)) return invalid('json')

  // delivery_id está dentro da assinatura; event/version nos headers não estão.
  if (body.delivery_id !== signed.deliveryId) return invalid('delivery_id_diferente_do_header')
  if (signed.event && body.event !== signed.event) return invalid('event_diferente_do_header')
  if (signed.version && body.event_version !== signed.version) return invalid('version_diferente_do_header')

  if (body.event_version !== PAYMENTBETA_EVENT_VERSION) return { kind: 'unsupported', status: 'unsupported_version' }
  if (!(PAYMENTBETA_EVENTS as readonly unknown[]).includes(body.event)) return { kind: 'unsupported', status: 'unsupported_event' }
  const event = body.event as PaymentBetaEvent

  const entitlement = body.entitlement
  if (!isRecord(entitlement)) return invalid('entitlement')
  const code = text(entitlement.code)
  if (!code) return invalid('entitlement.code')
  const plan = planByEntitlement(code)
  if (!plan) return { kind: 'unsupported', status: 'unsupported_entitlement' }

  if (!UUID_RE.test(String(body.delivery_id))) return invalid('delivery_id')
  const transactionId = text(body.transaction_id)
  if (!transactionId) return invalid('transaction_id')

  // Planos AXIS são assinatura: vitalício daria acesso para sempre.
  if (entitlement.type !== 'subscription') return invalid('entitlement.type')
  // Assinatura sem expires_at é erro, nunca acesso perpétuo.
  const expiresAt = isoDate(entitlement.expires_at)
  if (!expiresAt) return invalid('entitlement.expires_at')

  let subscriptionId: string | null = null
  if (entitlement.subscription_id !== undefined && entitlement.subscription_id !== null) {
    subscriptionId = text(entitlement.subscription_id)
    if (!subscriptionId || subscriptionId.length > 200) return invalid('entitlement.subscription_id')
  }
  // Eventos de assinatura depois da compra se ligam pela assinatura (nunca por e-mail).
  if (!GRANTING_EVENTS.has(event) && !subscriptionId) return invalid('entitlement.subscription_id')

  let partnerReference: string | null = null
  if (body.partner_reference !== undefined && body.partner_reference !== null) {
    partnerReference = text(body.partner_reference)?.toLowerCase() ?? null
    if (!partnerReference || !UUID_RE.test(partnerReference)) return invalid('partner_reference')
  }

  const customer = isRecord(body.customer) ? body.customer : {}
  const email = text(customer.email)?.toLowerCase() ?? null
  if (email !== null && !EMAIL_RE.test(email)) return invalid('customer.email')
  if (GRANTING_EVENTS.has(event) && !email) return invalid('customer.email')

  const payment = isRecord(body.payment) ? body.payment : {}
  const paymentStatus = text(payment.status)
  if (event === 'subscription.access_revoked' && !paymentStatus) return invalid('payment.status')

  return {
    kind: 'event',
    delivery: {
      deliveryId: String(body.delivery_id).toLowerCase(),
      event,
      eventVersion: PAYMENTBETA_EVENT_VERSION,
      occurredAt: text(body.occurred_at),
      transactionId,
      asaasPaymentId: text(body.asaas_payment_id),
      partnerReference,
      plan,
      subscriptionId,
      expiresAt,
      cycleFrom: text(entitlement.cycle_from),
      customerEmail: email,
      customerName: text(customer.name),
      paymentStatus,
      revokeKind: event === 'subscription.access_revoked' ? classifyRevocation(paymentStatus) : null,
    },
  }
}

// ─── Checkout ───

export const DEFAULT_CHECKOUT_URL = 'https://payment.eng.br/checkout'

/** Variável com "PRODUTO:PRECO" do PaymentBeta para o plano. Ex.: PAYMENTBETA_CHECKOUT_ABA_100. */
export function checkoutEnvName(planKey: PlanKey): string {
  return `PAYMENTBETA_CHECKOUT_${planKey.toUpperCase()}`
}

const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Link do checkout do PaymentBeta para o plano, ou null se a configuração
 * (base + códigos do plano) não existir ou estiver malformada.
 */
export function buildCheckoutUrl(
  planKey: PlanKey,
  partnerReference: string,
  config: Record<string, string | undefined>,
): string | null {
  const codes = (config[checkoutEnvName(planKey)] ?? '').trim()
  const [product, price, ...rest] = codes.split(':').map((c) => c.trim())
  if (rest.length > 0 || !product || !price || !CODE_RE.test(product) || !CODE_RE.test(price)) return null

  let url: URL
  try {
    url = new URL((config.PAYMENTBETA_CHECKOUT_URL ?? '').trim() || DEFAULT_CHECKOUT_URL)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  url.searchParams.set('product', product)
  url.searchParams.set('price', price)
  url.searchParams.set('partner_reference', partnerReference)
  return url.toString()
}
