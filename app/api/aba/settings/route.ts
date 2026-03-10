import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Configurações do Tenant
// PUT — Atualizar nome da clínica (admin/supervisor)
// =====================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Nome da clínica é obrigatório' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      const updated = await ctx.client.query(
        `UPDATE tenants SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name`,
        [name.trim(), ctx.tenantId]
      )

      return updated
    })

    return NextResponse.json({ tenant: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
