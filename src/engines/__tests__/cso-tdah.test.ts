/**
 * Testes CSO-TDAH Engine v1.0 — AXIS_TDAH_BIBLE v2.5
 *
 * Cobre: 3 blocos (Base, Executiva, AuDHD), RIG categórico,
 * missing data composto, confidence flag, final_score com renormalização,
 * faixas interpretativas, layer AuDHD on/off, edge cases.
 */
import { describe, it, expect } from 'vitest'
import {
  CSO_TDAH_ENGINE_VERSION,
  CSO_TDAH_ENGINE_NAME,
  DEFAULT_WEIGHTS,
  MASTERY_SCORES,
  PROMPT_SCALE,
  STABILITY_SCALE,
  EXR_SCALE,
  SEN_SCALE,
  TRF_SCALE,
  clamp,
  calculateSasTdah,
  calculatePisTdah,
  calculateBssTdah,
  calculateTcmTdah,
  calculateCoreScore,
  calculateExr,
  calculateCtx,
  calculateExecutiveScore,
  calculateSen,
  calculateTrf,
  evaluateRig,
  calculateAudhdLayerScore,
  evaluateAudhdFlags,
  evaluateMissingData,
  evaluateConfidence,
  getFinalBand,
  calculateFinalScore,
  computeFullCsoTdah,
} from '../cso-tdah'
import type {
  CoreMetrics,
  ExecutiveMetrics,
  AudhdMetrics,
  RigRecord,
  CsoTdahInput,
  SourceContexts,
} from '../cso-tdah'

// ─── Constantes e Versão ─────────────────────────

describe('CSO-TDAH Constants', () => {
  it('engine version é 1.0.0', () => {
    expect(CSO_TDAH_ENGINE_VERSION).toBe('1.0.0')
  })

  it('engine name é CSO-TDAH', () => {
    expect(CSO_TDAH_ENGINE_NAME).toBe('CSO-TDAH')
  })

  it('pesos default somam 1.0', () => {
    const sum = DEFAULT_WEIGHTS.core + DEFAULT_WEIGHTS.executive + DEFAULT_WEIGHTS.audhd
    expect(sum).toBe(1.0)
  })

  it('mastery scores seguem hierarquia', () => {
    expect(MASTERY_SCORES.maintained).toBeGreaterThan(MASTERY_SCORES.mastered_validated)
    expect(MASTERY_SCORES.mastered_validated).toBeGreaterThan(MASTERY_SCORES.mastered)
    expect(MASTERY_SCORES.mastered).toBeGreaterThan(MASTERY_SCORES.active)
  })

  it('prompt scale decresce de independente a física total', () => {
    expect(PROMPT_SCALE.independente).toBe(1.0)
    expect(PROMPT_SCALE.fisica_total).toBe(0.0)
  })

  it('stability scale: estável=1, oscilante=0.5, instável=0', () => {
    expect(STABILITY_SCALE.estavel).toBe(1.0)
    expect(STABILITY_SCALE.oscilante).toBe(0.5)
    expect(STABILITY_SCALE.instavel).toBe(0.0)
  })
})

// ─── Helpers ─────────────────────────────────────

describe('clamp', () => {
  it('retorna valor dentro do range', () => {
    expect(clamp(50)).toBe(50)
  })

  it('clamp inferior', () => {
    expect(clamp(-10)).toBe(0)
  })

  it('clamp superior', () => {
    expect(clamp(150)).toBe(100)
  })
})

// ─── Bloco 1: Camada Base ────────────────────────

