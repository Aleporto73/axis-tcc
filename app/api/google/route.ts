import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!

// Scopes necessários para Google Calendar
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ')

// GET /api/google - Redireciona para autorização do Google
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Montar URL de autorização do Google
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', userId) // Para identificar o usuário no callback

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('[GOOGLE_CONNECT] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
