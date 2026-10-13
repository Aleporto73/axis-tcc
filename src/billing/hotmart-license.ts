import type { PoolClient } from 'pg'
import { createSystemAlert, type AlertModule } from '@/src/utils/system-alert'
import { legacyPlanKey, resolveLicense, type LicenseRow } from './license'
import type { BillingSource, PlanKey, ProductType } from './plans'

// =====================================================
// AXIS — Licença gravada pelo receptor Hotmart (pagamento P1)
//
// Ativação: plan_key pelas MESMAS regras do backfill 081
// (src/billing/license.ts → legacyPlanKey) e billing_source = 'hotmart'.
// Linha 'cortesia' ou 'paymentbeta' não é sobrescrita nem desativada
// pela Hotmart: o evento é ignorado para ela e vira alerta.
//
// TCC: compra NOVA = o tenant não tinha licença TCC paga ATIVA antes deste
// evento (lida com FOR UPDATE na mesma transação, antes de gravar).
// Compra nova → tcc_100 + alerta "tratar à mão". Renovação mensal (já havia
// licença TCC paga ativa) → tcc_100 sem alerta.
// =====================================================

const PROTECTED_SOURCES: ReadonlySet<string> = new Set(['cortesia', 'paymentbeta'])

const PRODUCT_MODULE: Record<ProductType, AlertModule> = {
  tcc: 'axis-tcc',
  aba: 'axis-aba',
  tdah: 'axis-tdah',
}

export interface HotmartActivation {
  tenantId: string
  clerkUserId: string
  productType: ProductType
  validFrom: Date
  transactionId: string
  event: string
  offerCode: string | null
  planName: string | null
  buyerEmail: string
  /** true = o UPDATE também reinicia valid_from/valid_until (tenant que já existia). */
  resetValidity: boolean
}

export type HotmartActivationOutcome =
  | { status: 'activated'; planKey: PlanKey; newTccSale: boolean }
  | { status: 'skipped_protected'; planKey: PlanKey; protectedBy: BillingSource | null; newTccSale: false }

interface ExistingLicense extends LicenseRow {
  clerk_user_id: string
  is_active: boolean
}

const UPSERT_PREFIX = `INSERT INTO user_licenses (
    tenant_id, clerk_user_id, product_type, is_active,
    valid_from, valid_until,
    hotmart_transaction, hotmart_event, hotmart_offer, hotmart_plan,
    plan_key, billing_source,
    buyer_email, created_at, updated_at
  ) VALUES ($1, $2, $3, true, $4, NULL, $5, $6, $7, $8, $9, 'hotmart', $10, NOW(), NOW())
  ON CONFLICT ON CONSTRAINT uq_user_product
  DO UPDATE SET
    is_active = true,`

const UPSERT_RESET_VALIDITY = `
    valid_from = EXCLUDED.valid_from,
    valid_until = NULL,`

const UPSERT_SUFFIX = `
    hotmart_transaction = EXCLUDED.hotmart_transaction,
    hotmart_event = EXCLUDED.hotmart_event,
    hotmart_offer = EXCLUDED.hotmart_offer,
    hotmart_plan = EXCLUDED.hotmart_plan,
    plan_key = EXCLUDED.plan_key,
    billing_source = EXCLUDED.billing_source,
    buyer_email = EXCLUDED.buyer_email,
    updated_at = NOW()
  WHERE user_licenses.billing_source IS NULL OR user_licenses.billing_source = 'hotmart'
  RETURNING id`

/**
 * Grava a ativação Hotmart de um produto, sem sobrescrever cortesia/paymentbeta.
 * Precisa rodar dentro da transação do receptor (usa FOR UPDATE).
 */
