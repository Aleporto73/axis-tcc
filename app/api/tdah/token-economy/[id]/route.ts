import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH — API: Economia de Fichas por ID
// GET — Detalhe + transações recentes
// PATCH — Atualizar configuração ou status
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const economy = await ctx.client.query(
        `SELECT te.*, p.name as patient_name,
          tp.code as protocol_code, tp.title as protocol_title
        FROM tdah_token_economy te
        JOIN tdah_patients p ON p.id = te.patient_id
        LEFT JOIN tdah_protocols tp ON tp.id = te.protocol_id
        WHERE te.id = $1 AND te.tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (economy.rows.length === 0) {
        const err = new Error('Sistema de fichas não encontrado') as any
        err.statusCode = 404
        throw err
      }

      // Últimas 50 transações
      const transactions = await ctx.client.query(
        `SELECT * FROM tdah_token_transactions
        WHERE economy_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC LIMIT 50`,
        [id, ctx.tenantId]
      )

      return { economy: economy.rows[0], transactions: transactions.rows }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.statusCode) return NextResponse.json({ error: error.message }, { status: error.statusCode })
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
    const { system_name, token_type, token_label, target_behaviors, reinforcers, status: newStatus } = body

    const result = await withTenant(async (ctx) => {
      const current = await ctx.client.query(
        'SELECT * FROM tdah_token_economy WHERE id = $1 AND tenant_id = $2',
        [id, ctx.tenantId]
      )
      if (current.rows.length === 0) {
        const err = new Error('Sistema de fichas não encontrado') as any
        err.statusCode = 404
        throw err
      }

      const sets: string[] = ['updated_at = NOW()']
      const p: any[] = [id, ctx.tenantId]

      if (system_name) { p.push(system_name); sets.push(`system_name = $${p.length}`) }
      if (token_type) { p.push(token_type); sets.push(`token_type = $${p.length}`) }
      if (token_label !== undefined) { p.push(token_label || null); sets.push(`token_label = $${p.length}`) }
      if (target_behaviors) { p.push(JSON.stringify(target_behaviors)); sets.push(`target_behaviors = $${p.length}::jsonb`) }
      if (reinforcers) { p.push(JSON.stringify(reinforcers)); sets.push(`reinforcers = $${p.length}::jsonb`) }
      if (newStatus) { p.push(newStatus); sets.push(`status = $${p.length}`) }

      if (sets.length === 1) return current

      return await ctx.client.query(
        `UPDATE tdah_token_economy SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        p
      )
    })

    return NextResponse.json({ economy: result.rows[0] })
  } catch (error: any) {
    if (error?.statusCode) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
