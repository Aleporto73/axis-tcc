import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

export const dynamic = 'force-dynamic'

// =====================================================
// TCC Onboarding — CRP opcional (Fase 12.1)
//
// GET:  retorna { completed, crp, crp_uf, name }
//        - completed = tenants.onboarding_completed_at IS NOT NULL
// POST: aceita { crp? } e marca onboarding como completo
//        - CPF removido completamente (Fase 12.1)
//        - CRP opcional; se vier preenchido, valida e persiste
//
// Usa withTenant() — resolve tenant via profiles + cookie
// axis_active_tenant.
// =====================================================

function validateCRP(crp: string): boolean {
  return /^(\d{1,2}|[A-Z]{2})[\/\-]\d{4,6}(-\d)?$/i.test(crp.trim())
}

function parseCRP(raw: string): { crp_uf: string; crp_number: string } {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^[A-Za-z]+\s+/i, '')

  if (cleaned.includes('/')) {
    const parts = cleaned.split('/')
    return { crp_uf: parts[0].trim(), crp_number: parts.slice(1).join('/').trim() }
  }
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-')
    return { crp_uf: parts[0].trim(), crp_number: parts.slice(1).join('-').trim() }
  }
  return { crp_uf: '', crp_number: cleaned }
}

export async function GET() {
  try {
    return await withTenant(async (ctx) => {
      const [profileRes, tenantRes] = await Promise.all([
        ctx.client.query(
          `SELECT crp, crp_uf, name FROM profiles
           WHERE clerk_user_id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
          [ctx.userId, ctx.tenantId]
        ),
        ctx.client.query(
          `SELECT onboarding_completed_at FROM tenants WHERE id = $1 LIMIT 1`,
          [ctx.tenantId]
        ),
      ])
      const p = profileRes.rows[0]
      const t = tenantRes.rows[0]
      const completed = !!t?.onboarding_completed_at

      return NextResponse.json({
        completed,
        crp: p?.crp_uf && p?.crp ? `${p.crp_uf}/${p.crp}` : p?.crp || null,
        crp_uf: p?.crp_uf || null,
        name: p?.name || null,
      })
    })
  } catch (error) {
    console.error('[TCC Onboarding GET]', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      const body = await request.json().catch(() => ({}))
      const rawCrp: string | undefined = typeof body?.crp === 'string' ? body.crp : undefined
      const crpProvided = !!(rawCrp && rawCrp.trim())

      console.log('[TCC Onboarding POST] Recebido:', { crp_provided: crpProvided })

      // CRP é opcional. Se veio preenchido, valida e persiste.
      // Se não veio, garantimos defensivamente que o profile existe
      // (fallback caso o auto-provisioning via webhook Clerk tenha falhado).
      if (crpProvided) {
        const crp = rawCrp!.trim()
        if (!validateCRP(crp)) {
          return NextResponse.json({ error: 'CRP inválido. Formato esperado: 06/12345' }, { status: 400 })
        }
        const { crp_uf, crp_number } = parseCRP(crp)

        const updateResult = await ctx.client.query(
          `UPDATE profiles
           SET crp = $1, crp_uf = $2, updated_at = NOW()
           WHERE clerk_user_id = $3 AND tenant_id = $4 AND is_active = true
           RETURNING id, crp, crp_uf`,
          [crp_number, crp_uf, ctx.userId, ctx.tenantId]
        )

        console.log('[TCC Onboarding POST] UPDATE RETURNING:', {
          rowCount: updateResult.rowCount,
          returned: updateResult.rows[0] || 'NONE',
        })

        if (updateResult.rowCount === 0) {
          // Nenhum profile — criar um com CRP
          console.warn('[TCC Onboarding POST] Nenhum profile, criando com CRP...')
          const tenantData = await ctx.client.query(
            `SELECT name, email FROM tenants WHERE id = $1`,
            [ctx.tenantId]
          )
          if (tenantData.rows.length > 0) {
            const insertResult = await ctx.client.query(
              `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, crp, crp_uf, is_active)
               VALUES ($1, $2, 'admin', $3, $4, $5, $6, true)
               RETURNING id, crp, crp_uf`,
              [ctx.tenantId, ctx.userId, tenantData.rows[0].name, tenantData.rows[0].email, crp_number, crp_uf]
            )
            console.log('[TCC Onboarding POST] INSERT RETURNING:', insertResult.rows[0])
          }
        }
      } else {
        // CRP vazio — garantir que profile existe (fallback defensivo)
        const profileCheck = await ctx.client.query(
          `SELECT id FROM profiles
           WHERE clerk_user_id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
          [ctx.userId, ctx.tenantId]
        )
        if (profileCheck.rowCount === 0) {
          console.warn('[TCC Onboarding POST] Nenhum profile e sem CRP — criando mínimo...')
          const tenantData = await ctx.client.query(
            `SELECT name, email FROM tenants WHERE id = $1`,
            [ctx.tenantId]
          )
          if (tenantData.rows.length > 0) {
            const insertResult = await ctx.client.query(
              `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, is_active)
               VALUES ($1, $2, 'admin', $3, $4, true)
               RETURNING id`,
              [ctx.tenantId, ctx.userId, tenantData.rows[0].name, tenantData.rows[0].email]
            )
            console.log('[TCC Onboarding POST] INSERT (mínimo) RETURNING:', insertResult.rows[0])
          }
        }
      }

      // Marcar onboarding completo (sempre, com ou sem CRP)
      await ctx.client.query(
        `UPDATE tenants SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()) WHERE id = $1`,
        [ctx.tenantId]
      )

      // Audit (dentro da transacao do withTenant)
      try {
        await ctx.client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, $3, 'TCC_ONBOARDING_COMPLETED', 'profiles',
           jsonb_build_object('crp_set', $4::boolean), NOW())`,
          [ctx.tenantId, ctx.userId, ctx.userId, crpProvided]
        )
      } catch { /* non-blocking */ }

      return NextResponse.json({ success: true }, { status: 201 })
    })
  } catch (error: unknown) {
    console.error('[TCC Onboarding POST] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
