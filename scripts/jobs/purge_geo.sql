-- =====================================================
-- AXIS ABA v2.7.0 — Job: purge_geo
-- Frequência: Mensal
-- Ação: Anonimiza lat/long/IP com created_at > 2 anos
--
-- Ref: skill_axis_aba_v270.md — LGPD Retenção
--   "Geo/Fotos: 2 anos (auditoria) → purge automático"
--   "Purge de geo NÃO invalida bundle_hash/packet_hash"
--
-- Dados anonimizados:
--   - session_presence_proofs: latitude, longitude, ip_address
--   - session_attachments: extracted_geo, canvas_data (se criptografados)
-- =====================================================

BEGIN;

-- 1. Anonimizar coordenadas em session_presence_proofs
-- Campos criptografados (pgcrypto) → substituir por valor anônimo
UPDATE session_presence_proofs
SET
  latitude = pgp_sym_encrypt(
    '0.0',
    current_setting('app.encryption_key')
  ),
  longitude = pgp_sym_encrypt(
    '0.0',
    current_setting('app.encryption_key')
  ),
  ip_address = pgp_sym_encrypt(
    'ANONIMIZADO',
    current_setting('app.encryption_key')
  ),
  -- Campos em claro: zerar distância mas manter status
  distance_to_site_meters = NULL,
  accuracy_meters = NULL,
  altitude_meters = NULL
WHERE created_at < NOW() - INTERVAL '2 years'
  AND latitude IS NOT NULL
  AND latitude != pgp_sym_encrypt('0.0', current_setting('app.encryption_key'));

-- 2. Anonimizar extracted_geo em session_attachments
UPDATE session_attachments
SET
  extracted_geo = NULL,
  canvas_data = NULL
WHERE created_at < NOW() - INTERVAL '2 years'
  AND (extracted_geo IS NOT NULL OR canvas_data IS NOT NULL);

-- 3. Log de execução
INSERT INTO axis_audit_logs (
  tenant_id, action, category, actor_id, metadata
)
SELECT DISTINCT
  tenant_id,
  'LGPD_GEO_PURGED',
  'compliance',
  '00000000-0000-0000-0000-000000000000',
  jsonb_build_object(
    'job', 'purge_geo',
    'executed_at', NOW()::text,
    'retention_period', '2 years'
  )
FROM session_presence_proofs
WHERE created_at < NOW() - INTERVAL '2 years'
LIMIT 1;

COMMIT;
