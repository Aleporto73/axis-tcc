import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'

let adminInitialized = false

async function getFirebaseAdmin() {
  if (adminInitialized) {
    const admin = await import('firebase-admin')
    return admin.default
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL

  if (!privateKey || !clientEmail || privateKey.includes('SUA_CHAVE_AQUI')) {
    console.log('[PUSH] Firebase Admin nao configurado')
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
    const authHeader = request.headers.get('x-api-key')
    if (authHeader !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { user_id, title, body: messageBody, data } = body

    if (!user_id || !title) {
      return NextResponse.json({ error: 'user_id e title obrigatorios' }, { status: 400 })
    }

    const admin = await getFirebaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Push nao configurado', sent: 0 })
    }

    const tokensResult = await pool.query(
      'SELECT fcm_token FROM push_tokens WHERE user_id = $1',
      [user_id]
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
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(tokens[idx])
      }
    })

    if (invalidTokens.length > 0) {
      await pool.query('DELETE FROM push_tokens WHERE fcm_token = ANY($1)', [invalidTokens])
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
