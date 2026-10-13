import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createHmac, randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'

// =====================================================
// AXIS — Pagamento P2 (receptor PaymentBeta)
//
// 1  assinatura (válida, errada, velha, segredo anterior, sem segredo)
// 2  contrato: unsupported_*, payload inválido, duplicate, erro transitório
// 3  cada evento (sale.confirmed, pending, payment_failed, cancelled, reactivated, access_revoked)
// 4  cortesia intocada; Hotmart ativa → PaymentBeta assume com alerta
// 5  os 3 caminhos de tenant (partner_reference, e-mail, comprador novo) + ativação do pendente
// 6  rotina de vencimento
// 7  worker de transcrição
// 8  checkout-link, catálogo com preços, activate-free
//
// Sem banco: um Postgres falso responde pelo texto da SQL e desfaz a
// transação no ROLLBACK (RLS de checkout_intents simulada pelo app.tenant_id).
// =====================================================

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'
const SUB_1 = 'a1a1a1a1-0000-4000-8000-000000000001'
const SUB_2 = 'a2a2a2a2-0000-4000-8000-000000000002'
const REPO_ROOT = join(__dirname, '..', '..')
const DAY = 24 * 60 * 60 * 1000

// ─── Mocks ───

const h = vi.hoisted(() => ({
  env: {
    PAYMENTBETA_WEBHOOK_SECRET: 'segredo-atual',
    PAYMENTBETA_WEBHOOK_SECRET_PREVIOUS: 'segredo-anterior',
    CRON_SECRET: 'cron-secret-de-teste-com-mais-de-32-caracteres',
    NEXT_PUBLIC_APP_URL: 'https://app.test',
    RESEND_API_KEY: 're_teste',
    CLERK_WEBHOOK_SECRET: 'whsec_teste_com_mais_de_20_chars',
  } as Record<string, string | undefined>,
  alerts: [] as Array<{ module: string; severity: string; source: string; code?: string; message: string; context?: any }>,
  emails: [] as Array<{ to: string; subject: string; html: string }>,
  clerkUsers: [] as Array<{ id: string; email: string }>,
  clerk: { down: false, inviteFails: false },
  invitations: [] as Array<Record<string, unknown>>,
  session: { userId: 'user_logado', email: '' as string },
  ctx: { tenant: '11111111-1111-4111-8111-111111111111', role: 'admin' },
}))

vi.mock('@/src/lib/env', () => ({ env: h.env }))

vi.mock('@/src/utils/system-alert', () => ({
  createSystemAlert: vi.fn(async (input: any) => {
    h.alerts.push(input)
  }),
}))

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (mail: { to: string; subject: string; html: string }) => {
        h.emails.push(mail)
        return { data: { id: 'email-1' }, error: null }
      },
    }
  },
}))

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({
    users: {
      getUserList: async ({ emailAddress }: { emailAddress: string[] }) => {
        if (h.clerk.down) throw new Error('Clerk fora do ar')
        return { data: h.clerkUsers.filter((u) => emailAddress.includes(u.email)).map((u) => ({ id: u.id })) }
      },
    },
    invitations: {
      createInvitation: async (input: Record<string, unknown>) => {
        if (h.clerk.inviteFails) throw new Error('convite recusado')
        h.invitations.push(input)
        return {}
      },
    },
  }),
  auth: async () => ({ userId: h.session.userId }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: h.session.email }], fullName: 'Pessoa Teste' }),
}))

vi.mock('svix', () => ({
  Webhook: class {
    verify(body: string) {
      return JSON.parse(body)
    }
  },
}))

vi.mock('@/src/database/with-tenant', () => ({
  withTenant: async (cb: (ctx: any) => Promise<unknown>) => {
    const client = makeClient()
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [h.ctx.tenant])
    try {
      const out = await cb({ tenantId: h.ctx.tenant, userId: 'user_logado', profileId: 'perfil', role: h.ctx.role, planTier: 'free', client })
      await client.query('COMMIT')
      return out
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  },
  TenantSelectionRequired: class TenantSelectionRequired extends Error {},
}))

vi.mock('@/src/database/db', () => ({
  default: {
    query: (sql: string, params?: unknown[]) => runQuery(sql, params ?? []),
    connect: () => Promise.resolve(makeClient()),
  },
}))

import { PLANS, planByEntitlement } from '@/src/billing/plans'
import { isFreeTcc } from '@/src/billing/license-rules'
import { getProductLimit } from '@/src/database/product-limits'
import { buildCheckoutUrl, classifyRevocation, verifyPaymentBetaSignature } from '@/src/billing/paymentbeta-contract'
import { decidePaymentBeta, NO_HISTORY, type PbLicense } from '@/src/billing/paymentbeta-rules'
import { POST as paymentbetaPOST } from '@/app/api/webhook/paymentbeta/route'
import { GET as expireGET } from '@/app/api/cron/expire-licenses/route'
import { POST as checkoutPOST } from '@/app/api/billing/checkout-link/route'
import { POST as clerkPOST } from '@/app/api/webhook/clerk/route'
import { GET as tenantGET } from '@/app/api/user/tenant/route'
import { POST as activateFreePOST } from '@/app/api/user/activate-free/route'

// ─── Postgres falso ───

interface Lic {
  id: string
  tenant_id: string
  clerk_user_id: string
  product_type: string
  is_active: boolean
  valid_from: unknown
  valid_until: unknown
  hotmart_transaction: string | null
  hotmart_event: string | null
  hotmart_offer: string | null
  hotmart_plan: string | null
  plan_key: string | null
  billing_source: string | null
  access_until: Date | null
  paymentbeta_subscription_id: string | null
  buyer_email: string | null
  created_at: number
  updated_at: number
}

interface Db {
  licenses: Lic[]
  tenants: Array<{ id: string; clerk_user_id: string; email: string; name: string; plan_tier: string; max_patients: number }>
  profiles: Array<{ id: string; tenant_id: string; clerk_user_id: string; email: string; is_active: boolean; role: string; name: string }>
  audits: Array<Record<string, any>>
  deliveries: Array<{ delivery_id: string; event: string; event_version: string; tenant_id: string | null; result: string | null }>
  intents: Array<{ partner_reference: string; tenant_id: string; clerk_user_id: string | null; product_type: string; plan_key: string; consumed_at: string | null }>
}

let db: Db
let snapshot: Db | null = null
let guc: string | null = null
let clock = 0
let seq = 0
let failOn: string | null = null
const queries: string[] = []

function emptyDb(): Db {
  return { licenses: [], tenants: [], profiles: [], audits: [], deliveries: [], intents: [] }
}

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

function result(rows: Array<Record<string, unknown>> = [], rowCount = rows.length) {
  return { rows, rowCount }
}

function makeClient() {
  return {
    query: (sql: string, params?: unknown[]) => runQuery(sql, params ?? []),
    release: () => undefined,
  }
}

function parseInsert(sql: string, params: unknown[]): Record<string, unknown> {
  const columns = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map((c) => c.trim())
  const values = sql.slice(sql.indexOf('VALUES (') + 'VALUES ('.length).replace(/\)\s*$/, '')
  const tokens = values.split(',').map((v) => v.trim())
  const row: Record<string, unknown> = {}
  columns.forEach((column, i) => {
    const token = tokens[i]
    const placeholder = /^\$(\d+)$/.exec(token)
    if (placeholder) row[column] = params[Number(placeholder[1]) - 1]
    else if (token?.startsWith("'")) row[column] = token.slice(1, -1)
    else row[column] = token
  })
  return row
}

function newLicense(partial: Partial<Lic> & { tenant_id: string; product_type: string }): Lic {
  return {
    id: randomUUID(),
    clerk_user_id: 'user_dono',
    is_active: true,
    valid_from: '2026-09-01',
    valid_until: null,
    hotmart_transaction: null,
    hotmart_event: null,
    hotmart_offer: null,
    hotmart_plan: null,
    plan_key: null,
    billing_source: null,
    access_until: null,
    paymentbeta_subscription_id: null,
    buyer_email: null,
    created_at: ++clock,
    updated_at: clock,
    ...partial,
  }
}

