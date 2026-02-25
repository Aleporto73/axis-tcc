# AXIS ABA CODEBASE - COMPREHENSIVE ANALYSIS

**Date**: 2026-02-25  
**Version**: v1.3-FINAL  
**Status**: 85% UI Polished, 50% Features Complete, 30% Production-Ready  

---

## EXECUTIVE SUMMARY

AXIS ABA is a **Clinical Decision Support System** for Applied Behavior Analysis (ABA) therapy in Brazil. It's a Next.js + PostgreSQL SaaS platform with multi-tenant isolation, role-based access control, and a sophisticated clinical state calculation engine (CSO-ABA).

**Key distinction**: This is NOT a generic patient management system. It's specifically designed for ABA protocol management with scientific rigor—featuring immutable append-only audit trails, Bible-compliant protocol state machines, and advanced clinical metrics.

---

## ARCHITECTURE OVERVIEW

### Tech Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Next.js API routes, PostgreSQL 14+
- **Authentication**: Clerk (multi-tenant)
- **Notifications**: Firebase Cloud Messaging (FCM), Resend Email
- **Optional**: Google Calendar integration, OpenAI (transcription/analysis)
- **Testing**: Vitest with coverage

### Deployment
- **PM2** for process management
- **Docker Compose** for local dev (PostgreSQL)
- **Environment**: .env based (Firebase keys, OpenAI, database)
- **Build**: `npm run next:build && pm2 restart all`

---

## DATABASE SCHEMA (Key Tables)

### 1. **Tenants** (Multi-Tenancy)
```sql
tenants(id, name, plan, created_at)
```
- Isolation at query layer via `withTenant()`
- All tables have `tenant_id` foreign key

### 2. **Learners (Aprendizes)** - ABA-Specific
```sql
learners(
  id, tenant_id,
  name, date_of_birth, diagnosis, cid_code,
  support_level (1-3),
  school, notes,
  is_active, deleted_at,
  created_at, updated_at
)
```
- Support levels: 1 (minimal) → 3 (high)
- Soft delete via `deleted_at` (LGPD-compliant)

### 3. **Learner Protocols** - Protocol Tracking
```sql
learner_protocols(
  id, tenant_id, learner_id,
  title, domain (comunicacao/comportamento/...),
  status (draft→active→mastered→...),
  status_simplificado (for family portal),
  regression_count, discontinuation_reason,
  created_at, updated_at
)
```
- **Status machine**: Enforced by `protocol-lifecycle.ts`
- **10 states**: draft, active, mastered, generalization, maintenance, maintained, regression, suspended, discontinued, archived
- **Terminal states**: discontinued, archived (no further transitions)

### 4. **Sessions ABA** - Clinical Records
```sql
sessions_aba(
  id, tenant_id, learner_id,
  scheduled_at, started_at, ended_at,
  duration_minutes, session_number,
  status (scheduled/completed/cancelled),
  cso_snapshot_id (immutable reference to CSO state)
)
```

### 5. **Clinical States (CSO)** - Append-Only
```sql
clinical_states_aba(
  id, tenant_id, learner_id,
  cso_aba (0-100 score),
  sas, pis, bss, tcm (component scores),
  faixa (critico/atencao/bom/excelente),
  source_event, created_at (NO UPDATE EVER)
)
```
- **RULE**: NEVER UPDATE—always INSERT new records
- Versioned: `cso_version` (e.g., "1.0.0")

### 6. **Guardians (Responsáveis)** - Family Access
```sql
guardians(
  id, tenant_id, learner_id,
  name, email, phone, relationship,
  is_active, created_at, updated_at
)
```

### 7. **Guardian Consents (LGPD)** - Immutable
```sql
guardian_consents(
  id, tenant_id, guardian_id, learner_id,
  consent_type (portal_access/data_collection/...),
  consent_version, ip_address,
  accepted_at, revoked_at (audit trail)
)
```

### 8. **Family Portal Access** - Token-Based
```sql
family_portal_access(
  id, tenant_id, guardian_id, learner_id,
  access_token (hex SHA256), token_expires_at,
  is_active, activated_at, last_accessed_at,
  consent_id (FK to guardian_consents)
)
```

