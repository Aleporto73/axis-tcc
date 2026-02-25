# AXIS ABA - Complete Code Structure Map
## Generated: 2026-02-25

---

## EXECUTIVE SUMMARY

**AXIS ABA** is a clinical-grade, web-based platform for Applied Behavior Analysis (ABA) therapy management. It features:

- **Multi-tenant architecture** with role-based access control (admin, supervisor, terapeuta)
- **CSO-ABA Engine v2.6.1**: AI-powered clinical scoring system with 4 weighted dimensions
- **Protocol Lifecycle Management**: 10 protocol states with strict state machine validation
- **Real-time Session Tracking**: With clinical state snapshots and regression detection
- **PEI Integration**: Individualized Educational Plans linked to therapeutic protocols
- **Guardian Portal**: Real-time family access to learner progress
- **LGPD Compliance**: Data export & deletion workflows
- **Firebase & Clerk**: Authentication & real-time data sync
- **PostgreSQL + Redis**: Persistent storage with caching layer

**Stack**: Next.js 16 + TypeScript + Tailwind CSS + PostgreSQL + Redis
**Status**: 50% features complete, 30% production-ready (as of Feb 23, 2026)

---

## DIRECTORY STRUCTURE

```
/sessions/youthful-optimistic-mccarthy/mnt/axis-tcc/
├── app/                                    # Next.js app directory
│   ├── page.tsx                            # Landing page (unauthenticated)
│   ├── layout.tsx                          # Root layout + Clerk provider
│   ├── error.tsx                           # Global error boundary
│   ├── not-found.tsx                       # 404 handler
│   │
│   ├── api/                                # API routes (RESTful)
│   │   ├── aba/                            # ABA-specific endpoints
│   │   │   ├── dashboard/route.ts          # KPI aggregation (multi-role)
│   │   │   ├── alerts/route.ts             # Regression alerts
│   │   │   ├── learners/route.ts           # Learner CRUD
│   │   │   ├── learners/[id]/cso-history   # CSO trend data
│   │   │   ├── protocols/route.ts          # Protocol lifecycle
│   │   │   ├── protocols/[id]/route.ts     # Protocol detail + transitions
│   │   │   ├── sessions/route.ts           # Session CRUD
│   │   │   ├── sessions/[id]/             # Session detail + trials
│   │   │   ├── guardians/route.ts          # Guardian management
│   │   │   ├── pei/route.ts                # PEI plans + goals
│   │   │   ├── team/route.ts               # Multi-therapist assignments
│   │   │   ├── clinical-state/route.ts     # CSO calculation endpoint
│   │   │   ├── generalization/route.ts     # Generalization probes
│   │   │   ├── maintenance/route.ts        # Maintenance probes
│   │   │   ├── reports/route.ts            # Report generation
│   │   │   ├── ebp-practices/route.ts      # EBP library (28 practices)
│   │   │   └── google/                     # Google Calendar integration
│   │   │       ├── route.ts                # OAuth flow
│   │   │       ├── callback/route.ts
│   │   │       ├── disconnect/route.ts
│   │   │       ├── sync/route.ts
│   │   │       ├── watch/route.ts
│   │   │       └── webhook/route.ts
│   │   ├── admin/                          # Admin-only endpoints
│   │   │   └── tenants/route.ts            # Multi-tenant management
│   │   ├── patients/                       # TCC module (legacy/parallel)
│   │   │   ├── route.ts                    # Patient CRUD
│   │   │   └── [id]/                       # Patient detail endpoints
│   │   ├── sessions/                       # Generic session endpoints
│   │   │   └── [id]/                       # Session detail + reports
│   │   ├── user/                           # User profile management
│   │   │   ├── profile/route.ts
│   │   │   ├── licenses/route.ts
│   │   │   ├── tenant/route.ts
│   │   │   └── accept-terms/route.ts
│   │   ├── portal/                         # Guardian portal
│   │   │   ├── [token]/route.ts            # Magic link authentication
│   │   │   └── invite/route.ts
│   │   ├── push/                           # Push notifications
│   │   │   ├── register/route.ts
│   │   │   ├── subscribe/route.ts
│   │   │   └── send/route.ts
│   │   ├── cron/                           # Background jobs
│   │   │   ├── reminders/route.ts          # Session reminders
│   │   │   └── renew-webhook/route.ts
│   │   ├── demo/                           # Demo data
│   │   │   ├── data/route.ts
│   │   │   └── solicitar/route.ts
│   │   └── [various]/route.ts              # Audit, stats, suggestions, etc.
│   │
│   ├── aba/                                # ABA module (new routing)
│   │   ├── layout.tsx                      # ABA layout + sidebar
│   │   ├── page.tsx                        # Dashboard with KPIs
│   │   ├── dashboard/page.tsx              # Detailed clinical dashboard
│   │   ├── aprendizes/                     # Learners
│   │   │   ├── page.tsx                    # Learner list + create modal
│   │   │   └── [id]/                       # Learner detail
│   │   │       ├── page.tsx                # Full profile + protocols/sessions
│   │   │       ├── generalizacao/page.tsx  # Generalization probes
│   │   │       └── manutencao/page.tsx     # Maintenance probes
│   │   ├── sessoes/                        # Sessions
│   │   │   ├── page.tsx                    # Session list
│   │   │   └── [id]/page.tsx               # Session recording interface
│   │   ├── relatorios/page.tsx             # Report generation
│   │   ├── pei/page.tsx                    # PEI plans
│   │   ├── equipe/page.tsx                 # Team management
│   │   ├── configuracoes/page.tsx          # Settings
│   │   └── onboarding/page.tsx             # Onboarding flow
│   │
│   ├── admin/                              # Admin panel
│   │   ├── page.tsx
│   │   └── logs/page.tsx                   # Audit logs viewer
│   │
│   ├── hub/page.tsx                        # Module selector (TCC/ABA)
│   ├── dashboard/page.tsx                  # TCC dashboard
│   ├── pacientes/page.tsx                  # TCC patients
│   ├── sessoes/page.tsx                    # TCC sessions
│   ├── relatorio/[id]/page.tsx             # Report viewer
│   ├── sugestoes/page.tsx                  # Suggestions (TCC)
│   │
│   ├── components/                         # React components
│   │   ├── Sidebar.tsx                     # TCC sidebar
│   │   ├── SidebarABA.tsx                  # ABA sidebar
│   │   ├── RoleProvider.tsx                # Role context
│   │   ├── TermsModal.tsx                  # Terms acceptance
│   │   ├── OnboardingTooltip.tsx
│   │   ├── OnboardingOverlay.tsx
│   │   ├── PushNotificationSetup.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── SessionReport.tsx               # PDF report viewer
│   │   ├── EvolutionReport.tsx
│   │   ├── Toast.tsx                       # Notifications
│   │   └── ui/Button.tsx
│   │
│   ├── hooks/
│   │   └── useOnboarding.ts
│   │
│   ├── lib/
│   │   ├── firebase.ts                     # Firebase client config
│   │   ├── utils.ts                        # Helper functions
│   │   └── pdf-font.ts                     # PDF font loading
│   │
│   └── styles/
│       └── globals.css                     # Tailwind + custom styles
│
├── src/                                    # TypeScript backend logic
│   ├── engines/                            # Clinical calculation engines
│   │   ├── cso-aba.ts                      # CSO-ABA algorithm (v1.0.0)
│   │   ├── cso.ts                          # Original CSO (TCC)
│   │   ├── protocol-lifecycle.ts           # State machine validator
│   │   └── suggestion.ts                   # AI-powered suggestions
│   │
│   ├── services/                           # Business logic services
│   │   ├── reminder-scheduler.ts           # Cron job orchestration
│   │   ├── reminder.ts                     # Session reminders
│   │   ├── push-sender.ts                  # Push notification delivery
│   │   └── scheduler.ts                    # Job scheduling
│   │
│   ├── database/                           # DB access layer
│   │   ├── db.ts                           # PostgreSQL pool
│   │   ├── redis.ts                        # Redis client + cache wrapper
│   │   ├── with-tenant.ts                  # Tenant context wrapper
│   │   └── with-role.ts                    # RBAC filters & checks
│   │
│   ├── middleware/
│   │   └── rate-limit.ts
│   │
│   ├── lib/
│   │   └── firebase.ts                     # Firebase admin SDK
│   │
│   ├── assist/                             # AI assistants
│   │   ├── session-summarizer.ts           # Session summary generation
│   │   └── tcc-extractor.ts                # TCC insights extraction
│   │
│   ├── google/
│   │   └── calendar-helpers.ts             # Google Calendar API helpers
│   │
│   ├── email/
│   │   └── session-summary-template.ts     # Email templates (Resend)
│   │
│   ├── types/                              # TypeScript interfaces
│   │   ├── cso.ts                          # CSO data types
│   │   ├── event.ts                        # Event/audit types
│   │   ├── suggestion.ts
│   │   └── index.ts
│   │
│   ├── tests/                              # Unit tests (Vitest)
│   │   ├── cso-engine.test.ts
│   │   └── protocol-lifecycle.test.ts
│   │
│   ├── test-*.ts                           # Manual test scripts
│   │   ├── test-cso.ts
│   │   ├── test-openai.ts
│   │   ├── test-suggestion.ts
│   │   ├── test-summarizer.ts
│   │   └── test-tcc-extractor.ts
│   │
│   ├── setup-test-data.ts                  # Database seeding
│   └── index.ts                            # Unused (legacy)
│
├── middleware.ts                           # Next.js middleware (Clerk)
├── next.config.ts                          # Next.js configuration
├── tailwind.config.js                      # Tailwind CSS config
├── tsconfig.json                           # TypeScript config
├── package.json                            # Dependencies
├── package-lock.json
│
├── docs/                                   # Documentation
│   └── [various .md files]
│
├── .env                                    # Environment variables
├── .env.example
├── .gitignore
│
├── SQL migrations/                         # Database schema
│   ├── axis_tcc_init.sql                   # Main schema
│   ├── add_profiles_table.sql              # Multi-role support
│   ├── add_lgpd_deletion_columns.sql       # LGPD compliance
│   └── [other .sql files]
│
├── ecosystem.config.cjs                    # PM2 config
├── docker-compose.yml                      # Docker setup
└── [other config files]
```

