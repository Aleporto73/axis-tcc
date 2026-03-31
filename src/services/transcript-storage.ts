/**
 * Transcript Storage — Leitura e escrita de transcrições em disco
 *
 * Modelo: banco guarda metadados (paths, preview, char_count).
 * Disco guarda conteúdo pesado (.txt).
 *
 * Pipeline v1.0:
 *   - raw_path   = texto bruto do ASR (auditoria)
 *   - final_path = texto pós-processado (fonte principal)
 *   - transcript_path = compatibilidade legada (aponta para final_path)
 *
 * Fallback de leitura (com log explícito):
 *   1. final_path
 *   2. transcript_path
 *   3. raw_path
 *   4. coluna text (legado)
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
 * Tenta ler um arquivo do disco. Retorna null se falhar.
 */
async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return content && content.trim().length > 0 ? content : null
  } catch {
    return null
  }
}

/**
 * Leitura inteligente com fallback priorizando final_path.
 *
 * Ordem:
 *   1. final_path (texto pós-processado — fonte principal)
 *   2. transcript_path (compatibilidade legada)
 *   3. raw_path (texto bruto do ASR)
 *   4. coluna text (legado, dados no banco)
 *
 * Loga explicitamente quando usa fallback para facilitar auditoria.
 *
 * @param row - Linha do banco com paths e texto legado
 * @returns Texto completo da transcrição
 */
export async function readTranscriptSmart(
  row: {
    final_path?: string | null
    transcript_path?: string | null
    raw_path?: string | null
    text?: string | null
    text_preview?: string | null
  }
): Promise<string> {
  // 1. final_path (fonte principal)
  if (row.final_path) {
    const content = await tryReadFile(row.final_path)
    if (content) return content
    console.warn(`[TRANSCRIPT-READ] final_path inacessível: ${row.final_path}, tentando fallback...`)
  }

  // 2. transcript_path (compatibilidade)
  if (row.transcript_path && row.transcript_path !== row.final_path) {
    const content = await tryReadFile(row.transcript_path)
    if (content) {
      console.warn(`[TRANSCRIPT-READ] Fallback para transcript_path: ${row.transcript_path}`)
      return content
    }
    console.warn(`[TRANSCRIPT-READ] transcript_path inacessível: ${row.transcript_path}`)
  }

  // 3. raw_path (bruto do ASR)
  if (row.raw_path) {
    const content = await tryReadFile(row.raw_path)
    if (content) {
      console.warn(`[TRANSCRIPT-READ] Fallback para raw_path: ${row.raw_path}`)
      return content
    }
    console.warn(`[TRANSCRIPT-READ] raw_path inacessível: ${row.raw_path}`)
  }

  // 4. coluna text (legado)
  if (row.text) {
    console.warn(`[TRANSCRIPT-READ] Fallback para coluna text legada`)
    return row.text
  }

  // 5. text_preview como último recurso
  if (row.text_preview) {
    console.warn(`[TRANSCRIPT-READ] Fallback para text_preview (último recurso)`)
    return row.text_preview
  }

  console.warn(`[TRANSCRIPT-READ] Nenhuma fonte de texto disponível`)
  return ''
}

/**
 * Gera preview do texto (primeiros N caracteres).
 * @deprecated Usar buildPreview() de transcript-postprocess.ts
 */
export function getPreview(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