### 9. **Learner Therapists** - Multi-Therapist Linking
```sql
learner_therapists(
  tenant_id, learner_id, profile_id,
  is_primary, assigned_by (UUID of assigner),
  created_at, updated_at
)
```

### 10. **Session Summaries** - Approved/Unapproved
```sql
session_summaries(
  id, session_id, learner_id, tenant_id,
  content, status (draft/approved/rejected),
  approved_at, created_at, updated_at
)
```
- Only **approved** summaries appear in family portal

### 11. **Audit Logs** - Immutable
```sql
axis_audit_logs(
  id, tenant_id,
  table_name, record_id, action,
  old_values (JSONB), new_values (JSONB),
  user_id, created_at (APPEND-ONLY)
)
```

### 12. **Suggestions** - Engine-Generated
```sql
suggestions(
  id, tenant_id, learner_id,
  type, title, reason (text[]),
  confidence (0-1), context (JSONB),
  engine_version, created_at, expires_at
)
```
- Types: CRISIS_PROTOCOL, PAUSE_EXPOSURE, CHECK_ADHERENCE, etc.

---

## CORE ENGINES

### 1. **CSO-ABA Engine** (`src/engines/cso-aba.ts`) - MAIN

**Purpose**: Calculate Clinical State Score for ABA (motor v1.0.0)

**Formula** (Bible S2):
```
CSO-ABA = (0.25 × SAS) + (0.25 × PIS) + (0.25 × BSS) + (0.25 × TCM)
```
Where:
- **SAS** (Skill Acquisition Score): % of mastered targets + weighted avg of active target scores
- **PIS** (Prompt Independence Score): Mean of prompt levels (independente=1.0 → fisica_total=0.0) × 100
- **BSS** (Behavioral Stability Score): 100 × (1 - intensity) × trend_factor
- **TCM** (Therapeutic Consistency Metric): 100 × (1 - CV_last_5_sessions)

**Band Interpretation**:
- **85-100**: Excelente (green)
- **70-84**: Bom (green-yellow)
- **50-69**: Atenção (yellow)
- **0-49**: Crítico (red)

**Key Functions**:
- `calculateSAS()`: Target mastery weighted by trials
- `calculatePIS()`: Prompt reduction over trials
- `calculateBSS()`: Behavioral intensity × trend
- `calculateTCM()`: Session consistency (coefficient of variation)
- `computeFullCsoAba()`: All 4 dimensions → single CSO score

### 2. **CSO Engine** (`src/engines/cso.ts`) - Legacy/TCC

**Purpose**: Calculate Clinical State Object for TCC (Cognitive-Behavioral Therapy)

**Version**: 3.0.0

**Inputs**: Events (SESSION_END, AVOIDANCE_OBSERVED, CONFRONTATION_OBSERVED, etc.)

**3-Dimension Model**:
1. **Activation Level** (0-1): Patient engagement in therapy
2. **Emotional Load** (0-1): Anxiety/emotional burden
3. **Task Adherence** (0-1): Homework completion rate

**Trends**:
- `flex_trend`: "up" (improving), "down" (worsening), "flat" (stable)
- `recovery_time`: Consecutive sessions showing improvement

**Event Processing** (Append-only):
- `SESSION_END`: Duration + micro-events → emotional load, activation
- `AVOIDANCE_OBSERVED`: Avoidance intensity → emotional load ↑
- `CONFRONTATION_OBSERVED`: Confrontation intensity → activation ↑
- `TASK_COMPLETED`: Task adherence ↑
- `MOOD_CHECK`: Direct mood rating (0-10) → emotional load

**Anti-Duplicity**: SHA256 hash of event signature; ignores re-submitted identical events

### 3. **Protocol Lifecycle Engine** (`src/engines/protocol-lifecycle.ts`)

**Purpose**: Enforce protocol state machine (Bible S3)

**10 Status States**:
```
draft → active → mastered → generalization → maintenance → maintained → archived
              → suspended ───→ discontinued
              → regression ──→ active
```