describe('SAS-TDAH', () => {
  it('retorna 0 sem alvos', () => {
    expect(calculateSasTdah([], [])).toBe(0)
  })

  it('calcula com alvos ativos apenas', () => {
    const result = calculateSasTdah(
      [{ score: 80, trials: 10 }, { score: 60, trials: 10 }],
      []
    )
    expect(result).toBe(70) // (80*10 + 60*10) / 20 = 70
  })

  it('calcula com mastery blend', () => {
    const result = calculateSasTdah(
      [{ score: 60, trials: 10 }],
      [{ status: 'mastered', score: 75 }]
    )
    // masteryRate = 1/2 = 0.5
    // sasAtivos = 60, masteryScore = 75
    // 60 * 0.5 + 75 * 0.5 = 67.5
    expect(result).toBe(67.5)
  })

  it('100% mastered → score máximo de mastery', () => {
    const result = calculateSasTdah(
      [],
      [{ status: 'maintained' }, { status: 'maintained' }]
    )
    expect(result).toBe(100)
  })
})

describe('PIS-TDAH', () => {
  it('retorna 0 sem prompts', () => {
    expect(calculatePisTdah([])).toBe(0)
  })

  it('100% independente = 100', () => {
    expect(calculatePisTdah(['independente', 'independente'])).toBe(100)
  })

  it('100% física total = 0', () => {
    expect(calculatePisTdah(['fisica_total', 'fisica_total'])).toBe(0)
  })

  it('mix de prompts', () => {
    // independente(1.0) + verbal(0.6) = 1.6/2 = 0.8 × 100 = 80
    expect(calculatePisTdah(['independente', 'verbal'])).toBe(80)
  })
})

describe('BSS-TDAH', () => {
  it('retorna 0 sem dados', () => {
    expect(calculateBssTdah([])).toBe(0)
  })

  it('100% estável = 100', () => {
    expect(calculateBssTdah(['estavel', 'estavel'])).toBe(100)
  })

  it('100% instável = 0', () => {
    expect(calculateBssTdah(['instavel', 'instavel'])).toBe(0)
  })

  it('mix estável + oscilante', () => {
    // (1.0 + 0.5) / 2 × 100 = 75
    expect(calculateBssTdah(['estavel', 'oscilante'])).toBe(75)
  })
})

describe('TCM-TDAH', () => {
  it('retorna 0 sem scores', () => {
    expect(calculateTcmTdah([])).toBe(0)
  })

  it('média de adherence scores', () => {
    expect(calculateTcmTdah([80, 90, 70])).toBe(80)
  })

  it('clamp a 100', () => {
    expect(calculateTcmTdah([100, 100, 100])).toBe(100)
  })
})

describe('Core Score', () => {
  it('retorna null quando tudo missing', () => {
    const metrics: CoreMetrics = {
      sas_tdah: { value: 0, status: 'missing' },
      pis_tdah: { value: 0, status: 'missing' },
      bss_tdah: { value: 0, status: 'missing' },
      tcm_tdah: { value: 0, status: 'missing' },
    }
    expect(calculateCoreScore(metrics)).toBeNull()
  })

  it('calcula média dos válidos', () => {
    const metrics: CoreMetrics = {
      sas_tdah: { value: 80, status: 'valid' },
      pis_tdah: { value: 60, status: 'valid' },
      bss_tdah: { value: 0, status: 'missing' },
      tcm_tdah: { value: 0, status: 'missing' },
    }
    expect(calculateCoreScore(metrics)).toBe(70) // (80+60)/2
  })

  it('4 métricas válidas', () => {
    const metrics: CoreMetrics = {
      sas_tdah: { value: 80, status: 'valid' },
      pis_tdah: { value: 60, status: 'valid' },
      bss_tdah: { value: 70, status: 'valid' },
      tcm_tdah: { value: 90, status: 'valid' },
    }
    expect(calculateCoreScore(metrics)).toBe(75) // (80+60+70+90)/4
  })
})

// ─── Bloco 2: Camada Executiva ───────────────────

describe('EXR', () => {
  it('retorna 0 sem dados', () => {
    expect(calculateExr([])).toBe(0)
  })

  it('100% independente = 100', () => {
    expect(calculateExr(['independente'])).toBe(100)
  })

  it('mix de níveis', () => {
    // independente(1.0) + apoio_minimo(0.75) = 1.75/2 = 0.875 × 100 = 87.5
    expect(calculateExr(['independente', 'apoio_minimo'])).toBe(87.5)
  })
})

