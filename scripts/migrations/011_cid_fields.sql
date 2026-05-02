-- =====================================================
-- MIGRATION 011: CID System Fields
-- Adiciona cid_system e cid_label na tabela learners
-- cid_code já existe desde migration 007
-- =====================================================

ALTER TABLE learners
ADD COLUMN IF NOT EXISTS cid_system VARCHAR(10) DEFAULT 'CID-10',
ADD COLUMN IF NOT EXISTS cid_label VARCHAR(200);

-- Índice para buscas/relatórios por CID (se não existir)
CREATE INDEX IF NOT EXISTS idx_learners_cid ON learners(cid_code);

COMMENT ON COLUMN learners.cid_system IS 'Sistema de classificação: CID-10 ou CID-11';
COMMENT ON COLUMN learners.cid_label IS 'Descrição legível do código CID selecionado';
