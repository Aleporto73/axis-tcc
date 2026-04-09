import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import pool from '@/src/database/db'

export const dynamic = 'force-dynamic'

// =====================================================
// TCC Onboarding — CPF/CRP obrigatórios
//
// GET:  retorna { completed, cpf, crp }
// POST: salva CPF + CRP
//
// Migrado para withTenant() — resolve tenant via
// profiles + cookie axis_active_tenant.
//
// NOTA: CPF uniqueness check usa pool direto (sem RLS)
// porque precisa verificar cross-tenant.
// =====================================================

function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cleaned)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i)
  let d1 = 11 - (sum % 11)
  if (d1 >= 10) d1 = 0
  if (parseInt(cleaned[9]) !== d1) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i)
  let d2 = 11 - (sum % 11)
  if (d2 >= 10) d2 = 0
  return parseInt(cleaned[10]) === d2
}

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
      const profile = await ctx.client.query(
        `SELECT cpf, crp, crp_uf, name FROM profiles
         WHERE clerk_user_id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
        [ctx.userId, ctx.tenantId]
      )
      const p = profile.rows[0]
      const hasCpf = p?.cpf && p.cpf.trim() !== ''

      return NextResponse.json({
        completed: hasCpf,
        cpf: p?.cpf || null,
        crp: p?.crp_uf && p?.crp ? `${p.crp_uf}/${p.crp}` : p?.crp || null,
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
      const body = await request.json()
      const { cpf, crp } = body

      console.log('[TCC Onboarding POST] Recebido:', { cpf: cpf?.substring(0, 4) + '...', crp })

      if (!cpf || !validateCPF(cpf)) {
        return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })
      }
      if (!crp || !validateCRP(crp)) {
        return NextResponse.json({ error: 'CRP inválido. Formato esperado: 06/12345' }, { status: 400 })
      }

      const cpfClean = cpf.replace(/\D/g, '')
      const { crp_uf, crp_number } = parseCRP(crp)

      // Verificar unicidade CPF — usa pool direto (sem RLS) porque precisa cross-tenant
      const existing = await pool.query(
        `SELECT id FROM profiles WHERE cpf = $1 AND clerk_user_id != $2`,
        [cpfClean, ctx.userId]
      )
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'Este CPF já está cadastrado em outra conta' }, { status: 409 })
      }

      // UPDATE com RETURNING para confirmar salvamento
      const updateResult = await ctx.client.query(
        `UPDATE profiles
         SET cpf = $1, crp = $2, crp_uf = $3, updated_at = NOW()
         WHERE clerk_user_id = $4 AND tenant_id = $5 AND is_active = true
         RETURNING id, cpf, crp, crp_uf`,
        [cpfClean, crp_number, crp_uf, ctx.userId, ctx.tenantId]
      )

      console.log('[TCC Onboarding POST] UPDATE RETURNING:', {
        rowCount: updateResult.rowCount,
        returned: updateResult.rows[0] || 'NONE',
      })

      if (updateResult.rowCount === 0) {
        // Nenhum profile — criar um
        console.warn('[TCC Onboarding POST] Nenhum profile, criando...')
        const tenantData = await ctx.client.query(`SELECT name, email FROM tenants WHERE id = $1`, [ctx.tenantId])
        if (tenantData.rows.length > 0) {
          const insertResult = await ctx.client.query(
            `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, cpf, crp, crp_uf, is_active)
             VALUES ($1, $2, 'admin', $3, $4, $5, $6, $7, true)
             RETURNING id, cpf, crp, crp_uf`,
            [ctx.tenantId, ctx.userId, tenantData.rows[0].name, tenantData.rows[0].email, cpfClean, crp_number, crp_uf]
          )
          console.log('[TCC Onboarding POST] INSERT RETURNING:', insertResult.rows[0])
        }
      }

      // Marcar onboarding completo
      await ctx.client.query(
        `UPDATE tenants SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()) WHERE id = $1`,
        [ctx.tenantId]
      )

      // Audit (dentro da transação do withTenant)
      try {
        await ctx.client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, $3, 'TCC_ONBOARDING_COMPLETED', 'profiles',
           jsonb_build_object('cpf_set', true, 'crp', $4), NOW())`,
          [ctx.tenantId, ctx.userId, ctx.userId, `${crp_uf}/${crp_number}`]
        )
      } catch { /* non-blocking */ }

      return NextResponse.json({ success: true }, { status: 201 })
    })
  } catch (error: any) {
    console.error('[TCC Onboarding POST] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
