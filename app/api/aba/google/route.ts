import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GOOGLE_SCOPES } from '@/src/google/calendar-helpers'

// =====================================================
// AXIS ABA — Google Calendar OAuth Initiation
// Conforme Bible S19: Google Calendar Bidirecional
//
// Multi-terapeuta: cada terapeuta conecta seu próprio Gmail.
// O state inclui clerk_user_id para identificar no callback.
// Mesmas credenciais Google Cloud do .env (GOOGLE_CLIENT_ID).
// =====================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_REDIRECT_URI_ABA = process.env.GOOGLE_REDIRECT_URI_ABA
  || process.env.GOOGLE_REDIRECT_URI!.replace('/api/google/callback', '/api/aba/google/callback')

// GET /api/aba/google — Redireciona para autorização do Google
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI_ABA)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', GOOGLE_SCOPES)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    // State: clerk_user_id (resolvido para profile_id no callback)
    authUrl.searchParams.set('state', userId)

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('[ABA_GOOGLE_CONNECT] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
