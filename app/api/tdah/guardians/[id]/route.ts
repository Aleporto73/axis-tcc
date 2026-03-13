import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Responsável por ID
// PATCH — Editar dados do responsável
// DELETE — Soft delete (is_active = false)
// =====================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, email, phone, relationship, is_primary } = body

    const result = await withTenant(async (ctx) => {
      const current = await ctx.client.query(
        `SELECT g.*, p.id as pid FROM tdah_guardians g
         JOIN tdah_patients p ON p.id = g.patient_id AND p.tenant_id = g.tenant_id
         WHERE g.id = $1 AND g.tenant_id = $2`,
        [id, ctx.tenantId]
      )

      if (current.rows.length === 0) {
        const err = new Error('Responsável não encontrado') as any
        err.statusCode = 404
        throw err
      }

      const guardian = current.rows[0]

      // Se tornando primary, remover flag dos outros
      if (is_primary === true) {
        await ctx.client.query(
          `UPDATE tdah_guardians SET is_primary = false WHERE patient_id = $1 AND tenant_id = $2 AND id != $3`,
          [guardian.patient_id, ctx.tenantId, id]
        )
      }

      const sets: string[] = ['updated_at = NOW()']
      const values: any[] = [id, ctx.tenantId]

      if (name !== undefined) { values.push(name.trim()); sets.push(`name = $${values.length}`) }
      if (email !== undefined) { values.push(email?.trim() || null); sets.push(`email = $${values.length}`) }
      if (phone !== undefined) { values.push(phone?.trim() || null); sets.push(`phone = $${values.length}`) }
      if (relationship !== undefined) { values.push(relationship || null); sets.push(`relationship = $${values.length}`) }
      if (is_primary !== undefined) { values.push(is_primary); sets.push(`is_primary = $${values.length}`) }

      return await ctx.client.query(
        `UPDATE tdah_guardians SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        values
      )
    })

    return NextResponse.json({ guardian: result.rows[0] })
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

    await withTenant(async (ctx) => {
      const res = await ctx.client.query(
        `UPDATE tdah_guardians SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [id, ctx.tenantId]
      )
      if (res.rows.length === 0) {
        const err = new Error('Responsável não encontrado') as any
        err.statusCode = 404
        throw err
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
