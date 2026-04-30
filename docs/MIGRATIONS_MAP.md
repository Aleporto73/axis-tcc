# MIGRATIONS_MAP — Ownership de migrations

> Documento gerado em 20/04/2026 a partir de leitura do header de cada migration.
> Quando o nome do arquivo é ambíguo, a decisão foi tomada com base nas tabelas
> efetivamente criadas/alteradas pelo script. Ver coluna "Nota" nos 4 casos de
> nome enganoso.
>
> Fonte de verdade das regras de ownership:
> - **SHARED** — `tenants`, `profiles`, `user_licenses`, `axis_audit_logs`, `notifications`, `calendar_connections`, `push_tokens`, `email_logs`, `system_alerts`, ou tabelas consumidas por múltiplos módulos (ex: `session_summaries`).
> - **ABA** — tabelas com prefixo `aba_`, `learners`, `learner_*`, `protocols`, `targets`, `behaviors`, `clinical_states`, `session_targets`, `sessions_aba`, `family_portal_access`, camada Operadora v2.7.0 (`service_sites`, `session_presence_proofs`, `coverage_profiles`, etc.).
> - **TDAH** — tabelas com prefixo `tdah_`.
> - **TCC** — `sessions` (TCC), `patients` (TCC), `transcripts`, `transcription_jobs`, `transcript_segments`, `session_reports`, `case_base`, `exposure_hierarchies`.

## Convenção de nomenclatura (057+)

A partir da migration **057**, todo novo arquivo em `scripts/migrations/` **deve** seguir:

```
NNN_<modulo>_<descricao_em_snake_case>.sql
```

Onde:

- **NNN** — número sequencial com 3 dígitos (zero-padded). Próximo disponível: `064`.
- **`<modulo>`** — literal, minúsculo. Um de: `aba`, `tcc`, `tdah`, `shared`.
- **`<descricao>`** — snake_case, objetivo, sem acentos, começa por verbo ou substantivo da tabela afetada.

**Exemplos válidos:**

- `057_aba_add_protocol_archive_reason.sql`
- `058_tcc_transcripts_add_language.sql`
- `059_shared_drop_unused_column.sql`
- `060_tdah_routines_add_reminder_time.sql`

**Exemplos inválidos (rejeitados pelo hook):**

- `057_add_column.sql` — falta módulo
- `057_ABA_foo.sql` — módulo deve ser minúsculo
- `57_aba_foo.sql` — NNN precisa de 3 dígitos
- `057_billing_foo.sql` — `billing` não é um módulo válido (use `shared`)

**Migrations 001–056 são legadas.** Nomes antigos são preservados por rastreabilidade; o validador pula qualquer arquivo com `NNN ≤ 056`. Os 4 casos de nome enganoso (005, 014, 015, 021) estão documentados abaixo e permanecem como estão.

**Regra adicional (conteúdo):** toda migration deve terminar com `COMMIT;` (ou estar dentro de um `DO $$ ... END $$;` explícito). O validador do pre-commit hook verifica tanto o nome quanto essa regra mínima.

## Ownership por migration (001 → 063)