describe('CTX', () => {
  it('retorna 0 com menos de 2 contextos', () => {
    expect(calculateCtx([80])).toBe(0)
    expect(calculateCtx([])).toBe(0)
  })

  it('scores idênticos = 100 (perfeita consistência)', () => {
    expect(calculateCtx([80, 80, 80])).toBe(100)
  })

  it('alta variação = score baixo', () => {
    const result = calculateCtx([100, 0])
    expect(result).toBeLessThan(50)
  })

  it('variação moderada', () => {
    // [70, 80, 90] → avg=80, stdDev≈8.16, cv≈0.102
    // CTX = 100 × (1 - 0.102) ≈ 89.8
    const result = calculateCtx([70, 80, 90])
    expect(result).toBeGreaterThan(85)
    expect(result).toBeLessThan(95)
  })
})

describe('Executive Score', () => {
  it('retorna null quando tudo missing', () => {
    const metrics: ExecutiveMetrics = {
      exr: { value: 0, status: 'missing' },
      ctx: { value: 0, status: 'missing' },
    }
    expect(calculateExecutiveScore(metrics)).toBeNull()
  })

  it('média dos válidos', () => {
    const metrics: ExecutiveMetrics = {
      exr: { value: 80, status: 'valid' },
      ctx: { value: 60, status: 'valid' },
    }
    expect(calculateExecutiveScore(metrics)).toBe(70)
  })
})

// ─── Bloco 3: Layer AuDHD ────────────────────────

describe('SEN', () => {
  it('100% sem_impacto = 100', () => {
    expect(calculateSen(['sem_impacto', 'sem_impacto'])).toBe(100)
  })

  it('100% impacto_significativo = 0', () => {
    expect(calculateSen(['impacto_significativo'])).toBe(0)
  })
})

describe('TRF', () => {
  it('100% fluida = 100', () => {
    expect(calculateTrf(['transicao_fluida'])).toBe(100)
  })

  it('mix fluida + ruptura', () => {
    expect(calculateTrf(['transicao_fluida', 'com_ruptura'])).toBe(50)
  })
})

describe('RIG (categórico)', () => {
  it('retorna missing sem registros', () => {
    const result = evaluateRig([])
    expect(result.status).toBe('missing')
    expect(result.rig_state).toBe('balanced')
  })

  it('usa registro mais recente', () => {
    const records: RigRecord[] = [
      { rig_state: 'balanced', rig_severity: 'none', rig_observation_count: 3, rig_last_updated_at: '2026-03-01T00:00:00Z' },
      { rig_state: 'dual_risk', rig_severity: 'high', rig_observation_count: 5, rig_last_updated_at: '2026-03-10T00:00:00Z' },
    ]
    const result = evaluateRig(records)
    expect(result.rig_state).toBe('dual_risk')
    expect(result.rig_severity).toBe('high')
    expect(result.status).toBe('valid')
  })
})

describe('AuDHD Layer Score', () => {
  it('retorna null sem métricas válidas', () => {
    const metrics: AudhdMetrics = {
      sen: { value: 0, status: 'missing' },
      trf: { value: 0, status: 'missing' },
      rig: { rig_state: 'balanced', rig_severity: 'none', status: 'missing' },
      msk: { value: null, status: 'validation_pending' },
    }
    expect(calculateAudhdLayerScore(metrics)).toBeNull()
  })

  it('média de SEN e TRF apenas (RIG e MSK não entram no score)', () => {
    const metrics: AudhdMetrics = {
      sen: { value: 80, status: 'valid' },
      trf: { value: 60, status: 'valid' },
      rig: { rig_state: 'dual_risk', rig_severity: 'high', status: 'valid' },
      msk: { value: 50, status: 'valid' },
    }
    // Apenas SEN + TRF: (80+60)/2 = 70. RIG e MSK NÃO entram.
    expect(calculateAudhdLayerScore(metrics)).toBe(70)
  })
})

