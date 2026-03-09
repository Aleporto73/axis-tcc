/**
 * Testes Protocol Lifecycle — Bible S3
 *
 * Cobre: 11 status, transições válidas/proibidas, regras S3.2,
 * generalização 3×2, suspensão 30 dias, terminal status.
 */
import { describe, it, expect } from 'vitest'
import {
  PROTOCOL_STATUSES,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  TransitionError,
  isValidStatus,
  isTransitionAllowed,
  getAvailableTransitions,
  isTerminal,
  validateTransition,
  daysSuspended,
  isSuspensionExpired,
} from '../protocol-lifecycle'

// ─── Status válidos ─────────────────────────────

describe('Protocol Statuses', () => {
  it('existem 11 status oficiais', () => {
    expect(PROTOCOL_STATUSES).toHaveLength(11)
  })

  it('contém todos os status esperados (Bible S3)', () => {
    const expected = [
      'draft', 'active', 'mastered', 'generalization',
      'mastered_validated', 'maintenance', 'maintained',
      'regression', 'suspended', 'discontinued', 'archived',
    ]
    expected.forEach(s => {
      expect(PROTOCOL_STATUSES).toContain(s)
    })
  })

  it('isValidStatus reconhece status válidos', () => {
    expect(isValidStatus('active')).toBe(true)
    expect(isValidStatus('mastered')).toBe(true)
    expect(isValidStatus('archived')).toBe(true)
  })

  it('isValidStatus rejeita status inválidos', () => {
    expect(isValidStatus('deleted')).toBe(false)
    expect(isValidStatus('completed')).toBe(false)
    expect(isValidStatus('')).toBe(false)
  })
})

// ─── Terminal status ────────────────────────────

describe('Terminal Statuses', () => {
  it('discontinued é terminal', () => {
    expect(isTerminal('discontinued')).toBe(true)
  })

  it('archived é terminal', () => {
    expect(isTerminal('archived')).toBe(true)
  })

  it('active não é terminal', () => {
    expect(isTerminal('active')).toBe(false)
  })

  it('terminal status não tem saídas', () => {
    expect(VALID_TRANSITIONS.discontinued).toHaveLength(0)
    expect(VALID_TRANSITIONS.archived).toHaveLength(0)
  })
})

// ─── Transições válidas (S3.1) ──────────────────

describe('Valid Transitions (Bible S3.1)', () => {
  const cases: [string, string, boolean][] = [
    // ─── Happy path (ciclo completo) ───
    ['draft', 'active', true],
    ['active', 'mastered', true],
    ['mastered', 'generalization', true],
    ['generalization', 'mastered_validated', true],
    ['mastered_validated', 'maintenance', true],
    ['maintenance', 'maintained', true],
    ['maintained', 'archived', true],

    // ─── Regressão a qualquer momento ───
    ['mastered', 'regression', true],
    ['generalization', 'regression', true],
    ['mastered_validated', 'regression', true],
    ['maintenance', 'regression', true],
    ['maintained', 'regression', true],
    ['regression', 'active', true],

    // ─── Suspensão e descontinuação ───
    ['active', 'suspended', true],
    ['active', 'discontinued', true],
    ['suspended', 'active', true],
    ['suspended', 'discontinued', true],
    ['draft', 'archived', true],

    // ─── PROIBIDAS (S3.2 regra 5) ───
    ['draft', 'mastered', false],
    ['active', 'generalization', false],
    ['active', 'archived', false],
    ['mastered', 'active', false],
    ['mastered', 'maintenance', false],
    ['archived', 'active', false],
    ['discontinued', 'active', false],
    ['regression', 'mastered', false],
    ['maintained', 'active', false],
  ]

  it.each(cases)('%s → %s = %s', (from, to, expected) => {
    expect(isTransitionAllowed(from as any, to as any)).toBe(expected)
  })
})

// ─── getAvailableTransitions ────────────────────

describe('getAvailableTransitions()', () => {
  it('draft pode ir para active ou archived', () => {
    const transitions = getAvailableTransitions('draft')
    expect(transitions).toContain('active')
    expect(transitions).toContain('archived')
    expect(transitions).toHaveLength(2)
  })

  it('active pode ir para mastered, suspended ou discontinued', () => {
    const transitions = getAvailableTransitions('active')
    expect(transitions).toContain('mastered')
    expect(transitions).toContain('suspended')
    expect(transitions).toContain('discontinued')
    expect(transitions).toHaveLength(3)
  })

  it('regression só pode voltar para active', () => {
    const transitions = getAvailableTransitions('regression')
    expect(transitions).toEqual(['active'])
  })
})

// ─── validateTransition (regras S3.2) ───────────

