-- Migration 066 — Versiona push_auth_token + adiciona expires_at
-- Onda 8 / HUB-02
--
-- Coluna push_auth_token foi adicionada manualmente em prod sem migration.
-- Esta migration versiona retroativamente (idempotente em prod) e adiciona
-- expires_at para tokens com TTL de 30 dias.
--
-- Default: tokens existentes recebem expires_at = NOW() + 30 days
-- Tokens novos (gerados via push-link) devem setar expires_at na criação

BEGIN;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS push_auth_token TEXT;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS push_auth_token_expires_at TIMESTAMPTZ;

-- Backfill: tokens existentes ganham 30 dias de validade a partir de agora
UPDATE patients
SET push_auth_token_expires_at = NOW() + INTERVAL '30 days'
WHERE push_auth_token IS NOT NULL
  AND push_auth_token_expires_at IS NULL;

-- Índice para lookup rápido por token (já deve existir em prod, IF NOT EXISTS protege)
CREATE INDEX IF NOT EXISTS idx_patients_push_auth_token
  ON patients (push_auth_token)
  WHERE push_auth_token IS NOT NULL;

COMMIT;