function seedTenant(id: string, email: string, clerk = 'user_dono') {
  db.tenants.push({ id, clerk_user_id: clerk, email, name: 'Clínica', plan_tier: 'founders', max_patients: 100 })
  db.profiles.push({ id: randomUUID(), tenant_id: id, clerk_user_id: clerk, email, is_active: true, role: 'admin', name: 'Dono' })
}

function seedLicense(partial: Partial<Lic> & { product_type: string }): Lic {
  const lic = newLicense({ tenant_id: TENANT_A, ...partial })
  db.licenses.push(lic)
  return lic
}

async function runQuery(rawSql: string, params: unknown[]) {
  const sql = normalize(rawSql)
  queries.push(sql)
  if (failOn && sql.startsWith(failOn)) throw new Error(`falha simulada em: ${failOn}`)

  if (sql === 'BEGIN') {
    snapshot = structuredClone(db)
    return result()
  }
  if (sql === 'COMMIT') {
    snapshot = null
    guc = null
    return result()
  }
  if (sql === 'ROLLBACK') {
    if (snapshot) db = snapshot
    snapshot = null
    guc = null
    return result()
  }
  if (sql === "SET LOCAL statement_timeout = '5s'") return result()
  if (sql === 'SELECT pg_advisory_xact_lock(hashtext($1))') return result([{}])
  if (sql === "SELECT set_config('app.tenant_id', $1, true)") {
    guc = String(params[0])
    return result([{ set_config: guc }])
  }

  // ── funções SECURITY DEFINER da 081 ──
  if (sql === 'SELECT paymentbeta_delivery_register($1, $2, $3) AS is_new') {
    if (db.deliveries.some((d) => d.delivery_id === params[0])) return result([{ is_new: false }])
    db.deliveries.push({ delivery_id: String(params[0]), event: String(params[1]), event_version: String(params[2]), tenant_id: null, result: null })
    return result([{ is_new: true }])
  }
  if (sql === 'SELECT paymentbeta_delivery_result($1, $2, $3)') {
    const d = db.deliveries.find((x) => x.delivery_id === params[0])
    if (d) Object.assign(d, { result: params[1], tenant_id: params[2] ?? d.tenant_id })
    return result([{ paymentbeta_delivery_result: !!d }])
  }
  if (sql === 'SELECT tenant_id, plan_key FROM checkout_intent_lookup($1)') {
    const i = db.intents.find((x) => x.partner_reference === params[0])
    return result(i ? [{ tenant_id: i.tenant_id, plan_key: i.plan_key }] : [])
  }

  // ── checkout_intents (RLS forçada: só com app.tenant_id) ──
  if (sql.startsWith('UPDATE checkout_intents SET consumed_at = NOW()')) {
    if (!guc) throw new Error('[AXIS RLS] app.tenant_id nao definido na sessao')
    let n = 0
    for (const i of db.intents) {
      if (i.tenant_id === guc && i.partner_reference === params[0] && i.consumed_at === null) {
        i.consumed_at = 'agora'
        n++
      }
    }
    return result([], n)
  }
  if (sql.startsWith('INSERT INTO checkout_intents')) {
    if (!guc || guc !== params[1]) throw new Error('new row violates row-level security policy for table "checkout_intents"')
    db.intents.push({
      partner_reference: String(params[0]), tenant_id: String(params[1]), clerk_user_id: String(params[2]),
      product_type: String(params[3]), plan_key: String(params[4]), consumed_at: null,
    })
    return result([], 1)
  }

  // ── tenant ──
  if (sql === 'SELECT tenant_id FROM user_licenses WHERE paymentbeta_subscription_id = $1 ORDER BY updated_at DESC LIMIT 1') {
    const l = db.licenses.filter((x) => x.paymentbeta_subscription_id === params[0]).sort((a, b) => b.updated_at - a.updated_at)[0]
    return result(l ? [{ tenant_id: l.tenant_id }] : [])
  }
  if (sql.startsWith('SELECT tenant_id, clerk_user_id FROM (') && sql.includes('LOWER(p.email) = $1')) {
    const email = String(params[0])
    const prof = db.profiles.find((p) => p.email.toLowerCase() === email)
    if (prof) {
      const t = db.tenants.find((x) => x.id === prof.tenant_id)!
      return result([{ tenant_id: t.id, clerk_user_id: t.clerk_user_id }])
    }
    const t = db.tenants.find((x) => x.email.toLowerCase() === email)
    if (t) return result([{ tenant_id: t.id, clerk_user_id: t.clerk_user_id }])
    const l = db.licenses.find((x) => (x.buyer_email ?? '').toLowerCase() === email)
    return result(l ? [{ tenant_id: l.tenant_id, clerk_user_id: l.clerk_user_id }] : [])
  }
  if (sql.startsWith('SELECT tenant_id, clerk_user_id FROM (') && sql.includes('p.clerk_user_id = $1')) {
    const prof = db.profiles.find((p) => p.clerk_user_id === params[0])
    const t = prof ? db.tenants.find((x) => x.id === prof.tenant_id) : db.tenants.find((x) => x.clerk_user_id === params[0])
    return result(t ? [{ tenant_id: t.id, clerk_user_id: t.clerk_user_id }] : [])
  }
  if (sql === 'SELECT clerk_user_id FROM tenants WHERE id = $1') {
    const t = db.tenants.find((x) => x.id === params[0])
    return result(t ? [{ clerk_user_id: t.clerk_user_id }] : [])
  }
  if (sql.startsWith('INSERT INTO tenants')) {
    expect(sql).toContain("'free', 1, 9999, false")
    const t = { id: randomUUID(), name: String(params[0]), email: String(params[1]), clerk_user_id: String(params[2]), plan_tier: 'free', max_patients: 1 }
    db.tenants.push(t)
    return result([{ tenant_id: t.id }])
  }
  if (sql.startsWith('INSERT INTO profiles')) {
    db.profiles.push({
      id: randomUUID(), tenant_id: String(params[0]), clerk_user_id: String(params[1]), name: String(params[2]),
      email: String(params[3]), is_active: Boolean(params[4]), role: 'admin',
    })
    return result()
  }

  // ── licenças do receptor ──
  if (sql === 'SELECT id, clerk_user_id, is_active, plan_key, billing_source, access_until, paymentbeta_subscription_id FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 ORDER BY created_at DESC FOR UPDATE') {
    return result(
      db.licenses
        .filter((l) => l.tenant_id === params[0] && l.product_type === params[1])
        .sort((a, b) => b.created_at - a.created_at)
        .map((l) => ({
          id: l.id, clerk_user_id: l.clerk_user_id, is_active: l.is_active, plan_key: l.plan_key,
          billing_source: l.billing_source, access_until: l.access_until, paymentbeta_subscription_id: l.paymentbeta_subscription_id,
        })),
    )
  }
  if (sql.startsWith("SELECT metadata->>'kind' AS kind FROM axis_audit_logs")) {
    expect(sql).toContain("action = 'PAYMENTBETA_SUBSCRIPTION_ACCESS_REVOKED'")
    return result(
      db.audits
        .filter((a) => a.action === 'PAYMENTBETA_SUBSCRIPTION_ACCESS_REVOKED' && a.metadata?.subscription_id === params[0] && a.metadata?.cut === true)
        .map((a) => ({ kind: a.metadata.kind })),
    )
  }
  if (sql.startsWith('UPDATE user_licenses SET is_active = $1, access_until = $2, plan_key = COALESCE($3, plan_key)')) {
    expect(sql).toContain("WHERE id = $7 AND billing_source IS DISTINCT FROM 'cortesia' RETURNING id")
    const [isActive, until, planKey, sub, email, restart, id] = params as any[]
    const l = db.licenses.find((x) => x.id === id)
    if (!l || l.billing_source === 'cortesia') return result([], 0)
    Object.assign(l, {
      is_active: isActive, access_until: until, plan_key: planKey ?? l.plan_key, billing_source: 'paymentbeta',
      paymentbeta_subscription_id: sub, hotmart_plan: null, buyer_email: email ?? l.buyer_email,
      valid_from: restart ? 'hoje' : l.valid_from, valid_until: isActive ? null : 'hoje', updated_at: ++clock,
    })
    return result([{ id: l.id }])
  }
  if (sql.startsWith('INSERT INTO user_licenses') && sql.includes("$5, 'paymentbeta', $6, $7, $8")) {
    expect(sql).toContain('ON CONFLICT ON CONSTRAINT uq_user_product DO NOTHING RETURNING id')
    const [tenantId, clerk, product, isActive, planKey, until, sub, email] = params as any[]
    if (db.licenses.some((l) => l.tenant_id === tenantId && l.clerk_user_id === clerk && l.product_type === product)) return result([], 0)
    const lic = newLicense({
      tenant_id: tenantId, clerk_user_id: clerk, product_type: product, is_active: isActive, valid_from: 'hoje',
      plan_key: planKey, billing_source: 'paymentbeta', access_until: until, paymentbeta_subscription_id: sub, buyer_email: email,
    })
    db.licenses.push(lic)
    return result([{ id: lic.id }])
  }

  // ── rotina de vencimento ──
  if (sql.startsWith("UPDATE user_licenses SET is_active = false, valid_until = NOW(), updated_at = NOW() WHERE billing_source = 'paymentbeta'")) {
    expect(sql).toContain("AND is_active = true AND access_until < NOW() - INTERVAL '2 days'")
    const limit = Date.now() - 2 * DAY
    const rows = db.licenses.filter((l) => l.billing_source === 'paymentbeta' && l.is_active && l.access_until !== null && l.access_until.getTime() < limit)
    for (const l of rows) Object.assign(l, { is_active: false, valid_until: 'hoje', updated_at: ++clock })
    return result(rows.map((l) => ({
      id: l.id, tenant_id: l.tenant_id, clerk_user_id: l.clerk_user_id, product_type: l.product_type,
      plan_key: l.plan_key, access_until: l.access_until, paymentbeta_subscription_id: l.paymentbeta_subscription_id,
    })))
  }

  // ── leitores (worker, limites) ──
  if (sql.startsWith('SELECT id, product_type, plan_key, billing_source, hotmart_plan, hotmart_offer FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1')) {
    const l = db.licenses
      .filter((x) => x.tenant_id === params[0] && x.product_type === params[1] && x.is_active)
      .sort((a, b) => b.created_at - a.created_at)[0]
    return result(l ? [{ id: l.id, product_type: l.product_type, plan_key: l.plan_key, billing_source: l.billing_source, hotmart_plan: l.hotmart_plan, hotmart_offer: l.hotmart_offer }] : [])
  }

  // ── activate-free ──
  if (sql.startsWith('SELECT is_active, hotmart_plan FROM user_licenses WHERE tenant_id = $1 AND product_type = $2')) {
    const l = db.licenses.find((x) => x.tenant_id === params[0] && x.product_type === params[1])
    return result(l ? [{ is_active: l.is_active, hotmart_plan: l.hotmart_plan }] : [])
  }
  if (sql.startsWith('INSERT INTO user_licenses') && sql.includes("'FREE_TIER_ACTIVATION'")) {
    expect(sql).toContain('hotmart_plan = NULL, plan_key = NULL, billing_source = NULL, access_until = NULL')
    expect(sql).toContain('WHERE user_licenses.is_active = false RETURNING id')
    const [tenantId, clerk, product] = params as string[]
    const existing = db.licenses.find((l) => l.tenant_id === tenantId && l.clerk_user_id === clerk && l.product_type === product)
    if (existing) {
      if (existing.is_active) return result([], 0)
      Object.assign(existing, { is_active: true, hotmart_event: 'FREE_TIER_ACTIVATION', hotmart_plan: null, plan_key: null, billing_source: null, access_until: null })
      return result([{ id: existing.id }])
    }
    const lic = newLicense({ tenant_id: tenantId, clerk_user_id: clerk, product_type: product, hotmart_event: 'FREE_TIER_ACTIVATION' })
    db.licenses.push(lic)
    return result([{ id: lic.id }])
  }

  // ── ativação do dono pendente (webhook do Clerk e /api/user/tenant) ──
  if (sql.startsWith('SELECT p.id, p.tenant_id, p.clerk_user_id FROM profiles p WHERE LOWER(p.email) = $1')) {
    return result(db.profiles.filter((p) => p.email.toLowerCase() === params[0] && p.clerk_user_id.startsWith('pending_'))
      .map((p) => ({ id: p.id, tenant_id: p.tenant_id, clerk_user_id: p.clerk_user_id })))
  }
  if (sql.startsWith('SELECT p.id AS profile_id, p.tenant_id, p.role, p.name, p.is_active')) {
    const p = db.profiles.find((x) => x.clerk_user_id === params[0])
    return result(p ? [{ profile_id: p.id, tenant_id: p.tenant_id, role: p.role, name: p.name, is_active: p.is_active, trial_status: 'active', is_admin: false, terms_accepted_at: null }] : [])
  }
  if (sql.startsWith('SELECT p.id AS profile_id, p.tenant_id, p.role, p.name, t.trial_status')) {
    const p = db.profiles.find((x) => x.email === params[0] && !x.is_active && x.clerk_user_id.startsWith('pending_'))
    return result(p ? [{ profile_id: p.id, tenant_id: p.tenant_id, role: p.role, name: p.name, trial_status: 'active', is_admin: false, terms_accepted_at: null }] : [])
  }
  if (sql === 'SELECT clerk_user_id FROM profiles WHERE id = $1') {
    const p = db.profiles.find((x) => x.id === params[0])
    return result(p ? [{ clerk_user_id: p.clerk_user_id }] : [])
  }
  if (sql.startsWith('UPDATE profiles SET clerk_user_id = $1, is_active = true, updated_at = NOW() WHERE tenant_id = $2 AND clerk_user_id = $3')) {
    for (const p of db.profiles) if (p.tenant_id === params[1] && p.clerk_user_id === params[2]) Object.assign(p, { clerk_user_id: params[0], is_active: true })
    return result()
  }
  if (sql.startsWith('UPDATE profiles SET clerk_user_id = $1, is_active = true, updated_at = NOW() WHERE id = $2')) {
    for (const p of db.profiles) if (p.id === params[1]) Object.assign(p, { clerk_user_id: params[0], is_active: true })
    return result()
  }
  if (sql.startsWith('UPDATE tenants SET clerk_user_id = $1, updated_at = NOW() WHERE id = $2 AND clerk_user_id = $3')) {
    for (const t of db.tenants) if (t.id === params[1] && t.clerk_user_id === params[2]) t.clerk_user_id = String(params[0])
    return result()
  }
  if (sql.startsWith('UPDATE user_licenses SET clerk_user_id = $1, updated_at = NOW() WHERE tenant_id = $2 AND clerk_user_id = $3')) {
    for (const l of db.licenses) if (l.tenant_id === params[1] && l.clerk_user_id === params[2]) l.clerk_user_id = String(params[0])
    return result()
  }

  // ── axis_audit_logs ──
  if (sql.startsWith('INSERT INTO axis_audit_logs')) {
    const row = parseInsert(sql, params)
    db.audits.push({ ...row, metadata: JSON.parse(String(row.metadata)) })
    return result()
  }

  throw new Error(`SQL inesperada no teste: ${sql}`)
}

