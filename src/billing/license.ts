import type { PoolClient } from 'pg'
import { createSystemAlert, type AlertModule } from '@/src/utils/system-alert'
import { UNKNOWN_PLAN_MAX_PATIENTS, type ProductType } from './plans'
import { fetchActiveLicense, resolveLicense, type LicenseResolution, type LicenseRow } from './license-rules'

// =====================================================
// AXIS — Licença por produto: quem decide é a plan_key
//
// A regra pura (resolveLicense, legacy*, fetchActiveLicense) mora em
// ./license-rules e é reexportada daqui. Este arquivo acrescenta o alerta
// (fallback / chave desconhecida) e a leitura com alerta (getLicenseStatus).
// =====================================================

export * from './license-rules'

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

// ─── Leitura com alerta ───

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
