import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )

    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ licenses: [] })
    }

    const tenantId = tenantResult.rows[0].id

    let licenses: Array<{ product_type: string; is_active: boolean; valid_from: string; valid_until: string | null }> = []
    try {
      const licensesResult = await pool.query(
        `SELECT product_type, is_active, valid_from, valid_until
         FROM user_licenses
         WHERE tenant_id = $1
           AND clerk_user_id = $2
           AND is_active = true
           AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
         ORDER BY product_type`,
        [tenantId, userId]
      )
      licenses = licensesResult.rows
    } catch (dbErr) {
      // Tabela user_licenses pode não existir ainda (pre-migration 006)
      // Fallback: verificar se o tenant tem onboarding completo → gerar licença virtual ABA
      console.warn('[Licenses API] user_licenses query failed, using fallback:', dbErr instanceof Error ? dbErr.message : String(dbErr))
      const onboardingResult = await pool.query(
        'SELECT onboarding_completed_at FROM tenants WHERE id = $1',
        [tenantId]
      )
      if (onboardingResult.rows[0]?.onboarding_completed_at) {
        licenses = [{ product_type: 'aba', is_active: true, valid_from: new Date().toISOString(), valid_until: null }]
      }
    }

    return NextResponse.json({ licenses })
  } catch (error) {
    console.error('Erro ao buscar licenças:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
