import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, requireFeature, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Credenciais de Prestadores (provider_credentials)
// Ref: skill_axis_aba_v270.md — Sprint 2
//
// GET  — Listar credenciais do tenant
// POST — Criar credencial (1:1 com profile, admin/supervisor)
//
// Dados de conselho profissional, credenciamento,
// formação e role no time.
// =====================================================

export const dynamic = 'force-dynamic'

const COUNCIL_TYPES = ['CRP', 'CRFa', 'CREFITO', 'CRM', 'BCBA', 'other'] as const
const EDUCATION_LEVELS = ['graduacao', 'especializacao', 'mestrado', 'doutorado'] as const
const ROLES_IN_TEAM = ['supervisor', 'terapeuta', 'fono', 'to', 'psicopedagoga'] as const
const CREDENTIAL_STATUSES = ['active', 'pending', 'expired', 'blocked'] as const

// ─────────────────────────────────────────────────────
// GET — Listar credenciais
// ─────────────────────────────────────────────────────
export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      requireFeature(ctx, 'providerCredentials')
      return ctx.client.query(
        `SELECT
          pc.*,
          p.name as profile_name,
          p.email as profile_email,
          p.role as profile_role
        FROM provider_credentials pc
        JOIN profiles p ON p.id = pc.profile_id
        WHERE pc.tenant_id = $1
        ORDER BY pc.full_name`,
        [ctx.tenantId]
      )
    })

    return NextResponse.json({ credentials: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Criar credencial
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      profile_id,
      full_name,
      council_type,
      council_number,
      council_uf,
      council_valid_until,
      specializations,
      education_level,
      role_in_team,
      weekly_hours_total,
      credential_code,
    } = body

    // Validações
    if (!profile_id) {
      return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })
    }
    if (!full_name?.trim()) {
      return NextResponse.json({ error: 'full_name obrigatório' }, { status: 400 })
    }
    if (!council_number?.trim()) {
      return NextResponse.json({ error: 'council_number obrigatório' }, { status: 400 })
    }
    if (!council_uf?.trim()) {
      return NextResponse.json({ error: 'council_uf obrigatório' }, { status: 400 })
    }
    if (council_type && !COUNCIL_TYPES.includes(council_type)) {
      return NextResponse.json({ error: 'council_type inválido' }, { status: 400 })
    }
    if (education_level && !EDUCATION_LEVELS.includes(education_level)) {
      return NextResponse.json({ error: 'education_level inválido' }, { status: 400 })
    }
    if (role_in_team && !ROLES_IN_TEAM.includes(role_in_team)) {
      return NextResponse.json({ error: 'role_in_team inválido' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)
      requireFeature(ctx, 'providerCredentials')

      // Verificar profile pertence ao tenant
      const profileCheck = await ctx.client.query(
        `SELECT id, name FROM profiles WHERE id = $1 AND tenant_id = $2`,
        [profile_id, ctx.tenantId]
      )
      if (profileCheck.rows.length === 0) {
        throw Object.assign(new Error('Perfil não encontrado'), { statusCode: 404 })
      }

      // Verificar duplicata (1:1)
      const dupCheck = await ctx.client.query(
        `SELECT id FROM provider_credentials WHERE profile_id = $1`,
        [profile_id]
      )
      if (dupCheck.rows.length > 0) {
        throw Object.assign(
          new Error('Este profissional já possui credencial cadastrada. Use PATCH para atualizar.'),
          { statusCode: 409 }
        )
      }

      const inserted = await ctx.client.query(
        `INSERT INTO provider_credentials (
          profile_id, tenant_id, full_name,
          council_type, council_number, council_uf, council_valid_until,
          specializations, education_level, role_in_team,
          weekly_hours_total, credential_code
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7::date,
          $8, $9, $10,
          $11, $12
        )
        RETURNING *`,
        [
          profile_id,
          ctx.tenantId,
          full_name.trim(),
          council_type || 'CRP',
          council_number.trim(),
          council_uf.trim().toUpperCase(),
          council_valid_until || null,
          specializations || '{}',
          education_level || 'graduacao',
          role_in_team || 'terapeuta',
          weekly_hours_total || null,
          credential_code?.trim() || null,
        ]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
        VALUES ($1, $2, 'user', 'PROVIDER_CREDENTIAL_CREATED', 'provider_credential', $3,
          jsonb_build_object(
            'category', 'operational',
            'profile_id', $4::text,
            'credentialed_profile_id', $5::text,
            'council', $6::text
          ),
          NOW()
        )`,
        [
          ctx.tenantId, ctx.userId, inserted.rows[0].id, ctx.profileId,
          profile_id, `${council_type || 'CRP'} ${council_number}/${council_uf}`,
        ]
      )

      return inserted
    })

    return NextResponse.json({ credential: result.rows[0] }, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
