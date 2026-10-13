import type { PoolClient } from 'pg'
import { clerkClient } from '@clerk/nextjs/server'
import { Resend } from 'resend'
import { env } from '@/src/lib/env'
import { purchaseNewUserTemplate, purchaseUpgradeTemplate } from '@/src/email/purchase-template'
import { redactEmail } from '@/src/lib/log-redaction'
import type { PlanKey, ProductType } from './plans'

// =====================================================
// AXIS — Comprador do PaymentBeta: achar, criar e avisar (pagamento P2)
//
// MESMO fluxo do auto-provisionamento do receptor Hotmart
// (app/api/webhook/hotmart/route.ts → provisionNewBuyer), sem mexer nele:
//   - e-mail: as mesmas 3 fontes (profiles.email, tenants.email, user_licenses.buyer_email)
//   - Caso A: já tem conta no Clerk → usa o tenant dela ou cria tenant + profile ativo
//   - Caso B: não tem conta → convite do Clerk + tenant + profile PENDENTE
//     (clerk_user_id = 'pending_paymentbeta_{email}'). No 1º login, o webhook do
//     Clerk (user.created) ou /api/user/tenant troca pelo id real.
// A licença não é criada aqui: quem grava é src/billing/paymentbeta-license.ts.
//
// Diferença proposital: se o Clerk não responder, ERRO (o PaymentBeta tenta de
// novo) em vez de seguir para convite — evita criar um segundo tenant para quem
// já tem conta.
// =====================================================

export const PENDING_PURCHASE_PREFIX = {
  hotmart: 'pending_hotmart_',
  paymentbeta: 'pending_paymentbeta_',
} as const

export type PurchaseSource = keyof typeof PENDING_PURCHASE_PREFIX

/** De que compra veio o dono pendente (null = não é dono pendente de compra; ex.: convite de equipe). */
export function pendingPurchaseSource(clerkUserId: string | null | undefined): PurchaseSource | null {
  if (typeof clerkUserId !== 'string') return null
  for (const [source, prefix] of Object.entries(PENDING_PURCHASE_PREFIX)) {
    if (clerkUserId.startsWith(prefix)) return source as PurchaseSource
  }
  return null
}

// ─── Tempo limite (o PaymentBeta espera no máximo 10 s pela resposta) ───
// Pior caso de um comprador novo: 2 chamadas ao Clerk + 1 e-mail ≈ 8,5 s.

export const CLERK_TIMEOUT_MS = 3_000
export const EMAIL_TIMEOUT_MS = 2_500

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: sem resposta em ${ms} ms`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// ─── Achar o tenant ───

export interface BuyerTenant {
  tenantId: string
  ownerClerkId: string | null
}

/** Mesma busca de 3 fontes do receptor Hotmart (evita tenant duplicado). */
export async function findTenantByEmail(client: PoolClient, email: string): Promise<BuyerTenant | null> {
  const res = await client.query(
    `SELECT tenant_id, clerk_user_id FROM (
      SELECT p.tenant_id, t.clerk_user_id, 1 as prio
        FROM profiles p
        JOIN tenants t ON t.id = p.tenant_id
       WHERE LOWER(p.email) = $1
      UNION ALL
      SELECT t.id AS tenant_id, t.clerk_user_id, 2 as prio
        FROM tenants t
       WHERE LOWER(t.email) = $1
      UNION ALL
      SELECT ul.tenant_id, ul.clerk_user_id, 3 as prio
        FROM user_licenses ul
       WHERE LOWER(ul.buyer_email) = $1
    ) combined
    ORDER BY prio
    LIMIT 1`,
    [email.toLowerCase().trim()],
  )
  const row = res.rows[0]
  return row ? { tenantId: row.tenant_id, ownerClerkId: row.clerk_user_id ?? null } : null
}

/** clerk_user_id do dono do tenant (é o que vai na licença). */
export async function findTenantOwner(client: PoolClient, tenantId: string): Promise<string | null> {
  const res = await client.query(`SELECT clerk_user_id FROM tenants WHERE id = $1`, [tenantId])
  return res.rows[0]?.clerk_user_id ?? null
}

// ─── Criar o comprador ───

const DASHBOARD_PATH: Record<ProductType, string> = {
  tcc: '/dashboard',
  aba: '/aba/dashboard',
  tdah: '/tdah/dashboard',
}

export interface ProvisionInput {
  email: string
  name: string | null
  productType: ProductType
  planKey: PlanKey
}

export interface ProvisionedBuyer extends BuyerTenant {
  method: 'existing_user' | 'invitation'
  createdTenant: boolean
  /** Convite do Clerk falhou (o tenant pendente foi criado mesmo assim): alerta. */
  inviteFailed: boolean
}

/** Roda dentro da transação do receptor. */
export async function provisionPaymentBetaBuyer(client: PoolClient, input: ProvisionInput): Promise<ProvisionedBuyer> {
  const email = input.email.toLowerCase().trim()
  const name = input.name?.trim() || 'Profissional'
  const clerk = await clerkClient()

  // ── Caso A: já tem conta no Clerk ── (falha do Clerk = erro; o PaymentBeta tenta de novo)
  const users = await withTimeout(clerk.users.getUserList({ emailAddress: [email] }), CLERK_TIMEOUT_MS, 'Clerk getUserList')
  if (users.data.length > 0) {
    const clerkUserId = users.data[0].id
    const existing = await client.query(
      `SELECT tenant_id, clerk_user_id FROM (
        SELECT p.tenant_id, t.clerk_user_id, 1 as prio
          FROM profiles p
          JOIN tenants t ON t.id = p.tenant_id
         WHERE p.clerk_user_id = $1
        UNION ALL
        SELECT t.id AS tenant_id, t.clerk_user_id, 2 as prio
          FROM tenants t
         WHERE t.clerk_user_id = $1
      ) combined
      ORDER BY prio
      LIMIT 1`,
      [clerkUserId],
    )
    if (existing.rows.length > 0) {
      const row = existing.rows[0]
      return { tenantId: row.tenant_id, ownerClerkId: row.clerk_user_id ?? clerkUserId, method: 'existing_user', createdTenant: false, inviteFailed: false }
    }
    const tenantId = await createTenantWithProfile(client, { email, name, clerkUserId, active: true, input, method: 'existing_user' })
    return { tenantId, ownerClerkId: clerkUserId, method: 'existing_user', createdTenant: true, inviteFailed: false }
  }

  // ── Caso B: não tem conta → convite + tenant pendente ──
  let inviteFailed = false
  try {
    const baseUrl = env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com'
    await withTimeout(
      clerk.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${baseUrl}${DASHBOARD_PATH[input.productType]}`,
        ignoreExisting: true,
        publicMetadata: { source: 'paymentbeta_purchase', product_type: input.productType, plan_key: input.planKey },
      }),
      CLERK_TIMEOUT_MS,
      'Clerk createInvitation',
    )
  } catch (err) {
    // Igual à Hotmart: o tenant pendente sai de qualquer jeito (cadastro direto com o mesmo e-mail ativa).
    inviteFailed = true
    console.warn('[PAYMENTBETA PROVISION] Convite falhou:', redactEmail(email), err instanceof Error ? err.message : 'erro')
  }

  const pendingClerkId = `${PENDING_PURCHASE_PREFIX.paymentbeta}${email}`
  const tenantId = await createTenantWithProfile(client, { email, name, clerkUserId: pendingClerkId, active: false, input, method: 'invitation' })
  return { tenantId, ownerClerkId: pendingClerkId, method: 'invitation', createdTenant: true, inviteFailed }
}

