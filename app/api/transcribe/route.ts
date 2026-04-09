import { NextRequest } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const FREE_LIMIT_MINUTES = 50
const AUDIO_UPLOAD_DIR = process.env.AUDIO_UPLOAD_DIR || '/var/lib/axis/audio-uploads'

/**
 * POST /api/transcribe
 *
 * Fluxo assíncrono:
 * 1. Auth + validar tenant (via withTenant)
 * 2. Checar limite FREE (50 min)
 * 3. Salvar áudio em disco
 * 4. Criar job pending em transcription_jobs
 * 5. Responder imediatamente com job_id
 *
 * NÃO chama ASR. NÃO espera transcrição. O worker faz isso.
 */
export async function POST(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      // ── VERIFICAR LIMITE ──
      const licenseRes = await ctx.client.query(
        `SELECT hotmart_plan FROM user_licenses
         WHERE tenant_id = $1 AND product_type = 'tcc' AND is_active = true LIMIT 1`,
        [ctx.tenantId]
      )
      const isFree = !licenseRes.rows[0]?.hotmart_plan || licenseRes.rows[0].hotmart_plan === ''

      if (isFree) {
        const month = new Date().toISOString().slice(0, 7)
        const usageRes = await ctx.client.query(
          'SELECT minutes_used FROM transcription_usage WHERE tenant_id = $1 AND month = $2',
          [ctx.tenantId, month]
        )
        const minutesUsed = usageRes.rows[0]?.minutes_used || 0

        if (minutesUsed >= FREE_LIMIT_MINUTES) {
          console.log('[TRANSCRIBE] Limite atingido:', { tenantId: ctx.tenantId, minutesUsed })
          return new Response(JSON.stringify({
            error: 'LIMIT_REACHED',
            message: 'Você atingiu o limite de transcrição gratuita este mês.',
            minutes_used: minutesUsed,
            limit: FREE_LIMIT_MINUTES,
          }), { status: 402, headers: { 'Content-Type': 'application/json' } })
        }
      }

      // ── VALIDAR FORM DATA ──
      const formData = await request.formData()
      const audioFile = formData.get('audio') as File
      const sessionId = formData.get('session_id') as string
      const patientId = formData.get('patient_id') as string

      if (!audioFile) {
        return new Response(
          JSON.stringify({ error: 'Arquivo de audio obrigatorio' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (!sessionId || !patientId) {
        return new Response(
          JSON.stringify({ error: 'session_id e patient_id obrigatorios' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // ── SALVAR ÁUDIO EM DISCO ──
      const jobId = randomUUID()
      const ext = path.extname(audioFile.name || 'audio.webm') || '.webm'
      const audioDir = path.join(AUDIO_UPLOAD_DIR, ctx.tenantId)
      await mkdir(audioDir, { recursive: true })
      const audioPath = path.join(audioDir, `${jobId}${ext}`)

      const arrayBuffer = await audioFile.arrayBuffer()
      await writeFile(audioPath, Buffer.from(arrayBuffer))

      console.log('[TRANSCRIBE] Áudio salvo:', { jobId, audioPath, size: audioFile.size })

      // ── CRIAR JOB (dentro da transação do withTenant, com RLS ativo) ──
      await ctx.client.query(
        `INSERT INTO transcription_jobs
         (id, tenant_id, session_id, patient_id, status, audio_path, original_filename, file_size_bytes)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)`,
        [jobId, ctx.tenantId, sessionId, patientId, audioPath, audioFile.name || 'audio.webm', audioFile.size]
      )

      console.log('[TRANSCRIBE] Job criado:', { jobId, tenantId: ctx.tenantId, sessionId })

      return new Response(
        JSON.stringify({ success: true, job_id: jobId, status: 'pending' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
  } catch (error: any) {
    // Unique index violation = já existe job ativo para esta sessão
    if (error.code === '23505' && error.constraint?.includes('one_active_per_session')) {
      return new Response(
        JSON.stringify({ error: 'Já existe uma transcrição em andamento para esta sessão.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.error('[TRANSCRIBE] Erro:', error)
    const { message, status } = handleRouteError(error)
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
