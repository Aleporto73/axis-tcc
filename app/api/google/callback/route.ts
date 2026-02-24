import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!
const BASE_URL = 'https://axistcc.com'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('[GOOGLE_CALLBACK] Erro do Google:', error)
      return NextResponse.redirect(BASE_URL + '/configuracoes?google=error')
    }

    if (!code || !state) {
      return NextResponse.redirect(BASE_URL + '/configuracoes?google=missing_params')
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
      console.error('[GOOGLE_CALLBACK] Erro ao trocar código:', errorData)
      return NextResponse.redirect(BASE_URL + '/configuracoes?google=token_error')
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in, scope } = tokens

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + access_token },
    })
    const userInfo = await userInfoResponse.json()
    console.log('[GOOGLE_CALLBACK] Usuário Google:', userInfo.email)

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [state]
    )

    if (tenantResult.rows.length === 0) {
      console.error('[GOOGLE_CALLBACK] Tenant não encontrado para userId:', state)
      return NextResponse.redirect(BASE_URL + '/configuracoes?google=tenant_error')
    }

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

    console.log('[GOOGLE_CALLBACK] Conexão salva para tenant:', tenantId)

    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, action, metadata)
      VALUES ($1, $2, 'GOOGLE_CALENDAR_CONNECTED', $3)`,
      [tenantId, state, JSON.stringify({ google_email: userInfo.email })]
    )

    return NextResponse.redirect(BASE_URL + '/configuracoes?google=success')
  } catch (error) {
    console.error('[GOOGLE_CALLBACK] Erro:', error)
    return NextResponse.redirect(BASE_URL + '/configuracoes?google=error')
  }
}
