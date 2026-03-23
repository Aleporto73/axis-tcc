-- =====================================================
-- Migration 039: Adicionar webhook_token a calendar_connections
-- Auditoria ABA P0: validação HMAC no webhook do Google Calendar
--
-- O token é um segredo de 256-bit armazenado no setup (watch).
-- No webhook, o Google retorna HMAC(token, channelId) no header
-- X-Goog-Channel-Token, que verificamos com timingSafeEqual.
--
-- Backward compatible: webhooks existentes continuam funcionando
-- (token NULL = skip da verificação HMAC até re-watch).
-- =====================================================

ALTER TABLE calendar_connections
  ADD COLUMN IF NOT EXISTS webhook_token TEXT;

COMMENT ON COLUMN calendar_connections.webhook_token IS
  'Segredo HMAC-SHA256 para validação de webhook. Gerado no watch, verificado no handler.';
