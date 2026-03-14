// =====================================================
// AXIS TDAH Demo — Dados mockados (3 pacientes fictícios)
// Motor CSO-TDAH v1.0.0 · Blocos A–G · AuDHD Layer
// =====================================================

/* ─── Types ─── */
export interface MockPatientTDAH {
  id: string
  name: string
  birth_date: string
  age: string
  gender: 'M' | 'F'
  diagnosis: string
  cid_code: string
  support_level: number
  school: string
  teacher_name: string
  grade: string
  guardian_name: string
  guardian_relationship: string
  audhd_layer: 'off' | 'active_core' | 'active_full'
  protocols_active: number
  protocols_mastered: number
  total_sessions: number
  sessions_clinical: number
  sessions_home: number
  sessions_school: number
  cso_tdah: number
  cso_band: string
  clinical_notes: string
}

export interface MockSessionTDAH {
  id: string
  patient_name: string
  patient_id: string
  scheduled_at: string
  status: string
  context: 'clinical' | 'home' | 'school'
  location: string
  duration_minutes?: number
}

export interface MockCSOPointTDAH {
  session_date: string
  final_score: number
  core_score: number
  executive_score: number
  audhd_score: number | null
  sas: number
  pis: number
  bss: number
  exr: number
  sen: number | null
  trf: number | null
  band: string
}

export interface MockProtocolTDAH {
  code: string
  title: string
  block: string
  status: 'active' | 'mastered' | 'maintenance' | 'regression'
  started_at: string
  mastered_at?: string
  observations: number
  is_audhd: boolean
}

export interface MockDRC {
  id: string
  patient_id: string
  date: string
  goal: string
  goal_met: 'yes' | 'no' | 'partial'
  score: number
  filled_by: 'teacher' | 'parent' | 'therapist'
  filled_by_name: string
  teacher_notes?: string
  reviewed: boolean
}

export interface MockRoutineTDAH {
  id: string
  patient_id: string
  name: string
  type: string
  steps: { order: number; description: string; visual_cue: string }[]
  status: 'active' | 'paused' | 'completed'
}

export interface MockTokenEconomy {
  patient_id: string
  name: string
  token_type: string
  current_balance: number
  total_earned: number
  total_spent: number
  behaviors: { name: string; amount: number }[]
  reinforcers: { name: string; cost: number }[]
}

/* ─── Band helpers (CSO-TDAH v1.0.0) ─── */
export function getBandTDAH(score: number): string {
  if (score <= 0) return 'sem_dados'
  if (score < 40) return 'critico'
  if (score < 55) return 'atencao'
  if (score < 70) return 'bom'
  return 'excelente'
}
export function getBandLabelTDAH(score: number): string {
  if (score <= 0) return 'Sem dados'
  if (score < 40) return 'Crítico'
  if (score < 55) return 'Atenção'
  if (score < 70) return 'Bom'
  return 'Excelente'
}
export const bandColorsTDAH: Record<string, string> = {
  sem_dados: '#94a3b8',
  critico: '#ef4444',
  atencao: '#f59e0b',
  bom: '#22c55e',
  excelente: '#10b981',
}

/* ─── Context helpers ─── */
export const contextLabels: Record<string, string> = {
  clinical: 'Clínico',
  home: 'Domiciliar',
  school: 'Escolar',
}
export const contextColors: Record<string, string> = {
  clinical: '#0d7377',
  home: '#7c3aed',
  school: '#2563eb',
}

/* ═══════════════════════════════════════════════════════
   PACIENTE 1 — LUCAS MENDES (AuDHD active_core)
   Trajetória: Evolução positiva constante
   Foco: sensorialidade + transição
   ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   PACIENTE 2 — SOFIA ALMEIDA (TDAH puro)
   Trajetória: Regressão após mudança de escola
   Foco: DRC escolar ativo com notas da professora
   ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   PACIENTE 3 — PEDRO COSTA (TDAH com treino parental)
   Trajetória: Estabilização (platô funcional)
   Foco: Economia de fichas + rotina doméstica
   ═══════════════════════════════════════════════════════ */

