# AXIS ABA - Quick Reference Guide
## API Patterns, Code Examples & Common Tasks

---

## PATTERN 1: Multi-Tenant API Route

### Template
```typescript
// app/api/aba/[endpoint]/route.ts
import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError, requireAdminOrSupervisor, learnerFilter } from '@/src/database/with-role'

export async function GET(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      // ctx.tenantId, ctx.userId, ctx.profileId, ctx.role, ctx.client
      
      // Admin/supervisor sees all
      // Terapeuta filtered by learner_therapists
      const filter = learnerFilter(ctx, 2)
      
      const res = await ctx.client.query(
        `SELECT * FROM some_table WHERE tenant_id = $1 ${filter.clause}`,
        [ctx.tenantId, ...filter.params]
      )
      
      return NextResponse.json({ data: res.rows })
    })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
```

### Real Example: Dashboard
See: `app/api/aba/dashboard/route.ts`
- Caches results in Redis (5-min TTL)
- Admin/supervisor: clinic-wide KPIs
- Terapeuta: personal KPIs only

---

## PATTERN 2: State Machine Transition

### Template
```typescript
// Validate transition
import { VALID_TRANSITIONS, TransitionError } from '@/src/engines/protocol-lifecycle'

const targetStatus = 'mastered'
const currentStatus = 'active'

const allowed = VALID_TRANSITIONS[currentStatus]
if (!allowed.includes(targetStatus)) {
  throw new TransitionError(currentStatus, targetStatus, 'Not a valid transition')
}

// Update in DB (trigger will log to audit_logs)
await ctx.client.query(
  `UPDATE learner_protocols SET status = $1, updated_at = NOW() WHERE id = $2`,
  [targetStatus, protocolId]
)
```

### Real Example: Protocol Update
See: `app/api/aba/protocols/[id]/route.ts`
- PATCH handler validates transition
- Updates status field
- Trigger automatically logs to `axis_audit_logs`

---

## PATTERN 3: CSO-ABA Calculation

### Quick Reference
```typescript
import * as csoEngine from '@/src/engines/cso-aba'

// Calculate all 4 dimensions
const result = csoEngine.computeFullCsoAba({
  activeTargets: [
    { score: 85, trials: 20 },
    { score: 70, trials: 15 }
  ],
  masteredTargets: [
    { status: 'mastered', score: 95 }
  ],
  promptLevels: ['independente', 'gestual'],
  behaviorIntensity: 'moderada',
  trendFactor: 0.95,  // 95% consistency
  sessionScores: [80, 85, 82, 78, 80]
})

console.log(result)
// {
//   sas: 82,
//   pis: 90,
//   bss: 72,
//   tcm: 88,
//   csoAba: 83,
//   faixa: 'bom'
// }
```

### Interpretation
- **85-100**: Excelente (on target)
- **70-84**: Bom (on track)
- **50-69**: Atenção (needs intervention)
- **0-49**: Crítico (urgent)

### Real Implementation
See: `app/api/aba/clinical-state/route.ts`
- Called after each session ends
- Stores snapshot in `clinical_states_aba`
- Immutable (cannot be modified later)

---

## PATTERN 4: Learner Detail Page (Complex Frontend)

### Structure
```typescript
// app/aba/aprendizes/[id]/page.tsx

export default function LearnerDetailPage() {
  const [learner, setLearner] = useState<Learner|null>(null)
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [csoHistory, setCsoHistory] = useState<CSOPoint[]>([])
  const [tab, setTab] = useState<'protocols'|'sessions'|'cso'|'guardians'>('protocols')

  useEffect(() => {
    // Fetch learner detail
    fetch(`/api/aba/learners?id=${learnerId}`)
    
    // Fetch protocols
    fetch(`/api/aba/protocols?learner_id=${learnerId}`)
    
    // Fetch sessions
    fetch(`/api/aba/sessions?learner_id=${learnerId}`)
    
    // Fetch CSO history
    fetch(`/api/aba/learners/${learnerId}/cso-history`)
  }, [learnerId])

  return (
    <>
      {/* Tabs: Protocols, Sessions, CSO Graph, Guardians */}
      {tab === 'protocols' && <ProtocolsList protocols={protocols} />}
      {tab === 'sessions' && <SessionsList sessions={sessions} />}
      {tab === 'cso' && <MiniChart data={csoHistory} />}
      {tab === 'guardians' && <GuardiansList learner={learner} />}
    </>
  )
}
```

### Key Features
- Multi-tab interface (protocols, sessions, CSO, guardians)
- Protocol state transitions (modal-based)
- Guardian management (add/remove)
- PEI goal linking (via modal)
- Session history with filter

See: Full implementation in `app/aba/aprendizes/[id]/page.tsx` (~400 lines)

---

## PATTERN 5: Protocol Linking to PEI

### Frontend
```typescript
// In learner detail page
const [linkingPeiProtocolId, setLinkingPeiProtocolId] = useState<string|null>(null)
const [linkingPeiGoalId, setLinkingPeiGoalId] = useState('')

const handleLinkPei = async (protocolId: string) => {
  const res = await fetch(`/api/aba/protocols/${protocolId}`, {
    method: 'PATCH',
    body: JSON.stringify({ pei_goal_id: linkingPeiGoalId || null })
  })
  if (res.ok) {
    // Refresh data
    fetchData()
    setLinkingPeiProtocolId(null)
  }
}
```

