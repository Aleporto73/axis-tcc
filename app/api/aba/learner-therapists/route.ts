import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Vínculo Terapeuta-Aprendiz
// Conforme AXIS ABA Bible v2.6.1
// Terapeuta só vê aprendizes vinculados a ele.
// =====================================================

/**
 * GET /api/aba/learner-therapists?learner_id=xxx
 * Lista vínculos. Admin/Supervisor: todos. Terapeuta: apenas seus.
 */
export async function GET(request: NextRequest) {
  try {
    const learnerId = request.nextUrl.searchParams.get('learner_id')

    const result = await withTenant(async (ctx) => {
      let query = `
        SELECT
          lt.id,
          lt.learner_id,
          lt.profile_id,
          lt.is_primary,
          lt.assigned_at,
          p.name AS therapist_name,
          p.role AS therapist_role,
          p.email AS therapist_email,
          l.name AS learner_name
        FROM learner_therapists lt
        JOIN profiles p ON p.id = lt.profile_id
        JOIN learners l ON l.id = lt.learner_id
        WHERE lt.tenant_id = $1
      `
      const params: string[] = [ctx.tenantId]
      let paramIdx = 2

      if (learnerId) {
        query += ` AND lt.learner_id = $${paramIdx++}`
        params.push(learnerId)
      }

      // Terapeuta só vê seus próprios vínculos
      if (ctx.role === 'terapeuta') {
        query += ` AND lt.profile_id = $${paramIdx++}`
        params.push(ctx.profileId)
      }

      query += ' ORDER BY lt.is_primary DESC, p.name'

      return (await ctx.client.query(query, params)).rows
    })

    return NextResponse.json({ assignments: result })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * POST /api/aba/learner-therapists
 * Atribuir terapeuta a aprendiz.
 * Acesso: admin ou supervisor.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { learner_id, profile_id, is_primary } = body

    if (!learner_id || !profile_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: learner_id, profile_id' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      // Verificar se aprendiz pertence ao tenant
      const learner = await ctx.client.query(
        'SELECT id, name FROM learners WHERE id = $1 AND tenant_id = $2',
        [learner_id, ctx.tenantId]
      )
      if (learner.rows.length === 0) {
        throw new Error('LEARNER_NOT_FOUND')
      }

      // Verificar se profile pertence ao tenant e está ativo
      const profile = await ctx.client.query(
        'SELECT id, name, role FROM profiles WHERE id = $1 AND tenant_id = $2 AND is_active = true',
        [profile_id, ctx.tenantId]
      )
      if (profile.rows.length === 0) {
        throw new Error('PROFILE_NOT_FOUND')
      }

      // Se is_primary, remover flag de outros
      if (is_primary) {
        await ctx.client.query(
          'UPDATE learner_therapists SET is_primary = false WHERE learner_id = $1 AND tenant_id = $2',
          [learner_id, ctx.tenantId]
        )
      }

      // Criar vínculo
      const insert = await ctx.client.query(
        `INSERT INTO learner_therapists (tenant_id, learner_id, profile_id, is_primary, assigned_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (learner_id, profile_id) DO UPDATE SET is_primary = $4
         RETURNING id, learner_id, profile_id, is_primary, assigned_at`,
        [ctx.tenantId, learner_id, profile_id, is_primary || false, ctx.profileId]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LEARNER_THERAPIST_ASSIGNED', 'learner_therapist', $4, $5, NOW())`,
        [
          ctx.tenantId,
          ctx.userId,
          ctx.userId,
          insert.rows[0].id,
          JSON.stringify({
            learner_id,
            learner_name: learner.rows[0].name,
            profile_id,
            therapist_name: profile.rows[0].name,
            is_primary: is_primary || false
          })
        ]
      )

      return insert.rows[0]
    })

    return NextResponse.json({ assignment: result }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'LEARNER_NOT_FOUND') {
        return NextResponse.json({ error: 'Aprendiz não encontrado' }, { status: 404 })
      }
      if (error.message === 'PROFILE_NOT_FOUND') {
        return NextResponse.json({ error: 'Profissional não encontrado ou inativo' }, { status: 404 })
      }
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * DELETE /api/aba/learner-therapists?id=xxx
 * Remover vínculo terapeuta-aprendiz.
 * Acesso: admin ou supervisor.
 */
export async function DELETE(request: NextRequest) {
  try {
    const assignmentId = request.nextUrl.searchParams.get('id')
    if (!assignmentId) {
      return NextResponse.json({ error: 'Parâmetro id obrigatório' }, { status: 400 })
    }

    await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      // Buscar vínculo para audit
      const assignment = await ctx.client.query(
        `SELECT lt.id, lt.learner_id, lt.profile_id, l.name AS learner_name, p.name AS therapist_name
         FROM learner_therapists lt
         JOIN learners l ON l.id = lt.learner_id
         JOIN profiles p ON p.id = lt.profile_id
         WHERE lt.id = $1 AND lt.tenant_id = $2`,
        [assignmentId, ctx.tenantId]
      )
      if (assignment.rows.length === 0) {
        throw new Error('ASSIGNMENT_NOT_FOUND')
      }

      // Remover
      await ctx.client.query(
        'DELETE FROM learner_therapists WHERE id = $1 AND tenant_id = $2',
        [assignmentId, ctx.tenantId]
      )

      // Audit log
      const row = assignment.rows[0]
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'LEARNER_THERAPIST_REMOVED', 'learner_therapist', $4, $5, NOW())`,
        [
          ctx.tenantId,
          ctx.userId,
          ctx.userId,
          assignmentId,
          JSON.stringify({
            learner_id: row.learner_id,
            learner_name: row.learner_name,
            profile_id: row.profile_id,
            therapist_name: row.therapist_name
          })
        ]
      )
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSIGNMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