export const PATIENTS: MockPatientTDAH[] = [
  {
    id: 'tdah-1',
    name: 'Lucas Mendes',
    birth_date: '2017-08-14',
    age: '8a 7m',
    gender: 'M',
    diagnosis: 'TDAH Combinado + Suspeita TEA (AuDHD)',
    cid_code: 'F90.0',
    support_level: 2,
    school: 'Colégio São Paulo',
    teacher_name: 'Prof. Carla Ribeiro',
    grade: '3º ano',
    guardian_name: 'Mariana Mendes',
    guardian_relationship: 'Mãe',
    audhd_layer: 'active_core',
    protocols_active: 5,
    protocols_mastered: 3,
    total_sessions: 24,
    sessions_clinical: 14,
    sessions_home: 6,
    sessions_school: 4,
    cso_tdah: 71.8,
    cso_band: 'excelente',
    clinical_notes: 'Excelente resposta ao manejo sensorial. Transições ainda geram ansiedade, mas a antecipação visual reduziu crises em 60%. Família engajada no plano domiciliar.',
  },
  {
    id: 'tdah-2',
    name: 'Sofia Almeida',
    birth_date: '2019-03-22',
    age: '6a 11m',
    gender: 'F',
    diagnosis: 'TDAH Predominantemente Desatento',
    cid_code: 'F90.0',
    support_level: 1,
    school: 'Escola Municipal Esperança',
    teacher_name: 'Prof. Fernanda Souza',
    grade: '1º ano',
    guardian_name: 'Roberto Almeida',
    guardian_relationship: 'Pai',
    audhd_layer: 'off',
    protocols_active: 4,
    protocols_mastered: 2,
    total_sessions: 18,
    sessions_clinical: 10,
    sessions_home: 3,
    sessions_school: 5,
    cso_tdah: 48.2,
    cso_band: 'atencao',
    clinical_notes: 'Após mudança de escola em janeiro, apresentou regressão em atenção sustentada e organização de tarefas. DRC escolar ativo para monitorar adaptação. Professora nova relatando dificuldade em manter foco durante atividades de grupo.',
  },
  {
    id: 'tdah-3',
    name: 'Pedro Costa',
    birth_date: '2015-11-30',
    age: '10a 3m',
    gender: 'M',
    diagnosis: 'TDAH Combinado',
    cid_code: 'F90.1',
    support_level: 1,
    school: 'Colégio Viver',
    teacher_name: 'Prof. Ricardo Lima',
    grade: '5º ano',
    guardian_name: 'Ana Paula Costa',
    guardian_relationship: 'Mãe',
    audhd_layer: 'off',
    protocols_active: 3,
    protocols_mastered: 4,
    total_sessions: 30,
    sessions_clinical: 16,
    sessions_home: 10,
    sessions_school: 4,
    cso_tdah: 63.5,
    cso_band: 'bom',
    clinical_notes: 'Atingiu platô funcional. Economia de fichas no domicílio consolidada. Rotina matinal autônoma há 6 semanas. Foco atual: generalização para contexto escolar e redução gradual de reforçadores externos.',
  },
]

