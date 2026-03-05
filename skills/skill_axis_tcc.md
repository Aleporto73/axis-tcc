# AXIS TCC - Domain Skill

Reference: Documento Mestre v2.1 + Declaracao Arquitetural v1.0.0

## Core Philosophy
IA nao decide, nao executa, pode ficar em silencio. Estado clinico append-only. Toda acao auditavel. Julgamento final sempre humano.

## Clinical Flow
Sessao -> Transcricao (opcional) -> Eventos objetivos -> CSO-TCC -> Sugestao unica -> Decisao humana (aprovar/editar/ignorar)

## Session Recording
Audio: MP3, WAV, M4A (max 25MB). Whisper transcription. Chunking for files over 5MB.

## Clinical Events (9 Types)
AVOIDANCE_OBSERVED, CONFRONTATION_OBSERVED, ADJUSTMENT_OBSERVED, RECOVERY_OBSERVED, SESSION_START, SESSION_END, TASK_COMPLETED, TASK_INCOMPLETE, MOOD_CHECK

## CSO-TCC Engine v3.0.0
4 Dimensions (scale 0-1): activation_level, emotional_load, task_adherence, cognitive_rigidity
Append-only, SHA256 hash on events, deterministic calculation.

## Suggestion Engine v2.1
Max 1 suggestion per cycle. Gate of silence if low confidence.
Types: CRISIS_PROTOCOL, PAUSE_EXPOSURE, CHECK_ADHERENCE, COGNITIVE_INTERVENTION, SIMPLIFY_TASK, EMOTIONAL_REGULATION, CELEBRATE_PROGRESS, ADJUST_PACE, BRIDGE_TO_LAST

## Three-Layer Separation
Layer 1: Objective system data (metrics, events)
Layer 2: Deterministic automated text (fixed rules)
Layer 3: Professional record (manual clinical content)

## Version Limitations (v1.0.0)
Single-user per tenant. No multi-user, no permission levels, no role differentiation. Planned for v2.x.
