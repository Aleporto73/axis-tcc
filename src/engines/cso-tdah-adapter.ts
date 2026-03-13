/**
 * CSO-TDAH Adapter — Transforma observações do banco em CsoTdahInput
 *
 * Recebe rows de tdah_observations e converte para a interface
 * do motor CsoTdahInput para calcular o snapshot.
 */

import type {
  CsoTdahInput,
  TargetScore,
  MasteryStatus,
  PromptLevel,
  StabilityLevel,
  ExrLevel,
  SenLevel,
  TrfLevel,
  RigRecord,
  MskRecord,
  SourceContexts,
  AudhdLayerStatus,
  CsoTdahWeights,
} from './cso-tdah'

interface ObservationRow {
  sas_score: number | null
  pis_level: string | null
  bss_level: string | null
  exr_level: string | null
  sen_level: string | null
  trf_level: string | null
  rig_state: string | null
  rig_severity: string | null
  msk_value: number | null
  msk_status: string | null
  task_block_number: number | null
  created_at: string
}

interface AdapterOptions {
  audhdLayerStatus: AudhdLayerStatus
  sessionContext: string // 'clinical' | 'home' | 'school'
  weights?: CsoTdahWeights
}

/**
 * Transforma observações de uma sessão em CsoTdahInput
 */
export function observationsToInput(
  observations: ObservationRow[],
  options: AdapterOptions
): CsoTdahInput {
  const activeTargets: TargetScore[] = []
  const promptLevels: PromptLevel[] = []
  const stabilityLevels: StabilityLevel[] = []
  const exrLevels: ExrLevel[] = []
  const senLevels: SenLevel[] = []
  const trfLevels: TrfLevel[] = []
  const rigRecords: RigRecord[] = []
  let mskRecord: MskRecord | null = null
  const adherenceScores: number[] = []

  for (const obs of observations) {
    // SAS: cada observação com sas_score vira um target com 1 trial
    if (obs.sas_score != null) {
      activeTargets.push({ score: Number(obs.sas_score), trials: 1 })
    }

    // PIS
    if (obs.pis_level && isValidPromptLevel(obs.pis_level)) {
      promptLevels.push(obs.pis_level as PromptLevel)
    }

    // BSS
    if (obs.bss_level && isValidStability(obs.bss_level)) {
      stabilityLevels.push(obs.bss_level as StabilityLevel)
    }

    // EXR
    if (obs.exr_level && isValidExr(obs.exr_level)) {
      exrLevels.push(obs.exr_level as ExrLevel)
    }

    // SEN (AuDHD layer)
    if (obs.sen_level && isValidSen(obs.sen_level)) {
      senLevels.push(obs.sen_level as SenLevel)
    }

    // TRF (AuDHD layer)
    if (obs.trf_level && isValidTrf(obs.trf_level)) {
      trfLevels.push(obs.trf_level as TrfLevel)
    }

    // RIG (categórico)
    if (obs.rig_state && isValidRigState(obs.rig_state)) {
      rigRecords.push({
        rig_state: obs.rig_state as any,
        rig_severity: (obs.rig_severity as any) || 'none',
        rig_observation_count: 1,
        rig_last_updated_at: obs.created_at,
      })
    }

    // MSK (último valor válido)
    if (obs.msk_value != null) {
      mskRecord = {
        value: Number(obs.msk_value),
        status: (obs.msk_status as any) || 'validation_pending',
      }
    }
  }

  // TCM: adherence score — por sessão, 100% se há observações registradas
  // (Refinamento futuro: calcular baseado em protocolo completeness)
  if (observations.length > 0) {
    adherenceScores.push(100)
  }

  // Source contexts: baseado no contexto da sessão
  const sourceContexts: SourceContexts = {
    clinical: options.sessionContext === 'clinical' ? 'present' : 'not_applicable',
    home: options.sessionContext === 'home' ? 'present' : 'not_applicable',
    school: options.sessionContext === 'school' ? 'present' : 'not_applicable',
  }

  return {
    activeTargets,
    masteredTargets: [], // Não temos mastery tracking por sessão individual ainda
    promptLevels,
    stabilityLevels,
    adherenceScores,
    exrLevels,
    contextScores: [], // CTX requer múltiplos contextos, calculado em ciclo de monitoramento
    audhdLayerStatus: options.audhdLayerStatus,
    senLevels,
    trfLevels,
    rigRecords,
    mskRecord,
    sourceContexts,
    weights: options.weights,
  }
}

// Validators
function isValidPromptLevel(v: string): boolean {
  return ['independente', 'gestual', 'verbal', 'modelacao', 'fisica_parcial', 'fisica_total'].includes(v)
}
function isValidStability(v: string): boolean {
  return ['estavel', 'oscilante', 'instavel'].includes(v)
}
function isValidExr(v: string): boolean {
  return ['independente', 'apoio_minimo', 'apoio_significativo', 'nao_realiza'].includes(v)
}
function isValidSen(v: string): boolean {
  return ['sem_impacto', 'impacto_moderado', 'impacto_significativo'].includes(v)
}
function isValidTrf(v: string): boolean {
  return ['transicao_fluida', 'com_resistencia', 'com_ruptura'].includes(v)
}
function isValidRigState(v: string): boolean {
  return ['balanced', 'rigidity_leaning', 'impulsivity_leaning', 'dual_risk'].includes(v)
}