/* ─── CSO History ─── */
export const CSO_HISTORY_TDAH: Record<string, MockCSOPointTDAH[]> = {
  // Lucas — evolução positiva (AuDHD core ativa)
  'tdah-1': [
    { session_date: '2026-01-06', final_score: 52.3, core_score: 55.0, executive_score: 48.0, audhd_score: 42.0, sas: 54, pis: 50, bss: 61, exr: 48, sen: 38, trf: 46, band: 'atencao' },
    { session_date: '2026-01-13', final_score: 55.8, core_score: 58.0, executive_score: 51.0, audhd_score: 46.5, sas: 57, pis: 54, bss: 63, exr: 51, sen: 43, trf: 50, band: 'bom' },
    { session_date: '2026-01-20', final_score: 59.4, core_score: 61.5, executive_score: 55.0, audhd_score: 50.0, sas: 60, pis: 58, bss: 66, exr: 55, sen: 47, trf: 53, band: 'bom' },
    { session_date: '2026-01-27', final_score: 62.1, core_score: 64.0, executive_score: 58.5, audhd_score: 53.0, sas: 63, pis: 61, bss: 68, exr: 58, sen: 50, trf: 56, band: 'bom' },
    { session_date: '2026-02-03', final_score: 65.0, core_score: 66.5, executive_score: 62.0, audhd_score: 56.5, sas: 66, pis: 63, bss: 70, exr: 62, sen: 54, trf: 59, band: 'bom' },
    { session_date: '2026-02-10', final_score: 68.3, core_score: 69.0, executive_score: 66.0, audhd_score: 60.0, sas: 68, pis: 66, bss: 73, exr: 66, sen: 58, trf: 62, band: 'bom' },
    { session_date: '2026-02-17', final_score: 71.8, core_score: 72.5, executive_score: 69.0, audhd_score: 64.0, sas: 72, pis: 69, bss: 76, exr: 69, sen: 62, trf: 66, band: 'excelente' },
  ],
  // Sofia — regressão após mudança de escola
  'tdah-2': [
    { session_date: '2026-01-06', final_score: 58.5, core_score: 60.0, executive_score: 55.0, audhd_score: null, sas: 62, pis: 56, bss: 62, exr: 55, sen: null, trf: null, band: 'bom' },
    { session_date: '2026-01-13', final_score: 56.2, core_score: 57.5, executive_score: 53.0, audhd_score: null, sas: 59, pis: 53, bss: 60, exr: 53, sen: null, trf: null, band: 'bom' },
    { session_date: '2026-01-20', final_score: 53.0, core_score: 54.0, executive_score: 50.5, audhd_score: null, sas: 55, pis: 50, bss: 57, exr: 50, sen: null, trf: null, band: 'atencao' },
    { session_date: '2026-01-27', final_score: 49.8, core_score: 51.0, executive_score: 47.0, audhd_score: null, sas: 52, pis: 47, bss: 54, exr: 47, sen: null, trf: null, band: 'atencao' },
    { session_date: '2026-02-03', final_score: 47.5, core_score: 49.0, executive_score: 44.5, audhd_score: null, sas: 50, pis: 45, bss: 52, exr: 44, sen: null, trf: null, band: 'atencao' },
    { session_date: '2026-02-10', final_score: 48.0, core_score: 49.5, executive_score: 45.0, audhd_score: null, sas: 51, pis: 45, bss: 52, exr: 45, sen: null, trf: null, band: 'atencao' },
    { session_date: '2026-02-17', final_score: 48.2, core_score: 50.0, executive_score: 45.5, audhd_score: null, sas: 51, pis: 46, bss: 53, exr: 45, sen: null, trf: null, band: 'atencao' },
  ],
  // Pedro — estabilização (platô)
  'tdah-3': [
    { session_date: '2026-01-06', final_score: 61.0, core_score: 63.0, executive_score: 57.0, audhd_score: null, sas: 64, pis: 60, bss: 65, exr: 57, sen: null, trf: null, band: 'bom' },
    { session_date: '2026-01-13', final_score: 62.5, core_score: 64.0, executive_score: 59.0, audhd_score: null, sas: 65, pis: 61, bss: 66, exr: 59, sen: null, trf: null, band: 'bom' },
    { session_date: '2026-01-20', final_score: 63.0, core_score: 64.5, executive_score: 60.0, audhd_score: null, sas: 65, pis: 62, bss: 66, exr: 60, sen: null, trf: null, band: 'bom' },
    { session_date: '2026-01-27', final_score: 63.8, core_score: 65.0, executive_score: 61.0, audhd_score: null, sas: 66, pis: 62, bss: 67, exr: 61, sen: null, trf: null, band: 'bom' },
    { session_date: '2026-02-03', final_score: 63.2, core_score: 64.5, executive_score: 60.5, audhd_score: null, sas: 65, pis: 62, bss: 66, exr: 60, sen: null, trf: null, band: 'bom' },
    { session_date: '2026-02-10', final_score: 63.0, core_score: 64.0, executive_score: 60.5, audhd_score: null, sas: 65, pis: 61, bss: 66, exr: 60, sen: null, trf: null, band: 'bom' },
    { session_date: '2026-02-17', final_score: 63.5, core_score: 65.0, executive_score: 61.0, audhd_score: null, sas: 66, pis: 62, bss: 67, exr: 61, sen: null, trf: null, band: 'bom' },
  ],
}