// ─── Helpers ───

type EventName =
  | 'sale.confirmed'
  | 'subscription.pending'
  | 'subscription.payment_failed'
  | 'subscription.cancelled'
  | 'subscription.reactivated'
  | 'subscription.access_revoked'

interface EventOpts {
  code?: string
  subscription?: string | null
  expiresAt?: Date
  email?: string
  partnerReference?: string
  paymentStatus?: string
  deliveryId?: string
  type?: string
  version?: string
}

const inDays = (days: number) => new Date(Date.now() + days * DAY)

function pbEvent(event: EventName, opts: EventOpts = {}) {
  const sub = opts.subscription === undefined ? SUB_1 : opts.subscription
  return {
    event,
    event_version: opts.version ?? '2026-06-10',
    delivery_id: opts.deliveryId ?? randomUUID(),
    occurred_at: new Date().toISOString(),
    transaction_id: randomUUID(),
    asaas_payment_id: 'pay_teste',
    ...(opts.partnerReference ? { partner_reference: opts.partnerReference } : {}),
    entitlement: {
      code: opts.code ?? 'axis-aba-100',
      type: opts.type ?? 'subscription',
      period: 'monthly',
      starts_at: new Date().toISOString(),
      expires_at: (opts.expiresAt ?? inDays(30)).toISOString(),
      ...(sub ? { subscription_id: sub } : {}),
    },
    customer: { email: opts.email ?? 'aaaa@teste.local', name: 'Cliente Teste' },
    payment: { status: opts.paymentStatus ?? 'CONFIRMED', billing_type: 'CREDIT_CARD', value: 99 },
    product: { id: 'prod-pb', unique_code: 'PRODPB', entitlement_code: opts.code ?? 'axis-aba-100' },
    price: null,
  }
}

