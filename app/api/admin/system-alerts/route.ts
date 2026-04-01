import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '../guard'
import pool from '@/src/database/db'

// =====================================================
// AXIS — Admin API: System Alerts
// GET  /api/admin/system-alerts — Listar alertas (com filtros)
// PATCH /api/admin/system-alerts — Resolver alerta por ID
//
// Protegido por verifyAdmin (emails autorizados)
// =====================================================

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────
// GET — Listar alertas com filtros opcionais
// Query params: severity, module, resolved, limit
// ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const check = await verifyAdmin()
  if (!check.authorized) return check.response

  try {
    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity')
    const module = searchParams.get('module')
    const resolved = searchParams.get('resolved')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    let query = `SELECT * FROM system_alerts WHERE 1=1`
    const params: unknown[] = []
    let idx = 1

    if (severity) {
      query += ` AND severity = $${idx}`
      params.push(severity)
      idx++
    }
    if (module) {
      query += ` AND module = $${idx}`
      params.push(module)
      idx++
    }
    if (resolved !== null && resolved !== undefined && resolved !== '') {
      query += ` AND resolved = $${idx}`
      params.push(resolved === 'true')
      idx++
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx}`
    params.push(limit)

    const result = await pool.query(query, params)

    // Contagens rápidas para o painel
    const countsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE resolved = false) AS unresolved,
        COUNT(*) FILTER (WHERE resolved = false AND severity = 'critical') AS critical,
        COUNT(*) FILTER (WHERE resolved = false AND severity = 'warning') AS warnings,
        COUNT(*) FILTER (WHERE resolved = false AND severity = 'info') AS info
      FROM system_alerts
    `)

    return NextResponse.json({
      alerts: result.rows,
      counts: countsResult.rows[0],
    })
  } catch (error) {
    console.error('[ADMIN/SYSTEM-ALERTS] GET error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar alertas de sistema' },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────
// PATCH — Resolver (ou reabrir) um alerta
// Body: { alert_id: string, resolved: boolean }
// ─────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const check = await verifyAdmin()
  if (!check.authorized) return check.response

  try {
    const body = await request.json()
    const { alert_id, resolved } = body

    if (!alert_id) {
      return NextResponse.json({ error: 'alert_id obrigatório' }, { status: 400 })
    }

    const result = await pool.query(
      `UPDATE system_alerts
       SET resolved = $1,
           resolved_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
           resolved_by = CASE WHEN $1 = true THEN $2 ELSE NULL END
       WHERE id = $3
       RETURNING *`,
      [resolved !== false, check.email, alert_id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ alert: result.rows[0] })
  } catch (error) {
    console.error('[ADMIN/SYSTEM-ALERTS] PATCH error:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar alerta' },
      { status: 500 }
    )
  }
}
