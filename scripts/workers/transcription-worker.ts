/**
 * AXIS TCC — Worker de Transcrição
 *
 * Processo separado que roda via PM2 (axis-worker-transcribe).
 * Busca jobs pending em transcription_jobs, transcreve via ASR local,
 * salva resultado em disco + banco.
 *
 * Uso: npx tsx scripts/workers/transcription-worker.ts
 */

import 'dotenv/config'
import { randomUUID } from 'crypto'
import { Pool, PoolClient } from 'pg'
import { readFile } from 'fs/promises'
import { transcribeAudio } from '../../src/services/asr'
import { saveTranscript, getPreview } from '../../src/services/transcript-storage'

// ── Configuração ──
const POLL_INTERVAL_MS = 5_000        // 5s entre checks
const HEARTBEAT_INTERVAL_MS = 60_000  // 1 min entre heartbeats
const RECOVERY_CHECK_INTERVAL = 5     // a cada 5 loops, checar jobs travados
const RECOVERY_TIMEOUT_MIN = 20       // job travado = sem heartbeat há 20 min
const FREE_LIMIT_MINUTES = 50

const WORKER_ID = `worker-${process.pid}-${Date.now()}`

// ── Pool do banco (separado do Next.js) ──
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER || 'axis',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'axis_tcc',
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('[WORKER] Pool error:', err.message)
})

// ── Helper RLS ──
async function withTenantClient<T>(
  tenantId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// ── Pegar próximo job com lock ──
async function claimJob(): Promise<any | null> {
  const result = await pool.query(
    `UPDATE transcription_jobs
     SET status = 'processing',
         started_at = NOW(),
         locked_at = NOW(),
         heartbeat_at = NOW(),
         worker_id = $1
     WHERE id = (
       SELECT id FROM transcription_jobs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [WORKER_ID]
  )
  return result.rows[0] || null
}

// ── Recovery de jobs travados ──
async function recoverStalledJobs(): Promise<void> {
  const result = await pool.query(
    `UPDATE transcription_jobs
     SET status = 'pending',
         locked_at = NULL,
         worker_id = NULL,
         heartbeat_at = NULL,
         attempts = attempts + 1
     WHERE status = 'processing'
       AND heartbeat_at < NOW() - INTERVAL '${RECOVERY_TIMEOUT_MIN} minutes'
       AND attempts < max_attempts
     RETURNING id, attempts`
  )

  for (const row of result.rows) {
    console.log(`[WORKER] Job travado recuperado: ${row.id} (tentativa ${row.attempts})`)
  }

  // Marcar como failed jobs que excederam max_attempts
  const failedResult = await pool.query(
    `UPDATE transcription_jobs
     SET status = 'failed',
         error_message = 'Excedeu número máximo de tentativas',
         finished_at = NOW(),
         locked_at = NULL,
         worker_id = NULL,
         heartbeat_at = NULL
     WHERE status = 'processing'
       AND heartbeat_at < NOW() - INTERVAL '${RECOVERY_TIMEOUT_MIN} minutes'
       AND attempts >= max_attempts
     RETURNING id`
  )

  for (const row of failedResult.rows) {
    console.log(`[WORKER] Job marcado como failed (max attempts): ${row.id}`)
  }
}

// ── Atualizar heartbeat ──
async function updateHeartbeat(jobId: string): Promise<void> {
  await pool.query(
    'UPDATE transcription_jobs SET heartbeat_at = NOW() WHERE id = $1',
    [jobId]
  )
}

// ── Processar job ──
async function processJob(job: any): Promise<void> {
  const startTime = Date.now()
  console.log(`[WORKER] Processando job ${job.id}:`, {
    tenant: job.tenant_id,
    session: job.session_id,
    file: job.original_filename,
    size: job.file_size_bytes,
    attempt: job.attempts + 1,
  })

  // Heartbeat periódico durante processamento
  const heartbeatTimer = setInterval(async () => {
    try {
      await updateHeartbeat(job.id)
    } catch (e) {
      console.error(`[WORKER] Erro heartbeat job ${job.id}:`, e)
    }
  }, HEARTBEAT_INTERVAL_MS)

  try {
    // 1. Ler áudio do disco
    const audioBuffer = await readFile(job.audio_path)

    // 2. Transcrever via ASR
    const text = await transcribeAudio(audioBuffer, job.original_filename || 'audio.webm')

    if (!text || text.trim().length === 0) {
      throw new Error('Transcrição retornou vazia')
    }

    // 3. Salvar transcript em disco + banco (com RLS)
    const transcriptId = randomUUID()

    // Salvar .txt em disco ANTES do INSERT — assim o path já nasce correto
    const transcriptPath = await saveTranscript(job.tenant_id, transcriptId, text)

    const transcriptResult = await withTenantClient(job.tenant_id, async (client) => {
      // INSERT transcript já com id, path e preview corretos
      await client.query(
        `INSERT INTO transcripts
         (id, tenant_id, patient_id, session_id, session_date, transcript_path, text_preview, char_count, processed)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, false)`,
        [transcriptId, job.tenant_id, job.patient_id, job.session_id, transcriptPath, getPreview(text), text.length]
      )

      // Incrementar uso para FREE
      const licenseRes = await client.query(
        `SELECT hotmart_plan FROM user_licenses
         WHERE tenant_id = $1 AND product_type = 'tcc' AND is_active = true LIMIT 1`,
        [job.tenant_id]
      )
      const isFree = !licenseRes.rows[0]?.hotmart_plan || licenseRes.rows[0].hotmart_plan === ''

      if (isFree) {
        const month = new Date().toISOString().slice(0, 7)
        const estimatedMinutes = Math.max(1, Math.ceil((job.file_size_bytes || 0) / (64 * 1024 / 8 * 60)))
        await client.query(
          `INSERT INTO transcription_usage (tenant_id, month, minutes_used, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (tenant_id, month)
           DO UPDATE SET minutes_used = transcription_usage.minutes_used + $3, updated_at = NOW()`,
          [job.tenant_id, month, estimatedMinutes]
        )
        console.log(`[WORKER] Uso incrementado: ${estimatedMinutes} min (${month})`)
      }

      return { transcriptId }
    })

    // 4. Marcar job como completed + limpar lock
    await pool.query(
      `UPDATE transcription_jobs
       SET status = 'completed',
           progress = 100,
           transcript_id = $1,
           finished_at = NOW(),
           locked_at = NULL,
           worker_id = NULL,
           heartbeat_at = NULL
       WHERE id = $2`,
      [transcriptResult.transcriptId, job.id]
    )

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[WORKER] Job ${job.id} concluído em ${duration}s (${text.length} chars)`)

  } catch (error: any) {
    console.error(`[WORKER] Erro job ${job.id}:`, error.message)

    const newAttempts = (job.attempts || 0) + 1
    const isFinal = newAttempts >= (job.max_attempts || 3)

    await pool.query(
      `UPDATE transcription_jobs
       SET status = $1,
           error_message = $2,
           attempts = $3,
           finished_at = $4,
           locked_at = NULL,
           worker_id = NULL,
           heartbeat_at = NULL
       WHERE id = $5`,
      [
        isFinal ? 'failed' : 'pending',
        error.message?.slice(0, 500) || 'Erro desconhecido',
        newAttempts,
        isFinal ? new Date() : null,
        job.id,
      ]
    )

    if (isFinal) {
      console.log(`[WORKER] Job ${job.id} FAILED definitivamente após ${newAttempts} tentativas`)
    } else {
      console.log(`[WORKER] Job ${job.id} voltou para pending (tentativa ${newAttempts}/${job.max_attempts})`)
    }
  } finally {
    clearInterval(heartbeatTimer)
  }
}

