/**
 * Testes CSO-ABA Engine — Bible S2
 *
 * Cobre: pesos fixos 25%, cálculo 4 dimensões (SAS, PIS, BSS, TCM),
 * faixa interpretativa, clamp, edge cases.
 */
import { describe, it, expect } from 'vitest'
import {
  WEIGHTS,
  CSO_ABA_ENGINE_VERSION,
  MASTERY_SCORES,
  PROMPT_SCALE,
  INTENSITY_VALUES,
  clamp,
  calculateSAS,
  calculatePIS,
  calculateBSS,
  calculateTCM,
  calculateCsoAba,
  getFaixa,
  computeFullCsoAba,
} from '../cso-aba'

// ─── Constantes ─────────────────────────────────

describe('CSO-ABA Constants', () => {
  it('pesos fixos são 25% cada (padrão nacional, não ajustável)', () => {
    expect(WEIGHTS.SAS).toBe(0.25)
    expect(WEIGHTS.PIS).toBe(0.25)
    expect(WEIGHTS.BSS).toBe(0.25)
    expect(WEIGHTS.TCM).toBe(0.25)
    expect(WEIGHTS.SAS + WEIGHTS.PIS + WEIGHTS.BSS + WEIGHTS.TCM).toBe(1.0)
  })

  it('engine version é 1.0.0', () => {
    expect(CSO_ABA_ENGINE_VERSION).toBe('1.0.0')
  })

  it('mastery scores seguem a hierarquia', () => {
    expect(MASTERY_SCORES.maintained).toBe(100)
    expect(MASTERY_SCORES.mastered_validated).toBe(85)
    expect(MASTERY_SCORES.mastered).toBe(75)
    expect(MASTERY_SCORES.active).toBe(0)
  })

  it('prompt scale vai de 0 (física total) a 1 (independente)', () => {
    expect(PROMPT_SCALE.independente).toBe(1.0)
    expect(PROMPT_SCALE.fisica_total).toBe(0.0)
    expect(PROMPT_SCALE.gestual).toBe(0.8)
    expect(PROMPT_SCALE.verbal).toBe(0.6)
    expect(PROMPT_SCALE.modelacao).toBe(0.4)
    expect(PROMPT_SCALE.fisica_parcial).toBe(0.2)
  })

  it('intensity values crescem de leve a severa', () => {
    expect(INTENSITY_VALUES.leve).toBe(0.25)
    expect(INTENSITY_VALUES.moderada).toBe(0.5)
    expect(INTENSITY_VALUES.alta).toBe(0.75)
    expect(INTENSITY_VALUES.severa).toBe(1.0)
  })
})

// ─── Clamp ──────────────────────────────────────

describe('clamp()', () => {
  it('retorna valor dentro do intervalo', () => {
    expect(clamp(50)).toBe(50)
  })

  it('clamp mínimo 0', () => {
    expect(clamp(-10)).toBe(0)
  })

  it('clamp máximo 100', () => {
    expect(clamp(150)).toBe(100)
  })

  it('bordas exatas', () => {
    expect(clamp(0)).toBe(0)
    expect(clamp(100)).toBe(100)
  })
})

// ─── SAS (Skill Acquisition Score) ──────────────

describe('calculateSAS()', () => {
  it('retorna 0 sem alvos', () => {
    expect(calculateSAS([], [])).toBe(0)
  })

  it('calcula média ponderada de alvos ativos por trials', () => {
    // 2 alvos: score 80 com 10 trials, score 60 com 5 trials
    // SAS_ativos = (80*10 + 60*5) / (10+5) = 1100/15 = 73.33
    // mastery_rate = 0 (sem mastered)
    // SAS = 73.33 * 1 + 0 * 0 = 73.33
    const result = calculateSAS(
      [{ score: 80, trials: 10 }, { score: 60, trials: 5 }],
      []
    )
    expect(result).toBeCloseTo(73.33, 1)
  })

  it('calcula com alvos dominados (mastery portion)', () => {
    // 1 ativo: score 50, trials 10
    // 1 mastered: score default 75
    // mastery_rate = 1/2 = 0.5
    // SAS_ativos = 50
    // mastery_score = 75
    // SAS = 50 * 0.5 + 75 * 0.5 = 62.5
    const result = calculateSAS(
      [{ score: 50, trials: 10 }],
      [{ status: 'mastered' }]
    )
    expect(result).toBeCloseTo(62.5, 1)
  })

  it('100% mastered_validated retorna 85', () => {
    const result = calculateSAS(
      [],
      [{ status: 'mastered_validated' }]
    )
    expect(result).toBe(85)
  })

  it('100% maintained retorna 100', () => {
    const result = calculateSAS(
      [],
      [{ status: 'maintained' }]
    )
    expect(result).toBe(100)
  })

  it('usa score custom se fornecido no mastered target', () => {
    const result = calculateSAS(
      [],
      [{ status: 'mastered', score: 90 }]
    )
    expect(result).toBe(90)
  })

  it('clamp a 100 se calcular acima', () => {
    const result = calculateSAS(
      [],
      [{ status: 'maintained', score: 110 }]
    )
    expect(result).toBe(100)
  })
})

