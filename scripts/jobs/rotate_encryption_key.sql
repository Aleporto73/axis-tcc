-- =====================================================
-- AXIS — Job MANUAL: rotate_encryption_key (F3)
-- Rotação da AXIS_ENCRYPTION_KEY: re-cifra as 7 colunas
-- BYTEA (pgcrypto) com decrypt-com-chave-velha +
-- encrypt-com-chave-nova.
--
-- ⚠️ NÃO é job de cron. Execução ÚNICA, dentro da janela
--    Big-Bang com MAINTENANCE_MODE=true ATIVO e BACKUP
--    COMPLETO do DB feito ANTES. Ver NOTE_ABA → Ops.
--
-- Colunas re-cifradas (nomes reais, baseline
-- 000_shared_baseline.sql:4348-4479):
--   - service_sites.address_encrypted
--   - session_presence_proofs.latitude_encrypted,
--     .longitude_encrypted, .ip_address_encrypted
--   - session_attestations.ip_address_encrypted,
--     .canvas_data_encrypted
--   - session_attachments.extracted_geo_encrypted
--
-- Parametrização (espelha o padrão do run_sql_job.sh,
-- que injeta app.encryption_key via -c "SET ..."):
--
--   docker exec -i "$POSTGRES_CONTAINER" psql \
--     -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
--     -v ON_ERROR_STOP=1 \
--     -c "SET app.encryption_key_old = '<CHAVE_ATUAL>';" \
--     -c "SET app.encryption_key_new = '<CHAVE_NOVA>';" \
--     -f - < scripts/jobs/rotate_encryption_key.sql
--
-- (SET via -c persiste na sessão; os -c e o -f rodam na
--  mesma conexão — mesmo mecanismo já usado pelo purge_geo.)
--
-- Ordem de uso na janela (NOTE_ABA → Ops):
--   1. MAINTENANCE_MODE=true + restart PM2
--   2. Backup completo do DB
--   3. ESTE script (transação única — tudo ou nada)
--   4. Trocar AXIS_ENCRYPTION_KEY no .env dos 3 sistemas
--   5. Restart PM2 (app + worker)
--   6. Smoke test (ler Local cadastrado, criar sessão)
--   7. MAINTENANCE_MODE off + restart
--
-- Falha esperada se alguma row tiver sido cifrada com
-- chave diferente: "Wrong key or corrupt data" → ROLLBACK
-- automático de TUDO (ON_ERROR_STOP + transação única).
-- Re-execução após COMMIT bem-sucedido NÃO é idempotente
-- (a chave velha já não decifra) — rodar exatamente 1 vez.
-- =====================================================

-- ── 0. Fail-fast: ambas as chaves precisam estar setadas ──
DO $$
BEGIN
  IF COALESCE(current_setting('app.encryption_key_old', true), '') = '' THEN
    RAISE EXCEPTION 'app.encryption_key_old não definido — ver header do script';
  END IF;
  IF COALESCE(current_setting('app.encryption_key_new', true), '') = '' THEN
    RAISE EXCEPTION 'app.encryption_key_new não definido — ver header do script';
  END IF;
  IF current_setting('app.encryption_key_old') = current_setting('app.encryption_key_new') THEN
    RAISE EXCEPTION 'Chave velha e nova são idênticas — abortando';
  END IF;
END $$;

-- ── 1. DRY-RUN: contagem de rows afetadas por tabela ──
-- (somente leitura — conferir volumes antes do UPDATE)
SELECT 'service_sites' AS tabela,
       COUNT(*) FILTER (WHERE address_encrypted IS NOT NULL) AS rows_a_recifrar
FROM service_sites
UNION ALL
SELECT 'session_presence_proofs',
       COUNT(*) FILTER (WHERE latitude_encrypted IS NOT NULL
                           OR longitude_encrypted IS NOT NULL
                           OR ip_address_encrypted IS NOT NULL)
FROM session_presence_proofs
UNION ALL
SELECT 'session_attestations',
       COUNT(*) FILTER (WHERE ip_address_encrypted IS NOT NULL
                           OR canvas_data_encrypted IS NOT NULL)
FROM session_attestations
UNION ALL
SELECT 'session_attachments',
       COUNT(*) FILTER (WHERE extracted_geo_encrypted IS NOT NULL)
FROM session_attachments;

-- ── 2. PRÉ-FLIGHT: valida que a chave velha decifra (1 row por tabela) ──
-- Falha aqui (fora da transação de escrita) se a chave velha estiver errada.
SELECT pgp_sym_decrypt(address_encrypted, current_setting('app.encryption_key_old')) IS NOT NULL AS ok_service_sites
FROM service_sites WHERE address_encrypted IS NOT NULL LIMIT 1;

