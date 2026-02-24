export interface Suggestion {
  id: string;
  tenant_id: string;
  patient_id: string;
  cso_id: string;
  type: SuggestionType;
  title: string;
  reason: string[];
  confidence: number;
  context: Record<string, any>;
  engine_version: string;
  ruleset_hash: string | null;
  created_at: Date;
  expires_at: Date | null;
}

export type SuggestionType =
  | 'PAUSE_EXPOSURE'
  | 'SIMPLIFY_TASK'
  | 'CHECK_ADHERENCE'
  | 'BRIDGE_TO_LAST'
  | 'DEFER_DECISION'
  | 'RESCHEDULE_SESSION'
  | 'CRISIS_PROTOCOL'
  | 'CELEBRATE_PROGRESS'
  | 'ADJUST_PACE'
  | 'COGNITIVE_INTERVENTION'
  | 'EMOTIONAL_REGULATION';

export type SuggestionDecision = 'APPROVED' | 'EDITED' | 'IGNORED' | 'EXPIRED';