// ─── PIS (Prompt Independence Score) ────────────

describe('calculatePIS()', () => {
  it('retorna 0 sem dados', () => {
    expect(calculatePIS([])).toBe(0)
  })

  it('100% independente = PIS 100', () => {
    expect(calculatePIS(['independente', 'independente'])).toBe(100)
  })

  it('100% física total = PIS 0', () => {
    expect(calculatePIS(['fisica_total', 'fisica_total'])).toBe(0)
  })

  it('misto: independente + verbal = 80', () => {
    // (1.0 + 0.6) / 2 * 100 = 80
    const result = calculatePIS(['independente', 'verbal'])
    expect(result).toBe(80)
  })

  it('todos os níveis: média correta', () => {
    const all: ('independente' | 'gestual' | 'verbal' | 'modelacao' | 'fisica_parcial' | 'fisica_total')[] = [
      'independente', 'gestual', 'verbal', 'modelacao', 'fisica_parcial', 'fisica_total'
    ]
    // (1.0 + 0.8 + 0.6 + 0.4 + 0.2 + 0.0) / 6 * 100 = 50
    expect(calculatePIS(all)).toBe(50)
  })
})

// ─── BSS (Behavioral Stability Score) ───────────

describe('calculateBSS()', () => {
  it('leve + trend 1.0 = 75', () => {
    // 100 * (1 - 0.25) * 1.0 = 75
    expect(calculateBSS('leve', 1.0)).toBe(75)
  })

  it('severa = 0 (qualquer trend)', () => {
    // 100 * (1 - 1.0) * 1.0 = 0
    expect(calculateBSS('severa', 1.0)).toBe(0)
  })

  it('sem comportamento problema (leve + trend 1.0) = 75', () => {
    expect(calculateBSS('leve', 1.0)).toBe(75)
  })

  it('moderada + trend 0.5 = 25', () => {
    // 100 * (1 - 0.5) * 0.5 = 25
    expect(calculateBSS('moderada', 0.5)).toBe(25)
  })

  it('clamp: nunca negativo', () => {
    expect(calculateBSS('severa', -1)).toBe(0)
  })

  it('clamp: nunca acima de 100', () => {
    expect(calculateBSS('leve', 2.0)).toBe(100)
  })
})

// ─── TCM (Therapeutic Consistency Metric) ───────

describe('calculateTCM()', () => {
  it('< 2 sessões retorna 75 (neutro)', () => {
    expect(calculateTCM([])).toBe(75)
    expect(calculateTCM([80])).toBe(75)
  })

  it('sessões iguais = TCM 100 (CV = 0)', () => {
    expect(calculateTCM([80, 80, 80, 80, 80])).toBe(100)
  })

  it('usa últimas 5 sessões', () => {
    // 10 sessões, só as últimas 5 importam
    const scores = [10, 20, 30, 40, 50, 80, 80, 80, 80, 80]
    expect(calculateTCM(scores)).toBe(100)
  })

  it('alta variabilidade = TCM baixo', () => {
    const result = calculateTCM([10, 90, 10, 90, 10])
    expect(result).toBeLessThan(50)
  })

  it('média zero retorna 0', () => {
    expect(calculateTCM([0, 0, 0])).toBe(0)
  })
})

// ─── Fórmula Principal CSO-ABA ──────────────────

describe('calculateCsoAba()', () => {
  it('todos 100 = CSO 100', () => {
    expect(calculateCsoAba(100, 100, 100, 100)).toBe(100)
  })

  it('todos 0 = CSO 0', () => {
    expect(calculateCsoAba(0, 0, 0, 0)).toBe(0)
  })

  it('pesos iguais: (80+60+40+20)/4 = 50', () => {
    const result = calculateCsoAba(80, 60, 40, 20)
    expect(result).toBe(50)
  })

  it('clamp: nunca acima de 100', () => {
    expect(calculateCsoAba(120, 120, 120, 120)).toBe(100)
  })
})

