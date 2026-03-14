import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH — API: Transações de Fichas
// POST — Registrar earn/spend/bonus/reset
// Append-only: transações nunca são editadas
// =====================================================

const VALID_TYPES = ['earn', 'spend', 'bonus', 'reset']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: economyId } = await params
    const body = await request.json()
    const { transaction_type, amount, reason, behavior_index, reinforcer_index, notes, recorded_by, recorded_by_name } = body

    if (!transaction_type || !VALID_TYPES.includes(transaction_type)) {
      return NextResponse.json({ error: `transaction_type obrigatório. Valores: ${VALID_TYPES.join(', ')}` }, { status: 400 })
    }

    if (amount === undefined || amount === null || amount === 0) {
      return NextResponse.json({ error: 'amount obrigatório e diferente de zero' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      // Verificar economia existe
      const economy = await ctx.client.query(
        'SELECT * FROM tdah_token_economy WHERE id = $1 AND tenant_id = $2',
        [economyId, ctx.tenantId]
      )
      if (economy.rows.length === 0) {
        const err = new Error('Sistema de fichas não encontrado') as any
        err.statusCode = 404
        throw err
      }

      if (economy.rows[0].status !== 'active') {
        const err = new Error('Sistema de fichas não está ativo') as any
        err.statusCode = 422
        throw err
      }

      // Calcular novo saldo
      const currentBalance = economy.rows[0].current_balance
      let effectiveAmount = Math.abs(amount)

      if (transaction_type === 'spend') {
        effectiveAmount = -effectiveAmount
        if (currentBalance + effectiveAmount < 0) {
          const err = new Error(`Saldo insuficiente. Saldo atual: ${currentBalance}`) as any
          err.statusCode = 422
          throw err
        }
      } else if (transaction_type === 'reset') {
        effectiveAmount = -currentBalance // Zera o saldo
      }

      const newBalance = currentBalance + effectiveAmount

      // Atualizar saldo
      await ctx.client.query(
        'UPDATE tdah_token_economy SET current_balance = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
        [economyId, ctx.tenantId, newBalance]
      )

      // Registrar transação (append-only)
      const tx = await ctx.client.query(
        `INSERT INTO tdah_token_transactions
          (tenant_id, economy_id, patient_id, transaction_type, amount, balance_after, reason, behavior_index, reinforcer_index, notes, recorded_by, recorded_by_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          ctx.tenantId, economyId, economy.rows[0].patient_id,
          transaction_type, effectiveAmount, newBalance,
          reason || null,
          behavior_index ?? null,
          reinforcer_index ?? null,
          notes || null,
          recorded_by || 'clinician',
          recorded_by_name || null,
        ]
      )

      return { transaction: tx.rows[0], new_balance: newBalance }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