---

## KEY MODULES & THEIR ROLES

### 1. **CSO-ABA Engine** (`src/engines/cso-aba.ts`)

**Purpose**: Clinical Scoring Objective for ABA — main intelligence system

**Formula**:
```
CSO-ABA = (0.25 × SAS) + (0.25 × PIS) + (0.25 × BSS) + (0.25 × TCM)
```

**Four Dimensions**:

| Dimension | Full Name | Calculation | Scale |
|-----------|-----------|-------------|-------|
| **SAS** | Skill Acquisition Score | Weighted average of active target scores + mastery rate | 0-100 |
| **PIS** | Prompt Independence Score | Mean of prompt levels (indep=1.0 to total=0.0) × 100 | 0-100 |
| **BSS** | Behavioral Stability Score | 100 × (1 - intensity) × trend_factor | 0-100 |
| **TCM** | Therapeutic Consistency Metric | 100 × (1 - CV of last 5 sessions) | 0-100 |

**Interpretation Bands**:
- **Excelente** (85-100): Target is being exceeded
- **Bom** (70-84): On track
- **Atenção** (50-69): Requiring intervention
- **Crítico** (0-49): Urgent escalation needed

**Key Files**:
- `src/engines/cso-aba.ts` - Implementation
- `src/types/cso.ts` - Data types
- `src/tests/cso-engine.test.ts` - Unit tests
- `app/api/aba/clinical-state/route.ts` - API endpoint

