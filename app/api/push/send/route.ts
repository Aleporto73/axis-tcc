import { NextRequest, NextResponse } from 'next/server'
import { withTenantClient } from '@/src/database/with-tenant'
import { rateLimit } from '@/src/middleware/rate-limit'
import { env } from '@/src/lib/env'

// =====================================================
// AXIS — Push Notification Send (Internal API)
// Segurança (Auditoria TCC P1):
//   - Rate limit: 60 req/min
//   - API key: INTERNAL_API_KEY (env)
//   - Rota pública no middleware — auth via header
//
// F7 passo 2 (Onda 10): tenant_id obrigatório no body.
// Queries em push_tokens via withTenantClient (GUC) +
// filtro explícito de tenant — RLS-ready (migration 070).
// Sem callers no repo na data desta mudança (rota interna
// manual); contrato alterado sem impacto em código vivo.
// =====================================================

let adminInitialized = false

async function getFirebaseAdmin() {
  if (adminInitialized) {
    const admin = await import('firebase-admin')
    return admin.default
  }

  const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const clientEmail = env.FIREBASE_CLIENT_EMAIL

  if (!privateKey || !clientEmail || privateKey.includes('SUA_CHAVE_AQUI')) {
    return null
  }

  const admin = await import('firebase-admin')
  
  if (!admin.default.apps.length) {
    admin.default.initializeApp({
      credential: admin.default.credential.cert({
        projectId: 'axis-tcc',
        clientEmail,
        privateKey
      })
    })
  }
  
  adminInitialized = true
  return admin.default
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit por IP
    const blocked = await rateLimit(request, { limit: 60, windowMs: 60_000, prefix: 'push-send' })
    if (blocked) return blocked

    // Auth via API key
    const authHeader = request.headers.get('x-api-key')
    if (!env.INTERNAL_API_KEY || authHeader !== env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { user_id, tenant_id, title, body: messageBody, data } = body

    if (!user_id || !title || !tenant_id) {
      return NextResponse.json({ error: 'user_id, tenant_id e title obrigatorios' }, { status: 400 })
    }

    const admin = await getFirebaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Push nao configurado', sent: 0 })
    }

    const tokensResult = await withTenantClient(tenant_id, (client) =>
      client.query(
        'SELECT fcm_token FROM push_tokens WHERE user_id = $1 AND tenant_id = $2',
        [user_id, tenant_id]
      )
    )

    if (tokensResult.rows.length === 0) {
      return NextResponse.json({ error: 'Nenhum token encontrado', sent: 0 })
    }

    const tokens = tokensResult.rows.map(r => r.fcm_token)

    const message = {
      notification: { title, body: messageBody || '' },
      data: data || {},
      tokens
    }

    const response = await admin.messaging().sendEachForMulticast(message)

    const invalidTokens: string[] = []
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(tokens[idx])
      }
    })

    if (invalidTokens.length > 0) {
      await withTenantClient(tenant_id, (client) =>
        client.query(
          'DELETE FROM push_tokens WHERE fcm_token = ANY($1) AND tenant_id = $2',
          [invalidTokens, tenant_id]
        )
      )
    }

    return NextResponse.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      invalid_removed: invalidTokens.length
    })

  } catch (error) {
    console.error('Erro ao enviar push:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
