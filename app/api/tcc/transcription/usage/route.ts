import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import pool from '@/src/database/db'

export const dynamic = 'force-dynamic'

// =====================================================
// Transcription Usage — limite 120 min/mês no FREE
//
// GET:  retorna { minutes_used, limit, is_free, month }
// POST: incrementa { minutes: number }
// =====================================================

const FREE_LIMIT = 120

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const month = currentMonth()

      // Verificar se é FREE ou PAGO
      const licenseRes = await client.query(
        `SELECT hotmart_plan FROM user_licenses
         WHERE tenant_id = $1 AND product_type = 'tcc' AND is_active = true LIMIT 1`,
        [tenantId]
      )
      const isFree = !licenseRes.rows[0]?.hotmart_plan || licenseRes.rows[0].hotmart_plan === ''

      // Buscar uso do mês
      const usageRes = await client.query(
        `SELECT minutes_used FROM transcription_usage WHERE tenant_id = $1 AND month = $2`,
        [tenantId, month]
      )

      return {
        minutes_used: usageRes.rows[0]?.minutes_used || 0,
        limit: isFree ? FREE_LIMIT : null,
        is_free: isFree,
        month,
      }
    })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { minutes } = body

    if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
      return NextResponse.json({ error: 'minutes obrigatório (número positivo)' }, { status: 400 })
    }

    const result = await withTenant(async ({ client, tenantId }) => {
      const month = currentMonth()

      // UPSERT incrementa minutos
      const res = await client.query(
        `INSERT INTO transcription_usage (tenant_id, month, minutes_used, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (tenant_id, month)
         DO UPDATE SET minutes_used = transcription_usage.minutes_used + $3, updated_at = NOW()
         RETURNING minutes_used`,
        [tenantId, month, minutes]
      )

      // Verificar se é FREE e se excedeu
      const licenseRes = await client.query(
        `SELECT hotmart_plan FROM user_licenses
         WHERE tenant_id = $1 AND product_type = 'tcc' AND is_active = true LIMIT 1`,
        [tenantId]
      )
      const isFree = !licenseRes.rows[0]?.hotmart_plan || licenseRes.rows[0].hotmart_plan === ''
      const total = res.rows[0].minutes_used

      return {
        minutes_used: total,
        limit: isFree ? FREE_LIMIT : null,
        is_free: isFree,
        limit_reached: isFree && total >= FREE_LIMIT,
        month,
      }
    })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
