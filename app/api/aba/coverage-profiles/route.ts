import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Perfis de Cobertura (learner_coverage_profiles)
// Ref: skill_axis_aba_v270.md — Sprint 2
//
// GET  — Listar coberturas (filtro por learner_id)
// POST — Criar nova cobertura (admin/supervisor)
//
// Multi-cobertura permitida (mesmo aprendiz, múltiplos pagadores).
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['active', 'pending', 'expired', 'suspended'] as const

// ─────────────────────────────────────────────────────
// GET — Listar coberturas
// ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const learnerId = request.nextUrl.searchParams.get('learner_id')

    const result = await withTenant(async (ctx) => {
      let query = `
        SELECT
          cp.id, cp.learner_id, cp.payer_profile_id, cp.payer_name,
          cp.authorization_code, cp.authorized_hours_week,
          cp.start_date, cp.end_date, cp.status, cp.notes,
          cp.created_at, cp.updated_at,
          l.name as learner_name
        FROM learner_coverage_profiles cp
        JOIN learners l ON l.id = cp.learner_id
        WHERE cp.tenant_id = $1
      `
      const params: unknown[] = [ctx.tenantId]

      if (learnerId) {
        query += ` AND cp.learner_id = $2`
        params.push(learnerId)
      }

      query += ` ORDER BY cp.status ASC, cp.start_date DESC`

      return ctx.client.query(query, params)
    })

    return NextResponse.json({ coverages: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Criar cobertura
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      learner_id,
      payer_name,
      payer_profile_id,
      authorization_code,
      authorized_hours_week,
      start_date,
      end_date,
      status,
      notes,
    } = body

    if (!learner_id) {
      return NextResponse.json({ error: 'learner_id obrigatório' }, { status: 400 })
    }
    if (!payer_name?.trim()) {
      return NextResponse.json({ error: 'payer_name obrigatório' }, { status: 400 })
    }
    if (!start_date) {
      return NextResponse.json({ error: 'start_date obrigatório' }, { status: 400 })
    }
    const coverageStatus = status || 'active'
    if (!VALID_STATUSES.includes(coverageStatus)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      // Verificar aprendiz pertence ao tenant
      const learnerCheck = await ctx.client.query(
        `SELECT id FROM learners WHERE id = $1 AND tenant_id = $2`,
        [learner_id, ctx.tenantId]
      )
      if (learnerCheck.rows.length === 0) {
        throw Object.assign(new Error('Aprendiz não encontrado'), { statusCode: 404 })
      }

      const inserted = await ctx.client.query(
        `INSERT INTO learner_coverage_profiles (
          learner_id, tenant_id, payer_profile_id, payer_name,
          authorization_code, authorized_hours_week,
          start_date, end_date, status, notes
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6,
          $7::date, $8::date, $9, $10
        )
        RETURNING *`,
        [
          learner_id,
          ctx.tenantId,
          payer_profile_id || null,
          payer_name.trim(),
          authorization_code?.trim() || null,
          authorized_hours_week || null,
          start_date,
          end_date || null,
          coverageStatus,
          notes?.trim() || null,
        ]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'COVERAGE_CREATED', 'operational', $2,
          jsonb_build_object(
            'learner_id', $3::text,
            'payer_name', $4::text,
            'coverage_id', $5::text
          )
        )`,
        [ctx.tenantId, ctx.profileId, learner_id, payer_name.trim(), inserted.rows[0].id]
      )

      return inserted
    })

    return NextResponse.json({ coverage: result.rows[0] }, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
