import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Perfis de Pagador (payer_requirement_profiles)
// Ref: skill_axis_aba_v270.md — Sprint 4
//
// GET  — Listar perfis (opcionalmente filtrar ativos)
// POST — Criar novo perfil (admin/supervisor)
//
// Bible v2.7.0: "Alteração de perfil de pagador é versionada"
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_GEO_LEVELS = ['none', 'light', 'standard', 'strict'] as const
const VALID_CID_VERSIONS = ['CID-10', 'CID-11', 'both'] as const

// ─────────────────────────────────────────────────────
// GET — Listar perfis de pagador
// ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const activeOnly = request.nextUrl.searchParams.get('active') !== 'false'

    const result = await withTenant(async (ctx) => {
      let query = `
        SELECT
          id, payer_name, payer_code,
          requires_geo, geo_level,
          requires_guardian_attestation, guardian_attestation_deadline_hours,
          requires_photo, requires_attachment_per_guide,
          report_frequency_days, report_template,
          requires_team_roster, requires_prescription,
          requires_pei, requires_coverage_auth,
          cid_version, max_file_size_mb, accepted_formats,
          checklist_items, notes,
          is_active, created_at, updated_at
        FROM payer_requirement_profiles
        WHERE tenant_id = $1
      `
      const params: unknown[] = [ctx.tenantId]

      if (activeOnly) {
        query += ` AND is_active = true`
      }

      query += ` ORDER BY payer_name ASC`

      return ctx.client.query(query, params)
    })

    return NextResponse.json({ profiles: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Criar perfil de pagador
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      payer_name,
      payer_code,
      requires_geo,
      geo_level,
      requires_guardian_attestation,
      guardian_attestation_deadline_hours,
      requires_photo,
      requires_attachment_per_guide,
      report_frequency_days,
      report_template,
      requires_team_roster,
      requires_prescription,
      requires_pei,
      requires_coverage_auth,
      cid_version,
      max_file_size_mb,
      accepted_formats,
      checklist_items,
      notes,
    } = body

    if (!payer_name?.trim()) {
      return NextResponse.json({ error: 'payer_name obrigatório' }, { status: 400 })
    }

    const geoLvl = geo_level || 'none'
    if (!VALID_GEO_LEVELS.includes(geoLvl as typeof VALID_GEO_LEVELS[number])) {
      return NextResponse.json({ error: 'geo_level inválido' }, { status: 400 })
    }

    const cidVer = cid_version || 'CID-10'
    if (!VALID_CID_VERSIONS.includes(cidVer as typeof VALID_CID_VERSIONS[number])) {
      return NextResponse.json({ error: 'cid_version inválido' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      const inserted = await ctx.client.query(
        `INSERT INTO payer_requirement_profiles (
          tenant_id, payer_name, payer_code,
          requires_geo, geo_level,
          requires_guardian_attestation, guardian_attestation_deadline_hours,
          requires_photo, requires_attachment_per_guide,
          report_frequency_days, report_template,
          requires_team_roster, requires_prescription,
          requires_pei, requires_coverage_auth,
          cid_version, max_file_size_mb, accepted_formats,
          checklist_items, notes
        ) VALUES (
          $1, $2, $3,
          $4, $5,
          $6, $7,
          $8, $9,
          $10, $11,
          $12, $13,
          $14, $15,
          $16, $17, $18,
          $19, $20
        )
        RETURNING *`,
        [
          ctx.tenantId,
          payer_name.trim(),
          payer_code?.trim() || null,
          requires_geo ?? false,
          geoLvl,
          requires_guardian_attestation ?? false,
          guardian_attestation_deadline_hours ?? 72,
          requires_photo ?? false,
          requires_attachment_per_guide ?? false,
          report_frequency_days ?? 90,
          report_template?.trim() || 'standard',
          requires_team_roster ?? true,
          requires_prescription ?? true,
          requires_pei ?? false,
          requires_coverage_auth ?? false,
          cidVer,
          max_file_size_mb ?? 10,
          accepted_formats || ['pdf', 'jpg', 'png'],
          checklist_items ? JSON.stringify(checklist_items) : null,
          notes?.trim() || null,
        ]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'PAYER_PROFILE_CREATED', 'operational', $2,
          jsonb_build_object(
            'payer_name', $3::text,
            'profile_id', $4::text
          )
        )`,
        [ctx.tenantId, ctx.profileId, payer_name.trim(), inserted.rows[0].id]
      )

      return inserted
    })

    return NextResponse.json({ profile: result.rows[0] }, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
