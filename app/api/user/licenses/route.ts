import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

// =====================================================
// API Licenças — Busca licenças ativas do usuário
//
// Resolve tenant via profiles (novo modelo) → fallback tenants
// Busca licenças por tenant_id (sem filtrar clerk_user_id
// para suportar auto-provisioning via Hotmart com pending_*)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Resolver tenant via profiles → fallback tenants (mesmo padrão do layout ABA)
    let tenantId: string | null = null

    const profileResult = await pool.query(
      'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
      [userId]
    )

    if (profileResult.rows.length > 0) {
      tenantId = profileResult.rows[0].tenant_id
    } else {
      // Fallback: tenants direta
      const tenantResult = await pool.query(
        'SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
        [userId]
      )
      tenantId = tenantResult.rows[0]?.id || null
    }

    if (!tenantId) {
      return NextResponse.json({ licenses: [] })
    }

    // Buscar licenças ativas por tenant_id (sem filtrar clerk_user_id)
    let licenses: Array<{ product_type: string; is_active: boolean; valid_from: string; valid_until: string | null }> = []
    try {
      const licensesResult = await pool.query(
        `SELECT product_type, is_active, valid_from, valid_until
         FROM user_licenses
         WHERE tenant_id = $1
           AND is_active = true
           AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
         ORDER BY product_type`,
        [tenantId]
      )
      licenses = licensesResult.rows
    } catch (dbErr) {
      // Tabela user_licenses pode não existir (pre-migration 006)
      console.warn('[Licenses API] user_licenses query failed:', dbErr instanceof Error ? dbErr.message : String(dbErr))
      // Sem fallback — se a tabela não existe, retorna vazio
      licenses = []
    }

    return NextResponse.json({ licenses })
  } catch (error) {
    console.error('Erro ao buscar licenças:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
