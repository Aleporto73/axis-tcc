import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { withTenant } from '@/src/database/with-tenant'
import { requireFeature, handleRouteError } from '@/src/database/with-role'
import { encryptParam, getKeyParam } from '@/src/lib/crypto'
import { classifyGeoProof, haversineDistance } from '@/src/lib/geo-classifier'

// =====================================================
// AXIS ABA - API: Prova de Presença (session_presence_proofs)
// Ref: skill_axis_aba_v270.md — Sprint 1
//
// POST — Registrar check-in ou check-out GPS
// GET  — Listar provas de presença de uma sessão
//
// Classificação automática (valid/warning/exception).
// Lat/Long/IP criptografados (pgcrypto).
// Audit log em toda operação.
// =====================================================

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────
// GET — Listar provas de presença de uma sessão
// ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireFeature(ctx, 'presenceProofs')
      const proofs = await ctx.client.query(
        `SELECT
          id, session_id, proof_type, accuracy_meters, altitude_meters,
          distance_to_site_meters, capture_source, confidence_status,
          exception_reason, device_hash, declared_site_id,
          captured_at, captured_by, created_at
        FROM session_presence_proofs
        WHERE session_id = $1 AND tenant_id = $2
        ORDER BY captured_at ASC`,
        [sessionId, ctx.tenantId]
      )
      return proofs
    })

    return NextResponse.json({ proofs: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Registrar check-in ou check-out
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      session_id,
      proof_type,
      latitude,
      longitude,
      accuracy_meters,
      altitude_meters,
      capture_source,
      exception_reason,
      gps_denied,
    } = body

    // Validações básicas
    if (!session_id) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 })
    }
    if (!proof_type || !['checkin', 'checkout'].includes(proof_type)) {
      return NextResponse.json({ error: 'proof_type deve ser checkin ou checkout' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireFeature(ctx, 'presenceProofs')
      // Verificar sessão pertence ao tenant e está em andamento
      const sessionCheck = await ctx.client.query(
        `SELECT id, status, declared_site_id, service_mode
        FROM sessions_aba
        WHERE id = $1 AND tenant_id = $2`,
        [session_id, ctx.tenantId]
      )

      if (sessionCheck.rows.length === 0) {
        throw Object.assign(new Error('Sessão não encontrada'), { statusCode: 404 })
      }

      const session = sessionCheck.rows[0]

      // Checkout só se sessão está in_progress
      if (proof_type === 'checkout' && session.status !== 'in_progress') {
        throw Object.assign(new Error('Check-out só permitido em sessão em andamento'), { statusCode: 400 })
      }

      // Buscar dados do local declarado (se houver)
      let siteLat: number | null = null
      let siteLon: number | null = null
      let siteRadius: number | null = null

      if (session.declared_site_id) {
        const siteData = await ctx.client.query(
          `SELECT latitude, longitude, radius_meters FROM service_sites WHERE id = $1`,
          [session.declared_site_id]
        )
        if (siteData.rows.length > 0) {
          siteLat = siteData.rows[0].latitude
          siteLon = siteData.rows[0].longitude
          siteRadius = siteData.rows[0].radius_meters
        }
      }

      // Calcular distância ao local
      const distance = haversineDistance(
        latitude ?? null,
        longitude ?? null,
        siteLat,
        siteLon
      )

      // Classificar a prova de presença
      const classification = classifyGeoProof({
        accuracy_meters: accuracy_meters ?? null,
        distance_to_site_meters: distance,
        site_radius_meters: siteRadius,
        service_mode: session.service_mode || 'presencial',
        gps_denied: !!gps_denied,
      })

      // Se exception e sem motivo — exigir
      if (classification.confidence_status === 'exception' && !exception_reason && !classification.exception_reason) {
        throw Object.assign(
          new Error('Justificativa obrigatória para exceção GPS'),
          { statusCode: 400 }
        )
      }

      const keyParam = getKeyParam()

      // Device hash (integridade, NÃO tracking)
      const userAgent = request.headers.get('user-agent') || ''
      const deviceHash = crypto
        .createHash('sha256')
        .update(userAgent + (request.headers.get('accept-language') || ''))
        .digest('hex')
        .substring(0, 16)

      // Raw payload hash
      const rawPayloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ session_id, proof_type, latitude, longitude, accuracy_meters, timestamp: Date.now() }))
        .digest('hex')

      // IP do request
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown'

      // Encrypt params: lat($3,$4), lon($5,$6), ip($7,$8)
      const { encryptSQL: encLat } = encryptParam(3)
      const { encryptSQL: encLon } = encryptParam(5)
      const { encryptSQL: encIp } = encryptParam(7)

      const inserted = await ctx.client.query(
        `INSERT INTO session_presence_proofs (
          session_id, tenant_id, proof_type,
          latitude_encrypted, longitude_encrypted, ip_address_encrypted,
          accuracy_meters, altitude_meters, distance_to_site_meters,
          capture_source, confidence_status, exception_reason,
          device_hash, raw_payload_hash, declared_site_id,
          captured_at, captured_by
        ) VALUES (
          $1, $2, $9,
          ${encLat}, ${encLon}, ${encIp},
          $10, $11, $12,
          $13, $14, $15,
          $16, $17, $18,
          NOW(), $19
        )
        RETURNING id, proof_type, confidence_status, exception_reason,
          accuracy_meters, distance_to_site_meters, captured_at`,
        [
          session_id,                                           // $1
          ctx.tenantId,                                         // $2
          latitude !== undefined ? String(latitude) : null,     // $3 (encrypt value)
          keyParam,                                             // $4 (encrypt key)
          longitude !== undefined ? String(longitude) : null,   // $5 (encrypt value)
          keyParam,                                             // $6 (encrypt key)
          clientIp,                                             // $7 (encrypt value)
          keyParam,                                             // $8 (encrypt key)
          proof_type,                                           // $9
          accuracy_meters ?? null,                              // $10
          altitude_meters ?? null,                              // $11
          distance,                                             // $12
          capture_source || 'browser_gps',                      // $13
          classification.confidence_status,                     // $14
          exception_reason || classification.exception_reason,  // $15
          deviceHash,                                           // $16
          rawPayloadHash,                                       // $17
          session.declared_site_id,                             // $18
          ctx.profileId,                                        // $19
        ]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
        VALUES ($1, $2, 'user', 'PRESENCE_PROOF_RECORDED', 'presence_proof', $3,
          jsonb_build_object(
            'category', 'operational',
            'profile_id', $4::text,
            'session_id', $5::text,
            'proof_type', $6::text,
            'confidence_status', $7::text,
            'flags', $8::text
          ),
          NOW()
        )`,
        [
          ctx.tenantId, ctx.userId, inserted.rows[0].id, ctx.profileId, session_id,
          proof_type, classification.confidence_status,
          classification.flags.join(','),
        ]
      )

      return { proof: inserted.rows[0], flags: classification.flags }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
