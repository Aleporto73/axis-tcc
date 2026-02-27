import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import OpenAI from 'openai'
import pkg from 'pg'
import { writeFile, unlink, mkdir, readFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import path from 'path'

const { Pool } = pkg
const execAsync = promisify(exec)

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'axis_tcc',
  user: 'axis',
  password: 'AxisTcc2026!',
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const CHUNK_DURATION = 300
const MAX_DIRECT_SIZE = 5 * 1024 * 1024
const TEMP_DIR = '/tmp/axis-audio'

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

async function splitAudio(inputPath: string, sessionId: string): Promise<string[]> {
  const duration = await getAudioDuration(inputPath)
  const chunks: string[] = []

  if (duration <= CHUNK_DURATION) {
    return [inputPath]
  }

  const numChunks = Math.ceil(duration / CHUNK_DURATION)
  for (let i = 0; i < numChunks; i++) {
    const startTime = i * CHUNK_DURATION
    const chunkPath = path.join(TEMP_DIR, sessionId + '_chunk_' + i + '.mp3')

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

async function transcribeChunk(filePath: string, chunkIndex: number): Promise<string> {
  try {
    const fileBuffer = await readFile(filePath)
    const file = new File([fileBuffer], 'parte_' + chunkIndex + '.mp3', { type: 'audio/mpeg' })

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'pt',
      response_format: 'text',
      prompt: 'Transcricao de sessao de psicoterapia TCC. Termos: cognicao, comportamento, emocao, ansiedade, depressao, TDAH, trauma, psicoterapia, terapeuta, paciente.',
    })

    return transcription as unknown as string
  } catch (error) {
    console.error('[TRANSCRIBE] Erro ao transcrever parte ' + chunkIndex + ':', error)
    return ''
  }
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

export async function POST(request: NextRequest) {
  const filesToCleanup: string[] = []

  try {
    const { userId } = await auth()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Nao autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )

    if (tenantResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Tenant nao encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const tenantId = tenantResult.rows[0].id

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
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text',
      })

      const fullTranscription = transcription as unknown as string

      if (!fullTranscription || fullTranscription.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Transcricao vazia - verifique o audio' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }

      const result = await pool.query(
        'INSERT INTO transcripts (tenant_id, patient_id, session_id, session_date, text, processed) VALUES ($1, $2, $3, CURRENT_DATE, $4, false) RETURNING id, text, created_at',
        [tenantId, patientId, sessionId, fullTranscription]
      )

      return new Response(JSON.stringify({ success: true, transcript: result.rows[0] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // Audio grande - divide em partes e envia progresso via streaming
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sendProgress = (data: object) => {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify(data) + '\n\n'))
        }

        try {
          sendProgress({ type: 'status', message: 'Preparando audio...' })

          await ensureTempDir()

          const tempInputPath = path.join(TEMP_DIR, sessionId + '_input_' + Date.now() + '.mp3')
          const arrayBuffer = await audioFile.arrayBuffer()
          await writeFile(tempInputPath, Buffer.from(arrayBuffer))
          filesToCleanup.push(tempInputPath)

          sendProgress({ type: 'status', message: 'Dividindo audio em partes...' })

          const chunkPaths = await splitAudio(tempInputPath, sessionId)
          const totalChunks = chunkPaths.length

          for (const cp of chunkPaths) {
            if (cp !== tempInputPath) {
              filesToCleanup.push(cp)
            }
          }

          const transcriptions: string[] = []

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
            }
          }

          const fullTranscription = transcriptions.join(' ')

          if (!fullTranscription || fullTranscription.trim().length === 0) {
            sendProgress({ type: 'error', message: 'Transcricao vazia - verifique o audio' })
            controller.close()
            return
          }

          sendProgress({ type: 'status', message: 'Salvando transcricao...', percent: 95 })

          const result = await pool.query(
            'INSERT INTO transcripts (tenant_id, patient_id, session_id, session_date, text, processed) VALUES ($1, $2, $3, CURRENT_DATE, $4, false) RETURNING id, text, created_at',
            [tenantId, patientId, sessionId, fullTranscription]
          )

          sendProgress({
            type: 'done',
            percent: 100,
            message: 'Transcricao concluida!',
            transcript: result.rows[0]
          })

          controller.close()
        } catch (error) {
          console.error('[TRANSCRIBE] Erro ao transcrever:', error)
          sendProgress({ type: 'error', message: 'Erro ao transcrever audio' })
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

  } catch (error) {
    console.error('[TRANSCRIBE] Erro ao transcrever:', error)
    await cleanupFiles(filesToCleanup)
    return new Response(JSON.stringify({ error: 'Erro ao transcrever audio' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