---

### 2. **Protocol Lifecycle Engine** (`src/engines/protocol-lifecycle.ts`)

**Purpose**: State machine validation for therapeutic protocols

**10 Official States** (Bible S3):
```
draft → active → mastered → generalization → maintenance → maintained → archived
       ↗ suspended ↖ (can return to active)
       ↗ discontinued (terminal)
       ↗ regression (returns to active)
```

**Transition Rules**:
- `draft` → [active, archived]
- `active` → [mastered, suspended, discontinued]
- `mastered` → [generalization, regression]
- `generalization` → [maintenance, regression]
- `maintenance` → [maintained, regression]
- `maintained` → [archived, regression]
- `regression` → [active]
- `suspended` → [active, discontinued]
- `discontinued` → [terminal]
- `archived` → [terminal]

**Key Features**:
- Immutable transitions (enforced by DB triggers)
- Audit logging on every transition
- Regression counting (protocol_count field)
- 30-day suspension limit with auto-alerting

**Triggers** (PostgreSQL):
- `trg_learner_protocols_transition_audit` - Logs all state changes
- `trg_clinical_states_immutable` - Prevents historical data modification
- `trg_session_snapshots_immutable` - Freezes session records

---

### 3. **Multi-Tenant & RBAC System**

**Location**: `src/database/with-tenant.ts` + `src/database/with-role.ts`

**Architecture**:
```
Clerk User → Profile (tenant_id + role) → Learner Access
                                        → Session Filter
                                        → Protocol Visibility
```

**3 Roles**:
1. **admin** - Full clinic access, can modify all data
2. **supervisor** - Oversight + reporting, can reassign therapists
3. **terapeuta** - Limited to own learners and sessions

**Key Patterns**:

```typescript
// Get tenant context with role
const ctx = await withTenant(async (ctx) => {
  // ctx.tenantId, ctx.userId, ctx.profileId, ctx.role, ctx.client
})

// Filter learners by role
const filter = learnerFilter(ctx, paramIndex)
// Admin/supervisor: no filter
// Terapeuta: only learners in learner_therapists table

// Filter sessions by role
const filter = sessionFilter(ctx, paramIndex)
// Admin/supervisor: no filter
// Terapeuta: therapist_id = ctx.userId

// Check specific learner access
const canAccess = await canAccessLearner(ctx, learnerId)
```

---

### 4. **Dashboard & KPI System**

**Location**: `app/api/aba/dashboard/route.ts`

**Cached KPIs** (Redis, 5-min TTL):

