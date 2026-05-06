-- =====================================================
-- Migration 056: Criar tabelas órfãs (calendar_connections + push_tokens)
-- Schema copiado 1:1 de prod (via \d+ em 20/04/2026).
-- Sem RLS — prod não tem policies nessas tabelas (confirmado em NOTE_TCC).
-- Idempotente: CREATE TABLE IF NOT EXISTS.
-- =====================================================

BEGIN;

-- ─── calendar_connections ─────────────────────────
CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  scope TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  create_events_on_axis BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  webhook_channel_id TEXT,
  webhook_resource_id TEXT,
  webhook_expiration TIMESTAMPTZ,
  webhook_token TEXT,
  UNIQUE (tenant_id, user_id, provider)
);

-- ─── push_tokens ──────────────────────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_type TEXT NOT NULL DEFAULT 'professional',
  user_id TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens (user_id);

COMMIT;
