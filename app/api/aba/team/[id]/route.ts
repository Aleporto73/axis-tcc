import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdmin, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Gestão Individual de Membro
// Conforme AXIS ABA Bible v2.6.1
// =====================================================

/**
 * PATCH /api/aba/team/[id]
 * Alterar role ou status de um membro.
 * Acesso: admin apenas.
 * Não permite alterar o próprio role (proteção contra lock-out).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params
    const body = await request.json()
    const { role, is_active } = body

    const result = await withTenant(async (ctx) => {
      requireAdmin(ctx)

      // Não pode alterar o próprio profile
      if (memberId === ctx.profileId) {
        throw new Error('SELF_MODIFY')
      }

      // Verificar se o membro pertence ao tenant
      const member = await ctx.client.query(
        'SELECT id, role, is_active FROM profiles WHERE id = $1 AND tenant_id = $2',
        [memberId, ctx.tenantId]
      )
      if (member.rows.length === 0) {
        throw new Error('MEMBER_NOT_FOUND')
      }

      const oldRole = member.rows[0].role
      const oldActive = member.rows[0].is_active

      // Validar role se fornecida
      if (role !== undefined) {
        const validRoles = ['admin', 'supervisor', 'terapeuta']
        if (!validRoles.includes(role)) {
          throw new Error('INVALID_ROLE')
        }
      }

      // Construir update dinâmico
      const updates: string[] = []
      const values: unknown[] = []
      let paramIdx = 1

      if (role !== undefined) {
        updates.push(`role = $${paramIdx++}`)
        values.push(role)
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIdx++}`)
        values.push(is_active)
      }
      updates.push(`updated_at = NOW()`)

      if (updates.length <= 1) {
        throw new Error('NO_CHANGES')
      }

      values.push(memberId, ctx.tenantId)
      const updateQuery = `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx} RETURNING id, role, is_active, name, email`

      const updated = await ctx.client.query(updateQuery, values)

      // Audit log
      const metadata: Record<string, unknown> = { target_profile_id: memberId }
      if (role !== undefined) {
        metadata.old_role = oldRole
        metadata.new_role = role
      }
      if (is_active !== undefined) {
        metadata.old_active = oldActive
        metadata.new_active = is_active
      }

      const action = is_active === false
        ? 'PROFILE_DEACTIVATED'
        : role !== undefined
          ? 'PROFILE_ROLE_CHANGED'
          : 'PROFILE_UPDATED'

      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, 'profile', $5, $6, NOW())`,
        [ctx.tenantId, ctx.userId, ctx.userId, action, memberId, JSON.stringify(metadata)]
      )

      return updated.rows[0]
    })

    return NextResponse.json({ member: result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'SELF_MODIFY') {
        return NextResponse.json({ error: 'Não é possível alterar o próprio perfil' }, { status: 400 })
      }
      if (error.message === 'MEMBER_NOT_FOUND') {
        return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
      }
      if (error.message === 'INVALID_ROLE') {
        return NextResponse.json({ error: 'Role inválida' }, { status: 400 })
      }
      if (error.message === 'NO_CHANGES') {
        return NextResponse.json({ error: 'Nenhuma alteração fornecida' }, { status: 400 })
      }
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * DELETE /api/aba/team/[id]
 * Desativar membro (soft delete via is_active = false).
 * Acesso: admin apenas.
 * Remove vínculos learner_therapists do membro desativado.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params

    await withTenant(async (ctx) => {
      requireAdmin(ctx)

      if (memberId === ctx.profileId) {
        throw new Error('SELF_MODIFY')
      }

      // Verificar existência
      const member = await ctx.client.query(
        'SELECT id, name, role FROM profiles WHERE id = $1 AND tenant_id = $2',
        [memberId, ctx.tenantId]
      )
      if (member.rows.length === 0) {
        throw new Error('MEMBER_NOT_FOUND')
      }

      // Desativar profile
      await ctx.client.query(
        'UPDATE profiles SET is_active = false, updated_at = NOW() WHERE id = $1',
        [memberId]
      )

      // Remover vínculos com aprendizes
      await ctx.client.query(
        'DELETE FROM learner_therapists WHERE profile_id = $1 AND tenant_id = $2',
        [memberId, ctx.tenantId]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, $3, 'PROFILE_DEACTIVATED', 'profile', $4, $5, NOW())`,
        [
          ctx.tenantId,
          ctx.userId,
          ctx.userId,
          memberId,
          JSON.stringify({
            name: member.rows[0].name,
            role: member.rows[0].role,
            learner_links_removed: true
          })
        ]
      )
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'SELF_MODIFY') {
        return NextResponse.json({ error: 'Não é possível desativar o próprio perfil' }, { status: 400 })
      }
      if (error.message === 'MEMBER_NOT_FOUND') {
        return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
      }
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
