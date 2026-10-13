import type { PoolClient } from 'pg'
import { createSystemAlert, type AlertModule } from '@/src/utils/system-alert'
import {
  FREE_MAX_PATIENTS,
  PLANS,
  UNKNOWN_PLAN_MAX_PATIENTS,
  getPlan,
  isPlanValidFor,
  type BillingSource,
  type PlanKey,
  type ProductType,
} from './plans'

// =====================================================
// AXIS — Licença por produto: quem decide é a plan_key
//
// Pago = plan_key não nula.
//   - plan_key do catálogo e válida para a linha → limite do catálogo
//   - plan_key desconhecida/inválida → 100 + alerta
//   - plan_key nula mas hotmart_plan preenchido (linha gravada por código
//     antigo) → regras do backfill (migration 081) + alerta; ninguém perde acesso
//   - sem licença ativa ou sem nada → free (1)
//
// As regras "legacy*" abaixo são AS MESMAS do backfill da migration 081.
// Mudou aqui, muda lá (e vice-versa).
// =====================================================

const ABA_250_OFFER = 'gona25or'
const TDAH_250_OFFER = 'hxzwuwfh'

/** Eventos que o receptor Hotmart grava em hotmart_event (ativação e desativação). */
export function isHotmartEvent(event: string | null | undefined): boolean {
  return typeof event === 'string' && (event.startsWith('PURCHASE_') || event === 'SUBSCRIPTION_CANCELLATION')
}

/** Marca de concessão manual: evento ADMIN_* ou hotmart_plan = 'admin_grant'. */
export function isCortesiaMark(event: string | null | undefined, hotmartPlan: string | null | undefined): boolean {
  return (typeof event === 'string' && event.startsWith('ADMIN_')) || hotmartPlan === 'admin_grant'
}

/**
 * billing_source de uma licença antiga. null = nenhuma regra (ou as duas):
 * no backfill isso ABORTA a migration — nunca chutar.
 */
export function legacyBillingSource(
  event: string | null | undefined,
  hotmartPlan: string | null | undefined,
): BillingSource | null {
  const hotmart = isHotmartEvent(event)
  const cortesia = isCortesiaMark(event, hotmartPlan)
  if (hotmart && !cortesia) return 'hotmart'
  if (cortesia && !hotmart) return 'cortesia'
  return null
}

/**
 * plan_key de uma licença paga antiga (ou de uma ativação Hotmart nova).
 *   ABA:  oferta gona25or ou plano clinica_250 → aba_250; resto → aba_100
 *   TDAH: oferta hxzwuwfh ou plano clinica_250 → tdah_250; resto → tdah_100
 *   TCC:  tudo → tcc_100
 */
export function legacyPlanKey(
  productType: ProductType,
  hotmartOffer: string | null | undefined,
  hotmartPlan: string | null | undefined,
): PlanKey {
  if (productType === 'aba') {
    return hotmartOffer === ABA_250_OFFER || hotmartPlan === 'clinica_250' ? 'aba_250' : 'aba_100'
  }
  if (productType === 'tdah') {
    return hotmartOffer === TDAH_250_OFFER || hotmartPlan === 'clinica_250' ? 'tdah_250' : 'tdah_100'
  }
  return 'tcc_100'
}

const ADMIN_TIERS_100 = new Set(['founders', 'clinica_100'])

/**
 * Chave equivalente ao upgrade manual do admin (billing_source = 'cortesia').
 *   founders / clinica_100 → <produto>_100
 *   clinica_250            → aba_250 / tdah_250 (TCC → tcc_100)
 * Outro valor → null (a rota recusa; não chuta).
 */
export function adminPlanKey(productType: string, planTier: string | null | undefined): PlanKey | null {
  if (productType !== 'tcc' && productType !== 'aba' && productType !== 'tdah') return null
  if (!planTier || (!ADMIN_TIERS_100.has(planTier) && planTier !== 'clinica_250')) return null
  if (productType === 'tcc') return 'tcc_100'
  if (planTier === 'clinica_250') return productType === 'aba' ? 'aba_250' : 'tdah_250'
  return productType === 'aba' ? 'aba_100' : 'tdah_100'
}

// ─── Resolução ───

export interface LicenseRow {
  id?: string | null
  product_type: ProductType
  plan_key: string | null
  billing_source: string | null
  hotmart_plan: string | null
  hotmart_offer: string | null
}