describe('AuDHD Flags', () => {
  it('rig_alert true quando dual_risk', () => {
    const metrics: AudhdMetrics = {
      sen: { value: 80, status: 'valid' },
      trf: { value: 60, status: 'valid' },
      rig: { rig_state: 'dual_risk', rig_severity: 'moderate', status: 'valid' },
      msk: { value: null, status: 'validation_pending' },
    }
    const flags = evaluateAudhdFlags(metrics)
    expect(flags.rig_alert).toBe(true)
    expect(flags.msk_experimental).toBe(true)
  })

  it('rig_alert true quando severity high', () => {
    const metrics: AudhdMetrics = {
      sen: { value: 80, status: 'valid' },
      trf: { value: 60, status: 'valid' },
      rig: { rig_state: 'rigidity_leaning', rig_severity: 'high', status: 'valid' },
      msk: { value: 50, status: 'valid' },
    }
    const flags = evaluateAudhdFlags(metrics)
    expect(flags.rig_alert).toBe(true)
    expect(flags.msk_experimental).toBe(false)
  })

  it('sem alertas quando balanced + mild', () => {
    const metrics: AudhdMetrics = {
      sen: { value: 80, status: 'valid' },
      trf: { value: 60, status: 'valid' },
      rig: { rig_state: 'balanced', rig_severity: 'mild', status: 'valid' },
      msk: { value: 50, status: 'valid' },
    }
    const flags = evaluateAudhdFlags(metrics)
    expect(flags.rig_alert).toBe(false)
  })
})

// ─── Missing Data e Confidence ───────────────────

describe('Missing Data', () => {
  it('none quando tudo presente', () => {
    const result = evaluateMissingData(
      80, 70, 60, 'active_core',
      { clinical: 'present', home: 'present', school: 'present' }
    )
    expect(result.primary_flag).toBe('none')
  })

  it('partial_context quando contexto missing', () => {
    const result = evaluateMissingData(
      80, 70, 60, 'active_core',
      { clinical: 'present', home: 'missing', school: 'present' }
    )
    expect(result.primary_flag).toBe('partial_context')
    expect(result.flags).toContain('partial_context')
  })

  it('insufficient_data quando core null', () => {
    const result = evaluateMissingData(
      null, null, null, 'off',
      { clinical: 'present', home: 'present', school: 'present' }
    )
    expect(result.primary_flag).toBe('insufficient_data')
  })

  it('layer_data_missing quando layer ativa mas score null', () => {
    const result = evaluateMissingData(
      80, 70, null, 'active_core',
      { clinical: 'present', home: 'present', school: 'present' }
    )
    expect(result.primary_flag).toBe('layer_data_missing')
    expect(result.flags).toContain('layer_data_missing')
  })

  it('flags compostos quando múltiplos problemas', () => {
    const result = evaluateMissingData(
      80, null, null, 'active_core',
      { clinical: 'present', home: 'missing', school: 'missing' }
    )
    expect(result.flags).toContain('partial_context')
    expect(result.flags).toContain('layer_data_missing')
  })
})

describe('Confidence', () => {
  it('high quando tudo presente', () => {
    const result = evaluateConfidence(
      80, 70,
      { clinical: 'present', home: 'present', school: 'present' },
      { primary_flag: 'none', flags: ['none'] }
    )
    expect(result).toBe('high')
  })

  it('medium quando core válido mas executive null', () => {
    const result = evaluateConfidence(
      80, null,
      { clinical: 'present', home: 'present', school: 'present' },
      { primary_flag: 'none', flags: ['none'] }
    )
    expect(result).toBe('medium')
  })

  it('low quando core null', () => {
    const result = evaluateConfidence(
      null, null,
      { clinical: 'present', home: 'present', school: 'present' },
      { primary_flag: 'insufficient_data', flags: ['insufficient_data'] }
    )
    expect(result).toBe('low')
  })
})

// ─── Faixas ──────────────────────────────────────

