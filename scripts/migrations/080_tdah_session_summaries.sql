-- 080_tdah_session_summaries.sql
-- Resumos de sessao exclusivos do modulo TDAH.
-- Mantem o dominio ABA e public.session_summaries completamente inalterados.
-- O paciente e resolvido exclusivamente pela sessao TDAH referenciada.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tdah_sessions_tenant_id_id_key'
      AND conrelid = 'public.tdah_sessions'::regclass
  ) THEN
    ALTER TABLE public.tdah_sessions
      ADD CONSTRAINT tdah_sessions_tenant_id_id_key
      UNIQUE (tenant_id, id);
  END IF;
END
$$;

CREATE TABLE public.tdah_session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES public.tenants(id),

  session_id UUID NOT NULL,

  content TEXT NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'sent', 'rejected')),

  created_by VARCHAR NOT NULL,

  approved_by VARCHAR,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tdah_session_summaries_session_id_key
    UNIQUE (session_id),

  CONSTRAINT tdah_session_summaries_session_tenant_fkey
    FOREIGN KEY (tenant_id, session_id)
    REFERENCES public.tdah_sessions(tenant_id, id),

  CONSTRAINT tdah_summary_sent_requires_approval
    CHECK (status <> 'sent' OR approved_at IS NOT NULL)
);

CREATE INDEX idx_tdah_session_summaries_tenant_created_at
  ON public.tdah_session_summaries (tenant_id, created_at DESC);

CREATE INDEX idx_tdah_session_summaries_tenant_status
  ON public.tdah_session_summaries (tenant_id, status);

ALTER TABLE public.tdah_session_summaries
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tdah_session_summaries
  FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation
ON public.tdah_session_summaries
FOR ALL
USING (tenant_id = app_tenant_id())
WITH CHECK (tenant_id = app_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.tdah_session_summaries
TO axis_app;

COMMIT;
