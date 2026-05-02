export interface ClinicalState {
  id: string;
  tenant_id: string;
  patient_id: string;
  cso_version: string;
  
  // Dimensões principais
  clinical_phase: string;
  
  activation_level: number | null;
  activation_level_source: string | null;
  activation_confidence: number | null;
  
  cognitive_rigidity: number | null;
  
  emotional_load: number | null;
  emotional_load_source: string | null;
  emotional_confidence: number | null;
  
  task_adherence: number | null;
  task_adherence_source: string | null;
  adherence_confidence: number | null;
  
  engagement_trend: string | null;
  
  risk_flags: string[];
  
  treatment_phase: string | null;
  sessions_in_phase: number;
  
  system_confidence: number | null;
  
  source_event: string | null;
  created_at: Date;
}
