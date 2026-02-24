export interface Event {
  id: string;
  tenant_id: string;
  patient_id: string;
  event_type: string;
  payload: Record<string, any>;
  source: string | null;
  related_entity_id: string | null;
  created_at: Date;
}

export type EventType =
  | 'SESSION_START'
  | 'SESSION_END'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'TASK_INCOMPLETE'
  | 'EXPOSURE_ATTEMPT'
  | 'MOOD_CHECK'
  | 'CRISIS_ALERT'
  | 'BRIDGE_RESPONSE'
  | 'HOMEWORK_REVIEW'
  | 'AVOIDANCE_OBSERVED'
  | 'CONFRONTATION_OBSERVED'
  | 'ADJUSTMENT_OBSERVED'
  | 'RECOVERY_OBSERVED';