**Validation Rules** (S3.2):
1. Archived only from: `maintained` or `draft`
2. Discontinued requires: `discontinuationReason` (NOT NULL)
3. Suspended max: 30 days (alert on overflow)
4. All transitions logged to `axis_audit_logs`
5. Unlisted transitions are **PROHIBITED**

**Key Functions**:
- `validateTransition(from, to, ctx)`: Throws `TransitionError` if invalid
- `isTransitionAllowed()`: Check basis validity
- `daysSuspended()`, `isSuspensionExpired()`: 30-day rule
- `getAvailableTransitions()`: List valid next states

### 4. **Suggestion Engine** (`src/engines/suggestion.ts`)

**Purpose**: Generate clinical recommendations based on CSO

**10 Priority Rules**:
1. **CRISIS_PROTOCOL** (p=10): risk_flags includes "CRISIS_ALERT"
2. **PAUSE_EXPOSURE** (p=9): emotional_load > 0.8 && activation > 0.75
3. **CHECK_ADHERENCE** (p=8): task_adherence < 0.3
4. **PAUSE_EXPOSURE** (p=8): flex_trend DOWN && recovery_time = 0
5. **SIMPLIFY_TASK** (p=6): 0.3 ≤ task_adherence < 0.5
6. **COGNITIVE_INTERVENTION** (p=7): cognitive_rigidity > 0.7
7. **EMOTIONAL_REGULATION** (p=6): 0.6 < emotional_load ≤ 0.8
8. **CELEBRATE_PROGRESS** (p=5): flex_trend UP && recovery_time ≥ 3
9. **CELEBRATE_PROGRESS** (p=4): task_adherence > 0.8
10. **ADJUST_PACE** (p=5): sessions_in_phase > 8

**Execution**: Selects top priority, creates 1 suggestion per cycle (prioridade=1 rule)

---

## API ENDPOINTS (75+ Routes)

### ABA Module (`/api/aba/*`)

#### Learner Management
- `GET /api/aba/learners` — List (filtered by role)
- `POST /api/aba/learners` — Create (admin/supervisor only)
- `GET /api/aba/learners/[id]/cso-history` — CSO timeline

#### Protocol Management
- `GET /api/aba/protocols` — List protocols
- `POST /api/aba/protocols` — Create protocol
- `GET /api/aba/protocols/[id]` — Detail
- `PUT /api/aba/protocols/[id]` — Update (state, status)

#### Sessions
- `GET /api/aba/sessions` — List
- `POST /api/aba/sessions` — Create
- `GET /api/aba/sessions/[id]` — Detail
- `GET /api/aba/sessions/[id]/trials` — Trial-level data
- `GET /api/aba/sessions/[id]/summary` — Session summary

#### Alerts & Reports
- `GET /api/aba/alerts` — Regression alerts
- `GET /api/aba/dashboard` — Dashboard KPIs
- `GET /api/aba/reports` — Generate clinical report
- `GET /api/aba/ebp-practices` — 28 Evidence-Based Practices

#### Guardian & Consent (LGPD)
- `GET /api/aba/guardians` — List guardians
- `POST /api/aba/guardians` — Add guardian
- `DELETE /api/aba/guardians` — Soft delete
- `GET /api/aba/consents` — Check consent status
- `POST /api/aba/consents` — Register/revoke consent

#### Family Portal
- `GET /api/aba/portal` — Portal access list
- `POST /api/aba/portal` — Grant/revoke access
- `POST /api/portal/invite` — Generate invite link (90-day expiry)
- `GET /api/portal/[token]` — Portal view (public, rate-limited)

#### Therapist & Team
- `GET /api/aba/team` — List team members
- `POST /api/aba/team` — Add therapist
- `GET /api/aba/learner-therapists` — Learner-therapist links

#### Maintenance
- `GET /api/aba/maintenance` — System health
- `GET /api/aba/me` — Current user profile

### TCC Module (Legacy)
- `GET/POST /api/sessions` — Session CRUD
- `GET/POST /api/patients` — Patient CRUD
- `GET /api/patients/[id]/clinical-record` — TCC clinical data
- `GET /api/patients/[id]/evolution` — Evolution chart

