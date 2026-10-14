import type { PoolClient } from 'pg'
import { createSystemAlert, type AlertModule, type AlertSeverity } from '@/src/utils/system-alert'
import { GRANTING_EVENTS, type PaymentBetaDelivery, type PaymentBetaEvent } from './paymentbeta-contract'
import {
  NO_HISTORY,
  decidePaymentBeta,
  type PbAlert,
  type PbDecision,
  type PbFact,
  type PbHistory,
  type PbLicense,
  type PbResult,
} from './paymentbeta-rules'
import type { ProductType } from './plans'
import {
  findTenantByEmail,
  findTenantOwner,
  provisionPaymentBetaBuyer,
  sendPurchaseEmail,
} from './provision'

// =====================================================
// AXIS — Receptor PaymentBeta: grava a entrega (pagamento P2)
//
// Tudo numa transação, na ordem:
//   1. registra o delivery_id (paymentbeta_delivery_register, SECURITY DEFINER da 081).
//      Repetido → "duplicate", nada muda. Se algo falhar depois, o ROLLBACK
//      apaga o registro e a nova tentativa do PaymentBeta processa de novo.
//   2. acha o tenant:
//        compra (sale.confirmed / pending): partner_reference → checkout_intents
//          (marca consumed_at); assinatura já ligada; e-mail (3 fontes, igual à
//          Hotmart); comprador novo → src/billing/provision.ts
//        depois da compra (failed/cancelled/reactivated/revoked): só pela
//          assinatura (paymentbeta_subscription_id), nunca por e-mail
//   3. decide (src/billing/paymentbeta-rules.ts, pura) e grava user_licenses
//      (sem RLS, igual ao receptor Hotmart) + axis_audit_logs
//   4. grava o resultado da entrega (paymentbeta_delivery_result)
// Alertas e e-mail saem DEPOIS do COMMIT (notifyPaymentBetaOutcome).
// =====================================================

export type TenantVia = 'partner_reference' | 'assinatura' | 'email' | 'novo'

interface ResolvedTenant {
  tenantId: string
  ownerClerkId: string | null
  via: TenantVia
  intentPlanKey: string | null
  inviteFailed: boolean
}

export interface PaymentBetaOutcome {
  duplicate: boolean
  result: PbResult | null
  tenantId: string | null
  ownerClerkId: string | null
  via: TenantVia | null
  licenseId: string | null
  decision: PbDecision | null
  inviteFailed: boolean
}

const DUPLICATE: PaymentBetaOutcome = {
  duplicate: true,
  result: null,
  tenantId: null,
  ownerClerkId: null,
  via: null,
  licenseId: null,
  decision: null,
  inviteFailed: false,
}

/** Eventos que olham o histórico de cortes da assinatura (chargeback trava; estorno barra a carência). */
const HISTORY_EVENTS: ReadonlySet<PaymentBetaEvent> = new Set([
  'sale.confirmed',
  'subscription.pending',
  'subscription.payment_failed',
  'subscription.reactivated',
])

export const REVOKED_AUDIT_ACTION = 'PAYMENTBETA_SUBSCRIPTION_ACCESS_REVOKED'

/** sale.confirmed → PAYMENTBETA_SALE_CONFIRMED */
export function auditActionFor(event: PaymentBetaEvent): string {
  return `PAYMENTBETA_${event.replace('.', '_').toUpperCase()}`
}

function factOf(d: PaymentBetaDelivery): PbFact {
  return {
    event: d.event,
    planKey: d.plan.key,
    subscriptionId: d.subscriptionId,
    expiresAt: d.expiresAt,
    revokeKind: d.revokeKind,
  }
}

