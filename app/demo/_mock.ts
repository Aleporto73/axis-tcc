// =====================================================
// AXIS ABA Demo — Dados mockados
// =====================================================

export interface MockLearner {
  id: string
  name: string
  birth_date: string
  age: string
  diagnosis: string
  cid_code: string
  support_level: number
  school: string
  protocols_active: number
  protocols_mastered: number
  total_sessions: number
  cso_aba: number
  cso_band: string
}

export interface MockSession {
  id: string
  learner_name: string
  scheduled_at: string
  status: string
  location: string
}

export interface MockCSOPoint {
  session_date: string
  cso_aba: number
  sas: number
  pis: number
  bss: number
  tcm: number
}

export const LEARNERS: MockLearner[] = [
  {
    id: 'demo-1',
    name: 'Davi Ferreira',
    birth_date: '2020-03-12',
    age: '5a 11m',
    diagnosis: 'TEA',
    cid_code: 'F84.0',
    support_level: 2,
    school: 'Escola Montessori',
    protocols_active: 4,
    protocols_mastered: 2,
    total_sessions: 18,
    cso_aba: 72.4,
    cso_band: 'bom',
  },
  {
    id: 'demo-2',
    name: 'Laura Oliveira',
    birth_date: '2019-07-22',
    age: '6a 7m',
    diagnosis: 'TEA',
    cid_code: 'F84.0',
    support_level: 1,
    school: 'Colégio Viver',
    protocols_active: 3,
    protocols_mastered: 5,
    total_sessions: 32,
    cso_aba: 86.1,
    cso_band: 'excelente',
  },
  {
    id: 'demo-3',
    name: 'Miguel Santos',
    birth_date: '2021-11-05',
    age: '4a 3m',
    diagnosis: 'TEA',
    cid_code: 'F84.0',
    support_level: 3,
    school: 'EMEI Arco-Íris',
    protocols_active: 6,
    protocols_mastered: 1,
    total_sessions: 12,
    cso_aba: 54.8,
    cso_band: 'alerta',
  },
]

export const CSO_HISTORY: Record<string, MockCSOPoint[]> = {
  'demo-1': [
    { session_date: '2026-01-06', cso_aba: 58.2, sas: 55, pis: 60, bss: 62, tcm: 56 },
    { session_date: '2026-01-13', cso_aba: 61.5, sas: 59, pis: 63, bss: 64, tcm: 60 },
    { session_date: '2026-01-20', cso_aba: 64.0, sas: 62, pis: 65, bss: 66, tcm: 63 },
    { session_date: '2026-01-27', cso_aba: 67.8, sas: 66, pis: 68, bss: 69, tcm: 68 },
    { session_date: '2026-02-03', cso_aba: 69.3, sas: 68, pis: 70, bss: 70, tcm: 69 },
    { session_date: '2026-02-10', cso_aba: 70.9, sas: 70, pis: 71, bss: 72, tcm: 71 },
    { session_date: '2026-02-17', cso_aba: 72.4, sas: 72, pis: 73, bss: 73, tcm: 72 },
  ],
  'demo-2': [
    { session_date: '2026-01-06', cso_aba: 74.0, sas: 72, pis: 76, bss: 75, tcm: 73 },
    { session_date: '2026-01-13', cso_aba: 77.2, sas: 76, pis: 78, bss: 78, tcm: 77 },
    { session_date: '2026-01-20', cso_aba: 79.8, sas: 79, pis: 80, bss: 80, tcm: 80 },
    { session_date: '2026-01-27', cso_aba: 81.5, sas: 81, pis: 82, bss: 82, tcm: 81 },
    { session_date: '2026-02-03', cso_aba: 83.0, sas: 83, pis: 83, bss: 84, tcm: 82 },
    { session_date: '2026-02-10', cso_aba: 84.6, sas: 84, pis: 85, bss: 85, tcm: 84 },
    { session_date: '2026-02-17', cso_aba: 86.1, sas: 86, pis: 87, bss: 86, tcm: 85 },
  ],
  'demo-3': [
    { session_date: '2026-01-13', cso_aba: 42.0, sas: 38, pis: 44, bss: 45, tcm: 41 },
    { session_date: '2026-01-20', cso_aba: 45.5, sas: 42, pis: 47, bss: 47, tcm: 46 },
    { session_date: '2026-01-27', cso_aba: 48.3, sas: 45, pis: 50, bss: 49, tcm: 49 },
    { session_date: '2026-02-03', cso_aba: 50.9, sas: 48, pis: 52, bss: 52, tcm: 52 },
    { session_date: '2026-02-10', cso_aba: 53.1, sas: 51, pis: 54, bss: 54, tcm: 53 },
    { session_date: '2026-02-17', cso_aba: 54.8, sas: 53, pis: 56, bss: 55, tcm: 55 },
  ],
}

export const SESSIONS: MockSession[] = [
  { id: 's1', learner_name: 'Davi Ferreira', scheduled_at: '2026-02-26T09:00:00', status: 'scheduled', location: 'Sala 1' },
  { id: 's2', learner_name: 'Laura Oliveira', scheduled_at: '2026-02-26T10:30:00', status: 'scheduled', location: 'Sala 2' },
  { id: 's3', learner_name: 'Miguel Santos', scheduled_at: '2026-02-26T14:00:00', status: 'scheduled', location: 'Sala 1' },
  { id: 's4', learner_name: 'Davi Ferreira', scheduled_at: '2026-02-25T09:00:00', status: 'completed', location: 'Sala 1' },
  { id: 's5', learner_name: 'Laura Oliveira', scheduled_at: '2026-02-25T10:30:00', status: 'completed', location: 'Sala 2' },
  { id: 's6', learner_name: 'Miguel Santos', scheduled_at: '2026-02-24T14:00:00', status: 'completed', location: 'Sala 1' },
  { id: 's7', learner_name: 'Laura Oliveira', scheduled_at: '2026-02-24T09:00:00', status: 'completed', location: 'Sala 2' },
  { id: 's8', learner_name: 'Davi Ferreira', scheduled_at: '2026-02-27T09:00:00', status: 'scheduled', location: 'Sala 1' },
]