| Migration | Módulo | Descrição | Nota |
|-----------|--------|-----------|------|
| 001_init_database.sql | SHARED | Schema inicial do banco | |
| 002_add_profiles_multi_therapist.sql | SHARED | profiles + roles + learner_therapists | |
| 003_add_lgpd_deletion_columns.sql | SHARED | Colunas de cascata LGPD | |
| 004_seed_engine_versions.sql | SHARED | Seed engine_versions (CSO ABA + TCC) | |
| **005_add_clinic_onboarding.sql** | SHARED | Onboarding Light / Anexo D — campos PJ em tenants, invite_tokens, onboarding_progress | ⚠️ Nome sugere infra genérica; na prática é SHARED (mexe em tenants, profiles e cria tabelas cross-product). |
| 006_add_user_licenses.sql | SHARED | Tabela user_licenses (billing Hotmart) | |
| 007_full_aba_repair.sql | ABA | Reparo completo — todas as tabelas ABA | |
| 011_cid_fields.sql | ABA | cid_system + cid_label em learners | |
| 012_protocol_lifecycle_timestamps.sql | ABA | Timestamps de ciclo de vida de protocolos ABA | |
| 013_add_mastered_validated_enum.sql | ABA | 'mastered_validated' em aba_protocol_status | |
| **014_portal_token_lookup_function.sql** | ABA | Functions SECURITY DEFINER para o Portal Família ABA | ⚠️ Nome não indica módulo. Mexe em session_summaries + learner_protocols + sessions_aba + family_portal_access → ABA. O Portal Família do TDAH é coberto pela 026. |
| **015_protocol_library_seed.sql** | ABA | Seed da biblioteca de protocolos ABA | ⚠️ Nome "protocol_library" parece genérico; é exclusivo ABA. Biblioteca TDAH está na 023. |
| 016_session_duration_v2.sql | ABA | duration_seconds em session_targets + duration_minutes_override em sessions_aba | |
| 017_maintenance_started_at.sql | ABA | maintenance_started_at em learner_protocols | |
| 018_multi_tenant_profiles.sql | SHARED | Multi-tenant em profiles | |
| 019_patients_profile_columns.sql | TCC | Perfil de paciente TCC | |
| 020_patients_clinical_columns.sql | TCC | Colunas clínicas de paciente TCC | |
| **021_sessions_missing_columns.sql** | TCC | google_event_id, google_meet_link, calendar_source, etc. em sessions TCC | ⚠️ Nome genérico "sessions" mascara que é exclusivo da tabela `sessions` do TCC (não `sessions_aba`). |
| 022_full_tdah_setup.sql | TDAH | Schema completo TDAH | |
| 023_seed_tdah_protocols_full.sql | TDAH | Seed de 45 protocolos TDAH | |
| 024_session_summaries_multi_module.sql | SHARED | session_summaries multi-módulo | |
| 025_tdah_teacher_tokens.sql | TDAH | Tokens de acesso professor (portal escola) | |
| 026_tdah_family_tokens.sql | TDAH | Tokens do Portal Família TDAH | |
| 027_tdah_token_economy.sql | TDAH | Economia de fichas | |
| 028_fix_license_gate.sql | SHARED | Fix gate de licença | |
| 029_add_tdah_to_product_enum.sql | SHARED | 'tdah' no enum aba_product_type | |
| 030_cleanup_phantom_licenses.sql | SHARED | Limpeza de licenças fantasma | |
| 031_tcc_cpf_crp.sql | SHARED | CPF + CRP em profiles (nome sugere TCC mas afeta tabela SHARED) | |
| 032_transcription_usage.sql | TCC | Uso de transcrição | |
| 033_operadora_sprint0_service_sites.sql | ABA | Operadora v2.7.0 — service_sites | |
| 034_operadora_sprint1_presence.sql | ABA | Operadora v2.7.0 — prova de presença | |
| 035_operadora_sprint2_institutional.sql | ABA | Operadora v2.7.0 — camada institucional | |
| 036_operadora_sprint3_integrity.sql | ABA | Operadora v2.7.0 — integridade | |
| 037_operadora_sprint4_payer_profiles.sql | ABA | Operadora v2.7.0 — perfis por pagador | |
| 038_tdah_patient_therapists.sql | TDAH | N:N paciente-terapeuta TDAH | |
| 039_calendar_webhook_token.sql | SHARED | webhook_token em calendar_connections (com DO $$ EXCEPTION para banco limpo) | |
| 040_system_alerts.sql | SHARED | Tabela system_alerts | |
| 042_aba_domain_functions.sql | ABA | Functions de domínio ABA | |
| 043_fix_portal_summaries_schema.sql | SHARED | **Intencionalmente neutralizada (no-op)** | DB real sempre teve `content` + `status` em session_summaries; 014 preserva esse schema. |
| 044_create_transcripts.sql | TCC | Tabela transcripts | |
| 045_transcription_jobs.sql | TCC | Background jobs de transcrição | |
| 046_worker_rls_policy.sql | TCC | RLS policy para worker de transcrição | |
| 047_transcript_postprocess.sql | TCC | Pipeline de pós-processamento v1.0 | |
| 048_fix_tdah_observation_enums.sql | TDAH | Fix de enums de observação TDAH | |
| 049_session_reports.sql | TCC | session_reports (relatório clínico + insights) | |
| 050_transcript_segments.sql | TCC | transcript_segments (diarização) | |
| 051_case_base.sql | TCC | Base do caso TCC | |
| 052_fix_operadora_guc_name.sql | ABA | Fix GUC em policies Operadora | |
| 053_fix_record_target_trial_duplicate.sql | ABA | Fix função record_target_trial duplicada | |
| 054_transcripts_audio_duration.sql | TCC | audio_duration_seconds em transcripts | |
| 055_drop_profiles_cpf.sql | SHARED | DROP profiles.cpf | |
| 056_create_orphan_tables.sql | SHARED | calendar_connections + push_tokens (formalização das órfãs) | |
| 057_tdah_rls_phase_a.sql | TDAH | RLS Fase A em 5 tabelas núcleo TDAH (Item 11 Onda 7) | Padrão policy `tenant_isolation` usa `app_tenant_id()` (versionada na 058). Aplicada em prod 29/04 (commit `9c99182`). |
| 058_shared_app_tenant_id_function.sql | SHARED | Versiona retroativamente função `app_tenant_id()` usada em policies RLS | No-op em prod (função já existia, criada manualmente antes da Onda ABA v2.7.0). Garante existência em ambientes novos (staging restore, dev, disaster recovery). Pré-requisito implícito da 057. |
| 059_tdah_rls_phase_b_1.sql | TDAH | RLS Fase B.1 — tentativa com 4 tabelas, **NÃO APLICADA EM PROD** | Tentou ativar RLS em `tdah_drc`, `tdah_protocols`, `tdah_teacher_tokens`, `tdah_teacher_access_log`. Falhou no smoke escola GET (HTTP 500, chicken-and-egg em `tdah_teacher_tokens` lida em `validateToken` Etapa 1 antes de saber `tenant_id`). Rollback em staging via `DROP POLICY` + `DISABLE+NO FORCE`. Substituída pela 060. Versionada como registro histórico (commit `da21614`). |
| 060_tdah_rls_phase_b_1_corrected.sql | TDAH | RLS Fase B.1 corrigida em 3 tabelas TDAH | Exclui `tdah_teacher_tokens` da Fase B.1. Aplica em `tdah_drc`, `tdah_protocols`, `tdah_teacher_access_log`. Aplicada em prod 29/04 sessão tarde (commit `453f5dd` mergeado em `6b97ac8`), smoke escola GET HTTP 200 com dados reais. Tokens precisam design dedicado pré-B.4 (decisão futura). |
| 061_shared_remove_app_tenant_id_default.sql | SHARED | RESET `app.tenant_id` default global (Item 11C) | Remove default `'00000000-0000-0000-0000-000000000000'` setado em prod via `ALTER DATABASE` de origem desconhecida (manual, sem versionamento, mascarava fail-loud). Aplicado em prod 30/04 manhã, fail-loud restaurado, smoke escola GET HTTP 200. Versionada retroativamente — no-op em prod, efetiva em ambientes novos / disaster recovery. Decisão técnica: sem `BEGIN/COMMIT` envolvendo o `ALTER DATABASE` (PG rejeita DDL de DB settings em tx); usa `COMMIT;` literal como sentinela do hook. |
| 062_tdah_rls_phase_b_3.sql | TDAH | RLS Fase B.3 em 5 tabelas internas TDAH baixo risco (Item 11 Onda 7) | Ativa `ENABLE + FORCE ROW LEVEL SECURITY` + `tenant_isolation FOR ALL USING/WITH CHECK = app_tenant_id()` em `tdah_token_transactions`, `tdah_guardians`, `tdah_patient_therapists`, `tdah_plans`, `tdah_plan_goals`. Todas servidas apenas por rotas autenticadas Clerk com middleware `withTenant`/`withRole` — sem chicken-and-egg. Pré-condições verificadas em prod: `tenant_id NOT NULL`, zero rows órfãs, 18 rotas autenticadas mapeadas com overlap. **Atenção `tdah_patient_therapists`:** base do sistema de roles TDAH (lida em `src/database/with-role.ts`). RLS afeta autorização, não só isolamento — smoke validou login como terapeuta + `canAccessTdahPatient()` + `tdahPatientFilter()`. Aplicada em prod 30/04 manhã (commit `7756551`). Reversão manual (snippet no header). Pré-requisito: `058` (`app_tenant_id()`). |
| 063_shared_migrate_tcc_aba_rls_to_app_tenant_id.sql | SHARED | Migra 42 policies RLS TCC/ABA do padrão antigo `current_setting('app.tenant_id'[, true])::uuid` para `app_tenant_id()` (Item 11E Onda 7) | `ALTER POLICY` in-place (zero gap) em 42 tabelas TCC/ABA: 32 com nome `tenant_isolation` simples + 5 com nome customizado (Perfil A frágil, sem missing_ok) + 5 com nome customizado (Perfil B silencioso, com missing_ok). Aplicada em prod 30/04 tarde (commit `b27c5b3`), smoke escola GET HTTP 200, health 200, scheduler agora loga `[AXIS RLS] app.tenant_id não definido na sessão` (mensagem clara) em vez de `unrecognized configuration parameter`. Mudança semântica adicional: 5 policies do Perfil B ganham `WITH CHECK = USING` (defesa-em-profundidade simétrica, alinha com TDAH Fase A/B). Idempotente (skip se já em padrão novo ou policy ausente). Pré-requisito: 058. Carry-forward: scheduler ainda quebra com mensagem clara → Item 11F separado. |