describe('Final Band', () => {
  it('sem_dados quando null', () => {
    expect(getFinalBand(null)).toBe('sem_dados')
  })

  it('excelente >= 85', () => {
    expect(getFinalBand(85)).toBe('excelente')
    expect(getFinalBand(100)).toBe('excelente')
  })

  it('bom 70-84', () => {
    expect(getFinalBand(70)).toBe('bom')
    expect(getFinalBand(84)).toBe('bom')
  })

  it('atencao 50-69', () => {
    expect(getFinalBand(50)).toBe('atencao')
    expect(getFinalBand(69)).toBe('atencao')
  })

  it('critico < 50', () => {
    expect(getFinalBand(49)).toBe('critico')
    expect(getFinalBand(0)).toBe('critico')
  })
})

// ─── Final Score com renormalização ──────────────

describe('Final Score', () => {
  it('null quando core null (Bible: Core obrigatório)', () => {
    expect(calculateFinalScore(null, 80, 60, 'active_core')).toBeNull()
  })

  it('só core quando executive e audhd ausentes', () => {
    // Core 80, pesos renormalizados: core=1.0
    expect(calculateFinalScore(80, null, null, 'off')).toBe(80)
  })

  it('core + executive sem audhd (layer off)', () => {
    // Core 80 (peso 0.50), Executive 60 (peso 0.30)
    // Renormalizado: core=0.50/0.80=0.625, executive=0.30/0.80=0.375
    // Final = 80×0.625 + 60×0.375 = 50 + 22.5 = 72.5
    expect(calculateFinalScore(80, 60, null, 'off')).toBe(72.5)
  })

  it('3 blocos com layer ativa', () => {
    // Core 80 (0.50), Executive 60 (0.30), AuDHD 70 (0.20)
    // Total peso = 1.0, sem renormalização
    // Final = 80×0.50 + 60×0.30 + 70×0.20 = 40 + 18 + 14 = 72
    expect(calculateFinalScore(80, 60, 70, 'active_core')).toBe(72)
  })

  it('layer ativa mas score null → renormaliza sem audhd', () => {
    // Core 80, Executive 60, AuDHD null (layer ativa mas sem dados)
    // Renormaliza: core=0.50/0.80=0.625, executive=0.30/0.80=0.375
    expect(calculateFinalScore(80, 60, null, 'active_core')).toBe(72.5)
  })

  it('layer off ignora audhd score mesmo se fornecido', () => {
    // Layer off → audhd_layer_score ignorado
    expect(calculateFinalScore(80, 60, 70, 'off')).toBe(72.5)
  })
})

// ─── computeFullCsoTdah (integração) ─────────────

