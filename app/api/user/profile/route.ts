import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

export async function GET() {
  try {
    return await withTenant(async (ctx) => {
      const result = await ctx.client.query(
        'SELECT name, crp, crp_uf, email, phone FROM tenants WHERE id = $1',
        [ctx.tenantId]
      )

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
      }

      // Monta o CRP formatado
      const row = result.rows[0]
      const crpFormatted = row.crp_uf && row.crp ? `${row.crp_uf}/${row.crp}` : row.crp || ''

      return NextResponse.json({
        name: row.name || '',
        crp: crpFormatted,
        email: row.email || '',
        phone: row.phone || ''
      })
    })
  } catch (error) {
    console.error('Erro ao buscar perfil:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      const body = await request.json()
      const { name, crp } = body

      // Parse CRP (formato: 00/00000 ou apenas número)
      let crpNumber = crp || ''
      let crpUf = ''

      if (crp && crp.includes('/')) {
        const parts = crp.split('/')
        crpUf = parts[0]
        crpNumber = parts[1] || ''
      }

      const result = await ctx.client.query(
        `UPDATE tenants
         SET name = $1, crp = $2, crp_uf = $3
         WHERE id = $4
         RETURNING id, name, crp, crp_uf`,
        [name || '', crpNumber, crpUf, ctx.tenantId]
      )

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        profile: result.rows[0]
      })
    })
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
