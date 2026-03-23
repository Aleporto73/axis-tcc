import { NextResponse } from 'next/server'
import pool from '@/src/database/db'
import { createSystemAlert } from '@/src/utils/system-alert'

// =====================================================
// AXIS — Health Check Endpoint
// GET /api/health (público, sem auth)
//
// Verifica: conexão DB, app rodando
// Retorna 200 se tudo OK, 503 se falhar
// Se falhar, grava alerta critical via createSystemAlert
// =====================================================

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {
    app: 'ok',
    db: 'error',
  }

  // Verificar conexão com PostgreSQL
  try {
    const result = await pool.query('SELECT 1 AS alive')
    if (result.rows[0]?.alive === 1) {
      checks.db = 'ok'
    }
  } catch (err) {
    console.error('[HEALTH] DB check failed:', err)

    // Gravar alerta de sistema (fire-and-forget, pode falhar se DB está down)
    createSystemAlert({
      module: 'shared',
      severity: 'critical',
      source: 'api/health',
      code: 'DB_UNREACHABLE',
      message: 'Health check: conexao com banco falhou',
      context: { error: err instanceof Error ? err.message : 'unknown' },
    }).catch(() => {}) // ignora se não conseguir gravar (DB down)
  }

  const allOk = Object.values(checks).every(v => v === 'ok')

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'error',
      ...checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  )
}