## Os 4 casos de nome enganoso (resumo)

| Migration | Nome engana porque… | Módulo correto |
|-----------|---------------------|----------------|
| 005_add_clinic_onboarding | "clinic_onboarding" parece ser de um módulo clínico só, mas cria infra cross-product (tenants PJ, invite_tokens, onboarding_progress) | **SHARED** |
| 014_portal_token_lookup_function | "portal_token_lookup" não diz qual portal; são as functions do Portal Família **ABA** (session_summaries + learner_protocols + sessions_aba + family_portal_access) | **ABA** |
| 015_protocol_library_seed | "protocol_library" parece genérica; é exclusivamente ABA (biblioteca TDAH está na 023) | **ABA** |
| 021_sessions_missing_columns | "sessions_missing_columns" sem prefixo de módulo; altera a tabela `sessions` do **TCC** (não `sessions_aba`) — adiciona google_event_id, google_meet_link, calendar_source etc. | **TCC** |

## Gaps de numeração

Documentados em `scripts/migrations/MIGRATION_GAPS.md`:

- **008, 009, 010** — removidos durante consolidação pré-`007_full_aba_repair`.
- **041** — pulado durante desenvolvimento (entre 040_system_alerts e 042_aba_domain_functions).

Gaps não afetam execução; migrations são aplicadas manualmente em ordem.

## Contagem por módulo

| Módulo | Qtde | Migrations |
|--------|-----:|-----------|
| SHARED | 20 | 001, 002, 003, 004, 005, 006, 018, 024, 028, 029, 030, 031, 039, 040, 043, 055, 056, 058, 061, 063 |
| ABA    | 16 | 007, 011, 012, 013, 014, 015, 016, 017, 033, 034, 035, 036, 037, 042, 052, 053 |
| TCC    | 12 | 019, 020, 021, 032, 044, 045, 046, 047, 049, 050, 051, 054 |
| TDAH   | 11 | 022, 023, 025, 026, 027, 038, 048, 057, 059, 060, 062 |
| **Total** | **59** | (de 001..063 com 4 gaps: 008, 009, 010, 041) |

## Próxima migration disponível

**064** — contar a partir do último número existente, independentemente de gaps.

Novos arquivos a partir daqui **devem seguir a convenção `NNN_<modulo>_<descricao>.sql`** definida no início deste documento. O pre-commit hook (`scripts/hooks/validate-migrations.sh`, a ser criado na Fase 2 do plano Hub 9/10) rejeita nomes fora do padrão para 057+.
