import { PoolClient } from 'pg'

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
// Mapeamento hotmart_plan → max:
//   null (free)      → 1
//   founders_50      → 50
//   founders         → 100
//   clinica_100      → 100
//   clinica_250      → 250
//
// Fallback: se não encontrar licença ativa, retorna free (1).
// =====================================================

export type ProductType = 'tcc' | 'aba' | 'tdah'

export interface ProductLimit {
  plan: string       // hotmart_plan ou 'free'
  maxPatients: number
}

// Mapeamento centralizado: hotmart_plan → limite
// TCC usa regra própria (PRO = ilimitado), ABA/TDAH usam mapa abaixo
const PLAN_TO_MAX: Record<string, number> = {
  'founders_50':  50,
  'founders':     100,
  'clinica_100':  100,
  'clinica_250':  250,
}

/**
 * Resolve o limite de pacientes/aprendizes para um produto específico.
 *
 * Busca a licença ativa mais recente em user_licenses para o
 * (tenant_id, product_type) e mapeia hotmart_plan → max.
 *
 * @param client - PoolClient dentro de transação withTenant
 * @param tenantId - UUID do tenant
 * @param productType - 'tcc' | 'aba' | 'tdah'
 * @returns { plan, maxPatients }
 */
export async function getProductLimit(
  client: PoolClient,
  tenantId: string,
  productType: ProductType
): Promise<ProductLimit> {
  const res = await client.query(
    `SELECT hotmart_plan
     FROM user_licenses
     WHERE tenant_id = $1
       AND product_type = $2
       AND is_active = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId, productType]
  )

  const hotmartPlan = res.rows[0]?.hotmart_plan as string | null

  // Sem licença ativa ou sem plano Hotmart → free (1 paciente)
  if (!hotmartPlan) {
    return { plan: 'free', maxPatients: 1 }
  }

  // TCC tem regra histórica: qualquer plano pago = ilimitado
  if (productType === 'tcc') {
    return { plan: hotmartPlan, maxPatients: 999999 }
  }

  // ABA/TDAH: mapa explícito
  const max = PLAN_TO_MAX[hotmartPlan]
  if (max) {
    return { plan: hotmartPlan, maxPatients: max }
  }

  // Plano Hotmart desconhecido mas existente → founders default (100)
  return { plan: hotmartPlan, maxPatients: 100 }
}
