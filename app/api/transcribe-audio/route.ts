import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { getTranscriptionUsage } from '@/src/services/transcription-limit'
import { rateLimit } from '@/src/middleware/rate-limit'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Limite OpenAI Whisper API: 25MB por request
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

// Estimativa conservadora de duração a partir do tamanho (bitrate 64kbps)
// Mesma convenção do fallback em scripts/workers/transcription-worker.ts
const BYTES_PER_MINUTE_64KBPS = 64 * 1024 / 8 * 60  // 491520 bytes/min

// Rate limit: 10 req/min por IP — cada request consome quota OpenAI
const TRANSCRIBE_AUDIO_RATE_LIMIT = { limit: 10, windowMs: 60_000, prefix: 'transcribe-audio' }

/**
 * POST /api/transcribe-audio
 *
 * Transcricao SINCRONA via OpenAI Whisper para fluxo de "Registro Clinico Assistido"
 * em app/pacientes/[id] (modal opcional, paciente sem clinical_record ainda).
 *
 * Governanca (Onda 4 — 2026-04-24):
 *   - withTenant (tenant resolvido via cookie/profile)
 *   - Rate limit 10 req/min por IP
 *   - Gate de cota FREE: FREE_LIMIT_MINUTES lifetime via transcription_usage
 *   - Body size cap: 25MB (limite OpenAI)
 *   - Incrementa transcription_usage apos sucesso (estimativa por tamanho)
 *
 * TODO (Onda futura):
 *   - Migrar OpenAI Whisper -> faster-whisper local (mesma infra do worker)
 *   - Alinhar /api/analyze-clinical (proxima chamada do fluxo) com mesma governanca
 *   - Backport da interpolacao ${usage.limit} para /api/transcribe (Onda 7)
 *
 * Ver docs/audits/cc_auditoria_v1.md H-3
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit por IP (antes de abrir conexao DB)
    const blocked = await rateLimit(request, TRANSCRIBE_AUDIO_RATE_LIMIT)
    if (blocked) return blocked

    return await withTenant(async (ctx) => {
      // 1) Gate de cota (lifetime, compartilhado com /api/transcribe)
      const usage = await getTranscriptionUsage(ctx.client, ctx.tenantId)
      if (usage.limit_reached) {
        return NextResponse.json({
          error: 'LIMIT_REACHED',
          message: `Voce atingiu o limite gratuito de ${usage.limit} minutos de transcricao.`,
          minutes_used: usage.minutes_used,
          limit: usage.limit,
        }, { status: 402 })
      }

      // 2) Validar FormData
      const formData = await request.formData()
      const audioFile = formData.get('audio') as File
      if (!audioFile) {
        return NextResponse.json({ error: 'Arquivo de áudio obrigatório' }, { status: 400 })
      }

      // 3) Body size cap (limite OpenAI Whisper API: 25MB)
      if (audioFile.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({
          error: 'FILE_TOO_LARGE',
          message: 'Áudio excede 25MB. Grave em partes menores.',
          max_bytes: MAX_UPLOAD_BYTES,
          received_bytes: audioFile.size,
        }, { status: 413 })
      }

      // 4) Chamar OpenAI Whisper (sincrono — contrato preservado para UX atual)
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text',
        prompt: 'cognicao, comportamento, emocao, ansiedade, depressao, TDAH, TCC, trauma, intervencao, psicoterapia, terapeuta, paciente',
      })

      // 5) Incrementar transcription_usage (estimativa por tamanho, fallback conservador)
      const estimatedMinutes = Math.max(1, Math.ceil(audioFile.size / BYTES_PER_MINUTE_64KBPS))
      const month = new Date().toISOString().slice(0, 7)
      await ctx.client.query(
        `INSERT INTO transcription_usage (tenant_id, month, minutes_used, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (tenant_id, month)
         DO UPDATE SET minutes_used = transcription_usage.minutes_used + $3, updated_at = NOW()`,
        [ctx.tenantId, month, estimatedMinutes]
      )

      // 6) Resposta (formato preservado: { success, text })
      return NextResponse.json({
        success: true,
        text: transcription,
      })
    })
  } catch (error: any) {
    console.error('[TRANSCRIBE-AUDIO] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
