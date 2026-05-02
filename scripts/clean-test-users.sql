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
--   Usa safe_delete() com TRY/CATCH para ignorar tabelas
--   que não existem no banco — nunca mais quebra por isso.
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
  -- Cada bloco tem TRY/CATCH: se a tabela não existe, pula.

  -- 2.1 Audit & Logs (axis_audit_logs preservada — retenção legal 7 anos)
  BEGIN
    EXECUTE 'DELETE FROM assist_audit_log WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'assist_audit_log: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'assist_audit_log: tabela não existe, pulando';
  END;

  -- 2.2 Sugestões & Decisões
  BEGIN
    EXECUTE 'DELETE FROM suggestion_decisions WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'suggestion_decisions: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'suggestion_decisions: tabela não existe, pulando';
  END;

  BEGIN
    EXECUTE 'DELETE FROM suggestions WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'suggestions: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'suggestions: tabela não existe, pulando';
  END;

  BEGIN
    EXECUTE 'DELETE FROM assist_suggestions WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'assist_suggestions: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'assist_suggestions: tabela não existe, pulando';
  END;

  -- 2.3 Sessões & Notas
  BEGIN
    EXECUTE 'DELETE FROM session_notes WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'session_notes: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'session_notes: tabela não existe, pulando';
  END;

  BEGIN
    EXECUTE 'DELETE FROM sessions WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'sessions: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'sessions: tabela não existe, pulando';
  END;

  -- 2.4 Tarefas & Eventos
  BEGIN
    EXECUTE 'DELETE FROM tasks WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'tasks: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'tasks: tabela não existe, pulando';
  END;

  BEGIN
    EXECUTE 'DELETE FROM events WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'events: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'events: tabela não existe, pulando';
  END;

  -- 2.5 Transcrições
  BEGIN
    EXECUTE 'DELETE FROM transcripts WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'transcripts: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'transcripts: tabela não existe, pulando';
  END;

  -- 2.6 Clinical States (CSO)
  BEGIN
    EXECUTE 'DELETE FROM clinical_states WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'clinical_states: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'clinical_states: tabela não existe, pulando';
  END;

  -- 2.7 Exposure (itens antes de hierarquias)
  BEGIN
    EXECUTE 'DELETE FROM exposure_items WHERE hierarchy_id IN (SELECT id FROM exposure_hierarchies WHERE tenant_id != $1)' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'exposure_items: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'exposure_items: tabela não existe, pulando';
  END;

  BEGIN
    EXECUTE 'DELETE FROM exposure_hierarchies WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'exposure_hierarchies: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'exposure_hierarchies: tabela não existe, pulando';
  END;

  -- 2.8 Patient Onboarding Status
  BEGIN
    EXECUTE 'DELETE FROM patient_onboarding_status WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'patient_onboarding_status: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'patient_onboarding_status: tabela não existe, pulando';
  END;

  -- 2.9 Pacientes
  BEGIN
    EXECUTE 'DELETE FROM patients WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'patients: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'patients: tabela não existe, pulando';
  END;

  -- 2.10 Configurações por tenant
  BEGIN
    EXECUTE 'DELETE FROM professional_preferences WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'professional_preferences: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'professional_preferences: tabela não existe, pulando';
  END;

  BEGIN
    EXECUTE 'DELETE FROM rag_config WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'rag_config: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'rag_config: tabela não existe, pulando';
  END;

  -- 2.11 Google Calendar
  BEGIN
    EXECUTE 'DELETE FROM calendar_sync_state WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'calendar_sync_state: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'calendar_sync_state: tabela não existe, pulando';
  END;

  BEGIN
    EXECUTE 'DELETE FROM calendar_connections WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'calendar_connections: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'calendar_connections: tabela não existe, pulando';
  END;

  -- 2.12 Push Notifications
  BEGIN
    EXECUTE 'DELETE FROM push_subscriptions WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'push_subscriptions: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'push_subscriptions: tabela não existe, pulando';
  END;

  -- 2.13 Multi-Terapeuta
  BEGIN
    EXECUTE 'DELETE FROM learner_therapists WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'learner_therapists: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'learner_therapists: tabela não existe, pulando';
  END;

  BEGIN
    EXECUTE 'DELETE FROM profiles WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'profiles: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'profiles: tabela não existe, pulando';
  END;

  -- 2.14 Clinic Onboarding
  BEGIN
    EXECUTE 'DELETE FROM compliance_checklist WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'compliance_checklist: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'compliance_checklist: tabela não existe, pulando';
  END;

  BEGIN
    EXECUTE 'DELETE FROM clinic_documents WHERE tenant_id != $1' USING admin_tenant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'clinic_documents: % removidos', deleted_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'clinic_documents: tabela não existe, pulando';
  END;

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