| Metric | Type | Calculation |
|--------|------|-------------|
| `total_learners` | int | Count active learners |
| `sessions_today` | int | Count sessions scheduled today |
| `sessions_week` | int | Count sessions last 7 days |
| `active_protocols` | int | Count status='active' |
| `mastered_protocols` | int | Count status='mastered' |
| `avg_cso` | float | Average CSO-ABA across learners |
| `learners_critical` | int | Count where cso_band='critico' |
| `mastery_rate` | % | (mastered+maintained)/total |
| `cancel_rate_30d` | % | cancelled/(total) in 30 days |
| `protocols_regression` | int | Count status='regression' |
| `total_regressions` | int | Sum of regression_count |

**Cache Keys**:
- `dashboard:aba:{tenantId}:clinic` - For admin/supervisor
- `dashboard:aba:{tenantId}:{profileId}` - Per therapist (personal view)

**Frontend Pages**:
- `app/aba/page.tsx` - Main ABA dashboard (simple KPIs)
- `app/aba/dashboard/page.tsx` - Detailed clinical dashboard (with graphs)

---

### 5. **Session Management**

**DB Table**: `sessions_aba`

**States**:
- `scheduled` - Agenda entry
- `in_progress` - Started by therapist
- `completed` - Finished + recorded
- `cancelled` - Manual cancellation

**Recorded Data**:
- `scheduled_at` - Appointment time
- `started_at` / `ended_at` - Actual duration
- `duration_minutes` - For TCM calculation
- `location` - Where session occurred
- `notes` - Therapist notes

**Related Tables**:
- `session_snapshots` - Immutable trial-by-trial data
- `clinical_states_aba` - CSO snapshot after session

**API Endpoints**:
- `GET /api/aba/sessions` - List (filtered by role)
- `POST /api/aba/sessions` - Create new session
- `GET /api/aba/sessions/[id]` - Get detail
- `PATCH /api/aba/sessions/[id]` - Update status
- `GET /api/aba/sessions/[id]/summary` - Session report
- `GET /api/aba/sessions/[id]/trials` - Detailed trial data

**Frontend Pages**:
- `app/aba/sessoes/page.tsx` - Session list
- `app/aba/sessoes/[id]/page.tsx` - Session recording interface

---

### 6. **PEI (Plano Educacional Individualizado)**

**Purpose**: Link clinical goals to ABA protocols

**DB Tables**:
- `pei_plans` - Plan metadata
- `pei_goals` - Individual goals within a plan
- `learner_protocols.pei_goal_id` - Protocol → Goal link

**Workflow**:
1. Create PEI with multiple goals (domains: comunicação, social, etc.)
2. Create ABA protocols for learner
3. Link each protocol to relevant PEI goal
4. Track progress: protocol status = goal progress

**Frontend**:
- `app/aba/pei/page.tsx` - Full PEI management
- Link/unlink protocols via modal on learner detail page

**API**:
- `GET /api/aba/pei` - List plans
- `POST /api/aba/pei` - Create plan
- `PATCH /api/aba/protocols/[id]` - Link/unlink PEI goal

---

### 7. **EBP Library** (Evidence-Based Practices)

**Table**: `ebp_practices` (28 practices hardcoded)

**Structure**:
```typescript
{
  id: number,
  name: string,          // E.g., "Discrete Trial Training"
  description: string,   // Full description
  category: string       // ABA domain
}
```

**Usage**: When creating a protocol, select EBP practice
- Links to national standard practices
- Tracks which EBPs are used
- Ensures clinical accountability

**API**: `GET /api/aba/ebp-practices`

---

### 8. **Google Calendar Integration**

**Location**: `src/google/calendar-helpers.ts` + `app/api/aba/google/*`

**Features**:
- OAuth2 connection (Google Workspace)
- Auto-sync ABA sessions to Google Calendar
- Webhook monitoring for external calendar changes
- 24-hour recurring sync jobs

**Endpoints**:
- `POST /api/aba/google` - Initiate OAuth
- `GET /api/aba/google/callback` - Handle redirect
- `POST /api/aba/google/disconnect` - Revoke access
- `POST /api/aba/google/sync` - Manual sync
- `GET /api/aba/google/status` - Check connection
- `POST /api/aba/google/webhook` - Webhook listener

**DB Storage**: `google_calendar_tokens` (encrypted)

---

### 9. **Guardian Portal**

**Purpose**: Real-time learner progress access for family

**Authentication**: Magic link tokens (no password)

**Features**:
- View learner profile + current CSO
- See evolution graph
- Read session summaries (with therapist consent)
- Receive notifications (session reminders, regression alerts)

**Endpoints**:
- `POST /api/portal/invite` - Generate magic link
- `GET /api/portal/[token]` - Authenticate + fetch data
- `GET /api/aba/portal` - Portal dashboard data

**Frontend**: `app/portal/[token]/page.tsx`

---

### 10. **Push Notifications**

**Service**: Firebase Cloud Messaging (FCM)

**Types**:
- Session reminders (1 day before)
- Regression alerts (when protocol regresses)
- Progress milestones (protocol mastered)

