// =====================================================
// AXIS — Cron: expire-licenses (pagamento P2)
//
// Desliga (is_active = false) licença PaymentBeta cujo access_until passou
// há mais de 2 dias (tolerância decidida pela espinha em 13/10/2026): o fim do
// mês pago cai às 21:00 de Brasília da véspera do vencimento e o Asaas pode
// confirmar a renovação no cartão a qualquer hora do dia do vencimento (até ~27 h).
// Só billing_source = 'paymentbeta': Hotmart e cortesia não têm access_until
// e seguem como antes. Cada licença desligada vira 1 registro em axis_audit_logs.
// Auth: Bearer CRON_SECRET (mesmo padrão dos outros crons).
// Roda sem tenant: user_licenses e axis_audit_logs não têm RLS (igual ao receptor Hotmart).
// Agendar de hora em hora (crontab do servidor, igual a /api/cron/reminders).
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'
import { isValidCronAuth } from '@/src/lib/cron-auth'
import { env } from '@/src/lib/env'

export async function GET(request: NextRequest) {
  try {
    // Auth: CRON_SECRET obrigatório (fail-closed)
    const authHeader = request.headers.get('authorization')
    const cronSecret = env.CRON_SECRET

    if (!cronSecret || !isValidCronAuth(authHeader, cronSecret, env.CRON_SECRET_OLD)) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const expired = await client.query(
        `UPDATE user_licenses
            SET is_active = false,
                valid_until = NOW(),
                updated_at = NOW()
          WHERE billing_source = 'paymentbeta'
            AND is_active = true
            AND access_until < NOW() - INTERVAL '2 days'
        RETURNING id, tenant_id, clerk_user_id, product_type, plan_key, access_until, paymentbeta_subscription_id`
      )

      for (const row of expired.rows) {
        await client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
           VALUES ($1, $2, 'cron_expire_licenses', 'PAYMENTBETA_LICENSE_EXPIRED', 'user_licenses', $3, $4, NOW())`,
          [
            row.tenant_id,
            row.clerk_user_id || 'system',
            row.id,
            JSON.stringify({
              tenant_id: row.tenant_id,
              product_type: row.product_type,
              plan_key: row.plan_key,
              access_until: row.access_until instanceof Date ? row.access_until.toISOString() : row.access_until,
              subscription_id: row.paymentbeta_subscription_id,
            }),
          ]
        )
      }

      await client.query('COMMIT')

      if (expired.rows.length > 0) {
        console.log('[cron/expire-licenses] Licenças PaymentBeta vencidas desligadas:', expired.rows.length)
      }

      return NextResponse.json({
        success: true,
        expired: expired.rows.length,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[cron/expire-licenses] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Também aceita POST (mesmo padrão de /api/cron/reminders)
export async function POST(request: NextRequest) {
  return GET(request)
}