/** Processa uma entrega já autenticada e lida. Lança em erro transitório (→ 5xx, o PaymentBeta tenta de novo). */
export async function processPaymentBetaDelivery(
  client: PoolClient,
  d: PaymentBetaDelivery,
  now: Date = new Date(),
): Promise<PaymentBetaOutcome> {
  await client.query('BEGIN')
  try {
    // Nenhuma espera longa segurando a resposta (o PaymentBeta corta em 10 s).
    await client.query("SET LOCAL statement_timeout = '5s'")

    const registered = await client.query(
      'SELECT paymentbeta_delivery_register($1, $2, $3) AS is_new',
      [d.deliveryId, d.event, d.eventVersion],
    )
    if (registered.rows[0]?.is_new !== true) {
      await client.query('ROLLBACK')
      return DUPLICATE
    }

    // Uma entrega por vez por assinatura e por comprador: duas entregas
    // simultâneas do mesmo comprador novo não criam dois tenants.
    if (d.subscriptionId) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`paymentbeta:sub:${d.subscriptionId}`])
    }
    if (d.customerEmail) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`paymentbeta:email:${d.customerEmail}`])
    }

    const tenant = await resolveTenant(client, d, now)
    let decision: PbDecision
    let licenseId: string | null = null

    if (!tenant) {
      decision = decidePaymentBeta(factOf(d), [], null, NO_HISTORY, now)
    } else {
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.tenantId])
      if (tenant.via === 'partner_reference') {
        // checkout_intents tem RLS forçada: só com app.tenant_id do dono da intenção.
        await client.query(
          'UPDATE checkout_intents SET consumed_at = NOW() WHERE partner_reference = $1 AND consumed_at IS NULL',
          [d.partnerReference],
        )
      }
      const rows = await lockLicenses(client, tenant.tenantId, d.plan.product)
      const history = d.subscriptionId && HISTORY_EVENTS.has(d.event) ? await loadHistory(client, d.subscriptionId) : NO_HISTORY
      decision = decidePaymentBeta(factOf(d), rows, tenant.ownerClerkId, history, now)
      licenseId = await persist(client, tenant, d, decision)
      await audit(client, tenant, d, decision, licenseId)
    }

    await client.query('SELECT paymentbeta_delivery_result($1, $2, $3)', [d.deliveryId, decision.result, tenant?.tenantId ?? null])
    await client.query('COMMIT')

    return {
      duplicate: false,
      result: decision.result,
      tenantId: tenant?.tenantId ?? null,
      ownerClerkId: tenant?.ownerClerkId ?? null,
      via: tenant?.via ?? null,
      licenseId,
      decision,
      inviteFailed: tenant?.inviteFailed ?? false,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}

// ─── Tenant ───

async function resolveTenant(client: PoolClient, d: PaymentBetaDelivery, now: Date): Promise<ResolvedTenant | null> {
  const found = (tenantId: string, ownerClerkId: string | null, via: TenantVia, intentPlanKey: string | null = null): ResolvedTenant =>
    ({ tenantId, ownerClerkId, via, intentPlanKey, inviteFailed: false })

  if (!GRANTING_EVENTS.has(d.event)) {
    const linked = await tenantBySubscription(client, d.subscriptionId)
    return linked ? found(linked, await findTenantOwner(client, linked), 'assinatura') : null
  }

  if (d.partnerReference) {
    const intent = await client.query('SELECT tenant_id, plan_key FROM checkout_intent_lookup($1)', [d.partnerReference])
    const row = intent.rows[0]
    if (row) return found(row.tenant_id, await findTenantOwner(client, row.tenant_id), 'partner_reference', row.plan_key ?? null)
  }

  const linked = await tenantBySubscription(client, d.subscriptionId)
  if (linked) return found(linked, await findTenantOwner(client, linked), 'assinatura')

  if (d.customerEmail) {
    const byEmail = await findTenantByEmail(client, d.customerEmail)
    if (byEmail) return found(byEmail.tenantId, byEmail.ownerClerkId, 'email')
  }

  // Comprador novo só quando ainda há acesso a dar.
  if (!d.customerEmail || d.expiresAt.getTime() <= now.getTime()) return null
  const buyer = await provisionPaymentBetaBuyer(client, {
    email: d.customerEmail,
    name: d.customerName,
    productType: d.plan.product,
    planKey: d.plan.key,
  })
  return { tenantId: buyer.tenantId, ownerClerkId: buyer.ownerClerkId, via: 'novo', intentPlanKey: null, inviteFailed: buyer.inviteFailed }
}

