import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { alertLicenseResolution, resolveLicense, type LicenseRow } from '@/src/billing/license'

// =====================================================
// API Licenças — Busca licenças ativas do usuário
//
// Resolve tenant via withTenant() (profiles + cookie)
// Busca licenças por tenant_id
// plan_key devolvida = a que decide (src/billing/license.ts);
// null = free. Pago = plan_key não nula.
// =====================================================

export async function GET(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      let licenses: Array<{ product_type: string; is_active: boolean; valid_from: string; valid_until: string | null; plan_key: string | null }> = []
      try {
        const licensesResult = await ctx.client.query(
          `SELECT id, product_type, is_active, valid_from, valid_until,
                  plan_key, billing_source, hotmart_plan, hotmart_offer
           FROM user_licenses
           WHERE tenant_id = $1
             AND is_active = true
             AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
           ORDER BY product_type`,
          [ctx.tenantId]
        )
        licenses = licensesResult.rows.map((row) => {
          const resolution = resolveLicense(row as LicenseRow)
          alertLicenseResolution(resolution, ctx.tenantId, row as LicenseRow)
          return {
            product_type: row.product_type,
            is_active: row.is_active,
            valid_from: row.valid_from,
            valid_until: row.valid_until,
            plan_key: resolution.planKey,
          }
        })
      } catch (dbErr) {
        // Tabela user_licenses pode não existir (pre-migration 006)
        console.warn('[Licenses API] user_licenses query failed:', dbErr instanceof Error ? dbErr.message : String(dbErr))
        licenses = []
      }

      return NextResponse.json({ licenses })
    })
  } catch (error) {
    console.error('Erro ao buscar licenças:', error)
    const { message, status } = handleRouteError(error)
    if (status === 401 || status === 409) {
      return NextResponse.json({ error: message }, { status })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
