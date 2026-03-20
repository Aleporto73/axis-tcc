import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'
import { encryptParam, decryptColumn, getKeyParam } from '@/src/lib/crypto'

// =====================================================
// AXIS ABA - API: Local de Atendimento Individual
// Ref: skill_axis_aba_v270.md — Sprint 0
//
// GET   — Detalhes de um local
// PATCH — Atualizar local (admin/supervisor)
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_SITE_TYPES = ['clinic', 'home', 'school', 'telehealth', 'community', 'other'] as const

// ─────────────────────────────────────────────────────
// GET — Detalhes do local (todos os roles)
// ─────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant(async (ctx) => {
      const keyParam = getKeyParam()

      const site = await ctx.client.query(
        `SELECT
          id,
          site_name,
          site_type,
          ${decryptColumn('address_encrypted', 'address', 3)},
          latitude,
          longitude,
          radius_meters,
          is_active,
          created_at,
          updated_at
        FROM service_sites
        WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId, keyParam]
      )

      if (site.rows.length === 0) {
        throw Object.assign(new Error('Local não encontrado'), { statusCode: 404 })
      }

      return site
    })

    return NextResponse.json({ site: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// PATCH — Atualizar local (admin/supervisor)
// Aceita campos parciais
// ─────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { site_name, site_type, address, latitude, longitude, radius_meters, is_active } = body

    // Validações
    if (site_type !== undefined && !VALID_SITE_TYPES.includes(site_type)) {
      return NextResponse.json(
        { error: `Tipo inválido. Permitidos: ${VALID_SITE_TYPES.join(', ')}` },
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

    if (radius_meters !== undefined) {
      const r = Number(radius_meters)
      if (isNaN(r) || r < 50 || r > 5000) {
        return NextResponse.json({ error: 'Raio: 50-5000 metros' }, { status: 400 })
      }
    }

    const result = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)

      // Verificar existência
      const existing = await ctx.client.query(
        `SELECT id FROM service_sites WHERE id = $1 AND tenant_id = $2`,
        [id, ctx.tenantId]
      )
      if (existing.rows.length === 0) {
        throw Object.assign(new Error('Local não encontrado'), { statusCode: 404 })
      }

      // Construir SET dinâmico
      const sets: string[] = []
      const values: (string | number | boolean | null)[] = [id, ctx.tenantId]
      let paramIdx = 3

      if (site_name !== undefined) {
        sets.push(`site_name = $${paramIdx}`)
        values.push(site_name.trim())
        paramIdx++
      }

      if (site_type !== undefined) {
        sets.push(`site_type = $${paramIdx}`)
        values.push(site_type)
        paramIdx++
      }

      if (latitude !== undefined) {
        sets.push(`latitude = $${paramIdx}`)
        values.push(latitude)
        paramIdx++
      }

      if (longitude !== undefined) {
        sets.push(`longitude = $${paramIdx}`)
        values.push(longitude)
        paramIdx++
      }

      if (radius_meters !== undefined) {
        sets.push(`radius_meters = $${paramIdx}`)
        values.push(Number(radius_meters))
        paramIdx++
      }

      if (is_active !== undefined) {
        sets.push(`is_active = $${paramIdx}`)
        values.push(Boolean(is_active))
        paramIdx++
      }

      if (address !== undefined) {
        const keyParam = getKeyParam()
        const { encryptSQL } = encryptParam(paramIdx)
        sets.push(`address_encrypted = ${encryptSQL}`)
        values.push(address || '')
        values.push(keyParam)
        paramIdx += 2
      }

      if (sets.length === 0) {
        return existing
      }

      sets.push(`updated_at = NOW()`)

      const updated = await ctx.client.query(
        `UPDATE service_sites SET ${sets.join(', ')}
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, site_name, site_type, latitude, longitude, radius_meters, is_active, updated_at`,
        values
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'SERVICE_SITE_UPDATED', 'operational', $2,
          jsonb_build_object('site_id', $3::text, 'fields_changed', $4::text)
        )`,
        [ctx.tenantId, ctx.profileId, id, sets.filter(s => !s.startsWith('updated_at')).map(s => s.split(' = ')[0]).join(', ')]
      )

      return updated
    })

    return NextResponse.json({ site: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
