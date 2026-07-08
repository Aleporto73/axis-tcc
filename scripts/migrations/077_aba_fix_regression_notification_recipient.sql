-- 077_aba_fix_regression_notification_recipient.sql
-- FG-1 (PLANO_CORRECAO_ABA_V9), Canal B: consertar notify_regression_detected.
--
-- Problema: a versão do baseline (000:1879) lê lp.supervisor_id — coluna que NÃO
-- existe em learner_protocols na produção — e usa esse UUID como recipient. Logo a
-- função sempre falhava/retornava sem notificar. O caller foi ligado (FG-1 no route
-- de manutenção, com SAVEPOINT), mas a função precisava ser corrigida.
--
-- Correção (só a função; sem tocar schema/dados):
--   Destinatário (recipient_id de notifications = CLERK user id, igual ao que
--   notifications/route.ts lê em `WHERE recipient_id = userId`):
--     1. terapeuta/equipe PRIMÁRIA ativa do aprendiz → profiles.clerk_user_id;
--     2. fallback: learner_protocols.created_by (já é um clerk user id, ex. user_...);
--     3. nenhum → RETURN sem erro.
--   Não usa supervisor_id nem role_in_case (vazio em produção).
--   Mantém a chave de idempotência regress_<protocol>_<regression_count>.
--   regression_type é NULL nas regressões de manutenção (a rota não o seta) → o texto
--   usa COALESCE(...,'manutenção') para não sair vazio.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_regression_detected(p_protocol_id uuid, p_tenant_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_protocol  RECORD;
  v_recipient VARCHAR;
BEGIN
  -- Protocolo + aprendiz (tenant-scoped)
  SELECT lp.id, lp.learner_id, lp.title, lp.regression_type, lp.regression_count,
         lp.created_by, l.name AS learner_name
  INTO v_protocol
  FROM learner_protocols lp
  JOIN learners l ON l.id = lp.learner_id AND l.tenant_id = lp.tenant_id
  WHERE lp.id = p_protocol_id AND lp.tenant_id = p_tenant_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- 1. Terapeuta/equipe PRIMÁRIA ativa do aprendiz → clerk_user_id
  SELECT p.clerk_user_id
  INTO v_recipient
  FROM learner_therapists lt
  JOIN profiles p ON p.id = lt.profile_id AND p.tenant_id = lt.tenant_id AND p.is_active IS TRUE
  WHERE lt.tenant_id = p_tenant_id
    AND lt.learner_id = v_protocol.learner_id
    AND lt.is_primary IS TRUE
    AND p.clerk_user_id IS NOT NULL
    AND p.clerk_user_id <> ''
  LIMIT 1;  -- se houver mais de um primário, qualquer um serve para o aviso

  -- 2. Fallback: quem criou o protocolo (created_by), SÓ se parecer Clerk user id (user_...).
  --    notifications.recipient_id precisa ser Clerk user id — não aceitar texto arbitrário
  --    (ex.: 'system' ou UUID legado) que nunca casaria com o userId do notifications/route.
  IF v_recipient IS NULL OR v_recipient = '' THEN
    IF v_protocol.created_by IS NOT NULL
       AND trim(v_protocol.created_by) LIKE 'user_%' THEN
      v_recipient := trim(v_protocol.created_by);
    END IF;
  END IF;

  -- 3. Sem destinatário → não notifica (sem erro)
  IF v_recipient IS NULL THEN RETURN; END IF;

  PERFORM create_notification_aba(
    p_tenant_id,
    v_recipient,
    'regression_alert',
    format('Regressão — %s', v_protocol.learner_name),
    format('Protocolo "%s": regressão %s (#%s).',
           v_protocol.title,
           COALESCE(v_protocol.regression_type::text, 'manutenção'),
           v_protocol.regression_count),
    jsonb_build_object(
      'protocol_id',      p_protocol_id,
      'learner_id',       v_protocol.learner_id,
      'regression_count', v_protocol.regression_count,
      'regression_type',  COALESCE(v_protocol.regression_type::text, 'manutencao')
    ),
    'regress_' || p_protocol_id::TEXT || '_' || v_protocol.regression_count::TEXT
  );
END;
$$;

COMMIT;
