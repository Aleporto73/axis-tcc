// =====================================================
// AXIS — Catálogo único de planos (pagamento P1)
//
// Fonte única das chaves gravadas em user_licenses.plan_key.
// Quem decide limite e pago/free lê SÓ a plan_key (src/billing/license.ts).
//
// À venda: aba_50/100/250, tdah_50/100/250, tcc_50/100.
//   maxPatients  → pacientes/aprendizes do produto
//   priceLabel   → só rótulo (quem cobra é o PaymentBeta); null = valor ainda
//                  não definido no plano aprovado
//   entitlement  → axis-<produto>-<n>
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
  priceLabel: string | null
  entitlement: string | null
}

export const FREE_MAX_PATIENTS = 1
/** plan_key desconhecida ou inválida: mantém 100 (e gera alerta). */
export const UNKNOWN_PLAN_MAX_PATIENTS = 100

function forSale(key: PlanKey, product: ProductType, maxPatients: number): PlanDef {
  return {
    key,
    product,
    maxPatients,
    forSale: true,
    priceLabel: null,
    entitlement: `axis-${product}-${maxPatients}`,
  }
}

export const PLANS: Readonly<Record<PlanKey, PlanDef>> = {
  aba_50: forSale('aba_50', 'aba', 50),
  aba_100: forSale('aba_100', 'aba', 100),
  aba_250: forSale('aba_250', 'aba', 250),
  tdah_50: forSale('tdah_50', 'tdah', 50),
  tdah_100: forSale('tdah_100', 'tdah', 100),
  tdah_250: forSale('tdah_250', 'tdah', 250),
  tcc_50: forSale('tcc_50', 'tcc', 50),
  tcc_100: forSale('tcc_100', 'tcc', 100),
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

/** A chave vale para esta linha? O produto da chave tem que ser o da licença. */
export function isPlanValidFor(plan: PlanDef, productType: string): boolean {
  return plan.product === productType
}