SELECT pgp_sym_decrypt(latitude_encrypted, current_setting('app.encryption_key_old')) IS NOT NULL AS ok_presence_proofs
FROM session_presence_proofs WHERE latitude_encrypted IS NOT NULL LIMIT 1;

SELECT pgp_sym_decrypt(ip_address_encrypted, current_setting('app.encryption_key_old')) IS NOT NULL AS ok_attestations
FROM session_attestations WHERE ip_address_encrypted IS NOT NULL LIMIT 1;

SELECT pgp_sym_decrypt(extracted_geo_encrypted, current_setting('app.encryption_key_old')) IS NOT NULL AS ok_attachments
FROM session_attachments WHERE extracted_geo_encrypted IS NOT NULL LIMIT 1;

-- ── 3. RE-CIFRAGEM (transação única — tudo ou nada) ──
BEGIN;

-- 3.1 service_sites.address_encrypted
UPDATE service_sites
SET address_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(address_encrypted, current_setting('app.encryption_key_old')),
      current_setting('app.encryption_key_new'))
WHERE address_encrypted IS NOT NULL;

-- 3.2 session_presence_proofs (3 colunas, cada uma com guard próprio de NULL)
UPDATE session_presence_proofs
SET
  latitude_encrypted = CASE WHEN latitude_encrypted IS NOT NULL THEN
    pgp_sym_encrypt(
      pgp_sym_decrypt(latitude_encrypted, current_setting('app.encryption_key_old')),
      current_setting('app.encryption_key_new'))
    ELSE NULL END,
  longitude_encrypted = CASE WHEN longitude_encrypted IS NOT NULL THEN
    pgp_sym_encrypt(
      pgp_sym_decrypt(longitude_encrypted, current_setting('app.encryption_key_old')),
      current_setting('app.encryption_key_new'))
    ELSE NULL END,
  ip_address_encrypted = CASE WHEN ip_address_encrypted IS NOT NULL THEN
    pgp_sym_encrypt(
      pgp_sym_decrypt(ip_address_encrypted, current_setting('app.encryption_key_old')),
      current_setting('app.encryption_key_new'))
    ELSE NULL END
WHERE latitude_encrypted IS NOT NULL
   OR longitude_encrypted IS NOT NULL
   OR ip_address_encrypted IS NOT NULL;

-- 3.3 session_attestations (2 colunas)
UPDATE session_attestations
SET
  ip_address_encrypted = CASE WHEN ip_address_encrypted IS NOT NULL THEN
    pgp_sym_encrypt(
      pgp_sym_decrypt(ip_address_encrypted, current_setting('app.encryption_key_old')),
      current_setting('app.encryption_key_new'))
    ELSE NULL END,
  canvas_data_encrypted = CASE WHEN canvas_data_encrypted IS NOT NULL THEN
    pgp_sym_encrypt(
      pgp_sym_decrypt(canvas_data_encrypted, current_setting('app.encryption_key_old')),
      current_setting('app.encryption_key_new'))
    ELSE NULL END
WHERE ip_address_encrypted IS NOT NULL
   OR canvas_data_encrypted IS NOT NULL;

-- 3.4 session_attachments.extracted_geo_encrypted
UPDATE session_attachments
SET extracted_geo_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(extracted_geo_encrypted, current_setting('app.encryption_key_old')),
      current_setting('app.encryption_key_new'))
WHERE extracted_geo_encrypted IS NOT NULL;

COMMIT;

-- ── 4. VERIFICAÇÃO PÓS-COMMIT: chave NOVA decifra (1 row por tabela) ──
SELECT pgp_sym_decrypt(address_encrypted, current_setting('app.encryption_key_new')) IS NOT NULL AS verif_service_sites
FROM service_sites WHERE address_encrypted IS NOT NULL LIMIT 1;

SELECT pgp_sym_decrypt(latitude_encrypted, current_setting('app.encryption_key_new')) IS NOT NULL AS verif_presence_proofs
FROM session_presence_proofs WHERE latitude_encrypted IS NOT NULL LIMIT 1;

SELECT pgp_sym_decrypt(ip_address_encrypted, current_setting('app.encryption_key_new')) IS NOT NULL AS verif_attestations
FROM session_attestations WHERE ip_address_encrypted IS NOT NULL LIMIT 1;

SELECT pgp_sym_decrypt(extracted_geo_encrypted, current_setting('app.encryption_key_new')) IS NOT NULL AS verif_attachments
FROM session_attachments WHERE extracted_geo_encrypted IS NOT NULL LIMIT 1;
