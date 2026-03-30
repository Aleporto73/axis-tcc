import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'
import { readTranscriptSmart } from '@/src/services/transcript-storage'

/**
 * GET /api/transcribe/text/[transcriptId]
 *
 * Retorna texto completo da transcrição.
 * Lê do disco (transcript_path) ou fallback para coluna text (legado).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transcriptId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { transcriptId } = await params

    // Resolver tenant
    const profileRes = await pool.query(
      'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
      [userId]
    )
    let tenantId = profileRes.rows[0]?.tenant_id
    if (!tenantId) {
      const tenantRes = await pool.query('SELECT id FROM tenants WHERE clerk_user_id = $1 LIMIT 1', [userId])
      tenantId = tenantRes.rows[0]?.id
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }

    // Buscar transcript — check explícito de tenant
    const result = await pool.query(
      `SELECT id, transcript_path, text, text_preview, char_count, created_at, processed
       FROM transcripts
       WHERE id = $1 AND tenant_id = $2`,
      [transcriptId, tenantId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Transcricao nao encontrada' }, { status: 404 })
    }

    const row = result.rows[0]

    // Ler texto completo: disco se transcript_path, senão coluna text (legado)
    const fullText = await readTranscriptSmart(row)

    return NextResponse.json({
      transcript_id: row.id,
      text: fullText,
      char_count: row.char_count || fullText.length,
      created_at: row.created_at,
      processed: row.processed,
    })

  } catch (error: any) {
    console.error('[TRANSCRIBE-TEXT] Erro:', error)
    return NextResponse.json({ error: 'Erro ao ler transcricao' }, { status: 500 })
  }
}
