// =====================================================
// AXIS — Catálogo único de planos (pagamento P1/P2)
//
// Fonte única das chaves gravadas em user_licenses.plan_key.
// Quem decide limite e pago/free lê SÓ a plan_key (src/billing/license.ts).
//
// À venda: aba_50/100/250, tdah_50/100/250, tcc_50/100.
//   maxPatients  → pacientes/aprendizes do produto
//   priceBRL     → preço em reais (P2). Só rótulo: quem cobra é o PaymentBeta
//   entitlement  → axis-<produto>-<n> (entitlement.code do PaymentBeta)
// Sem Founders.
// =====================================================

export type ProductType = 'tcc' | 'aba' | 'tdah'

export type BillingSource = 'hotmart' | 'paymentbeta' | 'cortesia'

export type PlanKey =
  | 'aba_50'
  | 'aba_100'
  | 'aba_250'
  | 'tdah_50'
  | 'tdah_100'
  | 'tdah_250'
  | 'tcc_50'
  | 'tcc_100'

export interface PlanDef {
  key: PlanKey
  product: ProductType
  maxPatients: number
  forSale: boolean
  /** Nome curto para e-mail e tela: "ABA 100". */
  name: string
  priceBRL: number | null
  /** "R$ 99"; null = preço não definido. */
  priceLabel: string | null
  entitlement: string | null
}

export const FREE_MAX_PATIENTS = 1
/** plan_key desconhecida ou inválida: mantém 100 (e gera alerta). */
export const UNKNOWN_PLAN_MAX_PATIENTS = 100

function forSale(key: PlanKey, product: ProductType, maxPatients: number, priceBRL: number): PlanDef {
  return {
    key,
    product,
    maxPatients,
    forSale: true,
    name: `${product.toUpperCase()} ${maxPatients}`,
    priceBRL,
    priceLabel: `R$ ${priceBRL}`,
    entitlement: `axis-${product}-${maxPatients}`,
  }
}

export const PLANS: Readonly<Record<PlanKey, PlanDef>> = {
  aba_50: forSale('aba_50', 'aba', 50, 59),
  aba_100: forSale('aba_100', 'aba', 100, 99),
  aba_250: forSale('aba_250', 'aba', 250, 179),
  tdah_50: forSale('tdah_50', 'tdah', 50, 49),
  tdah_100: forSale('tdah_100', 'tdah', 100, 79),
  tdah_250: forSale('tdah_250', 'tdah', 250, 149),
  tcc_50: forSale('tcc_50', 'tcc', 50, 29),
  tcc_100: forSale('tcc_100', 'tcc', 100, 49),
}

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value)
}

export function getPlan(key: string | null | undefined): PlanDef | null {
  return isPlanKey(key) ? PLANS[key] : null
}

export function plansForSale(product?: ProductType): PlanDef[] {
  return Object.values(PLANS).filter((p) => p.forSale && (!product || p.product === product))
}

/** Plano pelo entitlement.code do PaymentBeta (ex.: axis-aba-100). null = fora do catálogo. */
export function planByEntitlement(code: string | null | undefined): PlanDef | null {
  if (typeof code !== 'string' || code === '') return null
  return Object.values(PLANS).find((p) => p.entitlement === code) ?? null
}

/** A chave vale para esta linha? O produto da chave tem que ser o da licença. */
export function isPlanValidFor(plan: PlanDef, productType: string): boolean {
  return plan.product === productType
}
