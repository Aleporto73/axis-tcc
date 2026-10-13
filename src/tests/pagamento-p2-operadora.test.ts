import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, sep } from 'path'

// =====================================================
// AXIS — Pagamento P2, opção B: recursos "Operadora" do ABA pela LICENÇA ABA ATIVA
//
// 1  os 3 níveis (aba_50/100/250) + ABA grátis + cortesia, pelo withTenant de verdade
// 2  plan_tier='clinica_250' sem ABA paga NÃO libera recurso (rota de verdade → 403)
// 3  tela: RoleProvider, /api/aba/me, "Novo Aprendiz", Configurações ABA/TDAH
// 4  contrato: plan_tier só aparece em quem grava ou exibe (lista fechada)
//
// Sem banco: um Postgres falso responde pelo texto da SQL.
// =====================================================

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'
const REPO_ROOT = join(__dirname, '..', '..')

const h = vi.hoisted(() => ({
  userId: 'user_dono' as string | null,
  cookie: undefined as string | undefined,
  alerts: [] as Array<{ code?: string }>,
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: h.userId }) }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'axis_active_tenant' && h.cookie ? { value: h.cookie } : undefined) }),
}))
vi.mock('@/src/utils/system-alert', () => ({ createSystemAlert: vi.fn(async (a: { code?: string }) => { h.alerts.push(a) }) }))
vi.mock('@/src/lib/env', () => ({ env: {} }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/src/database/db', () => ({
  default: {
    query: (sql: string, params?: unknown[]) => runQuery(sql, params ?? []),
    connect: () => Promise.resolve({ query: (sql: string, params?: unknown[]) => runQuery(sql, params ?? []), release: () => undefined }),
  },
}))

import { withTenant, type TenantContext } from '@/src/database/with-tenant'
import { requireFeature, PlanGateError } from '@/src/database/with-role'
import { getOperadoraAccess, operadoraLevel, type OperadoraAccess } from '@/src/lib/operadora-gate'
import { abaHotmartUpgrade, atPatientLimit, planLabel } from '@/src/billing/plan-display'
import { GET as serviceSitesGET } from '@/app/api/aba/service-sites/route'
import { GET as meGET } from '@/app/api/aba/me/route'

// ─── Postgres falso ───

interface Lic {
  tenant_id: string
  clerk_user_id: string
  product_type: string
  is_active: boolean
  plan_key: string | null
  billing_source: string | null
  hotmart_plan: string | null
  hotmart_offer: string | null
  created_at: number
}

let tenants: Array<{ id: string; name: string; clerk_user_id: string; plan_tier: string; status: string; max_patients: number }>
let profiles: Array<{ id: string; tenant_id: string; clerk_user_id: string; email: string; role: string; is_active: boolean; created_at: number }>
let licenses: Lic[]
let clock = 0
const queries: string[] = []

const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim()
const result = (rows: Array<Record<string, unknown>> = []) => ({ rows, rowCount: rows.length })

/** Licença ativa mais recente do produto (a mesma que o leitor de licença usa). */
const activeLicense = (tenantId: string, product: string) =>
  licenses
    .filter((l) => l.tenant_id === tenantId && l.product_type === product && l.is_active)
    .sort((a, b) => b.created_at - a.created_at)[0]

