import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export const dynamic = 'force-dynamic'

// =====================================================
// TCC Onboarding — CPF/CRP obrigatórios
//
// GET:  retorna { completed, cpf, crp }
//       completed = true se CPF já preenchido (não depende de onboarding_completed_at)
// POST: salva CPF + CRP, marca onboarding completo
//       UPDATE usa clerk_user_id + tenant_id (não profileId que pode ser fallback)
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

export async function GET() {
  try {
    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Buscar profile pelo clerk_user_id (não depende de profileId)
      const profile = await client.query(
        `SELECT cpf, crp, crp_uf, name FROM profiles
         WHERE clerk_user_id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
        [userId, tenantId]
      )
      const p = profile.rows[0]
      const hasCpf = p?.cpf && p.cpf.trim() !== ''

      return {
        // completed = CPF preenchido (não depende de onboarding_completed_at)
        completed: hasCpf,
        cpf: p?.cpf || null,
        crp: p?.crp_uf && p?.crp ? `${p.crp_uf}/${p.crp}` : p?.crp || null,
        name: p?.name || null,
      }
    })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.error('[TCC Onboarding GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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
    const [crp_uf, crp_number] = crp.includes('/') ? crp.split('/') : crp.includes('-') ? crp.split('-') : ['', crp]

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Verificar unicidade CPF (excluindo o próprio user)
      const existing = await client.query(
        `SELECT id FROM profiles WHERE cpf = $1 AND clerk_user_id != $2`,
        [cpfClean, userId]
      )
      if (existing.rows.length > 0) {
        throw new Error('CPF_DUPLICATE')
      }

      // Salvar CPF + CRP — usar clerk_user_id + tenant_id (NÃO profileId que pode ser fallback errado)
      const updateResult = await client.query(
        `UPDATE profiles SET cpf = $1, crp = $2, crp_uf = $3, updated_at = NOW()
         WHERE clerk_user_id = $4 AND tenant_id = $5 AND is_active = true`,
        [cpfClean, crp_number, crp_uf, userId, tenantId]
      )

      console.log('[TCC Onboarding POST] UPDATE profiles:', {
        rowCount: updateResult.rowCount,
        userId, tenantId, cpfClean, crp_uf, crp_number,
      })

      if (updateResult.rowCount === 0) {
        // Se nenhum profile encontrado, pode ser fallback sem profile
        // Tentar criar profile se não existe
        console.warn('[TCC Onboarding POST] Nenhum profile atualizado, tentando INSERT')
        const tenantData = await client.query(
          `SELECT name, email FROM tenants WHERE id = $1`,
          [tenantId]
        )
        if (tenantData.rows.length > 0) {
          await client.query(
            `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, cpf, crp, crp_uf, is_active)
             VALUES ($1, $2, 'admin', $3, $4, $5, $6, $7, true)
             ON CONFLICT DO NOTHING`,
            [tenantId, userId, tenantData.rows[0].name, tenantData.rows[0].email, cpfClean, crp_number, crp_uf]
          )
        }
      }

      // Marcar onboarding completo (idempotente)
      await client.query(
        `UPDATE tenants SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()) WHERE id = $1`,
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
    console.error('[TCC Onboarding POST] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
