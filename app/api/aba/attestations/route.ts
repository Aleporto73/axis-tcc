import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { encryptParam, getKeyParam } from '@/src/lib/crypto'

// =====================================================
// AXIS ABA - API: Atestações Digitais (session_attestations)
// Ref: skill_axis_aba_v270.md — Sprint 1
//
// POST — Criar atestação (terapeuta=auto, guardian=magic_link)
// GET  — Listar atestações de uma sessão
//
// Bible v2.7.0 regras:
//   1. Terapeuta: automática ao fechar sessão (zero cliques)
//   2. Responsável: email com magic_link via Resend
//   3. Prazo: configurável (padrão 72h)
//   4. IMUTÁVEL após registro
// =====================================================

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────
// GET — Listar atestações de uma sessão
// ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      const attestations = await ctx.client.query(
        `SELECT
          id, session_id, attestor_type, attestor_name,
          attestor_document_masked, attestation_method,
          status, attested_at, expires_at, created_at
        FROM session_attestations
        WHERE session_id = $1 AND tenant_id = $2
        ORDER BY created_at ASC`,
        [sessionId, ctx.tenantId]
      )
      return attestations
    })

    return NextResponse.json({ attestations: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Criar atestação
//
// Para terapeuta: auto ao fechar sessão (system_login)
// Para guardian: cria pendente com magic_link_token
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      session_id,
      attestor_type,
      attestor_id,
      attestor_name,
      attestor_document_masked,
      attestation_method,
      guardian_email,
      deadline_hours,
    } = body

    // Validações
    if (!session_id) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 })
    }
    if (!attestor_type || !['therapist', 'supervisor', 'guardian'].includes(attestor_type)) {
      return NextResponse.json({ error: 'attestor_type inválido' }, { status: 400 })
    }
    if (!attestor_name?.trim()) {
      return NextResponse.json({ error: 'attestor_name obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      // Verificar sessão
      const sessionCheck = await ctx.client.query(
        `SELECT id, status FROM sessions_aba WHERE id = $1 AND tenant_id = $2`,
        [session_id, ctx.tenantId]
      )
      if (sessionCheck.rows.length === 0) {
        throw Object.assign(new Error('Sessão não encontrada'), { statusCode: 404 })
      }

      const keyParam = getKeyParam()
      const now = new Date()

      // Hash de integridade
      const attestationHash = crypto
        .createHash('sha256')
        .update(`${session_id}:${attestor_id || ctx.profileId}:${now.toISOString()}`)
        .digest('hex')

      // IP e user-agent
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip') || 'unknown'
      const userAgent = request.headers.get('user-agent') || ''

      // Magic link para guardian
      let magicLinkToken: string | null = null
      let expiresAt: Date | null = null
      let status: string
      let attestedAt: Date | null = null

      if (attestor_type === 'guardian') {
        magicLinkToken = crypto.randomBytes(32).toString('hex')
        const hours = deadline_hours || 72
        expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000)
        status = 'pending'
      } else {
        // Terapeuta/supervisor: automática (logado = autenticado)
        status = 'completed'
        attestedAt = now
      }

      // Encrypt IP: $3, $4
      const { encryptSQL: encIp } = encryptParam(3)

      const inserted = await ctx.client.query(
        `INSERT INTO session_attestations (
          session_id, tenant_id,
          attestor_type, attestor_id, attestor_name, attestor_document_masked,
          attestation_method, attestation_hash,
          ip_address_encrypted, user_agent,
          magic_link_token, status, attested_at, expires_at
        ) VALUES (
          $1, $2,
          $5, $6, $7, $8,
          $9, $10,
          ${encIp}, $11,
          $12, $13, $14, $15
        )
        RETURNING id, attestor_type, attestor_name, status, attested_at, expires_at, created_at`,
        [
          session_id,                                           // $1
          ctx.tenantId,                                         // $2
          clientIp,                                             // $3 (encrypt value)
          keyParam,                                             // $4 (encrypt key)
          attestor_type,                                        // $5
          attestor_id || ctx.profileId,                         // $6
          attestor_name.trim(),                                 // $7
          attestor_document_masked || null,                     // $8
          attestation_method || (attestor_type === 'guardian' ? 'magic_link' : 'system_login'), // $9
          attestationHash,                                      // $10
          userAgent,                                            // $11
          magicLinkToken,                                       // $12
          status,                                               // $13
          attestedAt,                                           // $14
          expiresAt,                                            // $15
        ]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'ATTESTATION_CREATED', 'operational', $2,
          jsonb_build_object(
            'session_id', $3::text,
            'attestor_type', $4::text,
            'status', $5::text
          )
        )`,
        [ctx.tenantId, ctx.profileId, session_id, attestor_type, status]
      )

      return {
        attestation: inserted.rows[0],
        magic_link_token: magicLinkToken,
        guardian_email: attestor_type === 'guardian' ? guardian_email : undefined,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