interface SignOpts {
  secret?: string
  timestamp?: string
  tamper?: boolean
  omitSignature?: boolean
  headerEvent?: string
}

function signedRequest(body: ReturnType<typeof pbEvent> | Record<string, unknown>, opts: SignOpts = {}): any {
  const raw = JSON.stringify(body)
  const ts = opts.timestamp ?? String(Math.floor(Date.now() / 1000))
  const delivery = String((body as any).delivery_id)
  const signature = createHmac('sha256', opts.secret ?? 'segredo-atual').update(`${ts}.${delivery}.${raw}`).digest('hex')
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'PaymentBeta-Webhook/1.0',
    'x-paymentbeta-timestamp': ts,
    'x-paymentbeta-delivery': delivery,
    'x-paymentbeta-event': opts.headerEvent ?? String((body as any).event),
    'x-paymentbeta-version': String((body as any).event_version),
  }
  if (!opts.omitSignature) headers['x-paymentbeta-signature'] = `sha256=${signature}`
  return new Request('https://app.test/api/webhook/paymentbeta', {
    method: 'POST',
    headers,
    body: opts.tamper ? raw.replace('Cliente Teste', 'Cliente Trocado') : raw,
  })
}

async function send(event: EventName, opts: EventOpts = {}, sign: SignOpts = {}) {
  const body = pbEvent(event, opts)
  const res = await paymentbetaPOST(signedRequest(body, sign))
  return { status: res.status, body: await res.json(), deliveryId: body.delivery_id, payload: body }
}

const licensesOf = (tenantId: string, product: string) => db.licenses.filter((l) => l.tenant_id === tenantId && l.product_type === product)
const alertCodes = () => h.alerts.map((a) => a.code)
const nothingWritten = () => {
  expect(db.deliveries).toEqual([])
  expect(db.audits).toEqual([])
}

beforeEach(() => {
  db = emptyDb()
  snapshot = null
  guc = null
  failOn = null
  queries.length = 0
  h.alerts.length = 0
  h.emails.length = 0
  h.clerkUsers.length = 0
  h.invitations.length = 0
  h.clerk.down = false
  h.clerk.inviteFails = false
  h.session.userId = 'user_logado'
  h.session.email = ''
  h.ctx.tenant = TENANT_A
  h.ctx.role = 'admin'
  h.env.PAYMENTBETA_WEBHOOK_SECRET = 'segredo-atual'
  h.env.PAYMENTBETA_WEBHOOK_SECRET_PREVIOUS = 'segredo-anterior'
  for (const key of Object.keys(h.env)) if (key.startsWith('PAYMENTBETA_CHECKOUT')) delete h.env[key]
  seedTenant(TENANT_A, 'aaaa@teste.local')
  seedTenant(TENANT_B, 'bbbb@teste.local', 'user_dono_b')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// =====================================================
// 1. Assinatura
// =====================================================

describe('1. assinatura HMAC', () => {
  test('válida → accepted', async () => {
    const res = await send('sale.confirmed')
    expect(res).toMatchObject({ status: 200, body: { status: 'accepted' } })
    expect(db.deliveries).toHaveLength(1)
  })

  test('errada (corpo mexido depois de assinar, ou outro segredo) → 401, nada gravado', async () => {
    expect((await send('sale.confirmed', {}, { tamper: true })).status).toBe(401)
    expect((await send('sale.confirmed', {}, { secret: 'segredo-de-outro' })).status).toBe(401)
    expect((await send('sale.confirmed', {}, { omitSignature: true })).status).toBe(401)
    nothingWritten()
    expect(licensesOf(TENANT_A, 'aba')).toEqual([])
    expect(alertCodes()).toEqual(['PAYMENTBETA_SIGNATURE_INVALID']) // 1 por hora
  })

  test('velha (timestamp fora de 5 min, para trás ou para frente) → 401, nada gravado', async () => {
    const now = Math.floor(Date.now() / 1000)
    expect((await send('sale.confirmed', {}, { timestamp: String(now - 301) })).status).toBe(401)
    expect((await send('sale.confirmed', {}, { timestamp: String(now + 301) })).status).toBe(401)
    expect((await send('sale.confirmed', {}, { timestamp: String(now - 290) })).status).toBe(200)
    expect(db.deliveries).toHaveLength(1)
  })

  test('segredo anterior também vale (troca de segredo)', async () => {
    expect((await send('sale.confirmed', {}, { secret: 'segredo-anterior' })).body).toEqual({ status: 'accepted' })
    h.env.PAYMENTBETA_WEBHOOK_SECRET_PREVIOUS = undefined
    expect((await send('sale.confirmed', {}, { secret: 'segredo-anterior' })).status).toBe(401)
  })

  test('sem segredo configurado → 503 e nada gravado', async () => {
    h.env.PAYMENTBETA_WEBHOOK_SECRET = undefined
    const res = await send('sale.confirmed')
    expect(res).toMatchObject({ status: 503, body: { status: 'unavailable' } })
    nothingWritten()
  })

  test('função pura: compara em tempo constante e exige sha256=<64 hex>', () => {
    const raw = '{"a":1}'
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = createHmac('sha256', 's1').update(`${ts}.d1.${raw}`).digest('hex')
    const base = { rawBody: raw, timestamp: ts, deliveryId: 'd1', nowSeconds: Number(ts) }
    expect(verifyPaymentBetaSignature({ ...base, signature: `sha256=${sig}`, secrets: ['s1'] })).toBe(true)
    expect(verifyPaymentBetaSignature({ ...base, signature: `sha256=${sig.toUpperCase()}`, secrets: [null, 's1'] })).toBe(true)
    expect(verifyPaymentBetaSignature({ ...base, signature: sig, secrets: ['s1'] })).toBe(false)
    expect(verifyPaymentBetaSignature({ ...base, signature: `sha256=${sig}`, secrets: ['s2', undefined] })).toBe(false)
    expect(verifyPaymentBetaSignature({ ...base, deliveryId: 'd2', signature: `sha256=${sig}`, secrets: ['s1'] })).toBe(false)
  })

  test('rota pública no middleware (quem autentica é a assinatura)', () => {
    expect(readFileSync(join(REPO_ROOT, 'middleware.ts'), 'utf-8')).toContain("'/api/webhook/paymentbeta'")
  })
})

// =====================================================
// 2. Contrato da resposta
// =====================================================

describe('2. contrato: unsupported_*, inválido, duplicate, erro transitório', () => {
  test('event_version diferente → unsupported_version (200, nada gravado)', async () => {
    expect((await send('sale.confirmed', { version: '2027-01-01' })).body).toEqual({ status: 'unsupported_version' })
    nothingWritten()
  })

  test('evento desconhecido → unsupported_event (200, nada gravado)', async () => {
    const body = { ...pbEvent('sale.confirmed'), event: 'subscription.renewed' }
    const res = await paymentbetaPOST(signedRequest(body))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'unsupported_event' })
    nothingWritten()
  })

  test('entitlement.code fora do catálogo → unsupported_entitlement (200, nada gravado)', async () => {
    expect((await send('sale.confirmed', { code: 'abaminds-solo' })).body).toEqual({ status: 'unsupported_entitlement' })
    expect((await send('sale.confirmed', { code: 'axis-aba-999' })).body).toEqual({ status: 'unsupported_entitlement' })
    nothingWritten()
  })

  test('evento nosso malformado → 422 (vitalício, sem expires_at, header ≠ corpo, sem assinatura em evento pós-compra)', async () => {
    expect((await send('sale.confirmed', { type: 'lifetime' })).status).toBe(422)
    const noExpiry = pbEvent('sale.confirmed')
    ;(noExpiry.entitlement as any).expires_at = null
    expect((await paymentbetaPOST(signedRequest(noExpiry))).status).toBe(422)
    expect((await send('sale.confirmed', {}, { headerEvent: 'subscription.cancelled' })).status).toBe(422)
    expect((await send('subscription.cancelled', { subscription: null })).status).toBe(422)
    expect((await send('subscription.access_revoked', { paymentStatus: '' })).status).toBe(422)
    nothingWritten()
  })

  test('delivery_id repetido → duplicate, nada muda', async () => {
    const deliveryId = randomUUID()
    expect((await send('sale.confirmed', { deliveryId })).body).toEqual({ status: 'accepted' })
    const before = structuredClone(db)
    const again = await send('sale.confirmed', { deliveryId, expiresAt: inDays(400), code: 'axis-aba-250' })
    expect(again).toMatchObject({ status: 200, body: { status: 'duplicate' } })
    expect(db).toEqual(before)
  })

  test('erro transitório → 500 e nada fica gravado; a nova tentativa processa', async () => {
    failOn = 'INSERT INTO axis_audit_logs'
    const deliveryId = randomUUID()
    const first = await send('sale.confirmed', { deliveryId })
    expect(first).toMatchObject({ status: 500, body: { status: 'error' } })
    nothingWritten()
    expect(licensesOf(TENANT_A, 'aba')).toEqual([])
    expect(alertCodes()).toContain('PAYMENTBETA_WEBHOOK_ERROR')

    failOn = null
    expect((await send('sale.confirmed', { deliveryId })).body).toEqual({ status: 'accepted' })
    expect(licensesOf(TENANT_A, 'aba')).toHaveLength(1)
  })

  test('cada entrega aceita deixa o resultado e o tenant em paymentbeta_deliveries', async () => {
    const res = await send('sale.confirmed')
    expect(db.deliveries).toEqual([{ delivery_id: res.deliveryId, event: 'sale.confirmed', event_version: '2026-06-10', tenant_id: TENANT_A, result: 'ativada' }])
  })
})