### Backend
```typescript
// app/api/aba/protocols/[id]/route.ts
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { pei_goal_id } = await request.json()
  
  await ctx.client.query(
    `UPDATE learner_protocols SET pei_goal_id = $1 WHERE id = $2 AND tenant_id = $3`,
    [pei_goal_id, params.id, ctx.tenantId]
  )
  
  return NextResponse.json({ success: true })
}
```

### PEI Table Schema
```sql
CREATE TABLE pei_plans (
  id UUID PRIMARY KEY,
  learner_id UUID NOT NULL,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (learner_id) REFERENCES learners(id)
)

CREATE TABLE pei_goals (
  id UUID PRIMARY KEY,
  pei_plan_id UUID NOT NULL,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,  -- 'Comunicação', 'Social', etc.
  target_pct INT DEFAULT 80,
  notes TEXT,
  FOREIGN KEY (pei_plan_id) REFERENCES pei_plans(id)
)

-- Link protocol to goal
ALTER TABLE learner_protocols ADD COLUMN pei_goal_id UUID;
```

---

## PATTERN 6: Regression Detection & Alerts

### How It Works
```typescript
// Clinical states snapshot (after session)
{
  cso_aba: 72,      // CSO score
  cso_band: 'bom'   // Faixa
}

// Previous snapshot
{
  cso_aba: 85,
  cso_band: 'bom'
}

// Detected regression if:
// 1. Current CSO < previous CSO by 15+ points
// 2. OR band changed from 'bom' → 'atenção'/'critico'

// Increment regression_count on protocol
UPDATE learner_protocols 
SET regression_count = regression_count + 1, status = 'regression'
WHERE id = protocol_id
```

### Alert Display
See: `app/aba/page.tsx`
```typescript
if (alerts.length > 0) {
  return (
    <section>
      <h2>Alertas Ativos</h2>
      {alerts.map(a => (
        <Link href={`/aba/aprendizes/${a.learner_id}`}>
          {a.learner_name}: Regressão detectada
          Protocolo: {a.protocol_title}
        </Link>
      ))}
    </section>
  )
}
```

See: `app/api/aba/alerts/route.ts` for calculation

---

## PATTERN 7: CSO Evolution Graph (SVG Inline)

### Mini Chart Component
```typescript
function MiniChart({ data, width=600, height=180 }: { data: CSOPoint[] }) {
  if (!data.length) return <div>Sem dados</div>
  
  const pad = { t:10, r:10, b:25, l:35 }
  const cW = width-pad.l-pad.r, cH = height-pad.t-pad.b
  
  // Map data points to SVG coordinates
  const pts = data.map((d,i) => ({
    x: pad.l+(i/(data.length-1))*cW,
    y: pad.t+cH-(d.cso_aba/100)*cH,
    cso: d.cso_aba,
    date: d.session_date
  }))
  
  // Draw zones (background)
  const zones = [
    { y2: 40, c: '#fef2f2' },  // Crítico
    { y2: 55, c: '#fffbeb' },  // Alerta
    { y2: 70, c: '#eff6ff' },  // Moderado
    { y2: 85, c: '#f0fdf4' },  // Bom
    { y2: 100, c: '#ecfdf5' }  // Excelente
  ]
  
  // Draw line + area
  const line = pts.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ')
  const area = line + ` L ${pts[pts.length-1].x} ${pad.t+cH} L ${pts[0].x} ${pad.t+cH} Z`
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Background zones */}
      {zones.map((z,i) => (
        <rect fill={z.c} y={pad.t+cH-(z.y2/100)*cH} height={(z.y2/100)*cH} />
      ))}
      {/* Line */}
      <path d={line} fill="none" stroke="#e07a2f" strokeWidth={2} />
      {/* Area */}
      <path d={area} fill="#e07a2f" opacity={0.15} />
      {/* Points */}
      {pts.map((p,i) => (
        <circle cx={p.x} cy={p.y} r={4} fill="white" stroke={bandColors[getBand(p.cso)]} />
      ))}
    </svg>
  )
}
```

See: Real implementation in `app/aba/dashboard/page.tsx`

---

## PATTERN 8: Session Recording Interface

### Frontend Structure
```typescript
export default function SessionDetailPage() {
  const [session, setSession] = useState<SessionABA|null>(null)
  const [trials, setTrials] = useState<Trial[]>([])
  const [recording, setRecording] = useState(false)
  
  const startSession = async () => {
    await fetch(`/api/aba/sessions/${sessionId}/start`, { method: 'POST' })
    setRecording(true)
  }
  
  const recordTrial = async (trial: Trial) => {
    await fetch(`/api/aba/sessions/${sessionId}/trials`, {
      method: 'POST',
      body: JSON.stringify({
        trial_number: trials.length + 1,
        target_id: trial.target_id,
        prompt_level: trial.prompt,
        score: trial.score
      })
    })
    setTrials([...trials, trial])
  }
  
  const endSession = async () => {
    await fetch(`/api/aba/sessions/${sessionId}/end`, { method: 'POST' })
    setRecording(false)
    // CSO-ABA recalculated automatically
  }
  
  return (
    <>
      {recording ? (
        <TrialRecorder onRecord={recordTrial} onFinish={endSession} />
      ) : (
        <SessionSummary trials={trials} />
      )}
    </>
  )
}
```

