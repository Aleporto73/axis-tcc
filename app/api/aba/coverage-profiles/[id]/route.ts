import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, requireFeature, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Perfil de Cobertura [id]
// Ref: skill_axis_aba_v270.md — Sprint 2
//
// GET   — Detalhe da cobertura
// PATCH — Atualizar (admin/supervisor)
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['active', 'pending', 'expired', 'suspended'] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      requireFeature(ctx, 'coverageProfiles')
      const coverage = await ctx.client.query(
        `SELECT cp.*, l.name as learner_name
        FROM learner_coverage_profiles cp
        JOIN learners l ON l.id = cp.learner_id
        WHERE cp.id = $1 AND cp.tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (coverage.rows.length === 0) {
        throw Object.assign(new Error('Cobertura não encontrada'), { statusCode: 404 })
      }
      return coverage
    })

    return NextResponse.json({ coverage: result.rows[0] })
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
      requireFeature(ctx, 'coverageProfiles')

      // Verificar existência
      const check = await ctx.client.query(
        `SELECT id FROM learner_coverage_profiles WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (check.rows.length === 0) {
        throw Object.assign(new Error('Cobertura não encontrada'), { statusCode: 404 })
      }

      // Dynamic SET builder
      const setClauses: string[] = ['updated_at = NOW()']
      const vals: unknown[] = []
      let idx = 1

      const allowedFields: Record<string, string> = {
        payer_name: 'payer_name',
        payer_profile_id: 'payer_profile_id',
        authorization_code: 'authorization_code',
        authorized_hours_week: 'authorized_hours_week',
        start_date: 'start_date',
        end_date: 'end_date',
        status: 'status',
        notes: 'notes',
      }

      for (const [bodyKey, dbColumn] of Object.entries(allowedFields)) {
        if (body[bodyKey] !== undefined) {
          if (bodyKey === 'status' && !VALID_STATUSES.includes(body[bodyKey])) {
            throw Object.assign(new Error('status inválido'), { statusCode: 400 })
          }
          setClauses.push(`${dbColumn} = $${idx}`)
          vals.push(body[bodyKey])
          idx++
        }
      }

      if (vals.length === 0) {
        throw Object.assign(new Error('Nenhum campo para atualizar'), { statusCode: 400 })
      }

      vals.push(id, ctx.tenantId)
      const updated = await ctx.client.query(
        `UPDATE learner_coverage_profiles
        SET ${setClauses.join(', ')}
        WHERE id = $${idx} AND tenant_id = $${idx + 1}
        RETURNING *`,
        vals
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
        VALUES ($1, $2, 'user', 'COVERAGE_UPDATED', 'coverage_profile', $3,
          jsonb_build_object(
            'category', 'operational',
            'profile_id', $4::text,
            'fields', $5::text
          ),
          NOW()
        )`,
        [ctx.tenantId, ctx.userId, id, ctx.profileId, Object.keys(body).join(',')]
      )

      return updated
    })

    return NextResponse.json({ coverage: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
