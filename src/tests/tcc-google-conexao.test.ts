import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'

// =====================================================
// AXIS TCC — Entrega 1C-1: conexão Google confiável
//
// 1  callback confere a permissão da agenda (e o refresh_token); sem isso não grava
// 2  status só da conexão do profissional logado; "conectado de verdade" sem chamar o Google
// 3  canal criado na hora pela função única (callback e rota watch):
//    cria o novo → grava canal + segredo num UPDATE só → para o antigo
// 6  renovação única do token: só invalid_grant marca "acesso perdido" (sync_enabled=false)
// 7  registro único de falha: sem token, e-mail, mensagem ou corpo do Google
// 8  desconectar só o profissional logado; Google primeiro; revoke com o token no corpo
// ABA: o callback do ABA ganha a mesma checagem de escopo
//
// Sem banco: um Postgres falso responde pelo texto da SQL, exige app.tenant_id (RLS)
// e desfaz a transação no ROLLBACK.
// =====================================================

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'
const CLERK_ME = 'user_eu'
const PROFILE_ME = 'aaaaaaaa-0000-4000-8000-000000000001'
const PROFILE_ME_B = 'aaaaaaaa-0000-4000-8000-00000000000b'
const PROFILE_COLLEAGUE = 'aaaaaaaa-0000-4000-8000-000000000002'
const PROFILE_ABA = 'aaaaaaaa-0000-4000-8000-000000000003'
const CALENDAR = 'https://www.googleapis.com/auth/calendar.events'
const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email'
const FULL_SCOPE = `${CALENDAR} ${EMAIL_SCOPE} openid`
const PARTIAL_SCOPE = `${EMAIL_SCOPE} openid`
const GOOGLE_ACCOUNT_EMAIL = 'psicologa.google@teste.com'
const HOUR = 3600 * 1000
const WEBHOOK_ADDRESS = 'https://app.test/api/google/webhook'

// ─── Mocks ───

const mockAuth = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }))

let activeTenantCookie: string | null = null
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'axis_active_tenant' && activeTenantCookie ? { value: activeTenantCookie } : undefined),
  })),
}))

vi.mock('@/src/utils/system-alert', () => ({
  createSystemAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/src/lib/env', () => ({
  env: {
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_REDIRECT_URI: 'https://app.test/api/google/callback',
    NEXT_PUBLIC_APP_URL: 'https://app.test',
  },
}))

const mockCaptureMessage = vi.fn()
const mockCaptureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

vi.mock('@/src/database/db', () => ({
  default: {
    query: (sql: string, params?: unknown[]) => runQuery(sql, params ?? [], newClientState()),
    connect: () => Promise.resolve(makeClient()),
  },
}))

import { GET as callbackGET } from '@/app/api/google/callback/route'
import { GET as statusGET } from '@/app/api/google/status/route'
import { POST as watchPOST } from '@/app/api/google/watch/route'
import { POST as disconnectPOST } from '@/app/api/google/disconnect/route'
import { GET as abaCallbackGET } from '@/app/api/aba/google/callback/route'
import {
  GOOGLE_LONG_TIMEOUT_MS,
  GOOGLE_SHORT_TIMEOUT_MS,
  connectRefusal,
  connectionState,
  googleErrorCode,
  hasCalendarScope,
  requestGoogleAccessToken,
} from '@/src/services/google-connection'

// ─── Postgres falso ───

interface FakeConnection {
  id: string
  tenant_id: string
  user_id: string
  calendar_id: string
  access_token: string
  refresh_token: string
  token_expiry: Date | string | null
  scope: string | null
  sync_enabled: boolean
  created_at: string
  updated_at: number
  webhook_channel_id: string | null
  webhook_resource_id: string | null
  webhook_expiration: Date | string | null
  webhook_token: string | null
}

interface FakeSyncState {
  tenant_id: string
  user_id: string
  last_sync_at: string | null
}

interface AuditRow {
  tenant_id: string
  user_id: string | null
  actor: string
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: any
}

interface ClientState {
  guc: string | null
  snapshot: { connections: FakeConnection[]; syncStates: FakeSyncState[] } | null
  pendingAudits: AuditRow[]
}

let connections: FakeConnection[] = []
let syncStates: FakeSyncState[] = []
let audits: AuditRow[] = []
let queries: Array<{ sql: string; params: unknown[] }> = []
let timeline: string[] = []
let openTransactions = 0
let clock = 0
let connSeq = 0
let profileRows: Array<Record<string, unknown>> = []
let beforeChannelSave: (() => void) | null = null
let failQuery: ((sql: string) => boolean) | null = null

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

function result(rows: Array<Record<string, unknown>> = [], rowCount = rows.length) {
  return { rows, rowCount }
}

function clone<T extends object>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }))
}

function newClientState(): ClientState {
  return { guc: null, snapshot: null, pendingAudits: [] }
}

function makeClient() {
  const state = newClientState()
  return {
    query: (sql: string, params?: unknown[]) => runQuery(sql, params ?? [], state),
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
    else if (token.startsWith("'")) row[column] = token.slice(1, -1)
    else row[column] = token
  })
  return row
}

// RLS forçado (073): toda linha de tenant só com app.tenant_id daquele tenant.
function requireTenant(state: ClientState, tenantId: unknown) {
  if (state.guc !== tenantId) throw new Error(`RLS: app.tenant_id=${state.guc} ≠ ${String(tenantId)}`)
}

function connectionById(state: ClientState, id: unknown): FakeConnection | undefined {
  const row = connections.find((c) => c.id === id)
  if (row) requireTenant(state, row.tenant_id)
  return row
}