### Push Notifications
- `POST /api/patient/push/authorize` — Register FCM token
- `POST /api/push/register` — Subscribe to push
- `POST /api/push/send` — Send push (admin)
- `GET /api/cron/reminders` — Cron job: send pending reminders

### Google Calendar Integration
- `GET/POST /api/aba/google/route.ts` — OAuth flow
- `GET /api/aba/google/callback` — OAuth callback
- `GET /api/aba/google/sync` — Sync sessions to Google Calendar
- `GET /api/aba/google/watch` — Webhook for calendar changes
- `GET /api/aba/google/status` — Check connection status

---

## FRONTEND PAGES

### ABA Portal (`/aba/*`)

**Navigation**: Sidebar + capsule nav bar (Painel → Aprendizes → Sessões → Relatórios → PEI → Equipe → Configurações)

#### Dashboard (`/aba/dashboard`)
- **Learner selector** (multi-select)
- **CSO-ABA evolution graph** (SVG inline, 5-band colors)
- **Dimension breakdown** (SAS, PIS, BSS, TCM sub-scores)
- **Stats**: Active protocols, mastered, maintained, session counts
- **Motor version**: v2.6.1 displayed

#### Learners (`/aba/aprendizes`)
- **Learner list** with age, CID code, support level
- **Quick stats**: Active protocols, session count
- **Add learner modal**: Name, birth_date, diagnosis, CID, support_level, school
- **Links to**: Individual learner detail page

#### Learner Detail (`/aba/aprendizes/[id]`)
- **Profile**: Age, diagnosis, support level
- **Protocol list**: Grouped by domain (comunicação, comportamento, habilidades sociais, autonomia, cognitivo, motor)
- **Status badges**: conquistado (star), em_progresso, em_revisão
- **Tabs**: Protocolos, Sessões, Generalização, Manutenção, Sondas
- **Add protocol modal**: Title, domain, EBP (28 practices), initial targets

#### Sessions (`/aba/sessoes`)
- **Session list** by date
- **Filters**: Status (agendada/em_andamento/finalizada), period (hoje/semana/mês)
- **Create session button** → Start now OR schedule
- **Session detail**: Duration, targets worked, learner response

#### Generalization (`/aba/aprendizes/[id]/generalizacao`)
- Track generalization probes (3×2 rule validation)
- Alternative settings/people/materials

#### Maintenance (`/aba/aprendizes/[id]/manutencao`)
- Maintenance probe schedule
- Mastered skills tracking

#### Reports (`/aba/relatorios`)
- **PDF generation** with:
  - Learner info + photo
  - CSO-ABA score + band
  - Protocol matrix (status, trials, errors)
  - EBP practices used
  - Progress narrative
  - Achados clínicos

#### PEI (`/aba/pei`)
- Individualized Education Program management
- Link protocols to PEI goals

#### Team (`/aba/equipe`)
- Therapist profiles
- Learner-therapist assignments
- Multi-therapist role management (primary/secondary)

#### Settings (`/aba/configuracoes`)
- Tenant preferences
- Max suggestions/month
- Silence mode
- RAG config (lookback months, decay settings)

### Family Portal (`/portal/[token]`)

**Access**: Public, token-based, rate-limited

**Data shown** (NO clinical scores):
- Learner name, age
- Achievements (conquistado protocols)
- In-progress count
- Upcoming sessions (date, time, duration)
- Approved session summaries (text only)
- Protocol list with simplified status

**Data HIDDEN**:
- CSO scores, SAS, PIS, BSS, TCM
- Trial details, error counts
- Behavioral intensity
- Clinical observations
- Therapist notes

---

## ROLE-BASED ACCESS CONTROL

### Roles
1. **Admin**: Tenant creator, all data, all learners
2. **Supervisor**: Multi-learner oversight, team management
3. **Therapist**: Own learners only (via `learner_therapists` link)
4. **Guest**: Read-only view (future)

