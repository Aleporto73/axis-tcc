import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { processScheduledReminders } from '@/src/services/scheduler'

/**
 * Valida o header Authorization contra o CRON_SECRET em tempo constante.
 * Retorna false se: header ausente, não começa com "Bearer ",
 * comprimentos divergem, ou tokens diferem.
 */
function isValidCronAuth(authHeader: string | null, secret: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  const providedToken = authHeader.slice('Bearer '.length)
  const providedBuf = Buffer.from(providedToken)
  const expectedBuf = Buffer.from(secret)
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
}

export async function GET(request: NextRequest) {
  try {
    // Auth: CRON_SECRET obrigatório (fail-closed)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || !isValidCronAuth(authHeader, cronSecret)) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const result = await processScheduledReminders()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro no cron de lembretes:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Também aceita POST para flexibilidade
export async function POST(request: NextRequest) {
  return GET(request)
}
