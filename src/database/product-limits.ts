import { PoolClient } from 'pg'
import { getLicenseStatus } from '@/src/billing/license'
import type { ProductType } from '@/src/billing/plans'

// =====================================================
// AXIS — Product Limits (Per-Product Isolation)
//
// Resolve limite de pacientes/aprendizes POR PRODUTO,
// lendo de user_licenses em vez de tenants.max_patients.
//
// tenants.max_patients é GLOBAL e compartilhado entre
// TCC/ABA/TDAH — comprar ABA founders vazava 100 pacientes
// para TDAH free. Esta função isola os limites.
//
// Desde o pagamento P1 o limite sai da plan_key
// (catálogo src/billing/plans.ts, regra em src/billing/license.ts):
//   sem licença ativa / sem plano → free (1)
//   plan_key do catálogo          → limite da chave (TCC 50/100)
//   plan_key desconhecida         → 100 + alerta
//   plan_key nula + hotmart_plan  → regra do backfill 081 + alerta
// =====================================================

export type { ProductType } from '@/src/billing/plans'

export interface ProductLimit {
  /** Só rótulo de exibição (telas "Meu Plano"); não decide nada. */
  plan: string
  /** Chave que decidiu o limite (null = free). */
  planKey: string | null
  /** Origem da licença paga (hotmart | paymentbeta | cortesia); null = free ou linha antiga. */
  billingSource: string | null
  maxPatients: number
}

/**
 * Resolve o limite de pacientes/aprendizes para um produto específico.
 *
 * Busca a licença ativa mais recente em user_licenses para o
 * (tenant_id, product_type) e decide pela plan_key.
 *
 * @param client - PoolClient dentro de transação withTenant
 * @param tenantId - UUID do tenant
 * @param productType - 'tcc' | 'aba' | 'tdah'
 * @returns { plan, planKey, maxPatients }
 */
export async function getProductLimit(
  client: PoolClient,
  tenantId: string,
  productType: ProductType
): Promise<ProductLimit> {
  const status = await getLicenseStatus(client, tenantId, productType)

  if (!status.paid) {
    return { plan: 'free', planKey: null, billingSource: null, maxPatients: status.maxPatients }
  }

  // Rótulo igual ao de antes (hotmart_plan) para não mudar as telas;
  // licença sem hotmart_plan (PaymentBeta, cortesia nova) mostra a chave.
  const label = status.row?.hotmart_plan || status.planKey || 'free'
  return {
    plan: label,
    planKey: status.planKey,
    billingSource: status.row?.billing_source ?? null,
    maxPatients: status.maxPatients,
  }
}
