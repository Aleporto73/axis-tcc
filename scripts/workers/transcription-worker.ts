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
import { transcribeAudioWithSegments, ASRSegment, ASRResult } from '../../src/services/asr'
import { saveTranscript } from '../../src/services/transcript-storage'
import { postProcessTranscript, buildPreview, POSTPROCESS_VERSION } from '../../src/services/transcript-postprocess'

// ── Configuração ──
const POLL_INTERVAL_MS = 5_000        // 5s entre checks
const HEARTBEAT_INTERVAL_MS = 60_000  // 1 min entre heartbeats
const RECOVERY_CHECK_INTERVAL = 5     // a cada 5 loops, checar jobs travados
const RECOVERY_TIMEOUT_MIN = 20       // job travado = sem heartbeat há 20 min
const FREE_LIMIT_MINUTES = 50

const ASR_HEALTH_URL =
  (process.env.ASR_SERVICE_URL || 'http://localhost:8000').replace(/\/v1\/.*$/, '') + '/health'
const ASR_HEALTH_TIMEOUT_MS = 5_000    // 5s timeout no health check
const ASR_DOWN_ALERT_THRESHOLD = 3     // alertar após 3 checks consecutivos com falha

const WORKER_ID = `worker-${process.pid}-${Date.now()}`
let asrDownCount = 0                   // contador de checks consecutivos com ASR down

// ── Health check do ASR ──
async function checkASRHealth(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ASR_HEALTH_TIMEOUT_MS)
    try {
      const res = await fetch(ASR_HEALTH_URL, { signal: controller.signal })
      if (!res.ok) return false
      const data = (await res.json()) as { status?: string; model_loaded?: boolean }
      return data.status === 'ok' && data.model_loaded === true
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return false
  }
}

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

// ── Helper RLS: contexto de tenant (para tabelas clínicas: transcripts, etc.) ──
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

// ── Helper RLS: contexto de worker (para transcription_jobs cross-tenant) ──
// BACKDOOR RLS ESCOPADO - app.is_worker libera cross-tenant em
// transcription_jobs (policy worker_access, migration 046).
// NAO setar este GUC fora de scripts/workers/.
// Guardrail CI: scripts/ci/check_is_worker_scope.sh.
// Ver docs/audits/validacao_tier0_tier1.md CHECK 4.
async function withWorkerClient<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.is_worker', 'true', true)")
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

