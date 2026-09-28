import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GoogleCalendarEvent } from '@/src/services/google-event-apply'

// =====================================================
// AXIS TCC — Entrega 1A: agenda Google × sessões
//
// 1.1 webhook/sync só alteram sessão 'agendada'
// 1.2 evento cancelado (com ou sem horário) → 'cancelada' + lembretes pendentes apagados
// 1.3 etag salvo na criação; eco com o mesmo etag não gera UPDATE
// 1.5 numeração única (trava por tenant+paciente, MAX+1) nos 4 pontos de INSERT
// D-B reconferência do google_event_id depois da trava
// Deadlock/falha de trava → Sentry, laço segue, syncToken não avança
//
// Entrega 1B (1.4): sessão gravada antes do evento; evento com id "tcc…" + marca
// axis_session_id; webhook/sync vinculam em vez de inserir; falha do Google nunca
// impede a sessão.
//
// Sem banco: um Postgres falso responde pelo texto da SQL e guarda o estado.
// =====================================================

const TENANT = '11111111-1111-4111-8111-111111111111'
const CLERK_USER = 'clerk-user-1'
const PATIENT_A = { id: 'aaaaaaaa-0000-4000-8000-00000000000a', email: 'paciente-a@teste.com', full_name: 'Paciente Alfa' }
const PATIENT_B = { id: 'bbbbbbbb-0000-4000-8000-00000000000b', email: 'paciente-b@teste.com', full_name: 'Paciente Beta' }
const PATIENTS = [PATIENT_A, PATIENT_B]
const TOKEN_EXPIRY = new Date(Date.now() + 3600 * 1000).toISOString()

// ─── Mocks ───

const mockAuth = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) }),
}))

vi.mock('@/src/utils/system-alert', () => ({
  createSystemAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/src/lib/env', () => ({
  env: { GOOGLE_CLIENT_ID: 'test-client-id', GOOGLE_CLIENT_SECRET: 'test-client-secret' },
}))

const mockCaptureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

vi.mock('@/src/database/db', () => ({
  default: {
    query: (sql: string, params?: unknown[]) => runQuery(sql, params ?? [], { guc: null }),
    connect: () => Promise.resolve(makeClient()),
  },
}))

vi.mock('@/src/services/session-number', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/services/session-number')>()
  return { ...actual, nextSessionNumber: vi.fn(actual.nextSessionNumber) }
})

import { POST as webhookPOST } from '@/app/api/google/webhook/route'
import { POST as syncPOST } from '@/app/api/google/sync/route'
import { POST as createPOST } from '@/app/api/sessions/create/route'
import { nextSessionNumber, sessionNumberLockKey } from '@/src/services/session-number'
import {
  GOOGLE_INSERT_TIMEOUT_MS,
  GOOGLE_LOOKUP_TIMEOUT_MS,
  ensureSessionGoogleEvent,
  googleEventIdForSession,
} from '@/src/services/google-event-create'

// ─── Postgres falso ───

interface FakeSession {
  id: string
  tenant_id: string
  patient_id: string
  session_number: number
  status: string
  google_event_id: string | null
  google_calendar_id: string | null
  calendar_source: string | null
  google_meet_link: string | null
  external_etag: string | null
  external_updated_at: string | null
  scheduled_at: string | null
  duration_minutes: number | null
}

interface FakeReminder {
  session_id: string
  sent: boolean
}

interface ClientState {
  guc: string | null
}

let sessions: FakeSession[] = []
let reminders: FakeReminder[] = []
let queries: Array<{ sql: string; params: unknown[] }> = []
let savedSyncToken: string | null = null
let lockHook: ((key: string) => void) | null = null
let sessionSeq = 0
let openTransactions = 0
let connection: Record<string, unknown> | null = null

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

function result(rows: Array<Record<string, unknown>> = [], rowCount = rows.length) {
  return { rows, rowCount }
}

function makeClient() {
  const state: ClientState = { guc: null }
  return {
    query: (sql: string, params?: unknown[]) => runQuery(sql, params ?? [], state),
    release: () => undefined,
  }
}

function parseInsert(sql: string, params: unknown[]): Record<string, unknown> {
  const columns = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map((c) => c.trim())
  let values = sql.slice(sql.indexOf('VALUES (') + 'VALUES ('.length)
  const returning = values.indexOf(' RETURNING')
  if (returning >= 0) values = values.slice(0, returning)
  const tokens = values.replace(/\)\s*$/, '').split(',').map((v) => v.trim())

  const row: Record<string, unknown> = {}
  columns.forEach((column, i) => {
    const token = tokens[i]
    const placeholder = /^\$(\d+)$/.exec(token)
    if (placeholder) row[column] = params[Number(placeholder[1]) - 1]
    else if (token === 'NULL') row[column] = null
    else if (token.startsWith("'")) row[column] = token.slice(1, -1)
    else row[column] = token
  })
  return row
}

function updateSessions(sql: string, params: unknown[]) {
  const guarded = (sql.split(' WHERE ')[1] ?? '').includes("status = 'agendada'")
  const isCancel = sql.startsWith("UPDATE sessions SET status = 'cancelada'")
  const tenantId = isCancel ? params[2] : params[6]
  const ids = (isCancel ? params[3] : params[7]) as string[]

  const targets = sessions.filter(
    (s) => s.tenant_id === tenantId && ids.includes(s.id) && (!guarded || s.status === 'agendada')
  )
  for (const s of targets) {
    if (isCancel) {
      s.status = 'cancelada'
      s.external_etag = (params[0] as string | null) ?? s.external_etag
    } else {
      s.scheduled_at = params[0] as string
      s.duration_minutes = params[1] as number
      s.external_etag = params[2] as string | null
    }
  }
  return result(targets.map((s) => ({ id: s.id })), targets.length)
}