**Endpoints**:
- `POST /api/push/register` - Register device token
- `POST /api/push/subscribe` - Create subscription
- `POST /api/push/send` - Send notification
- `POST /api/cron/reminders` - Daily reminder job

**DB Table**: `push_subscriptions`

---

### 11. **Audit & Compliance**

**LGPD (Brazilian Data Protection)**

**Features**:
- `axis_audit_logs` - All user actions logged
- Export user data (CSV/JSON)
- Delete user + all clinical data
- 30-day grace period before actual deletion

**Endpoints**:
- `POST /api/aba/lgpd/export` - Request data export
- `POST /api/aba/lgpd/delete` - Request account deletion
- `GET /api/admin/logs` - View audit logs

**Frontend**: Admin panel at `app/admin/logs/page.tsx`

---

## PAGE ROUTES & FUNCTIONALITY

### ABA Module Routes

| Route | File | Purpose |
|-------|------|---------|
| `/aba` | `app/aba/page.tsx` | Main dashboard (KPIs, alerts) |
| `/aba/dashboard` | `app/aba/dashboard/page.tsx` | Detailed clinical dashboard |
| `/aba/aprendizes` | `app/aba/aprendizes/page.tsx` | Learner list + create |
| `/aba/aprendizes/[id]` | `app/aba/aprendizes/[id]/page.tsx` | Learner detail (protocols, sessions, CSO graph) |
| `/aba/aprendizes/[id]/generalizacao` | `app/aba/aprendizes/[id]/generalizacao/page.tsx` | Generalization probes |
| `/aba/aprendizes/[id]/manutencao` | `app/aba/aprendizes/[id]/manutencao/page.tsx` | Maintenance probes |
| `/aba/sessoes` | `app/aba/sessoes/page.tsx` | Session list (filterable) |
| `/aba/sessoes/[id]` | `app/aba/sessoes/[id]/page.tsx` | Session recording interface |
| `/aba/pei` | `app/aba/pei/page.tsx` | PEI management |
| `/aba/relatorios` | `app/aba/relatorios/page.tsx` | Report generation |
| `/aba/equipe` | `app/aba/equipe/page.tsx` | Team management (assign therapists) |
| `/aba/configuracoes` | `app/aba/configuracoes/page.tsx` | Settings |
| `/aba/onboarding` | `app/aba/onboarding/page.tsx` | Onboarding wizard |

### TCC Module Routes (Legacy/Parallel)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Landing page |
| `/hub` | `app/hub/page.tsx` | Module selector (TCC/ABA) |
| `/dashboard` | `app/dashboard/page.tsx` | TCC dashboard |
| `/pacientes` | `app/pacientes/page.tsx` | Patient list |
| `/pacientes/[id]` | `app/pacientes/[id]/page.tsx` | Patient detail |
| `/sessoes` | `app/sessoes/page.tsx` | Session list |
| `/sessoes/[id]` | `app/sessoes/[id]/page.tsx` | Session detail |
| `/relatorio/[id]` | `app/relatorio/[patientId]/page.tsx` | Report viewer |
| `/sugestoes` | `app/sugestoes/page.tsx` | Suggestions (AI) |

### Auth Routes

| Route | File | Purpose |
|-------|------|---------|
| `/sign-in/[[...sign-in]]` | `app/sign-in/[[...sign-in]]/page.tsx` | Clerk sign-in |
| `/sign-up/[[...sign-up]]` | `app/sign-up/[[...sign-up]]/page.tsx` | Clerk sign-up |

### Other Routes

| Route | File | Purpose |
|-------|------|---------|
| `/portal/[token]` | `app/portal/[token]/page.tsx` | Guardian portal |
| `/admin` | `app/admin/page.tsx` | Admin panel |
| `/admin/logs` | `app/admin/logs/page.tsx` | Audit logs |
| `/demo` | `app/demo/page.tsx` | Demo data UI |
| `/ativar-lembretes` | `app/ativar-lembretes/page.tsx` | Push notification setup |

---

## API ENDPOINTS ORGANIZED BY DOMAIN

### ABA Learners

```
GET    /api/aba/learners                       - List all learners (paginated)
POST   /api/aba/learners                       - Create learner
GET    /api/aba/learners?id=UUID               - Get specific learner
PATCH  /api/aba/learners/[id]                  - Update learner
DELETE /api/aba/learners/[id]                  - Archive learner
GET    /api/aba/learners/[id]/cso-history     - Get CSO trend data
```

### ABA Protocols

```
GET    /api/aba/protocols                      - List protocols (by learner)
POST   /api/aba/protocols                      - Create protocol
GET    /api/aba/protocols/[id]                - Get detail
PATCH  /api/aba/protocols/[id]                - Update status + link PEI
DELETE /api/aba/protocols/[id]                - Soft delete
```

### ABA Sessions

