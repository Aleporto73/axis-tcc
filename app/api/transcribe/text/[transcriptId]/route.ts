import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { readTranscriptSmart } from '@/src/services/transcript-storage'

/**
 * GET /api/transcribe/text/[transcriptId]
 *
 * Retorna texto completo da transcrição.
 * Lê do disco (transcript_path) ou fallback para coluna text (legado).
 *
 * Migration: withTenant (resolve tenant corretamente via cookie multi-tenant)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transcriptId: string }> }
) {
  try {
    const { transcriptId } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      const queryResult = await client.query(
        `SELECT id, transcript_path, text, text_preview, char_count, created_at, processed
         FROM transcripts
         WHERE id = $1 AND tenant_id = $2`,
        [transcriptId, tenantId]
      )

      if (queryResult.rows.length === 0) {
        return NextResponse.json({ error: 'Transcricao nao encontrada' }, { status: 404 })
      }

      const row = queryResult.rows[0]

      // Ler texto completo: disco se transcript_path, senão coluna text (legado)
      let fullText: string
      try {
        fullText = await readTranscriptSmart(row)
      } catch {
        // Fallback: se disco falhar, usar text ou text_preview
        fullText = row.text || row.text_preview || ''
      }

      return NextResponse.json({
        transcript_id: row.id,
        text: fullText,
        char_count: row.char_count || fullText.length,
        created_at: row.created_at,
        processed: row.processed,
      })
    })

    return result
  } catch (error: any) {
    console.error('[TRANSCRIBE-TEXT] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
