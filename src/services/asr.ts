/**
 * ASR Service — Transcrição de áudio via faster-whisper local
 *
 * Módulo compartilhado usado pelo worker de transcrição.
 * NÃO deve ser importado pela rota HTTP (a rota apenas cria jobs).
 *
 * Usa undici fetch nativo com Agent para timeout de 30 minutos,
 * necessário para áudios longos (sessões de 50+ minutos).
 */

import { Agent, fetch as undiciFetch } from 'undici'

const ASR_URL = process.env.ASR_SERVICE_URL || 'http://localhost:8000/v1/audio/transcriptions'

const THIRTY_MINUTES = 30 * 60 * 1000

/**
 * Envia áudio para o serviço ASR local e retorna o texto transcrito.
 *
 * @param audioBuffer - Buffer do áudio a ser transcrito
 * @param filename - Nome do arquivo (usado pelo ASR para detectar formato)
 * @returns Texto transcrito
 * @throws Error se o ASR retornar erro ou timeout
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.webm'
): Promise<string> {
  const formData = new FormData()
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' })
  formData.append('file', blob, filename)
  formData.append('language', 'pt')

  const dispatcher = new Agent({
    headersTimeout: THIRTY_MINUTES,
    bodyTimeout: THIRTY_MINUTES,
  })

  const response = await undiciFetch(ASR_URL, {
    method: 'POST',
    body: formData,
    dispatcher,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`ASR Service erro ${response.status}: ${response.statusText}. ${body}`)
  }

  const data = await response.json() as { text?: string }
  return data.text || ''
}
