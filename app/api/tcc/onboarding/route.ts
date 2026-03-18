import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export const dynamic = 'force-dynamic'

// =====================================================
// TCC Onboarding — CPF/CRP obrigatórios
//
// GET:  retorna { completed, cpf, crp }
// POST: salva CPF + CRP, marca onboarding completo
// =====================================================

function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cleaned)) return false // todos iguais
  // Dígito verificador 1
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i)
  let d1 = 11 - (sum % 11)
  if (d1 >= 10) d1 = 0
  if (parseInt(cleaned[9]) !== d1) return false
  // Dígito verificador 2
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i)
  let d2 = 11 - (sum % 11)
  if (d2 >= 10) d2 = 0
  return parseInt(cleaned[10]) === d2
}

function validateCRP(crp: string): boolean {
  return /^(\d{1,2}|[A-Z]{2})[\/\-]\d{4,6}(-\d)?$/i.test(crp.trim())
}

export async function GET() {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      const tenant = await client.query(
        `SELECT onboarding_completed_at FROM tenants WHERE id = $1`,
        [tenantId]
      )
      const profile = await client.query(
        `SELECT cpf, crp, crp_uf, name FROM profiles
         WHERE tenant_id = $1 AND role = 'admin' AND is_active = true LIMIT 1`,
        [tenantId]
      )
      const p = profile.rows[0]
      return {
        completed: !!tenant.rows[0]?.onboarding_completed_at,
        cpf: p?.cpf || null,
        crp: p?.crp_uf && p?.crp ? `${p.crp_uf}/${p.crp}` : p?.crp || null,
        name: p?.name || null,
      }
    })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cpf, crp } = body

    if (!cpf || !validateCPF(cpf)) {
      return NextResponse.json({ error: 'CPF inválido' }, { status: 400 })
    }
    if (!crp || !validateCRP(crp)) {
      return NextResponse.json({ error: 'CRP inválido. Formato esperado: 06/12345' }, { status: 400 })
    }

    const cpfClean = cpf.replace(/\D/g, '')
    const [crp_uf, crp_number] = crp.includes('/') ? crp.split('/') : crp.includes('-') ? crp.split('-') : ['', crp]

    const result = await withTenant(async ({ client, tenantId, userId, profileId }) => {
      // Verificar unicidade CPF
      const existing = await client.query(
        `SELECT id FROM profiles WHERE cpf = $1 AND id != $2`,
        [cpfClean, profileId]
      )
      if (existing.rows.length > 0) {
        throw new Error('CPF_DUPLICATE')
      }

      // Salvar CPF + CRP
      await client.query(
        `UPDATE profiles SET cpf = $1, crp = $2, crp_uf = $3, updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5`,
        [cpfClean, crp_number, crp_uf, profileId, tenantId]
      )

      // Marcar onboarding completo
      await client.query(
        `UPDATE tenants SET onboarding_completed_at = NOW() WHERE id = $1 AND onboarding_completed_at IS NULL`,
        [tenantId]
      )

      // Audit
      try {
        await client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, $3, 'TCC_ONBOARDING_COMPLETED', 'profiles',
           jsonb_build_object('cpf_set', true, 'crp', $4), NOW())`,
          [tenantId, userId, userId, `${crp_uf}/${crp_number}`]
        )
      } catch { /* non-blocking */ }

      return { success: true }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (error.message === 'CPF_DUPLICATE') return NextResponse.json({ error: 'Este CPF já está cadastrado em outra conta' }, { status: 409 })
    console.error('[TCC Onboarding]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
