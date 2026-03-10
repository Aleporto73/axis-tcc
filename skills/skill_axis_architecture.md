# AXIS - Architecture Rules

## Core Philosophy
AXIS is clinical infrastructure designed to: organize structured clinical data, preserve longitudinal history, maintain auditability, ensure human clinical authority. The system NEVER automates clinical decisions.

## Two Systems, One Platform
| System | Focus | Engine | Patient Term |
|--------|-------|--------|--------------|
| AXIS TCC | Cognitive Behavioral Therapy | CSO-TCC v3.0.0 | Paciente |
| AXIS ABA | Applied Behavior Analysis | CSO-ABA v2.6.1 | Aprendiz |

## Shared Infrastructure
Database: PostgreSQL | Auth: Clerk | Framework: Next.js 14 | Audit: axis_audit_logs | Email: Resend
Separation by product_type + company_id (tenant)

## AXIS Pipeline
Session -> Structured events/trials -> Engine processing (CSO) -> Clinical state (append-only) -> Optional suggestion -> Human decision

## Directory Structure
app/aba/ = AXIS ABA routes
app/api/aba/ = ABA API endpoints
app/api/ (root) = TCC API endpoints
src/engines/cso.ts = CSO-TCC engine
src/engines/cso-aba.ts = CSO-ABA engine

## What Claude Must NOT Do
- Introduce automatic decision logic
- Overwrite clinical history
- Create opaque AI reasoning
- Bypass audit logging
- Mix TCC and ABA logic in same files
- Break multi-tenant isolation
