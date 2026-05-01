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
--   - session_presence_proofs: latitude_encrypted, longitude_encrypted, ip_address_encrypted (BYTEA)
--   - session_attachments: extracted_geo, canvas_data
--
-- Item 11H BUG 3: nomes de coluna corrigidos (sufixo _encrypted) e removida
-- a clausula "latitude != pgp_sym_encrypt('0.0', ...)" — comparacao era
-- semanticamente broken (pgp_sym_encrypt usa salt aleatorio, !! sempre true).
-- Consequencia: re-execucao re-anonimiza linhas ja anonimizadas (no-op
-- semantico apos decrypt; custo de I/O aceitavel pra job mensal).
-- =====================================================

BEGIN;

-- 1. Anonimizar coordenadas em session_presence_proofs
-- Campos criptografados (pgcrypto) → substituir por valor anônimo
UPDATE session_presence_proofs
SET
  latitude_encrypted = pgp_sym_encrypt(
    '0.0',
    current_setting('app.encryption_key')
  ),
  longitude_encrypted = pgp_sym_encrypt(
    '0.0',
    current_setting('app.encryption_key')
  ),
  ip_address_encrypted = pgp_sym_encrypt(
    'ANONIMIZADO',
    current_setting('app.encryption_key')
  ),
  -- Campos em claro: zerar distância mas manter status
  distance_to_site_meters = NULL,
  accuracy_meters = NULL,
  altitude_meters = NULL
WHERE created_at < NOW() - INTERVAL '2 years'
  AND latitude_encrypted IS NOT NULL;

-- 2. Anonimizar extracted_geo em session_attachments
UPDATE session_attachments
SET
  extracted_geo = NULL,
  canvas_data = NULL
WHERE created_at < NOW() - INTERVAL '2 years'
  AND (extracted_geo IS NOT NULL OR canvas_data IS NOT NULL);

-- 3. Log de execução (system-driven, sem user_id)
INSERT INTO axis_audit_logs (
  tenant_id, user_id, actor, action, entity_type, metadata, created_at
)
SELECT DISTINCT
  tenant_id,
  NULL,
  'system',
  'LGPD_GEO_PURGED',
  'system_job',
  jsonb_build_object(
    'category', 'compliance',
    'job', 'purge_geo',
    'executed_at', NOW()::text,
    'retention_period', '2 years'
  ),
  NOW()
FROM session_presence_proofs
WHERE created_at < NOW() - INTERVAL '2 years'
LIMIT 1;

COMMIT;