### Implementation (`src/database/with-role.ts`)
```typescript
learnerFilter(ctx, minRole) // Returns SQL clause + params
// minRole=1 (admin), 2 (supervisor), 3 (therapist)
// Therapist only sees learners where learner_therapists.profile_id = their profile_id
```

### Multi-Therapist
- Learner can have multiple therapists
- Primary therapist designated
- Assigned by admin/supervisor
- Audit logged

---

## SECURITY & COMPLIANCE

### LGPD (Lei Geral de Proteção de Dados)
1. **Data Deletion** (`/api/aba/lgpd/delete`):
   - Soft delete via `deleted_at` timestamp
   - Anonymize personal data (name → "Deletado")
   - Retain clinical records if needed (with consent check)

2. **Data Export** (`/api/aba/lgpd/export`):
   - JSON export of all personal data
   - PDF generation for download

3. **Consent Management**:
   - `guardian_consents` table immutable
   - IP address logged
   - Revocation creates `revoked_at` timestamp

### Immutable Audit Trails
- `clinical_states_aba`: NEVER UPDATE (append-only)
- `axis_audit_logs`: APPEND-ONLY
- `guardian_consents`: REVOKED_AT field, never deleted

### Rate Limiting
- 100 req/min per IP for public routes (portal, invites)
- Implements via Redis (optional)

### Authentication
- Clerk-based (Oauth, MFA)
- Session tokens in JWT
- NextAuth middleware

---

## DATA FLOW EXAMPLES

### Example 1: Create Session & Calculate CSO-ABA

```
1. Therapist clicks "Nova Sessão"
   → POST /api/aba/sessions {learner_id, scheduled_at, start_now}

2. Backend creates sessions_aba record
   → Schedules reminders (24h, 10min before) via scheduled_reminders table
   → FCM push to patient (if consented)

3. Therapist starts session (if start_now=true)
   → Navigation to /aba/sessoes/[id]
   → Loads trial data (targets, prompts, errors)

4. Session ends
   → POST /api/aba/sessions/[id]/finish {duration, behaviors, trials[]}
   → CSO-ABA engine runs:
      a. Fetch active targets + mastered targets
      b. Calculate SAS (weighted avg + mastery contribution)
      c. Fetch prompt levels → calculate PIS
      d. Get behavior intensity → calculate BSS
      e. Fetch last 5 session scores → calculate TCM
      f. Combine: CSO-ABA = 0.25×(SAS+PIS+BSS+TCM)
   → INSERT clinical_states_aba record
   → Determine band (critico/alerta/bom/excelente)

5. Suggestion engine runs (if CSO exists)
   → Evaluate 10 rules
   → SELECT top-priority rule
   → INSERT suggestion record
   → Notification to therapist

6. Report generation (admin/supervisor)
   → GET /api/aba/reports?learner_id=[id]
   → Fetch learner + protocols + sessions + CSO history
   → Generate PDF with jsPDF/pdfkit
   → Embed CSO graph (SVG)
```

### Example 2: Guardian Access to Family Portal

```
1. Therapist invites guardian
   → POST /api/portal/invite {learner_id, guardian_name, guardian_email}
   → Backend generates:
      - guardian_consents record (portal_access, accepted_at)
      - family_portal_access record (token, expires_at)
      - 90-day link: https://axisclinico.com/portal/[token]

2. Guardian receives email (Resend)
   → Clicks link
   → Public route: GET /api/portal/[token]
   → Validates:
      - Token exists, not expired
      - Consent accepted (guardian_consents.accepted_at IS NOT NULL)
   → Returns:
      - Learner name, age, support level
      - Conquered protocols + counts
      - Upcoming sessions (date, time, duration only)
      - Approved summaries (text only)
      - Achievements (protocol titles, dates)

3. Guardian sees learner progress (NO clinical data)
   → "3 habilidades conquistadas"
   → "5 em progresso"
   → "Próxima sessão: 28 fev 14h (60min)"
   → "Resumo da última sessão: Trabalhamos comunicação e comportamento..."
```

### Example 3: Protocol Status Transition with Validation

