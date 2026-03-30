/**
 * Transcript Storage — Leitura e escrita de transcrições em disco
 *
 * Modelo: banco guarda metadados (transcript_path, text_preview, char_count).
 * Disco guarda conteúdo pesado (.txt).
 *
 * Compatibilidade legada: transcrições antigas sem transcript_path
 * usam coluna `text` do banco como fallback.
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'

const TRANSCRIPT_DIR = process.env.TRANSCRIPT_DIR || '/var/lib/axis/transcripts'

/**
 * Salva texto de transcrição em disco.
 * Cria subdiretório por tenant automaticamente.
 *
 * @returns Path absoluto do arquivo salvo
 */
export async function saveTranscript(
  tenantId: string,
  transcriptId: string,
  text: string
): Promise<string> {
  const dir = path.join(TRANSCRIPT_DIR, tenantId)
  await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${transcriptId}.txt`)
  await writeFile(filePath, text, 'utf-8')
  return filePath
}

/**
 * Lê texto completo de transcrição do disco.
 */
export async function readTranscript(transcriptPath: string): Promise<string> {
  return readFile(transcriptPath, 'utf-8')
}

/**
 * Leitura inteligente: disco se transcript_path existe, coluna text se legado.
 *
 * @param row - Linha do banco com { transcript_path?, text? }
 * @returns Texto completo da transcrição
 */
export async function readTranscriptSmart(
  row: { transcript_path?: string | null; text?: string | null }
): Promise<string> {
  if (row.transcript_path) {
    return readTranscript(row.transcript_path)
  }
  return row.text || ''
}

/**
 * Gera preview do texto (primeiros N caracteres).
 */
export function getPreview(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