// ── Pegar próximo job com lock (via worker context para bypass tenant RLS) ──
// GUARD: se já existe job em processing (mesmo de outro worker/restart),
// não pega novo — ASR é single-thread, 2 requests simultâneos = falha.
async function claimJob(): Promise<any | null> {
  return withWorkerClient(async (client) => {
    // Guard: ASR single-thread — nunca processar 2 jobs ao mesmo tempo
    const processing = await client.query(
      `SELECT id, worker_id, started_at FROM transcription_jobs
       WHERE status = 'processing' LIMIT 1`
    )
    if (processing.rows.length > 0) {
      const p = processing.rows[0]
      console.log(`[WORKER] ASR ocupado — job ${p.id} em processing (worker=${p.worker_id}, started=${p.started_at}). Aguardando.`)
      return null
    }

    const result = await client.query(
      `UPDATE transcription_jobs
       SET status = 'processing',
           started_at = NOW(),
           locked_at = NOW(),
           heartbeat_at = NOW(),
           worker_id = $1
       WHERE id = (
         SELECT id FROM transcription_jobs
         WHERE status = 'pending'
           AND (locked_at IS NULL OR locked_at <= NOW())
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [WORKER_ID]
    )
    return result.rows[0] || null
  })
}

// ── Recovery de jobs travados (via worker context) ──
async function recoverStalledJobs(): Promise<void> {
  await withWorkerClient(async (client) => {
    const result = await client.query(
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
    const failedResult = await client.query(
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
  })
}

// ── Atualizar heartbeat (via worker context) ──
async function updateHeartbeat(jobId: string): Promise<void> {
  await withWorkerClient(async (client) => {
    await client.query(
      'UPDATE transcription_jobs SET heartbeat_at = NOW() WHERE id = $1',
      [jobId]
    )
  })
}

// ── Processar job (hardened: logs em cada etapa, cleanup garantido no finally) ──
async function processJob(job: any): Promise<void> {
  const startTime = Date.now()
  const jid = job.id // shorthand para logs
  let resultado = 'UNKNOWN'

  console.log(`[JOB ${jid}] INÍCIO: tenant=${job.tenant_id} session=${job.session_id} file=${job.original_filename} size=${job.file_size_bytes} attempt=${(job.attempts || 0) + 1}/${job.max_attempts || 3}`)

  // Heartbeat periódico durante processamento
  const heartbeatTimer = setInterval(async () => {
    try {
      await updateHeartbeat(jid)
    } catch (e: any) {
      console.error(`[JOB ${jid}] Erro heartbeat: ${e.message}`)
    }
  }, HEARTBEAT_INTERVAL_MS)

  try {
    // 0. Health check — verificar se ASR está vivo ANTES de processar
    const asrOk = await checkASRHealth()
    if (!asrOk) {
      const backoffMin = Math.max(2, (job.attempts || 0) + 1) * 2
      console.log(`[JOB ${jid}] ASR indisponível — job volta pra fila (backoff ${backoffMin}min, attempts inalterado)`)
      clearInterval(heartbeatTimer)
      await withWorkerClient(async (client) => {
        await client.query(
          `UPDATE transcription_jobs
           SET status = 'pending',
               locked_at = $1,
               worker_id = NULL,
               heartbeat_at = NULL
           WHERE id = $2`,
          [new Date(Date.now() + backoffMin * 60 * 1000), jid]
        )
      })
      resultado = 'ASR_UNAVAILABLE'
      return
    }

    // 1. Ler áudio do disco
    console.log(`[JOB ${jid}] Lendo áudio do disco...`)
    const audioBuffer = await readFile(job.audio_path)
    console.log(`[JOB ${jid}] Áudio lido: ${audioBuffer.length} bytes`)

    // 2. Transcrever via ASR (verbose_json — retorna text + segments)
    console.log(`[JOB ${jid}] Chamando ASR (verbose_json)...`)
    let asrResult: ASRResult
    try {
      asrResult = await transcribeAudioWithSegments(audioBuffer, job.original_filename || 'audio.webm')
    } catch (asrErr: any) {
      console.error(`[JOB ${jid}] ASR ERRO: ${asrErr.message}`)
      throw asrErr
    }
    const text = asrResult.text
    const asrSegments = asrResult.segments
    console.log(`[JOB ${jid}] ASR retornou: ${text.length} chars, ${asrSegments.length} segments`)
    if (text.length > 0) {
      console.log(`[JOB ${jid}] ASR text preview: "${text.slice(0, 200)}"`)
    }

    if (!text || text.trim().length === 0) {
      console.error(`[JOB ${jid}] ERRO: text vazio. segments=${asrSegments.length}`)
      throw new Error('Transcrição retornou vazia')
    }

    // 3. Pós-processamento: raw_text → final_text
    const transcriptId = randomUUID()
    const rawText = text
    console.log(`[JOB ${jid}] Pós-processando (pipeline ${POSTPROCESS_VERSION})...`)
    const finalText = postProcessTranscript(rawText)
    console.log(`[JOB ${jid}] Pós-processado: raw=${rawText.length} chars, final=${finalText.length} chars`)

    // 4. Salvar ambas versões em disco
    console.log(`[JOB ${jid}] Salvando transcripts no disco...`)
    const rawPath = await saveTranscript(job.tenant_id, `${transcriptId}.raw`, rawText)
    const finalPath = await saveTranscript(job.tenant_id, `${transcriptId}.final`, finalText)
    // transcript_path = final_path (compatibilidade com leitura legada)
    const transcriptPath = finalPath
    console.log(`[JOB ${jid}] Arquivos salvos: raw=${rawPath} final=${finalPath}`)

    // 5. INSERT no banco (com RLS tenant)
    // Fase 13.1: audio_duration_seconds = end do ultimo segment do ASR (fonte de verdade)
    const audioDurationSeconds: number | null = asrSegments.length > 0
      ? Number(asrSegments[asrSegments.length - 1].end.toFixed(3))
      : null
    console.log(`[JOB ${jid}] Inserindo no banco... (audio_duration=${audioDurationSeconds}s)`)
    await withTenantClient(job.tenant_id, async (client) => {
      await client.query(
        `INSERT INTO transcripts
         (id, tenant_id, patient_id, session_id, session_date,
          transcript_path, raw_path, final_path,
          text_preview, char_count, char_count_raw, char_count_final,
          postprocess_version, asr_model, audio_duration_seconds, processed)
         VALUES ($1, $2, $3, $4, CURRENT_DATE,
                 $5, $6, $7,
                 $8, $9, $10, $11,
                 $12, $13, $14, false)`,
        [
          transcriptId, job.tenant_id, job.patient_id, job.session_id,
          transcriptPath, rawPath, finalPath,
          buildPreview(finalText), finalText.length, rawText.length, finalText.length,
          POSTPROCESS_VERSION, 'whisper-1', audioDurationSeconds
        ]
      )

      // 5b. Salvar segments (se existirem) — falha NÃO quebra o job
      console.log(`[JOB ${jid}] Segments a salvar: ${asrSegments.length}`)
      if (asrSegments.length > 0) {
        try {
          // Batch INSERT via unnest — 4 arrays paralelos, seguro contra SQL injection
          const indexes: number[] = []
          const starts: number[] = []
          const ends: number[] = []
          const texts: string[] = []

          for (let i = 0; i < asrSegments.length; i++) {
            indexes.push(i)
            starts.push(asrSegments[i].start)
            ends.push(asrSegments[i].end)
            texts.push(asrSegments[i].text)
          }

          await client.query(
            `INSERT INTO transcript_segments
               (id, transcript_id, tenant_id, segment_index, start_seconds, end_seconds, text)
             SELECT
               gen_random_uuid(),
               $1::uuid,
               $2::uuid,
               idx,
               s,
               e,
               t
             FROM unnest($3::int[], $4::numeric[], $5::numeric[], $6::text[])
               AS x(idx, s, e, t)`,
            [transcriptId, job.tenant_id, indexes, starts, ends, texts]
          )
          console.log(`[JOB ${jid}] ${asrSegments.length} segments salvos`)
        } catch (segErr: any) {
          // Falha nos segments NÃO deve quebrar o job — log e continua
          console.error(`[JOB ${jid}] WARN: Erro ao salvar segments (job continua): ${segErr.message}`)
        }
      }

      // Incrementar uso para FREE
      const licenseRes = await client.query(
        `SELECT hotmart_plan FROM user_licenses
         WHERE tenant_id = $1 AND product_type = 'tcc' AND is_active = true LIMIT 1`,
        [job.tenant_id]
      )
      const isFree = !licenseRes.rows[0]?.hotmart_plan || licenseRes.rows[0].hotmart_plan === ''

      if (isFree) {
        const month = new Date().toISOString().slice(0, 7)
        // Fase 13.1: duracao real do ASR > estimativa por tamanho (bitrate 64kbps era impreciso)
        const realMinutes = audioDurationSeconds !== null && audioDurationSeconds > 0
          ? Math.max(1, Math.ceil(audioDurationSeconds / 60))
          : Math.max(1, Math.ceil((job.file_size_bytes || 0) / (64 * 1024 / 8 * 60)))  // fallback seguro
        await client.query(
          `INSERT INTO transcription_usage (tenant_id, month, minutes_used, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (tenant_id, month)
           DO UPDATE SET minutes_used = transcription_usage.minutes_used + $3, updated_at = NOW()`,
          [job.tenant_id, month, realMinutes]
        )
        console.log(`[JOB ${jid}] Uso FREE incrementado: ${realMinutes} min (audio=${audioDurationSeconds}s, fallback=${audioDurationSeconds === null})`)
      }
    })
    console.log(`[JOB ${jid}] INSERT ok: transcript_id=${transcriptId}`)

    // 5. Marcar job como completed
    console.log(`[JOB ${jid}] Marcando completed...`)
    try {
      await withWorkerClient(async (client) => {
        await client.query(
          `UPDATE transcription_jobs
           SET status = 'completed',
               progress = 100,
               transcript_id = $1,
               finished_at = NOW(),
               locked_at = NULL,
               worker_id = NULL,
               heartbeat_at = NULL
           WHERE id = $2`,
          [transcriptId, jid]
        )
      })
    } catch (updateErr: any) {
      console.error(`[JOB ${jid}] ERRO ao marcar completed no banco: ${updateErr.message}`)
      // Não re-throw: o transcript já foi salvo, recovery vai tratar
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    resultado = 'COMPLETED'
    console.log(`[JOB ${jid}] COMPLETED em ${duration}s (${text.length} chars)`)

  } catch (error: any) {
    console.error(`[JOB ${jid}] ERRO: ${error.message}`, error.cause ? `| Cause: ${JSON.stringify(error.cause)}` : '', error.stack || '')

    const newAttempts = (job.attempts || 0) + 1
    const isFinal = newAttempts >= (job.max_attempts || 3)

    // Backoff: 2min × attempts (2min, 4min, 6min) — dá tempo do ASR terminar
    const backoffMinutes = isFinal ? 0 : newAttempts * 2

    try {
      await withWorkerClient(async (client) => {
        await client.query(
          `UPDATE transcription_jobs
           SET status = $1,
               error_message = $2,
               attempts = $3,
               finished_at = $4,
               locked_at = $5,
               worker_id = NULL,
               heartbeat_at = NULL
           WHERE id = $6`,
          [
            isFinal ? 'failed' : 'pending',
            [
              error.message || 'Erro desconhecido',
              error.cause ? `Cause: ${JSON.stringify(error.cause)}` : '',
              error.stack ? `Stack: ${error.stack.slice(0, 800)}` : '',
            ].filter(Boolean).join('\n\n').slice(0, 2000),
            newAttempts,
            isFinal ? new Date() : null,
            // Backoff: locked_at no futuro impede claimJob de pegar antes da hora
            isFinal ? null : new Date(Date.now() + backoffMinutes * 60 * 1000),
            jid,
          ]
        )
      })
    } catch (updateErr: any) {
      console.error(`[JOB ${jid}] ERRO CRÍTICO ao atualizar status no banco: ${updateErr.message}`)
      // finally vai fazer cleanup de segurança
    }

    if (isFinal) {
      resultado = 'FAILED'
      console.log(`[JOB ${jid}] FAILED definitivo após ${newAttempts} tentativas: ${error.message}`)
    } else {
      resultado = 'RETRY'
      console.log(`[JOB ${jid}] RETRY (tentativa ${newAttempts}/${job.max_attempts || 3}, backoff ${backoffMinutes}min): ${error.message}`)
    }

  } finally {
    // CLEANUP GARANTIDO — mesmo se catch falhar
    clearInterval(heartbeatTimer)

    // Safety net: limpar lock fields se job ainda estiver em processing
    // (pode acontecer se o UPDATE do catch ou do try falhou)
    try {
      await withWorkerClient(async (client) => {
        await client.query(
          `UPDATE transcription_jobs
           SET locked_at = NULL, worker_id = NULL, heartbeat_at = NULL
           WHERE id = $1 AND status = 'processing'`,
          [jid]
        )
      })
    } catch (cleanupErr: any) {
      console.error(`[JOB ${jid}] ERRO no cleanup de segurança: ${cleanupErr.message}`)
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[JOB ${jid}] FIM: ${resultado} (${totalDuration}s total)`)
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

      // Recovery periódico + health check do ASR
      if (loopCount % RECOVERY_CHECK_INTERVAL === 0) {
        await recoverStalledJobs()

        // Health check periódico do ASR
        const healthy = await checkASRHealth()
        if (!healthy) {
          asrDownCount++
          console.log(`[WORKER] ASR health check FALHOU (${asrDownCount}/${ASR_DOWN_ALERT_THRESHOLD} consecutivos)`)
          if (asrDownCount >= ASR_DOWN_ALERT_THRESHOLD) {
            console.error(`[WORKER] ALERTA: ASR down há mais de ${ASR_DOWN_ALERT_THRESHOLD * RECOVERY_CHECK_INTERVAL * POLL_INTERVAL_MS / 60000} minutos — verificar container asr-service`)
          }
        } else if (asrDownCount > 0) {
          console.log(`[WORKER] ASR recuperado após ${asrDownCount} checks com falha`)
          asrDownCount = 0
        }
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
