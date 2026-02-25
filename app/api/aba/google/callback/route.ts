import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'

// =====================================================
// AXIS ABA — Google Calendar OAuth Callback
// Conforme Bible S19: Google Calendar Bidirecional
//
// Multi-terapeuta: tokens salvos por profile_id.
// Cada terapeuta tem sua própria calendar_connections entry.
// O UNIQUE constraint é (tenant_id, profile_id, provider).
//
// Diferenças do TCC:
//   - Resolve profile via profiles (não tenants.clerk_user_id)
//   - Salva profile_id como user_id na calendar_connections
//   - Redireciona para /aba/configuracoes
// =====================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_REDIRECT_URI_ABA = process.env.GOOGLE_REDIRECT_URI_ABA
  || process.env.GOOGLE_REDIRECT_URI!.replace('/api/google/callback', '/api/aba/google/callback')

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://axistcc.com'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // clerk_user_id
    const error = searchParams.get('error')

    if (error) {
      console.error('[ABA_GOOGLE_CALLBACK] Erro do Google:', error)
      return NextResponse.redirect(BASE_URL + '/aba/configuracoes?google=error')
    }

    if (!code || !state) {
      return NextResponse.redirect(BASE_URL + '/aba/configuracoes?google=missing_params')
    }

    // Trocar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI_ABA,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[ABA_GOOGLE_CALLBACK] Erro ao trocar código:', errorData)
      return NextResponse.redirect(BASE_URL + '/aba/configuracoes?google=token_error')
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in, scope } = tokens

    // Buscar email do Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + access_token },
    })
    const userInfo = await userInfoResponse.json()
    console.log('[ABA_GOOGLE_CALLBACK] Usuário Google:', userInfo.email)

    // Resolver profile via clerk_user_id (multi-terapeuta)
    const profileResult = await pool.query(
      `SELECT p.id AS profile_id, p.tenant_id, p.role, p.name
       FROM profiles p
       WHERE p.clerk_user_id = $1 AND p.is_active = true
       LIMIT 1`,
      [state]
    )

    if (profileResult.rows.length === 0) {
      // Fallback: tentar tenants (compatibilidade migração)
      const tenantResult = await pool.query(
        'SELECT id FROM tenants WHERE clerk_user_id = $1',
        [state]
      )

      if (tenantResult.rows.length === 0) {
        console.error('[ABA_GOOGLE_CALLBACK] Profile/Tenant não encontrado para userId:', state)
        return NextResponse.redirect(BASE_URL + '/aba/configuracoes?google=tenant_error')
      }

      // Fallback: usar tenantId como profileId (pré-migração)
      const tenantId = tenantResult.rows[0].id
      const tokenExpiry = new Date(Date.now() + expires_in * 1000)

      await pool.query(
        `INSERT INTO calendar_connections
          (tenant_id, user_id, provider, calendar_id, access_token, refresh_token, token_expiry, scope)
         VALUES ($1, $2, 'google', 'primary', $3, $4, $5, $6)
         ON CONFLICT (tenant_id, user_id, provider)
         DO UPDATE SET
           access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_connections.refresh_token),
           token_expiry = EXCLUDED.token_expiry,
           scope = EXCLUDED.scope,
           updated_at = NOW()`,
        [tenantId, state, access_token, refresh_token, tokenExpiry, scope]
      )

      await pool.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
         VALUES ($1, $2, 'GOOGLE_CALENDAR_CONNECTED', $3)`,
        [tenantId, state, JSON.stringify({ google_email: userInfo.email, product: 'axis_aba', mode: 'fallback' })]
      )

      return NextResponse.redirect(BASE_URL + '/aba/configuracoes?google=success')
    }

    // Fluxo principal: multi-terapeuta via profiles
    const { profile_id, tenant_id, role, name } = profileResult.rows[0]
    const tokenExpiry = new Date(Date.now() + expires_in * 1000)

    // Salvar tokens indexados por profile_id
    // UNIQUE(tenant_id, user_id, provider) — user_id = profile_id no ABA
    await pool.query(
      `INSERT INTO calendar_connections
        (tenant_id, user_id, provider, calendar_id, access_token, refresh_token, token_expiry, scope)
       VALUES ($1, $2, 'google', 'primary', $3, $4, $5, $6)
       ON CONFLICT (tenant_id, user_id, provider)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_connections.refresh_token),
         token_expiry = EXCLUDED.token_expiry,
         scope = EXCLUDED.scope,
         updated_at = NOW()`,
      [tenant_id, profile_id, access_token, refresh_token, tokenExpiry, scope]
    )

    console.log('[ABA_GOOGLE_CALLBACK] Conexão salva — profile:', profile_id, 'tenant:', tenant_id, 'role:', role)

    // Audit log — Bible S13.3
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
       VALUES ($1, $2, 'GOOGLE_CALENDAR_CONNECTED', $3)`,
      [
        tenant_id,
        state,
        JSON.stringify({
          google_email: userInfo.email,
          profile_id,
          profile_name: name,
          role,
          product: 'axis_aba',
        }),
      ]
    )

    return NextResponse.redirect(BASE_URL + '/aba/configuracoes?google=success')
  } catch (error) {
    console.error('[ABA_GOOGLE_CALLBACK] Erro:', error)
    return NextResponse.redirect(BASE_URL + '/aba/configuracoes?google=error')
  }
}