async function tenantBySubscription(client: PoolClient, subscriptionId: string | null): Promise<string | null> {
  if (!subscriptionId) return null
  const res = await client.query(
    `SELECT tenant_id FROM user_licenses
      WHERE paymentbeta_subscription_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [subscriptionId],
  )
  return res.rows[0]?.tenant_id ?? null
}

// ─── Licença ───

async function lockLicenses(client: PoolClient, tenantId: string, productType: ProductType): Promise<PbLicense[]> {
  const res = await client.query(
    `SELECT id, clerk_user_id, is_active, plan_key, billing_source, access_until, paymentbeta_subscription_id
       FROM user_licenses
      WHERE tenant_id = $1 AND product_type = $2
      ORDER BY created_at DESC
      FOR UPDATE`,
    [tenantId, productType],
  )
  return res.rows.map((r) => ({
    id: r.id,
    clerk_user_id: r.clerk_user_id,
    is_active: r.is_active,
    plan_key: r.plan_key ?? null,
    billing_source: r.billing_source ?? null,
    access_until: r.access_until ? new Date(r.access_until) : null,
    paymentbeta_subscription_id: r.paymentbeta_subscription_id ?? null,
  }))
}

async function loadHistory(client: PoolClient, subscriptionId: string): Promise<PbHistory> {
  const res = await client.query(
    `SELECT metadata->>'kind' AS kind
       FROM axis_audit_logs
      WHERE action = '${REVOKED_AUDIT_ACTION}'
        AND metadata->>'subscription_id' = $1
        AND metadata->>'cut' = 'true'`,
    [subscriptionId],
  )
  return {
    chargeback: res.rows.some((r) => r.kind === 'chargeback'),
    revoked: res.rows.length > 0,
  }
}

async function persist(client: PoolClient, tenant: ResolvedTenant, d: PaymentBetaDelivery, decision: PbDecision): Promise<string | null> {
  const write = decision.write
  if (!write) return decision.target?.id ?? null
  const buyerEmail = GRANTING_EVENTS.has(d.event) ? d.customerEmail : null

  if (write.rowId) {
    // Nunca grava em linha cortesia (trava também contra corrida).
    const res = await client.query(
      `UPDATE user_licenses
          SET is_active = $1,
              access_until = $2,
              plan_key = COALESCE($3, plan_key),
              billing_source = 'paymentbeta',
              paymentbeta_subscription_id = $4,
              hotmart_plan = NULL,
              buyer_email = COALESCE($5, buyer_email),
              valid_from = CASE WHEN $6::boolean THEN NOW() ELSE valid_from END,
              valid_until = CASE WHEN $1::boolean THEN NULL ELSE NOW() END,
              updated_at = NOW()
        WHERE id = $7
          AND billing_source IS DISTINCT FROM 'cortesia'
      RETURNING id`,
      [write.is_active, write.access_until, write.plan_key, write.paymentbeta_subscription_id, buyerEmail, write.restart, write.rowId],
    )
    if (!res.rowCount) throw new Error('[PAYMENTBETA] licença mudou durante a gravação; tentar de novo')
    return res.rows[0].id
  }

  if (!tenant.ownerClerkId) throw new Error('[PAYMENTBETA] tenant sem dono (clerk_user_id) para criar a licença')
  const res = await client.query(
    `INSERT INTO user_licenses (
        tenant_id, clerk_user_id, product_type, is_active,
        valid_from, valid_until,
        plan_key, billing_source, access_until, paymentbeta_subscription_id,
        buyer_email, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NULL, $5, 'paymentbeta', $6, $7, $8, NOW(), NOW())
      ON CONFLICT ON CONSTRAINT uq_user_product DO NOTHING
      RETURNING id`,
    [tenant.tenantId, tenant.ownerClerkId, d.plan.product, write.is_active, write.plan_key, write.access_until, write.paymentbeta_subscription_id, buyerEmail],
  )
  // Outra gravação criou a linha agora: a nova tentativa do PaymentBeta pega a linha pronta.
  if (!res.rowCount) throw new Error('[PAYMENTBETA] licença criada ao mesmo tempo por outro processo; tentar de novo')
  return res.rows[0].id
}

const iso = (date: Date | null | undefined): string | null => (date ? date.toISOString() : null)

async function audit(client: PoolClient, tenant: ResolvedTenant, d: PaymentBetaDelivery, decision: PbDecision, licenseId: string | null): Promise<void> {
  const before = decision.target
  const write = decision.write
  await client.query(
    `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
     VALUES ($1, $2, 'paymentbeta_webhook', $3, 'user_licenses', $4, $5, NOW())`,
    [
      tenant.tenantId,
      tenant.ownerClerkId ?? 'system',
      auditActionFor(d.event),
      licenseId,
      JSON.stringify({
        tenant_id: tenant.tenantId,
        delivery_id: d.deliveryId,
        event: d.event,
        event_version: d.eventVersion,
        occurred_at: d.occurredAt,
        transaction_id: d.transactionId,
        asaas_payment_id: d.asaasPaymentId,
        subscription_id: d.subscriptionId,
        partner_reference: d.partnerReference,
        intent_plan_key: tenant.intentPlanKey,
        entitlement_code: d.entitlementCode,
        plan_key: d.plan.key,
        expires_at: iso(d.expiresAt),
        cycle_from: d.cycleFrom,
        payment_status: d.paymentStatus,
        kind: d.revokeKind,
        cut: decision.cut,
        result: decision.result,
        resolved_by: tenant.via,
        before: before
          ? {
              is_active: before.is_active,
              access_until: iso(before.access_until),
              billing_source: before.billing_source,
              plan_key: before.plan_key,
              subscription_id: before.paymentbeta_subscription_id,
            }
          : null,
        after: write
          ? {
              is_active: write.is_active,
              access_until: iso(write.access_until),
              billing_source: 'paymentbeta',
              plan_key: write.plan_key ?? before?.plan_key ?? null,
              subscription_id: write.paymentbeta_subscription_id,
            }
          : null,
      }),
    ],
  )
}

// ─── Depois do COMMIT: alertas e e-mail ───

const PRODUCT_MODULE: Record<ProductType, AlertModule> = {
  tcc: 'axis-tcc',
  aba: 'axis-aba',
  tdah: 'axis-tdah',
}

const ALERTS: Record<PbAlert | 'invite_failed', { code: string; severity: AlertSeverity; message: string }> = {
  hotmart_takeover: {
    code: 'PAYMENTBETA_HOTMART_TAKEOVER',
    severity: 'warning',
    message: 'Compra no PaymentBeta assumiu licença Hotmart ativa — cancelar a Hotmart deste cliente à mão (evita cobrança dupla)',
  },
  other_subscription: {
    code: 'PAYMENTBETA_OTHER_SUBSCRIPTION',
    severity: 'warning',
    message: 'Nova assinatura PaymentBeta assumiu licença de outra assinatura ainda ativa — conferir cobrança dupla à mão',
  },
  cortesia_paid: {
    code: 'PAYMENTBETA_CORTESIA_PAID',
    severity: 'warning',
    message: 'Pagamento PaymentBeta para produto com licença cortesia: a cortesia não mudou — conferir à mão',
  },
  chargeback: {
    code: 'PAYMENTBETA_CHARGEBACK',
    severity: 'warning',
    message: 'Chargeback no PaymentBeta: acesso cortado; esta assinatura só volta à mão',
  },
  chargeback_paid: {
    code: 'PAYMENTBETA_CHARGEBACK_BLOCKED',
    severity: 'warning',
    message: 'Pagamento PaymentBeta de assinatura com chargeback: acesso não liberado — conferir à mão',
  },
  unknown_revocation: {
    code: 'PAYMENTBETA_UNKNOWN_REVOCATION',
    severity: 'critical',
    message: 'Estorno/chargeback de assinatura PaymentBeta sem licença no AXIS — conferir à mão',
  },
  invite_failed: {
    code: 'PAYMENTBETA_INVITE_FAILED',
    severity: 'warning',
    message: 'Convite do Clerk falhou para comprador novo do PaymentBeta — reenviar à mão',
  },
}

/** Alertas (fire-and-forget) e e-mail pós-compra quando o acesso abriu agora. Não lança. */
export async function notifyPaymentBetaOutcome(d: PaymentBetaDelivery, outcome: PaymentBetaOutcome): Promise<void> {
  if (outcome.duplicate || !outcome.decision) return

  const kinds: Array<PbAlert | 'invite_failed'> = [...outcome.decision.alerts]
  if (outcome.inviteFailed) kinds.push('invite_failed')
  for (const kind of kinds) {
    const alert = ALERTS[kind]
    createSystemAlert({
      module: PRODUCT_MODULE[d.plan.product] ?? 'shared',
      severity: alert.severity,
      source: 'webhook/paymentbeta',
      code: alert.code,
      message: alert.message,
      context: {
        tenant_id: outcome.tenantId,
        license_id: outcome.licenseId,
        product_type: d.plan.product,
        plan_key: d.plan.key,
        event: d.event,
        result: outcome.result,
        delivery_id: d.deliveryId,
        transaction_id: d.transactionId,
        subscription_id: d.subscriptionId,
      },
    }).catch(() => {})
  }

  if (outcome.decision.accessOpened && GRANTING_EVENTS.has(d.event) && d.customerEmail) {
    await sendPurchaseEmail({
      to: d.customerEmail,
      buyerName: d.customerName ?? 'Profissional',
      planName: d.plan.name,
      productType: d.plan.product,
      newUser: (outcome.ownerClerkId ?? '').startsWith('pending_'),
    })
  }
}
