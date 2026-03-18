import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export const dynamic = 'force-dynamic'

// =====================================================
// TCC Onboarding — CPF/CRP obrigatórios
//
// GET:  retorna { completed, cpf, crp }
// POST: salva CPF + CRP diretamente (sem withTenant)
//
// Usa pool direto em vez de withTenant para evitar issues
// com transações e colunas recém-criadas.
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
  // Limpar: remover "CRP ", "CRFa ", etc antes do split
  let cleaned = raw.trim()
  // Remove prefixos como "CRP ", "CRFa ", etc
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
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Resolver tenant
    let tenantId: string | null = null
    const profileRes = await pool.query(
      'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
      [userId]
    )
    if (profileRes.rows.length > 0) {
      tenantId = profileRes.rows[0].tenant_id
    } else {
      const tenantRes = await pool.query('SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1', [userId])
      tenantId = tenantRes.rows[0]?.id || null
    }

    if (!tenantId) return NextResponse.json({ completed: false, cpf: null, crp: null })

    // Buscar CPF/CRP do profile
    const profile = await pool.query(
      `SELECT cpf, crp, crp_uf, name FROM profiles
       WHERE clerk_user_id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
      [userId, tenantId]
    )
    const p = profile.rows[0]
    const hasCpf = p?.cpf && p.cpf.trim() !== ''

    return NextResponse.json({
      completed: hasCpf,
      cpf: p?.cpf || null,
      crp: p?.crp_uf && p?.crp ? `${p.crp_uf}/${p.crp}` : p?.crp || null,
      name: p?.name || null,
    })
  } catch (error) {
    console.error('[TCC Onboarding GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect()

  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

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

    // Resolver tenant
    const profileRes = await client.query(
      'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
      [userId]
    )
    let tenantId: string | null = profileRes.rows[0]?.tenant_id || null

    if (!tenantId) {
      const tenantRes = await client.query('SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1', [userId])
      tenantId = tenantRes.rows[0]?.id || null
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    // Verificar unicidade CPF
    const existing = await client.query(
      `SELECT id FROM profiles WHERE cpf = $1 AND clerk_user_id != $2`,
      [cpfClean, userId]
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Este CPF já está cadastrado em outra conta' }, { status: 409 })
    }

    await client.query('BEGIN')

    // UPDATE com RETURNING para confirmar salvamento
    const updateResult = await client.query(
      `UPDATE profiles
       SET cpf = $1, crp = $2, crp_uf = $3, updated_at = NOW()
       WHERE clerk_user_id = $4 AND tenant_id = $5 AND is_active = true
       RETURNING id, cpf, crp, crp_uf`,
      [cpfClean, crp_number, crp_uf, userId, tenantId]
    )

    console.log('[TCC Onboarding POST] UPDATE RETURNING:', {
      rowCount: updateResult.rowCount,
      returned: updateResult.rows[0] || 'NONE',
      params: { cpfClean, crp_number, crp_uf, userId, tenantId },
    })

    if (updateResult.rowCount === 0) {
      // Nenhum profile — criar um
      console.warn('[TCC Onboarding POST] Nenhum profile, criando...')
      const tenantData = await client.query(`SELECT name, email FROM tenants WHERE id = $1`, [tenantId])
      if (tenantData.rows.length > 0) {
        const insertResult = await client.query(
          `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, cpf, crp, crp_uf, is_active)
           VALUES ($1, $2, 'admin', $3, $4, $5, $6, $7, true)
           RETURNING id, cpf, crp, crp_uf`,
          [tenantId, userId, tenantData.rows[0].name, tenantData.rows[0].email, cpfClean, crp_number, crp_uf]
        )
        console.log('[TCC Onboarding POST] INSERT RETURNING:', insertResult.rows[0])
      }
    }

    // Marcar onboarding completo
    await client.query(
      `UPDATE tenants SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()) WHERE id = $1`,
      [tenantId]
    )

    await client.query('COMMIT')

    // Verificação final: ler do banco pra confirmar
    const verify = await pool.query(
      `SELECT cpf, crp, crp_uf FROM profiles WHERE clerk_user_id = $1 AND tenant_id = $2 AND is_active = true`,
      [userId, tenantId]
    )
    console.log('[TCC Onboarding POST] VERIFICAÇÃO FINAL:', verify.rows[0] || 'PROFILE NÃO ENCONTRADO')

    // Audit (fora da transação, non-blocking)
    try {
      await pool.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
         VALUES ($1, $2, $3, 'TCC_ONBOARDING_COMPLETED', 'profiles',
         jsonb_build_object('cpf_set', true, 'crp', $4), NOW())`,
        [tenantId, userId, userId, `${crp_uf}/${crp_number}`]
      )
    } catch { /* non-blocking */ }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[TCC Onboarding POST] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  } finally {
    client.release()
  }
}