// ─── Faixa Interpretativa ───────────────────────

describe('getFaixa()', () => {
  it('>= 85 = excelente', () => {
    expect(getFaixa(85)).toBe('excelente')
    expect(getFaixa(100)).toBe('excelente')
  })

  it('>= 70 e < 85 = bom', () => {
    expect(getFaixa(70)).toBe('bom')
    expect(getFaixa(84.9)).toBe('bom')
  })

  it('>= 50 e < 70 = atencao', () => {
    expect(getFaixa(50)).toBe('atencao')
    expect(getFaixa(69.9)).toBe('atencao')
  })

  it('< 50 = critico', () => {
    expect(getFaixa(49.9)).toBe('critico')
    expect(getFaixa(0)).toBe('critico')
  })
})

// ─── computeFullCsoAba (integração) ─────────────

describe('computeFullCsoAba()', () => {
  it('cenário completo: aprendiz em progresso moderado', () => {
    const result = computeFullCsoAba({
      activeTargets: [
        { score: 70, trials: 10 },
        { score: 60, trials: 8 },
      ],
      masteredTargets: [{ status: 'mastered' }],
      promptLevels: ['independente', 'gestual', 'verbal'],
      behaviorIntensity: 'leve',
      trendFactor: 0.9,
      sessionScores: [60, 65, 68, 70, 72],
    })

    expect(result.sas).toBeGreaterThan(0)
    expect(result.pis).toBeGreaterThan(0)
    expect(result.bss).toBeGreaterThan(0)
    expect(result.tcm).toBeGreaterThan(0)
    expect(result.csoAba).toBeGreaterThan(0)
    expect(['excelente', 'bom', 'atencao', 'critico']).toContain(result.faixa)

    // CSO = 0.25 * SAS + 0.25 * PIS + 0.25 * BSS + 0.25 * TCM
    const expected = 0.25 * result.sas + 0.25 * result.pis + 0.25 * result.bss + 0.25 * result.tcm
    expect(result.csoAba).toBeCloseTo(expected, 2)
  })

  it('cenário zero: sem dados', () => {
    const result = computeFullCsoAba({
      activeTargets: [],
      masteredTargets: [],
      promptLevels: [],
      behaviorIntensity: 'severa',
      trendFactor: 0,
      sessionScores: [],
    })

    expect(result.sas).toBe(0)
    expect(result.pis).toBe(0)
    expect(result.bss).toBe(0)
    // TCM = 75 (neutro, < 2 sessões)
    expect(result.tcm).toBe(75)
    // CSO = 0.25 * 0 + 0.25 * 0 + 0.25 * 0 + 0.25 * 75 = 18.75
    expect(result.csoAba).toBeCloseTo(18.75, 2)
    expect(result.faixa).toBe('critico')
  })

  it('cenário excelente: tudo dominado, independente, estável', () => {
    const result = computeFullCsoAba({
      activeTargets: [],
      masteredTargets: [
        { status: 'maintained' },
        { status: 'maintained' },
      ],
      promptLevels: ['independente', 'independente'],
      behaviorIntensity: 'leve',
      trendFactor: 1.0,
      sessionScores: [95, 96, 94, 95, 96],
    })

    expect(result.sas).toBe(100)
    expect(result.pis).toBe(100)
    expect(result.bss).toBe(75)
    expect(result.tcm).toBeGreaterThan(95)
    expect(result.faixa).toBe('excelente') // ~93.5 → ≥85 = excelente
  })

  it('resultado é determinístico (mesma entrada = mesma saída)', () => {
    const params = {
      activeTargets: [{ score: 75, trials: 10 }],
      masteredTargets: [{ status: 'mastered' as const }],
      promptLevels: ['verbal' as const, 'gestual' as const],
      behaviorIntensity: 'moderada' as const,
      trendFactor: 0.8,
      sessionScores: [50, 55, 60, 65, 70],
    }

    const r1 = computeFullCsoAba(params)
    const r2 = computeFullCsoAba(params)

    expect(r1.csoAba).toBe(r2.csoAba)
    expect(r1.sas).toBe(r2.sas)
    expect(r1.pis).toBe(r2.pis)
    expect(r1.bss).toBe(r2.bss)
    expect(r1.tcm).toBe(r2.tcm)
  })
})