async function runQuery(rawSql: string, params: unknown[], state: ClientState) {
  const sql = normalize(rawSql)
  queries.push({ sql, params })

  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
    openTransactions += sql === 'BEGIN' ? 1 : -1
    return result()
  }
  if (sql.includes("set_config('app.tenant_id'")) {
    state.guc = String(params[0])
    return result()
  }
  if (sql.includes("set_config('app.user_id'")) return result()

  // withTenant (login Clerk)
  if (sql.startsWith('SELECT email FROM profiles')) return result([{ email: 'psicologa@teste.com' }])
  if (sql.startsWith('UPDATE profiles')) return result()
  if (sql.includes('FROM profiles p JOIN tenants t')) {
    return result([{ profile_id: 'profile-1', tenant_id: TENANT, role: 'admin', tenant_name: 'Clínica Teste', plan_tier: 'free' }])
  }

  // Google: canal, conexão, syncToken
  if (sql.includes('calendar_webhook_lookup')) {
    return result([{ tenant_id: TENANT, user_id: 'profile-1', webhook_token: null }])
  }
  if (sql.startsWith('SELECT') && sql.includes('FROM calendar_connections')) {
    return result(connection ? [{ ...connection }] : [])
  }
  if (sql.startsWith('UPDATE calendar_connections')) {
    if (connection) Object.assign(connection, { access_token: params[0], token_expiry: params[1] })
    return result([], 1)
  }
  if (sql.startsWith('SELECT sync_token FROM calendar_sync_state')) return result([{ sync_token: 'sync-antigo' }])
  if (sql.startsWith('INSERT INTO calendar_sync_state')) {
    savedSyncToken = String(params[2])
    return result()
  }
  if (sql.startsWith('INSERT INTO axis_audit_logs')) return result()

  // Pacientes
  if (sql.startsWith('SELECT id FROM patients WHERE tenant_id = $1 AND email = $2')) {
    return result(PATIENTS.filter((p) => params[0] === TENANT && p.email === params[1]).map((p) => ({ id: p.id })))
  }
  if (sql.startsWith('SELECT full_name, email FROM patients')) {
    return result(PATIENTS.filter((p) => p.id === params[0]).map((p) => ({ full_name: p.full_name, email: p.email })))
  }
  if (sql.startsWith('SELECT id FROM patient_push_tokens')) return result()

  // Numeração
  if (sql.includes('pg_advisory_xact_lock')) {
    lockHook?.(String(params[0]))
    return result([{ pg_advisory_xact_lock: '', tenant_guc: state.guc }])
  }
  if (sql.includes('MAX(session_number)')) {
    const numbers = sessions
      .filter((s) => s.tenant_id === params[0] && s.patient_id === params[1])
      .map((s) => s.session_number)
    return result([{ next: (numbers.length > 0 ? Math.max(...numbers) : 0) + 1 }])
  }

  // Sessões
  if (sql.startsWith('SELECT id, status, external_etag FROM sessions')) {
    return result(
      sessions
        .filter((s) => s.tenant_id === params[0] && s.google_event_id === params[1])
        .map((s) => ({ id: s.id, status: s.status, external_etag: s.external_etag }))
    )
  }
  if (sql === 'SELECT 1 FROM sessions WHERE tenant_id = $1 AND id = $2') {
    const found = sessions.some((s) => s.tenant_id === params[0] && s.id === params[1])
    return result(found ? [{ '?column?': 1 }] : [])
  }
  if (sql.startsWith('SELECT 1 FROM sessions')) {
    const found = sessions.some((s) => s.tenant_id === params[0] && s.google_event_id === params[1])
    return result(found ? [{ '?column?': 1 }] : [])
  }
  if (sql.startsWith('SELECT google_event_id, google_meet_link FROM sessions')) {
    return result(
      sessions
        .filter((s) => s.tenant_id === params[0] && s.id === params[1])
        .map((s) => ({ google_event_id: s.google_event_id, google_meet_link: s.google_meet_link }))
    )
  }
  if (sql.startsWith('UPDATE sessions SET google_event_id')) {
    const target = sessions.find((s) => s.tenant_id === params[4] && s.id === params[5] && s.google_event_id === null)
    if (!target) return result([], 0)
    Object.assign(target, {
      google_event_id: params[0],
      google_calendar_id: 'primary',
      calendar_source: 'google',
      google_meet_link: params[1],
      external_etag: params[2],
      external_updated_at: params[3],
    })
    return result([{ id: target.id }])
  }
  if (sql.startsWith('UPDATE sessions')) return updateSessions(sql, params)
  if (sql.startsWith('INSERT INTO sessions')) {
    const row = parseInsert(sql, params)
    const session: FakeSession = {
      id: `00000000-0000-4000-8000-${String(++sessionSeq).padStart(12, '0')}`,
      tenant_id: String(row.tenant_id),
      patient_id: String(row.patient_id),
      session_number: Number(row.session_number),
      status: String(row.status),
      google_event_id: (row.google_event_id as string | null | undefined) ?? null,
      google_calendar_id: (row.google_calendar_id as string | null | undefined) ?? null,
      calendar_source: (row.calendar_source as string | null | undefined) ?? null,
      google_meet_link: (row.google_meet_link as string | null | undefined) ?? null,
      external_etag: (row.external_etag as string | null | undefined) ?? null,
      external_updated_at: (row.external_updated_at as string | null | undefined) ?? null,
      scheduled_at: typeof row.scheduled_at === 'string' ? row.scheduled_at : null,
      duration_minutes: typeof row.duration_minutes === 'number' ? row.duration_minutes : null,
    }
    sessions.push(session)
    return result([{ ...session }])
  }
  if (sql.startsWith('DELETE FROM scheduled_reminders')) {
    const onlyPending = sql.includes('sent = false')
    reminders = reminders.filter((r) => !(r.session_id === params[0] && (!onlyPending || !r.sent)))
    return result()
  }

  throw new Error(`SQL inesperada no teste: ${sql}`)
}

// ─── Google falso ───

let googleEvents: GoogleCalendarEvent[] = []

// events.insert: 'ok' | status HTTP | 'hang' (só responde ao abort) | 'network' (rede caiu).
// createdOnGoogle: o evento passa a existir no Google mesmo que a resposta não chegue.
interface GoogleInsertBehavior {
  mode: 'ok' | 'status' | 'hang' | 'network'
  status?: number
  createdOnGoogle?: boolean
  before?: (created: Record<string, unknown>) => Promise<void>
}
let googleInsert: GoogleInsertBehavior = { mode: 'ok' }
let googleGet: 'store' | 'hang' | number = 'store'
let googleStore = new Map<string, Record<string, unknown>>()
let googleToken: { status: number; body?: unknown } = { status: 200, body: { access_token: 'token-renovado' } }
let googleCalls: Array<{ kind: 'insert' | 'get' | 'list' | 'token'; openTransactions: number; sessionsInDb: number; auth?: string; signal?: AbortSignal }> = []
let insertBodies: Array<Record<string, any>> = []

