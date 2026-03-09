-- ─────────────────────────────────────────────────────
-- Migration 016: Session Duration Model V2
-- Adds per-trial duration tracking, applied_by FK, and
-- session duration override for manual correction.
-- ─────────────────────────────────────────────────────

-- §1. session_targets: duração por trial + quem aplicou
ALTER TABLE session_targets
  ADD COLUMN IF NOT EXISTS duration_seconds INT,
  ADD COLUMN IF NOT EXISTS applied_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN session_targets.duration_seconds IS 'Duração em segundos do bloco de trials (cronômetro ou manual)';
COMMENT ON COLUMN session_targets.applied_by IS 'Profissional que aplicou este trial (FK profiles.id)';

-- §2. sessions_aba: duração editável + quem aplicou a sessão
ALTER TABLE sessions_aba
  ADD COLUMN IF NOT EXISTS duration_minutes_override INT,
  ADD COLUMN IF NOT EXISTS applied_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN sessions_aba.duration_minutes_override IS 'Duração corrigida manualmente pelo terapeuta (sobrescreve cálculo automático)';
COMMENT ON COLUMN sessions_aba.applied_by IS 'Profissional responsável pela sessão (pode diferir do therapist_id do agendamento)';

-- §3. Index para consultas por applied_by
CREATE INDEX IF NOT EXISTS idx_st_applied_by ON session_targets(applied_by);
CREATE INDEX IF NOT EXISTS idx_sa_applied_by ON sessions_aba(applied_by);
