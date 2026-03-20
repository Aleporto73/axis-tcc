import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, requireFeature, handleRouteError } from '@/src/database/with-role'
import { encryptParam, decryptColumn, getKeyParam } from '@/src/lib/crypto'

// =====================================================
// AXIS ABA - API: Locais de Atendimento (service_sites)
// Ref: skill_axis_aba_v270.md — Sprint 0
//
// GET  — Listar locais do tenant (admin/supervisor/terapeuta)
// POST — Criar novo local (admin/supervisor)
//
// Endereço criptografado (pgcrypto) — pode conter dados pessoais
// Lat/Long em claro — dados do LOCAL, não do paciente
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_SITE_TYPES = ['clinic', 'home', 'school', 'telehealth', 'community', 'other'] as const

// ─────────────────────────────────────────────────────
// GET — Listar locais de atendimento
// Todos os roles podem ver (terapeuta precisa selecionar local na sessão)
// ─────────────────────────────────────────────────────
export async function GET() {
  try {
    const result = await withTenant(async (ctx) => {
      requireFeature(ctx, 'serviceSites')
      const keyParam = getKeyParam()

      const sites = await ctx.client.query(
        `SELECT
          id,
          site_name,
          site_type,
          ${decryptColumn('address_encrypted', 'address', 2)},
          latitude,
          longitude,
          radius_meters,
          is_active,
          created_at,
          updated_at
        FROM service_sites
        WHERE tenant_id = $1
        ORDER BY is_active DESC, site_name ASC`,
        [ctx.tenantId, keyParam]
      )

      return sites
    })

    return NextResponse.json({ sites: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Criar novo local de atendimento
// Admin ou Supervisor apenas
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { site_name, site_type, address, latitude, longitude, radius_meters } = body

    // Validação
    if (!site_name?.trim()) {
      return NextResponse.json(
        { error: 'Nome do local é obrigatório' },
        { status: 400 }
      )
    }

    if (site_type && !VALID_SITE_TYPES.includes(site_type)) {
      return NextResponse.json(
        { error: `Tipo de local inválido. Permitidos: ${VALID_SITE_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (latitude !== undefined && latitude !== null) {
      const lat = Number(latitude)
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return NextResponse.json({ error: 'Latitude inválida (-90 a 90)' }, { status: 400 })
      }
    }

    if (longitude !== undefined && longitude !== null) {
      const lng = Number(longitude)
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return NextResponse.json({ error: 'Longitude inválida (-180 a 180)' }, { status: 400 })
      }
    }

    const radiusValue = radius_meters ? Number(radius_meters) : 200
    if (radiusValue < 50 || radiusValue > 5000) {
      return NextResponse.json({ error: 'Raio deve ser entre 50 e 5000 metros' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)
      requireFeature(ctx, 'serviceSites')

      const keyParam = getKeyParam()
      const { encryptSQL } = encryptParam(7)

      const created = await ctx.client.query(
        `INSERT INTO service_sites (
          tenant_id, site_name, site_type, latitude, longitude, radius_meters, address_encrypted
        ) VALUES (
          $1, $2, $3, $4, $5, $6, ${encryptSQL}
        )
        RETURNING id, site_name, site_type, latitude, longitude, radius_meters, is_active, created_at`,
        [
          ctx.tenantId,
          site_name.trim(),
          site_type || 'clinic',
          latitude ?? null,
          longitude ?? null,
          radiusValue,
          address || '',
          keyParam
        ]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'SERVICE_SITE_CREATED', 'operational', $2,
          jsonb_build_object(
            'site_id', $3::text,
            'site_name', $4::text,
            'site_type', $5::text
          )
        )`,
        [ctx.tenantId, ctx.profileId, created.rows[0].id, site_name.trim(), site_type || 'clinic']
      )

      return created
    })

    return NextResponse.json({ site: result.rows[0] }, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
