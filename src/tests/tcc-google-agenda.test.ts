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

// ─── Postgres falso ───

interface FakeSession {
  id: string
  tenant_id: string
  patient_id: string
  session_number: number
  status: string
  google_event_id: string | null
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

  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return result()
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
  if (sql.startsWith('SELECT * FROM calendar_connections')) {
    return result([{ id: 'conn-1', access_token: 'token-valido', refresh_token: 'refresh', token_expiry: TOKEN_EXPIRY }])
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
  if (sql.startsWith('SELECT 1 FROM sessions')) {
    const found = sessions.some((s) => s.tenant_id === params[0] && s.google_event_id === params[1])
    return result(found ? [{ '?column?': 1 }] : [])
  }
  if (sql.startsWith('UPDATE sessions')) return updateSessions(sql, params)
  if (sql.startsWith('INSERT INTO sessions')) {
    const row = parseInsert(sql, params)
    const session: FakeSession = {
      id: `sessao-nova-${++sessionSeq}`,
      tenant_id: String(row.tenant_id),
      patient_id: String(row.patient_id),
      session_number: Number(row.session_number),
      status: String(row.status),
      google_event_id: (row.google_event_id as string | null | undefined) ?? null,
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
let googleCreate: { ok: boolean; event?: Record<string, unknown> } = { ok: true }

const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = String(input)
  if (url.includes('conferenceDataVersion=1')) {
    if (!googleCreate.ok) return new Response('erro do Google', { status: 500 })
    return Response.json(googleCreate.event)
  }
  if (url.includes('/calendars/primary/events?')) {
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

beforeEach(() => {
  sessions = []
  reminders = []
  queries = []
  savedSyncToken = null
  lockHook = null
  sessionSeq = 0
  googleEvents = []
  googleCreate = {
    ok: true,
    event: {
      id: 'evt-criado',
      etag: '"etag-criado"',
      updated: '2026-09-27T12:00:00.000Z',
      hangoutLink: 'https://meet.google.com/teste',
    },
  }
  mockAuth.mockResolvedValue({ userId: CLERK_USER })
  mockCaptureException.mockClear()
  vi.mocked(nextSessionNumber).mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
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
    const res = await createPOST(
      jsonRequest({ patient_id: PATIENT_A.id, start_now: false, scheduled_at: '2026-10-02T13:00:00.000Z' })
    )

    expect(res.status).toBe(201)
    expect(sessions[0]).toMatchObject({
      google_event_id: 'evt-criado',
      external_etag: '"etag-criado"',
      external_updated_at: '2026-09-27T12:00:00.000Z',
      status: 'agendada',
    })
  })

  test('create agendada: Google falhou → sessão sem google_event_id e sem etag (como hoje)', async () => {
    googleCreate = { ok: false }

    const res = await createPOST(
      jsonRequest({ patient_id: PATIENT_A.id, start_now: false, scheduled_at: '2026-10-02T13:00:00.000Z' })
    )

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
