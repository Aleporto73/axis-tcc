-- Migration 048: Corrige enums de observação TDAH
-- Os valores antigos eram copiados do ABA e não correspondem à escala TDAH (Bible §7, §8, §9.6)
-- Atualiza dados existentes + CHECK constraints na tabela tdah_observations
-- NÃO altera snapshots (imutáveis) — apenas raw observations

BEGIN;

-- ═══════════════════════════════════════════════════════
-- 1. UPDATE dados existentes para os novos valores
-- ═══════════════════════════════════════════════════════

-- PIS: escala ABA (6 níveis) → escala TDAH (4 níveis)
UPDATE tdah_observations SET pis_level = 'minimo'   WHERE pis_level = 'gestual';
UPDATE tdah_observations SET pis_level = 'minimo'   WHERE pis_level = 'verbal';
UPDATE tdah_observations SET pis_level = 'moderado' WHERE pis_level = 'modelacao';
UPDATE tdah_observations SET pis_level = 'moderado' WHERE pis_level = 'fisica_parcial';
UPDATE tdah_observations SET pis_level = 'total'    WHERE pis_level = 'fisica_total';
-- 'independente' permanece inalterado

-- BSS: renomeia valores
UPDATE tdah_observations SET bss_level = 'leve'        WHERE bss_level = 'oscilante';
UPDATE tdah_observations SET bss_level = 'desregulado' WHERE bss_level = 'instavel';
-- 'estavel' permanece inalterado

-- EXR: renomeia valores (4 → 4, mesma posição)
UPDATE tdah_observations SET exr_level = 'excelente'               WHERE exr_level = 'independente';
UPDATE tdah_observations SET exr_level = 'adequado'                WHERE exr_level = 'apoio_minimo';
UPDATE tdah_observations SET exr_level = 'prejudicado'             WHERE exr_level = 'apoio_significativo';
UPDATE tdah_observations SET exr_level = 'severamente_prejudicado' WHERE exr_level = 'nao_realiza';

-- SEN: renomeia valores (3 → 4, sem dados para 'leve' legado)
UPDATE tdah_observations SET sen_level = 'ausente'  WHERE sen_level = 'sem_impacto';
UPDATE tdah_observations SET sen_level = 'moderado' WHERE sen_level = 'impacto_moderado';
UPDATE tdah_observations SET sen_level = 'severo'   WHERE sen_level = 'impacto_significativo';

-- TRF: renomeia valores (3 → 4, sem dados para 'leve' legado)
UPDATE tdah_observations SET trf_level = 'ausente'  WHERE trf_level = 'transicao_fluida';
UPDATE tdah_observations SET trf_level = 'moderado' WHERE trf_level = 'com_resistencia';
UPDATE tdah_observations SET trf_level = 'severo'   WHERE trf_level = 'com_ruptura';

-- ═══════════════════════════════════════════════════════
-- 2. DROP + CREATE CHECK constraints com novos valores
-- ═══════════════════════════════════════════════════════

-- PIS
ALTER TABLE tdah_observations DROP CONSTRAINT IF EXISTS tdah_observations_pis_level_check;
ALTER TABLE tdah_observations ADD CONSTRAINT tdah_observations_pis_level_check
  CHECK (pis_level IS NULL OR pis_level IN ('independente', 'minimo', 'moderado', 'total'));

-- BSS
ALTER TABLE tdah_observations DROP CONSTRAINT IF EXISTS tdah_observations_bss_level_check;
ALTER TABLE tdah_observations ADD CONSTRAINT tdah_observations_bss_level_check
  CHECK (bss_level IS NULL OR bss_level IN ('estavel', 'leve', 'desregulado'));

-- EXR
ALTER TABLE tdah_observations DROP CONSTRAINT IF EXISTS tdah_observations_exr_level_check;
ALTER TABLE tdah_observations ADD CONSTRAINT tdah_observations_exr_level_check
  CHECK (exr_level IS NULL OR exr_level IN ('excelente', 'adequado', 'prejudicado', 'severamente_prejudicado'));

-- SEN
ALTER TABLE tdah_observations DROP CONSTRAINT IF EXISTS tdah_observations_sen_level_check;
ALTER TABLE tdah_observations ADD CONSTRAINT tdah_observations_sen_level_check
  CHECK (sen_level IS NULL OR sen_level IN ('ausente', 'leve', 'moderado', 'severo'));

-- TRF
ALTER TABLE tdah_observations DROP CONSTRAINT IF EXISTS tdah_observations_trf_level_check;
ALTER TABLE tdah_observations ADD CONSTRAINT tdah_observations_trf_level_check
  CHECK (trf_level IS NULL OR trf_level IN ('ausente', 'leve', 'moderado', 'severo'));

COMMIT;
