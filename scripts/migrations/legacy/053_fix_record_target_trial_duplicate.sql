-- =====================================================
-- Migration 053: Fix função record_target_trial duplicada
--
-- BUG EM PRODUÇÃO (16/04/2026):
--   Registrar Trial quebrava com:
--     ERROR: column "score" of relation "session_targets" does not exist
--
-- CAUSA:
--   Existiam 2 versões da função record_target_trial (overload):
--   1) target_name TEXT    → INSERT em "score" (coluna inexistente)
--   2) target_name VARCHAR → correta, deixa score_pct calcular auto
--   Postgres chamava a TEXT por padrão do driver Node.
--
-- FIX:
--   DROP da versão TEXT (quebrada). A VARCHAR passa a ser única.
--
-- Bug reportado por Bianca Cruvinel (beta).
-- =====================================================

DROP FUNCTION IF EXISTS record_target_trial(
  uuid, uuid, uuid, text, smallint, smallint, aba_prompt_level, text
);
