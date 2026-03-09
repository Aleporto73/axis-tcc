# AXIS ABA - Domain Skill

Reference: AXIS_ABA_BIBLE v2.6.1

## Core Philosophy
IA nao decide, nao executa, pode ficar em silencio. Estado clinico append-only. Toda acao auditavel. Julgamento final sempre humano.

## Clinical Flow
Aprendiz -> Protocolo -> Sessao -> Trials/Comportamentos ABC -> CSO-ABA -> Snapshot -> Relatorio

## Protocol Lifecycle (11 Status)
draft -> active -> mastered -> generalization -> mastered_validated -> maintenance -> maintained -> archived
Regression can occur from mastered, generalization, mastered_validated, maintenance, maintained -> returns to active
suspended (max 30 days), discontinued (terminal, requires reason)

## CSO-ABA Engine v2.6.1
Formula: CSO-ABA = (0.25 x SAS) + (0.25 x PIS) + (0.25 x BSS) + (0.25 x TCM)
Weights FIXED (national standard). Scale 0-100.

SAS (Skill Acquisition Score): acquisition progress
PIS (Prompt Independence Score): prompt levels - Independente=1.0, Gestual=0.8, Verbal=0.6, Modelacao=0.4, Fisica parcial=0.2, Fisica total=0.0
BSS (Behavioral Stability Score): behavior intensity - Leve=0.25, Moderada=0.50, Alta=0.75, Severa=1.00
TCM (Therapeutic Consistency Metric): CV of last 5 sessions

## Generalization 3x2
3 stimulus variations x 2 context variations = 6 cells. All 6 approved (>= mastery_criteria_pct) -> auto-transition to mastered_validated.
Auto-transition is handled by POST /api/aba/generalization — inserts probe, checks grid, updates status if 6/6.

## Maintenance Probes
Probe 1: 2 weeks, Probe 2: 6 weeks, Probe 3: 12 weeks. Criterion: >=70%. Fail = regression.

## Brazil Terminology
BCBA = Supervisor Clinico, RBT = Terapeuta, Mastery = Dominio Consolidado, Protocol = Plano de Intervencao