function waitForAbort(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
}

const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
  const call = (kind: 'insert' | 'get' | 'list' | 'token') =>
    googleCalls.push({ kind, openTransactions, sessionsInDb: sessions.length, auth, signal: init?.signal ?? undefined })

  if (url.includes('oauth2.googleapis.com/token')) {
    call('token')
    return Response.json(googleToken.body ?? {}, { status: googleToken.status })
  }
  if (url.includes('conferenceDataVersion=1')) {
    call('insert')
    const sent = JSON.parse(String(init?.body))
    insertBodies.push(sent)
    const created = {
      ...sent,
      status: 'confirmed',
      etag: '"etag-criado"',
      updated: '2026-09-27T12:00:00.000Z',
      hangoutLink: 'https://meet.google.com/teste',
    }
    const { mode, createdOnGoogle = mode === 'ok' } = googleInsert
    if (createdOnGoogle) googleStore.set(created.id, created)
    await googleInsert.before?.(created)
    if (mode === 'hang') return waitForAbort(init?.signal)
    if (mode === 'network') throw new TypeError('fetch failed')
    if (mode === 'status') {
      return new Response(`erro do Google (${PATIENT_A.email} ${PATIENT_A.full_name})`, { status: googleInsert.status })
    }
    return Response.json(created)
  }
  const byId = /\/calendars\/primary\/events\/([^?/]+)$/.exec(url)
  if (byId) {
    call('get')
    if (googleGet === 'hang') return waitForAbort(init?.signal)
    if (typeof googleGet === 'number') return new Response('erro', { status: googleGet })
    const found = googleStore.get(byId[1])
    return found ? Response.json(found) : new Response('Not Found', { status: 404 })
  }
  if (url.includes('/calendars/primary/events?')) {
    call('list')
    return Response.json({ items: googleEvents, nextSyncToken: 'sync-novo' })
  }
  throw new Error(`fetch inesperado no teste: ${url}`)
})

// ─── Helpers ───

function seedSession(partial: Partial<FakeSession> & { id: string }): FakeSession {
  const session: FakeSession = {
    tenant_id: TENANT,
    patient_id: PATIENT_A.id,
    session_number: 1,
    status: 'agendada',
    google_event_id: null,
    google_calendar_id: null,
    calendar_source: null,
    google_meet_link: null,
    external_etag: null,
    external_updated_at: null,
    scheduled_at: '2026-10-01T13:00:00.000Z',
    duration_minutes: 60,
    ...partial,
  }
  sessions.push(session)
  return session
}

function googleEvent(overrides: Partial<GoogleCalendarEvent> = {}): GoogleCalendarEvent {
  return {
    id: 'evt-1',
    status: 'confirmed',
    etag: '"etag-novo"',
    updated: '2026-09-27T12:00:00.000Z',
    start: { dateTime: '2026-10-01T14:00:00.000Z' },
    end: { dateTime: '2026-10-01T15:00:00.000Z' },
    attendees: [{ email: PATIENT_A.email, responseStatus: 'accepted' }],
    ...overrides,
  }
}

function webhookRequest() {
  const headers = new Map<string, string>([
    ['x-goog-channel-id', 'canal-1'],
    ['x-goog-resource-id', 'recurso-1'],
    ['x-goog-resource-state', 'exists'],
  ])
  return { headers: { get: (name: string) => headers.get(name) ?? null } } as any
}

function jsonRequest(body: unknown) {
  return { json: async () => body } as any
}

const sessionUpdates = () => queries.filter((q) => q.sql.startsWith('UPDATE sessions'))
const sessionInserts = () => queries.filter((q) => q.sql.startsWith('INSERT INTO sessions'))

// Sessão e evento no formato que o AXIS cria (uuid → "tcc" + hex).
const SESSION_X = 'cccccccc-0000-4000-8000-00000000000c'
const EVENT_X = googleEventIdForSession(SESSION_X)
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222'
const TCC_ID_BASE32HEX = /^[a-v0-9]{5,1024}$/

function axisEvent(overrides: Partial<GoogleCalendarEvent> = {}): GoogleCalendarEvent {
  return googleEvent({ id: EVENT_X, extendedProperties: { private: { axis_session_id: SESSION_X } }, ...overrides })
}

function scheduleRequest() {
  return jsonRequest({ patient_id: PATIENT_A.id, start_now: false, scheduled_at: '2026-10-02T13:00:00.000Z' })
}

// Deixa a cadeia de promessas andar (sem avançar o relógio falso) até a condição valer.
async function until(condition: () => boolean) {
  for (let i = 0; i < 200 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve))
  expect(condition()).toBe(true)
}

