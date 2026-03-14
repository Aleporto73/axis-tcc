import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// =====================================================
// AXIS TDAH — API Eventos Clínicos
// Equivalente a /api/aba/sessions/[id]/behaviors
// Tabela: tdah_events (Bible §10.2)
//
// Diferenças vs ABA:
//   - event_type expandido (transition, sensory, behavioral, abc, task_avoidance, etc.)
//   - ABC é condicional (nem todo evento tem antecedent/behavior/consequence)
//   - Contexto tricontextual (clinical/home/school)
//   - intensity opcional (leve/moderada/alta/severa)
// =====================================================

const VALID_EVENT_TYPES = new Set([
  'transition', 'sensory', 'behavioral', 'abc',
  'task_avoidance', 'task_engagement', 'self_regulation', 'other',
])

const VALID_INTENSITIES = new Set(['leve', 'moderada', 'alta', 'severa'])
const VALID_CONTEXTS = new Set(['clinical', 'home', 'school'])

// GET — Listar eventos de uma sessão
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const { searchParams } = new URL(request.url)
      const sessionId = searchParams.get('session_id')
      const patientId = searchParams.get('patient_id')
      const eventType = searchParams.get('event_type')

      if (!sessionId && !patientId) {
        throw new Error('session_id ou patient_id é obrigatório')
      }

      let q = `
        SELECT e.*, p.name as patient_name, s.session_context
        FROM tdah_events e
        JOIN tdah_sessions s ON s.id = e.session_id
        JOIN tdah_patients tp ON tp.id = s.patient_id
        LEFT JOIN profiles p ON p.id = e.recorded_by
        WHERE e.tenant_id = $1
      `
      const params: any[] = [tenantId]

      if (sessionId) {
        params.push(sessionId)
        q += ` AND e.session_id = $${params.length}`
      }

      if (patientId) {
        params.push(patientId)
        q += ` AND s.patient_id = $${params.length}`
      }

      if (eventType) {
        params.push(eventType)
        q += ` AND e.event_type = $${params.length}`
      }

      q += ' ORDER BY e.occurred_at DESC'

      return await client.query(q, params)
    })

    return NextResponse.json({ events: result.rows })
  } catch (error: any) {
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('obrigatório')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[TDAH EVENTS GET] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Registrar evento clínico TDAH
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      session_id, event_type, description,
      antecedent, behavior, consequence,
      intensity, context, occurred_at,
    } = body

    // Validações obrigatórias
    if (!session_id || !event_type) {
      return NextResponse.json(
        { error: 'session_id e event_type são obrigatórios' },
        { status: 400 }
      )
    }

    if (!VALID_EVENT_TYPES.has(event_type)) {
      return NextResponse.json(
        { error: `event_type inválido. Válidos: ${[...VALID_EVENT_TYPES].join(', ')}` },
        { status: 400 }
      )
    }

    // ABC obrigatório se event_type === 'abc'
    if (event_type === 'abc' && (!antecedent || !behavior || !consequence)) {
      return NextResponse.json(
        { error: 'Para eventos ABC, antecedent, behavior e consequence são obrigatórios' },
        { status: 400 }
      )
    }

    if (intensity && !VALID_INTENSITIES.has(intensity)) {
      return NextResponse.json(
        { error: `intensity inválido. Válidos: ${[...VALID_INTENSITIES].join(', ')}` },
        { status: 400 }
      )
    }

    if (context && !VALID_CONTEXTS.has(context)) {
      return NextResponse.json(
        { error: `context inválido. Válidos: ${[...VALID_CONTEXTS].join(', ')}` },
        { status: 400 }
      )
    }

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Verificar sessão existe e está in_progress
      const session = await client.query(
        `SELECT id, status, session_context FROM tdah_sessions
         WHERE id = $1 AND tenant_id = $2`,
        [session_id, tenantId]
      )

      if (session.rows.length === 0) {
        throw new Error('Sessão não encontrada')
      }

      // Bible §11: sessão fechada é imutável
      if (session.rows[0].status === 'completed' || session.rows[0].status === 'cancelled') {
        throw new Error('Sessão já finalizada — não é possível registrar eventos (Bible §11)')
      }

      // Buscar profile do user
      const profile = await client.query(
        'SELECT id FROM profiles WHERE clerk_user_id = $1 AND tenant_id = $2 AND is_active = true',
        [userId, tenantId]
      )
      const profileId = profile.rows[0]?.id || null

      // Usar contexto da sessão se não especificado
      const eventContext = context || session.rows[0].session_context

      const insert = await client.query(
        `INSERT INTO tdah_events (
          tenant_id, session_id, event_type,
          antecedent, behavior, consequence, description,
          intensity, context, occurred_at, recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::tdah_session_context_enum, $10, $11)
        RETURNING *`,
        [
          tenantId, session_id, event_type,
          antecedent || null, behavior || null, consequence || null, description || null,
          intensity || null, eventContext || null,
          occurred_at || new Date().toISOString(), profileId,
        ]
      )

      return insert.rows[0]
    })

    return NextResponse.json({ event: result }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message === 'Sessão não encontrada') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message?.includes('Bible')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('[TDAH EVENTS POST] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
