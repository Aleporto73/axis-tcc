import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { withTenant } from '@/src/database/with-tenant'
import { requireFeature, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Pacotes de Evidência (session_evidence_bundles)
// Ref: skill_axis_aba_v270.md — Sprint 1
//
// POST — Gerar bundle para uma sessão
// GET  — Listar bundles de uma sessão
//
// Componentes (Bible v2.7.0):
//   - Snapshot clínico (CSO) — sempre
//   - Prova presença (geo) — depende do pagador
//   - Atestação terapeuta — sempre
//   - Atestação responsável — depende do pagador
//   - Anexos — depende do pagador
//   - Local declarado — sempre
//   - Metadados técnicos — sempre
//
// Imutável — correção cria nova versão com supersedes_id.
// =====================================================

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────
// GET — Listar bundles de uma sessão
// ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireFeature(ctx, 'evidenceBundles')
      const bundles = await ctx.client.query(
        `SELECT
          id, session_id, bundle_hash, components, status,
          missing_items, version, supersedes_id,
          generated_at, generated_by, created_at
        FROM session_evidence_bundles
        WHERE session_id = $1 AND tenant_id = $2
        ORDER BY version DESC`,
        [sessionId, ctx.tenantId]
      )
      return bundles
    })

    return NextResponse.json({ bundles: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Gerar bundle de evidência para uma sessão
// Coleta todos os componentes e gera hash unificado.
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, generated_by } = body

    if (!session_id) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireFeature(ctx, 'evidenceBundles')
      // Verificar sessão
      const sessionCheck = await ctx.client.query(
        `SELECT s.id, s.status, s.declared_site_id, s.service_mode
        FROM sessions_aba s
        WHERE s.id = $1 AND s.tenant_id = $2`,
        [session_id, ctx.tenantId]
      )
      if (sessionCheck.rows.length === 0) {
        throw Object.assign(new Error('Sessão não encontrada'), { statusCode: 404 })
      }

      const session = sessionCheck.rows[0]

      // Coletar componentes
      const components: Array<{ type: string; ref_id: string; individual_hash: string }> = []
      const missingItems: string[] = []

      // 1. Snapshot clínico (CSO)
      const snapshot = await ctx.client.query(
        `SELECT id, cso_aba FROM session_snapshots WHERE session_id = $1`,
        [session_id]
      )
      if (snapshot.rows.length > 0) {
        components.push({
          type: 'clinical_snapshot',
          ref_id: snapshot.rows[0].id,
          individual_hash: crypto.createHash('sha256')
            .update(JSON.stringify(snapshot.rows[0]))
            .digest('hex'),
        })
      } else {
        missingItems.push('clinical_snapshot')
      }

      // 2. Prova de presença (geo)
      const proofs = await ctx.client.query(
        `SELECT id, proof_type, confidence_status, raw_payload_hash
        FROM session_presence_proofs WHERE session_id = $1 AND tenant_id = $2`,
        [session_id, ctx.tenantId]
      )
      for (const proof of proofs.rows) {
        components.push({
          type: `presence_${proof.proof_type}`,
          ref_id: proof.id,
          individual_hash: proof.raw_payload_hash || crypto.createHash('sha256')
            .update(JSON.stringify(proof))
            .digest('hex'),
        })
      }
      if (proofs.rows.length === 0 && session.service_mode !== 'telehealth') {
        missingItems.push('presence_proof')
      }

      // 3. Atestação terapeuta
      const therapistAttestation = await ctx.client.query(
        `SELECT id, attestation_hash, status
        FROM session_attestations
        WHERE session_id = $1 AND tenant_id = $2 AND attestor_type = 'therapist'
        ORDER BY created_at DESC LIMIT 1`,
        [session_id, ctx.tenantId]
      )
      if (therapistAttestation.rows.length > 0) {
        components.push({
          type: 'attestation_therapist',
          ref_id: therapistAttestation.rows[0].id,
          individual_hash: therapistAttestation.rows[0].attestation_hash,
        })
      } else {
        missingItems.push('attestation_therapist')
      }

      // 4. Atestação responsável
      const guardianAttestation = await ctx.client.query(
        `SELECT id, attestation_hash, status
        FROM session_attestations
        WHERE session_id = $1 AND tenant_id = $2 AND attestor_type = 'guardian'
        ORDER BY created_at DESC LIMIT 1`,
        [session_id, ctx.tenantId]
      )
      if (guardianAttestation.rows.length > 0) {
        components.push({
          type: 'attestation_guardian',
          ref_id: guardianAttestation.rows[0].id,
          individual_hash: guardianAttestation.rows[0].attestation_hash,
        })
      }
      // Guardian attestation requirement depends on payer profile

      // ─── Fetch payer requirements for this learner (Sprint 4) ───
      const payerReqs = await ctx.client.query(
        `SELECT prp.requires_geo, prp.geo_level,
                prp.requires_guardian_attestation,
                prp.requires_photo, prp.requires_attachment_per_guide
        FROM sessions_aba s
        JOIN learner_coverage_profiles lcp ON lcp.learner_id = s.learner_id
          AND lcp.status = 'active' AND lcp.tenant_id = $2
        JOIN payer_requirement_profiles prp ON prp.id = lcp.payer_profile_id
          AND prp.is_active = true
        WHERE s.id = $1 AND s.tenant_id = $2
        LIMIT 1`,
        [session_id, ctx.tenantId]
      )
      const payerReq = payerReqs.rows[0] || null

      // Validate per payer requirements
      if (payerReq) {
        // GPS exigido pelo pagador mas ausente
        if (payerReq.requires_geo && proofs.rows.length === 0 && session.service_mode !== 'telehealth') {
          missingItems.push('payer_requires_geo')
        }
        // Atestação responsável exigida
        if (payerReq.requires_guardian_attestation && guardianAttestation.rows.length === 0) {
          missingItems.push('payer_requires_guardian_attestation')
        }
      } else {
        // Sem perfil de pagador — usar regra padrão (guardian opcional)
      }

      // 5. Anexos
      const attachments = await ctx.client.query(
        `SELECT id, file_hash, attachment_type
        FROM session_attachments WHERE session_id = $1 AND tenant_id = $2`,
        [session_id, ctx.tenantId]
      )
      for (const att of attachments.rows) {
        components.push({
          type: `attachment_${att.attachment_type}`,
          ref_id: att.id,
          individual_hash: att.file_hash,
        })
      }

      // Validate photo requirement from payer
      if (payerReq?.requires_photo) {
        const hasPhoto = attachments.rows.some((a: { attachment_type: string }) =>
          a.attachment_type === 'photo' || a.attachment_type === 'session_photo'
        )
        if (!hasPhoto) {
          missingItems.push('payer_requires_photo')
        }
      }

      // 6. Local declarado
      if (session.declared_site_id) {
        components.push({
          type: 'declared_site',
          ref_id: session.declared_site_id,
          individual_hash: crypto.createHash('sha256')
            .update(session.declared_site_id)
            .digest('hex'),
        })
      } else {
        missingItems.push('declared_site')
      }

      // 7. Metadados técnicos
      components.push({
        type: 'session_metadata',
        ref_id: session_id,
        individual_hash: crypto.createHash('sha256')
          .update(JSON.stringify({ session_id, status: session.status, service_mode: session.service_mode }))
          .digest('hex'),
      })

      // Gerar bundle hash (SHA256 de todos os hashes individuais ordenados)
      const sortedHashes = components
        .map(c => c.individual_hash)
        .sort()
        .join(':')
      const bundleHash = crypto.createHash('sha256').update(sortedHashes).digest('hex')

      // Determinar status
      const hasEssentials = !missingItems.includes('clinical_snapshot')
        && !missingItems.includes('attestation_therapist')
      let bundleStatus: 'complete' | 'partial' | 'exception'

      if (missingItems.length === 0) {
        bundleStatus = 'complete'
      } else if (hasEssentials) {
        bundleStatus = 'partial'
      } else {
        bundleStatus = 'exception'
      }

      // Verificar versão anterior
      const previousBundle = await ctx.client.query(
        `SELECT id, version FROM session_evidence_bundles
        WHERE session_id = $1 AND tenant_id = $2
        ORDER BY version DESC LIMIT 1`,
        [session_id, ctx.tenantId]
      )
      const newVersion = previousBundle.rows.length > 0
        ? previousBundle.rows[0].version + 1
        : 1
      const supersedesId = previousBundle.rows.length > 0
        ? previousBundle.rows[0].id
        : null

      // Inserir bundle (NOVA LINHA — imutável)
      const inserted = await ctx.client.query(
        `INSERT INTO session_evidence_bundles (
          session_id, tenant_id, bundle_hash, components, status,
          missing_items, version, supersedes_id,
          generated_at, generated_by
        ) VALUES (
          $1, $2, $3, $4::jsonb, $5,
          $6, $7, $8,
          NOW(), $9
        )
        RETURNING id, bundle_hash, status, missing_items, version, generated_at`,
        [
          session_id,
          ctx.tenantId,
          bundleHash,
          JSON.stringify(components),
          bundleStatus,
          missingItems,
          newVersion,
          supersedesId,
          generated_by || 'system',
        ]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
        VALUES ($1, $2, 'user', 'EVIDENCE_BUNDLE_GENERATED', 'evidence_bundle', $3,
          jsonb_build_object(
            'category', 'operational',
            'profile_id', $4::text,
            'session_id', $5::text,
            'status', $6::text,
            'version', $7::text,
            'components_count', $8::text
          ),
          NOW()
        )`,
        [
          ctx.tenantId, ctx.userId, inserted.rows[0].id, ctx.profileId, session_id,
          bundleStatus, String(newVersion), String(components.length),
        ]
      )

      return {
        bundle: inserted.rows[0],
        components_count: components.length,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
