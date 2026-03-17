import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

// =====================================================
// AXIS — Activate Free Tier (Universal)
//
// POST { product_type: 'tcc' | 'aba' | 'tdah' }
//
// Cria licença FREE (1 paciente) para o produto solicitado.
// Regras:
//   - Exige auth Clerk
//   - 1 licença free por produto por tenant
//   - Se já tem licença (free ou paga), retorna 409
//   - Não cria tenant novo — usa tenant existente
//   - Se user não tem tenant, cria via fluxo padrão
// =====================================================

const VALID_PRODUCTS = new Set(['tcc', 'aba', 'tdah'])

const DASHBOARD_PATH: Record<string, string> = {
  tcc: '/dashboard',
  aba: '/aba/dashboard',
  tdah: '/tdah/dashboard',
}

export async function POST(request: NextRequest) {
  const client = await pool.connect()

  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { product_type } = body

    if (!product_type || !VALID_PRODUCTS.has(product_type)) {
      return NextResponse.json(
        { error: 'product_type inválido. Valores aceitos: tcc, aba, tdah' },
        { status: 400 }
      )
    }

    // 1. Resolver tenant do user
    let tenantId: string | null = null
    let clerkUserId = userId

    // Busca por profile ativo
    const profileResult = await client.query(
      `SELECT p.tenant_id, p.clerk_user_id
       FROM profiles p
       WHERE p.clerk_user_id = $1 AND p.is_active = true
       LIMIT 1`,
      [userId]
    )

    if (profileResult.rows.length > 0) {
      tenantId = profileResult.rows[0].tenant_id
    } else {
      // Fallback: busca tenant legado
      const tenantResult = await client.query(
        'SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
        [userId]
      )
      tenantId = tenantResult.rows[0]?.id || null
    }

    // Se não tem tenant, precisa criar primeiro via /api/user/tenant
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant não encontrado. Faça login primeiro.' },
        { status: 404 }
      )
    }

    // 2. Verificar se já tem licença para esse produto
    const existingLicense = await client.query(
      `SELECT is_active, hotmart_plan, plan_tier
       FROM user_licenses
       WHERE tenant_id = $1 AND product_type = $2
       LIMIT 1`,
      [tenantId, product_type]
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
      // Licença inativa existe — reativar como free
    }

    // 3. Criar/reativar licença FREE
    await client.query('BEGIN')

    await client.query(
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
      [tenantId, clerkUserId, product_type]
    )

    // Audit log
    try {
      await client.query(
        `INSERT INTO axis_audit_logs (
          tenant_id, user_id, actor, action, entity_type, metadata, created_at
        ) VALUES ($1, $2, $3, 'FREE_TIER_ACTIVATED', 'user_licenses', $4, NOW())`,
        [
          tenantId, clerkUserId, clerkUserId,
          JSON.stringify({
            product_type,
            source: 'activate_free_endpoint',
            max_patients: 1,
          })
        ]
      )
    } catch (_) { /* audit non-blocking */ }

    await client.query('COMMIT')

    console.log('[ACTIVATE FREE]', { tenantId, userId, product_type })

    return NextResponse.json(
      {
        success: true,
        product_type,
        redirect: DASHBOARD_PATH[product_type],
      },
      { status: 201 }
    )

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[ACTIVATE FREE] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  } finally {
    client.release()
  }
}