beforeEach(() => {
  sessions = []
  reminders = []
  queries = []
  savedSyncToken = null
  lockHook = null
  sessionSeq = 0
  openTransactions = 0
  connection = { id: 'conn-1', access_token: 'token-valido', refresh_token: 'refresh', token_expiry: TOKEN_EXPIRY }
  googleEvents = []
  googleInsert = { mode: 'ok' }
  googleGet = 'store'
  googleStore = new Map()
  googleToken = { status: 200, body: { access_token: 'token-renovado' } }
  googleCalls = []
  insertBodies = []
  mockAuth.mockResolvedValue({ userId: CLERK_USER })
  mockCaptureException.mockClear()
  vi.mocked(nextSessionNumber).mockClear()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ═════════════════════════════════════════════════════
// 1.1 — só sessão agendada muda pelo Google
// ═════════════════════════════════════════════════════

describe('1.1 — webhook só altera sessão agendada', () => {
  test('webhook: evento alterado atualiza sessão agendada (horário, duração, etag)', async () => {
    seedSession({ id: 's1', google_event_id: 'evt-1', external_etag: '"etag-velho"' })
    googleEvents = [
      googleEvent({ start: { dateTime: '2026-10-01T16:00:00.000Z' }, end: { dateTime: '2026-10-01T16:50:00.000Z' } }),
    ]

    const res = await webhookPOST(webhookRequest())

    expect(res.status).toBe(200)
    expect(sessions[0]).toMatchObject({
      status: 'agendada',
      scheduled_at: '2026-10-01T16:00:00.000Z',
      duration_minutes: 50,
      external_etag: '"etag-novo"',
    })
  })

  test.each(['em_andamento', 'finalizada', 'cancelada'])('webhook: evento alterado NÃO altera sessão %s', async (status) => {
    const before = { ...seedSession({ id: 's1', status, google_event_id: 'evt-1', external_etag: '"etag-velho"' }) }
    googleEvents = [googleEvent()]

    await webhookPOST(webhookRequest())

    expect(sessions[0]).toEqual(before)
    expect(sessionUpdates()).toHaveLength(0)
    expect(sessionInserts()).toHaveLength(0)
  })

  test("webhook: todo UPDATE de sessão leva status = 'agendada' no WHERE", async () => {
    seedSession({ id: 's1', google_event_id: 'evt-1', external_etag: '"etag-velho"' })
    seedSession({ id: 's2', google_event_id: 'evt-2', external_etag: '"etag-velho"', session_number: 2 })
    googleEvents = [googleEvent(), { id: 'evt-2', status: 'cancelled' }]

    await webhookPOST(webhookRequest())

    const updates = sessionUpdates()
    expect(updates).toHaveLength(2)
    for (const update of updates) {
      expect(update.sql.split(' WHERE ')[1]).toContain("status = 'agendada'")
    }
  })
})

describe('1.1 — sync só altera sessão agendada', () => {
  test('sync: evento alterado atualiza sessão agendada', async () => {
    seedSession({ id: 's1', google_event_id: 'evt-1', external_etag: '"etag-velho"' })
    googleEvents = [googleEvent()]

    const res = await syncPOST(jsonRequest({}))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.updated).toBe(1)
    expect(sessions[0]).toMatchObject({ scheduled_at: '2026-10-01T14:00:00.000Z', external_etag: '"etag-novo"' })
  })

  test.each(['em_andamento', 'finalizada', 'cancelada'])('sync: evento alterado NÃO altera sessão %s', async (status) => {
    const before = { ...seedSession({ id: 's1', status, google_event_id: 'evt-1', external_etag: '"etag-velho"' }) }
    googleEvents = [googleEvent()]

    await syncPOST(jsonRequest({}))

    expect(sessions[0]).toEqual(before)
    expect(sessionUpdates()).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════
// 1.2 — evento cancelado no Google
// ═════════════════════════════════════════════════════

describe('1.2 — evento cancelado no Google', () => {
  test('webhook: evento cancelado sem horário marca sessão agendada como cancelada', async () => {
    seedSession({ id: 's1', google_event_id: 'evt-1', external_etag: '"etag-velho"' })
    googleEvents = [{ id: 'evt-1', status: 'cancelled' }]

    await webhookPOST(webhookRequest())

    expect(sessions[0].status).toBe('cancelada')
  })

  test('webhook: evento cancelado sem horário não mexe em sessão finalizada', async () => {
    const before = { ...seedSession({ id: 's1', status: 'finalizada', google_event_id: 'evt-1' }) }
    googleEvents = [{ id: 'evt-1', status: 'cancelled' }]

    await webhookPOST(webhookRequest())

    expect(sessions[0]).toEqual(before)
    expect(sessionUpdates()).toHaveLength(0)
  })

  test('webhook: evento cancelado sem sessão correspondente não cria nada', async () => {
    googleEvents = [{ id: 'evt-9', status: 'cancelled', attendees: [{ email: PATIENT_A.email }] }]

    await webhookPOST(webhookRequest())

    expect(sessions).toHaveLength(0)
    expect(sessionInserts()).toHaveLength(0)
    expect(sessionUpdates()).toHaveLength(0)
  })

  test('webhook: evento de dia inteiro não cancelado continua ignorado', async () => {
    googleEvents = [googleEvent({ id: 'evt-dia', start: { date: '2026-10-01' }, end: { date: '2026-10-02' } })]

    await webhookPOST(webhookRequest())

    expect(sessions).toHaveLength(0)
    expect(sessionInserts()).toHaveLength(0)
  })

  test('sync: evento cancelado sem horário marca sessão agendada como cancelada', async () => {
    seedSession({ id: 's1', google_event_id: 'evt-1' })
    googleEvents = [{ id: 'evt-1', status: 'cancelled' }]

    const res = await syncPOST(jsonRequest({}))
    const body = await res.json()

    expect(sessions[0].status).toBe('cancelada')
    expect(body.cancelled).toBe(1)
  })

  test('cancelada pelo Google apaga lembretes pendentes', async () => {
    seedSession({ id: 's1', google_event_id: 'evt-1' })
    seedSession({ id: 's2', session_number: 2 })
    reminders = [
      { session_id: 's1', sent: false },
      { session_id: 's1', sent: true },
      { session_id: 's2', sent: false },
    ]
    googleEvents = [{ id: 'evt-1', status: 'cancelled' }]

    await webhookPOST(webhookRequest())

    expect(sessions[0].status).toBe('cancelada')
    expect(reminders).toEqual([
      { session_id: 's1', sent: true },
      { session_id: 's2', sent: false },
    ])
    const deletes = queries.filter((q) => q.sql.startsWith('DELETE FROM scheduled_reminders'))
    expect(deletes).toEqual([
      {
        sql: 'DELETE FROM scheduled_reminders WHERE session_id = $1 AND tenant_id = $2 AND sent = false',
        params: ['s1', TENANT],
      },
    ])
  })
})

// ═════════════════════════════════════════════════════
// 1.3 — etag do que o AXIS cria no Google
// ═════════════════════════════════════════════════════

describe('1.3 — etag', () => {
  test('create agendada: grava em external_etag o etag devolvido pelo Google', async () => {
    const res = await createPOST(scheduleRequest())

    expect(res.status).toBe(201)
    expect(sessions[0]).toMatchObject({
      google_event_id: googleEventIdForSession(sessions[0].id),
      external_etag: '"etag-criado"',
      external_updated_at: '2026-09-27T12:00:00.000Z',
      status: 'agendada',
    })
  })

  test('create agendada: Google falhou → sessão sem google_event_id e sem etag (como hoje)', async () => {
    googleInsert = { mode: 'status', status: 500 }

    const res = await createPOST(scheduleRequest())

    expect(res.status).toBe(201)
    expect(sessions[0]).toMatchObject({ google_event_id: null, external_etag: null, status: 'agendada' })
  })

  test('webhook: eco com o mesmo etag não gera UPDATE', async () => {
    seedSession({ id: 's1', google_event_id: 'evt-1', external_etag: '"etag-eco"' })
    googleEvents = [googleEvent({ etag: '"etag-eco"' })]

    await webhookPOST(webhookRequest())

    expect(sessionUpdates()).toHaveLength(0)
    expect(sessions[0].scheduled_at).toBe('2026-10-01T13:00:00.000Z')
  })
})

// ═════════════════════════════════════════════════════
// 1.5 — numeração única
// ═════════════════════════════════════════════════════

describe('1.5 — numeração', () => {
  test('numeração: paciente sem sessões recebe 1', async () => {
    await createPOST(jsonRequest({ patient_id: PATIENT_A.id, start_now: true }))

    expect(sessions.map((s) => s.session_number)).toEqual([1])
  })

  test('numeração: com buraco 1,2,5 → 6', async () => {
    seedSession({ id: 's1', session_number: 1, status: 'finalizada' })
    seedSession({ id: 's2', session_number: 2, status: 'finalizada' })
    seedSession({ id: 's5', session_number: 5, status: 'finalizada' })

    await createPOST(jsonRequest({ patient_id: PATIENT_A.id, start_now: false, scheduled_at: '2026-10-02T13:00:00.000Z' }))

    expect(sessions[3].session_number).toBe(6)
  })

  test('numeração: após exclusão não repete (existem 1 e 3 → 4; COUNT+1 daria 3)', async () => {
    seedSession({ id: 's1', session_number: 1, status: 'finalizada' })
    seedSession({ id: 's3', session_number: 3, status: 'finalizada' })

    await createPOST(jsonRequest({ patient_id: PATIENT_A.id, start_now: true }))

    expect(sessions[2].session_number).toBe(4)
  })

  test('numeração: sessão cancelada continua contando', async () => {
    seedSession({ id: 's1', session_number: 1, status: 'finalizada' })
    seedSession({ id: 's2', session_number: 2, status: 'cancelada' })
    googleEvents = [googleEvent({ id: 'evt-novo' })]

    await webhookPOST(webhookRequest())

    expect(sessions[2]).toMatchObject({ google_event_id: 'evt-novo', session_number: 3 })
  })

  test('numeração: trava por paciente vem antes do MAX', async () => {
    const client = makeClient()
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT])
    queries = []

    const next = await nextSessionNumber(client as any, TENANT, PATIENT_A.id)

    const lockIndex = queries.findIndex((q) => q.sql.includes('pg_advisory_xact_lock'))
    const maxIndex = queries.findIndex((q) => q.sql.includes('MAX(session_number)'))
    expect(next).toBe(1)
    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(lockIndex).toBeLessThan(maxIndex)
    expect(queries[lockIndex].params).toEqual([sessionNumberLockKey(TENANT, PATIENT_A.id)])
  })

  test('numeração: fora de transação com app.tenant_id a função recusa', async () => {
    const client = makeClient()

    await expect(nextSessionNumber(client as any, TENANT, PATIENT_A.id)).rejects.toThrow('exige transação')
    expect(queries.some((q) => q.sql.includes('MAX(session_number)'))).toBe(false)
  })

  test('create "Iniciar Agora", create "Agendar", webhook e sync usam nextSessionNumber', async () => {
    await createPOST(jsonRequest({ patient_id: PATIENT_A.id, start_now: true }))
    await createPOST(jsonRequest({ patient_id: PATIENT_A.id, start_now: false, scheduled_at: '2026-10-02T13:00:00.000Z' }))
    googleEvents = [googleEvent({ id: 'evt-web' })]
    await webhookPOST(webhookRequest())
    googleEvents = [googleEvent({ id: 'evt-sync' })]
    await syncPOST(jsonRequest({}))

    const calls = vi.mocked(nextSessionNumber).mock.calls
    expect(calls).toHaveLength(4)
    for (const call of calls) {
      expect(call.slice(1)).toEqual([TENANT, PATIENT_A.id])
    }
    const lockKeys = queries.filter((q) => q.sql.includes('pg_advisory_xact_lock')).map((q) => q.params[0])
    expect(lockKeys).toEqual(Array(4).fill(sessionNumberLockKey(TENANT, PATIENT_A.id)))
    expect(sessions.map((s) => s.session_number)).toEqual([1, 2, 3, 4])
  })
})

// ═════════════════════════════════════════════════════
// D-B — reconferência depois da trava
// ═════════════════════════════════════════════════════

describe('D-B — reconferência do google_event_id', () => {
  test('webhook: após a trava, google_event_id existente não é inserido de novo', async () => {
    googleEvents = [googleEvent({ id: 'evt-corrida' })]
    // Outro webhook/sync importou o mesmo evento enquanto esta transação esperava a trava.
    lockHook = () => {
      seedSession({ id: 's-outra-transacao', google_event_id: 'evt-corrida' })
    }

    await webhookPOST(webhookRequest())

    expect(sessionInserts()).toHaveLength(0)
    expect(sessions.filter((s) => s.google_event_id === 'evt-corrida')).toHaveLength(1)
    const lockIndex = queries.findIndex((q) => q.sql.includes('pg_advisory_xact_lock'))
    const recheckIndex = queries.findIndex((q) => q.sql.startsWith('SELECT 1 FROM sessions'))
    expect(recheckIndex).toBeGreaterThan(lockIndex)
  })
})

// ═════════════════════════════════════════════════════
// Acréscimo 2 — deadlock / falha de trava
// ═════════════════════════════════════════════════════

describe('Acréscimo 2 — falha de trava', () => {
  test('deadlock é enviado ao Sentry e o laço continua', async () => {
    googleEvents = [
      googleEvent({ id: 'evt-a', attendees: [{ email: PATIENT_A.email }] }),
      googleEvent({ id: 'evt-b', attendees: [{ email: PATIENT_B.email }] }),
    ]
    lockHook = (key) => {
      if (key === sessionNumberLockKey(TENANT, PATIENT_A.id)) {
        throw Object.assign(new Error(`deadlock detected (${PATIENT_A.email})`), { code: '40P01' })
      }
    }

    const res = await webhookPOST(webhookRequest())

    expect(res.status).toBe(200)
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    const [error, context] = mockCaptureException.mock.calls[0]
    expect(context.tags).toMatchObject({ area: 'google_calendar_sync', origin: 'webhook', pg_code: '40P01' })
    const sent = `${(error as Error).message} ${JSON.stringify(context)}`
    for (const patientData of [PATIENT_A.email, PATIENT_A.full_name, PATIENT_A.id]) {
      expect(sent).not.toContain(patientData)
    }
    expect(sessions.map((s) => s.google_event_id)).toEqual(['evt-b'])
    expect(savedSyncToken).toBeNull()
  })

  test('erro que não é de trava não é engolido: rota falha e syncToken não avança', async () => {
    googleEvents = [googleEvent({ id: 'evt-a' })]
    lockHook = () => {
      throw Object.assign(new Error('falha qualquer'), { code: '23505' })
    }

    const res = await webhookPOST(webhookRequest())

    expect(res.status).toBe(500)
    expect(mockCaptureException).not.toHaveBeenCalled()
    expect(savedSyncToken).toBeNull()
  })
})

// ═════════════════════════════════════════════════════
// 1B (1.4) — criação sem duplicação: sessão antes, evento depois, vínculo
// ═════════════════════════════════════════════════════

describe('1B — id e marca do evento', () => {
  test('formato do id: "tcc" + uuid sem hífens, só a–v e 0–9 (base32hex), 5 a 1024', () => {
    for (const id of [SESSION_X, 'FFFFFFFF-FFFF-4FFF-BFFF-FFFFFFFFFFFF', '00000000-0000-4000-8000-000000000001']) {
      const eventId = googleEventIdForSession(id)
      expect(eventId).toMatch(TCC_ID_BASE32HEX)
      expect(eventId).toMatch(/^tcc[0-9a-f]{32}$/)
      expect(eventId).toBe('tcc' + id.replace(/-/g, '').toLowerCase())
    }
    expect(() => googleEventIdForSession('sessao-sem-uuid')).toThrow()
  })

  test('create agendada: evento enviado com extendedProperties.private.axis_session_id e id derivado da sessão', async () => {
    await createPOST(scheduleRequest())

    const sent = insertBodies[0]
    expect(sent.id).toBe(googleEventIdForSession(sessions[0].id))
    expect(sent.id).toMatch(TCC_ID_BASE32HEX)
    expect(sent.extendedProperties).toEqual({ private: { axis_session_id: sessions[0].id } })
    expect(sent.conferenceData.createRequest.conferenceSolutionKey).toEqual({ type: 'hangoutsMeet' })
    expect(sent.attendees).toEqual([{ email: PATIENT_A.email }])
  })
})

describe('1B — ordem da criação', () => {
  test('create agendada: INSERT da sessão acontece antes do POST ao Google', async () => {
    await createPOST(scheduleRequest())

    const insert = googleCalls.find((c) => c.kind === 'insert')
    expect(insert?.sessionsInDb).toBe(1)
  })

  test('create agendada: POST ao Google fora da transação (COMMIT antes do fetch)', async () => {
    await createPOST(scheduleRequest())

    const insert = googleCalls.find((c) => c.kind === 'insert')
    expect(insert?.openTransactions).toBe(0)
    expect(openTransactions).toBe(0)
    // Transação 1 (sessão) e transação 2 (vínculo) são separadas.
    const insertIndex = queries.findIndex((q) => q.sql.startsWith('INSERT INTO sessions'))
    const linkIndex = queries.findIndex((q) => q.sql.startsWith('UPDATE sessions SET google_event_id'))
    const commitsBetween = queries.slice(insertIndex, linkIndex).filter((q) => q.sql === 'COMMIT')
    expect(commitsBetween.length).toBeGreaterThanOrEqual(1)
  })

  test('create agendada: INSERT da sessão sai sem vínculo com o Google', async () => {
    await createPOST(scheduleRequest())

    const insertSql = sessionInserts()[0].sql
    expect(insertSql).not.toContain('google_event_id')
    expect(insertSql).not.toContain('external_etag')
  })

  test('create agendada: sucesso → UPDATE de vínculo com google_event_id, etag, meet, calendar_source', async () => {
    const res = await createPOST(scheduleRequest())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({ google_synced: true, google_connected: true })
    expect(body.session.google_meet_link).toBe('https://meet.google.com/teste')
    expect(sessions[0]).toMatchObject({
      google_event_id: googleEventIdForSession(sessions[0].id),
      google_calendar_id: 'primary',
      calendar_source: 'google',
      google_meet_link: 'https://meet.google.com/teste',
      external_etag: '"etag-criado"',
      external_updated_at: '2026-09-27T12:00:00.000Z',
      status: 'agendada',
      scheduled_at: '2026-10-02T13:00:00.000Z',
    })
  })

  test('create "Iniciar Agora": inalterado, não chama o Google', async () => {
    const res = await createPOST(jsonRequest({ patient_id: PATIENT_A.id, start_now: true }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.google_synced).toBe(false)
    expect(sessions[0]).toMatchObject({ status: 'em_andamento', google_event_id: null })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(queries.some((q) => q.sql.includes('calendar_connections'))).toBe(false)
  })

  test('create agendada sem Google conectado: sessão criada, google_connected=false, nenhum fetch', async () => {
    connection = null

    const res = await createPOST(scheduleRequest())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({ google_synced: false, google_connected: false })
    expect(sessions).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('1B — falhas do Google nunca impedem a sessão', () => {
  test('create agendada: Google falhou → sessão criada, sem vínculo, google_synced=false', async () => {
    googleInsert = { mode: 'status', status: 400 }

    const res = await createPOST(scheduleRequest())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({ google_synced: false, google_connected: true })
    expect(sessions[0]).toMatchObject({ status: 'agendada', google_event_id: null, calendar_source: null })
    // 400 é recusa definitiva: não consulta events.get.
    expect(googleCalls.map((c) => c.kind)).toEqual(['insert'])
  })

  test('create agendada: timeout do Google → sessão criada, resposta 201 dentro do limite', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    googleInsert = { mode: 'hang' }
    googleGet = 'hang'

    const pending = createPOST(scheduleRequest())
    await until(() => googleCalls.some((c) => c.kind === 'insert'))
    await vi.advanceTimersByTimeAsync(GOOGLE_INSERT_TIMEOUT_MS)
    await until(() => googleCalls.some((c) => c.kind === 'get'))
    await vi.advanceTimersByTimeAsync(GOOGLE_LOOKUP_TIMEOUT_MS)
    const res = await pending
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.google_synced).toBe(false)
    expect(sessions[0]).toMatchObject({ status: 'agendada', google_event_id: null })
    expect(googleCalls.find((c) => c.kind === 'insert')?.signal?.aborted).toBe(true)
  })

  test('create agendada: timeout → get encontra → vincula', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    googleInsert = { mode: 'hang', createdOnGoogle: true }

    const pending = createPOST(scheduleRequest())
    await until(() => googleCalls.some((c) => c.kind === 'insert'))
    await vi.advanceTimersByTimeAsync(GOOGLE_INSERT_TIMEOUT_MS)
    const res = await pending
    const body = await res.json()

    expect(body.google_synced).toBe(true)
    expect(googleCalls.map((c) => c.kind)).toEqual(['insert', 'get'])
    expect(sessions[0]).toMatchObject({ google_event_id: googleEventIdForSession(sessions[0].id), calendar_source: 'google' })
    expect(insertBodies).toHaveLength(1)
  })

  test('create agendada: 409 → get → vincula', async () => {
    googleInsert = { mode: 'status', status: 409, createdOnGoogle: true }

    const res = await createPOST(scheduleRequest())
    const body = await res.json()

    expect(body.google_synced).toBe(true)
    expect(googleCalls.map((c) => c.kind)).toEqual(['insert', 'get'])
    expect(sessions[0].google_event_id).toBe(googleEventIdForSession(sessions[0].id))
  })

  test('create agendada: get não encontra → sem vínculo, google_synced false', async () => {
    googleInsert = { mode: 'status', status: 409, createdOnGoogle: false }

    const res = await createPOST(scheduleRequest())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.google_synced).toBe(false)
    expect(googleCalls.map((c) => c.kind)).toEqual(['insert', 'get'])
    expect(sessions[0].google_event_id).toBeNull()
  })

  test('create agendada: rede caiu no insert → get → vincula se o evento existe', async () => {
    googleInsert = { mode: 'network', createdOnGoogle: true }

    const body = await (await createPOST(scheduleRequest())).json()

    expect(body.google_synced).toBe(true)
    expect(sessions[0].google_event_id).toBe(googleEventIdForSession(sessions[0].id))
  })

  test('create agendada: get encontra evento já cancelado → vincula sem etag (aviso do cancelamento não vira eco)', async () => {
    googleInsert = {
      mode: 'status',
      status: 409,
      createdOnGoogle: true,
      before: async (created) => {
        googleStore.set(String(created.id), { ...created, status: 'cancelled', etag: '"etag-cancelado"' })
      },
    }

    await createPOST(scheduleRequest())

    expect(sessions[0]).toMatchObject({
      google_event_id: googleEventIdForSession(sessions[0].id),
      external_etag: null,
      status: 'agendada',
    })

    // O aviso do cancelamento chega depois e cancela (1.2).
    googleEvents = [{ id: googleEventIdForSession(sessions[0].id), status: 'cancelled', etag: '"etag-cancelado"' }]
    await webhookPOST(webhookRequest())
    expect(sessions[0].status).toBe('cancelada')
  })

  test('create agendada: refresh do token falhou → sessão criada sem vínculo', async () => {
    connection = { id: 'conn-1', access_token: 'token-velho', refresh_token: 'refresh', token_expiry: '2020-01-01T00:00:00.000Z' }
    googleToken = { status: 400, body: { error: 'invalid_grant' } }

    const res = await createPOST(scheduleRequest())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.google_synced).toBe(false)
    expect(sessions[0]).toMatchObject({ status: 'agendada', google_event_id: null })
    expect(googleCalls.map((c) => c.kind)).toEqual(['token'])
  })

  test('create agendada: token renovado é gravado em transação própria, depois do COMMIT da sessão', async () => {
    connection = { id: 'conn-1', access_token: 'token-velho', refresh_token: 'refresh', token_expiry: '2020-01-01T00:00:00.000Z' }

    const body = await (await createPOST(scheduleRequest())).json()

    expect(body.google_synced).toBe(true)
    const insertIndex = queries.findIndex((q) => q.sql.startsWith('INSERT INTO sessions'))
    const tokenIndex = queries.findIndex((q) => q.sql.startsWith('UPDATE calendar_connections'))
    expect(tokenIndex).toBeGreaterThan(insertIndex)
    expect(queries[tokenIndex - 2].sql).toBe('BEGIN')
    expect(queries[tokenIndex + 1].sql).toBe('COMMIT')
    expect(googleCalls.find((c) => c.kind === 'insert')?.auth).toBe('Bearer token-renovado')
  })

  test('falha do Google não vai para o log com dados do paciente', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    googleInsert = { mode: 'status', status: 403 }

    await createPOST(scheduleRequest())

    expect(errorLog).toHaveBeenCalled()
    const logged = JSON.stringify(errorLog.mock.calls)
    for (const patientData of [PATIENT_A.email, PATIENT_A.full_name]) {
      expect(logged).not.toContain(patientData)
    }
  })
})

describe('1B — vínculo idempotente e corrida com o webhook', () => {
  test('corrida simulada: webhook roda entre o COMMIT do create e o vínculo → 1 sessão só', async () => {
    googleInsert = {
      mode: 'ok',
      before: async (created) => {
        // O aviso do Google chega antes de o create gravar o vínculo.
        googleEvents = [created as unknown as GoogleCalendarEvent]
        await webhookPOST(webhookRequest())
      },
    }

    const res = await createPOST(scheduleRequest())
    const body = await res.json()

    expect(sessions).toHaveLength(1)
    expect(sessionInserts()).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ google_event_id: googleEventIdForSession(sessions[0].id), calendar_source: 'google' })
    expect(body.google_synced).toBe(true)
    expect(body.session.google_meet_link).toBe('https://meet.google.com/teste')
  })

  test('create agendada: UPDATE de vínculo não sobrescreve sessão já vinculada', async () => {
    googleInsert = {
      mode: 'ok',
      before: async () => {
        sessions[0].google_event_id = 'evt-ja-vinculado'
      },
    }

    const body = await (await createPOST(scheduleRequest())).json()

    expect(sessions[0].google_event_id).toBe('evt-ja-vinculado')
    expect(body.google_synced).toBe(false)
  })

  test('vínculo não altera status nem horário de sessão em_andamento', async () => {
    seedSession({ id: SESSION_X, status: 'em_andamento', scheduled_at: '2026-10-01T13:00:00.000Z' })
    googleEvents = [axisEvent()]

    await webhookPOST(webhookRequest())

    expect(sessions[0]).toMatchObject({
      status: 'em_andamento',
      scheduled_at: '2026-10-01T13:00:00.000Z',
      google_event_id: EVENT_X,
      calendar_source: 'google',
    })
    const link = queries.find((q) => q.sql.startsWith('UPDATE sessions SET google_event_id'))!
    const setClause = link.sql.split(' WHERE ')[0]
    for (const column of ['status', 'scheduled_at', 'duration_minutes', 'patient_response']) {
      expect(setClause).not.toContain(column)
    }
    expect(link.sql).toContain('google_event_id IS NULL')
  })
})