```
1. Therapist marks protocol as "Mastered" (3 consecutive probes ≥ 70%)
   → PUT /api/aba/protocols/[id] {status: 'mastered'}

2. Backend validates transition:
   → Current status: active
   → Requested status: mastered
   → Allowed? Check VALID_TRANSITIONS['active'] → ['mastered', 'suspended', 'discontinued']
   → ✓ Yes, allowed

3. Transition succeeds:
   → UPDATE learner_protocols SET status='mastered', updated_at=NOW() WHERE id=[id]
   → INSERT axis_audit_logs {table_name: 'learner_protocols', record_id: [id], action: 'UPDATE', new_values: {status: 'mastered'}, user_id: [therapist_id]}

4. Next state options for this protocol:
   → Generalization (to test in other settings)
   → Maintenance (regular probes to ensure skill is retained)
   → Regression (if probes drop below 70%)

5. If therapist tries active → discontinued (skipping mastered):
   → TransitionError: "Transição proibida: active → discontinued. Transição não listada..."
   → Forbidden
```

---

## NOTIFICATIONS (FCM)

### Scheduled Reminders Service

**Table**: `scheduled_reminders`
```sql
{
  id, tenant_id, session_id, patient_id,
  recipient_type ('patient' only),
  scheduled_time, title, message, reminder_type ('24h' or '10m'),
  sent, sent_at
}
```

**Rules**:
- Reminders go to **PATIENT ONLY** (never therapist)
- Maximum 2 reminders per session: 24h before + 10 min before
- Only scheduled if patient authorized push (has FCM token)
- Only **logistical content** (time, location), never clinical

**Cron Job** (`/api/cron/reminders`):
- Runs every 60 seconds
- Fetches pending reminders where `scheduled_time <= NOW() AND sent = false`
- Sends via Firebase Cloud Messaging (`sendEachForMulticast`)
- Removes invalid tokens (expired registrations)
- Marks as sent with `sent_at` timestamp

**Flow**:
```
1. POST /api/aba/sessions/[id]/schedule {scheduled_at}
   → scheduleSessionReminders() creates 2 records

2. Cron every 60s:
   → Check scheduled_reminders table
   → For each pending reminder:
      a. Fetch patient FCM tokens (patient_push_tokens)
      b. Send: {title: "Sessão em 10 minutos", body: "Sua sessão começa em breve", data: {type: 'session_reminder'}}
      c. Remove invalid tokens
      d. Mark sent=true, sent_at=NOW()

3. Patient receives push notification on device
```

---

## TESTING & VERIFICATION

### Unit Tests
- `src/test-cso.ts`: CSO-ABA calculation (SAS, PIS, BSS, TCM)
- `src/test-suggestion.ts`: Suggestion engine rule evaluation
- `src/test-tcc-extractor.ts`: TCC event processing
- Run: `npm test` or `npm run test:coverage`

### Manual Testing Data
- **Demo tenant**: 123e4567-e89b-12d3-a456-426614174000
- **Test learners**:
  - João Paulo: be7bb2ec-a4e2-4609-894c-1577655e23df (Level 2)
  - Laura Oliveira: a2222222-2222-2222-2222-222222222222 (Level 2)
  - Miguel Santos: a1111111-1111-1111-1111-111111111111 (Level 1)

---

## ROADMAP & COMPLETENESS

### Completed (100%)
- Logo & branding
- CSO-ABA motor v1.0.0
- Protocol lifecycle state machine (10 states)
- ABA dashboard with CSO evolution graph
- Alerts (regression detection)
- PEI (Programa de Educação Individualizado)
- 28 EBP Practices modal
- Family portal (read-only)
- Guardian consent system (LGPD)
- Push notifications + reminder scheduler
- Multi-therapist support
- 75+ API endpoints

### In Progress (Phase 2)
- Generalization tab (3×2 validation UI)
- Maintenance/probe management
- Dashboard KPI refinement
- Graph embedding in PDF reports

### Planned (Phase 3)
- Bulk protocol management
- Advanced analytics (trend analysis, predictive insights)
- Mobile app (React Native)
- Backup automation
- Multi-language support (currently pt-BR only)