/* ─── Protocols per patient ─── */
export const PROTOCOLS_TDAH: Record<string, MockProtocolTDAH[]> = {
  'tdah-1': [
    { code: 'TDAH-A01', title: 'Atenção sustentada a estímulos visuais', block: 'A', status: 'active', started_at: '2026-01-06', observations: 18, is_audhd: false },
    { code: 'TDAH-B03', title: 'Planejamento de sequência de tarefas', block: 'B', status: 'active', started_at: '2026-01-06', observations: 14, is_audhd: false },
    { code: 'TDAH-G01', title: 'Regulação emocional com suporte visual', block: 'G', status: 'active', started_at: '2026-01-13', observations: 12, is_audhd: true },
    { code: 'TDAH-G03', title: 'Manejo de transições com antecipação', block: 'G', status: 'active', started_at: '2026-01-13', observations: 15, is_audhd: true },
    { code: 'TDAH-C02', title: 'Espera ativa com suporte temporal', block: 'C', status: 'active', started_at: '2026-01-20', observations: 10, is_audhd: false },
    { code: 'TDAH-A03', title: 'Atenção dividida com 2 estímulos', block: 'A', status: 'mastered', started_at: '2026-01-06', mastered_at: '2026-02-10', observations: 22, is_audhd: false },
    { code: 'TDAH-B01', title: 'Inibição de resposta prepotente', block: 'B', status: 'mastered', started_at: '2026-01-06', mastered_at: '2026-02-03', observations: 20, is_audhd: false },
    { code: 'TDAH-G02', title: 'Tolerância sensorial auditiva', block: 'G', status: 'mastered', started_at: '2026-01-06', mastered_at: '2026-02-17', observations: 19, is_audhd: true },
  ],
  'tdah-2': [
    { code: 'TDAH-A02', title: 'Atenção sustentada a instruções verbais', block: 'A', status: 'active', started_at: '2026-01-06', observations: 16, is_audhd: false },
    { code: 'TDAH-D01', title: 'Organização de materiais escolares', block: 'D', status: 'active', started_at: '2026-01-06', observations: 14, is_audhd: false },
    { code: 'TDAH-D03', title: 'Conclusão de tarefas em tempo limite', block: 'D', status: 'regression', started_at: '2026-01-06', observations: 18, is_audhd: false },
    { code: 'TDAH-F01', title: 'DRC — Manter-se sentada durante explicação', block: 'F', status: 'active', started_at: '2026-01-20', observations: 12, is_audhd: false },
    { code: 'TDAH-A04', title: 'Atenção seletiva em ambiente ruidoso', block: 'A', status: 'mastered', started_at: '2026-01-06', mastered_at: '2026-01-27', observations: 15, is_audhd: false },
    { code: 'TDAH-C01', title: 'Controle de impulso verbal', block: 'C', status: 'mastered', started_at: '2026-01-06', mastered_at: '2026-02-03', observations: 20, is_audhd: false },
  ],
  'tdah-3': [
    { code: 'TDAH-E01', title: 'Rotina matinal com checklist visual', block: 'E', status: 'active', started_at: '2026-01-06', observations: 22, is_audhd: false },
    { code: 'TDAH-E03', title: 'Organização de mochila com pista visual', block: 'E', status: 'active', started_at: '2026-01-06', observations: 18, is_audhd: false },
    { code: 'TDAH-B05', title: 'Flexibilidade cognitiva com mudança de regra', block: 'B', status: 'active', started_at: '2026-01-20', observations: 12, is_audhd: false },
    { code: 'TDAH-E02', title: 'Rotina noturna com temporizador', block: 'E', status: 'mastered', started_at: '2026-01-06', mastered_at: '2026-02-03', observations: 24, is_audhd: false },
    { code: 'TDAH-C03', title: 'Controle de impulso motor', block: 'C', status: 'mastered', started_at: '2026-01-06', mastered_at: '2026-01-27', observations: 18, is_audhd: false },
    { code: 'TDAH-D02', title: 'Uso de agenda escolar com apoio', block: 'D', status: 'mastered', started_at: '2026-01-06', mastered_at: '2026-02-10', observations: 16, is_audhd: false },
    { code: 'TDAH-A01', title: 'Atenção sustentada a estímulos visuais', block: 'A', status: 'mastered', started_at: '2026-01-06', mastered_at: '2026-02-17', observations: 20, is_audhd: false },
  ],
}