async function runQuery(rawSql: string, params: unknown[]) {
  const sql = normalize(rawSql)
  queries.push(sql)
  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return result()
  if (sql.startsWith("SELECT set_config(")) return result()

  // withTenant: e-mail do usuário e convites pendentes
  if (sql.startsWith('SELECT email FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1')) {
    const p = profiles.find((x) => x.clerk_user_id === params[0] && x.is_active)
    return result(p ? [{ email: p.email }] : [])
  }
  if (sql.startsWith('UPDATE profiles SET clerk_user_id = $1, is_active = true')) return result()

  // withTenant: profiles + licença ABA ativa de cada tenant (LEFT JOIN LATERAL)
  if (sql.includes('FROM profiles p JOIN tenants t') && sql.includes('LEFT JOIN LATERAL')) {
    expect(sql).toContain("ul.product_type = 'aba' AND ul.is_active = true ORDER BY ul.created_at DESC LIMIT 1")
    expect(sql).not.toContain('plan_tier')
    return result(
      profiles
        .filter((p) => p.clerk_user_id === params[0] && p.is_active)
        .sort((a, b) => Number(b.role === 'admin') - Number(a.role === 'admin') || a.created_at - b.created_at)
        .map((p) => {
          const t = tenants.find((x) => x.id === p.tenant_id)!
          const aba = activeLicense(p.tenant_id, 'aba')
          return {
            profile_id: p.id, tenant_id: p.tenant_id, role: p.role, tenant_name: t.name,
            aba_plan_key: aba?.plan_key ?? null, aba_billing_source: aba?.billing_source ?? null,
            aba_hotmart_plan: aba?.hotmart_plan ?? null, aba_hotmart_offer: aba?.hotmart_offer ?? null,
          }
        }),
    )
  }
  // withTenant: fallback de tenant antigo sem profile
  if (sql === 'SELECT id, status FROM tenants WHERE clerk_user_id = $1') {
    return result(tenants.filter((t) => t.clerk_user_id === params[0]).map((t) => ({ id: t.id, status: t.status })))
  }
  // leitor de licença (fallback do withTenant e product_limits do /api/aba/me)
  if (sql.startsWith('SELECT id, product_type, plan_key, billing_source, hotmart_plan, hotmart_offer FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1')) {
    const l = activeLicense(String(params[0]), String(params[1]))
    return result(l ? [{ id: 'lic', product_type: l.product_type, plan_key: l.plan_key, billing_source: l.billing_source, hotmart_plan: l.hotmart_plan, hotmart_offer: l.hotmart_offer }] : [])
  }
  // /api/aba/me
  if (sql.includes('FROM profiles p JOIN tenants t') && sql.includes('p.clerk_user_id = $1 AND p.tenant_id = $2')) {
    expect(sql).not.toContain('plan_tier')
    const p = profiles.find((x) => x.clerk_user_id === params[0] && x.tenant_id === params[1])
    const t = tenants.find((x) => x.id === params[1])!
    return result(p ? [{ id: p.id, tenant_id: p.tenant_id, role: p.role, name: 'Dono', is_active: true, tenant_name: t.name, max_patients: t.max_patients, learner_count: 0 }] : [])
  }
  // rota de locais de atendimento (só chega aqui se o recurso foi liberado)
  if (sql.includes('FROM service_sites')) return result([{ id: 'site-1', site_name: 'Sede' }])

  throw new Error(`SQL inesperada no teste: ${sql}`)
}

// ─── Helpers ───

function seedTenant(id: string, planTier: string, owner = 'user_dono') {
  tenants.push({ id, name: `Clínica ${id.slice(0, 2)}`, clerk_user_id: owner, plan_tier: planTier, status: 'active', max_patients: 100 })
  profiles.push({ id: `perfil-${id.slice(0, 2)}`, tenant_id: id, clerk_user_id: owner, email: `${owner}@teste.local`, role: 'admin', is_active: true, created_at: ++clock })
}

function seedLicense(partial: Partial<Lic> & { product_type: string }) {
  licenses.push({
    tenant_id: TENANT_A, clerk_user_id: 'user_dono', is_active: true, plan_key: null, billing_source: null,
    hotmart_plan: null, hotmart_offer: null, created_at: ++clock, ...partial,
  })
}

const ctxOf = () => withTenant(async (ctx) => ctx)

const FEATURES: Array<keyof OperadoraAccess> = [
  'serviceSites', 'presenceProofs', 'attestationsTherapist', 'evidenceBundles', 'attachments', 'providerCredentials',
  'attestationsGuardian', 'coverageProfiles', 'claimPackets', 'payerProfiles', 'integrityFlags', 'integrityDashboard',
]
const BASICO = FEATURES.slice(0, 6)
const CLINICA_100 = FEATURES.slice(0, 10)

/** Recursos que o requireFeature libera para este contexto (o mesmo que as rotas usam). */
function allowed(ctx: TenantContext): Array<keyof OperadoraAccess> {
  return FEATURES.filter((f) => {
    try {
      requireFeature(ctx, f)
      return true
    } catch (e) {
      expect(e).toBeInstanceOf(PlanGateError)
      return false
    }
  })
}