// =====================================================
// 3. Eventos
// =====================================================

describe('3. eventos', () => {
  test('sale.confirmed: ativa com plan_key do entitlement, access_until = expires_at, guarda a assinatura', async () => {
    const expiresAt = inDays(30)
    await send('sale.confirmed', { code: 'axis-aba-250', expiresAt })
    expect(licensesOf(TENANT_A, 'aba')).toEqual([
      expect.objectContaining({
        clerk_user_id: 'user_dono', is_active: true, plan_key: 'aba_250', billing_source: 'paymentbeta',
        access_until: expiresAt, paymentbeta_subscription_id: SUB_1, buyer_email: 'aaaa@teste.local', valid_until: null,
      }),
    ])
    expect((await getProductLimit(makeClient() as any, TENANT_A, 'aba')).maxPatients).toBe(250)
    const audit = db.audits.find((a) => a.action === 'PAYMENTBETA_SALE_CONFIRMED')!
    expect(audit).toMatchObject({ tenant_id: TENANT_A, actor: 'paymentbeta_webhook', entity_type: 'user_licenses' })
    expect(audit.metadata).toMatchObject({ result: 'ativada', resolved_by: 'email', subscription_id: SUB_1, plan_key: 'aba_250' })
    expect(JSON.stringify(audit.metadata)).not.toContain('aaaa@teste.local')
  })

  test('sale.confirmed (renovação): estende; nunca encurta; sem e-mail repetido', async () => {
    await send('sale.confirmed', { expiresAt: inDays(30) })
    expect(h.emails).toHaveLength(1)
    await send('sale.confirmed', { expiresAt: inDays(60) })
    expect(licensesOf(TENANT_A, 'aba')[0].access_until).toEqual(inDaysClose(60))
    await send('sale.confirmed', { expiresAt: inDays(45) })
    expect(licensesOf(TENANT_A, 'aba')[0].access_until).toEqual(inDaysClose(60))
    expect(licensesOf(TENANT_A, 'aba')).toHaveLength(1)
    expect(h.emails).toHaveLength(1)
    expect(db.deliveries.map((d) => d.result)).toEqual(['ativada', 'renovada', 'renovada'])
  })

  test('sale.confirmed com expires_at já vencido → não liga nada', async () => {
    const res = await send('sale.confirmed', { expiresAt: inDays(-1) })
    expect(res.body).toEqual({ status: 'accepted' })
    expect(licensesOf(TENANT_A, 'aba')).toEqual([])
    expect(db.deliveries[0].result).toBe('vencido_na_chegada')
  })

  test('subscription.pending: abre janela provisória; repetida não cresce (MIN); pagamento confirma por cima', async () => {
    const window = inDays(7)
    await send('subscription.pending', { expiresAt: window })
    expect(licensesOf(TENANT_A, 'aba')[0]).toMatchObject({ is_active: true, plan_key: 'aba_100', billing_source: 'paymentbeta', access_until: window })

    await send('subscription.pending', { expiresAt: inDays(14) })
    expect(licensesOf(TENANT_A, 'aba')[0].access_until).toEqual(window)

    await send('sale.confirmed', { expiresAt: inDays(30) })
    expect(licensesOf(TENANT_A, 'aba')[0].access_until).toEqual(inDaysClose(30))

    // pending atrasado (entregue depois do pagamento) não encurta o mês pago
    await send('subscription.pending', { expiresAt: window })
    expect(licensesOf(TENANT_A, 'aba')[0].access_until).toEqual(inDaysClose(30))
    expect(db.deliveries.map((d) => d.result)).toEqual(['pendente_aberta', 'sem_mudanca', 'renovada', 'sem_mudanca'])
  })

  test('subscription.payment_failed: carência até expires_at; reabre só quem venceu junto com o vencimento que falhou', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'paymentbeta', paymentbeta_subscription_id: SUB_1, access_until: inDays(1) })
    await send('subscription.payment_failed', { expiresAt: inDays(4) })
    expect(lic).toMatchObject({ is_active: true, access_until: inDaysClose(4) })

    // venceu ontem (rotina já desligou) → carência religa até expires_at
    Object.assign(lic, { is_active: false, access_until: inDays(-1) })
    await send('subscription.payment_failed', { expiresAt: inDays(2) })
    expect(lic).toMatchObject({ is_active: true, access_until: inDaysClose(2) })

    // venceu há um mês → não reabre
    Object.assign(lic, { is_active: false, access_until: inDays(-30) })
    await send('subscription.payment_failed', { expiresAt: inDays(3) })
    expect(lic).toMatchObject({ is_active: false })
  })

  test('subscription.cancelled: mantém o acesso até expires_at (não corta, nunca encurta)', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'paymentbeta', paymentbeta_subscription_id: SUB_1, access_until: inDays(20) })
    await send('subscription.cancelled', { expiresAt: inDays(20) })
    expect(lic).toMatchObject({ is_active: true, access_until: inDaysClose(20) })
    await send('subscription.cancelled', { expiresAt: inDays(10) })
    expect(lic.access_until).toEqual(inDaysClose(20))
    expect(db.deliveries.map((d) => d.result)).toEqual(['cancelada_mantida', 'cancelada_mantida'])
  })

  test('subscription.reactivated: estende quem está ativo; não religa licença vencida (precisa de pagamento)', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'paymentbeta', paymentbeta_subscription_id: SUB_1, access_until: inDays(5) })
    await send('subscription.reactivated', { expiresAt: inDays(25) })
    expect(lic).toMatchObject({ is_active: true, access_until: inDaysClose(25) })

    Object.assign(lic, { is_active: false, access_until: inDays(-2) })
    await send('subscription.reactivated', { expiresAt: inDays(25) })
    expect(lic.is_active).toBe(false)
  })

  test('subscription.access_revoked (estorno): corta agora', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'paymentbeta', paymentbeta_subscription_id: SUB_1, access_until: inDays(20) })
    const before = Date.now()
    await send('subscription.access_revoked', { expiresAt: inDays(20), paymentStatus: 'REFUNDED' })
    expect(lic.is_active).toBe(false)
    expect(lic.access_until!.getTime()).toBeGreaterThanOrEqual(before)
    expect(lic.access_until!.getTime()).toBeLessThanOrEqual(Date.now())
    expect(lic.valid_until).toBe('hoje')
    expect(db.audits.at(-1)!.metadata).toMatchObject({ kind: 'refund', cut: true, result: 'revogada' })
  })

  test('access_revoked de um mês já superado por outro mês pago não corta', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'paymentbeta', paymentbeta_subscription_id: SUB_1, access_until: inDays(40) })
    await send('subscription.access_revoked', { expiresAt: inDays(10), paymentStatus: 'REFUNDED' })
    expect(lic).toMatchObject({ is_active: true, access_until: inDaysClose(40) })
    expect(db.deliveries[0].result).toBe('estorno_de_periodo_antigo')
  })

  test('chargeback: corta de vez — pagamento seguinte da mesma assinatura não religa (alerta); assinatura nova religa', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'paymentbeta', paymentbeta_subscription_id: SUB_1, access_until: inDays(40) })
    await send('subscription.access_revoked', { expiresAt: inDays(10), paymentStatus: 'CHARGEBACK_REQUESTED' })
    expect(lic.is_active).toBe(false)
    expect(alertCodes()).toContain('PAYMENTBETA_CHARGEBACK')

    await send('sale.confirmed', { expiresAt: inDays(70) })
    await send('subscription.reactivated', { expiresAt: inDays(70) })
    await send('subscription.payment_failed', { expiresAt: inDays(3) })
    expect(lic.is_active).toBe(false)
    expect(alertCodes()).toContain('PAYMENTBETA_CHARGEBACK_BLOCKED')

    await send('sale.confirmed', { subscription: SUB_2, expiresAt: inDays(30) })
    expect(lic).toMatchObject({ is_active: true, paymentbeta_subscription_id: SUB_2, access_until: inDaysClose(30) })
  })

  test('evento pós-compra de assinatura que o AXIS não conhece: aceita, não muda nada (estorno alerta)', async () => {
    seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'paymentbeta', paymentbeta_subscription_id: SUB_1, access_until: inDays(20) })
    expect((await send('subscription.cancelled', { subscription: SUB_2 })).body).toEqual({ status: 'accepted' })
    expect((await send('subscription.access_revoked', { subscription: SUB_2, paymentStatus: 'REFUNDED' })).body).toEqual({ status: 'accepted' })
    expect(licensesOf(TENANT_A, 'aba')[0]).toMatchObject({ is_active: true, access_until: inDaysClose(20) })
    expect(db.deliveries.map((d) => [d.result, d.tenant_id])).toEqual([['assinatura_desconhecida', null], ['assinatura_desconhecida', null]])
    expect(alertCodes()).toEqual(['PAYMENTBETA_UNKNOWN_REVOCATION'])
  })

  test('função pura: MIN da janela provisória e "nunca encurta" sem depender de now()', () => {
    const now = new Date()
    const row: PbLicense = {
      id: 'l1', clerk_user_id: 'u', is_active: true, plan_key: 'aba_100', billing_source: 'paymentbeta',
      access_until: inDays(7), paymentbeta_subscription_id: SUB_1,
    }
    const fact = { event: 'subscription.pending' as const, planKey: 'aba_100' as const, subscriptionId: SUB_1, expiresAt: inDays(9), revokeKind: null }
    expect(decidePaymentBeta(fact, [row], 'u', NO_HISTORY, now)).toMatchObject({ result: 'sem_mudanca', write: null })
    const renewal = decidePaymentBeta({ ...fact, event: 'sale.confirmed', expiresAt: inDays(3) }, [row], 'u', NO_HISTORY, now)
    expect(renewal.write?.access_until).toEqual(row.access_until)
    expect(classifyRevocation('CHARGEBACK_REQUESTED')).toBe('chargeback')
    expect(classifyRevocation('AWAITING_CHARGEBACK_REVERSAL')).toBe('chargeback')
    expect(classifyRevocation('REFUNDED')).toBe('refund')
  })
})