describe('computeFullCsoTdah', () => {
  const fullInput: CsoTdahInput = {
    // Camada Base
    activeTargets: [{ score: 80, trials: 10 }],
    masteredTargets: [{ status: 'mastered' }],
    promptLevels: ['independente', 'gestual'],
    stabilityLevels: ['estavel', 'oscilante'],
    adherenceScores: [85, 90],

    // Camada Executiva
    exrLevels: ['independente', 'apoio_minimo'],
    contextScores: [80, 85, 75],

    // Layer AuDHD
    audhdLayerStatus: 'active_core',
    senLevels: ['sem_impacto', 'impacto_moderado'],
    trfLevels: ['transicao_fluida', 'com_resistencia'],
    rigRecords: [{
      rig_state: 'rigidity_leaning',
      rig_severity: 'mild',
      rig_observation_count: 3,
      rig_last_updated_at: '2026-03-10T00:00:00Z',
    }],
    mskRecord: null,

    // Contextos
    sourceContexts: { clinical: 'present', home: 'present', school: 'present' },
  }

  it('retorna output completo com todos os campos', () => {
    const result = computeFullCsoTdah(fullInput)

    expect(result.engine_name).toBe('CSO-TDAH')
    expect(result.engine_version).toBe('1.0.0')
    expect(result.audhd_layer_status).toBe('active_core')

    // Scores não são null
    expect(result.core_score).not.toBeNull()
    expect(result.executive_score).not.toBeNull()
    expect(result.audhd_layer_score).not.toBeNull()
    expect(result.final_score).not.toBeNull()

    // Band é válida
    expect(['excelente', 'bom', 'atencao', 'critico']).toContain(result.final_band)

    // Confidence é high (tudo presente)
    expect(result.confidence_flag).toBe('high')

    // Missing data
    expect(result.missing_data_primary_flag).toBe('none')

    // Contextos
    expect(result.source_contexts.clinical).toBe('present')

    // Base metrics
    expect(result.base_metrics.sas_tdah.status).toBe('valid')
    expect(result.base_metrics.pis_tdah.status).toBe('valid')
    expect(result.base_metrics.bss_tdah.status).toBe('valid')
    expect(result.base_metrics.tcm_tdah.status).toBe('valid')

    // Executive metrics
    expect(result.executive_metrics.exr.status).toBe('valid')
    expect(result.executive_metrics.ctx.status).toBe('valid')

    // AuDHD metrics (layer ativa)
    expect(result.audhd_metrics).not.toBeNull()
    expect(result.audhd_metrics!.sen.status).toBe('valid')
    expect(result.audhd_metrics!.trf.status).toBe('valid')
    expect(result.audhd_metrics!.rig.status).toBe('valid')
    expect(result.audhd_metrics!.rig.rig_state).toBe('rigidity_leaning')

    // AuDHD flags
    expect(result.audhd_flags).not.toBeNull()
    expect(result.audhd_flags!.rig_alert).toBe(false) // mild severity
    expect(result.audhd_flags!.msk_experimental).toBe(true) // msk null → validation_pending

    // Timestamp
    expect(result.generated_at).toBeTruthy()
  })

  it('layer off → audhd_metrics null', () => {
    const input: CsoTdahInput = {
      ...fullInput,
      audhdLayerStatus: 'off',
    }
    const result = computeFullCsoTdah(input)

    expect(result.audhd_layer_status).toBe('off')
    expect(result.audhd_metrics).toBeNull()
    expect(result.audhd_flags).toBeNull()
    expect(result.audhd_layer_score).toBeNull()
  })

  it('sem dados → final_score null, band sem_dados, confidence low', () => {
    const emptyInput: CsoTdahInput = {
      activeTargets: [],
      masteredTargets: [],
      promptLevels: [],
      stabilityLevels: [],
      adherenceScores: [],
      exrLevels: [],
      contextScores: [],
      audhdLayerStatus: 'off',
      senLevels: [],
      trfLevels: [],
      rigRecords: [],
      mskRecord: null,
      sourceContexts: { clinical: 'missing', home: 'missing', school: 'missing' },
    }
    const result = computeFullCsoTdah(emptyInput)

    expect(result.core_score).toBeNull()
    expect(result.final_score).toBeNull()
    expect(result.final_band).toBe('sem_dados')
    expect(result.confidence_flag).toBe('low')
    expect(result.missing_data_primary_flag).toBe('insufficient_data')
  })

  it('pesos customizados são respeitados', () => {
    const input: CsoTdahInput = {
      ...fullInput,
      audhdLayerStatus: 'off',
      weights: { core: 0.70, executive: 0.30, audhd: 0.00 },
    }
    const result = computeFullCsoTdah(input)

    // Com pesos custom e layer off, só core+executive entram
    expect(result.final_score).not.toBeNull()
  })

  it('determinístico: mesma entrada → mesma saída', () => {
    const result1 = computeFullCsoTdah(fullInput)
    const result2 = computeFullCsoTdah(fullInput)

    // Tudo igual exceto generated_at (timestamp)
    expect(result1.core_score).toBe(result2.core_score)
    expect(result1.executive_score).toBe(result2.executive_score)
    expect(result1.audhd_layer_score).toBe(result2.audhd_layer_score)
    expect(result1.final_score).toBe(result2.final_score)
    expect(result1.final_band).toBe(result2.final_band)
    expect(result1.confidence_flag).toBe(result2.confidence_flag)
  })
})
