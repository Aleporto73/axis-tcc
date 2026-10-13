import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError, requireAdmin } from '@/src/database/with-role'
import { env } from '@/src/lib/env'
import { getPlan } from '@/src/billing/plans'
import { buildCheckoutUrl } from '@/src/billing/paymentbeta-contract'

// =====================================================
// AXIS — Link do checkout PaymentBeta (pagamento P2)
//
// POST { plan_key } → { url }
//   - usuário logado, admin do tenant (a compra muda a licença da clínica)
//   - cria checkout_intents com partner_reference (UUID v4); o receptor
//     /api/webhook/paymentbeta usa esse UUID para achar o tenant
//   - códigos do PaymentBeta vêm do .env (PAYMENTBETA_CHECKOUT_<PLANO> =
//     "PRODUTO:PRECO"); sem eles → 503 "checkout indisponível"
// Ainda NÃO está ligado em nenhum botão (P4).
// =====================================================

export async function POST(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      requireAdmin(ctx)

      const body = await request.json().catch(() => null)
      const plan = getPlan(body?.plan_key)
      if (!plan || !plan.forSale) {
        return NextResponse.json({ error: 'plan_key inválida' }, { status: 400 })
      }

      const partnerReference = randomUUID()
      const url = buildCheckoutUrl(plan.key, partnerReference, env)
      if (!url) {
        return NextResponse.json({ error: 'checkout indisponível' }, { status: 503 })
      }

      // checkout_intents tem RLS forçada: grava no tenant do app.tenant_id (withTenant).
      await ctx.client.query(
        `INSERT INTO checkout_intents (partner_reference, tenant_id, clerk_user_id, product_type, plan_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [partnerReference, ctx.tenantId, ctx.userId, plan.product, plan.key]
      )

      return NextResponse.json({ url })
    })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
