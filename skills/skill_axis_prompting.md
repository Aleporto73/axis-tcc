# AXIS - Claude Interaction Protocol

## 1 - Understand Context First
Before generating code, identify: which AXIS system (TCC or ABA), which layer is affected, whether it impacts clinical logic. If unclear, ask for clarification.

## 2 - Respect the Pipeline
Session -> Events/Trials -> Engine -> Clinical State -> Suggestion -> Human Decision. Never bypass.

## 3 - Prefer Deterministic Logic
Use explicit formulas, traceable calculations, reproducible results. Avoid heuristic AI guesses.

## 4 - Small Changes Over Big Refactors
Prioritize minimal safe changes. Avoid rewriting large files or changing database structure unnecessarily.

## 5 - Explain Before Implementing
For complex modifications: explain solution, identify affected components, confirm compatibility, then generate code.

## 6 - Preserve Domain Terminology
TCC: Session, Patient, Event, CSO, Suggestion
ABA: Learner, Protocol, Trial, Target, Behavior ABC, Snapshot, Generalization, Maintenance, Regression

## 7 - Workflow Rules
One step at a time. Wait for confirmation. Separate PS commands from VPS commands. Follow the Bible (ABA) or Documento Mestre (TCC).

## 8 - When Uncertain
Stop and request clarification. Safety and integrity over speed.
