-- 058_shared_app_tenant_id_function.sql
-- Versionar funcao public.app_tenant_id() usada em policies RLS (SHARED).
--
-- A funcao existe em prod desde antes da Onda ABA v2.7.0, criada
-- manualmente, nunca versionada. Migration 057 (RLS Fase A) tornou
-- essa funcao pre-requisito implicito. Esta migration corrige o gap.
--
-- Body capturado via "\sf app_tenant_id" em prod em 29/04/2026.
-- CREATE OR REPLACE = idempotente (no-op em prod, garante existencia
-- em ambientes novos: staging restore, dev, disaster recovery).
--
-- Reversao manual: DROP FUNCTION IF EXISTS public.app_tenant_id();
-- (quebra todas as policies RLS Fase A imediatamente).

BEGIN;

CREATE OR REPLACE FUNCTION public.app_tenant_id()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
AS $function$
DECLARE
  v_tid TEXT;
BEGIN
  v_tid := current_setting('app.tenant_id', true);
  IF v_tid IS NULL OR v_tid = '' THEN
    RAISE EXCEPTION '[AXIS RLS] app.tenant_id não definido na sessão. Middleware não injetou o tenant.';
  END IF;
  RETURN v_tid::UUID;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION '[AXIS RLS] app.tenant_id inválido: "%". Deve ser UUID.', v_tid;
END;
$function$;

COMMIT;