```
GET    /api/aba/sessions                       - List sessions
POST   /api/aba/sessions                       - Schedule session
GET    /api/aba/sessions/[id]                 - Get detail
PATCH  /api/aba/sessions/[id]                 - Update (start/finish)
GET    /api/aba/sessions/[id]/summary         - Get session report
GET    /api/aba/sessions/[id]/trials          - Get trial data
POST   /api/aba/sessions/[id]/behaviors       - Record trial outcome
DELETE /api/aba/sessions/[id]                 - Cancel session
```

### ABA Dashboard & Alerts

```
GET    /api/aba/dashboard                      - KPI aggregation (cached)
GET    /api/aba/alerts                         - Regression alerts
GET    /api/aba/clinical-state                - Compute CSO-ABA
POST   /api/aba/clinical-state                - Record clinical state snapshot
```

### ABA PEI & Goals

```
GET    /api/aba/pei                           - List PEI plans
POST   /api/aba/pei                           - Create PEI
GET    /api/aba/pei/[id]                      - Get plan detail
PATCH  /api/aba/pei/[id]                      - Update plan
GET    /api/aba/pei/goals                     - List goals
POST   /api/aba/pei/goals                     - Create goal
```

### ABA Team & Therapists

```
GET    /api/aba/team                          - List therapists
POST   /api/aba/team                          - Add therapist
GET    /api/aba/team/[id]                    - Get therapist detail
DELETE /api/aba/team/[id]                    - Remove therapist
GET    /api/aba/learner-therapists           - Get learner assignments
POST   /api/aba/learner-therapists           - Assign therapist to learner
```

### ABA Guardians

```
GET    /api/aba/guardians                     - List guardians for learner
POST   /api/aba/guardians                     - Add guardian
PATCH  /api/aba/guardians/[id]               - Update guardian
DELETE /api/aba/guardians/[id]               - Remove guardian
```

### Reports & Data Export

```
GET    /api/aba/reports                       - Generate report (PDF)
GET    /api/aba/generalization               - Generalization probe data
GET    /api/aba/maintenance                   - Maintenance probe data
```

### Google Calendar

```
GET    /api/aba/google                        - Get Google auth URL
GET    /api/aba/google/callback               - OAuth callback
POST   /api/aba/google/disconnect             - Disconnect calendar
GET    /api/aba/google/status                 - Check connection status
POST   /api/aba/google/sync                   - Manual sync
POST   /api/aba/google/webhook                - Calendar webhook
```

### Portal (Guardian Access)

```
POST   /api/portal/invite                     - Generate invite link
GET    /api/portal/[token]                    - Guardian authentication
GET    /api/aba/portal                        - Portal dashboard data
```

### User Management

```
GET    /api/user/profile                      - Get user profile
PATCH  /api/user/profile                      - Update profile
GET    /api/user/tenant                       - Get tenant info
POST   /api/user/accept-terms                 - Accept ToS
GET    /api/user/licenses                     - Get license status
```

### LGPD Compliance

```
POST   /api/aba/lgpd/export                   - Request data export
POST   /api/aba/lgpd/delete                   - Request deletion
```

### Push Notifications

```
POST   /api/push/register                     - Register device token
POST   /api/push/subscribe                    - Create subscription
POST   /api/push/send                         - Send notification
```

### Cron Jobs

```
POST   /api/cron/reminders                    - Daily session reminders
POST   /api/cron/renew-webhook                - Renew Google Calendar webhooks
```

### Admin

```
GET    /api/admin/tenants                     - List all tenants
POST   /api/admin/tenants                     - Create tenant
GET    /api/audit                             - Audit log viewer
GET    /api/stats                             - Usage statistics
```

---

## DATABASE SCHEMA OVERVIEW

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `learners` | Learner profiles | id, tenant_id, name, birth_date, diagnosis, support_level, is_active |
| `learner_protocols` | ABA protocols | id, learner_id, title, ebp_practice_id, domain, status, activated_at, mastered_at, regression_count, pei_goal_id |
| `sessions_aba` | Therapy sessions | id, learner_id, therapist_id, scheduled_at, started_at, ended_at, status, duration_minutes |
| `session_snapshots` | Immutable trial data | id, session_id, trial_number, target_id, behavior_type, prompt_level, score, timestamp |
| `clinical_states_aba` | CSO snapshots | id, learner_id, cso_aba, sas, pis, bss, tcm, cso_band, created_at |
| `pei_plans` | Individualized education plans | id, learner_id, title, start_date, end_date, status |
| `pei_goals` | PEI goals | id, pei_plan_id, title, domain, target_pct, notes |
| `profiles` | User profiles (multi-role) | id, tenant_id, clerk_user_id, role, is_active |
| `learner_therapists` | Therapist assignments | learner_id, profile_id, tenant_id |
| `tenants` | Organization accounts | id, name, clerk_user_id |
| `guardians` | Family members | id, learner_id, name, email, phone, relationship |
| `ebp_practices` | Evidence-based practices library | id, name, description, category |
| `engine_versions` | Clinical engine tracking | id, version, is_current |

