// =====================================================
// AXIS — Cron: renew-webhook (Google Calendar)
//
// Renova webhooks Google Calendar expirados/expirando em <=24h.
// Auth: Bearer CRON_SECRET (mesmo padrão dos outros crons).
//
// Pattern S3 cross-tenant (HUB-05.B Etapa 6):
//   Query 0 descobre conns expirando (sem RLS context — calendar_connections
//   sem RLS forced ate migration 070/071).
//   Loop por tenant: withTenantClient(tenantId, ...) processa todas as conns
//   daquele tenant em transacao isolada. Mesma estrutura do scheduler.ts (Item 11F).
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'
import { withTenantClient } from '@/src/database/with-tenant'
import { randomUUID } from 'crypto'
import { isValidCronAuth } from '@/src/lib/cron-auth'
import { env } from '@/src/lib/env'

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || ''
const WEBHOOK_URL = (env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com') + '/api/google/webhook'

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  const data = await response.json()
  return data.access_token
}

export async function GET(request: NextRequest) {
  try {
    // Auth: CRON_SECRET obrigatório (fail-closed)
    const authHeader = request.headers.get('authorization')
    const cronSecret = env.CRON_SECRET

    if (!cronSecret || !isValidCronAuth(authHeader, cronSecret, env.CRON_SECRET_OLD)) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const expiringSoon = new Date()
    expiringSoon.setDate(expiringSoon.getDate() + 1)

    // Query 0 cross-tenant: descobre conns expirando (sem RLS context)
    const connsResult = await pool.query(
      `SELECT * FROM calendar_connections 
       WHERE provider = 'google' 
       AND sync_enabled = true
       AND (webhook_expiration IS NULL OR webhook_expiration < $1)`,
      [expiringSoon]
    )

    // Agrupar por tenant_id em memoria (evita N+1 queries)
    const connsByTenant = new Map<string, typeof connsResult.rows>()
    for (const conn of connsResult.rows) {
      if (!connsByTenant.has(conn.tenant_id)) {
        connsByTenant.set(conn.tenant_id, [])
      }
      connsByTenant.get(conn.tenant_id)!.push(conn)
    }

    let renewed = 0
    let failed = 0
    const errorsByTenant: Record<string, string> = {}

    // Pattern S3: loop por tenant, withTenantClient seta GUC, processa conns
    for (const [tenantId, conns] of connsByTenant) {
      try {
        await withTenantClient(tenantId, async (client) => {
          for (const conn of conns) {
            try {
              let accessToken = conn.access_token

              if (new Date(conn.token_expiry) < new Date()) {
                accessToken = await refreshAccessToken(conn.refresh_token)
                if (!accessToken) {
                  failed++
                  continue
                }
                await client.query(
                  'UPDATE calendar_connections SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
                  [accessToken, new Date(Date.now() + 3600 * 1000), conn.id]
                )
              }

              if (conn.webhook_channel_id && conn.webhook_resource_id) {
                try {
                  await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
                    method: 'POST',
                    headers: {
                      'Authorization': 'Bearer ' + accessToken,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      id: conn.webhook_channel_id,
                      resourceId: conn.webhook_resource_id,
                    }),
                  })
                } catch (e) {
                }
              }

              const channelId = randomUUID()
              const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000

              const watchResponse = await fetch(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
                {
                  method: 'POST',
                  headers: {
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    id: channelId,
                    type: 'web_hook',
                    address: WEBHOOK_URL,
                    expiration: expiration,
                  }),
                }
              )

              if (watchResponse.ok) {
                const watchData = await watchResponse.json()
                await client.query(
                  `UPDATE calendar_connections 
                   SET webhook_channel_id = $1, webhook_resource_id = $2, webhook_expiration = $3, updated_at = NOW()
                   WHERE id = $4`,
                  [watchData.id, watchData.resourceId, new Date(parseInt(watchData.expiration)), conn.id]
                )
                renewed++
              } else {
                failed++
              }
            } catch (e) {
              console.error('[RENEW] Erro conn:', conn.id, e)
              failed++
            }
          }
        })
      } catch (e) {
        console.error('[RENEW] Erro fatal tenant:', tenantId, e)
        errorsByTenant[tenantId] = e instanceof Error ? e.message : String(e)
      }
    }

    return NextResponse.json({
      success: true,
      renewed,
      failed,
      tenants_processed: connsByTenant.size,
      ...(Object.keys(errorsByTenant).length > 0 ? { errors: errorsByTenant } : {})
    })
  } catch (error) {
    console.error('[RENEW-WEBHOOK] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
