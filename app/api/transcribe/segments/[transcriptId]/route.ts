import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

/**
 * GET /api/transcribe/segments/[transcriptId]
 *
 * Retorna segments da transcrição com timestamps (faster-whisper).
 * Se não houver segments (transcrição legada), retorna array vazio
 * e o frontend faz fallback para texto plano.
 *
 * Padrão: withTenant (RLS compliance)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transcriptId: string }> }
) {
  try {
    const { transcriptId } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      // Verificar se o transcript pertence ao tenant
      const transcriptCheck = await client.query(
        'SELECT id FROM transcripts WHERE id = $1 AND tenant_id = $2',
        [transcriptId, tenantId]
      )

      if (transcriptCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Transcrição não encontrada' }, { status: 404 })
      }

      // Buscar segments ordenados por index
      const segmentsResult = await client.query(
        `SELECT segment_index, start_seconds, end_seconds, text
         FROM transcript_segments
         WHERE transcript_id = $1 AND tenant_id = $2
         ORDER BY segment_index ASC`,
        [transcriptId, tenantId]
      )

      const segments = segmentsResult.rows.map(row => ({
        index: row.segment_index,
        start: parseFloat(row.start_seconds),
        end: parseFloat(row.end_seconds),
        text: row.text,
      }))

      return NextResponse.json({ segments })
    })

    return result
  } catch (error: any) {
    console.error('[TRANSCRIBE-SEGMENTS] Erro:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