async function runQuery(rawSql: string, params: unknown[], state: ClientState) {
  const sql = normalize(rawSql)
  queries.push({ sql, params })

  if (sql === 'BEGIN') {
    openTransactions++
    state.snapshot = { connections: clone(connections), syncStates: clone(syncStates) }
    state.pendingAudits = []
    return result()
  }
  if (sql === 'COMMIT' || sql === 'ROLLBACK') {
    openTransactions--
    if (sql === 'COMMIT') audits.push(...state.pendingAudits)
    else if (state.snapshot) {
      connections = state.snapshot.connections
      syncStates = state.snapshot.syncStates
    }
    state.snapshot = null
    state.pendingAudits = []
    return result()
  }

  timeline.push('sql:' + sql.slice(0, 60))
  if (failQuery?.(sql)) {
    failQuery = null
    throw Object.assign(new Error('falha simulada no banco'), { code: '57014' })
  }

  if (sql.includes("set_config('app.tenant_id'")) {
    state.guc = String(params[0])
    return result()
  }
  if (sql.includes("set_config('app.user_id'")) return result()

  // withTenant (login Clerk)
  if (sql.startsWith('SELECT email FROM profiles')) return result([{ email: 'psicologa@teste.com' }])
  if (sql.startsWith('UPDATE profiles')) return result()
  if (sql.includes('FROM profiles p JOIN tenants t')) return result(profileRows)
  // Callback do ABA (pool, sem clínica ativa)
  if (sql.startsWith('SELECT p.id AS profile_id, p.tenant_id, p.role, p.name FROM profiles p')) {
    return result([{ profile_id: PROFILE_ME, tenant_id: TENANT_A, role: 'terapeuta', name: 'Terapeuta ABA' }])
  }

  // calendar_connections
  if (sql.startsWith('SELECT id, user_id, calendar_id, access_token')) {
    requireTenant(state, params[0])
    const ids = params[1] as string[]
    const rows = connections
      .filter((c) => c.tenant_id === params[0] && ids.includes(c.user_id))
      .sort((a, b) => Number(b.user_id === params[2]) - Number(a.user_id === params[2]) || b.updated_at - a.updated_at)
    return result(clone(rows) as unknown as Array<Record<string, unknown>>)
  }
  if (sql.startsWith('UPDATE calendar_connections SET user_id = $3::text')) {
    requireTenant(state, params[0])
    const [tenantId, clerkId, profileId] = params
    if (!connections.some((c) => c.tenant_id === tenantId && c.user_id === profileId)) {
      for (const c of connections) {
        if (c.tenant_id === tenantId && c.user_id === clerkId) Object.assign(c, { user_id: profileId, updated_at: ++clock })
      }
    }
    return result()
  }
  if (sql.startsWith('INSERT INTO calendar_connections')) {
    requireTenant(state, params[0])
    const [tenantId, userId, access, refresh, expiry, scope] = params
    let row = connections.find((c) => c.tenant_id === tenantId && c.user_id === userId)
    if (row) {
      Object.assign(row, {
        access_token: access,
        refresh_token: sql.includes('COALESCE') ? (refresh ?? row.refresh_token) : refresh,
        token_expiry: expiry,
        scope,
        updated_at: ++clock,
      })
      if (sql.includes('sync_enabled = true')) row.sync_enabled = true
    } else {
      row = makeConnection({
        tenant_id: String(tenantId),
        user_id: String(userId),
        access_token: String(access),
        refresh_token: String(refresh),
        token_expiry: expiry as Date,
        scope: scope as string | null,
      })
      connections.push(row)
    }
    if (!sql.includes('RETURNING')) return result()
    return result([{ id: row.id, webhook_channel_id: row.webhook_channel_id, webhook_resource_id: row.webhook_resource_id }])
  }
  if (sql.startsWith('UPDATE calendar_connections SET webhook_channel_id = $1')) {
    beforeChannelSave?.()
    const row = connectionById(state, params[4])
    if (!row || row.webhook_channel_id !== (params[5] ?? null)) return result([], 0)
    Object.assign(row, {
      webhook_channel_id: params[0],
      webhook_resource_id: params[1],
      webhook_expiration: params[2],
      webhook_token: params[3],
      updated_at: ++clock,
    })
    return result([{ id: row.id }])
  }
  if (sql.startsWith('UPDATE calendar_connections SET access_token = $1, token_expiry = $2')) {
    const row = connectionById(state, params[2])
    if (row) Object.assign(row, { access_token: params[0], token_expiry: params[1], updated_at: ++clock })
    return result([], row ? 1 : 0)
  }
  if (sql.startsWith('UPDATE calendar_connections SET sync_enabled = false')) {
    const row = connectionById(state, params[0])
    if (row) Object.assign(row, { sync_enabled: false, updated_at: ++clock })
    return result([], row ? 1 : 0)
  }
  if (sql.startsWith('DELETE FROM calendar_connections')) {
    requireTenant(state, params[0])
    const ids = params[1] as string[]
    connections = connections.filter((c) => !(c.tenant_id === params[0] && ids.includes(c.id)))
    return result()
  }

  // calendar_sync_state
  if (sql.startsWith('SELECT MAX(last_sync_at) AS last_sync_at FROM calendar_sync_state')) {
    requireTenant(state, params[0])
    const ids = params[1] as string[]
    const values = syncStates
      .filter((s) => s.tenant_id === params[0] && ids.includes(s.user_id) && s.last_sync_at)
      .map((s) => s.last_sync_at as string)
      .sort()
    return result([{ last_sync_at: values.at(-1) ?? null }])
  }
  if (sql.startsWith('DELETE FROM calendar_sync_state')) {
    requireTenant(state, params[0])
    const ids = params[1] as string[]
    syncStates = syncStates.filter((s) => !(s.tenant_id === params[0] && ids.includes(s.user_id)))
    return result()
  }

  // axis_audit_logs (append-only; na transação só vale depois do COMMIT)
  if (sql.startsWith('INSERT INTO axis_audit_logs')) {
    const row = parseInsert(sql, params)
    requireTenant(state, row.tenant_id)
    const audit: AuditRow = {
      tenant_id: String(row.tenant_id),
      user_id: (row.user_id as string | null) ?? null,
      actor: (row.actor as string | undefined) ?? 'human',
      action: String(row.action),
      entity_type: (row.entity_type as string | undefined) ?? null,
      entity_id: (row.entity_id as string | undefined) ?? null,
      metadata: JSON.parse(String(row.metadata)),
    }
    if (state.snapshot) state.pendingAudits.push(audit)
    else audits.push(audit)
    return result()
  }

  throw new Error(`SQL inesperada no teste: ${sql}`)
}

function makeConnection(partial: Partial<FakeConnection> & { tenant_id: string; user_id: string }): FakeConnection {
  return {
    id: `cccccccc-0000-4000-8000-${String(++connSeq).padStart(12, '0')}`,
    calendar_id: 'primary',
    access_token: 'access-antigo',
    refresh_token: 'refresh-antigo',
    token_expiry: new Date(Date.now() + HOUR),
    scope: FULL_SCOPE,
    sync_enabled: true,
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: ++clock,
    webhook_channel_id: null,
    webhook_resource_id: null,
    webhook_expiration: null,
    webhook_token: null,
    ...partial,
  }
}

function seedConnection(partial: Partial<FakeConnection> = {}): FakeConnection {
  const row = makeConnection({ tenant_id: TENANT_A, user_id: PROFILE_ME, ...partial })
  connections.push(row)
  return row
}

// Conexão com canal vivo (o que as 7 conexões boas de produção têm).
function seedLiveConnection(partial: Partial<FakeConnection> = {}): FakeConnection {
  return seedConnection({
    webhook_channel_id: 'canal-antigo',
    webhook_resource_id: 'recurso-antigo',
    webhook_expiration: new Date(Date.now() + 3 * 24 * HOUR),
    ...partial,
  })
}

// ─── Google falso ───

type Reply = { status: number; body?: unknown } | 'hang' | 'network'
type GoogleKind = 'exchange' | 'refresh' | 'userinfo' | 'watch' | 'stop' | 'revoke'

interface GoogleCall {
  kind: GoogleKind
  url: string
  method: string
  auth: string | null
  contentType: string | null
  body: string
  openTransactions: number
  signal?: AbortSignal
}