export type LicenseKind = 'free' | 'plan_key' | 'invalid_plan_key' | 'fallback'

export interface LicenseResolution {
  kind: LicenseKind
  paid: boolean
  /** Chave que decidiu (null = free). */
  planKey: string | null
  maxPatients: number
}

function filled(value: string | null | undefined): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

export function resolveLicense(row: LicenseRow | null | undefined): LicenseResolution {
  if (!row) return { kind: 'free', paid: false, planKey: null, maxPatients: FREE_MAX_PATIENTS }

  const planKey = filled(row.plan_key)
  if (planKey) {
    const plan = getPlan(planKey)
    if (plan && isPlanValidFor(plan, row.product_type)) {
      return { kind: 'plan_key', paid: true, planKey, maxPatients: plan.maxPatients }
    }
    return { kind: 'invalid_plan_key', paid: true, planKey, maxPatients: UNKNOWN_PLAN_MAX_PATIENTS }
  }

  if (filled(row.hotmart_plan)) {
    const key = legacyPlanKey(row.product_type, row.hotmart_offer, row.hotmart_plan)
    return { kind: 'fallback', paid: true, planKey: key, maxPatients: PLANS[key].maxPatients }
  }

  return { kind: 'free', paid: false, planKey: null, maxPatients: FREE_MAX_PATIENTS }
}

// ─── Alerta (fallback / chave desconhecida), no máximo 1 por hora por licença ───

const ALERT_WINDOW_MS = 60 * 60 * 1000
const lastAlertAt = new Map<string, number>()

const PRODUCT_MODULE: Record<ProductType, AlertModule> = {
  tcc: 'axis-tcc',
  aba: 'axis-aba',
  tdah: 'axis-tdah',
}

export function alertLicenseResolution(
  resolution: LicenseResolution,
  tenantId: string,
  row: LicenseRow | null | undefined,
): void {
  if (!row || (resolution.kind !== 'fallback' && resolution.kind !== 'invalid_plan_key')) return

  const throttleKey = `${resolution.kind}:${tenantId}:${row.product_type}:${row.id ?? ''}`
  const now = Date.now()
  const last = lastAlertAt.get(throttleKey)
  if (last !== undefined && now - last < ALERT_WINDOW_MS) return
  lastAlertAt.set(throttleKey, now)

  const fallback = resolution.kind === 'fallback'
  createSystemAlert({
    module: PRODUCT_MODULE[row.product_type] ?? 'shared',
    severity: 'warning',
    source: 'billing/license',
    code: fallback ? 'LICENSE_PLAN_KEY_FALLBACK' : 'LICENSE_PLAN_KEY_UNKNOWN',
    message: fallback
      ? 'Licença paga sem plan_key: aplicada a regra do backfill (conferir a 081)'
      : `plan_key desconhecida ou inválida para a licença: mantido limite de ${UNKNOWN_PLAN_MAX_PATIENTS}`,
    context: {
      tenant_id: tenantId,
      license_id: row.id ?? null,
      product_type: row.product_type,
      plan_key: row.plan_key,
      billing_source: row.billing_source,
      resolved_plan_key: resolution.planKey,
      max_patients: resolution.maxPatients,
    },
  }).catch(() => {})
}

/** Só para testes: zera o controle de 1 alerta por hora. */
export function resetLicenseAlertThrottle(): void {
  lastAlertAt.clear()
}

// ─── Leitura ───

/** Licença ativa mais recente do produto (mesma ordem que product-limits usava). */
export async function fetchActiveLicense(
  client: PoolClient,
  tenantId: string,
  productType: ProductType,
): Promise<LicenseRow | null> {
  const res = await client.query(
    `SELECT id, product_type, plan_key, billing_source, hotmart_plan, hotmart_offer
       FROM user_licenses
      WHERE tenant_id = $1
        AND product_type = $2
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1`,
    [tenantId, productType],
  )
  return (res.rows[0] as LicenseRow | undefined) ?? null
}

export interface LicenseStatus extends LicenseResolution {
  row: LicenseRow | null
}

/** Lê a licença ativa do produto, resolve pela plan_key e alerta se precisou de fallback. */
export async function getLicenseStatus(
  client: PoolClient,
  tenantId: string,
  productType: ProductType,
): Promise<LicenseStatus> {
  const row = await fetchActiveLicense(client, tenantId, productType)
  const resolution = resolveLicense(row)
  alertLicenseResolution(resolution, tenantId, row)
  return { ...resolution, row }
}
