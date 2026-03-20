import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Credencial [id]
// Ref: skill_axis_aba_v270.md — Sprint 2
//
// GET   — Detalhe da credencial
// PATCH — Atualizar (admin/supervisor)
// =====================================================

export const dynamic = 'force-dynamic'

const COUNCIL_TYPES = ['CRP', 'CRFa', 'CREFITO', 'CRM', 'BCBA', 'other'] as const
const EDUCATION_LEVELS = ['graduacao', 'especializacao', 'mestrado', 'doutorado'] as const
const ROLES_IN_TEAM = ['supervisor', 'terapeuta', 'fono', 'to', 'psicopedagoga'] as const
const CREDENTIAL_STATUSES = ['active', 'pending', 'expired', 'blocked'] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const cred = await ctx.client.query(
        `SELECT pc.*, p.name as profile_name, p.email as profile_email, p.role as profile_role
        FROM provider_credentials pc
        JOIN profiles p ON p.id = pc.profile_id
        WHERE pc.id = $1 AND pc.tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (cred.rows.length === 0) {
        throw Object.assign(new Error('Credencial não encontrada'), { statusCode: 404 })
      }
      return cred
    })

    return NextResponse.json({ credential: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      const check = await ctx.client.query(
        `SELECT id FROM provider_credentials WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (check.rows.length === 0) {
        throw Object.assign(new Error('Credencial não encontrada'), { statusCode: 404 })
      }

      // Dynamic SET builder
      const setClauses: string[] = ['updated_at = NOW()']
      const vals: unknown[] = []
      let idx = 1

      const allowedFields: Record<string, { column: string; validate?: (v: unknown) => boolean }> = {
        full_name: { column: 'full_name' },
        council_type: { column: 'council_type', validate: v => COUNCIL_TYPES.includes(v as typeof COUNCIL_TYPES[number]) },
        council_number: { column: 'council_number' },
        council_uf: { column: 'council_uf' },
        council_valid_until: { column: 'council_valid_until' },
        specializations: { column: 'specializations' },
        education_level: { column: 'education_level', validate: v => EDUCATION_LEVELS.includes(v as typeof EDUCATION_LEVELS[number]) },
        role_in_team: { column: 'role_in_team', validate: v => ROLES_IN_TEAM.includes(v as typeof ROLES_IN_TEAM[number]) },
        weekly_hours_total: { column: 'weekly_hours_total' },
        is_credentialed: { column: 'is_credentialed' },
        credential_code: { column: 'credential_code' },
        credential_status: { column: 'credential_status', validate: v => CREDENTIAL_STATUSES.includes(v as typeof CREDENTIAL_STATUSES[number]) },
        documents_complete: { column: 'documents_complete' },
        last_verified_at: { column: 'last_verified_at' },
      }

      for (const [bodyKey, config] of Object.entries(allowedFields)) {
        if (body[bodyKey] !== undefined) {
          if (config.validate && !config.validate(body[bodyKey])) {
            throw Object.assign(new Error(`${bodyKey} inválido`), { statusCode: 400 })
          }
          setClauses.push(`${config.column} = $${idx}`)
          vals.push(body[bodyKey])
          idx++
        }
      }

      if (vals.length === 0) {
        throw Object.assign(new Error('Nenhum campo para atualizar'), { statusCode: 400 })
      }

      vals.push(id, ctx.tenantId)
      const updated = await ctx.client.query(
        `UPDATE provider_credentials
        SET ${setClauses.join(', ')}
        WHERE id = $${idx} AND tenant_id = $${idx + 1}
        RETURNING *`,
        vals
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'PROVIDER_CREDENTIAL_UPDATED', 'operational', $2,
          jsonb_build_object('credential_id', $3::text, 'fields', $4::text)
        )`,
        [ctx.tenantId, ctx.profileId, id, Object.keys(body).join(',')]
      )

      return updated
    })

    return NextResponse.json({ credential: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