/**
 * Tenant + profile admin. Campos antigos do tenant ficam como free (plan_tier/
 * max_patients não decidem limite desde a P1: quem decide é a licença).
 */
async function createTenantWithProfile(
  client: PoolClient,
  args: { email: string; name: string; clerkUserId: string; active: boolean; input: ProvisionInput; method: ProvisionedBuyer['method'] },
): Promise<string> {
  const tenant = await client.query(
    `INSERT INTO tenants (
      name, email, clerk_user_id, role,
      trial_start, trial_end, trial_status,
      plan_tier, max_patients, max_sessions, is_admin
    ) VALUES ($1, $2, $3, 'professional', NOW(), NULL, 'active', 'free', 1, 9999, false)
    RETURNING id AS tenant_id`,
    [args.name, args.email, args.clerkUserId],
  )
  const tenantId: string = tenant.rows[0].tenant_id

  await client.query(
    `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, is_active)
     VALUES ($1, $2, 'admin', $3, $4, $5)`,
    [tenantId, args.clerkUserId, args.name, args.email, args.active],
  )

  await client.query(
    `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
     VALUES ($1, $2, 'paymentbeta_webhook', 'AUTO_PROVISION', 'tenant', $3, $4, NOW())`,
    [
      tenantId,
      args.clerkUserId,
      tenantId,
      JSON.stringify({
        tenant_id: tenantId,
        source: 'paymentbeta_auto_provision',
        method: args.method,
        product_type: args.input.productType,
        plan_key: args.input.planKey,
      }),
    ],
  )

  console.log('[PAYMENTBETA PROVISION] Tenant criado:', { tenant_id: tenantId, method: args.method, email: redactEmail(args.email) })
  return tenantId
}

// ─── E-mail pós-compra (mesmos modelos da Hotmart) ───

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

const EMAIL_FROM: Record<ProductType, string> = {
  tcc: env.RESEND_FROM_TCC || 'AXIS TCC <noreply@axisclinico.com>',
  aba: env.RESEND_FROM || 'AXIS ABA <noreply@axisclinico.com>',
  tdah: env.RESEND_FROM_TDAH || 'AXIS TDAH <noreply@axisclinico.com>',
}

const PRODUCT_LABEL: Record<ProductType, string> = {
  tcc: 'AXIS TCC',
  aba: 'AXIS ABA',
  tdah: 'AXIS TDAH',
}

export interface PurchaseEmail {
  to: string
  buyerName: string
  planName: string
  productType: ProductType
  /** Dono ainda pendente (vai receber o convite do Clerk). */
  newUser: boolean
}

/** Não lança: e-mail que falha só vira log. true = enviado. */
export async function sendPurchaseEmail(mail: PurchaseEmail): Promise<boolean> {
  try {
    if (!resend) throw new Error('RESEND_API_KEY ausente')
    const label = PRODUCT_LABEL[mail.productType]
    const sent = await withTimeout(
      resend.emails.send({
        from: EMAIL_FROM[mail.productType],
        to: mail.to,
        subject: mail.newUser ? `Bem-vindo ao ${label}! Ative sua conta` : `Seu plano ${label} foi ativado!`,
        html: mail.newUser
          ? purchaseNewUserTemplate({ buyerName: mail.buyerName, planName: mail.planName, productType: mail.productType })
          : purchaseUpgradeTemplate({ buyerName: mail.buyerName, planName: mail.planName, productType: mail.productType }),
      }),
      EMAIL_TIMEOUT_MS,
      'Resend',
    )
    // O Resend devolve o erro em vez de lançar.
    if (sent?.error) throw new Error(sent.error.message)
    return true
  } catch (err) {
    console.warn('[PAYMENTBETA] E-mail pós-compra falhou (não bloqueia):', redactEmail(mail.to), err instanceof Error ? err.message : 'erro')
    return false
  }
}
