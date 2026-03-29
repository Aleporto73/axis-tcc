import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'
import { PoolClient } from 'pg'
import { Agent } from 'undici'

// ── ASR Local (faster-whisper via Docker) ──
const ASR_URL = process.env.ASR_SERVICE_URL || 'http://localhost:8000/v1/audio/transcriptions'
const FREE_LIMIT_MINUTES = 50  // 1 sessão demo para FREE

// ── Transcrição via ASR local (undici Agent com timeout de 30 min) ──
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

  const dispatcher = new Agent({
    headersTimeout: 30 * 60 * 1000,
    bodyTimeout: 30 * 60 * 1000,
  })

  const response = await fetch(ASR_URL, {
    method: 'POST',
    body: formData,
    // @ts-expect-error Node.js undici dispatcher
    dispatcher,
  })

  if (!response.ok) {
    throw new Error(`ASR Service erro: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  return data.text || ''
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
        message: 'Você atingiu o limite de transcrição gratuita este mês.',
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

    console.log('[TRANSCRIBE] Iniciando transcrição:', { tenantId, sessionId, patientId, fileSize: audioFile.size })

    // ── TRANSCREVER ÁUDIO INTEIRO ──
    const fullTranscription = await transcribeLocal(audioFile)

    if (!fullTranscription || fullTranscription.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Transcricao vazia - verifique o audio' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    console.log('[TRANSCRIBE] Transcrição concluída, salvando...', { tenantId, chars: fullTranscription.length })

    // ── INSERT + INCREMENTO COM RLS ATIVO ──
    const result = await withTenantClient(tenantId, async (client) => {
      const res = await client.query(
        'INSERT INTO transcripts (tenant_id, patient_id, session_id, session_date, text, processed) VALUES ($1, $2, $3, CURRENT_DATE, $4, false) RETURNING id, text, created_at',
        [tenantId, patientId, sessionId, fullTranscription]
      )

      // Incrementar uso para FREE (estimar minutos pelo tamanho do arquivo)
      if (limitInfo.isFree) {
        const estimatedMinutes = Math.max(1, Math.ceil(audioFile.size / (64 * 1024 / 8 * 60)))
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

  } catch (error: any) {
    console.error('[TRANSCRIBE] Erro ao transcrever:', error)

    const msg = error?.message?.includes('ASR Service')
      ? 'Serviço de transcrição indisponível. Verifique se o ASR está rodando.'
      : 'Erro ao transcrever audio'

    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