// Data ≈ hoje + N dias (folga de 1 min: o teste recalcula a data em outro instante).
function inDaysClose(days: number): any {
  const target = Date.now() + days * DAY
  return {
    asymmetricMatch: (actual: unknown) => actual instanceof Date && Math.abs(actual.getTime() - target) < 60_000,
    toString: () => `Date ≈ hoje + ${days} dias`,
    toAsymmetricMatcher: () => `Date ≈ hoje + ${days} dias`,
  }
}

// =====================================================
// 4. Cortesia e Hotmart
// =====================================================

describe('4. cortesia intocada; Hotmart → PaymentBeta', () => {
  test('licença cortesia: nenhum evento altera; pagamento gera alerta', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_250', billing_source: 'cortesia', hotmart_plan: 'clinica_250', paymentbeta_subscription_id: SUB_1 })
    const before = structuredClone(lic)
    for (const event of ['sale.confirmed', 'subscription.pending', 'subscription.payment_failed', 'subscription.cancelled', 'subscription.reactivated'] as const) {
      expect((await send(event, { expiresAt: inDays(30) })).body).toEqual({ status: 'accepted' })
    }
    await send('subscription.access_revoked', { paymentStatus: 'CHARGEBACK_REQUESTED' })
    expect(lic).toEqual(before)
    expect(db.deliveries.every((d) => d.result === 'cortesia_intocada')).toBe(true)
    expect(alertCodes()).toEqual(['PAYMENTBETA_CORTESIA_PAID'])
  })

  test('cortesia inativa na linha do dono também não é sobrescrita', async () => {
    const lic = seedLicense({ product_type: 'aba', is_active: false, plan_key: 'aba_100', billing_source: 'cortesia' })
    await send('sale.confirmed')
    expect(lic).toMatchObject({ is_active: false, billing_source: 'cortesia' })
    expect(licensesOf(TENANT_A, 'aba')).toHaveLength(1)
  })

  test('Hotmart ativa no mesmo produto: a compra paga assume a linha e alerta para cancelar a Hotmart', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'hotmart', hotmart_plan: 'AXIS ABA', hotmart_offer: 'u2t04kz5', hotmart_transaction: 'HP123' })
    await send('sale.confirmed', { code: 'axis-aba-250', expiresAt: inDays(30) })
    expect(licensesOf(TENANT_A, 'aba')).toHaveLength(1)
    expect(lic).toMatchObject({
      is_active: true, billing_source: 'paymentbeta', plan_key: 'aba_250', hotmart_plan: null,
      hotmart_transaction: 'HP123', paymentbeta_subscription_id: SUB_1,
    })
    const alert = h.alerts.find((a) => a.code === 'PAYMENTBETA_HOTMART_TAKEOVER')!
    expect(alert.message).toContain('cancelar a Hotmart deste cliente à mão')
    expect(alert.context).toMatchObject({ tenant_id: TENANT_A, product_type: 'aba', license_id: lic.id })
    expect(db.deliveries[0].result).toBe('hotmart_assumida')
  })

  test('Hotmart ativa + pendente (sem pagamento) → não assume', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'hotmart', hotmart_plan: 'AXIS ABA' })
    await send('subscription.pending', { expiresAt: inDays(7) })
    expect(lic).toMatchObject({ billing_source: 'hotmart', hotmart_plan: 'AXIS ABA' })
    expect(db.deliveries[0].result).toBe('ja_tem_acesso')
    expect(h.alerts).toEqual([])
  })

  test('free → pago na mesma linha', async () => {
    const lic = seedLicense({ product_type: 'tdah', hotmart_event: 'FREE_TIER_ACTIVATION' })
    await send('sale.confirmed', { code: 'axis-tdah-50' })
    expect(lic).toMatchObject({ is_active: true, billing_source: 'paymentbeta', plan_key: 'tdah_50' })
    expect((await getProductLimit(makeClient() as any, TENANT_A, 'tdah')).maxPatients).toBe(50)
  })
})

