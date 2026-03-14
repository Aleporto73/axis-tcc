import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH — API: Family Token por ID
// DELETE — Revogar token (soft delete)
// =====================================================

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
        `UPDATE tdah_family_tokens
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

      try {
        await ctx.client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, 'user', 'TDAH_FAMILY_TOKEN_REVOKED', 'tdah_family_tokens',
           jsonb_build_object('token_id', $3::text), NOW())`,
          [ctx.tenantId, ctx.userId || 'system', id]
        )
      } catch (_) {}

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
