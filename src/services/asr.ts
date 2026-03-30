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
 * Nota: body usa `as any` porque undici.FormData e o tipo BodyInit
 * divergem em [Symbol.toStringTag] nesta versão — funciona em runtime.
 */

import { Agent, fetch, FormData } from 'undici'

const ASR_URL =
  process.env.ASR_SERVICE_URL || 'http://localhost:8000/v1/audio/transcriptions'

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.mp3'
): Promise<string> {
  const formData = new FormData()
  const blob = new Blob([new Uint8Array(audioBuffer)], {
    type: 'audio/mpeg',
  })
  formData.append('file', blob, filename)
  formData.append('language', 'pt')

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
    throw new Error(`ASR Service erro: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { text?: string }
  return data.text || ''
}
