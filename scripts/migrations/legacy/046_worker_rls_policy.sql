-- =====================================================
-- Migration 046: RLS policy para worker de transcrição
--
-- Problema: O worker precisa ler/atualizar transcription_jobs
-- de TODOS os tenants (para claim, heartbeat, recovery).
-- A policy tenant_isolation exige app.tenant_id, criando
-- um chicken-and-egg: não sabemos o tenant antes de ler o job.
--
-- Solução: policy adicional que libera acesso quando
-- app.is_worker = 'true'. Apenas o processo worker seta isso.
-- A policy tenant_isolation continua existindo e protegendo
-- acessos da aplicação web normalmente.
-- =====================================================

BEGIN;

-- Policy: worker pode ver/modificar todos os jobs
CREATE POLICY worker_access ON transcription_jobs
  FOR ALL
  USING (current_setting('app.is_worker', true) = 'true')
  WITH CHECK (current_setting('app.is_worker', true) = 'true');

COMMIT;