// =====================================================
// 5. Caminhos do tenant
// =====================================================

describe('5. os 3 caminhos de tenant', () => {
  test('1º partner_reference → tenant do checkout (mesmo com e-mail de outro tenant) e consumed_at marcado com RLS', async () => {
    const ref = randomUUID()
    db.intents.push({ partner_reference: ref, tenant_id: TENANT_A, clerk_user_id: 'user_dono', product_type: 'aba', plan_key: 'aba_100', consumed_at: null })
    await send('sale.confirmed', { partnerReference: ref, email: 'bbbb@teste.local' })
    expect(licensesOf(TENANT_A, 'aba')).toHaveLength(1)
    expect(licensesOf(TENANT_B, 'aba')).toEqual([])
    expect(db.intents[0].consumed_at).toBe('agora')
    expect(db.audits.at(-1)!.metadata).toMatchObject({ resolved_by: 'partner_reference', intent_plan_key: 'aba_100' })
  })

  test('partner_reference desconhecido → segue pelo e-mail', async () => {
    await send('sale.confirmed', { partnerReference: randomUUID(), email: 'bbbb@teste.local' })
    expect(licensesOf(TENANT_B, 'aba')).toHaveLength(1)
  })

  test('2º e-mail → mesma busca de 3 fontes da Hotmart (profiles, tenants, buyer_email)', async () => {
    db.licenses.push(newLicense({ tenant_id: TENANT_B, clerk_user_id: 'user_dono_b', product_type: 'tcc', buyer_email: 'compras@clinica-b.local' }))
    await send('sale.confirmed', { code: 'axis-tcc-100', email: 'Compras@Clinica-B.local' })
    expect(licensesOf(TENANT_B, 'tcc')[0]).toMatchObject({ plan_key: 'tcc_100', billing_source: 'paymentbeta' })
    expect(db.audits.at(-1)!.metadata.resolved_by).toBe('email')
  })

  test('renovação acha o tenant pela assinatura (sem partner_reference, e-mail trocado)', async () => {
    seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'paymentbeta', paymentbeta_subscription_id: SUB_1, access_until: inDays(3) })
    await send('sale.confirmed', { email: 'outro-email@teste.local', expiresAt: inDays(33) })
    expect(licensesOf(TENANT_A, 'aba')[0].access_until).toEqual(inDaysClose(33))
    expect(h.invitations).toEqual([])
  })

  test('evento pós-compra nunca acha tenant por e-mail', async () => {
    const res = await send('subscription.cancelled', { email: 'aaaa@teste.local' })
    expect(res.body).toEqual({ status: 'accepted' })
    expect(db.deliveries[0]).toMatchObject({ result: 'assinatura_desconhecida', tenant_id: null })
  })

  test('3º comprador novo sem conta: convite do Clerk + tenant + profile pendente + licença; e-mail de boas-vindas', async () => {
    await send('sale.confirmed', { email: 'nova@clinica.local', code: 'axis-aba-50' })
    const tenant = db.tenants.find((t) => t.email === 'nova@clinica.local')!
    expect(tenant).toMatchObject({ clerk_user_id: 'pending_paymentbeta_nova@clinica.local', plan_tier: 'free' })
    expect(db.profiles.find((p) => p.tenant_id === tenant.id)).toMatchObject({ is_active: false, role: 'admin', clerk_user_id: 'pending_paymentbeta_nova@clinica.local' })
    expect(licensesOf(tenant.id, 'aba')).toEqual([
      expect.objectContaining({ clerk_user_id: 'pending_paymentbeta_nova@clinica.local', plan_key: 'aba_50', billing_source: 'paymentbeta', is_active: true }),
    ])
    expect(h.invitations).toEqual([
      expect.objectContaining({ emailAddress: 'nova@clinica.local', redirectUrl: 'https://app.test/aba/dashboard', ignoreExisting: true }),
    ])
    expect(h.emails).toEqual([expect.objectContaining({ to: 'nova@clinica.local', subject: 'Bem-vindo ao AXIS ABA! Ative sua conta' })])
    expect(h.emails[0].html).toContain('ABA 50')
    expect(db.audits.map((a) => a.action)).toEqual(['AUTO_PROVISION', 'PAYMENTBETA_SALE_CONFIRMED'])
  })

  test('comprador novo com conta no Clerk e sem tenant: tenant + profile ativo; e-mail de plano ativado', async () => {
    h.clerkUsers.push({ id: 'user_clerk_novo', email: 'tem-conta@clinica.local' })
    await send('subscription.pending', { email: 'tem-conta@clinica.local', expiresAt: inDays(7) })
    const tenant = db.tenants.find((t) => t.email === 'tem-conta@clinica.local')!
    expect(tenant.clerk_user_id).toBe('user_clerk_novo')
    expect(db.profiles.find((p) => p.tenant_id === tenant.id)!.is_active).toBe(true)
    expect(licensesOf(tenant.id, 'aba')[0]).toMatchObject({ clerk_user_id: 'user_clerk_novo', access_until: inDaysClose(7) })
    expect(h.invitations).toEqual([])
    expect(h.emails[0].subject).toBe('Seu plano AXIS ABA foi ativado!')
  })

  test('Clerk fora do ar → 500 e nada gravado (não cria tenant às cegas)', async () => {
    h.clerk.down = true
    const res = await send('sale.confirmed', { email: 'nova@clinica.local' })
    expect(res.status).toBe(500)
    expect(db.tenants).toHaveLength(2)
    expect(db.deliveries).toEqual([])
  })

  test('convite do Clerk falha → licença sai mesmo assim e alerta para reenviar', async () => {
    h.clerk.inviteFails = true
    expect((await send('sale.confirmed', { email: 'nova@clinica.local' })).body).toEqual({ status: 'accepted' })
    expect(db.tenants.some((t) => t.email === 'nova@clinica.local')).toBe(true)
    expect(alertCodes()).toEqual(['PAYMENTBETA_INVITE_FAILED'])
  })

  test('pendente do PaymentBeta é ativado no 1º login: webhook do Clerk troca o id em profile, tenant e licença', async () => {
    await send('sale.confirmed', { email: 'nova@clinica.local' })
    const res = await clerkPOST(new Request('https://app.test/api/webhook/clerk', {
      method: 'POST',
      headers: { 'svix-id': 'x', 'svix-timestamp': '1', 'svix-signature': 'v1,x' },
      body: JSON.stringify({ type: 'user.created', data: { id: 'user_real', email_addresses: [{ email_address: 'nova@clinica.local' }] } }),
    }) as any)
    expect(res.status).toBe(200)
    const tenant = db.tenants.find((t) => t.email === 'nova@clinica.local')!
    expect(tenant.clerk_user_id).toBe('user_real')
    expect(db.profiles.find((p) => p.tenant_id === tenant.id)).toMatchObject({ clerk_user_id: 'user_real', is_active: true })
    expect(licensesOf(tenant.id, 'aba')[0].clerk_user_id).toBe('user_real')
    expect(db.audits.at(-1)).toMatchObject({ action: 'PENDING_PROFILE_ACTIVATED' })
    expect(db.audits.at(-1)!.metadata.type).toBe('paymentbeta_purchase')
  })

  test('…ou pelo /api/user/tenant, se ele chegar antes do webhook do Clerk', async () => {
    await send('sale.confirmed', { email: 'nova@clinica.local', code: 'axis-tdah-100' })
    h.session.userId = 'user_real_2'
    h.session.email = 'nova@clinica.local'
    const res = await tenantGET()
    expect(res.status).toBe(200)
    const tenant = db.tenants.find((t) => t.email === 'nova@clinica.local')!
    expect(tenant.clerk_user_id).toBe('user_real_2')
    expect(licensesOf(tenant.id, 'tdah')[0].clerk_user_id).toBe('user_real_2')
    expect(db.audits.at(-1)!.metadata.type).toBe('paymentbeta_purchase')
  })
})