describe('1B — webhook/sync reconhecem evento do AXIS', () => {
  test('webhook: evento com axis_session_id de sessão sem vínculo → vincula, não insere', async () => {
    seedSession({ id: SESSION_X })
    googleEvents = [axisEvent()]

    await webhookPOST(webhookRequest())

    expect(sessionInserts()).toHaveLength(0)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      google_event_id: EVENT_X,
      calendar_source: 'google',
      status: 'agendada',
      // Depois do vínculo segue a regra normal da 1A (sessão agendada acompanha o Google).
      scheduled_at: '2026-10-01T14:00:00.000Z',
      external_etag: '"etag-novo"',
    })
  })

  test('webhook: evento só com id "tcc…" (sem marca) → vincula, não insere', async () => {
    seedSession({ id: SESSION_X })
    googleEvents = [googleEvent({ id: EVENT_X })]

    await webhookPOST(webhookRequest())

    expect(sessionInserts()).toHaveLength(0)
    expect(sessions[0].google_event_id).toBe(EVENT_X)
  })

  test('webhook: evento com axis_session_id de sessão inexistente → skipped, não insere', async () => {
    googleEvents = [axisEvent()]

    await webhookPOST(webhookRequest())

    expect(sessions).toHaveLength(0)
    expect(sessionInserts()).toHaveLength(0)
    expect(savedSyncToken).toBe('sync-novo')
  })

  test('webhook: axis_session_id de outro tenant → skipped (consulta filtra tenant_id)', async () => {
    const before = { ...seedSession({ id: SESSION_X, tenant_id: OTHER_TENANT }) }
    googleEvents = [axisEvent()]

    await webhookPOST(webhookRequest())

    expect(sessions).toEqual([before])
    expect(sessionInserts()).toHaveLength(0)
    const link = queries.find((q) => q.sql.startsWith('UPDATE sessions SET google_event_id'))!
    expect(link.params).toContain(TENANT)
  })

  test('webhook: evento com marca e sessão já vinculada → caminho normal (atualiza / eco)', async () => {
    seedSession({ id: SESSION_X, google_event_id: EVENT_X, external_etag: '"etag-velho"' })
    googleEvents = [axisEvent()]

    await webhookPOST(webhookRequest())

    expect(sessionInserts()).toHaveLength(0)
    expect(sessions[0]).toMatchObject({ scheduled_at: '2026-10-01T14:00:00.000Z', external_etag: '"etag-novo"' })

    // Mesmo etag de novo = eco: nada muda.
    queries = []
    await webhookPOST(webhookRequest())
    expect(queries.filter((q) => q.sql.startsWith('UPDATE sessions SET scheduled_at'))).toHaveLength(0)
  })

  test('webhook: evento cancelado com marca e sessão sem vínculo agendada → vincula e cancela', async () => {
    seedSession({ id: SESSION_X })
    reminders = [{ session_id: SESSION_X, sent: false }]
    googleEvents = [
      { id: EVENT_X, status: 'cancelled', etag: '"etag-cancelado"', extendedProperties: { private: { axis_session_id: SESSION_X } } },
    ]

    await webhookPOST(webhookRequest())

    expect(sessions[0]).toMatchObject({ google_event_id: EVENT_X, status: 'cancelada' })
    expect(reminders).toEqual([])
    expect(sessionInserts()).toHaveLength(0)
  })

  test('sync: evento com marca → vincula, não insere', async () => {
    seedSession({ id: SESSION_X })
    googleEvents = [axisEvent()]

    const res = await syncPOST(jsonRequest({}))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.updated).toBe(1)
    expect(sessionInserts()).toHaveLength(0)
    expect(sessions[0]).toMatchObject({ google_event_id: EVENT_X, calendar_source: 'google' })
  })

  test('sync: vínculo de sessão que não está agendada conta como linked', async () => {
    seedSession({ id: SESSION_X, status: 'finalizada' })
    googleEvents = [axisEvent()]

    const body = await (await syncPOST(jsonRequest({}))).json()

    expect(body).toMatchObject({ linked: 1, updated: 0, imported: 0 })
    expect(sessions[0]).toMatchObject({ status: 'finalizada', google_event_id: EVENT_X })
  })

  test('webhook: evento sem marca (legado ou criado direto no Google) → importação como na 1A', async () => {
    googleEvents = [googleEvent({ id: 'evt-legado' })]

    await webhookPOST(webhookRequest())

    expect(sessionInserts()).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ google_event_id: 'evt-legado', patient_id: PATIENT_A.id, calendar_source: 'google' })
    expect(queries.some((q) => q.sql.startsWith('UPDATE sessions SET google_event_id'))).toBe(false)
  })
})

describe('1B — garantir evento da sessão (reutilizável)', () => {
  const input = {
    sessionId: SESSION_X,
    patientName: PATIENT_A.full_name,
    patientEmail: PATIENT_A.email,
    scheduledAt: new Date('2026-10-02T13:00:00.000Z'),
    durationMinutes: 60,
  }

  test('evento já existe no Google → devolve sem criar outro', async () => {
    googleStore.set(EVENT_X, { ...axisEvent(), etag: '"etag-existente"' })

    const event = await ensureSessionGoogleEvent('token-valido', input)

    expect(event?.id).toBe(EVENT_X)
    expect(googleCalls.map((c) => c.kind)).toEqual(['get'])
  })

  test('evento não existe → cria com o id da sessão', async () => {
    const event = await ensureSessionGoogleEvent('token-valido', input)

    expect(event?.id).toBe(EVENT_X)
    expect(googleCalls.map((c) => c.kind)).toEqual(['get', 'insert'])
  })

  test('get sem resposta → não cria às cegas', async () => {
    googleGet = 503

    const event = await ensureSessionGoogleEvent('token-valido', input)

    expect(event).toBeNull()
    expect(googleCalls.map((c) => c.kind)).toEqual(['get'])
  })
})
