-- 078_aba_google_sync_columns.sql
-- Bloco F1+F2 (PLANO_CORRECAO_ABA_V9), parte F0: schema faltante do Google sync ABA.
--
-- Auditoria provou (0 rows em information_schema): sessions_aba NÃO tem as colunas
-- que app/api/aba/google/{sync,webhook}/route.ts usam. A tabela só tem
-- calendar_event_id (uuid), que NÃO é reaproveitado aqui. Sem estas colunas o sync
-- falharia com 42703 (coluna inexistente), não só com o 22P02 do enum.
--
-- Esta migration adiciona as 7 colunas (IF NOT EXISTS, idempotente) e um índice UNIQUE
-- PARCIAL (tenant_id, google_event_id) WHERE google_event_id IS NOT NULL: um evento do
-- Google mapeia para no máximo uma sessão por tenant, e o índice acelera o lookup
-- `WHERE tenant_id=$1 AND google_event_id=$2` dos routes. Como todas as linhas atuais
-- terão google_event_id NULL, o parcial não conflita com nada existente.
--
-- Não mexe em calendar_event_id, não altera dados, não faz backfill.

BEGIN;

ALTER TABLE public.sessions_aba
  ADD COLUMN IF NOT EXISTS google_event_id     character varying,
  ADD COLUMN IF NOT EXISTS google_calendar_id  character varying,
  ADD COLUMN IF NOT EXISTS calendar_source     character varying,
  ADD COLUMN IF NOT EXISTS external_etag       character varying,
  ADD COLUMN IF NOT EXISTS external_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS google_meet_link    text,
  ADD COLUMN IF NOT EXISTS patient_response    character varying;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_aba_tenant_google_event_id
  ON public.sessions_aba (tenant_id, google_event_id)
  WHERE google_event_id IS NOT NULL;

COMMIT;
