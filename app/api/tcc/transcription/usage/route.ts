import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { getTranscriptionUsage } from '@/src/services/transcription-limit'

export const dynamic = 'force-dynamic'

// =====================================================
// Transcription Usage - Fase 12.2
//
// GET:  retorna { minutes_used (acumulado), limit, is_free, limit_reached }
// POST: incrementa { minutes: number } - UPSERT mensal preserva historia
// =====================================================

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      return await getTranscriptionUsage(client, tenantId)
    })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Nao autenticado') return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { minutes } = body

    if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
      return NextResponse.json({ error: 'minutes obrigatorio (numero positivo)' }, { status: 400 })
    }

    const result = await withTenant(async ({ client, tenantId }) => {
      const month = currentMonth()

      // UPSERT mensal preserva granularidade historica
      await client.query(
        `INSERT INTO transcription_usage (tenant_id, month, minutes_used, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (tenant_id, month)
         DO UPDATE SET minutes_used = transcription_usage.minutes_used + $3, updated_at = NOW()`,
        [tenantId, month, minutes]
      )

      // Retornar status acumulado (SUM sobre todos os meses)
      return await getTranscriptionUsage(client, tenantId)
    })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Nao autenticado') return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
