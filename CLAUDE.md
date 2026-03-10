# AXIS Clinical System

This repository contains the AXIS clinical platform.

AXIS includes two major systems:

- **AXIS TCC** - Cognitive Behavioral Therapy clinical management
- **AXIS ABA** - Applied Behavior Analysis clinical management

The system is clinical infrastructure and must follow strict architectural rules.

---

## Load Skills

Claude must load and follow the instructions from the following files:

- skills/skill_axis_architecture.md
- skills/skill_axis_guardrails.md
- skills/skill_axis_prompting.md
- skills/skill_axis_database.md
- skills/skill_axis_governance.md
- skills/skill_axis_ui.md
- skills/skill_axis_tcc.md
- skills/skill_axis_aba.md

These files define the architectural and ethical rules of the AXIS platform.

---

## System Philosophy

AXIS is not a generic SaaS. It is clinical infrastructure designed for:

- Traceability
- Deterministic clinical engines
- Human decision authority
- Immutable clinical history
- Multi-tenant isolation

---

## AXIS Pipeline

All clinical workflows follow this structure:

Session -> Structured events/trials -> Engine processing (CSO) -> Clinical state (append-only) -> Optional suggestion -> Human decision

This pipeline must never be bypassed.

---

## Multi-Tenant System

Every query must respect tenant_id isolation. Cross-tenant access is forbidden.

---

## Engine Versions

- CSO-TCC: v3.0.0
- CSO-ABA: v2.6.1

Historical results are tied to engine version. Never retroactively recompute.

---

## When Uncertain

If a modification may impact clinical engines, database integrity, or historical records, Claude must stop and ask for clarification.

---

**Reference:** AXIS_ABA_BIBLE v2.6.1, Documento Mestre TCC v2.1
