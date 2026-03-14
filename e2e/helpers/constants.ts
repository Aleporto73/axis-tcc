/**
 * Constantes e dados de teste para E2E TDAH
 */

export const TDAH_COLOR = '#0d7377'

// Dados do paciente de teste
export const TEST_PATIENT = {
  name: `E2E Paciente ${Date.now()}`,
  birth_date: '2018-06-15',
  gender: 'M',
  diagnosis: 'TDAH combinado',
  cid_code: 'F90.0',
  support_level: '2',
  school_name: 'Escola Teste E2E',
  teacher_name: 'Prof. Maria Teste',
  teacher_email: 'prof.teste@escola.com',
  clinical_notes: 'Paciente criado via teste E2E automatizado',
  // Responsável
  guardian_name: 'Ana Teste',
  guardian_phone: '11999999999',
  guardian_email: 'ana.teste@email.com',
  guardian_relationship: 'Mãe',
}

// Dados da sessão de teste
export const TEST_SESSION = {
  context: 'clinical',
  notes: 'Sessão E2E — teste automatizado',
}

// Dados de observação (métricas CSO-TDAH)
export const TEST_OBSERVATION = {
  task_description: 'Tarefa de atenção sustentada',
  sas_score: 3,        // Sustained Attention Score (1-5)
  pis_score: 2,        // Planning/Inhibition Score (1-5)
  bss_score: 4,        // Behavioral Self-regulation Score (1-5)
  exr_score: 3,        // Executive Regulation Score (1-5)
  notes: 'Observação E2E automática',
}

// Dados DRC
export const TEST_DRC = {
  goal_description: 'Permanecer sentado durante a atividade',
  score: 80,
  filled_by: 'therapist',
  notes: 'DRC criado via E2E',
}

// Dados token escola
export const TEST_ESCOLA_TOKEN = {
  teacher_name: 'Prof. Maria Teste',
  teacher_email: 'prof.teste@escola.com',
  school_name: 'Escola Teste E2E',
  expires_days: '90',
}

// Seletores comuns
export const SEL = {
  // Hub
  hubTdahCard: 'text=AXIS TDAH',

  // Sidebar TDAH
  sidebarPacientes: 'text=Pacientes',
  sidebarSessoes: 'text=Sessões',
  sidebarDRC: 'text=DRC',
  sidebarEscola: 'text=Escola',

  // Botões comuns
  btnSave: 'button:has-text("Salvar")',
  btnCreate: 'button:has-text("Criar")',
  btnCancel: 'button:has-text("Cancelar")',
  btnClose: 'button:has-text("Fechar")',
}

// Timeouts
export const TIMEOUTS = {
  navigation: 15_000,
  apiResponse: 10_000,
  modalOpen: 5_000,
  shortWait: 2_000,
}
