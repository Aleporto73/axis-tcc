# AXIS - Governance Rules

## Immutable Records
Clinical records follow append-only logic. Historical records never overwritten.

## Audit Logging
All critical actions generate logs in axis_audit_logs: SESSION_START, SESSION_END, PROTOCOL_STATUS_CHANGE, REPORT_GENERATED, SUMMARY_APPROVED, EMAIL_SENT, PORTAL_ACCESS

## Engine Versioning
CSO-TCC v3.0.0, CSO-ABA v2.6.1. Historical results tied to engine version used at the time. Never retroactively recompute.

## LGPD Compliance
Controller: Clinica (client). Operator: Psiform (AXIS). Data minimization, explicit consent (guardian_consents), right to portability, retention policy enforced.

## Summary Approval Rule
Summaries sent to guardians must be approved by therapist before sending. Never send automatically.

## Migration Policy
Existing protocols remain on original version. New protocols use new version. Manual migration requires: audit log entry, technical note, clinical justification, supervisor approval.

## Baseline Freeze
AXIS ABA: Bible v2.6.1. AXIS TCC: Documento Mestre v2.1. Improvements start from baseline without retroactive reinterpretation.
