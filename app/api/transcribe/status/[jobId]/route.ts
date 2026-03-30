import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

/**
 * GET /api/transcribe/status/[jobId]
 *
 * Retorna apenas estado do job. NÃO retorna texto completo.
 * Usado pelo frontend para polling a cada 5 segundos.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { jobId } = await params

    // Resolver tenant do usuário
    const profileRes = await pool.query(
      'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
      [userId]
    )
    let tenantId = profileRes.rows[0]?.tenant_id
    if (!tenantId) {
      const tenantRes = await pool.query('SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1', [userId])
      tenantId = tenantRes.rows[0]?.id
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }

    // Buscar job — verificar que pertence ao tenant (sem RLS, check explícito)
    const jobRes = await pool.query(
      `SELECT id, status, progress, transcript_id, error_message,
              created_at, started_at, finished_at
       FROM transcription_jobs
       WHERE id = $1 AND tenant_id = $2`,
      [jobId, tenantId]
    )

    if (jobRes.rows.length === 0) {
      return NextResponse.json({ error: 'Job nao encontrado' }, { status: 404 })
    }

    const job = jobRes.rows[0]

    return NextResponse.json({
      success: true,
      job_id: job.id,
      status: job.status,
      transcript_id: job.transcript_id || null,
      error_message: job.status === 'failed' ? job.error_message : null,
      created_at: job.created_at,
      started_at: job.started_at,
      finished_at: job.finished_at,
    })

  } catch (error: any) {
    console.error('[TRANSCRIBE-STATUS] Erro:', error)
    return NextResponse.json({ error: 'Erro ao consultar status' }, { status: 500 })
  }
}