// =====================================================
// 6. Rotina de vencimento
// =====================================================

describe('6. rotina /api/cron/expire-licenses', () => {
  const cron = (auth?: string) =>
    expireGET(new Request('https://app.test/api/cron/expire-licenses', { headers: auth ? { authorization: auth } : {} }) as any)

  test('desliga só PaymentBeta vencida há mais de 2 dias (tolerância); registra no audit', async () => {
    const vencida = seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'paymentbeta', access_until: inDays(-2.01) })
    const vigente = seedLicense({ product_type: 'tdah', plan_key: 'tdah_100', billing_source: 'paymentbeta', access_until: inDays(3) })
    const naTolerancia = seedLicense({ tenant_id: TENANT_B, product_type: 'tdah', plan_key: 'tdah_50', billing_source: 'paymentbeta', access_until: inDays(-1.9) })
    const hotmart = seedLicense({ product_type: 'tcc', plan_key: 'tcc_100', billing_source: 'hotmart', hotmart_plan: 'AXIS TCC' })
    const cortesia = seedLicense({ tenant_id: TENANT_B, product_type: 'aba', plan_key: 'aba_250', billing_source: 'cortesia' })

    const res = await cron(`Bearer ${h.env.CRON_SECRET}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, expired: 1 })
    expect(vencida).toMatchObject({ is_active: false, valid_until: 'hoje' })
    expect([vigente.is_active, naTolerancia.is_active, hotmart.is_active, cortesia.is_active]).toEqual([true, true, true, true])
    expect(db.audits).toEqual([expect.objectContaining({ action: 'PAYMENTBETA_LICENSE_EXPIRED', actor: 'cron_expire_licenses', entity_id: vencida.id })])
  })

  test('sem CRON_SECRET certo → 401', async () => {
    expect((await cron()).status).toBe(401)
    expect((await cron('Bearer errado')).status).toBe(401)
  })
})

// =====================================================
// 7. Worker de transcrição
// =====================================================

describe('7. worker decide pago/grátis pela plan_key', () => {
  test('usa a regra de src/billing/license-rules.ts (sem hotmart_plan) e não carrega o pool do app', () => {
    const worker = readFileSync(join(REPO_ROOT, 'scripts', 'workers', 'transcription-worker.ts'), 'utf-8')
    expect(worker).toContain("import { isFreeTcc } from '../../src/billing/license-rules'")
    expect(worker).toContain('const isFree = await isFreeTcc(client, job.tenant_id)')
    expect(worker).not.toMatch(/SELECT hotmart_plan/)
    const rules = readFileSync(join(REPO_ROOT, 'src', 'billing', 'license-rules.ts'), 'utf-8')
    expect(rules).not.toMatch(/from '@\//)
  })

  test('cliente PaymentBeta (sem hotmart_plan) não é grátis', async () => {
    const client = makeClient() as any
    expect(await isFreeTcc(client, TENANT_A)).toBe(true)
    const lic = seedLicense({ product_type: 'tcc', hotmart_event: 'FREE_TIER_ACTIVATION' })
    expect(await isFreeTcc(client, TENANT_A)).toBe(true)
    Object.assign(lic, { plan_key: 'tcc_50', billing_source: 'paymentbeta', access_until: inDays(30) })
    expect(await isFreeTcc(client, TENANT_A)).toBe(false)
  })
})

// =====================================================
// 8. Checkout, catálogo e activate-free
// =====================================================

describe('8. checkout-link, preços e activate-free', () => {
  const checkout = (body: unknown) =>
    checkoutPOST(new Request('https://app.test/api/billing/checkout-link', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as any)

  test('sem códigos do PaymentBeta → 503 "checkout indisponível" e nenhuma intenção gravada', async () => {
    const res = await checkout({ plan_key: 'aba_100' })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'checkout indisponível' })
    expect(db.intents).toEqual([])
  })

  test('com códigos → URL do checkout com partner_reference (UUID v4) e intenção no tenant', async () => {
    h.env.PAYMENTBETA_CHECKOUT_ABA_100 = 'PRODABA1:PRECOABA1'
    const res = await checkout({ plan_key: 'aba_100' })
    expect(res.status).toBe(200)
    const url = new URL((await res.json()).url)
    expect(`${url.origin}${url.pathname}`).toBe('https://payment.eng.br/checkout')
    expect(url.searchParams.get('product')).toBe('PRODABA1')
    expect(url.searchParams.get('price')).toBe('PRECOABA1')
    const ref = url.searchParams.get('partner_reference')!
    expect(ref).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(db.intents).toEqual([{ partner_reference: ref, tenant_id: TENANT_A, clerk_user_id: 'user_logado', product_type: 'aba', plan_key: 'aba_100', consumed_at: null }])
    expect(url.search).not.toContain('@')
  })

  test('plan_key inválida → 400; quem não é admin → 403', async () => {
    h.env.PAYMENTBETA_CHECKOUT_ABA_100 = 'PRODABA1:PRECOABA1'
    expect((await checkout({ plan_key: 'founders' })).status).toBe(400)
    expect((await checkout({})).status).toBe(400)
    h.ctx.role = 'terapeuta'
    expect((await checkout({ plan_key: 'aba_100' })).status).toBe(403)
    expect(db.intents).toEqual([])
  })

  test('configuração malformada → sem link', () => {
    expect(buildCheckoutUrl('aba_100', 'r', { PAYMENTBETA_CHECKOUT_ABA_100: 'SEMPRECO' })).toBeNull()
    expect(buildCheckoutUrl('aba_100', 'r', { PAYMENTBETA_CHECKOUT_ABA_100: 'A:B:C' })).toBeNull()
    expect(buildCheckoutUrl('aba_100', 'r', { PAYMENTBETA_CHECKOUT_ABA_100: 'A:B', PAYMENTBETA_CHECKOUT_URL: 'http://inseguro.test' })).toBeNull()
    expect(buildCheckoutUrl('aba_100', 'r', { PAYMENTBETA_CHECKOUT_ABA_100: 'A:B', PAYMENTBETA_CHECKOUT_URL: 'https://outro.test/c' })).toBe('https://outro.test/c?product=A&price=B&partner_reference=r')
  })

  test('preços do catálogo: ABA 59/99/179, TDAH 49/79/149, TCC 29/49', () => {
    expect(Object.values(PLANS).map((p) => `${p.key}=${p.priceBRL}`)).toEqual([
      'aba_50=59', 'aba_100=99', 'aba_250=179',
      'tdah_50=49', 'tdah_100=79', 'tdah_250=149',
      'tcc_50=29', 'tcc_100=49',
    ])
    expect(PLANS.aba_100.priceLabel).toBe('R$ 99')
    expect(planByEntitlement('axis-tdah-250')?.key).toBe('tdah_250')
    expect(planByEntitlement('axis-tcc-250')).toBeNull()
  })

  test('activate-free em licença PaymentBeta vencida volta como FREE (não religa o plano pago de graça)', async () => {
    seedLicense({ clerk_user_id: 'user_logado', product_type: 'aba', is_active: false, plan_key: 'aba_250', billing_source: 'paymentbeta', access_until: inDays(-2), paymentbeta_subscription_id: SUB_1 })
    const res = await activateFreePOST(new Request('https://app.test/api/user/activate-free', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_type: 'aba' }),
    }) as any)
    expect(res.status).toBe(201)
    expect(licensesOf(TENANT_A, 'aba')[0]).toMatchObject({ is_active: true, plan_key: null, billing_source: null, access_until: null })
    expect((await getProductLimit(makeClient() as any, TENANT_A, 'aba')).maxPatients).toBe(1)
  })
})
