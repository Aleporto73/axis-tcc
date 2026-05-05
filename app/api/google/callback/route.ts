import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'
import * as Sentry from '@sentry/nextjs'
import { env } from '@/src/lib/env'

// Pool: shared (Auditoria TCC P0 — unified pool)

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_REDIRECT_URI = env.GOOGLE_REDIRECT_URI || ''
const BASE_URL = env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      Sentry.captureMessage('[GOOGLE_CALLBACK] OAuth error', { level: 'warning', tags: { oauth_error_code: error } })
      console.error('[GOOGLE_CALLBACK] Erro do Google:', error)
      return NextResponse.redirect(BASE_URL + '/configuracoes?google=error')
    }

    if (!code || !state) {
      return NextResponse.redirect(BASE_URL + '/configuracoes?google=missing_params')
    }

    // Cross-check OAuth state contra auth().userId (Sub 2 Onda 8)
    const { userId } = await auth()
    if (!userId || userId !== state) {
      console.warn('[GOOGLE_CALLBACK] state mismatch:', { hasUserId: !!userId, stateLen: state?.length })
      return NextResponse.redirect(BASE_URL + '/configuracoes?google=state_mismatch')
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      Sentry.captureMessage('[GOOGLE_CALLBACK] Token exchange failed', { level: 'error', extra: { body: errorData?.slice(0, 500) } })
      console.error('[GOOGLE_CALLBACK] Erro ao trocar codigo:', errorData)
      return NextResponse.redirect(BASE_URL + '/configuracoes?google=token_error')
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in, scope } = tokens

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + access_token },
    })
    const userInfo = await userInfoResponse.json()

    // Resolver profile via clerk_user_id (multi-tenant safe)
    // OAuth callback: state = clerk_user_id, ja validado contra auth().userId acima
    const profileResult = await pool.query(
      `SELECT p.id AS profile_id, p.tenant_id
       FROM profiles p
       WHERE p.clerk_user_id = $1 AND p.is_active = true
       LIMIT 1`,
      [state]
    )

    if (profileResult.rows.length === 0) {
      Sentry.captureMessage('[GOOGLE_CALLBACK] Profile not found for OAuth state', { level: 'warning', tags: { invariant: 'profile_not_found_for_state' } })
      console.error('[GOOGLE_CALLBACK] Profile nao encontrado para userId:', state)
      return NextResponse.redirect(BASE_URL + '/configuracoes?google=tenant_error')
    }

    const { profile_id, tenant_id: tenantId } = profileResult.rows[0]
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
      [tenantId, profile_id, access_token, refresh_token, tokenExpiry, scope]
    )

    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
      VALUES ($1, $2, 'GOOGLE_CALENDAR_CONNECTED', $3)`,
      [tenantId, state, JSON.stringify({ google_email: userInfo.email, profile_id, product: 'axis_tcc' })]
    )

    return NextResponse.redirect(BASE_URL + '/configuracoes?google=success')
  } catch (error) {
    Sentry.captureException(error)
    console.error('[GOOGLE_CALLBACK] Erro:', error)
    return NextResponse.redirect(BASE_URL + '/configuracoes?google=error')
  }
}