const originalKey = process.env.AXIS_ENCRYPTION_KEY

beforeEach(() => {
  tenants = []
  profiles = []
  licenses = []
  queries.length = 0
  h.userId = 'user_dono'
  h.cookie = undefined
  h.alerts.length = 0
  process.env.AXIS_ENCRYPTION_KEY = 'chave-de-teste-com-mais-de-16'
  seedTenant(TENANT_A, 'free')
})

afterEach(() => {
  process.env.AXIS_ENCRYPTION_KEY = originalKey
})

// =====================================================
// 1. Níveis pela licença ABA ativa
// =====================================================

describe('1. recursos Operadora pela licença ABA ativa (withTenant de verdade)', () => {
  test.each([
    ['aba_50', 'founders', BASICO],
    ['aba_100', 'clinica_100', CLINICA_100],
    ['aba_250', 'clinica_250', FEATURES],
  ] as const)('%s → pacote %s', async (key, level, features) => {
    seedLicense({ product_type: 'aba', plan_key: key, billing_source: 'hotmart', hotmart_plan: 'AXIS ABA' })
    const ctx = await ctxOf()
    expect(ctx.abaPlanKey).toBe(key)
    expect(operadoraLevel(key)).toBe(level)
    expect(allowed(ctx)).toEqual([...features])
    expect(getOperadoraAccess(key).hasOperadora).toBe(true)
  })

  test('contagem: aba_50 = 6, aba_100 = 10, aba_250 = 12, ABA grátis = 0', () => {
    const count = (key: string | null) => FEATURES.filter((f) => getOperadoraAccess(key)[f]).length
    expect([count('aba_50'), count('aba_100'), count('aba_250'), count(null)]).toEqual([6, 10, 12, 0])
  })

  test('ABA grátis (licença sem plan_key) com plan_tier founders → nenhum recurso', async () => {
    tenants[0].plan_tier = 'founders'
    seedLicense({ product_type: 'aba' })
    const ctx = await ctxOf()
    expect(ctx.abaPlanKey).toBeNull()
    expect(allowed(ctx)).toEqual([])
  })

  test.each([
    ['aba_100', CLINICA_100],
    ['aba_250', FEATURES],
  ] as const)('cortesia segue a chave dela: %s', async (key, features) => {
    seedLicense({ product_type: 'aba', plan_key: key, billing_source: 'cortesia', hotmart_plan: 'clinica_250' })
    const ctx = await ctxOf()
    expect(allowed(ctx)).toEqual([...features])
  })

  test('PaymentBeta aba_50 → pacote básico', async () => {
    seedLicense({ product_type: 'aba', plan_key: 'aba_50', billing_source: 'paymentbeta' })
    expect(allowed(await ctxOf())).toEqual([...BASICO])
  })

  test('licença ABA paga desligada (vencida/cancelada) → nenhum recurso', async () => {
    seedLicense({ product_type: 'aba', plan_key: 'aba_250', billing_source: 'paymentbeta', is_active: false })
    expect(allowed(await ctxOf())).toEqual([])
  })

  test('linha antiga sem plan_key (antes da 081) usa a regra do backfill: oferta gona25or → aba_250', async () => {
    seedLicense({ product_type: 'aba', hotmart_plan: 'AXIS ABA', hotmart_offer: 'gona25or' })
    const ctx = await ctxOf()
    expect(ctx.abaPlanKey).toBe('aba_250')
    expect(allowed(ctx)).toEqual([...FEATURES])
  })

  test('chave de outro produto numa linha ABA não libera recurso', async () => {
    seedLicense({ product_type: 'aba', plan_key: 'tdah_250', billing_source: 'hotmart', hotmart_plan: 'AXIS ABA' })
    const ctx = await ctxOf()
    expect(allowed(ctx)).toEqual([])
  })

  test('várias clínicas: vale a licença ABA da clínica escolhida no cookie', async () => {
    seedTenant(TENANT_B, 'clinica_250')
    seedLicense({ product_type: 'aba', plan_key: 'aba_250', billing_source: 'hotmart' })
    h.cookie = TENANT_B
    expect(allowed(await ctxOf())).toEqual([])
    h.cookie = TENANT_A
    expect(allowed(await ctxOf())).toEqual([...FEATURES])
  })

  test('tenant antigo sem profile (caminho de fallback) também decide pela licença ABA', async () => {
    profiles = []
    seedLicense({ product_type: 'aba', plan_key: 'aba_100', billing_source: 'hotmart' })
    const ctx = await ctxOf()
    expect(ctx.abaPlanKey).toBe('aba_100')
    expect(allowed(ctx)).toEqual([...CLINICA_100])
  })
})

