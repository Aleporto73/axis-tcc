/**
 * ASR Service — Transcrição de áudio via faster-whisper local
 *
 * Módulo compartilhado usado pelo worker de transcrição.
 * NÃO deve ser importado pela rota HTTP (a rota apenas cria jobs).
 *
 * Usa undici fetch + FormData + File do mesmo pacote para evitar
 * conflito de tipos entre global FormData e undici FormData.
 * Agent com timeout de 30 minutos para áudios longos.
 */

import { Agent, fetch, FormData, File } from 'undici'

const ASR_URL =
  process.env.ASR_SERVICE_URL || 'http://localhost:8000/v1/audio/transcriptions'

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
  filename: string = 'audio.mp3'
): Promise<string> {
  const formData = new FormData()
  const file = new File([audioBuffer], filename, {
    type: 'audio/mpeg',
  })
  formData.append('file', file)
  formData.append('language', 'pt')

  const dispatcher = new Agent({
    headersTimeout: 30 * 60 * 1000,
    bodyTimeout: 30 * 60 * 1000,
  })

  const response = await fetch(ASR_URL, {
    method: 'POST',
    body: formData,
    dispatcher,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`ASR Service erro: ${response.status} ${response.statusText}. ${body}`)
  }

  const data = (await response.json()) as { text?: string }
  return data.text || ''
}
