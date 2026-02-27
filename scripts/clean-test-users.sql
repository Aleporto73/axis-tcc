-- =====================================================
-- AXIS TCC — Limpeza de Usuários de Teste
-- Autor: Alexandre (porto.ar4@gmail.com)
-- Data: 2026-02-27
--
-- OBJETIVO:
--   Remover todos os tenants de teste, preservando apenas
--   o tenant principal (email = 'porto.ar4@gmail.com').
--
-- NOTA:
--   Não usa ALTER TABLE (compatível com o usuário axis_app).
--   Os inserts em axis_audit_logs são feitos via código Node,
--   não por triggers do banco — então não precisa desabilitar nada.
--
-- ANTES DE RODAR:
--   pg_dump -Fc axis_tcc > backup.dump
-- =====================================================

BEGIN;

DO $$
DECLARE
  admin_tenant_id UUID;
  deleted_count INT;
BEGIN

  -- =====================================================
  -- PASSO 1: Identificar o tenant protegido
  -- =====================================================
  -- Se o email não existir, aborta sem deletar nada.

  SELECT id INTO admin_tenant_id
  FROM tenants
  WHERE email = 'porto.ar4@gmail.com'
  LIMIT 1;

  IF admin_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant admin (porto.ar4@gmail.com) não encontrado! Abortando.';
  END IF;

  RAISE NOTICE '=== Tenant protegido: % ===', admin_tenant_id;

  -- =====================================================
  -- PASSO 2: Deletar tabelas-filhas (ordem de dependência)
  -- =====================================================

  -- 2.1 Audit & Logs (sem FK para outras tabelas)
  DELETE FROM axis_audit_logs WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'axis_audit_logs: % removidos', deleted_count;

  DELETE FROM assist_audit_log WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'assist_audit_log: % removidos', deleted_count;

  -- 2.2 Sugestões & Decisões
  DELETE FROM suggestion_decisions WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'suggestion_decisions: % removidos', deleted_count;

  DELETE FROM suggestions WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'suggestions: % removidos', deleted_count;

  DELETE FROM assist_suggestions WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'assist_suggestions: % removidos', deleted_count;

  -- 2.3 Sessões & Notas
  DELETE FROM session_notes WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'session_notes: % removidos', deleted_count;

  DELETE FROM sessions WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'sessions: % removidos', deleted_count;

  -- 2.4 Tarefas & Eventos
  DELETE FROM tasks WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'tasks: % removidos', deleted_count;

  DELETE FROM events WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'events: % removidos', deleted_count;

  -- 2.5 Transcrições
  DELETE FROM transcripts WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'transcripts: % removidos', deleted_count;

  -- 2.6 Clinical States (CSO)
  DELETE FROM clinical_states WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'clinical_states: % removidos', deleted_count;

  -- 2.7 Exposure (itens antes de hierarquias)
  DELETE FROM exposure_items WHERE hierarchy_id IN (
    SELECT id FROM exposure_hierarchies WHERE tenant_id != admin_tenant_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'exposure_items: % removidos', deleted_count;

  DELETE FROM exposure_hierarchies WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'exposure_hierarchies: % removidos', deleted_count;

  -- 2.8 Patient Onboarding Status
  DELETE FROM patient_onboarding_status WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'patient_onboarding_status: % removidos', deleted_count;

  -- 2.9 Pacientes
  DELETE FROM patients WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'patients: % removidos', deleted_count;

  -- 2.10 Configurações por tenant
  DELETE FROM professional_preferences WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'professional_preferences: % removidos', deleted_count;

  DELETE FROM rag_config WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'rag_config: % removidos', deleted_count;

  -- 2.11 Google Calendar
  DELETE FROM calendar_sync_state WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'calendar_sync_state: % removidos', deleted_count;

  DELETE FROM calendar_connections WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'calendar_connections: % removidos', deleted_count;

  -- 2.12 Push Notifications
  DELETE FROM push_subscriptions WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'push_subscriptions: % removidos', deleted_count;

  -- 2.13 Multi-Terapeuta (migração 002)
  DELETE FROM learner_therapists WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'learner_therapists: % removidos', deleted_count;

  DELETE FROM profiles WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'profiles: % removidos', deleted_count;

  -- 2.14 Clinic Onboarding (migração 005)
  DELETE FROM compliance_checklist WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'compliance_checklist: % removidos', deleted_count;

  DELETE FROM clinic_documents WHERE tenant_id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'clinic_documents: % removidos', deleted_count;

  -- =====================================================
  -- PASSO 3: Deletar os tenants de teste
  -- =====================================================

  DELETE FROM tenants WHERE id != admin_tenant_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'tenants: % removidos', deleted_count;

  RAISE NOTICE '=== Limpeza concluída. ===';

END $$;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO PÓS-LIMPEZA
-- =====================================================
SELECT 'tenants' AS tabela, COUNT(*) AS registros FROM tenants
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'patients', COUNT(*) FROM patients
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'clinical_states', COUNT(*) FROM clinical_states
UNION ALL SELECT 'suggestions', COUNT(*) FROM suggestions
ORDER BY tabela;