/* ─── Sessions ─── */
export const SESSIONS_TDAH: MockSessionTDAH[] = [
  // Lucas
  { id: 'st1', patient_name: 'Lucas Mendes', patient_id: 'tdah-1', scheduled_at: '2026-03-14T09:00:00', status: 'scheduled', context: 'clinical', location: 'Sala 1' },
  { id: 'st2', patient_name: 'Lucas Mendes', patient_id: 'tdah-1', scheduled_at: '2026-03-14T14:00:00', status: 'scheduled', context: 'home', location: 'Residência' },
  { id: 'st3', patient_name: 'Lucas Mendes', patient_id: 'tdah-1', scheduled_at: '2026-03-13T09:00:00', status: 'completed', context: 'clinical', location: 'Sala 1', duration_minutes: 50 },
  { id: 'st4', patient_name: 'Lucas Mendes', patient_id: 'tdah-1', scheduled_at: '2026-03-12T10:00:00', status: 'completed', context: 'school', location: 'Colégio São Paulo', duration_minutes: 40 },
  // Sofia
  { id: 'st5', patient_name: 'Sofia Almeida', patient_id: 'tdah-2', scheduled_at: '2026-03-14T10:30:00', status: 'scheduled', context: 'clinical', location: 'Sala 2' },
  { id: 'st6', patient_name: 'Sofia Almeida', patient_id: 'tdah-2', scheduled_at: '2026-03-15T14:00:00', status: 'scheduled', context: 'school', location: 'EM Esperança' },
  { id: 'st7', patient_name: 'Sofia Almeida', patient_id: 'tdah-2', scheduled_at: '2026-03-13T10:30:00', status: 'completed', context: 'clinical', location: 'Sala 2', duration_minutes: 45 },
  { id: 'st8', patient_name: 'Sofia Almeida', patient_id: 'tdah-2', scheduled_at: '2026-03-11T14:00:00', status: 'completed', context: 'school', location: 'EM Esperança', duration_minutes: 35 },
  // Pedro
  { id: 'st9', patient_name: 'Pedro Costa', patient_id: 'tdah-3', scheduled_at: '2026-03-14T16:00:00', status: 'scheduled', context: 'home', location: 'Residência' },
  { id: 'st10', patient_name: 'Pedro Costa', patient_id: 'tdah-3', scheduled_at: '2026-03-13T16:00:00', status: 'completed', context: 'home', location: 'Residência', duration_minutes: 55 },
  { id: 'st11', patient_name: 'Pedro Costa', patient_id: 'tdah-3', scheduled_at: '2026-03-12T09:00:00', status: 'completed', context: 'clinical', location: 'Sala 1', duration_minutes: 50 },
  { id: 'st12', patient_name: 'Pedro Costa', patient_id: 'tdah-3', scheduled_at: '2026-03-10T14:30:00', status: 'completed', context: 'school', location: 'Colégio Viver', duration_minutes: 40 },
]

/* ─── DRCs (Sofia has the richest DRC data) ─── */
export const DRCS_TDAH: MockDRC[] = [
  // Sofia — DRC escolar ativo
  { id: 'drc1', patient_id: 'tdah-2', date: '2026-03-13', goal: 'Manter-se sentada durante explicação (15 min)', goal_met: 'partial', score: 65, filled_by: 'teacher', filled_by_name: 'Prof. Fernanda Souza', teacher_notes: 'Levantou 2x mas voltou sozinha. Progresso em relação à semana passada.', reviewed: true },
  { id: 'drc2', patient_id: 'tdah-2', date: '2026-03-13', goal: 'Completar atividade de escrita sem ajuda', goal_met: 'no', score: 40, filled_by: 'teacher', filled_by_name: 'Prof. Fernanda Souza', teacher_notes: 'Precisou de 3 redirecionamentos. Dispersou com barulho do corredor.', reviewed: true },
  { id: 'drc3', patient_id: 'tdah-2', date: '2026-03-13', goal: 'Levantar a mão antes de falar', goal_met: 'yes', score: 85, filled_by: 'teacher', filled_by_name: 'Prof. Fernanda Souza', teacher_notes: 'Ótimo dia! Lembrou sozinha na maioria das vezes.', reviewed: false },
  { id: 'drc4', patient_id: 'tdah-2', date: '2026-03-12', goal: 'Manter-se sentada durante explicação (15 min)', goal_met: 'no', score: 35, filled_by: 'teacher', filled_by_name: 'Prof. Fernanda Souza', teacher_notes: 'Dia difícil. Levantou 5x. Pode estar relacionado à falta de sono.', reviewed: true },
  { id: 'drc5', patient_id: 'tdah-2', date: '2026-03-12', goal: 'Completar atividade de escrita sem ajuda', goal_met: 'partial', score: 55, filled_by: 'teacher', filled_by_name: 'Prof. Fernanda Souza', reviewed: true },
  { id: 'drc6', patient_id: 'tdah-2', date: '2026-03-11', goal: 'Levantar a mão antes de falar', goal_met: 'yes', score: 80, filled_by: 'teacher', filled_by_name: 'Prof. Fernanda Souza', reviewed: true },
  // Lucas — DRC pontual
  { id: 'drc7', patient_id: 'tdah-1', date: '2026-03-12', goal: 'Aceitar mudança de atividade sem crise', goal_met: 'yes', score: 90, filled_by: 'teacher', filled_by_name: 'Prof. Carla Ribeiro', teacher_notes: 'Usou o cartão de transição. Excelente progresso.', reviewed: true },
  // Pedro — DRC domiciliar
  { id: 'drc8', patient_id: 'tdah-3', date: '2026-03-13', goal: 'Completar rotina matinal em 30 min', goal_met: 'yes', score: 92, filled_by: 'parent', filled_by_name: 'Ana Paula Costa', reviewed: false },
  { id: 'drc9', patient_id: 'tdah-3', date: '2026-03-12', goal: 'Completar rotina matinal em 30 min', goal_met: 'yes', score: 88, filled_by: 'parent', filled_by_name: 'Ana Paula Costa', reviewed: true },
  { id: 'drc10', patient_id: 'tdah-3', date: '2026-03-11', goal: 'Completar rotina matinal em 30 min', goal_met: 'partial', score: 70, filled_by: 'parent', filled_by_name: 'Ana Paula Costa', teacher_notes: 'Precisou de lembrete no passo de escovar dentes.', reviewed: true },
]

