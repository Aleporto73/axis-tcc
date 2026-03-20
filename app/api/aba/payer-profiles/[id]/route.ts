import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Perfil de Pagador [id]
// Ref: skill_axis_aba_v270.md — Sprint 4
//
// GET   — Detalhe do perfil
// PATCH — Atualizar campos (versionado via audit log)
//
// Bible v2.7.0: "Alteração de perfil de pagador é versionada"
// Cada PATCH gera snapshot no audit log com before/after.
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_GEO_LEVELS = ['none', 'light', 'standard', 'strict'] as const
const VALID_CID_VERSIONS = ['CID-10', 'CID-11', 'both'] as const

// Campos permitidos no PATCH com seus tipos de validação
const PATCHABLE_FIELDS: Record<string, 'text' | 'bool' | 'int' | 'geo_level' | 'cid_version' | 'text_array' | 'jsonb'> = {
  payer_name: 'text',
  payer_code: 'text',
  requires_geo: 'bool',
  geo_level: 'geo_level',
  requires_guardian_attestation: 'bool',
  guardian_attestation_deadline_hours: 'int',
  requires_photo: 'bool',
  requires_attachment_per_guide: 'bool',
  report_frequency_days: 'int',
  report_template: 'text',
  requires_team_roster: 'bool',
  requires_prescription: 'bool',
  requires_pei: 'bool',
  requires_coverage_auth: 'bool',
  cid_version: 'cid_version',
  max_file_size_mb: 'int',
  accepted_formats: 'text_array',
  checklist_items: 'jsonb',
  notes: 'text',
  is_active: 'bool',
}

// ─────────────────────────────────────────────────────
// GET — Detalhe do perfil
// ─────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const profile = await ctx.client.query(
        `SELECT * FROM payer_requirement_profiles WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (profile.rows.length === 0) {
        throw Object.assign(new Error('Perfil de pagador não encontrado'), { statusCode: 404 })
      }

      // Contar coberturas vinculadas
      const coverageCount = await ctx.client.query(
        `SELECT COUNT(*) as count FROM learner_coverage_profiles
        WHERE payer_profile_id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )

      return {
        profile: profile.rows[0],
        linked_coverages: parseInt(coverageCount.rows[0].count, 10),
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// PATCH — Atualizar perfil (versionado)
// ─────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      // Buscar estado atual (snapshot before)
      const check = await ctx.client.query(
        `SELECT * FROM payer_requirement_profiles WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (check.rows.length === 0) {
        throw Object.assign(new Error('Perfil de pagador não encontrado'), { statusCode: 404 })
      }

      const before = check.rows[0]
      const setClauses: string[] = ['updated_at = NOW()']
      const vals: unknown[] = [id, ctx.tenantId]
      let idx = 3
      const changes: Record<string, { from: unknown; to: unknown }> = {}

      for (const [field, fieldType] of Object.entries(PATCHABLE_FIELDS)) {
        if (body[field] === undefined) continue

        const newVal = body[field]
        const oldVal = before[field]

        // Validação por tipo
        if (fieldType === 'geo_level' && !VALID_GEO_LEVELS.includes(newVal as typeof VALID_GEO_LEVELS[number])) {
          throw Object.assign(new Error(`geo_level inválido: ${newVal}`), { statusCode: 400 })
        }
        if (fieldType === 'cid_version' && !VALID_CID_VERSIONS.includes(newVal as typeof VALID_CID_VERSIONS[number])) {
          throw Object.assign(new Error(`cid_version inválido: ${newVal}`), { statusCode: 400 })
        }
        if (fieldType === 'text' && field === 'payer_name' && !newVal?.trim()) {
          throw Object.assign(new Error('payer_name não pode ser vazio'), { statusCode: 400 })
        }

        let sanitized: unknown
        switch (fieldType) {
          case 'text':
            sanitized = typeof newVal === 'string' ? newVal.trim() || null : null
            break
          case 'bool':
            sanitized = Boolean(newVal)
            break
          case 'int':
            sanitized = parseInt(String(newVal), 10)
            if (isNaN(sanitized as number)) {
              throw Object.assign(new Error(`${field} deve ser numérico`), { statusCode: 400 })
            }
            break
          case 'text_array':
            sanitized = Array.isArray(newVal) ? newVal : null
            break
          case 'jsonb':
            sanitized = newVal ? JSON.stringify(newVal) : null
            break
          default:
            sanitized = newVal
        }

        setClauses.push(`${field} = $${idx}`)
        vals.push(sanitized)
        idx++
        changes[field] = { from: oldVal, to: sanitized }
      }

      if (Object.keys(changes).length === 0) {
        return check // Nada alterado
      }

      const updated = await ctx.client.query(
        `UPDATE payer_requirement_profiles
        SET ${setClauses.join(', ')}
        WHERE id = $1 AND tenant_id = $2
        RETURNING *`,
        vals
      )

      // Audit log versionado (Bible: "Alteração de perfil de pagador é versionada")
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'PAYER_PROFILE_UPDATED', 'operational', $2,
          jsonb_build_object(
            'profile_id', $3::text,
            'payer_name', $4::text,
            'changes', $5::jsonb
          )
        )`,
        [
          ctx.tenantId,
          ctx.profileId,
          id,
          updated.rows[0].payer_name,
          JSON.stringify(changes),
        ]
      )

      return updated
    })

    return NextResponse.json({ profile: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
