import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// =====================================================
// AXIS Admin Guard — proteção centralizada
// Só emails autorizados podem acessar APIs /api/admin/*
// =====================================================

const ADMIN_EMAILS = new Set([
  'porto.ar4@gmail.com',
  'aleporto305@gmail.com',
])

export async function verifyAdmin(): Promise<
  | { authorized: true; userId: string; email: string }
  | { authorized: false; response: NextResponse }
> {
  const { userId } = await auth()
  if (!userId) {
    return { authorized: false, response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase()?.trim()

  if (!email || !ADMIN_EMAILS.has(email)) {
    return { authorized: false, response: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }

  return { authorized: true, userId, email }
}
