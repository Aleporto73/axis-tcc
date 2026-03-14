-- =====================================================
-- Migration 027: TDAH Token Economy (Economia de Fichas)
-- Bible §18: Reforço previsível, concreto e sistemático
-- Protocolo E06: Economia de fichas em casa
-- =====================================================

-- Sistema de economia de fichas por paciente
CREATE TABLE IF NOT EXISTS tdah_token_economy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES tdah_patients(id),

  -- Configuração do sistema
  system_name VARCHAR(255) NOT NULL DEFAULT 'Economia de Fichas',
  token_type VARCHAR(50) NOT NULL DEFAULT 'star',
    -- star, point, sticker, coin, custom
  token_label VARCHAR(100),            -- ex: "estrela", "ponto", "adesivo"

  -- Comportamentos-alvo (ganham fichas)
  target_behaviors JSONB NOT NULL DEFAULT '[]',
  -- Shape: [{"behavior": "Completar tarefa", "tokens_earned": 1, "description": "..."}]

  -- Reforçadores (trocam fichas)
  reinforcers JSONB NOT NULL DEFAULT '[]',
  -- Shape: [{"reward": "30 min tablet", "tokens_required": 5, "category": "screen_time"}]

  -- Status e controle
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  current_balance INTEGER NOT NULL DEFAULT 0,

  -- Protocolo vinculado (opcional — E06)
  protocol_id UUID REFERENCES tdah_protocols(id),

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_economy_patient ON tdah_token_economy(tenant_id, patient_id);

-- Registro de transações (append-only)
CREATE TABLE IF NOT EXISTS tdah_token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  economy_id UUID NOT NULL REFERENCES tdah_token_economy(id),
  patient_id UUID NOT NULL,

  -- Tipo de transação
  transaction_type VARCHAR(20) NOT NULL
    CHECK (transaction_type IN ('earn', 'spend', 'bonus', 'reset')),
  amount INTEGER NOT NULL,             -- positivo para earn/bonus, negativo para spend
  balance_after INTEGER NOT NULL,

  -- Detalhes
  reason TEXT,                         -- comportamento ou reforçador
  behavior_index INTEGER,              -- índice no array target_behaviors
  reinforcer_index INTEGER,            -- índice no array reinforcers
  notes TEXT,

  -- Quem registrou
  recorded_by VARCHAR(50),             -- 'clinician', 'parent', 'teacher', 'system'
  recorded_by_name VARCHAR(255),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_economy ON tdah_token_transactions(economy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_transactions_patient ON tdah_token_transactions(tenant_id, patient_id, created_at DESC);
