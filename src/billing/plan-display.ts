import { getPlan } from './plans'

// =====================================================
// AXIS — Exibição do plano nas telas (pagamento P2)
//
// Rótulo, limite e link de upgrade saem da LICENÇA do produto
// (/api/aba/me → product_limits.<produto>: plan_key, billing_source,
// max_patients), nunca de tenants.plan_tier. Puro: roda no cliente.
// =====================================================

/** "ABA 100" pela chave; sem chave = freeLabel; chave fora do catálogo = a própria chave. */
export function planLabel(planKey: string | null | undefined, freeLabel = 'Gratuito'): string {
  if (!planKey) return freeLabel
  return getPlan(planKey)?.name ?? planKey
}

/** Já chegou no limite do produto? Sem limite conhecido a tela não bloqueia (o servidor decide). */
export function atPatientLimit(count: number, maxPatients: number | null | undefined): boolean {
  return typeof maxPatients === 'number' && count >= maxPatients
}

export interface UpgradeLink {
  url: string
  label: string
}

const HOTMART_ABA_FOUNDERS: UpgradeLink = {
  url: 'https://pay.hotmart.com/H104663812P?off=5hz0et4m',
  label: 'Founders — R$147/mês',
}
const HOTMART_ABA_CLINICA_250: UpgradeLink = {
  url: 'https://pay.hotmart.com/H104663812P?off=gona25or',
  label: 'Clínica 250 — R$497/mês',
}

/**
 * Link de upgrade da Hotmart na tela "Meu Plano" do ABA (os mesmos de antes,
 * agora pela chave da licença):
 *   licença PaymentBeta → nenhum (quem cobra é o PaymentBeta; botão novo é da P4)
 *   grátis              → Founders
 *   aba_50 / aba_100    → Clínica 250
 *   aba_250 / outra     → nenhum
 */
export function abaHotmartUpgrade(
  planKey: string | null | undefined,
  billingSource: string | null | undefined,
): UpgradeLink | null {
  if (billingSource === 'paymentbeta') return null
  if (!planKey) return HOTMART_ABA_FOUNDERS
  if (planKey === 'aba_50' || planKey === 'aba_100') return HOTMART_ABA_CLINICA_250
  return null
}