let google: {
  exchange: Reply
  refresh: Record<string, Reply> // por refresh token; ausente = renova
  userinfo: Reply
  watch: Reply[] // fila; vazia = cria o canal
  stop: (token: string, channelId: string) => Reply
  revoke: Reply
}
let googleCalls: GoogleCall[] = []
let watchSeq = 0

function waitForAbort(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
}

async function reply(answer: Reply, init?: RequestInit): Promise<Response> {
  if (answer === 'hang') return waitForAbort(init?.signal)
  if (answer === 'network') throw new TypeError('fetch failed')
  if (answer.body === undefined) return new Response(null, { status: answer.status })
  return Response.json(answer.body, { status: answer.status })
}

const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  const headers = (init?.headers ?? {}) as Record<string, string>
  const body = init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? '')
  const call = (kind: GoogleKind) => {
    timeline.push('google:' + kind)
    googleCalls.push({
      kind,
      url,
      method: init?.method ?? 'GET',
      auth: headers.Authorization ?? null,
      contentType: headers['Content-Type'] ?? null,
      body,
      openTransactions,
      signal: init?.signal ?? undefined,
    })
  }

  if (url === 'https://oauth2.googleapis.com/token') {
    const form = new URLSearchParams(body)
    if (form.get('grant_type') === 'authorization_code') {
      call('exchange')
      return reply(google.exchange, init)
    }
    call('refresh')
    const answer = google.refresh[form.get('refresh_token') ?? '']
    return reply(answer ?? { status: 200, body: { access_token: 'access-renovado', expires_in: 3599 } }, init)
  }
  if (url.startsWith('https://oauth2.googleapis.com/revoke')) {
    call('revoke')
    return reply(google.revoke, init)
  }
  if (url.startsWith('https://www.googleapis.com/oauth2/v2/userinfo')) {
    call('userinfo')
    return reply(google.userinfo, init)
  }
  if (url.endsWith('/calendars/primary/events/watch')) {
    call('watch')
    const next = google.watch.shift()
    if (next) return reply(next, init)
    const sent = JSON.parse(body)
    return Response.json({ kind: 'api#channel', id: sent.id, resourceId: `recurso-novo-${++watchSeq}`, expiration: String(sent.expiration) })
  }
  if (url.endsWith('/channels/stop')) {
    call('stop')
    const sent = JSON.parse(body)
    return reply(google.stop((headers.Authorization ?? '').replace('Bearer ', ''), sent.id), init)
  }
  throw new Error(`fetch inesperado no teste: ${url}`)
})

// ─── Helpers ───

function oauthRequest(path: string, params: Record<string, string>) {
  const url = new URL('https://app.test' + path)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return { nextUrl: url } as any
}

const tccCallback = (params: Record<string, string> = { code: 'codigo-1', state: CLERK_ME }) =>
  callbackGET(oauthRequest('/api/google/callback', params))
const abaCallback = (params: Record<string, string> = { code: 'codigo-1', state: CLERK_ME }) =>
  abaCallbackGET(oauthRequest('/api/aba/google/callback', params))

const redirectCode = (res: Response) => new URL(res.headers.get('location') ?? 'https://x.test').searchParams.get('google')
const auditsOf = (action: string) => audits.filter((a) => a.action === action)
const kinds = () => googleCalls.map((c) => c.kind)
const callsOf = (kind: GoogleKind) => googleCalls.filter((c) => c.kind === kind)
const connectionWrites = () => queries.filter((q) => q.sql.startsWith('INSERT INTO calendar_connections'))
const mine = () => connections.filter((c) => c.tenant_id === TENANT_A && (c.user_id === PROFILE_ME || c.user_id === CLERK_ME))
const hmac = (secret: string, channelId: string) => createHmac('sha256', secret).update(channelId).digest('hex')
const indexOf = (prefix: string) => timeline.findIndex((entry) => entry.startsWith(prefix))

// Deixa a cadeia de promessas andar (sem avançar o relógio falso) até a condição valer.
async function until(condition: () => boolean) {
  for (let i = 0; i < 200 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve))
  expect(condition()).toBe(true)
}

let errorSpy: { mock: { calls: unknown[][] } }

