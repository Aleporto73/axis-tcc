import { NextRequest } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { getTranscriptionUsage } from '@/src/services/transcription-limit'
import { env } from '@/src/lib/env'

const AUDIO_UPLOAD_DIR = env.AUDIO_UPLOAD_DIR || '/var/lib/axis/audio-uploads'

/**
 * POST /api/transcribe
 *
 * Fluxo assincrono:
 * 1. Auth + validar tenant (via withTenant)
 * 2. Checar limite FREE acumulado (300 min lifetime - Fase 12.2)
 * 3. Salvar audio em disco
 * 4. Criar job pending em transcription_jobs
 * 5. Responder imediatamente com job_id
 *
 * NAO chama ASR. NAO espera transcricao. O worker faz isso.
 */
export async function POST(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      // -- VERIFICAR LIMITE (Fase 12.2: acumulado, nao mensal) --
      const usage = await getTranscriptionUsage(ctx.client, ctx.tenantId)

      if (usage.limit_reached) {
        console.log('[TRANSCRIBE] Limite atingido:', {
          tenantId: ctx.tenantId,
          minutesUsed: usage.minutes_used,
          limit: usage.limit,
        })
        return new Response(JSON.stringify({
          error: 'LIMIT_REACHED',
          message: 'Voce atingiu o limite gratuito de 300 minutos de transcricao.',
          minutes_used: usage.minutes_used,
          limit: usage.limit,
        }), { status: 402, headers: { 'Content-Type': 'application/json' } })
      }

      // -- VALIDAR FORM DATA --
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

      // -- SALVAR AUDIO EM DISCO --
      const jobId = randomUUID()
      const ext = path.extname(audioFile.name || 'audio.webm') || '.webm'
      const audioDir = path.join(AUDIO_UPLOAD_DIR, ctx.tenantId)
      await mkdir(audioDir, { recursive: true })
      const audioPath = path.join(audioDir, `${jobId}${ext}`)

      const arrayBuffer = await audioFile.arrayBuffer()
      await writeFile(audioPath, Buffer.from(arrayBuffer))

      console.log('[TRANSCRIBE] Audio salvo:', { jobId, audioPath, size: audioFile.size })

      // -- CRIAR JOB (dentro da transacao do withTenant, com RLS ativo) --
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
    // Unique index violation = ja existe job ativo para esta sessao
    if (error.code === '23505' && error.constraint?.includes('one_active_per_session')) {
      return new Response(
        JSON.stringify({ error: 'Ja existe uma transcricao em andamento para esta sessao.' }),
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
