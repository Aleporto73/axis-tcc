import { describe, test, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// =====================================================
// AXIS — Pagamento P1 (plano "plano-pagamento-paymentbeta")
//
// 1  catálogo único (src/billing/plans.ts)
// 2  mapa do backfill (mesmas regras na 081 e em src/billing/license.ts)
// 3  leitores decidem por plan_key (limite, transcrição, análise, /api/user/licenses)
// 4  fallback: plan_key nula + hotmart_plan → regra do backfill + alerta
// 5  Hotmart não sobrescreve nem desativa cortesia/paymentbeta
// 6  alerta só em compra NOVA de TCC (não em renovação)
// 7  admin grava a chave equivalente como cortesia
// 8  contrato estático da migration 081
//
// Sem banco: um Postgres falso responde pelo texto da SQL e desfaz a
// transação no ROLLBACK.
// =====================================================

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'
const HOTTOK = 'hottok-teste'
const REPO_ROOT = join(__dirname, '..', '..')
const MIGRATIONS_DIR = join(REPO_ROOT, 'scripts', 'migrations')

// ─── Mocks ───

const alerts: Array<{ module: string; severity: string; source: string; code?: string; message: string; context?: any }> = []
vi.mock('@/src/utils/system-alert', () => ({
  createSystemAlert: vi.fn(async (input: any) => {
    alerts.push(input)
  }),
}))

vi.mock('@/src/lib/env', () => ({
  env: { HOTMART_HOTTOK: 'hottok-teste', NEXT_PUBLIC_APP_URL: 'https://app.test' },
}))

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const clerkUsers: Array<{ id: string; email: string }> = []
const mockCreateInvitation = vi.fn(async () => ({}))
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({
    users: {
      getUserList: async ({ emailAddress }: { emailAddress: string[] }) => ({
        data: clerkUsers.filter((u) => emailAddress.includes(u.email)).map((u) => ({ id: u.id })),
      }),
    },
    invitations: { createInvitation: mockCreateInvitation },
  }),
  auth: async () => ({ userId: 'user_logado' }),
  currentUser: async () => null,
}))

vi.mock('@/app/api/admin/guard', () => ({
  verifyAdmin: async () => ({ authorized: true, userId: 'admin_teste', email: 'admin@teste.local' }),
}))

let ctxTenant = TENANT_A
vi.mock('@/src/database/with-tenant', () => ({
  withTenant: async (cb: (ctx: any) => Promise<unknown>) =>
    cb({ tenantId: ctxTenant, userId: 'user_logado', profileId: 'perfil', role: 'admin', planTier: 'free', client: makeClient() }),
  TenantSelectionRequired: class TenantSelectionRequired extends Error {},
}))

vi.mock('@/src/database/db', () => ({
  default: {
    query: (sql: string, params?: unknown[]) => runQuery(sql, params ?? []),
    connect: () => Promise.resolve(makeClient()),
  },
}))

import { PLANS, plansForSale, getPlan, isPlanValidFor } from '@/src/billing/plans'
import {
  adminPlanKey,
  legacyBillingSource,
  legacyPlanKey,
  resetLicenseAlertThrottle,
  resolveLicense,
} from '@/src/billing/license'
import { getProductLimit } from '@/src/database/product-limits'
import { getTranscriptionUsage, FREE_LIMIT_MINUTES } from '@/src/services/transcription-limit'
import { getAnalyzeUsage, FREE_LIMIT_REQUESTS } from '@/src/services/analyze-limit'
import { POST as hotmartPOST } from '@/app/api/webhook/hotmart/route'
import { GET as licensesGET } from '@/app/api/user/licenses/route'
import { POST as activateFreePOST } from '@/app/api/user/activate-free/route'
import { PATCH as adminPATCH } from '@/app/api/admin/users/[id]/route'

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
  buyer_email: string | null
  created_at: number
}

interface Ten {
  id: string
  clerk_user_id: string
  email: string
  plan_tier: string
  max_patients: number
  trial_status: string
}

interface Db {
  licenses: Lic[]
  tenants: Ten[]
  profiles: Array<{ tenant_id: string; clerk_user_id: string; email: string; is_active: boolean }>
  audits: Array<Record<string, any>>
}

let db: Db
let snapshot: Db | null = null
let clock = 0
let seq = 0
let transcriptionMinutes = 0
let analyzeRequests = 0

function emptyDb(): Db {
  return { licenses: [], tenants: [], profiles: [], audits: [] }
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
    id: `lic-${++seq}`,
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
    buyer_email: null,
    created_at: ++clock,
    ...partial,
  }
}

function seedTenant(id: string, partial: Partial<Ten> = {}): Ten {
  const t: Ten = {
    id,
    clerk_user_id: 'user_dono',
    email: `${id.slice(0, 4)}@teste.local`,
    plan_tier: 'founders',
    max_patients: 100,
    trial_status: 'active',
    ...partial,
  }
  db.tenants.push(t)
  db.profiles.push({ tenant_id: id, clerk_user_id: t.clerk_user_id, email: t.email, is_active: true })
  return t
}

function seedLicense(partial: Partial<Lic> & { product_type: string }): Lic {
  const lic = newLicense({ tenant_id: TENANT_A, ...partial })
  db.licenses.push(lic)
  return lic
}

const pick = (l: Lic, cols: string[]) => Object.fromEntries(cols.map((c) => [c, (l as any)[c]]))

