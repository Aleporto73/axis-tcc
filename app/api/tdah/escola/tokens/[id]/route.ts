import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH — API: Teacher Token por ID
// PATCH — Atualizar dados do token
// DELETE — Revogar token (soft delete)
// =====================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { teacher_name, teacher_email, school_name, is_active } = body

    const result = await withTenant(async (ctx) => {
      if (ctx.role === 'terapeuta') {
        const err = new Error('Apenas admin/supervisor pode gerenciar tokens') as any
        err.statusCode = 403
        throw err
      }

      const check = await ctx.client.query(
        'SELECT id FROM tdah_teacher_tokens WHERE id = $1 AND tenant_id = $2',
        [id, ctx.tenantId]
      )
      if (check.rows.length === 0) {
        const err = new Error('Token não encontrado') as any
        err.statusCode = 404
        throw err
      }

      const sets: string[] = []
      const p: any[] = [id, ctx.tenantId]

      if (teacher_name) { p.push(teacher_name); sets.push(`teacher_name = $${p.length}`) }
      if (teacher_email !== undefined) { p.push(teacher_email || null); sets.push(`teacher_email = $${p.length}`) }
      if (school_name !== undefined) { p.push(school_name || null); sets.push(`school_name = $${p.length}`) }
      if (is_active !== undefined) {
        p.push(is_active)
        sets.push(`is_active = $${p.length}`)
        if (!is_active) {
          p.push(ctx.profileId)
          sets.push(`revoked_at = NOW()`)
          sets.push(`revoked_by = $${p.length}`)
        }
      }

      if (sets.length === 0) {
        return check
      }

      return await ctx.client.query(
        `UPDATE tdah_teacher_tokens SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        p
      )
    })

    return NextResponse.json({ token: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      if (ctx.role === 'terapeuta') {
        const err = new Error('Apenas admin/supervisor pode revogar tokens') as any
        err.statusCode = 403
        throw err
      }

      const res = await ctx.client.query(
        `UPDATE tdah_teacher_tokens
         SET is_active = false, revoked_at = NOW(), revoked_by = $3
         WHERE id = $1 AND tenant_id = $2 AND is_active = true
         RETURNING *`,
        [id, ctx.tenantId, ctx.profileId]
      )

      if (res.rows.length === 0) {
        const err = new Error('Token não encontrado ou já revogado') as any
        err.statusCode = 404
        throw err
      }

      // Audit log
      try {
        await ctx.client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, 'user', 'TDAH_TEACHER_TOKEN_REVOKED', 'tdah_teacher_tokens',
           jsonb_build_object('token_id', $3::text), NOW())`,
          [ctx.tenantId, ctx.userId || 'system', id]
        )
      } catch (_) { /* audit non-blocking */ }

      return res.rows[0]
    })

    return NextResponse.json({ token: result })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