### Audit & Compliance

| Table | Purpose |
|-------|---------|
| `axis_audit_logs` | All user actions (timestamp, user_id, action, resource, metadata) |
| `push_subscriptions` | Device registration for notifications |
| `google_calendar_tokens` | Encrypted OAuth tokens |

### Triggers

```sql
trg_learner_protocols_transition_audit        -- Log protocol state changes
trg_clinical_states_immutable                 -- Prevent modification of CSO records
trg_session_snapshots_immutable               -- Lock session trial data
```

---

## TECHNOLOGY STACK

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS 3.4 + Clsx
- **Components**: Custom (no external UI libraries)
- **Authentication**: Clerk (managed session)
- **Realtime**: Firebase Realtime Database
- **Charts**: SVG-based (inline mini charts, no D3/Recharts)

### Backend
- **Runtime**: Node.js (via Next.js API routes)
- **Language**: TypeScript
- **Database**: PostgreSQL 13+ (via pg driver)
- **Cache**: Redis (via ioredis)
- **AI/LLM**: OpenAI GPT-4 (via openai SDK)
- **Email**: Resend (SMTP alternative)
- **Cloud Storage**: Firebase Storage
- **Notifications**: Firebase Cloud Messaging (FCM)
- **Calendar**: Google Calendar API (OAuth2)

### Development & DevOps
- **Build**: Next.js + TypeScript compiler
- **Testing**: Vitest + Coverage
- **Environment**: Docker Compose (local)
- **Process Manager**: PM2 (production)
- **Version Control**: Git
- **Package Manager**: npm

### External Services
- **Auth**: Clerk (user & session management)
- **Database**: PostgreSQL (cloud or self-hosted)
- **Cache**: Redis (cloud or self-hosted)
- **Email**: Resend (transactional)
- **Notifications**: Firebase
- **AI**: OpenAI API
- **Calendar**: Google Workspace OAuth

---

## KEY DEPENDENCIES

```json
{
  "@clerk/nextjs": "^6.37.1",
  "next": "^16.1.6",
  "react": "^19.2.4",
  "typescript": "^5.9.3",
  "tailwindcss": "^3.4.19",
  "pg": "^8.18.0",
  "ioredis": "^5.9.3",
  "openai": "^6.17.0",
  "firebase": "^12.8.0",
  "firebase-admin": "^13.6.0",
  "zod": "^4.3.6",
  "jspdf": "^4.2.0",
  "pdfkit": "^0.17.2",
  "resend": "^6.9.2",
  "vitest": "^4.0.18"
}
```

---

## IMPORTANT CONSTANTS & CONFIGURATION

### Bible References
- **CSO-ABA Bible**: v2.6.1 (clinical standard)
- **Engine Version**: 1.0.0 (in cso-aba.ts)
- **Tenant ID** (test): `123e4567-e89b-12d3-a456-426614174000`

### Colors (Tailwind)
- **ABA Brand**: `#C46A2F` (orange-brown)
- Critical: `#ef4444` (red)
- Alerta: `#f59e0b` (amber)
- Moderado: `#3b82f6` (blue)
- Bom: `#22c55e` (green)
- Excelente: `#10b981` (emerald)

### Demo Learners (Test Data)
- **João Paulo**: `be7bb2ec-a4e2-4609-894c-1577655e23df` (Nível 2)
- **Laura Oliveira**: `a2222222-2222-2222-2222-222222222222` (Nível 2)
- **Miguel Santos**: `a1111111-1111-1111-1111-111111111111` (Nível 1)

### Build & Deploy
```bash
npm run next:build    # Build Next.js
npm run next:start    # Start production server
npm run next:dev      # Development server
npm run test          # Run Vitest
npm run test:watch    # Watch mode
```

---

## WHAT'S IMPLEMENTED (Status: ~50% complete)

### Complete
- CSO-ABA engine (4 dimensions)
- Protocol lifecycle state machine (10 states)
- Dashboard KPIs (13 metrics, Redis cached)
- Multi-tenant + role-based access
- Learner CRUD + detail view
- Session scheduling + recording
- PEI management + linking
- EBP library (28 practices)
- Clinical state snapshots
- Regression detection & alerts
- Google Calendar sync
- Guardian portal (read-only)
- Push notifications (basic)
- LGPD export + delete flows
- Audit logging
- Firebase integration

### In Progress / Partial
- Session detail UI (recording interface)
- Generalization probes (API exists, UI partial)
- Maintenance probes (API exists, UI partial)
- Team management (assign therapists)
- Advanced reporting (PDF generation working)
- Mobile responsiveness
- Theming & internationalization