async function runQuery(rawSql: string, params: unknown[]) {
  const sql = normalize(rawSql)

  if (sql === 'BEGIN') {
    snapshot = structuredClone(db)
    return result()
  }
  if (sql === 'COMMIT') {
    snapshot = null
    return result()
  }
  if (sql === 'ROLLBACK') {
    if (snapshot) db = snapshot
    snapshot = null
    return result()
  }

  // ── receptor Hotmart: tenant pelo e-mail do comprador ──
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
  // ── provisionamento: tenant pelo id do Clerk ──
  if (sql.startsWith('SELECT tenant_id, clerk_user_id FROM (') && sql.includes('p.clerk_user_id = $1')) {
    const prof = db.profiles.find((p) => p.clerk_user_id === params[0])
    const t = prof ? db.tenants.find((x) => x.id === prof.tenant_id) : db.tenants.find((x) => x.clerk_user_id === params[0])
    return result(t ? [{ tenant_id: t.id, clerk_user_id: t.clerk_user_id }] : [])
  }
  if (sql.startsWith('SELECT id FROM user_licenses WHERE tenant_id = $1 AND hotmart_transaction = $2')) {
    return result(db.licenses.filter((l) => l.tenant_id === params[0] && l.hotmart_transaction === params[1]).map((l) => ({ id: l.id })))
  }
  if (sql.startsWith('INSERT INTO tenants')) {
    const t: Ten = {
      id: `ten-${++seq}`,
      clerk_user_id: String(params[2]),
      email: String(params[1]),
      plan_tier: String(params[4]),
      max_patients: Number(params[5]),
      trial_status: 'active',
    }
    db.tenants.push(t)
    return result([{ tenant_id: t.id }])
  }
  if (sql.startsWith('INSERT INTO profiles')) {
    db.profiles.push({ tenant_id: String(params[0]), clerk_user_id: String(params[1]), email: String(params[3]), is_active: Boolean(params[4]) })
    return result()
  }
  if (sql.startsWith("UPDATE tenants SET plan_tier = $1, max_patients = $2, trial_status = 'active'")) {
    const t = db.tenants.find((x) => x.id === params[2])
    if (t) Object.assign(t, { plan_tier: params[0], max_patients: params[1], trial_status: 'active' })
    return result([], t ? 1 : 0)
  }
  if (sql.startsWith("UPDATE tenants SET plan_tier = 'free', max_patients = 1")) {
    const t = db.tenants.find((x) => x.id === params[0])
    if (t) Object.assign(t, { plan_tier: 'free', max_patients: 1 })
    return result([], t ? 1 : 0)
  }
  if (sql.startsWith('UPDATE tenants SET plan_tier = $1, max_patients = $2, updated_at = NOW() WHERE id = $3')) {
    const t = db.tenants.find((x) => x.id === params[2])
    if (t) Object.assign(t, { plan_tier: params[0], max_patients: params[1] })
    return result([], t ? 1 : 0)
  }

  // ── user_licenses: licenças do produto com lock (antes da ativação Hotmart) ──
  if (sql.startsWith('SELECT id, clerk_user_id, is_active, product_type, plan_key, billing_source, hotmart_plan, hotmart_offer FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 FOR UPDATE')) {
    return result(
      db.licenses
        .filter((l) => l.tenant_id === params[0] && l.product_type === params[1])
        .map((l) => pick(l, ['id', 'clerk_user_id', 'is_active', 'product_type', 'plan_key', 'billing_source', 'hotmart_plan', 'hotmart_offer'])),
    )
  }
  // ── UPSERT da ativação Hotmart (com trava de cortesia/paymentbeta) ──
  if (sql.startsWith('INSERT INTO user_licenses') && sql.includes("$9, 'hotmart', $10")) {
    const [tenantId, clerk, product, validFrom, tx, event, offer, plan, planKey, email] = params as any[]
    const existing = db.licenses.find((l) => l.tenant_id === tenantId && l.clerk_user_id === clerk && l.product_type === product)
    if (existing) {
      expect(sql).toContain("WHERE user_licenses.billing_source IS NULL OR user_licenses.billing_source = 'hotmart'")
      if (!(existing.billing_source === null || existing.billing_source === 'hotmart')) return result([], 0)
      Object.assign(existing, {
        is_active: true, hotmart_transaction: tx, hotmart_event: event, hotmart_offer: offer, hotmart_plan: plan,
        plan_key: planKey, billing_source: 'hotmart', buyer_email: email,
      })
      if (sql.includes('valid_from = EXCLUDED.valid_from')) Object.assign(existing, { valid_from: validFrom, valid_until: null })
      return result([{ id: existing.id }])
    }
    const lic = newLicense({
      tenant_id: tenantId, clerk_user_id: clerk, product_type: product, valid_from: validFrom,
      hotmart_transaction: tx, hotmart_event: event, hotmart_offer: offer, hotmart_plan: plan,
      plan_key: planKey, billing_source: 'hotmart', buyer_email: email,
    })
    db.licenses.push(lic)
    return result([{ id: lic.id }])
  }
  // ── desativação Hotmart (não pega cortesia/paymentbeta) ──
  if (sql.startsWith('UPDATE user_licenses SET is_active = false, valid_until = NOW(), hotmart_event = $1')) {
    expect(sql).toContain("AND (billing_source IS NULL OR billing_source = 'hotmart')")
    let n = 0
    for (const l of db.licenses) {
      if (l.tenant_id === params[1] && l.product_type === params[2] && l.is_active && (l.billing_source === null || l.billing_source === 'hotmart')) {
        Object.assign(l, { is_active: false, valid_until: 'hoje', hotmart_event: params[0] })
        n++
      }
    }
    return result([], n)
  }
  if (sql.startsWith('SELECT billing_source FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 AND is_active = true')) {
    return result(
      db.licenses
        .filter((l) => l.tenant_id === params[0] && l.product_type === params[1] && l.is_active && ['cortesia', 'paymentbeta'].includes(l.billing_source ?? ''))
        .map((l) => ({ billing_source: l.billing_source })),
    )
  }

  // ── leitores ──
  if (sql.startsWith('SELECT id, product_type, plan_key, billing_source, hotmart_plan, hotmart_offer FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1')) {
    const rows = db.licenses
      .filter((l) => l.tenant_id === params[0] && l.product_type === params[1] && l.is_active)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 1)
      .map((l) => pick(l, ['id', 'product_type', 'plan_key', 'billing_source', 'hotmart_plan', 'hotmart_offer']))
    return result(rows)
  }
  if (sql.startsWith('SELECT id, product_type, is_active, valid_from, valid_until, plan_key, billing_source, hotmart_plan, hotmart_offer FROM user_licenses WHERE tenant_id = $1 AND is_active = true')) {
    return result(
      db.licenses
        .filter((l) => l.tenant_id === params[0] && l.is_active && l.valid_until === null)
        .sort((a, b) => a.product_type.localeCompare(b.product_type))
        .map((l) => pick(l, ['id', 'product_type', 'is_active', 'valid_from', 'valid_until', 'plan_key', 'billing_source', 'hotmart_plan', 'hotmart_offer'])),
    )
  }
  if (sql.startsWith('SELECT COALESCE(SUM(minutes_used), 0)::int AS total FROM transcription_usage')) {
    return result([{ total: transcriptionMinutes }])
  }
  if (sql.startsWith('SELECT COUNT(*)::int AS total FROM analyze_usage')) {
    return result([{ total: analyzeRequests }])
  }

  // ── activate-free ──
  if (sql.startsWith('SELECT is_active, hotmart_plan FROM user_licenses WHERE tenant_id = $1 AND product_type = $2')) {
    const l = db.licenses.find((x) => x.tenant_id === params[0] && x.product_type === params[1])
    return result(l ? [{ is_active: l.is_active, hotmart_plan: l.hotmart_plan }] : [])
  }
  if (sql.startsWith('INSERT INTO user_licenses') && sql.includes("'FREE_TIER_ACTIVATION'")) {
    expect(sql).toContain('plan_key, billing_source')
    expect(sql).toContain('WHERE user_licenses.is_active = false RETURNING id')
    const [tenantId, clerk, product] = params as string[]
    const existing = db.licenses.find((l) => l.tenant_id === tenantId && l.clerk_user_id === clerk && l.product_type === product)
    if (existing) {
      if (existing.is_active) return result([], 0)
      Object.assign(existing, { is_active: true, hotmart_event: 'FREE_TIER_ACTIVATION', hotmart_plan: null, plan_key: null, billing_source: null })
      return result([{ id: existing.id }])
    }
    const lic = newLicense({ tenant_id: tenantId, clerk_user_id: clerk, product_type: product, hotmart_event: 'FREE_TIER_ACTIVATION' })
    db.licenses.push(lic)
    return result([{ id: lic.id }])
  }

  // ── admin ──
  if (sql.startsWith('SELECT clerk_user_id FROM tenants WHERE id = $1')) {
    const t = db.tenants.find((x) => x.id === params[0])
    return result(t ? [{ clerk_user_id: t.clerk_user_id }] : [])
  }
  if (sql.startsWith('SELECT product_type FROM user_licenses WHERE id = $1 AND tenant_id = $2')) {
    const l = db.licenses.find((x) => x.id === params[0] && x.tenant_id === params[1])
    return result(l ? [{ product_type: l.product_type }] : [])
  }
  if (sql.startsWith('UPDATE user_licenses SET is_active = COALESCE($1, is_active), hotmart_plan = COALESCE($2, hotmart_plan)')) {
    const [isActive, hotmartPlan, id, tenantId, writesPlan, planKey, billingSource] = params as any[]
    const l = db.licenses.find((x) => x.id === id && x.tenant_id === tenantId)
    if (l) {
      if (isActive !== null && isActive !== undefined) l.is_active = isActive
      if (hotmartPlan !== null && hotmartPlan !== undefined) l.hotmart_plan = hotmartPlan
      if (writesPlan) Object.assign(l, { plan_key: planKey, billing_source: billingSource })
    }
    return result([], l ? 1 : 0)
  }
  if (sql.startsWith('INSERT INTO user_licenses') && sql.includes("'ADMIN_MANUAL_UPGRADE'")) {
    const [tenantId, clerk, product, tier, planKey] = params as string[]
    const existing = db.licenses.find((l) => l.tenant_id === tenantId && l.clerk_user_id === clerk && l.product_type === product)
    const fields = { is_active: true, hotmart_plan: tier, hotmart_event: 'ADMIN_MANUAL_UPGRADE', plan_key: planKey, billing_source: 'cortesia' }
    if (existing) Object.assign(existing, fields)
    else db.licenses.push(newLicense({ tenant_id: tenantId, clerk_user_id: clerk, product_type: product, ...fields }))
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

// ─── Helpers de requisição ───

function hotmartRequest(body: unknown): any {
  return new Request('https://app.test/api/webhook/hotmart', {
    method: 'POST',
    headers: { 'x-hotmart-hottok': HOTTOK, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const PRODUCT_ID: Record<string, string> = { tcc: '7299808', aba: '7285432', tdah: '7380571' }

function hotmartEvent(event: string, product: 'tcc' | 'aba' | 'tdah', opts: { email?: string; offer?: string; tx?: string } = {}) {
  return {
    event,
    data: {
      product: { id: PRODUCT_ID[product], name: `AXIS ${product.toUpperCase()}` },
      buyer: { email: opts.email ?? 'aaaa@teste.local', name: 'Profissional Teste' },
      purchase: { transaction: opts.tx ?? `TX-${++seq}`, offer: { code: opts.offer ?? 'oferta-x' } },
    },
  }
}

async function sendHotmart(event: string, product: 'tcc' | 'aba' | 'tdah', opts: { email?: string; offer?: string; tx?: string } = {}) {
  const res = await hotmartPOST(hotmartRequest(hotmartEvent(event, product, opts)))
  return { status: res.status, body: await res.json() }
}

function adminRequest(body: unknown): any {
  return new Request('https://app.test/api/admin/users/x', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function adminAction(tenantId: string, body: Record<string, unknown>) {
  const res = await adminPATCH(adminRequest(body), { params: Promise.resolve({ id: tenantId }) })
  return { status: res.status, body: await res.json() }
}

const licensesOf = (tenantId: string, product: string) => db.licenses.filter((l) => l.tenant_id === tenantId && l.product_type === product)
const alertCodes = () => alerts.map((a) => a.code)

beforeEach(() => {
  db = emptyDb()
  snapshot = null
  alerts.length = 0
  clerkUsers.length = 0
  transcriptionMinutes = 0
  analyzeRequests = 0
  ctxTenant = TENANT_A
  mockCreateInvitation.mockClear()
  resetLicenseAlertThrottle()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// =====================================================
// 1. Catálogo
// =====================================================

describe('1. catálogo único', () => {
  test('chaves à venda: aba_50/100/250, tdah_50/100/250, tcc_50/100 com entitlement axis-<produto>-<n>', () => {
    const forSale = plansForSale().map((p) => `${p.key}:${p.maxPatients}:${p.entitlement}`)
    expect(forSale).toEqual([
      'aba_50:50:axis-aba-50',
      'aba_100:100:axis-aba-100',
      'aba_250:250:axis-aba-250',
      'tdah_50:50:axis-tdah-50',
      'tdah_100:100:axis-tdah-100',
      'tdah_250:250:axis-tdah-250',
      'tcc_50:50:axis-tcc-50',
      'tcc_100:100:axis-tcc-100',
    ])
  })

  test('só chaves à venda: nenhuma chave interna, nenhum TCC ilimitado', () => {
    expect(Object.values(PLANS).every((p) => p.forSale)).toBe(true)
    expect(Math.max(...Object.values(PLANS).filter((p) => p.product === 'tcc').map((p) => p.maxPatients))).toBe(100)
  })

  test('sem Founders e sem chave de outro jeito', () => {
    expect(Object.keys(PLANS).some((k) => k.includes('founders'))).toBe(false)
    expect(getPlan('founders')).toBeNull()
    expect(getPlan('aba_999')).toBeNull()
    expect(isPlanValidFor(PLANS.aba_100, 'aba')).toBe(true)
    expect(isPlanValidFor(PLANS.aba_100, 'tdah')).toBe(false)
  })
})

// =====================================================
// 2. Mapa do backfill
// =====================================================

describe('2. mapa do backfill (regras da 081)', () => {
  test.each([
    // produto, oferta,      hotmart_plan,  evento,                      plan_key,   billing_source
    ['aba', 'gona25or', 'AXIS ABA', 'PURCHASE_APPROVED', 'aba_250', 'hotmart'],
    ['aba', 'u2t04kz5', 'AXIS ABA', 'PURCHASE_COMPLETE', 'aba_100', 'hotmart'],
    ['aba', '5hz0et4m', 'AXIS ABA', 'PURCHASE_APPROVED', 'aba_100', 'hotmart'],
    ['aba', 'iwqieqxc', 'AXIS ABA', 'PURCHASE_APPROVED', 'aba_100', 'hotmart'],
    ['aba', null, 'clinica_250', 'ADMIN_MANUAL_UPGRADE', 'aba_250', 'cortesia'],
    ['aba', null, 'founders', 'ADMIN_MANUAL_UPGRADE', 'aba_100', 'cortesia'],
    ['aba', 'iwqieqxc', 'AXIS ABA', 'SUBSCRIPTION_CANCELLATION', 'aba_100', 'hotmart'],
    ['aba', 'gona25or', 'AXIS ABA', 'PURCHASE_REFUNDED', 'aba_250', 'hotmart'],
    ['tdah', 'hxzwuwfh', 'AXIS TDAH', 'PURCHASE_APPROVED', 'tdah_250', 'hotmart'],
    ['tdah', 'cr3rh0u9', 'AXIS TDAH', 'PURCHASE_APPROVED', 'tdah_100', 'hotmart'],
    ['tdah', 'xqzgdn1i', 'AXIS TDAH', 'PURCHASE_APPROVED', 'tdah_100', 'hotmart'],
    ['tdah', null, 'founders_50', 'ADMIN_MANUAL_UPGRADE', 'tdah_100', 'cortesia'],
    ['tdah', null, 'clinica_250', 'ADMIN_FREE_ACTIVATION', 'tdah_250', 'cortesia'],
    ['tcc', 'sn8ebdqc', 'AXIS TCC', 'PURCHASE_APPROVED', 'tcc_100', 'hotmart'],
    ['tcc', null, 'clinica_250', 'ADMIN_MANUAL_UPGRADE', 'tcc_100', 'cortesia'],
    ['tcc', null, 'admin_grant', null, 'tcc_100', 'cortesia'],
  ])('%s oferta=%s plano=%s evento=%s → %s / %s', (product, offer, plan, event, key, source) => {
    expect(legacyPlanKey(product as any, offer, plan)).toBe(key)
    expect(legacyBillingSource(event, plan)).toBe(source)
  })

  test.each([
    ['FREE_TIER_ACTIVATION', 'AXIS ABA', 'evento que não é Hotmart nem admin'],
    [null, 'AXIS TDAH', 'sem evento'],
    ['CLERK_FREE_TIER', 'AXIS ABA', 'evento legado de free'],
    ['PURCHASE_APPROVED', 'admin_grant', 'duas regras ao mesmo tempo'],
  ])('sem regra → billing_source null (a 081 ABORTA): %s / %s (%s)', (event, plan, _motivo) => {
    expect(legacyBillingSource(event, plan)).toBeNull()
  })

  test('admin: founders/clinica_100 → _100, clinica_250 → aba_250/tdah_250, TCC → tcc_100, resto → null', () => {
    expect(adminPlanKey('aba', 'founders')).toBe('aba_100')
    expect(adminPlanKey('aba', 'clinica_100')).toBe('aba_100')
    expect(adminPlanKey('aba', 'clinica_250')).toBe('aba_250')
    expect(adminPlanKey('tdah', 'founders')).toBe('tdah_100')
    expect(adminPlanKey('tdah', 'clinica_250')).toBe('tdah_250')
    expect(adminPlanKey('tcc', 'founders')).toBe('tcc_100')
    expect(adminPlanKey('tcc', 'clinica_250')).toBe('tcc_100')
    expect(adminPlanKey('aba', 'founders_50')).toBeNull()
    expect(adminPlanKey('aba', 'qualquer')).toBeNull()
    expect(adminPlanKey('xyz', 'founders')).toBeNull()
  })

  test('a 081 e os SQL de conferência usam as mesmas regras do código', () => {
    const files = [
      join(MIGRATIONS_DIR, '081_pagamento_paymentbeta.sql'),
      join(REPO_ROOT, 'scripts', 'checks', 'pagamento_p1_antes.sql'),
      join(REPO_ROOT, 'scripts', 'checks', 'pagamento_p1_depois.sql'),
    ]
    for (const file of files) {
      const sql = normalize(readFileSync(file, 'utf-8'))
      expect(sql, file).toContain("WHEN 'tcc' THEN 'tcc_100'")
      expect(sql, file).toMatch(/= 'gona25or' OR [\w.]*hotmart_plan = 'clinica_250' THEN 'aba_250' ELSE 'aba_100' END/)
      expect(sql, file).toMatch(/= 'hxzwuwfh' OR [\w.]*hotmart_plan = 'clinica_250' THEN 'tdah_250' ELSE 'tdah_100' END/)
      expect(sql, file).toMatch(/COALESCE\(starts_with\([\w.]*hotmart_event, 'PURCHASE_'\) OR [\w.]*hotmart_event = 'SUBSCRIPTION_CANCELLATION', false\)/)
      expect(sql, file).toMatch(/COALESCE\(starts_with\([\w.]*hotmart_event, 'ADMIN_'\), false\) OR [\w.]*hotmart_plan = 'admin_grant'/)
      expect(sql, file).toMatch(/WHEN (r\.)?e_hotmart AND NOT (r\.)?e_cortesia THEN 'hotmart' WHEN (r\.)?e_cortesia AND NOT (r\.)?e_hotmart THEN 'cortesia'/)
    }
  })
})

// =====================================================
// 3. Leitores decidem por plan_key
// =====================================================

describe('3. leitores decidem por plan_key', () => {
  const limitFor = (product: 'tcc' | 'aba' | 'tdah', tenantId = TENANT_A) => getProductLimit(makeClient() as any, tenantId, product)

  test('TCC pago deixou de ser ilimitado: tcc_100 → 100, tcc_50 → 50', async () => {
    seedLicense({ product_type: 'tcc', hotmart_plan: 'AXIS TCC', plan_key: 'tcc_100', billing_source: 'hotmart' })
    expect(await limitFor('tcc')).toEqual({ plan: 'AXIS TCC', planKey: 'tcc_100', billingSource: 'hotmart', maxPatients: 100 })
    db.licenses[0].plan_key = 'tcc_50'
    expect((await limitFor('tcc')).maxPatients).toBe(50)
    expect(alerts).toEqual([])
  })

  test('TCC cortesia (admin) também é tcc_100 → 100', async () => {
    seedLicense({ product_type: 'tcc', hotmart_plan: 'founders', plan_key: 'tcc_100', billing_source: 'cortesia' })
    expect((await limitFor('tcc')).maxPatients).toBe(100)
    expect(alerts).toEqual([])
  })

  test('chave de outro produto → 100 + alerta', async () => {
    seedLicense({ product_type: 'tcc', hotmart_plan: 'AXIS TCC', plan_key: 'aba_250', billing_source: 'hotmart' })
    expect((await limitFor('tcc')).maxPatients).toBe(100)
    expect(alertCodes()).toEqual(['LICENSE_PLAN_KEY_UNKNOWN'])
    expect(alerts[0].context).toMatchObject({ tenant_id: TENANT_A, product_type: 'tcc', plan_key: 'aba_250' })
  })

  test('ABA/TDAH pelo catálogo; hotmart_plan não decide mais', async () => {
    seedLicense({ product_type: 'aba', hotmart_plan: 'clinica_250', plan_key: 'aba_100', billing_source: 'cortesia' })
    seedLicense({ product_type: 'tdah', hotmart_plan: 'AXIS TDAH', plan_key: 'tdah_250', billing_source: 'hotmart' })
    expect((await limitFor('aba')).maxPatients).toBe(100)
    expect((await limitFor('tdah')).maxPatients).toBe(250)
  })

  test('sem licença ativa, ou licença free → 1 (plan "free")', async () => {
    expect(await limitFor('aba')).toEqual({ plan: 'free', planKey: null, billingSource: null, maxPatients: 1 })
    seedLicense({ product_type: 'aba', hotmart_event: 'FREE_TIER_ACTIVATION' })
    expect(await limitFor('aba')).toEqual({ plan: 'free', planKey: null, billingSource: null, maxPatients: 1 })
    seedLicense({ product_type: 'tdah', is_active: false, plan_key: 'tdah_250', billing_source: 'hotmart', hotmart_plan: 'AXIS TDAH' })
    expect((await limitFor('tdah')).maxPatients).toBe(1)
  })

  test('plan_key desconhecida → 100 + alerta', async () => {
    seedLicense({ product_type: 'aba', hotmart_plan: 'AXIS ABA', plan_key: 'aba_999', billing_source: 'hotmart' })
    expect(await limitFor('aba')).toMatchObject({ planKey: 'aba_999', maxPatients: 100 })
    expect(alertCodes()).toEqual(['LICENSE_PLAN_KEY_UNKNOWN'])
  })

  test('licença sem hotmart_plan (PaymentBeta, futuro) mostra a chave como rótulo', async () => {
    seedLicense({ product_type: 'aba', plan_key: 'aba_50', billing_source: 'paymentbeta' })
    expect(await limitFor('aba')).toEqual({ plan: 'aba_50', planKey: 'aba_50', billingSource: 'paymentbeta', maxPatients: 50 })
  })

  test('transcrição: pago pela plan_key = sem limite; free = 300 min', async () => {
    transcriptionMinutes = 320
    let usage = await getTranscriptionUsage(makeClient() as any, TENANT_A)
    expect(usage).toEqual({ minutes_used: 320, limit: FREE_LIMIT_MINUTES, is_free: true, limit_reached: true })

    seedLicense({ product_type: 'tcc', plan_key: 'tcc_50', billing_source: 'paymentbeta' })
    usage = await getTranscriptionUsage(makeClient() as any, TENANT_A)
    expect(usage).toEqual({ minutes_used: 320, limit: null, is_free: false, limit_reached: false })
  })

  test('análise: pago pela plan_key = sem limite; free = 50 em 30 dias', async () => {
    analyzeRequests = 50
    let usage = await getAnalyzeUsage(makeClient() as any, TENANT_A)
    expect(usage).toEqual({ requests_used: 50, limit: FREE_LIMIT_REQUESTS, is_free: true, limit_reached: true })

    seedLicense({ product_type: 'tcc', hotmart_plan: 'AXIS TCC', plan_key: 'tcc_100', billing_source: 'cortesia' })
    usage = await getAnalyzeUsage(makeClient() as any, TENANT_A)
    expect(usage).toEqual({ requests_used: 50, limit: null, is_free: false, limit_reached: false })
  })

  test('/api/user/licenses devolve plan_key (a que decide) e não devolve mais hotmart_plan', async () => {
    seedLicense({ product_type: 'aba', hotmart_plan: 'AXIS ABA', plan_key: 'aba_250', billing_source: 'hotmart' })
    seedLicense({ product_type: 'tcc', hotmart_event: 'FREE_TIER_ACTIVATION' })
    seedLicense({ product_type: 'tdah', hotmart_plan: 'AXIS TDAH', hotmart_offer: 'hxzwuwfh' }) // gravada por código antigo
    const res = await licensesGET({} as any)
    const body = await res.json()
    expect(body.licenses.map((l: any) => [l.product_type, l.plan_key])).toEqual([
      ['aba', 'aba_250'],
      ['tcc', null],
      ['tdah', 'tdah_250'],
    ])
    expect(body.licenses.every((l: any) => !('hotmart_plan' in l))).toBe(true)
    expect(alertCodes()).toEqual(['LICENSE_PLAN_KEY_FALLBACK'])
  })

  test('hub: "Ativo" só com plan_key (mesma condição do app/hub/page.tsx)', () => {
    const src = readFileSync(join(REPO_ROOT, 'app', 'hub', 'page.tsx'), 'utf-8')
    expect(src).toContain("l.plan_key != null && l.plan_key !== ''")
    expect(src).not.toContain('hotmart_plan')
  })
})

// =====================================================
// 4. Fallback de segurança
// =====================================================

describe('4. fallback: plan_key nula + hotmart_plan preenchido', () => {
  test.each([
    ['tcc', null, 'AXIS TCC', 'tcc_100', 100],
    ['aba', 'gona25or', 'AXIS ABA', 'aba_250', 250],
    ['aba', 'u2t04kz5', 'AXIS ABA', 'aba_100', 100],
    ['tdah', null, 'clinica_250', 'tdah_250', 250],
  ])('%s oferta=%s plano=%s → %s (%i) + alerta; ninguém perde acesso', async (product, offer, plan, key, max) => {
    seedLicense({ product_type: product as string, hotmart_offer: offer as string | null, hotmart_plan: plan as string })
    const limit = await getProductLimit(makeClient() as any, TENANT_A, product as any)
    expect(limit).toEqual({ plan, planKey: key, billingSource: null, maxPatients: max })
    expect(alertCodes()).toEqual(['LICENSE_PLAN_KEY_FALLBACK'])
    expect(alerts[0]).toMatchObject({ severity: 'warning', source: 'billing/license' })
  })

  test('plan_key vazia conta como nula; hotmart_plan vazio = free', () => {
    expect(resolveLicense({ product_type: 'aba', plan_key: '', billing_source: null, hotmart_plan: 'AXIS ABA', hotmart_offer: null }))
      .toMatchObject({ kind: 'fallback', planKey: 'aba_100', paid: true })
    expect(resolveLicense({ product_type: 'aba', plan_key: null, billing_source: null, hotmart_plan: '', hotmart_offer: null }))
      .toMatchObject({ kind: 'free', paid: false, maxPatients: 1 })
  })

  test('alerta no máximo 1 vez por hora por licença (leitor roda em toda página)', async () => {
    seedLicense({ product_type: 'tcc', hotmart_plan: 'AXIS TCC' })
    for (let i = 0; i < 5; i++) await getProductLimit(makeClient() as any, TENANT_A, 'tcc')
    expect(alertCodes()).toEqual(['LICENSE_PLAN_KEY_FALLBACK'])
  })
})

// =====================================================
// 5. Hotmart não sobrescreve nem desativa cortesia/paymentbeta
// =====================================================

describe('5. receptor Hotmart x cortesia/paymentbeta', () => {
  beforeEach(() => {
    seedTenant(TENANT_A, { email: 'aaaa@teste.local' })
  })

  test.each(['cortesia', 'paymentbeta'])('pagamento Hotmart não altera licença %s (nem o tenant) e gera alerta', async (source) => {
    const lic = seedLicense({
      product_type: 'tcc', plan_key: 'tcc_100',
      billing_source: source, hotmart_plan: source === 'cortesia' ? 'founders' : null,
    })
    const before = structuredClone(lic)
    db.tenants[0].plan_tier = 'custom'

    const res = await sendHotmart('PURCHASE_APPROVED', 'tcc')
    expect(res.status).toBe(200)
    expect(licensesOf(TENANT_A, 'tcc')).toEqual([before])
    expect(db.tenants[0].plan_tier).toBe('custom')
    expect(alertCodes()).toEqual(['HOTMART_PROTECTED_LICENSE'])
    expect(alerts[0].context).toMatchObject({ tenant_id: TENANT_A, product_type: 'tcc', billing_source: source })
    expect(db.audits.at(-1)!.metadata).toMatchObject({ license_status: 'skipped_protected', tcc_new_sale: false })
  })

  test('licença protegida ATIVA de outro usuário do tenant também bloqueia (não cria linha Hotmart paralela)', async () => {
    seedLicense({ product_type: 'aba', clerk_user_id: 'user_socio', plan_key: 'aba_250', billing_source: 'paymentbeta' })
    await sendHotmart('PURCHASE_APPROVED', 'aba', { offer: 'u2t04kz5' })
    expect(licensesOf(TENANT_A, 'aba')).toHaveLength(1)
    expect(alertCodes()).toEqual(['HOTMART_PROTECTED_LICENSE'])
  })

  test('cancelamento Hotmart não desativa cortesia; tenant não vira free; alerta', async () => {
    seedLicense({ product_type: 'tcc', plan_key: 'tcc_100', billing_source: 'cortesia', hotmart_plan: 'founders' })
    await sendHotmart('SUBSCRIPTION_CANCELLATION', 'tcc')
    expect(licensesOf(TENANT_A, 'tcc')[0].is_active).toBe(true)
    expect(db.tenants[0].plan_tier).toBe('founders')
    expect(alertCodes()).toEqual(['HOTMART_PROTECTED_LICENSE'])
    expect(alerts[0].message).toContain('Cancelamento')
  })

  test('cancelamento Hotmart desativa a licença Hotmart (igual a hoje) e o tenant vira free', async () => {
    seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'hotmart', hotmart_plan: 'AXIS ABA' })
    await sendHotmart('PURCHASE_REFUNDED', 'aba')
    expect(licensesOf(TENANT_A, 'aba')[0]).toMatchObject({ is_active: false, hotmart_event: 'PURCHASE_REFUNDED' })
    expect(db.tenants[0]).toMatchObject({ plan_tier: 'free', max_patients: 1 })
    expect(alerts).toEqual([])
  })

  test('licença gravada antes da 081 (billing_source nulo) continua sendo atualizada pela Hotmart', async () => {
    seedLicense({ product_type: 'aba', hotmart_plan: 'AXIS ABA', hotmart_offer: 'u2t04kz5', hotmart_event: 'PURCHASE_APPROVED' })
    await sendHotmart('PURCHASE_APPROVED', 'aba', { offer: 'gona25or', tx: 'TX-NOVA' })
    expect(licensesOf(TENANT_A, 'aba')[0]).toMatchObject({ plan_key: 'aba_250', billing_source: 'hotmart', hotmart_transaction: 'TX-NOVA' })
  })

  test.each([
    ['aba', 'gona25or', 'aba_250', 'clinica_250', 250],
    ['aba', 'iwqieqxc', 'aba_100', 'clinica_100', 100],
    ['tdah', 'hxzwuwfh', 'tdah_250', 'clinica_250', 250],
    ['tdah', 'xqzgdn1i', 'tdah_100', 'founders', 50],
  ])('free → pago: %s oferta %s grava %s/hotmart (tenants igual a hoje: %s/%i)', async (product, offer, key, tier, max) => {
    seedLicense({ product_type: product as string, hotmart_event: 'FREE_TIER_ACTIVATION' })
    await sendHotmart('PURCHASE_APPROVED', product as any, { offer: offer as string })
    expect(licensesOf(TENANT_A, product as string)[0]).toMatchObject({ is_active: true, plan_key: key, billing_source: 'hotmart', hotmart_offer: offer })
    expect(db.tenants[0]).toMatchObject({ plan_tier: tier, max_patients: max })
    expect(alerts).toEqual([])
  })
})

// =====================================================
// 6. Alerta só em compra NOVA de TCC
// =====================================================

describe('6. TCC na Hotmart depois do P1: alerta só em compra nova', () => {
  beforeEach(() => {
    seedTenant(TENANT_A, { email: 'aaaa@teste.local' })
  })

  test('tenant sem TCC pago compra TCC → tcc_100 + alerta "tratar à mão"', async () => {
    seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'hotmart', hotmart_plan: 'AXIS ABA' })
    await sendHotmart('PURCHASE_APPROVED', 'tcc', { offer: 'sn8ebdqc', tx: 'TX-TCC-1' })
    expect(licensesOf(TENANT_A, 'tcc')[0]).toMatchObject({ plan_key: 'tcc_100', billing_source: 'hotmart' })
    expect(alertCodes()).toEqual(['TCC_HOTMART_SALE_AFTER_P1'])
    expect(alerts[0]).toMatchObject({ module: 'axis-tcc', message: 'TCC vendido na Hotmart após P1 — tratar à mão' })
    expect(alerts[0].context).toMatchObject({ tenant_id: TENANT_A, transaction_id: 'TX-TCC-1', plan_key: 'tcc_100' })
    expect(db.audits.at(-1)!.metadata).toMatchObject({ plan_key: 'tcc_100', tcc_new_sale: true })
  })

  test('tenant com TCC free compra TCC → é compra nova (alerta)', async () => {
    seedLicense({ product_type: 'tcc', hotmart_event: 'FREE_TIER_ACTIVATION' })
    await sendHotmart('PURCHASE_APPROVED', 'tcc')
    expect(alertCodes()).toEqual(['TCC_HOTMART_SALE_AFTER_P1'])
  })

  test('renovação mensal de quem já era pago (tcc_100 ativa) → sem alerta', async () => {
    seedLicense({ product_type: 'tcc', plan_key: 'tcc_100', billing_source: 'hotmart', hotmart_plan: 'AXIS TCC', hotmart_event: 'PURCHASE_APPROVED' })
    await sendHotmart('PURCHASE_APPROVED', 'tcc', { tx: 'TX-MES-2' })
    expect(licensesOf(TENANT_A, 'tcc')[0]).toMatchObject({ plan_key: 'tcc_100', hotmart_transaction: 'TX-MES-2' })
    expect(alerts).toEqual([])
  })

  test('renovação de licença paga gravada antes da 081 (sem plan_key) → sem alerta (fallback conta como pago)', async () => {
    seedLicense({ product_type: 'tcc', hotmart_plan: 'AXIS TCC', hotmart_event: 'PURCHASE_APPROVED' })
    await sendHotmart('PURCHASE_APPROVED', 'tcc')
    expect(alertCodes()).not.toContain('TCC_HOTMART_SALE_AFTER_P1')
  })

  test('PURCHASE_APPROVED e depois PURCHASE_COMPLETE da mesma compra → 1 alerta só', async () => {
    await sendHotmart('PURCHASE_APPROVED', 'tcc', { tx: 'TX-UNICA' })
    await sendHotmart('PURCHASE_COMPLETE', 'tcc', { tx: 'TX-UNICA' })
    await sendHotmart('PURCHASE_APPROVED', 'tcc', { tx: 'TX-UNICA' }) // Hotmart reenviando
    expect(alertCodes()).toEqual(['TCC_HOTMART_SALE_AFTER_P1'])
  })

  test('quem tinha TCC pago cancelado (inativo) e compra de novo → compra nova (alerta)', async () => {
    seedLicense({ product_type: 'tcc', is_active: false, plan_key: 'tcc_100', billing_source: 'hotmart', hotmart_plan: 'AXIS TCC', hotmart_event: 'SUBSCRIPTION_CANCELLATION' })
    await sendHotmart('PURCHASE_APPROVED', 'tcc')
    expect(licensesOf(TENANT_A, 'tcc')[0]).toMatchObject({ is_active: true, plan_key: 'tcc_100' })
    expect(alertCodes()).toEqual(['TCC_HOTMART_SALE_AFTER_P1'])
  })

  test('compra de ABA/TDAH nunca gera o alerta de TCC', async () => {
    await sendHotmart('PURCHASE_APPROVED', 'aba', { offer: 'gona25or' })
    await sendHotmart('PURCHASE_APPROVED', 'tdah', { offer: 'hxzwuwfh' })
    expect(alerts).toEqual([])
  })
})

describe('6b. comprador novo (auto-provisionamento)', () => {
  test('comprador sem conta compra TCC → tenant novo com tcc_100/hotmart + alerta', async () => {
    const res = await sendHotmart('PURCHASE_APPROVED', 'tcc', { email: 'novo@teste.local', offer: 'sn8ebdqc' })
    expect(res.body).toMatchObject({ status: 'provisioned', method: 'invitation' })
    const tenantId = res.body.tenant_id
    expect(licensesOf(tenantId, 'tcc')[0]).toMatchObject({
      clerk_user_id: 'pending_hotmart_novo@teste.local', plan_key: 'tcc_100', billing_source: 'hotmart',
    })
    expect(alertCodes()).toEqual(['TCC_HOTMART_SALE_AFTER_P1'])
    expect(alerts[0].context).toMatchObject({ tenant_id: tenantId })
  })

  test('comprador com conta Clerk e tenant (achado pelo id) renovando TCC → sem alerta', async () => {
    seedTenant(TENANT_B, { clerk_user_id: 'user_clerk_b', email: 'outro-email@teste.local' })
    seedLicense({ tenant_id: TENANT_B, clerk_user_id: 'user_clerk_b', product_type: 'tcc', plan_key: 'tcc_100', billing_source: 'hotmart', hotmart_plan: 'AXIS TCC' })
    clerkUsers.push({ id: 'user_clerk_b', email: 'compra@teste.local' })
    const res = await sendHotmart('PURCHASE_APPROVED', 'tcc', { email: 'compra@teste.local' })
    expect(res.body).toMatchObject({ status: 'provisioned', method: 'existing_user', tenant_id: TENANT_B })
    expect(alerts).toEqual([])
  })

  test('comprador com conta Clerk e tenant cortesia → licença não muda, alerta de protegida', async () => {
    seedTenant(TENANT_B, { clerk_user_id: 'user_clerk_b', email: 'outro-email@teste.local' })
    seedLicense({ tenant_id: TENANT_B, clerk_user_id: 'user_clerk_b', product_type: 'aba', plan_key: 'aba_250', billing_source: 'cortesia', hotmart_plan: 'clinica_250' })
    clerkUsers.push({ id: 'user_clerk_b', email: 'compra@teste.local' })
    await sendHotmart('PURCHASE_APPROVED', 'aba', { email: 'compra@teste.local', offer: 'u2t04kz5' })
    expect(licensesOf(TENANT_B, 'aba')[0]).toMatchObject({ plan_key: 'aba_250', billing_source: 'cortesia' })
    expect(db.tenants.find((t) => t.id === TENANT_B)!.plan_tier).toBe('founders')
    expect(alertCodes()).toEqual(['HOTMART_PROTECTED_LICENSE'])
    expect(db.audits.at(-1)).toMatchObject({ action: 'HOTMART_PROTECTED_LICENSE_SKIPPED' })
  })
})

// =====================================================
// 7. Admin e activate-free
// =====================================================

describe('7. admin grava a chave equivalente (cortesia)', () => {
  beforeEach(() => {
    seedTenant(TENANT_A)
  })

  test.each([
    ['aba', 'founders', 'aba_100'],
    ['aba', 'clinica_100', 'aba_100'],
    ['aba', 'clinica_250', 'aba_250'],
    ['tdah', 'founders', 'tdah_100'],
    ['tdah', 'clinica_250', 'tdah_250'],
    ['tcc', 'clinica_250', 'tcc_100'],
  ])('upgrade_manual %s/%s → %s + cortesia', async (product, tier, key) => {
    const res = await adminAction(TENANT_A, { action: 'upgrade_manual', product_type: product, plan_tier: tier, max_patients: 100 })
    expect(res.status).toBe(200)
    expect(licensesOf(TENANT_A, product)[0]).toMatchObject({ plan_key: key, billing_source: 'cortesia', hotmart_plan: tier, hotmart_event: 'ADMIN_MANUAL_UPGRADE' })
    expect(db.audits.at(-1)!.metadata).toMatchObject({ plan_key: key, billing_source: 'cortesia' })
  })

  test('upgrade_manual com plano sem chave equivalente → 400 e nada gravado', async () => {
    const res = await adminAction(TENANT_A, { action: 'upgrade_manual', product_type: 'aba', plan_tier: 'founders_50' })
    expect(res.status).toBe(400)
    expect(db.licenses).toEqual([])
    expect(db.audits).toEqual([])
  })

  test('update_license: só ativar/desativar não mexe na chave', async () => {
    const lic = seedLicense({ product_type: 'aba', plan_key: 'aba_250', billing_source: 'hotmart', hotmart_plan: 'AXIS ABA' })
    const res = await adminAction(TENANT_A, { action: 'update_license', license_id: lic.id, is_active: false })
    expect(res.status).toBe(200)
    expect(db.licenses[0]).toMatchObject({ is_active: false, plan_key: 'aba_250', billing_source: 'hotmart' })
  })

  test('update_license com hotmart_plan grava a chave equivalente; vazio volta a free', async () => {
    const lic = seedLicense({ product_type: 'tdah', hotmart_event: 'FREE_TIER_ACTIVATION' })
    await adminAction(TENANT_A, { action: 'update_license', license_id: lic.id, hotmart_plan: 'clinica_250' })
    expect(db.licenses[0]).toMatchObject({ hotmart_plan: 'clinica_250', plan_key: 'tdah_250', billing_source: 'cortesia' })

    await adminAction(TENANT_A, { action: 'update_license', license_id: lic.id, hotmart_plan: '' })
    expect(db.licenses[0]).toMatchObject({ hotmart_plan: '', plan_key: null, billing_source: null })

    const bad = await adminAction(TENANT_A, { action: 'update_license', license_id: lic.id, hotmart_plan: 'xyz' })
    expect(bad.status).toBe(400)
  })

  test('activate-free grava plan_key e billing_source nulos (free)', async () => {
    const res = await activateFreePOST(new Request('https://app.test/api/user/activate-free', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_type: 'tdah' }),
    }) as any)
    expect(res.status).toBe(201)
    expect(db.licenses[0]).toMatchObject({ product_type: 'tdah', plan_key: null, billing_source: null })
    expect((await getProductLimit(makeClient() as any, TENANT_A, 'tdah')).maxPatients).toBe(1)
  })
})

// =====================================================
// 8. Migrations (contrato estático)
// =====================================================

describe('8. migration 081', () => {
  const m081 = readFileSync(join(MIGRATIONS_DIR, '081_pagamento_paymentbeta.sql'), 'utf-8')
  const code = (sql: string) => normalize(sql.replace(/--.*$/gm, ''))

  test('todo arquivo de scripts/migrations tem nome NNN_*.sql (o migrate.sh ignora os outros)', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
    expect(files.filter((f) => !/^\d{3}_[^/]+\.sql$/.test(f))).toEqual([])
    expect(files).toContain('081_pagamento_paymentbeta.sql')
  })

  test('081: aditiva, idempotente, numa transação', () => {
    const sql = code(m081)
    expect(sql.startsWith('BEGIN;')).toBe(true)
    expect(sql.endsWith('COMMIT;')).toBe(true)
    for (const col of ['plan_key text', 'billing_source text', 'access_until timestamptz', 'paymentbeta_subscription_id text']) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${col}`)
    }
    expect(sql).toContain("CHECK (billing_source IN ('hotmart', 'paymentbeta', 'cortesia'))")
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.paymentbeta_deliveries')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.checkout_intents')
    expect(sql).not.toMatch(/\bDROP (TABLE|COLUMN)\b/)
    expect(sql).not.toMatch(/\bDELETE FROM\b/)
  })

  test('081: RLS forçada com tenant_isolation e nenhuma política aberta', () => {
    const sql = code(m081)
    for (const table of ['paymentbeta_deliveries', 'checkout_intents']) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)
      expect(sql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`)
      expect(sql).toContain(`CREATE POLICY tenant_isolation ON public.${table} FOR ALL USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());`)
    }
    expect(sql).not.toMatch(/USING \(true\)|WITH CHECK \(true\)/i)
    expect((sql.match(/CREATE POLICY/g) ?? []).length).toBe(2)
  })

  test('081: receptor sem tenant só por funções SECURITY DEFINER com search_path fixo, EXECUTE só para axis_app', () => {
    const sql = code(m081)
    const fns = ['paymentbeta_delivery_register(uuid, text, text)', 'paymentbeta_delivery_result(uuid, text, uuid)', 'checkout_intent_lookup(uuid)']
    expect((sql.match(/SECURITY DEFINER SET search_path = public/g) ?? []).length).toBe(3)
    for (const fn of fns) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC;`)
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO axis_app;`)
    }
    expect(sql).toContain('GRANT SELECT ON public.paymentbeta_deliveries TO axis_app;')
    expect(sql).not.toMatch(/GRANT [A-Z, ]*INSERT[A-Z, ]* ON public\.paymentbeta_deliveries/)
  })

  test('081: backfill só de hotmart_plan não vazio, aborta sem chutar, não conta pacientes', () => {
    const sql = code(m081)
    expect(sql).toContain("WHERE ul.hotmart_plan IS NOT NULL AND ul.hotmart_plan <> '' AND ul.plan_key IS NULL AND ul.billing_source IS NULL")
    expect(sql).toContain('RAISE EXCEPTION')
    expect(sql).toContain("'LICENSE_PLAN_KEY_BACKFILL'")
    expect(sql).not.toMatch(/\bpatients\b/)
  })
})