// ── Loop principal ──
async function main(): Promise<void> {
  console.log(`[WORKER] Iniciando worker de transcrição: ${WORKER_ID}`)
  console.log(`[WORKER] Polling: ${POLL_INTERVAL_MS}ms | Heartbeat: ${HEARTBEAT_INTERVAL_MS}ms | Recovery: ${RECOVERY_TIMEOUT_MIN}min`)

  let loopCount = 0

  while (true) {
    try {
      loopCount++

      // Recovery periódico
      if (loopCount % RECOVERY_CHECK_INTERVAL === 0) {
        await recoverStalledJobs()
      }

      // Tentar pegar um job
      const job = await claimJob()

      if (job) {
        await processJob(job)
        // Não esperar se processou — pode ter mais jobs na fila
        continue
      }

      // Sem jobs — esperar
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

    } catch (error: any) {
      console.error('[WORKER] Erro no loop:', error.message)
      // Esperar antes de tentar de novo após erro inesperado
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS * 2))
    }
  }
}

// ── Graceful shutdown ──
process.on('SIGTERM', async () => {
  console.log('[WORKER] Recebido SIGTERM, encerrando...')
  await pool.end()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[WORKER] Recebido SIGINT, encerrando...')
  await pool.end()
  process.exit(0)
})

main().catch((err) => {
  console.error('[WORKER] Erro fatal:', err)
  process.exit(1)
})