See: Implementation in `app/aba/sessoes/[id]/page.tsx`

---

## COMMON TASKS

### Task: Add a New Dashboard Metric

1. **Add to API** (`app/api/aba/dashboard/route.ts`)
   ```typescript
   const newMetric = await ctx.client.query(
     `SELECT COUNT(*) as value FROM some_table WHERE ...`
   )
   ```

2. **Add to return object**
   ```typescript
   return NextResponse.json({
     total_learners: ...,
     new_metric: newMetric.rows[0].value  // Add here
   })
   ```

3. **Add to UI** (`app/aba/page.tsx`)
   ```typescript
   <div className="p-4 rounded-xl border border-slate-200">
     <p className="text-[10px] text-slate-400">New Metric</p>
     <p className="text-2xl font-light">{data?.new_metric || 0}</p>
   </div>
   ```

### Task: Create a New API Route

1. Create file: `app/api/aba/[endpoint]/route.ts`
2. Use `withTenant()` wrapper
3. Use `handleRouteError()` for error handling
4. Use `learnerFilter()` for role-based filtering
5. Test with curl or Postman

### Task: Add a New Protocol State

1. Update `PROTOCOL_STATUSES` in `src/engines/protocol-lifecycle.ts`
2. Add transitions in `VALID_TRANSITIONS` map
3. Update `protocolStatusLabels` & `protocolStatusColors` in any UI that shows protocols
4. Test state machine validation in tests

### Task: Filter Data by Therapist

```typescript
// In API route
const filter = sessionFilter(ctx, 2)  // Use param index 2

const res = await ctx.client.query(
  `SELECT * FROM sessions_aba WHERE tenant_id = $1 ${filter.clause}`,
  [ctx.tenantId, ...filter.params]
)
```

### Task: Add Role-Based Permission

```typescript
// In API route
import { requireAdminOrSupervisor } from '@/src/database/with-role'

return await withTenant(async (ctx) => {
  requireAdminOrSupervisor(ctx)  // Throws 403 if terapeuta
  // ... continue with admin-only logic
})
```

### Task: Cache API Response (Redis)

```typescript
import { cache } from '@/src/database/redis'

const key = `my:cache:key:${ctx.tenantId}`
const data = await cache.wrap(key, 300, async () => {
  // Fetch logic here
  return result
})
```

---

## FILE SIZES & COMPLEXITY

| File | Lines | Complexity | Purpose |
|------|-------|-----------|---------|
| `src/engines/cso-aba.ts` | 200 | Medium | CSO algorithm |
| `src/engines/protocol-lifecycle.ts` | 120 | Medium | State machine |
| `app/aba/aprendizes/[id]/page.tsx` | 400+ | High | Learner detail (most complex page) |
| `app/api/aba/dashboard/route.ts` | 150 | High | Multi-role dashboard logic |
| `app/aba/page.tsx` | 150 | Low | Dashboard UI |
| `app/aba/sessoes/page.tsx` | 200 | Medium | Session list |
| `src/database/with-tenant.ts` | 60 | Low | Tenant wrapper |
| `src/database/with-role.ts` | 100 | Medium | RBAC helpers |

---

## DEBUGGING TIPS

### Check Tenant Context
```typescript
console.log('Tenant:', ctx.tenantId)
console.log('User:', ctx.userId)
console.log('Profile:', ctx.profileId)
console.log('Role:', ctx.role)
```

### Verify Database Connection
```typescript
const result = await ctx.client.query('SELECT NOW()')
console.log('DB alive:', result.rows[0])
```

### Check Redis Cache
```typescript
import { cache } from '@/src/database/redis'

const value = await cache.client.get('some:key')
console.log('Cached:', value)
```

### Trace State Transition
```typescript
// Check audit_logs
SELECT * FROM axis_audit_logs 
WHERE resource = 'learner_protocols' 
AND resource_id = 'protocol-uuid'
ORDER BY created_at DESC
LIMIT 10
```

### View CSO Calculation
```sql
SELECT 
  learner_id,
  cso_aba,
  sas, pis, bss, tcm,
  cso_band,
  created_at
FROM clinical_states_aba
WHERE learner_id = 'learner-uuid'
ORDER BY created_at DESC
LIMIT 20
```

---

## PERFORMANCE NOTES

- Dashboard queries cached 5 minutes (Redis)
- Learner pages fetch 3 endpoints in parallel (Promise.all)
- Session recording streams data (not batch updates)
- Large reports generated server-side (avoid client PDF generation)
- Regression detection runs on session end (synchronous)

---

**Last Updated**: 2026-02-25
**Related**: AXIS_CODE_MAP.md (main documentation)

