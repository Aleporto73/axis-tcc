import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// GET — Verificar consentimento ativo
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const { searchParams } = new URL(request.url)
      const guardianId = searchParams.get('guardian_id')
      const learnerId = searchParams.get('learner_id')
      const consentType = searchParams.get('consent_type')

      if (!guardianId || !learnerId || !consentType) {
        throw new Error('guardian_id, learner_id e consent_type são obrigatórios')
      }

      return await client.query(
        'SELECT check_consent($1, $2, $3::aba_consent_type, $4) as has_consent',
        [guardianId, learnerId, consentType, tenantId]
      )
    })

    return NextResponse.json({ has_consent: result.rows[0]?.has_consent || false })
  } catch (error: any) {
    console.error('Erro ao verificar consentimento:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message.includes('obrigatórios')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Registrar ou revogar consentimento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (!action || !['register', 'revoke'].includes(action)) {
      return NextResponse.json(
        { error: 'action deve ser "register" ou "revoke"' },
        { status: 400 }
      )
    }

    if (action === 'register') {
      const { guardian_id, learner_id, consent_type } = body

      if (!guardian_id || !learner_id || !consent_type) {
        return NextResponse.json(
          { error: 'guardian_id, learner_id e consent_type são obrigatórios' },
          { status: 400 }
        )
      }

      const result = await withTenant(async ({ client, tenantId, userId }) => {
        const ipAddress = (request.headers.get('x-forwarded-for') || '0.0.0.0').split(',')[0].trim()

        return await client.query(
          'SELECT register_consent($1, $2, $3, $4::aba_consent_type, $5::inet, $6) as consent_id',
          [guardian_id, learner_id, tenantId, consent_type, ipAddress, userId]
        )
      })

      return NextResponse.json({ consent_id: result.rows[0]?.consent_id }, { status: 201 })
    }

    if (action === 'revoke') {
      const { consent_id } = body

      if (!consent_id) {
        return NextResponse.json(
          { error: 'consent_id é obrigatório para revogar' },
          { status: 400 }
        )
      }

      await withTenant(async ({ client, tenantId, userId }) => {
        await client.query(
          'SELECT revoke_consent($1, $2, $3)',
          [consent_id, tenantId, userId]
        )
      })

      return NextResponse.json({ revoked: true }, { status: 200 })
    }
  } catch (error: any) {
    console.error('Erro ao gerenciar consentimento:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('[AXIS ABA]')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
