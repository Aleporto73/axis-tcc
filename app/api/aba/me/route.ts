import { NextRequest, NextResponse } from 'next/server'
import { withTenant, TenantSelectionRequired } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { getProductLimit } from '@/src/database/product-limits'

// =====================================================
// AXIS — API: Perfil do Usuário Logado
// GET  → retorna role, profileId, dados do profile
// PUT  → atualiza name e registro profissional (crp/crp_uf)
//
// Usado por: RoleProvider, Configurações TCC/ABA/TDAH
//
// Se o usuário pertence a múltiplos tenants e não selecionou:
//   Retorna 409 com lista de tenants para escolha.
// =====================================================

export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      const profile = await ctx.client.query(
        `SELECT
          p.id,
          p.tenant_id,
          p.clerk_user_id,
          p.role,
          p.name,
          p.email,
          p.crp,
          p.crp_uf,
          p.is_active,
          p.created_at,
          t.name AS tenant_name,
          t.plan_tier AS tenant_plan,
          t.max_patients,
          (SELECT COUNT(*) FROM learners l WHERE l.tenant_id = p.tenant_id AND l.is_active = true)::int AS learner_count
        FROM profiles p
        JOIN tenants t ON t.id = p.tenant_id
        WHERE p.clerk_user_id = $1 AND p.tenant_id = $2 AND p.is_active = true
        LIMIT 1`,
        [ctx.userId, ctx.tenantId]
      )

      if (profile.rows.length === 0) {
        // Fallback: retornar dados do tenants para compatibilidade
        return {
          id: ctx.profileId,
          tenant_id: ctx.tenantId,
          role: ctx.role,
          name: 'Profissional',
          is_active: true,
        }
      }

      // Per-product limits (substitui tenants.max_patients global)
      const [tccLimit, abaLimit, tdahLimit] = await Promise.all([
        getProductLimit(ctx.client, ctx.tenantId, 'tcc'),
        getProductLimit(ctx.client, ctx.tenantId, 'aba'),
        getProductLimit(ctx.client, ctx.tenantId, 'tdah'),
      ])

      return {
        ...profile.rows[0],
        product_limits: {
          tcc:  { plan: tccLimit.plan,  max_patients: tccLimit.maxPatients },
          aba:  { plan: abaLimit.plan,  max_patients: abaLimit.maxPatients },
          tdah: { plan: tdahLimit.plan, max_patients: tdahLimit.maxPatients },
        },
      }
    })

    return NextResponse.json({ profile: result })
  } catch (error) {
    if (error instanceof TenantSelectionRequired) {
      return NextResponse.json(
        { error: 'tenant_selection_required', tenants: error.tenants },
        { status: 409 }
      )
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ── PUT: Atualizar perfil (name, crp) ──

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, crp, crp_uf } = body

    const result = await withTenant(async (ctx) => {
      // Atualiza profiles (multi-tenant safe)
      const profileUpdate = await ctx.client.query(
        `UPDATE profiles
         SET name = COALESCE(NULLIF($1, ''), name),
             crp = $2,
             crp_uf = $3
         WHERE clerk_user_id = $4 AND tenant_id = $5 AND is_active = true
         RETURNING id, name, crp, crp_uf`,
        [name?.trim() || '', crp || '', crp_uf || '', ctx.userId, ctx.tenantId]
      )

      if (profileUpdate.rows.length === 0) {
        throw new Error('Profile não encontrado')
      }

      // Sync: atualiza tenants.name também (owner/admin)
      if (name?.trim()) {
        await ctx.client.query(
          `UPDATE tenants SET name = $1, updated_at = NOW() WHERE id = $2 AND clerk_user_id = $3`,
          [name.trim(), ctx.tenantId, ctx.userId]
        )
      }

      return profileUpdate.rows[0]
    })

    return NextResponse.json({ success: true, profile: result })
  } catch (error) {
    if (error instanceof TenantSelectionRequired) {
      return NextResponse.json(
        { error: 'tenant_selection_required' },
        { status: 409 }
      )
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