/* ─── Token Economy (Pedro) ─── */
export const TOKEN_ECONOMY: MockTokenEconomy = {
  patient_id: 'tdah-3',
  name: 'Estrelas do Pedro',
  token_type: 'star',
  current_balance: 14,
  total_earned: 38,
  total_spent: 24,
  behaviors: [
    { name: 'Completar rotina matinal sem lembrete', amount: 3 },
    { name: 'Organizar mochila na noite anterior', amount: 2 },
    { name: 'Iniciar dever de casa sozinho', amount: 2 },
    { name: 'Manter quarto arrumado', amount: 1 },
  ],
  reinforcers: [
    { name: '30 min extra de videogame', cost: 5 },
    { name: 'Escolher o jantar', cost: 3 },
    { name: 'Passeio no parque', cost: 8 },
    { name: 'Filme com a família', cost: 10 },
  ],
}

/* ─── Routines (Pedro) ─── */
export const ROUTINES_TDAH: MockRoutineTDAH[] = [
  {
    id: 'r1',
    patient_id: 'tdah-3',
    name: 'Rotina Matinal',
    type: 'morning',
    status: 'active',
    steps: [
      { order: 1, description: 'Levantar ao alarme', visual_cue: 'Ícone de relógio no criado-mudo' },
      { order: 2, description: 'Ir ao banheiro e escovar dentes', visual_cue: 'Foto da escova no espelho' },
      { order: 3, description: 'Vestir uniforme', visual_cue: 'Roupa separada na cadeira' },
      { order: 4, description: 'Tomar café', visual_cue: 'Prato com nome na mesa' },
      { order: 5, description: 'Conferir mochila (checklist)', visual_cue: 'Checklist magnético na geladeira' },
      { order: 6, description: 'Calçar tênis e ir para o carro', visual_cue: 'Tênis ao lado da porta' },
    ],
  },
  {
    id: 'r2',
    patient_id: 'tdah-3',
    name: 'Rotina de Dever de Casa',
    type: 'homework',
    status: 'active',
    steps: [
      { order: 1, description: 'Lavar as mãos e pegar lanche', visual_cue: 'Timer de 10 min no celular' },
      { order: 2, description: 'Abrir agenda e ver tarefas', visual_cue: 'Agenda aberta na mesa' },
      { order: 3, description: 'Separar materiais necessários', visual_cue: 'Caixa de materiais organizada' },
      { order: 4, description: 'Fazer dever (blocos de 15 min)', visual_cue: 'Timer visual (ampulheta)' },
      { order: 5, description: 'Guardar materiais no lugar', visual_cue: 'Foto do local de cada material' },
    ],
  },
]
