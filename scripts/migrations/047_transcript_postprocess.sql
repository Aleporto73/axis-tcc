-- Migration 047: Transcript Post-Processing Pipeline v1.0
--
-- Adiciona suporte a raw_text + final_text sem quebrar dados antigos.
-- Modelo: banco guarda metadados e paths, disco guarda conteúdo pesado.
--
-- Campos novos:
--   raw_path           - path do texto bruto do ASR em disco
--   final_path         - path do texto pós-processado em disco
--   char_count_raw     - tamanho do raw_text
--   char_count_final   - tamanho do final_text (fonte principal para UI)
--   postprocess_version - versão do pipeline (ex: '1.0.0', 'legacy')
--   asr_model          - modelo ASR usado (ex: 'whisper-1')
--
-- Compatibilidade:
--   transcript_path continua como ponte para leitura legada.
--   Registros antigos recebem backfill: raw_path = final_path = transcript_path.

-- ── Adicionar colunas ──
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS raw_path TEXT;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS final_path TEXT;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS char_count_raw INTEGER;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS char_count_final INTEGER;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS postprocess_version VARCHAR(20);
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS asr_model VARCHAR(100);

-- ── Backfill registros antigos ──
-- Registros com transcript_path: apontar raw_path e final_path para o mesmo arquivo
UPDATE transcripts
SET
  raw_path = transcript_path,
  final_path = transcript_path,
  char_count_final = char_count,
  postprocess_version = 'legacy'
WHERE transcript_path IS NOT NULL
  AND final_path IS NULL;

-- Registros legados sem transcript_path (texto no banco): marcar como legacy
UPDATE transcripts
SET postprocess_version = 'legacy'
WHERE transcript_path IS NULL
  AND postprocess_version IS NULL;

-- ── Comentários de documentação ──
COMMENT ON COLUMN transcripts.raw_path IS 'Path em disco do texto bruto do ASR (preservado para auditoria)';
COMMENT ON COLUMN transcripts.final_path IS 'Path em disco do texto pós-processado (fonte principal para UI e análise)';
COMMENT ON COLUMN transcripts.char_count_raw IS 'Tamanho em chars do raw_text';
COMMENT ON COLUMN transcripts.char_count_final IS 'Tamanho em chars do final_text (exibido na UI)';
COMMENT ON COLUMN transcripts.postprocess_version IS 'Versão do pipeline de pós-processamento (legacy, 1.0.0, ...)';
COMMENT ON COLUMN transcripts.asr_model IS 'Modelo ASR usado na transcrição (ex: whisper-1)';