export async function activateHotmartLicense(
  client: PoolClient,
  input: HotmartActivation,
): Promise<HotmartActivationOutcome> {
  const planKey = legacyPlanKey(input.productType, input.offerCode, input.planName)

  const existing = await client.query(
    `SELECT id, clerk_user_id, is_active, product_type, plan_key, billing_source, hotmart_plan, hotmart_offer
       FROM user_licenses
      WHERE tenant_id = $1 AND product_type = $2
      FOR UPDATE`,
    [input.tenantId, input.productType],
  )
  const rows = existing.rows as ExistingLicense[]

  // Protegida ativa, ou protegida na mesma linha que o UPSERT atualizaria.
  const blocking = rows.find(
    (r) => PROTECTED_SOURCES.has(r.billing_source ?? '') && (r.is_active || r.clerk_user_id === input.clerkUserId),
  )
  if (blocking) {
    return { status: 'skipped_protected', planKey, protectedBy: blocking.billing_source as BillingSource, newTccSale: false }
  }

  const hadPaidBefore = rows.some((r) => r.is_active && resolveLicense(r).paid)

  const res = await client.query(
    UPSERT_PREFIX + (input.resetValidity ? UPSERT_RESET_VALIDITY : '') + UPSERT_SUFFIX,
    [
      input.tenantId, input.clerkUserId, input.productType, input.validFrom,
      input.transactionId, input.event, input.offerCode, input.planName,
      planKey, input.buyerEmail,
    ],
  )

  // Linha protegida criada entre o SELECT e o UPSERT: o WHERE do DO UPDATE barrou.
  if (!res.rowCount) {
    return { status: 'skipped_protected', planKey, protectedBy: null, newTccSale: false }
  }

  return { status: 'activated', planKey, newTccSale: input.productType === 'tcc' && !hadPaidBefore }
}

export interface HotmartDeactivationOutcome {
  deactivated: number
  /** billing_source das licenças ativas que a Hotmart não pode desativar. */
  protectedActive: BillingSource[]
}

/** Desativa só licenças Hotmart (ou free) do produto; cortesia/paymentbeta ficam. */
export async function deactivateHotmartLicenses(
  client: PoolClient,
  tenantId: string,
  productType: ProductType,
  event: string,
): Promise<HotmartDeactivationOutcome> {
  const res = await client.query(
    `UPDATE user_licenses
     SET is_active = false, valid_until = NOW(), hotmart_event = $1, updated_at = NOW()
     WHERE tenant_id = $2 AND product_type = $3 AND is_active = true
       AND (billing_source IS NULL OR billing_source = 'hotmart')`,
    [event, tenantId, productType],
  )

  const protectedRes = await client.query(
    `SELECT billing_source FROM user_licenses
     WHERE tenant_id = $1 AND product_type = $2 AND is_active = true
       AND billing_source IN ('cortesia', 'paymentbeta')`,
    [tenantId, productType],
  )

  return {
    deactivated: res.rowCount ?? 0,
    protectedActive: protectedRes.rows.map((r: { billing_source: BillingSource }) => r.billing_source),
  }
}

// ─── Alertas (chamar DEPOIS do COMMIT) ───

export interface HotmartAlertContext {
  tenantId: string
  productType: ProductType
  event: string
  transactionId: string
  offerCode: string | null
}

export function alertNewTccHotmartSale(ctx: HotmartAlertContext): Promise<void> {
  return createSystemAlert({
    module: 'axis-tcc',
    severity: 'warning',
    source: 'webhook/hotmart',
    code: 'TCC_HOTMART_SALE_AFTER_P1',
    message: 'TCC vendido na Hotmart após P1 — tratar à mão',
    context: {
      tenant_id: ctx.tenantId,
      event: ctx.event,
      transaction_id: ctx.transactionId,
      offer: ctx.offerCode,
      plan_key: 'tcc_100',
    },
  }).catch(() => {})
}

export function alertHotmartProtectedLicense(
  ctx: HotmartAlertContext,
  action: 'activation' | 'deactivation',
  protectedBy: BillingSource | null,
): Promise<void> {
  return createSystemAlert({
    module: PRODUCT_MODULE[ctx.productType] ?? 'shared',
    severity: 'warning',
    source: 'webhook/hotmart',
    code: 'HOTMART_PROTECTED_LICENSE',
    message: action === 'activation'
      ? 'Pagamento Hotmart não alterou licença cortesia/paymentbeta — conferir à mão'
      : 'Cancelamento Hotmart não desativou licença cortesia/paymentbeta — conferir à mão',
    context: {
      tenant_id: ctx.tenantId,
      product_type: ctx.productType,
      event: ctx.event,
      transaction_id: ctx.transactionId,
      offer: ctx.offerCode,
      billing_source: protectedBy,
    },
  }).catch(() => {})
}
