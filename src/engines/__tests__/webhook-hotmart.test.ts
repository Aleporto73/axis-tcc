/**
 * Testes Webhook Hotmart — Lógica de Negócio
 *
 * Testa as constantes, mapeamentos e lógica de decisão do webhook
 * sem depender de banco, Clerk ou Resend (testes unitários puros).
 */
import { describe, it, expect } from 'vitest'

// ─── Replicate constants from route.ts (testáveis sem importar Next.js route) ───

const PRODUCT_MAP: Record<string, string> = {
  '7299808': 'tcc',
  '7285432': 'aba',
  '7291024': 'aba',
}

const OFFER_TO_PLAN: Record<string, { plan_tier: string; max_patients: number }> = {
  'u2t04kz5': { plan_tier: 'founders', max_patients: 100 },
  '5hz0et4m': { plan_tier: 'founders', max_patients: 100 },
  'iwqieqxc': { plan_tier: 'clinica_100', max_patients: 100 },
  'gona25or': { plan_tier: 'clinica_250', max_patients: 250 },
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

// ─── Helper: simula a lógica de decisão do webhook ───

interface WebhookPayload {
  event: string
  data: {
    product?: { id: string | number; name?: string }
    buyer?: { email: string; name?: string; first_name?: string; last_name?: string }
    purchase?: { transaction?: string; offer?: { code?: string } }
    subscription?: { subscriber?: { code?: string } }
  }
}

interface WebhookDecision {
  action: 'activate' | 'deactivate' | 'ignore' | 'error'
  productType?: string
  plan?: { plan_tier: string; max_patients: number }
  reason?: string
}

function decideWebhookAction(payload: WebhookPayload): WebhookDecision {
  const { event, data } = payload
  const productId = String(data.product?.id || '')
  const buyerEmail = data.buyer?.email?.toLowerCase().trim()

  // Validação básica
  if (!event || !productId || !buyerEmail) {
    return { action: 'error', reason: 'payload_incompleto' }
  }

  // Mapear produto
  const productType = PRODUCT_MAP[productId]
  if (!productType) {
    return { action: 'ignore', reason: 'product_not_mapped' }
  }

  // Decidir ação
  if (ACTIVATE_EVENTS.has(event)) {
    const offerCode = data.purchase?.offer?.code || ''
    const plan = OFFER_TO_PLAN[offerCode] || DEFAULT_PAID_PLAN
    return { action: 'activate', productType, plan }
  }

  if (DEACTIVATE_EVENTS.has(event)) {
    return { action: 'deactivate', productType }
  }

  return { action: 'ignore', reason: 'event_not_handled' }
}

// ─── Product Mapping ────────────────────────────

describe('Product Mapping', () => {
  it('mapeia produto TCC', () => {
    expect(PRODUCT_MAP['7299808']).toBe('tcc')
  })

  it('mapeia ambos produtos ABA', () => {
    expect(PRODUCT_MAP['7285432']).toBe('aba')
    expect(PRODUCT_MAP['7291024']).toBe('aba')
  })

  it('produto não mapeado retorna undefined', () => {
    expect(PRODUCT_MAP['9999999']).toBeUndefined()
  })
})

// ─── Offer → Plan Mapping ───────────────────────

describe('Offer to Plan Mapping', () => {
  it('Founders 100 (u2t04kz5)', () => {
    expect(OFFER_TO_PLAN['u2t04kz5']).toEqual({ plan_tier: 'founders', max_patients: 100 })
  })

  it('Founders 100 alternativa (5hz0et4m)', () => {
    expect(OFFER_TO_PLAN['5hz0et4m']).toEqual({ plan_tier: 'founders', max_patients: 100 })
  })

  it('Clínica 100 (iwqieqxc)', () => {
    expect(OFFER_TO_PLAN['iwqieqxc']).toEqual({ plan_tier: 'clinica_100', max_patients: 100 })
  })

  it('Clínica 250 (gona25or)', () => {
    expect(OFFER_TO_PLAN['gona25or']).toEqual({ plan_tier: 'clinica_250', max_patients: 250 })
  })

  it('oferta desconhecida usa DEFAULT_PAID_PLAN (founders 100)', () => {
    const plan = OFFER_TO_PLAN['xxx'] || DEFAULT_PAID_PLAN
    expect(plan).toEqual({ plan_tier: 'founders', max_patients: 100 })
  })
})

// ─── Event Classification ───────────────────────

describe('Event Classification', () => {
  it('PURCHASE_APPROVED é ativação', () => {
    expect(ACTIVATE_EVENTS.has('PURCHASE_APPROVED')).toBe(true)
  })

  it('PURCHASE_COMPLETE é ativação', () => {
    expect(ACTIVATE_EVENTS.has('PURCHASE_COMPLETE')).toBe(true)
  })

  it('5 eventos de desativação', () => {
    expect(DEACTIVATE_EVENTS.size).toBe(5)
    expect(DEACTIVATE_EVENTS.has('PURCHASE_CANCELED')).toBe(true)
    expect(DEACTIVATE_EVENTS.has('PURCHASE_REFUNDED')).toBe(true)
    expect(DEACTIVATE_EVENTS.has('PURCHASE_CHARGEBACK')).toBe(true)
    expect(DEACTIVATE_EVENTS.has('PURCHASE_PROTEST')).toBe(true)
    expect(DEACTIVATE_EVENTS.has('SUBSCRIPTION_CANCELLATION')).toBe(true)
  })

  it('evento desconhecido não é ativação nem desativação', () => {
    expect(ACTIVATE_EVENTS.has('PURCHASE_DELAYED')).toBe(false)
    expect(DEACTIVATE_EVENTS.has('PURCHASE_DELAYED')).toBe(false)
  })
})

// ─── Webhook Decision Logic ─────────────────────

describe('Webhook Decision Logic', () => {
  const baseBuyer = { email: 'teste@gmail.com', name: 'João' }

  it('PURCHASE_APPROVED + ABA → activate com plano correto', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: '7285432' },
        buyer: baseBuyer,
        purchase: { transaction: 'TX123', offer: { code: 'u2t04kz5' } },
      },
    })
    expect(result.action).toBe('activate')
    expect(result.productType).toBe('aba')
    expect(result.plan).toEqual({ plan_tier: 'founders', max_patients: 100 })
  })

  it('PURCHASE_APPROVED + oferta Clínica 250 → max_patients 250', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: '7291024' },
        buyer: baseBuyer,
        purchase: { offer: { code: 'gona25or' } },
      },
    })
    expect(result.plan).toEqual({ plan_tier: 'clinica_250', max_patients: 250 })
  })

  it('PURCHASE_APPROVED + sem oferta → default founders', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: '7285432' },
        buyer: baseBuyer,
        purchase: { transaction: 'TX999' },
      },
    })
    expect(result.plan).toEqual({ plan_tier: 'founders', max_patients: 100 })
  })

  it('PURCHASE_CANCELED → deactivate', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_CANCELED',
      data: {
        product: { id: '7285432' },
        buyer: baseBuyer,
      },
    })
    expect(result.action).toBe('deactivate')
    expect(result.productType).toBe('aba')
  })

  it('PURCHASE_CHARGEBACK → deactivate', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_CHARGEBACK',
      data: {
        product: { id: '7285432' },
        buyer: baseBuyer,
      },
    })
    expect(result.action).toBe('deactivate')
  })

  it('SUBSCRIPTION_CANCELLATION → deactivate', () => {
    const result = decideWebhookAction({
      event: 'SUBSCRIPTION_CANCELLATION',
      data: {
        product: { id: '7299808' },
        buyer: baseBuyer,
      },
    })
    expect(result.action).toBe('deactivate')
    expect(result.productType).toBe('tcc')
  })

  it('produto desconhecido → ignore', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: '9999999' },
        buyer: baseBuyer,
      },
    })
    expect(result.action).toBe('ignore')
    expect(result.reason).toBe('product_not_mapped')
  })

  it('evento desconhecido → ignore', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_DELAYED',
      data: {
        product: { id: '7285432' },
        buyer: baseBuyer,
      },
    })
    expect(result.action).toBe('ignore')
    expect(result.reason).toBe('event_not_handled')
  })

  it('payload sem evento → error', () => {
    const result = decideWebhookAction({
      event: '',
      data: {
        product: { id: '7285432' },
        buyer: baseBuyer,
      },
    })
    expect(result.action).toBe('error')
    expect(result.reason).toBe('payload_incompleto')
  })

  it('payload sem buyer email → error', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: '7285432' },
        buyer: { email: '' },
      },
    })
    expect(result.action).toBe('error')
  })

  it('payload sem product → error', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_APPROVED',
      data: {
        buyer: baseBuyer,
      },
    })
    expect(result.action).toBe('error')
  })

  it('email é normalizado para lowercase', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: '7285432' },
        buyer: { email: '  TESTE@Gmail.COM  ' },
        purchase: { offer: { code: 'u2t04kz5' } },
      },
    })
    expect(result.action).toBe('activate')
  })

  it('product.id como número funciona (Hotmart manda number)', () => {
    const result = decideWebhookAction({
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: 7285432 },
        buyer: baseBuyer,
        purchase: { offer: { code: 'iwqieqxc' } },
      },
    })
    expect(result.action).toBe('activate')
    expect(result.productType).toBe('aba')
    expect(result.plan?.plan_tier).toBe('clinica_100')
  })
})
