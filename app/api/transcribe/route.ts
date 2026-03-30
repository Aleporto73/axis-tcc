import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'
import { PoolClient } from 'pg'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const FREE_LIMIT_MINUTES = 50
const AUDIO_UPLOAD_DIR = process.env.AUDIO_UPLOAD_DIR || '/var/lib/axis/audio-uploads'

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

/**
 * POST /api/transcribe
 *
 * Fluxo assíncrono:
 * 1. Auth + validar tenant
 * 2. Checar limite FREE (50 min)
 * 3. Salvar áudio em disco
 * 4. Criar job pending em transcription_jobs
 * 5. Responder imediatamente com job_id
 *
 * NÃO chama ASR. NÃO espera transcrição. O worker faz isso.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Nao autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── VERIFICAR LIMITE ──
    let limitInfo: Awaited<ReturnType<typeof checkTranscriptionLimit>>
    try {
      limitInfo = await checkTranscriptionLimit(userId)
    } catch (e: any) {
      if (e.message === 'TENANT_NOT_FOUND') {
        return new Response(
          JSON.stringify({ error: 'Tenant nao encontrado' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
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
    const audioDir = path.join(AUDIO_UPLOAD_DIR, tenantId)
    await mkdir(audioDir, { recursive: true })
    const audioPath = path.join(audioDir, `${jobId}${ext}`)

    const arrayBuffer = await audioFile.arrayBuffer()
    await writeFile(audioPath, Buffer.from(arrayBuffer))

    console.log('[TRANSCRIBE] Áudio salvo:', { jobId, audioPath, size: audioFile.size })

    // ── CRIAR JOB (com RLS) ──
    // O unique index idx_tjobs_one_active_per_session impede duplicatas
    try {
      await withTenantClient(tenantId, async (client) => {
        await client.query(
          `INSERT INTO transcription_jobs
           (id, tenant_id, session_id, patient_id, status, audio_path, original_filename, file_size_bytes)
           VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)`,
          [jobId, tenantId, sessionId, patientId, audioPath, audioFile.name || 'audio.webm', audioFile.size]
        )
      })
    } catch (e: any) {
      // Unique index violation = já existe job ativo para esta sessão
      if (e.code === '23505' && e.constraint?.includes('one_active_per_session')) {
        return new Response(
          JSON.stringify({ error: 'Já existe uma transcrição em andamento para esta sessão.' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
      throw e
    }

    console.log('[TRANSCRIBE] Job criado:', { jobId, tenantId, sessionId })

    return new Response(
      JSON.stringify({ success: true, job_id: jobId, status: 'pending' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[TRANSCRIBE] Erro:', error)
    return new Response(
      JSON.stringify({ error: 'Erro ao criar job de transcrição' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
