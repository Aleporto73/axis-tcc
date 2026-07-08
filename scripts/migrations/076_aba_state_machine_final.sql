-- 076_aba_state_machine_final.sql
-- Fase A (PLANO_CORRECAO_ABA_V9): máquina de estados final do protocolo ABA.
--
-- Resolve G2 + G2b + G2c + A9. Reconcilia o trigger SQL (fonte de verdade) com a
-- UI e o modelo TS de testes numa definição única.
--
-- O que muda:
--   1. trg_fn_validate_protocol_transition: mapa final.
--      - 'regression' deixa de ter qualquer transição (Decisão 1). NÃO é removido do
--        enum aba_protocol_status (Postgres não tem DROP VALUE; 0 linhas o usam;
--        fica como tombstone inerte).
--      - Adiciona 'mastered' -> 'active' (reversão do "Dominado" — absorve o P1).
--      - As demais transições já existiam no baseline (…->active,
--        generalization/mastered_validated->maintained), preservadas.
--   2. maintenance_probes_status_check: passa a aceitar 'cancelled' além de
--      'pending'/'completed'. A rota de avaliação cancela sondas pendentes quando o
--      protocolo sai de manutenção; sem isso o UPDATE viola o CHECK e faz rollback
--      da transação inteira (2º rollback escondido — G2/A3).
--
-- Não toca em dados históricos. Não altera o enum. Uma única CREATE OR REPLACE da
-- função (nunca duas migrations sobre a mesma função).

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_fn_validate_protocol_transition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_allowed BOOLEAN := FALSE;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  v_allowed :=
    (OLD.status = 'draft'              AND NEW.status IN ('active', 'discontinued'))                     OR
    (OLD.status = 'active'             AND NEW.status IN ('mastered', 'suspended', 'discontinued'))      OR
    (OLD.status = 'mastered'           AND NEW.status IN ('generalization', 'suspended', 'active'))      OR
    (OLD.status = 'generalization'     AND NEW.status IN ('mastered_validated', 'maintained', 'active')) OR
    (OLD.status = 'mastered_validated' AND NEW.status IN ('maintenance', 'maintained', 'active'))        OR
    (OLD.status = 'maintenance'        AND NEW.status IN ('maintained', 'active'))                       OR
    (OLD.status = 'maintained'         AND NEW.status IN ('archived', 'active'))                         OR
    (OLD.status = 'suspended'          AND NEW.status IN ('active', 'discontinued'));

  IF NOT v_allowed THEN
    RAISE EXCEPTION '[AXIS ABA] Transicao invalida: "%" -> "%". Consulte Bible v2.6.1 §3.2.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.maintenance_probes DROP CONSTRAINT IF EXISTS maintenance_probes_status_check;
ALTER TABLE public.maintenance_probes
  ADD CONSTRAINT maintenance_probes_status_check
  CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])));

COMMIT;
