import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { randomBytes } from 'crypto'
import { rateLimit } from '@/src/middleware/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 100 req/min por IP
  const blocked = await rateLimit(req, { limit: 100, windowMs: 60_000, prefix: 'rl:portal-invite' })
  if (blocked) return blocked

  try {
    const { learner_id, guardian_id, guardian_name, guardian_email } = await req.json()
    if (!learner_id || !guardian_id) return NextResponse.json({ error: 'learner_id e guardian_id obrigatórios' }, { status: 400 })

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Verifica que o guardian existe e pertence ao tenant
      const guardianCheck = await client.query(
        'SELECT id FROM guardians WHERE id = $1 AND tenant_id = $2',
        [guardian_id, tenantId]
      )
      if (guardianCheck.rows.length === 0) {
        throw new Error('Responsável não encontrado')
      }

      // Verifica se já existe acesso ativo para este guardian+learner
      const existingAccess = await client.query(
        `SELECT fpa.access_token, fpa.token_expires_at
         FROM family_portal_access fpa
         WHERE fpa.guardian_id = $1 AND fpa.learner_id = $2 AND fpa.tenant_id = $3
           AND fpa.is_active = true
           AND (fpa.token_expires_at IS NULL OR fpa.token_expires_at > NOW())`,
        [guardian_id, learner_id, tenantId]
      )

      // Se já existe acesso ativo e válido, retorna o link existente
      if (existingAccess.rows.length > 0) {
        const existing = existingAccess.rows[0]
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com'
        return {
          token: existing.access_token,
          link: `${baseUrl}/portal/${existing.access_token}`,
          expires_at: existing.token_expires_at,
          reused: true
        }
      }

      // Cria novo token e acesso
      const token = randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 dias

      // Busca ou cria consentimento ativo
      let consentId: string
      const existingConsent = await client.query(
        `SELECT id FROM guardian_consents
         WHERE guardian_id = $1 AND learner_id = $2 AND tenant_id = $3
           AND consent_type = 'portal_access' AND revoked_at IS NULL
         LIMIT 1`,
        [guardian_id, learner_id, tenantId]
      )

      if (existingConsent.rows.length > 0) {
        consentId = existingConsent.rows[0].id
      } else {
        const newConsent = await client.query(
          `INSERT INTO guardian_consents (id, guardian_id, learner_id, tenant_id, consent_type, consent_version, ip_address, accepted_at)
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'portal_access', '1.0', '0.0.0.0'::inet, NOW())
           RETURNING id`,
          [guardian_id, learner_id, tenantId]
        )
        consentId = newConsent.rows[0].id
      }

      // Desativa acessos anteriores expirados/inativos (limpeza)
      await client.query(
        `UPDATE family_portal_access SET is_active = false, deactivated_at = NOW()
         WHERE guardian_id = $1 AND learner_id = $2 AND tenant_id = $3
           AND (is_active = false OR token_expires_at <= NOW())`,
        [guardian_id, learner_id, tenantId]
      )

      // Cria novo acesso portal
      await client.query(
        `INSERT INTO family_portal_access (id, tenant_id, guardian_id, learner_id, access_token, token_expires_at, is_active, activated_at, consent_id)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4, $5, true, NOW(), $6::uuid)
         ON CONFLICT ON CONSTRAINT uq_portal_access
         DO UPDATE SET access_token = EXCLUDED.access_token, token_expires_at = EXCLUDED.token_expires_at, is_active = true, activated_at = NOW(), deactivated_at = NULL`,
        [tenantId, guardian_id, learner_id, token, expires, consentId]
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
