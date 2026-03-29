import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'
import { PoolClient } from 'pg'
import { writeFile, unlink, mkdir, readFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

// ── ASR Local (faster-whisper via Docker) ──
const ASR_URL = process.env.ASR_SERVICE_URL || 'http://localhost:8000/v1/audio/transcriptions'

async function transcribeLocal(audioFile: File | Buffer, filename: string = 'audio.mp3'): Promise<string> {
  const formData = new FormData()
  let blob: Blob
  if (Buffer.isBuffer(audioFile)) {
    blob = new Blob([new Uint8Array(audioFile)], { type: 'audio/mpeg' })
  } else {
    blob = audioFile as Blob
  }
  formData.append('file', blob, filename)
  formData.append('language', 'pt')
  const abortCtl = new AbortController()
  const timeout = setTimeout(() => abortCtl.abort(), 30 * 60 * 1000)
  const response = await fetch(ASR_URL, {
    method: 'POST',
    body: formData,
    signal: abortCtl.signal,
  })
  clearTimeout(timeout)
  if (!response.ok) {
    throw new Error(`ASR Service erro: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  return data.text || ''
}

const CHUNK_DURATION = 300
const MAX_DIRECT_SIZE = 5 * 1024 * 1024
const TEMP_DIR = '/tmp/axis-audio'
const FREE_LIMIT_MINUTES = 50  // 1 sessão demo para FREE

async function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true })
  }
}

async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    )
    return parseFloat(stdout.trim()) || 0
  } catch (error) {
    console.error('[TRANSCRIBE] Erro ao obter duracao:', error)
    return 0
  }
}

async function splitAudio(inputPath: string, jobId: string): Promise<string[]> {
  const duration = await getAudioDuration(inputPath)
  const chunks: string[] = []

  if (duration <= CHUNK_DURATION) {
    return [inputPath]
  }

  const numChunks = Math.ceil(duration / CHUNK_DURATION)
  for (let i = 0; i < numChunks; i++) {
    const startTime = i * CHUNK_DURATION
    const chunkPath = path.join(TEMP_DIR, jobId + '_chunk_' + i + '.mp3')

    try {
      await execAsync(
        'ffmpeg -y -i "' + inputPath + '" -ss ' + startTime + ' -t ' + CHUNK_DURATION + ' -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k "' + chunkPath + '" 2>/dev/null'
      )
      chunks.push(chunkPath)
    } catch (error) {
      console.error('[TRANSCRIBE] Erro ao criar parte ' + i + ':', error)
    }
  }

  return chunks
}

async function transcribeChunk(filePath: string, chunkIndex: number, maxRetries: number = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileBuffer = await readFile(filePath)
      const text = await transcribeLocal(Buffer.from(fileBuffer), 'parte_' + chunkIndex + '.mp3')
      return text
    } catch (error) {
      console.error(`[TRANSCRIBE] Erro chunk ${chunkIndex}, tentativa ${attempt}/${maxRetries}:`, error)
      if (attempt < maxRetries) {
        const delay = attempt * 2000
        console.log(`[TRANSCRIBE] Aguardando ${delay}ms antes de tentar novamente...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  console.error(`[TRANSCRIBE] FALHA DEFINITIVA chunk ${chunkIndex} apos ${maxRetries} tentativas`)
  return ''
}

async function cleanupFiles(files: string[]) {
  for (const file of files) {
    try {
      if (existsSync(file)) {
        await unlink(file)
      }
    } catch (error) {
      console.error('[TRANSCRIBE] Erro ao limpar arquivo:', file)
    }
  }
}

// ── Helper: executa callback com SET app.tenant_id (RLS) ──
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

// ── Verificar limite de transcrição para FREE ──
async function checkTranscriptionLimit(userId: string): Promise<{
  tenantId: string
  isFree: boolean
  minutesUsed: number
  blocked: boolean
  month: string
}> {
  // Resolver tenant (usa pool direto — queries de lookup por clerk_user_id, sem RLS)
  const profileRes = await pool.query(
    'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
    [userId]
  )
  let tenantId = profileRes.rows[0]?.tenant_id
  if (!tenantId) {
    const tenantRes = await pool.query('SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1', [userId])
    tenantId = tenantRes.rows[0]?.id
  }
  if (!tenantId) throw new Error('TENANT_NOT_FOUND')

  // Verificar licença e uso — com RLS ativo
  return withTenantClient(tenantId, async (client) => {
    const licenseRes = await client.query(
      `SELECT hotmart_plan FROM user_licenses
       WHERE tenant_id = $1 AND product_type = 'tcc' AND is_active = true LIMIT 1`,
      [tenantId]
    )
    const isFree = !licenseRes.rows[0]?.hotmart_plan || licenseRes.rows[0].hotmart_plan === ''

    if (!isFree) {
      return { tenantId, isFree: false, minutesUsed: 0, blocked: false, month: '' }
    }

    const month = new Date().toISOString().slice(0, 7)
    const usageRes = await client.query(
      'SELECT minutes_used FROM transcription_usage WHERE tenant_id = $1 AND month = $2',
      [tenantId, month]
    )
    const minutesUsed = usageRes.rows[0]?.minutes_used || 0

    return {
      tenantId,
      isFree: true,
      minutesUsed,
      blocked: minutesUsed >= FREE_LIMIT_MINUTES,
      month,
    }
  })
}

// ── Incrementar minutos usados (com RLS) ──
async function incrementUsage(tenantId: string, month: string, minutes: number) {
  if (minutes <= 0) return
  await withTenantClient(tenantId, async (client) => {
    await client.query(
      `INSERT INTO transcription_usage (tenant_id, month, minutes_used, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, month)
       DO UPDATE SET minutes_used = transcription_usage.minutes_used + $3, updated_at = NOW()`,
      [tenantId, month, minutes]
    )
    console.log('[TRANSCRIBE] Uso incrementado:', { tenantId, month, minutes })
  })
}

export async function POST(request: NextRequest) {
  const filesToCleanup: string[] = []

  try {
    const { userId } = await auth()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Nao autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    // ── VERIFICAR LIMITE ANTES DE TUDO ──
    let limitInfo: Awaited<ReturnType<typeof checkTranscriptionLimit>>
    try {
      limitInfo = await checkTranscriptionLimit(userId)
    } catch (e: any) {
      if (e.message === 'TENANT_NOT_FOUND') {
        return new Response(JSON.stringify({ error: 'Tenant nao encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
      }
      throw e
    }

    if (limitInfo.blocked) {
      console.log('[TRANSCRIBE] Limite atingido:', { tenantId: limitInfo.tenantId, minutesUsed: limitInfo.minutesUsed })
      return new Response(JSON.stringify({
        error: 'LIMIT_REACHED',
        message: 'Você atingiu o limite de 120 minutos de transcrição gratuita este mês.',
        minutes_used: limitInfo.minutesUsed,
        limit: FREE_LIMIT_MINUTES,
      }), { status: 402, headers: { 'Content-Type': 'application/json' } })
    }

    const tenantId = limitInfo.tenantId

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const sessionId = formData.get('session_id') as string
    const patientId = formData.get('patient_id') as string

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'Arquivo de audio obrigatorio' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    if (!sessionId || !patientId) {
      return new Response(JSON.stringify({ error: 'session_id e patient_id obrigatorios' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const fileSize = audioFile.size

    // Audio pequeno - transcreve direto sem streaming
    if (fileSize <= MAX_DIRECT_SIZE) {
      const fullTranscription = await transcribeLocal(audioFile)

      if (!fullTranscription || fullTranscription.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Transcricao vazia - verifique o audio' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }

      // INSERT + incremento com RLS ativo
      const result = await withTenantClient(tenantId, async (client) => {
        const res = await client.query(
          'INSERT INTO transcripts (tenant_id, patient_id, session_id, session_date, text, processed) VALUES ($1, $2, $3, CURRENT_DATE, $4, false) RETURNING id, text, created_at',
          [tenantId, patientId, sessionId, fullTranscription]
        )

        // ── INCREMENTAR USO (áudio pequeno: estimar ~2 min) ──
        if (limitInfo.isFree) {
          const estimatedMinutes = Math.max(1, Math.ceil(fileSize / (64 * 1024 / 8 * 60)))
          await client.query(
            `INSERT INTO transcription_usage (tenant_id, month, minutes_used, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (tenant_id, month)
             DO UPDATE SET minutes_used = transcription_usage.minutes_used + $3, updated_at = NOW()`,
            [tenantId, limitInfo.month, estimatedMinutes]
          )
          console.log('[TRANSCRIBE] Uso incrementado:', { tenantId, month: limitInfo.month, minutes: estimatedMinutes })
        }

        return res
      })

      return new Response(JSON.stringify({ success: true, transcript: result.rows[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // Audio grande - divide em partes e envia progresso via streaming
    const isFree = limitInfo.isFree
    const month = limitInfo.month

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sendProgress = (data: object) => {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify(data) + '\n\n'))
        }

        try {
          sendProgress({ type: 'status', message: 'Preparando audio...' })

          await ensureTempDir()

          const jobId = `${sessionId}_${Date.now()}`
          const originalName = audioFile.name || 'audio.webm'
          const ext = path.extname(originalName) || '.webm'
          const tempInputPath = path.join(TEMP_DIR, jobId + '_input' + ext)
          const arrayBuffer = await audioFile.arrayBuffer()
          await writeFile(tempInputPath, Buffer.from(arrayBuffer))
          filesToCleanup.push(tempInputPath)

          sendProgress({ type: 'status', message: 'Dividindo audio em partes...' })

          // ── OBTER DURAÇÃO REAL DO ÁUDIO ──
          const totalDuration = await getAudioDuration(tempInputPath)
          const durationMinutes = Math.ceil(totalDuration / 60)

          // ── VERIFICAR SE DURAÇÃO EXCEDE LIMITE RESTANTE ──
          if (isFree) {
            const remaining = FREE_LIMIT_MINUTES - limitInfo.minutesUsed
            if (durationMinutes > remaining + 5) {
              // Margem de 5 min pra não frustrar por arredondamento
              sendProgress({
                type: 'warning',
                message: `Este áudio tem ~${durationMinutes} min. Você tem ${remaining} min restantes no plano FREE.`,
              })
            }
          }

          const chunkPaths = await splitAudio(tempInputPath, jobId)
          const totalChunks = chunkPaths.length

          for (const cp of chunkPaths) {
            if (cp !== tempInputPath) {
              filesToCleanup.push(cp)
            }
          }

          const transcriptions: string[] = []
          let failedChunks = 0

          for (let i = 0; i < totalChunks; i++) {
            const percent = Math.round(((i) / totalChunks) * 100)
            const remaining = totalChunks - i
            const minutesLeft = Math.ceil(remaining * 0.25)

            sendProgress({
              type: 'progress',
              current: i + 1,
              total: totalChunks,
              percent: percent,
              minutesLeft: minutesLeft,
              message: 'Transcrevendo parte ' + (i + 1) + ' de ' + totalChunks + '...'
            })

            const text = await transcribeChunk(chunkPaths[i], i)
            if (text) {
              transcriptions.push(text)
            } else {
              failedChunks++
            }
          }

          if (failedChunks > 0) {
            sendProgress({
              type: 'status',
              message: `Atenção: ${failedChunks} de ${totalChunks} partes não foram transcritas. O texto pode estar incompleto.`,
              percent: 90
            })
          }

          const fullTranscription = transcriptions.join(' ')

          if (!fullTranscription || fullTranscription.trim().length === 0) {
            sendProgress({ type: 'error', message: 'Transcricao vazia - verifique o audio' })
            controller.close()
            return
          }

          sendProgress({ type: 'status', message: 'Salvando transcricao...', percent: 95 })

          // INSERT + incremento com RLS ativo
          const result = await withTenantClient(tenantId, async (client) => {
            const res = await client.query(
              'INSERT INTO transcripts (tenant_id, patient_id, session_id, session_date, text, processed) VALUES ($1, $2, $3, CURRENT_DATE, $4, false) RETURNING id, text, created_at',
              [tenantId, patientId, sessionId, fullTranscription]
            )

            // ── INCREMENTAR USO (áudio grande: duração real) ──
            if (isFree && durationMinutes > 0) {
              await client.query(
                `INSERT INTO transcription_usage (tenant_id, month, minutes_used, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (tenant_id, month)
                 DO UPDATE SET minutes_used = transcription_usage.minutes_used + $3, updated_at = NOW()`,
                [tenantId, month, durationMinutes]
              )
              console.log('[TRANSCRIBE] Uso incrementado:', { tenantId, month, minutes: durationMinutes })
            }

            return res
          })

          sendProgress({
            type: 'done',
            percent: 100,
            message: 'Transcricao concluida!',
            transcript: result.rows[0]
          })

          controller.close()
        } catch (error: any) {
          console.error('[TRANSCRIBE] Erro ao transcrever:', error)
          const msg = error?.message?.includes('ASR Service')
            ? 'Serviço de transcrição indisponível. Verifique se o ASR está rodando.'
            : 'Erro ao transcrever audio'
          sendProgress({ type: 'error', message: msg })
          controller.close()
        } finally {
          await cleanupFiles(filesToCleanup)
        }
      }
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error: any) {
    console.error('[TRANSCRIBE] Erro ao transcrever:', error)
    await cleanupFiles(filesToCleanup)

    // Erro claro se o serviço ASR estiver fora
    const msg = error?.message?.includes('ASR Service')
      ? 'Serviço de transcrição indisponível. Verifique se o ASR está rodando.'
      : 'Erro ao transcrever audio'

    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