### Future (Phase 4)
- Billing (Stripe)
- Multi-domain per clinic
- Advanced RAG (Retrieval-Augmented Generation) for clinical notes
- AI-assisted session transcription
- Real-time collaboration (therapist + supervisor co-view)

---

## KEY FILES BY DOMAIN

### ABA Implementation
- `/src/engines/cso-aba.ts` — CSO-ABA formula (SAS, PIS, BSS, TCM)
- `/src/engines/protocol-lifecycle.ts` — Protocol state machine
- `/src/engines/suggestion.ts` — Clinical recommendation engine
- `/app/aba/dashboard/page.tsx` — Main dashboard
- `/app/aba/aprendizes/[id]/page.tsx` — Learner detail + protocols

### Family Portal
- `/app/portal/[token]/page.tsx` — Public family view
- `/app/api/portal/[token]/route.ts` — Portal data endpoint
- `/app/api/portal/invite/route.ts` — Generate invite links
- `/app/api/aba/guardians/route.ts` — Guardian CRUD
- `/app/api/aba/consents/route.ts` — Consent management

### Database & Auth
- `/src/database/db.ts` — PostgreSQL connection pool
- `/src/database/with-tenant.ts` — Multi-tenancy wrapper
- `/src/database/with-role.ts` — Role-based access filter
- `/src/middleware/rate-limit.ts` — Rate limiting (Redis)

### Notifications
- `/src/services/scheduler.ts` — Cron job for reminders
- `/src/services/reminders.ts` — Reminder scheduling logic
- `/src/services/push-sender.ts` — Firebase Cloud Messaging

### Integration
- `/app/api/aba/google/route.ts` — Google Calendar OAuth
- `/app/api/aba/google/sync/route.ts` — Session sync to Calendar
- `/app/api/aba/google/webhook/route.ts` — Calendar change webhook

---

## CRITICAL RULES & CONSTRAINTS

1. **CSO Immutability**: NEVER UPDATE `clinical_states_aba`—always INSERT new records
2. **Protocol State Machine**: Only 10 states, limited transitions (Bible S3)
3. **Audit Trail**: Every UPDATE/DELETE logged to `axis_audit_logs` (append-only)
4. **Multi-Tenancy**: All queries must filter by `tenant_id`
5. **Role-Based Access**: Therapists see only their linked learners
6. **Family Portal Data**: NEVER expose CSO scores, behavioral intensity, or clinical details
7. **Consent**: Guardian must consent before family portal access (LGPD)
8. **Reminders**: Patient only, logistical content only, max 2 per session
9. **Soft Deletes**: Use `deleted_at` (LGPD compliance), never hard delete
10. **Engine Version**: Track `cso_version` and `engine_version` in all scientific records

---

## DEPLOYMENT CHECKLIST

- [ ] PostgreSQL 14+ database running
- [ ] `.env` file with database credentials, Firebase keys, Clerk tokens
- [ ] `npm install && npm run next:build`
- [ ] `pm2 start ecosystem.config.cjs`
- [ ] Verify `/api/aba/me` returns current user
- [ ] Test family portal invite link generation
- [ ] Verify Firebase notifications (FCM tokens registered)
- [ ] Test protocol state transitions (should enforce rules)
- [ ] Check audit logs for every data change
- [ ] Backup database regularly (LGPD requirement)

---

## CONCLUSION

AXIS ABA is a **scientifically rigorous, multi-tenant clinical platform** designed specifically for ABA protocol management in Brazil. It enforces the "Bible" standard (v2.6.1) through code, maintains immutable audit trails for compliance, and provides both therapist and family-facing interfaces with appropriate data isolation.

The CSO-ABA engine is the intellectual core—combining four dimensions (acquisition, independence, stability, consistency) into a single clinically meaningful score. The family portal bridges the therapy-family gap while protecting sensitive clinical data through token-based, consent-gated access.

Production readiness (30%) reflects incomplete testing, documentation, and scaling validation, not missing features. The core system is architecturally sound and feature-complete for ABA clinical use.