beforeEach(() => {
  connections = []
  syncStates = []
  audits = []
  queries = []
  timeline = []
  openTransactions = 0
  clock = 0
  connSeq = 0
  watchSeq = 0
  beforeChannelSave = null
  failQuery = null
  activeTenantCookie = null
  profileRows = [{ profile_id: PROFILE_ME, tenant_id: TENANT_A, role: 'admin', tenant_name: 'Clínica A', plan_tier: 'free' }]
  google = {
    exchange: {
      status: 200,
      body: { access_token: 'access-novo', refresh_token: 'refresh-novo', expires_in: 3599, scope: FULL_SCOPE, token_type: 'Bearer' },
    },
    refresh: {},
    userinfo: { status: 200, body: { email: GOOGLE_ACCOUNT_EMAIL } },
    watch: [],
    stop: () => ({ status: 204 }),
    revoke: { status: 200, body: {} },
  }
  googleCalls = []
  mockAuth.mockResolvedValue({ userId: CLERK_ME })
  mockCaptureMessage.mockClear()
  mockCaptureException.mockClear()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ═════════════════════════════════════════════════════
// Funções puras
// ═════════════════════════════════════════════════════

describe('funções puras', () => {
  test('hasCalendarScope aceita calendar.events e calendar; recusa "userinfo.email openid", vazio e null', () => {
    expect(hasCalendarScope(FULL_SCOPE)).toBe(true)
    expect(hasCalendarScope('openid https://www.googleapis.com/auth/calendar')).toBe(true)
    expect(hasCalendarScope(PARTIAL_SCOPE)).toBe(false)
    expect(hasCalendarScope('https://www.googleapis.com/auth/calendar.readonly')).toBe(false)
    expect(hasCalendarScope('')).toBe(false)
    expect(hasCalendarScope(null)).toBe(false)
  })

  test('connectRefusal: sem agenda → missing_calendar_scope; sem refresh_token → missing_refresh_token; completo → null', () => {
    expect(connectRefusal({ scope: PARTIAL_SCOPE, refresh_token: 'r' })).toBe('missing_calendar_scope')
    expect(connectRefusal({ scope: FULL_SCOPE })).toBe('missing_refresh_token')
    expect(connectRefusal({ scope: FULL_SCOPE, refresh_token: '' })).toBe('missing_refresh_token')
    expect(connectRefusal({ scope: FULL_SCOPE, refresh_token: 'r' })).toBeNull()
  })

  const now = new Date('2026-09-29T12:00:00.000Z')
  const healthy = {
    scope: FULL_SCOPE,
    sync_enabled: true,
    webhook_channel_id: 'canal',
    webhook_expiration: new Date('2026-10-02T12:00:00.000Z'),
  }

  test('connectionState: sem agenda → needs_reconnect/missing_calendar_scope, mesmo com canal vivo', () => {
    expect(connectionState({ ...healthy, scope: PARTIAL_SCOPE }, now)).toEqual({ state: 'needs_reconnect', reason: 'missing_calendar_scope' })
  })

  test('connectionState: sync_enabled=false → needs_reconnect/access_lost', () => {
    expect(connectionState({ ...healthy, sync_enabled: false }, now)).toEqual({ state: 'needs_reconnect', reason: 'access_lost' })
  })

  test('connectionState: canal nulo ou vencido → channel_inactive', () => {
    expect(connectionState({ ...healthy, webhook_channel_id: null }, now).state).toBe('channel_inactive')
    expect(connectionState({ ...healthy, webhook_expiration: new Date('2026-09-29T11:59:00.000Z') }, now).state).toBe('channel_inactive')
    expect(connectionState({ ...healthy, webhook_expiration: null }, now).state).toBe('channel_inactive')
  })

  test('connectionState: canal vivo e acesso ok → ok (vencimento do access token não entra na regra)', () => {
    expect(connectionState(healthy, now)).toEqual({ state: 'ok', reason: null })
  })

  test('googleErrorCode lê error (OAuth) e errors[0].reason / status (Agenda); nunca a mensagem', () => {
    expect(googleErrorCode({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' })).toBe('invalid_grant')
    expect(
      googleErrorCode({
        error: { code: 403, message: `Negado para ${GOOGLE_ACCOUNT_EMAIL}`, errors: [{ reason: 'insufficientPermissions', message: 'x' }], status: 'PERMISSION_DENIED' },
      })
    ).toBe('insufficientPermissions')
    expect(googleErrorCode({ error: { code: 403, message: 'x', status: 'PERMISSION_DENIED' } })).toBe('PERMISSION_DENIED')
    expect(googleErrorCode({ error: `texto livre com ${GOOGLE_ACCOUNT_EMAIL}` })).toBeNull()
    expect(googleErrorCode({ error: { message: 'só mensagem' } })).toBeNull()
    expect(googleErrorCode('texto')).toBeNull()
    expect(googleErrorCode(null)).toBeNull()
  })

  test('requestGoogleAccessToken: só 400 invalid_grant é perda definitiva do acesso', async () => {
    const cases: Array<[Reply, { httpStatus: number | string; googleCode: string | null; definitive: boolean }]> = [
      [{ status: 400, body: { error: 'invalid_grant' } }, { httpStatus: 400, googleCode: 'invalid_grant', definitive: true }],
      [{ status: 400, body: { error: 'invalid_request' } }, { httpStatus: 400, googleCode: 'invalid_request', definitive: false }],
      [{ status: 401, body: { error: 'invalid_client' } }, { httpStatus: 401, googleCode: 'invalid_client', definitive: false }],
      [{ status: 429, body: { error: 'rate_limit_exceeded' } }, { httpStatus: 429, googleCode: 'rate_limit_exceeded', definitive: false }],
      [{ status: 500 }, { httpStatus: 500, googleCode: null, definitive: false }],
      [
        { status: 403, body: { error: { code: 403, errors: [{ reason: 'rateLimitExceeded' }] } } },
        { httpStatus: 403, googleCode: 'rateLimitExceeded', definitive: false },
      ],
      ['network', { httpStatus: 'network', googleCode: null, definitive: false }],
    ]
    for (const [answer, expected] of cases) {
      google.refresh['refresh-x'] = answer
      expect(await requestGoogleAccessToken('refresh-x')).toEqual({ ok: false, ...expected })
    }

    google.refresh['refresh-x'] = { status: 200, body: { access_token: 'novo', expires_in: 3599 } }
    const ok = await requestGoogleAccessToken('refresh-x')
    expect(ok).toMatchObject({ ok: true, accessToken: 'novo' })
    if (ok.ok) expect(Math.abs(ok.expiresAt.getTime() - (Date.now() + 3599 * 1000))).toBeLessThan(5000)
  })

  test('googleFetch: Google sem resposta no prazo → http_status "timeout"', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    google.refresh['refresh-lento'] = 'hang'

    const pending = requestGoogleAccessToken('refresh-lento')
    await until(() => callsOf('refresh').length === 1)
    await vi.advanceTimersByTimeAsync(GOOGLE_SHORT_TIMEOUT_MS)

    expect(await pending).toEqual({ ok: false, httpStatus: 'timeout', googleCode: null, definitive: false })
    expect(callsOf('refresh')[0].signal?.aborted).toBe(true)
  })
})

// ═════════════════════════════════════════════════════
// 1 — callback confere a permissão da agenda
// ═════════════════════════════════════════════════════

describe('1 — callback TCC confere o escopo', () => {
  test('sem calendar.events: não grava, volta missing_calendar_scope, audit sem e-mail/token e sem revogar', async () => {
    google.exchange = { status: 200, body: { access_token: 'access-novo', refresh_token: 'refresh-novo', expires_in: 3599, scope: PARTIAL_SCOPE } }

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('missing_calendar_scope')
    expect(res.headers.get('location')).toBe('https://app.test/configuracoes?google=missing_calendar_scope')
    expect(connectionWrites()).toHaveLength(0)
    expect(connections).toHaveLength(0)
    expect(kinds()).toEqual(['exchange'])

    const [refused] = auditsOf('GOOGLE_CALENDAR_CONNECT_REFUSED')
    expect(refused).toMatchObject({
      tenant_id: TENANT_A,
      user_id: CLERK_ME,
      metadata: { product: 'axis_tcc', profile_id: PROFILE_ME, reason: 'missing_calendar_scope', granted_scopes: ['userinfo.email', 'openid'] },
    })
    const serialized = JSON.stringify(audits)
    expect(serialized).not.toContain('access-novo')
    expect(serialized).not.toContain('refresh-novo')
    expect(serialized).not.toContain(GOOGLE_ACCOUNT_EMAIL)
  })

  test('sem calendar.events: a conexão que já existia fica igual', async () => {
    seedLiveConnection({ webhook_token: 'segredo-antigo' })
    const before = clone(connections)
    google.exchange = { status: 200, body: { access_token: 'access-novo', refresh_token: 'refresh-novo', expires_in: 3599, scope: PARTIAL_SCOPE } }

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('missing_calendar_scope')
    expect(connections).toEqual(before)
    expect(kinds()).not.toContain('stop')
  })

  test('sem refresh_token: não grava e volta missing_calendar_scope (motivo no audit)', async () => {
    google.exchange = { status: 200, body: { access_token: 'access-novo', expires_in: 3599, scope: FULL_SCOPE } }

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('missing_calendar_scope')
    expect(connectionWrites()).toHaveLength(0)
    expect(auditsOf('GOOGLE_CALENDAR_CONNECT_REFUSED')[0].metadata.reason).toBe('missing_refresh_token')
  })

  test('aceita o escopo amplo "calendar"', async () => {
    google.exchange = {
      status: 200,
      body: { access_token: 'access-novo', refresh_token: 'refresh-novo', expires_in: 3599, scope: 'openid https://www.googleapis.com/auth/calendar' },
    }

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('success')
    expect(mine()).toHaveLength(1)
  })

  test('com agenda: grava tokens, scope e sync_enabled=true (volta a true depois de acesso perdido)', async () => {
    seedConnection({ sync_enabled: false, scope: PARTIAL_SCOPE })

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('success')
    expect(mine()).toHaveLength(1)
    expect(mine()[0]).toMatchObject({
      user_id: PROFILE_ME,
      access_token: 'access-novo',
      refresh_token: 'refresh-novo',
      scope: FULL_SCOPE,
      sync_enabled: true,
    })
    expect(auditsOf('GOOGLE_CALENDAR_CONNECTED')[0].metadata).toEqual({
      google_email: GOOGLE_ACCOUNT_EMAIL,
      profile_id: PROFILE_ME,
      product: 'axis_tcc',
    })
  })

  test('usa a clínica ativa (cookie) quando o usuário tem 2 clínicas', async () => {
    profileRows = [
      { profile_id: PROFILE_ME, tenant_id: TENANT_A, role: 'admin', tenant_name: 'Clínica A', plan_tier: 'free' },
      { profile_id: PROFILE_ME_B, tenant_id: TENANT_B, role: 'terapeuta', tenant_name: 'Clínica B', plan_tier: 'free' },
    ]
    activeTenantCookie = TENANT_B

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('success')
    expect(connections).toHaveLength(1)
    expect(connections[0]).toMatchObject({ tenant_id: TENANT_B, user_id: PROFILE_ME_B })
  })

  test('2 clínicas sem clínica escolhida: volta tenant_error sem trocar o código', async () => {
    profileRows = [
      { profile_id: PROFILE_ME, tenant_id: TENANT_A, role: 'admin', tenant_name: 'Clínica A', plan_tier: 'free' },
      { profile_id: PROFILE_ME_B, tenant_id: TENANT_B, role: 'terapeuta', tenant_name: 'Clínica B', plan_tier: 'free' },
    ]

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('tenant_error')
    expect(googleCalls).toHaveLength(0)
    expect(connections).toHaveLength(0)
  })

  test('troca do código recusada: token_error e falha registrada (token_exchange/400/invalid_grant) sem corpo', async () => {
    google.exchange = { status: 400, body: { error: 'invalid_grant', error_description: `Bad Request ${GOOGLE_ACCOUNT_EMAIL}` } }

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('token_error')
    expect(connectionWrites()).toHaveLength(0)
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')[0].metadata).toEqual({
      origin: 'callback',
      step: 'token_exchange',
      http_status: 400,
      google_code: 'invalid_grant',
    })
    expect(JSON.stringify([mockCaptureMessage.mock.calls, errorSpy.mock.calls, audits])).not.toContain('Bad Request')
  })

  test('usuário cancelou na tela do Google: volta access_denied', async () => {
    const res = await tccCallback({ error: 'access_denied', state: CLERK_ME })

    expect(redirectCode(res)).toBe('access_denied')
    expect(googleCalls).toHaveLength(0)
  })

  test('conexão antiga gravada com o id do Clerk vira a do perfil (sem segunda linha)', async () => {
    const legacy = seedLiveConnection({ user_id: CLERK_ME })

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('success')
    expect(mine()).toHaveLength(1)
    expect(mine()[0]).toMatchObject({ id: legacy.id, user_id: PROFILE_ME, access_token: 'access-novo' })
    expect(callsOf('stop')[0].body).toContain('canal-antigo')
  })
})

// ═════════════════════════════════════════════════════
// 3 — canal criado na hora (função única): callback e rota watch
// ═════════════════════════════════════════════════════

describe('3 — canal pela função única', () => {
  test('callback cria o canal depois de gravar os tokens, no endereço do webhook do TCC', async () => {
    const res = await tccCallback()

    expect(redirectCode(res)).toBe('success')
    expect(callsOf('watch')).toHaveLength(1)
    const sent = JSON.parse(callsOf('watch')[0].body)
    expect(sent).toMatchObject({ type: 'web_hook', address: WEBHOOK_ADDRESS })
    expect(callsOf('watch')[0].auth).toBe('Bearer access-novo')
    expect(indexOf('sql:INSERT INTO calendar_connections')).toBeLessThan(timeline.indexOf('google:watch'))
    expect(mine()[0]).toMatchObject({ webhook_channel_id: sent.id, webhook_resource_id: 'recurso-novo-1' })
    expect(auditsOf('GOOGLE_WEBHOOK_REGISTERED')[0].metadata).toMatchObject({ origin: 'callback', channel_id: sent.id })
  })

  test('canal e segredo no mesmo UPDATE; o token enviado ao Google é HMAC(segredo, id do canal)', async () => {
    await tccCallback()

    const row = mine()[0]
    const sent = JSON.parse(callsOf('watch')[0].body)
    expect(row.webhook_token).toMatch(/^[0-9a-f]{64}$/)
    expect(sent.token).toBe(hmac(row.webhook_token as string, row.webhook_channel_id as string))

    const saves = queries.filter((q) => q.sql.startsWith('UPDATE calendar_connections SET webhook_channel_id'))
    expect(saves).toHaveLength(1)
    expect(saves[0].sql).toContain('webhook_token = $4')
  })

  test('reconectar: cria o novo, grava, e só então para o antigo com o token antigo', async () => {
    seedLiveConnection({ access_token: 'access-antigo' })

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('success')
    const stops = callsOf('stop')
    expect(stops).toHaveLength(1)
    expect(stops[0].auth).toBe('Bearer access-antigo')
    expect(JSON.parse(stops[0].body)).toEqual({ id: 'canal-antigo', resourceId: 'recurso-antigo' })
    expect(indexOf('sql:UPDATE calendar_connections SET webhook_channel_id')).toBeLessThan(timeline.indexOf('google:stop'))
    expect(mine()[0].webhook_channel_id).not.toBe('canal-antigo')
    expect(auditsOf('GOOGLE_WEBHOOK_REGISTERED')[0].metadata.replaced_previous).toBe(true)
  })

  test('reconectar com o token antigo morto: para o canal antigo com o token novo', async () => {
    seedLiveConnection({ token_expiry: new Date(Date.now() - HOUR) })
    google.refresh['refresh-antigo'] = { status: 400, body: { error: 'invalid_grant' } }

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('success')
    expect(callsOf('stop').map((c) => c.auth)).toEqual(['Bearer access-novo'])
    // Token antigo renovado só em memória: nada é gravado nem marcado na conexão nova.
    expect(mine()[0]).toMatchObject({ access_token: 'access-novo', sync_enabled: true })
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')).toHaveLength(0)
  })

  test('canal antigo não para com nenhum token: registra stop_old e a conexão segue com o canal novo', async () => {
    seedLiveConnection()
    google.stop = () => ({ status: 500, body: { error: { code: 500, message: 'Backend Error', errors: [{ reason: 'backendError' }] } } })

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('success')
    expect(callsOf('stop').map((c) => c.auth)).toEqual(['Bearer access-antigo', 'Bearer access-novo'])
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')[0].metadata).toEqual({
      origin: 'callback',
      step: 'stop_old',
      http_status: 500,
      google_code: 'backendError',
    })
    expect(mine()[0].webhook_channel_id).not.toBe('canal-antigo')
  })

  test('404 ao parar o canal antigo é "já parado" (não é falha)', async () => {
    seedLiveConnection()
    google.stop = () => ({ status: 404, body: { error: { code: 404, errors: [{ reason: 'notFound' }] } } })

    await tccCallback()

    expect(callsOf('stop')).toHaveLength(1)
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')).toHaveLength(0)
  })

  test('canal recusado no callback: conexão fica gravada e volta connected_no_channel', async () => {
    google.watch = [
      {
        status: 403,
        body: { error: { code: 403, message: `Insufficient Permission ${GOOGLE_ACCOUNT_EMAIL}`, errors: [{ reason: 'insufficientPermissions' }] } },
      },
    ]

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('connected_no_channel')
    expect(mine()[0]).toMatchObject({ access_token: 'access-novo', webhook_channel_id: null, webhook_token: null })
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')[0].metadata).toEqual({
      origin: 'callback',
      step: 'watch',
      http_status: 403,
      google_code: 'insufficientPermissions',
    })
  })

  test('corrida: canal trocado por outro processo antes de gravar → não sobrescreve e para o recém-criado', async () => {
    seedLiveConnection()
    beforeChannelSave = () => {
      mine()[0].webhook_channel_id = 'canal-do-cron'
      beforeChannelSave = null
    }

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('connected_no_channel')
    const created = JSON.parse(callsOf('watch')[0].body).id
    expect(callsOf('stop').map((c) => JSON.parse(c.body).id)).toEqual([created])
    expect(mine()[0].webhook_channel_id).toBe('canal-do-cron')
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE').map((a) => a.metadata.step)).toEqual(['save'])
  })

  test('audit da falha fica gravado em transação própria (sobrevive ao ROLLBACK da gravação do canal)', async () => {
    failQuery = (sql) => sql.startsWith('INSERT INTO axis_audit_logs') && sql.includes('GOOGLE_WEBHOOK_REGISTERED')

    const res = await tccCallback()

    expect(redirectCode(res)).toBe('connected_no_channel')
    // ROLLBACK desfez o canal e o audit de registro; o audit da falha entrou depois, sozinho.
    expect(mine()[0]).toMatchObject({ webhook_channel_id: null, webhook_token: null })
    expect(auditsOf('GOOGLE_WEBHOOK_REGISTERED')).toHaveLength(0)
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE').map((a) => a.metadata.step)).toEqual(['save'])
    // O canal criado no Google foi parado.
    expect(callsOf('stop')).toHaveLength(1)
  })

  test('watch usa a conexão do profissional logado, não a de colega do mesmo tenant', async () => {
    const colleague = seedLiveConnection({ user_id: PROFILE_COLLEAGUE, access_token: 'access-colega' })
    const colleagueBefore = { ...colleague }
    seedConnection({ access_token: 'access-meu' })

    const res = await watchPOST()

    expect(res.status).toBe(200)
    expect(callsOf('watch')[0].auth).toBe('Bearer access-meu')
    expect(mine()[0].webhook_channel_id).toBe(JSON.parse(callsOf('watch')[0].body).id)
    expect(connections.find((c) => c.user_id === PROFILE_COLLEAGUE)).toEqual(colleagueBefore)
    expect(kinds()).toEqual(['watch'])
  })

  test('watch: resposta de erro não traz o corpo do Google', async () => {
    seedConnection()
    google.watch = [
      {
        status: 403,
        body: { error: { code: 403, message: `Negado para ${GOOGLE_ACCOUNT_EMAIL} (Paciente Alfa)`, errors: [{ reason: 'insufficientPermissions' }] } },
      },
    ]

    const res = await watchPOST()
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body).toEqual({ error: 'Não foi possível ativar a atualização automática agora.', step: 'watch' })
  })

  test('callback e watch mandam ao Google o mesmo formato de canal', async () => {
    await tccCallback()
    await watchPOST()

    const [fromCallback, fromWatch] = callsOf('watch').map((c) => JSON.parse(c.body))
    expect(Object.keys(fromCallback).sort()).toEqual(['address', 'expiration', 'id', 'token', 'type'])
    expect(Object.keys(fromWatch).sort()).toEqual(Object.keys(fromCallback).sort())
    expect(fromWatch.address).toBe(fromCallback.address)
    expect(fromWatch.id).not.toBe(fromCallback.id)
    const row = mine()[0]
    expect(fromWatch.token).toBe(hmac(row.webhook_token as string, fromWatch.id))
    // O watch trocou o canal do callback: parou o anterior depois de gravar o novo.
    expect(JSON.parse(callsOf('stop')[0].body).id).toBe(fromCallback.id)
  })

  test('watch: access token vencido é renovado e gravado antes de criar o canal', async () => {
    seedConnection({ token_expiry: new Date(Date.now() - HOUR) })

    const res = await watchPOST()

    expect(res.status).toBe(200)
    expect(kinds()).toEqual(['refresh', 'watch'])
    expect(callsOf('watch')[0].auth).toBe('Bearer access-renovado')
    expect(mine()[0].access_token).toBe('access-renovado')
    expect(new Date(mine()[0].token_expiry as Date).getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000)
  })

  test('watch: refresh invalid_grant → 409 access_lost, sync_enabled=false e falha registrada', async () => {
    seedConnection({ token_expiry: new Date(Date.now() - HOUR) })
    google.refresh['refresh-antigo'] = { status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } }

    const res = await watchPOST()

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ reason: 'access_lost' })
    expect(kinds()).toEqual(['refresh'])
    expect(mine()[0].sync_enabled).toBe(false)
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')[0]).toMatchObject({
      actor: 'system',
      user_id: CLERK_ME,
      entity_type: 'calendar_connection',
      entity_id: mine()[0].id,
      metadata: { origin: 'watch', step: 'refresh', http_status: 400, google_code: 'invalid_grant' },
    })
  })

  test('watch: refresh sem resposta → 502 e o acesso NÃO é marcado como perdido', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    seedConnection({ token_expiry: new Date(Date.now() - HOUR) })
    google.refresh['refresh-antigo'] = 'hang'

    const pending = watchPOST()
    await until(() => callsOf('refresh').length === 1)
    await vi.advanceTimersByTimeAsync(GOOGLE_SHORT_TIMEOUT_MS)
    const res = await pending

    expect(res.status).toBe(502)
    expect(mine()[0].sync_enabled).toBe(true)
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')[0].metadata).toMatchObject({ step: 'refresh', http_status: 'timeout' })
  })

  test('watch: Google sem resposta ao criar o canal (8 s) → 502 e falha watch/timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    seedConnection()
    google.watch = ['hang']

    const pending = watchPOST()
    await until(() => callsOf('watch').length === 1)
    await vi.advanceTimersByTimeAsync(GOOGLE_LONG_TIMEOUT_MS)
    const res = await pending

    expect(res.status).toBe(502)
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')[0].metadata).toMatchObject({ step: 'watch', http_status: 'timeout' })
  })

  test('watch: conexão sem agenda → 409 sem chamar o Google', async () => {
    seedConnection({ scope: PARTIAL_SCOPE })

    const res = await watchPOST()

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ reason: 'missing_calendar_scope' })
    expect(googleCalls).toHaveLength(0)
  })

  test('nenhuma chamada ao Google com transação aberta (callback, watch e desconectar)', async () => {
    seedLiveConnection({ token_expiry: new Date(Date.now() - HOUR) })

    await tccCallback()
    connections[0].token_expiry = new Date(Date.now() - HOUR)
    await watchPOST()
    connections[0].token_expiry = new Date(Date.now() - HOUR)
    await disconnectPOST()

    expect(googleCalls.length).toBeGreaterThanOrEqual(8)
    expect(googleCalls.every((c) => c.openTransactions === 0)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════
// 7 — registro único de falha
// ═════════════════════════════════════════════════════

describe('7 — registro de falha', () => {
  test('log, Sentry e audit sem token, segredo, e-mail, mensagem nem corpo do Google', async () => {
    seedConnection({ access_token: 'access-secreto', refresh_token: 'refresh-secreto' })
    google.watch = [
      {
        status: 403,
        body: {
          error: {
            code: 403,
            message: `Acesso negado para ${GOOGLE_ACCOUNT_EMAIL}`,
            errors: [{ reason: 'insufficientPermissions', message: 'detalhe interno' }],
          },
        },
      },
    ]

    await watchPOST()

    const channelToken = JSON.parse(callsOf('watch')[0].body).token
    const recorded = JSON.stringify([errorSpy.mock.calls, mockCaptureMessage.mock.calls, auditsOf('GOOGLE_CALENDAR_FAILURE')])
    for (const secret of ['access-secreto', 'refresh-secreto', channelToken, GOOGLE_ACCOUNT_EMAIL, 'Acesso negado', 'detalhe interno']) {
      expect(recorded).not.toContain(secret)
    }

    const [, options] = mockCaptureMessage.mock.calls[0] as [string, { tags: Record<string, string>; extra: Record<string, unknown> }]
    expect(options.tags).toEqual({
      area: 'google_calendar_connection',
      origin: 'watch',
      step: 'watch',
      http_status: '403',
      google_code: 'insufficientPermissions',
    })
    expect(Object.keys(options.tags).some((key) => key.toLowerCase().includes('token'))).toBe(false)
    expect(options.extra).toEqual({ tenant_id: TENANT_A, connection_id: mine()[0].id })
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')[0].metadata).toEqual({
      origin: 'watch',
      step: 'watch',
      http_status: 403,
      google_code: 'insufficientPermissions',
    })
  })
})

// ═════════════════════════════════════════════════════
// 2 — status: só o profissional logado, sem chamar o Google
// ═════════════════════════════════════════════════════

describe('2 — status', () => {
  async function status() {
    const res = await statusGET()
    return res.json()
  }

  test('só a conexão do profissional logado (colega e terapeuta ABA do tenant não contam)', async () => {
    seedLiveConnection({ user_id: PROFILE_COLLEAGUE })
    seedLiveConnection({ user_id: PROFILE_ABA })

    expect(await status()).toEqual({ connected: false })

    seedConnection({ calendar_id: 'minha-agenda' })
    expect(await status()).toMatchObject({ connected: true, calendar_id: 'minha-agenda', state: 'channel_inactive' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('access token vencido com canal vivo → ok e token_expired=false (fim de "Conectado" + "Token expirado")', async () => {
    seedLiveConnection({ token_expiry: new Date(Date.now() - 2 * HOUR) })

    expect(await status()).toMatchObject({ connected: true, state: 'ok', reason: null, token_expired: false, webhook_active: true })
  })

  test('sem agenda → connected=false, token_expired=true, needs_reconnect/missing_calendar_scope', async () => {
    seedLiveConnection({ scope: PARTIAL_SCOPE })

    expect(await status()).toMatchObject({
      connected: false,
      state: 'needs_reconnect',
      reason: 'missing_calendar_scope',
      token_expired: true,
    })
  })

  test('sync_enabled=false → needs_reconnect/access_lost', async () => {
    seedLiveConnection({ sync_enabled: false })

    expect(await status()).toMatchObject({ connected: false, state: 'needs_reconnect', reason: 'access_lost' })
  })

  test('canal vencido → channel_inactive, connected=true, webhook_active=false', async () => {
    seedLiveConnection({ webhook_expiration: new Date(Date.now() - 60 * 1000) })

    expect(await status()).toMatchObject({ connected: true, state: 'channel_inactive', webhook_active: false, token_expired: false })
  })

  test('last_sync_at = maior valor entre o id do perfil e o id do Clerk', async () => {
    seedLiveConnection()
    syncStates = [
      { tenant_id: TENANT_A, user_id: PROFILE_ME, last_sync_at: '2026-09-20T10:00:00.000Z' },
      { tenant_id: TENANT_A, user_id: CLERK_ME, last_sync_at: '2026-09-28T10:00:00.000Z' },
      { tenant_id: TENANT_A, user_id: PROFILE_COLLEAGUE, last_sync_at: '2026-09-29T10:00:00.000Z' },
    ]

    expect((await status()).last_sync_at).toBe('2026-09-28T10:00:00.000Z')
  })

  test('acha conexão antiga gravada com o id do Clerk', async () => {
    seedLiveConnection({ user_id: CLERK_ME })

    expect(await status()).toMatchObject({ connected: true, state: 'ok' })
  })

  test('status nunca chama o Google, em nenhum estado', async () => {
    seedLiveConnection({ token_expiry: new Date(Date.now() - 2 * HOUR), sync_enabled: false })
    await status()
    connections[0].sync_enabled = true
    connections[0].webhook_expiration = null
    await status()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('tela do TDAH: nenhum estado devolve connected=true junto com token_expired=true', async () => {
    const scenarios: Array<Partial<FakeConnection>> = [
      {},
      { token_expiry: new Date(Date.now() - 2 * HOUR) },
      { webhook_expiration: null, webhook_channel_id: null },
      { scope: PARTIAL_SCOPE },
      { sync_enabled: false },
    ]
    for (const scenario of scenarios) {
      connections = []
      seedLiveConnection(scenario)
      const body = await status()
      expect(body.connected && body.token_expired).toBe(false)
    }
  })
})

// ═════════════════════════════════════════════════════
// 8 — desconectar
// ═════════════════════════════════════════════════════

describe('8 — desconectar', () => {
  test('apaga só a conexão e o sync_state (ids perfil e Clerk) do profissional logado', async () => {
    seedLiveConnection()
    seedConnection({ user_id: CLERK_ME })
    const colleague = seedLiveConnection({ user_id: PROFILE_COLLEAGUE })
    const aba = seedLiveConnection({ user_id: PROFILE_ABA })
    syncStates = [
      { tenant_id: TENANT_A, user_id: PROFILE_ME, last_sync_at: null },
      { tenant_id: TENANT_A, user_id: CLERK_ME, last_sync_at: null },
      { tenant_id: TENANT_A, user_id: PROFILE_COLLEAGUE, last_sync_at: null },
    ]

    const res = await disconnectPOST()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, message: 'Google Calendar desconectado', google_revoked: true })
    expect(connections.map((c) => c.id)).toEqual([colleague.id, aba.id])
    expect(syncStates.map((s) => s.user_id)).toEqual([PROFILE_COLLEAGUE])
    const [disconnected] = auditsOf('GOOGLE_CALENDAR_DISCONNECTED')
    expect(disconnected.metadata).toMatchObject({ product: 'axis_tcc', profile_id: PROFILE_ME })
    expect(disconnected.metadata.connections).toHaveLength(2)
  })

  test('colega e terapeuta ABA do mesmo tenant ficam intactos (canal e tokens)', async () => {
    seedLiveConnection()
    const colleague = { ...seedLiveConnection({ user_id: PROFILE_COLLEAGUE, webhook_channel_id: 'canal-colega' }) }
    const aba = { ...seedLiveConnection({ user_id: PROFILE_ABA, webhook_channel_id: 'canal-aba' }) }

    await disconnectPOST()

    expect(connections).toEqual([colleague, aba])
    expect(callsOf('stop').map((c) => JSON.parse(c.body).id)).toEqual(['canal-antigo'])
    expect(callsOf('revoke')).toHaveLength(1)
  })

  test('para o canal renovando o token em memória quando o access token venceu', async () => {
    seedLiveConnection({ token_expiry: new Date(Date.now() - HOUR) })

    await disconnectPOST()

    expect(kinds()).toEqual(['refresh', 'stop', 'revoke'])
    expect(callsOf('stop')[0].auth).toBe('Bearer access-renovado')
    expect(queries.some((q) => q.sql.startsWith('UPDATE calendar_connections'))).toBe(false)
  })

  test('revoga com POST form-urlencoded e o refresh_token no corpo; nada na URL', async () => {
    seedLiveConnection()

    await disconnectPOST()

    const [revoke] = callsOf('revoke')
    expect(revoke).toMatchObject({
      url: 'https://oauth2.googleapis.com/revoke',
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      body: 'token=refresh-antigo',
    })
    expect(revoke.url).not.toContain('?')
    expect(revoke.url).not.toContain('access-antigo')
  })

  test('revoke recusado: apaga mesmo assim, audit com revoke=failed e status, Sentry avisado, google_revoked=false', async () => {
    seedLiveConnection()
    google.revoke = { status: 400, body: { error: 'invalid_token', error_description: 'Token expired or revoked' } }

    const res = await disconnectPOST()

    expect(await res.json()).toMatchObject({ success: true, google_revoked: false })
    expect(mine()).toHaveLength(0)
    expect(auditsOf('GOOGLE_CALENDAR_DISCONNECTED')[0].metadata.connections[0]).toMatchObject({
      stop: 'stopped',
      revoke: 'failed',
      revoke_http_status: 400,
      revoke_google_code: 'invalid_token',
    })
    expect(mockCaptureMessage.mock.calls[0][1]).toMatchObject({ tags: { origin: 'disconnect', step: 'revoke', google_code: 'invalid_token' } })
    // O resultado já está no audit do desconectar: sem audit de falha em dobro.
    expect(auditsOf('GOOGLE_CALENDAR_FAILURE')).toHaveLength(0)
  })

  test('parar o canal sem resposta do Google: apaga mesmo assim e o audit registra stop=failed/timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    seedLiveConnection()
    google.stop = () => 'hang'

    const pending = disconnectPOST()
    await until(() => callsOf('stop').length === 1)
    await vi.advanceTimersByTimeAsync(GOOGLE_SHORT_TIMEOUT_MS)
    const res = await pending

    expect(res.status).toBe(200)
    expect(mine()).toHaveLength(0)
    expect(auditsOf('GOOGLE_CALENDAR_DISCONNECTED')[0].metadata.connections[0]).toMatchObject({
      stop: 'failed',
      stop_http_status: 'timeout',
      revoke: 'revoked',
    })
  })

  test('sem conexão do profissional → 400 e nada é apagado', async () => {
    const colleague = seedLiveConnection({ user_id: PROFILE_COLLEAGUE })

    const res = await disconnectPOST()

    expect(res.status).toBe(400)
    expect(connections).toEqual([colleague])
    expect(audits).toHaveLength(0)
    expect(googleCalls).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════
// ABA — mesma checagem de escopo no callback do ABA
// ═════════════════════════════════════════════════════

describe('ABA — callback confere o escopo', () => {
  test('callback ABA sem agenda não grava e volta token_error (código que a tela do ABA já mostra)', async () => {
    google.exchange = { status: 200, body: { access_token: 'access-novo', refresh_token: 'refresh-novo', expires_in: 3599, scope: PARTIAL_SCOPE } }

    const res = await abaCallback()

    expect(res.headers.get('location')).toBe('https://app.test/aba/configuracoes?google=token_error')
    expect(connectionWrites()).toHaveLength(0)
    expect(auditsOf('GOOGLE_CALENDAR_CONNECT_REFUSED')[0]).toMatchObject({
      tenant_id: TENANT_A,
      user_id: CLERK_ME,
      metadata: { product: 'axis_aba', profile_id: PROFILE_ME, reason: 'missing_calendar_scope', granted_scopes: ['userinfo.email', 'openid'] },
    })
    expect(auditsOf('GOOGLE_CALENDAR_CONNECTED')).toHaveLength(0)
  })

  test('callback ABA com agenda continua gravando como antes', async () => {
    const res = await abaCallback()

    expect(res.headers.get('location')).toBe('https://app.test/aba/configuracoes?google=success')
    expect(connections).toHaveLength(1)
    expect(connections[0]).toMatchObject({ tenant_id: TENANT_A, user_id: PROFILE_ME, access_token: 'access-novo', scope: FULL_SCOPE })
    expect(auditsOf('GOOGLE_CALENDAR_CONNECTED')[0].metadata).toMatchObject({ product: 'axis_aba' })
    // O ABA continua sem criar canal no callback (fora do escopo da 1C-1).
    expect(kinds()).toEqual(['exchange', 'userinfo'])
  })
})