// =====================================================
// 2. plan_tier sozinho não libera nada
// =====================================================

describe('2. plan_tier sem ABA paga NÃO libera recurso', () => {
  test("plan_tier='clinica_250' (veio de compra TDAH) sem ABA paga: nenhum recurso; a rota devolve 403", async () => {
    tenants[0].plan_tier = 'clinica_250'
    seedLicense({ product_type: 'tdah', plan_key: 'tdah_250', billing_source: 'hotmart', hotmart_plan: 'AXIS TDAH', hotmart_offer: 'hxzwuwfh' })
    seedLicense({ product_type: 'tcc', plan_key: 'tcc_100', billing_source: 'hotmart', hotmart_plan: 'AXIS TCC' })
    seedLicense({ product_type: 'aba' }) // ABA grátis

    const ctx = await ctxOf()
    expect(ctx.abaPlanKey).toBeNull()
    expect(allowed(ctx)).toEqual([])

    queries.length = 0
    const res = await serviceSitesGET()
    expect(res.status).toBe(403)
    expect(queries.some((q) => q.includes('FROM service_sites'))).toBe(false)
  })

  test('com ABA paga a mesma rota responde 200', async () => {
    tenants[0].plan_tier = 'free'
    seedLicense({ product_type: 'aba', plan_key: 'aba_50', billing_source: 'paymentbeta' })
    const res = await serviceSitesGET()
    expect(res.status).toBe(200)
    expect((await res.json()).sites).toHaveLength(1)
  })

  test('o withTenant não lê mais tenants.plan_tier', () => {
    const src = readFileSync(join(REPO_ROOT, 'src', 'database', 'with-tenant.ts'), 'utf-8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(src).not.toContain('plan_tier')
    expect(src).not.toContain('planTier')
  })
})

// =====================================================
// 3. Telas
// =====================================================

describe('3. telas pela licença', () => {
  test('/api/aba/me devolve plan_key e billing_source por produto e não devolve tenant_plan', async () => {
    tenants[0].plan_tier = 'clinica_250'
    seedLicense({ product_type: 'aba', plan_key: 'aba_50', billing_source: 'paymentbeta' })
    const res = await meGET()
    const { profile } = await res.json()
    expect(profile.tenant_plan).toBeUndefined()
    expect(profile.product_limits.aba).toEqual({ plan: 'aba_50', plan_key: 'aba_50', billing_source: 'paymentbeta', max_patients: 50 })
    expect(profile.product_limits.tdah).toEqual({ plan: 'free', plan_key: null, billing_source: null, max_patients: 1 })
  })

  test('RoleProvider: recursos pela chave ABA de product_limits (mesma função do servidor)', () => {
    const src = readFileSync(join(REPO_ROOT, 'app', 'components', 'RoleProvider.tsx'), 'utf-8')
    expect(src).toContain('profile?.product_limits?.aba?.plan_key')
    expect(src).toContain('getOperadoraAccess(abaPlanKey)')
    expect(src).not.toContain('tenant_plan')
  })

  test('"Novo Aprendiz": limite pela licença ABA (product_limits.aba), não por plan_tier', () => {
    const src = readFileSync(join(REPO_ROOT, 'app', 'aba', 'aprendizes', 'page.tsx'), 'utf-8')
    expect(src).toContain('atPatientLimit(learners.length, profile?.product_limits?.aba?.max_patients)')
    expect(src).not.toContain('tenant_plan')
    // grátis (1): o 2º aprendiz abre o aviso; pago: libera até o limite da chave
    expect(atPatientLimit(0, 1)).toBe(false)
    expect(atPatientLimit(1, 1)).toBe(true)
    expect(atPatientLimit(49, 50)).toBe(false)
    expect(atPatientLimit(50, 50)).toBe(true)
    expect(atPatientLimit(1, 100)).toBe(false)
    // sem limite conhecido a tela não bloqueia (o servidor decide)
    expect(atPatientLimit(5, undefined)).toBe(false)
  })

  test('Configurações ABA: rótulo pela licença; sem link da Hotmart quando a licença é PaymentBeta', () => {
    expect(planLabel(null)).toBe('Gratuito')
    expect(planLabel('aba_100')).toBe('ABA 100')
    expect(planLabel('tdah_250', 'Free')).toBe('TDAH 250')
    expect(planLabel(null, 'Free')).toBe('Free')

    expect(abaHotmartUpgrade('aba_100', 'paymentbeta')).toBeNull()
    expect(abaHotmartUpgrade('aba_50', 'paymentbeta')).toBeNull()
    expect(abaHotmartUpgrade(null, null)?.url).toContain('off=5hz0et4m')
    expect(abaHotmartUpgrade('aba_100', 'hotmart')?.url).toContain('off=gona25or')
    expect(abaHotmartUpgrade('aba_100', 'cortesia')?.url).toContain('off=gona25or')
    expect(abaHotmartUpgrade('aba_250', 'hotmart')).toBeNull()

    const src = readFileSync(join(REPO_ROOT, 'app', 'aba', 'configuracoes', 'page.tsx'), 'utf-8')
    expect(src).toContain('abaHotmartUpgrade(planData.plan_key, planData.billing_source)')
    expect(src).toContain('planLabel(planData.plan_key)')
    expect(src).not.toMatch(/tenant_plan|plan_tier|pay\.hotmart\.com/)
  })

  test('Configurações TDAH: rótulo pela licença; aviso da Hotmart só quando não é PaymentBeta', () => {
    const src = readFileSync(join(REPO_ROOT, 'app', 'tdah', 'configuracoes', 'page.tsx'), 'utf-8')
    expect(src).toContain("planLabel(planData.plan_key, 'Free')")
    expect(src).toContain("planData.billing_source === 'paymentbeta'")
    expect(src).not.toMatch(/tenant_plan|plan_tier/)
  })
})

// =====================================================
// 4. Contrato: quem ainda lê plan_tier
// =====================================================

describe('4. plan_tier só em quem grava ou exibe (lista fechada)', () => {
  // Cada arquivo aqui só GRAVA plan_tier ou só EXIBE/EXPORTA; nenhum decide acesso.
  const ALLOWED = [
    'app/admin/components/UserDetail.tsx', // exibe "Plano tenant" e manda o plano no upgrade manual
    'app/admin/components/UserTable.tsx', // tipo da linha da lista do admin
    'app/api/admin/users/route.ts', // lista do admin (exibição)
    'app/api/admin/users/[id]/route.ts', // grava no upgrade manual / rebaixar
    'app/api/tdah/lgpd/export/route.ts', // exportação LGPD dos dados do tenant
    'app/api/user/tenant/route.ts', // grava 'free' no tenant novo
    'app/api/webhook/clerk/route.ts', // grava 'free' no tenant novo
    'app/api/webhook/hotmart/route.ts', // grava na compra/cancelamento Hotmart
    'src/billing/provision.ts', // grava 'free' no tenant novo do PaymentBeta
  ]

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) return name === 'node_modules' || name === 'tests' || name === '__tests__' ? [] : sourceFiles(full)
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
    })
  }

  test('fora dos comentários, só a lista fechada menciona plan_tier', () => {
    const found = [...sourceFiles(join(REPO_ROOT, 'app')), ...sourceFiles(join(REPO_ROOT, 'src'))]
      .filter((file) => {
        const code = readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
        return /plan_tier|tenant_plan/.test(code)
      })
      .map((file) => relative(REPO_ROOT, file).split(sep).join('/'))
      .sort()
    expect(found).toEqual([...ALLOWED].sort())
  })
})
