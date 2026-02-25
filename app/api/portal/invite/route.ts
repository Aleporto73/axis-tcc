import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { randomBytes } from 'crypto'
import { rateLimit } from '@/src/middleware/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 100 req/min por IP
  const blocked = await rateLimit(req, { limit: 100, windowMs: 60_000, prefix: 'rl:portal-invite' })
  if (blocked) return blocked

  try {
    const { learner_id, guardian_name, guardian_email } = await req.json()
    if (!learner_id || !guardian_name) return NextResponse.json({ error: 'learner_id e guardian_name obrigatórios' }, { status: 400 })

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Gera IDs
      const guardian_id = randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
      const token = randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 dias

      // Cria consentimento
      const consent = await client.query(
        `INSERT INTO guardian_consents (id, guardian_id, learner_id, tenant_id, consent_type, consent_version, ip_address, accepted_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'portal_access', '1.0', '0.0.0.0'::inet, NOW())
         RETURNING id`,
        [guardian_id, learner_id, tenantId]
      )

      // Cria acesso portal
      await client.query(
        `INSERT INTO family_portal_access (id, tenant_id, guardian_id, learner_id, access_token, token_expires_at, is_active, activated_at, consent_id)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4, $5, true, NOW(), $6::uuid)`,
        [tenantId, guardian_id, learner_id, token, expires, consent.rows[0].id]
      )

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com'
      return { token, link: `${baseUrl}/portal/${token}`, expires_at: expires }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err: any) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
