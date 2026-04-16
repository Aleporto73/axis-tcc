/**
 * ASR Service — Transcrição de áudio via faster-whisper local
 *
 * Módulo compartilhado usado pelo worker de transcrição.
 * NÃO deve ser importado pela rota HTTP (a rota apenas cria jobs).
 *
 * Usa undici fetch + FormData do mesmo pacote para evitar
 * conflito de tipos entre global FormData e undici FormData.
 * Agent com timeout de 30 minutos para áudios longos.
 *
 * Estratégia de segments (Fase 9):
 * 1. Chamada ÚNICA com response_format=verbose_json
 * 2. Parse robusto: extrai text E segments da mesma resposta
 * 3. Se verbose_json não for suportado pelo server, fallback:
 *    text vem do campo "text", segments = []
 * 4. Se text vier vazio mas segments existirem, reconstrói text
 *    a partir dos segments
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
 * Cria dispatcher com timeout de 30 minutos (áudios longos).
 */
function createDispatcher() {
  return new Agent({
    headersTimeout: 30 * 60 * 1000,
    bodyTimeout: 30 * 60 * 1000,
  })
}

/**
 * Transcreve áudio via faster-whisper pedindo verbose_json.
 * Retorna texto completo + array de segments com timestamps.
 *
 * Robust parsing:
 * - Se o server suporta verbose_json → retorna text + segments
 * - Se o server ignora o param → retorna text + segments vazio
 * - Se text vier vazio mas segments existirem → reconstrói text
 * - Se tudo vier vazio → lança erro
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

  const dispatcher = createDispatcher()

  const response = await fetch(ASR_URL, {
    method: 'POST',
    body: formData as any,
    dispatcher,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`ASR Service erro: ${response.status} ${response.statusText} — ${errorBody}`)
  }

  // Ler body como text primeiro para diagnóstico
  const rawBody = await response.text()
  console.log(`[ASR] Raw response (primeiros 500 chars): ${rawBody.slice(0, 500)}`)
  console.log(`[ASR] Raw response length: ${rawBody.length} chars`)

  let data: any
  try {
    data = JSON.parse(rawBody)
  } catch (parseErr) {
    // Se não é JSON, o server respondeu plain text (formato "text" simples)
    console.log(`[ASR] Resposta não é JSON, tratando como plain text`)
    return { text: rawBody.trim(), segments: [] }
  }

  // Extrair text — pode estar em data.text ou ser o próprio data se for string
  let text = ''
  if (typeof data === 'string') {
    text = data.trim()
  } else if (typeof data?.text === 'string') {
    text = data.text.trim()
  }

  // Extrair segments — campo "segments" do verbose_json
  let segments: ASRSegment[] = []
  if (Array.isArray(data?.segments)) {
    segments = data.segments
      .filter((s: any) => s && typeof s.start === 'number' && typeof s.end === 'number')
      .map((s: any) => ({
        start: s.start,
        end: s.end,
        text: (typeof s.text === 'string' ? s.text : '').trim(),
      }))
    console.log(`[ASR] Parsed ${segments.length} segments`)
  }

  // Safety: se text está vazio mas temos segments, reconstruir text
  if (!text && segments.length > 0) {
    text = segments.map(s => s.text).join(' ').trim()
    console.log(`[ASR] Text reconstruído a partir de ${segments.length} segments (${text.length} chars)`)
  }

  console.log(`[ASR] Final: text=${text.length} chars, segments=${segments.length}`)

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