describe('validateTransition()', () => {
  it('transição válida retorna success', () => {
    const result = validateTransition('draft', 'active')
    expect(result.success).toBe(true)
    expect(result.from).toBe('draft')
    expect(result.to).toBe('active')
    expect(result.warnings).toHaveLength(0)
  })

  it('transição proibida lança TransitionError', () => {
    expect(() => validateTransition('draft', 'mastered')).toThrow(TransitionError)
  })

  it('status de origem inválido lança TransitionError', () => {
    expect(() => validateTransition('deleted' as any, 'active')).toThrow(TransitionError)
  })

  it('status de destino inválido lança TransitionError', () => {
    expect(() => validateTransition('active', 'completed' as any)).toThrow(TransitionError)
  })

  // S3.2 regra 1: archived só de maintained ou draft
  it('archived só a partir de maintained', () => {
    const result = validateTransition('maintained', 'archived')
    expect(result.success).toBe(true)
  })

  it('archived a partir de draft é permitido', () => {
    const result = validateTransition('draft', 'archived')
    expect(result.success).toBe(true)
  })

  // S3.2 regra 2: discontinued exige motivo
  it('discontinued sem motivo lança erro', () => {
    expect(() => validateTransition('active', 'discontinued')).toThrow(TransitionError)
    expect(() => validateTransition('active', 'discontinued', {})).toThrow(TransitionError)
    expect(() => validateTransition('active', 'discontinued', { discontinuationReason: '' })).toThrow(TransitionError)
    expect(() => validateTransition('active', 'discontinued', { discontinuationReason: '   ' })).toThrow(TransitionError)
  })

  it('discontinued com motivo funciona', () => {
    const result = validateTransition('active', 'discontinued', {
      discontinuationReason: 'Objetivo não é mais relevante'
    })
    expect(result.success).toBe(true)
  })

  // S3.2 regra 3: suspended max 30 dias
  it('suspended > 30 dias gera warning', () => {
    const suspendedAt = new Date('2026-01-01')
    const now = new Date('2026-02-15') // 45 dias depois
    const result = validateTransition('suspended', 'active', {
      suspendedAt,
      now,
    })
    expect(result.success).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('regra 3')
    expect(result.warnings[0]).toContain('45 dias')
  })

  it('suspended <= 30 dias não gera warning', () => {
    const suspendedAt = new Date('2026-01-01')
    const now = new Date('2026-01-20') // 19 dias
    const result = validateTransition('suspended', 'active', {
      suspendedAt,
      now,
    })
    expect(result.warnings).toHaveLength(0)
  })

  // S3.2 regra 6: mastered_validated exige grid 3×2 completo
  it('mastered_validated sem grid lança erro', () => {
    expect(() => validateTransition('generalization', 'mastered_validated')).toThrow(TransitionError)
  })

  it('mastered_validated com grid incompleto lança erro', () => {
    expect(() => validateTransition('generalization', 'mastered_validated', {
      generalizationGrid: { targets: 2, environments: 2, passedCells: 4 }
    })).toThrow(TransitionError)

    expect(() => validateTransition('generalization', 'mastered_validated', {
      generalizationGrid: { targets: 3, environments: 1, passedCells: 3 }
    })).toThrow(TransitionError)

    expect(() => validateTransition('generalization', 'mastered_validated', {
      generalizationGrid: { targets: 3, environments: 2, passedCells: 5 }
    })).toThrow(TransitionError)
  })

  it('mastered_validated com grid 3×2 completo (6/6) funciona', () => {
    const result = validateTransition('generalization', 'mastered_validated', {
      generalizationGrid: { targets: 3, environments: 2, passedCells: 6 }
    })
    expect(result.success).toBe(true)
  })
})

// ─── Helpers ────────────────────────────────────

describe('daysSuspended()', () => {
  it('calcula dias corretamente', () => {
    const start = new Date('2026-03-01')
    const now = new Date('2026-03-11')
    expect(daysSuspended(start, now)).toBe(10)
  })

  it('0 dias se mesmo dia', () => {
    const d = new Date('2026-03-01')
    expect(daysSuspended(d, d)).toBe(0)
  })
})

describe('isSuspensionExpired()', () => {
  it('false se <= 30 dias', () => {
    const start = new Date('2026-03-01')
    const now = new Date('2026-03-31')
    expect(isSuspensionExpired(start, now)).toBe(false)
  })

  it('true se > 30 dias', () => {
    const start = new Date('2026-03-01')
    const now = new Date('2026-04-01')
    expect(isSuspensionExpired(start, now)).toBe(true)
  })
})

// ─── Ciclo completo (integração) ────────────────

describe('Ciclo completo de protocolo', () => {
  it('happy path: draft → ... → archived (sem erros)', () => {
    const steps: [string, string, object?][] = [
      ['draft', 'active'],
      ['active', 'mastered'],
      ['mastered', 'generalization'],
      ['generalization', 'mastered_validated', {
        generalizationGrid: { targets: 3, environments: 2, passedCells: 6 }
      }],
      ['mastered_validated', 'maintenance'],
      ['maintenance', 'maintained'],
      ['maintained', 'archived'],
    ]

    for (const [from, to, ctx] of steps) {
      const result = validateTransition(from as any, to as any, ctx || {})
      expect(result.success).toBe(true)
    }
  })

  it('ciclo com regressão: mastered → regression → active → mastered', () => {
    expect(validateTransition('mastered', 'regression').success).toBe(true)
    expect(validateTransition('regression', 'active').success).toBe(true)
    expect(validateTransition('active', 'mastered').success).toBe(true)
  })
})
