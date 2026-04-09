import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

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
    return await withTenant(async (ctx) => {
      const { jobId } = await params

      const jobRes = await ctx.client.query(
        `SELECT id, status, progress, transcript_id, error_message,
                created_at, started_at, finished_at
         FROM transcription_jobs
         WHERE id = $1 AND tenant_id = $2`,
        [jobId, ctx.tenantId]
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
    })
  } catch (error: any) {
    console.error('[TRANSCRIBE-STATUS] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
