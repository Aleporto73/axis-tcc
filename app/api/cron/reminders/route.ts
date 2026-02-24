import { NextRequest, NextResponse } from 'next/server'
import { processScheduledReminders } from '@/src/services/scheduler'

export async function GET(request: NextRequest) {
  try {
    // Verificar token de segurança (para cron externo)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
