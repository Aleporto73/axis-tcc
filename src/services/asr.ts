/**
 * ASR Service — Transcrição de áudio via faster-whisper local
 *
 * Módulo compartilhado usado pelo worker de transcrição.
 * NÃO deve ser importado pela rota HTTP (a rota apenas cria jobs).
 *
 * Usa undici fetch + FormData do mesmo pacote para evitar
 * conflito de tipos entre global FormData e undici FormData.
 * Agent com timeout de 30 minutos para áudios longos.
 */

import { Agent, fetch, FormData } from 'undici'

const ASR_URL =
  process.env.ASR_SERVICE_URL || 'http://localhost:8000/v1/audio/transcriptions'

export interface ASRSegment {
  start: number
  end: number
  text: string
}

export interface ASRResult {
  text: string
  segments: ASRSegment[]
}

/**
 * Transcreve áudio via faster-whisper com verbose_json.
 * Retorna texto completo + array de segments com timestamps.
 */
export async function transcribeAudioWithSegments(
  audioBuffer: Buffer,
  filename: string = 'audio.mp3'
): Promise<ASRResult> {
  const formData = new FormData()
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' })
  formData.append('file', blob, filename)
  formData.append('language', 'pt')
  formData.append('response_format', 'verbose_json')

  const dispatcher = new Agent({
    headersTimeout: 30 * 60 * 1000,
    bodyTimeout: 30 * 60 * 1000,
  })

  const response = await fetch(ASR_URL, {
    method: 'POST',
    body: formData as any,
    dispatcher,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`ASR Service erro: ${response.status} ${response.statusText} — ${errorBody}`)
  }

  const data = (await response.json()) as {
    text?: string
    segments?: Array<{ start: number; end: number; text: string }>
  }

  const text = data.text || ''
  const segments: ASRSegment[] = (data.segments || []).map(s => ({
    start: s.start,
    end: s.end,
    text: (s.text || '').trim(),
  }))

  return { text, segments }
}

/**
 * Transcreve áudio (compatibilidade legada — retorna só texto).
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.mp3'
): Promise<string> {
  const result = await transcribeAudioWithSegments(audioBuffer, filename)
  return result.text
}