### Not Started
- Multi-clinic white-label
- Stripe billing integration
- Advanced AI suggestions
- Full TCC module migration
- Performance optimization (indices, query tuning)
- Comprehensive automated tests
- Mobile app (native iOS/Android)

---

## HOW TO NAVIGATE THE CODE

### For Feature X, Look Here:

**"I want to understand CSO-ABA calculation"**
1. `src/engines/cso-aba.ts` - Algorithm
2. `src/types/cso.ts` - Data structures
3. `app/api/aba/clinical-state/route.ts` - API endpoint
4. `app/aba/dashboard/page.tsx` - CSO display in UI

**"I want to understand protocol lifecycle"**
1. `src/engines/protocol-lifecycle.ts` - State machine
2. `app/api/aba/protocols/[id]/route.ts` - State transitions
3. `app/aba/aprendizes/[id]/page.tsx` - UI for transitions
4. DB triggers (in SQL migration files) - Immutability enforcement

**"I want to add a new learner"**
1. `app/aba/aprendizes/page.tsx` - Form UI
2. `app/api/aba/learners/route.ts` - POST handler
3. Database: `learners` table
4. Authorization check in `with-role.ts`

**"I want to understand multi-tenancy"**
1. `src/database/with-tenant.ts` - Tenant context wrapper
2. `src/database/with-role.ts` - Role filters + checks
3. Any API route using `withTenant()` wrapper

**"I want to add a new dashboard metric"**
1. `app/api/aba/dashboard/route.ts` - Add SQL query
2. `app/aba/page.tsx` or `app/aba/dashboard/page.tsx` - Display
3. Update Redis cache key if needed
4. Update TypeScript interface at top of route

---

## ARCHITECTURE DECISIONS

### Why Monolithic Next.js?
- Simpler deployment (single process)
- Unified TypeScript codebase
- Server-side data loading (no N+1 queries)
- Built-in API routes (no separate backend)
- ISR + caching strategies

### Why PostgreSQL + Redis?
- PostgreSQL: ACID transactions, triggers for immutability, JSON columns
- Redis: Session caching, real-time subscriptions, leaderboards
- Separates hot-path reads (cache) from transactional writes (DB)

### Why CSO-ABA is Separate from Suggestions?
- CSO-ABA: Deterministic clinical score (must be auditable)
- Suggestions: AI-powered (inherently probabilistic)
- Prevent AI errors from affecting official clinical metrics

### Why Immutable Snapshots?
- HIPAA/LGPD compliance (audit trail)
- Prevent accidental data loss
- Enable historical analysis
- PostgreSQL triggers enforce (not app-level)

### Why Magic Link Portal (Not Passwords)?
- Better UX for guardians (no forgotten passwords)
- Stateless (token = permission)
- Phishing-resistant (if email is compromised, not password)

---

## DEPLOYMENT CHECKLIST

Before production:
- [ ] Set all `.env` variables (DB, API keys, OAuth credentials)
- [ ] Run database migrations (`axis_tcc_init.sql`, `add_profiles_table.sql`)
- [ ] Set up PostgreSQL triggers
- [ ] Configure Redis for session + caching
- [ ] Set up Firebase project + service account
- [ ] Create Clerk application + OAuth callbacks
- [ ] Configure Google OAuth for calendar
- [ ] Set up Resend for transactional email
- [ ] Enable HTTPS/TLS
- [ ] Set up log aggregation (CloudWatch, Datadog, etc.)
- [ ] Configure PM2 for process management
- [ ] Set up backup strategy (PostgreSQL, Firebase)
- [ ] Create admin user
- [ ] Run smoke tests (dashboard load, session create, etc.)
- [ ] Set monitoring & alerts (CPU, DB connections, error rates)

---

## USEFUL COMMANDS

```bash
# Development
npm run next:dev                      # Start dev server
npm run dev                           # Start backend (if needed)

# Testing
npm run test                          # Run Vitest
npm run test:watch                    # Watch mode
npm run test:coverage                 # Coverage report
npm run test:cso                      # CSO engine tests
npm run test:suggestion               # Suggestion engine tests

# Database
npm run setup                         # Seed test data
npm run test:summarizer              # Test AI summarization

# Build & Deploy
npm run next:build                    # Build production
npm run next:start                    # Start production server
npm run lint                          # TypeScript check (if configured)

# Utilities
tsx src/test-cso.ts                  # Manual CSO calculation test
tsx src/setup-test-data.ts           # Populate demo data
```

---

## CONTACT & SUPPORT

- **Documentation**: `/docs` directory
- **Roadmap**: `ROADMAP.md`
- **Context**: `CONTEXT-NEXT-CHAT.md`
- **Database Schema**: `axis_tcc_init.sql`
- **Issues**: (Use GitHub if repo is public)

---

**Last Updated**: 2026-02-25
**Status**: Active Development (50% feature complete)
**License**: ISC (check package.json)

