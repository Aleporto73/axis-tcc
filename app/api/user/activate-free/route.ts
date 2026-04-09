import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS — Activate Free Tier (Universal)
//
// POST { product_type: 'tcc' | 'aba' | 'tdah' }
//
// Cria licença FREE (1 paciente) para o produto solicitado.
// Regras:
//   - Exige auth Clerk (via withTenant)
//   - 1 licença free por produto por tenant
//   - Se já tem licença (free ou paga), retorna 409
//   - Não cria tenant novo — usa tenant existente
// =====================================================

const VALID_PRODUCTS = new Set(['tcc', 'aba', 'tdah'])

const DASHBOARD_PATH: Record<string, string> = {
  tcc: '/dashboard',
  aba: '/aba/dashboard',
  tdah: '/tdah/dashboard',
}

export async function POST(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      const body = await request.json()
      const { product_type } = body

      if (!product_type || !VALID_PRODUCTS.has(product_type)) {
        return NextResponse.json(
          { error: 'product_type inválido. Valores aceitos: tcc, aba, tdah' },
          { status: 400 }
        )
      }

      // Verificar se já tem licença para esse produto
      const existingLicense = await ctx.client.query(
        `SELECT is_active, hotmart_plan
         FROM user_licenses
         WHERE tenant_id = $1 AND product_type = $2
         LIMIT 1`,
        [ctx.tenantId, product_type]
      )

      if (existingLicense.rows.length > 0) {
        const license = existingLicense.rows[0]
        if (license.is_active) {
          return NextResponse.json(
            {
              error: license.hotmart_plan
                ? 'Já possui licença ativa para este produto.'
                : 'Já possui free tier para este produto.',
              redirect: DASHBOARD_PATH[product_type],
            },
            { status: 409 }
          )
        }
      }

      // Criar/reativar licença FREE
      await ctx.client.query(
        `INSERT INTO user_licenses (
          tenant_id, clerk_user_id, product_type, is_active,
          valid_from, valid_until,
          hotmart_transaction, hotmart_event, hotmart_offer, hotmart_plan,
          buyer_email, created_at, updated_at
        ) VALUES ($1, $2, $3, true, NOW(), NULL, NULL, 'FREE_TIER_ACTIVATION', NULL, NULL, NULL, NOW(), NOW())
        ON CONFLICT ON CONSTRAINT uq_user_product
        DO UPDATE SET
          is_active = true,
          valid_from = NOW(),
          valid_until = NULL,
          hotmart_event = 'FREE_TIER_ACTIVATION',
          updated_at = NOW()`,
        [ctx.tenantId, ctx.userId, product_type]
      )

      // Audit log
      try {
        await ctx.client.query(
          `INSERT INTO axis_audit_logs (
            tenant_id, user_id, actor, action, entity_type, metadata, created_at
          ) VALUES ($1, $2, $3, 'FREE_TIER_ACTIVATED', 'user_licenses', $4, NOW())`,
          [
            ctx.tenantId, ctx.userId, ctx.userId,
            JSON.stringify({
              product_type,
              source: 'activate_free_endpoint',
              max_patients: 1,
            })
          ]
        )
      } catch (_) { /* audit non-blocking */ }

      console.log('[ACTIVATE FREE]', { tenantId: ctx.tenantId, userId: ctx.userId, product_type })

      return NextResponse.json(
        {
          success: true,
          product_type,
          redirect: DASHBOARD_PATH[product_type],
        },
        { status: 201 }
      )
    })
  } catch (error) {
    console.error('[ACTIVATE FREE] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
