# AXIS - Guardrails (Non-Negotiable System Rules)

These rules protect the clinical integrity of the AXIS platform.

## 1 - Clinical Authority
AXIS NEVER makes clinical decisions. The system may organize data, calculate indicators, generate optional suggestions. It must NEVER diagnose, prescribe therapy, or execute clinical actions automatically.

## 2 - No Automated Clinical Actions
Claude must never generate code that automatically applies interventions, changes clinical states without human confirmation, or triggers clinical actions from AI suggestions.

## 3 - Immutable Clinical History
Clinical history must never be overwritten. AXIS uses append-only model. Allowed: INSERT. Not allowed: UPDATE/DELETE historical clinical records.

## 4 - Deterministic Clinical Engines
All clinical engines (CSO-TCC v3.0.0, CSO-ABA v2.6.1) must be deterministic. Calculations must be explicit, traceable, reproducible.

## 5 - Separation of Layers
AXIS strictly separates: 1) structured system data, 2) automated deterministic text, 3) professional clinical notes. Never merge these layers.

## 6 - Suggestion Engine Limits
Maximum 1 suggestion per cycle. Optional (system may remain silent). Never executed automatically. Always auditable.

## 7 - Audit Logging
Critical actions must generate logs: session start/end, protocol changes, report generation, suggestion approval.

## 8 - Multi-Tenant Isolation
All queries must filter by tenant_id. No cross-tenant data access. RLS enforced.

## 9 - Versioned Clinical Engines
Every record stores engine_version. Never retroactively recompute historical results.

## 10 - When Uncertain
Claude must STOP and ask for clarification before generating code that may affect clinical calculations, historical records, or engine logic.

**Final Principle:** Safety, traceability, determinism, auditability. Never prioritize convenience over clinical integrity.
