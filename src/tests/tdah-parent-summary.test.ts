import { describe, expect, it } from 'vitest'
import { generateTdahParentSummary } from '@/src/lib/tdah-parent-summary'

const session = {
  patient_name: 'Amanda',
  session_context: 'clinical',
  scheduled_at: '2026-07-10T14:00:00.000Z',
}

const clinicalTerms = /\b(?:SAS|PIS|BSS|EXR|SEN|TRF|RIG|score|percentual)\b|\/\s*10\b|%/i

describe('generateTdahParentSummary', () => {
  it('uses task_description and produces the family-facing introduction', () => {
    const result = generateTdahParentSummary(session, [
      { task_description: 'Organização da mochila' },
    ])

    expect(result).toContain(
      'Na sessão clínica de 10/07/2026, realizamos com Amanda as seguintes atividades:'
    )
    expect(result).toContain('• Organização da mochila.')
  })

  it('uses protocol_title when task_description is unavailable', () => {
    const result = generateTdahParentSummary(session, [
      { task_description: '  ', protocol_title: 'Planejamento de tarefas' },
    ])

    expect(result).toContain('• Planejamento de tarefas.')
  })

  it('never includes protocol_code', () => {
    const observation = {
      task_description: 'Organização da rotina',
      protocol_title: 'Rotina diária',
      protocol_code: 'TDAH-BASE-01',
    }

    const result = generateTdahParentSummary(session, [observation])
    expect(result).not.toContain(observation.protocol_code)
  })

  it('never includes sas_score, percentages, or /10', () => {
    const observation = {
      task_description: 'Atenção durante a leitura',
      sas_score: 8,
    }

    const result = generateTdahParentSummary(session, [observation])
    expect(result).not.toContain(String(observation.sas_score))
    expect(result).not.toMatch(/\/10|%/)
  })

  it('never includes observation_notes', () => {
    const observation = {
      task_description: 'Leitura compartilhada',
      observation_notes: 'Nota clínica que não pode sair no resumo',
    }

    const result = generateTdahParentSummary(session, [observation])
    expect(result).not.toContain(observation.observation_notes)
  })

  it.each([
    ['independente', 'realizou com autonomia'],
    ['minimo', 'realizou com apoio leve'],
    ['gestual', 'realizou com apoio leve'],
    ['verbal', 'realizou com apoio leve'],
    ['modelacao', 'realizou com apoio leve'],
    ['moderado', 'realizou com apoio moderado'],
    ['fisica_parcial', 'realizou com apoio moderado'],
    ['total', 'realizou com apoio integral'],
    ['fisica_total', 'realizou com apoio integral'],
  ])('translates support level %s without exposing its raw value', (pisLevel, phrase) => {
    const result = generateTdahParentSummary(session, [
      { task_description: 'Atividade de organização', pis_level: pisLevel },
    ])

    expect(result).toContain(phrase)
    expect(result).not.toMatch(/\bPIS\b|pis_level|dica:/i)
  })

  it.each([
    ['estavel', 'manteve participação estável'],
    ['leve', 'apresentou pequenas oscilações na participação'],
    ['oscilante', 'apresentou pequenas oscilações na participação'],
    ['desregulado', 'precisou de apoio para se reorganizar'],
    ['instavel', 'precisou de apoio para se reorganizar'],
  ])('translates participation level %s without exposing its raw value', (bssLevel, phrase) => {
    const result = generateTdahParentSummary(session, [
      { task_description: 'Atividade em grupo', bss_level: bssLevel },
    ])

    expect(result).toContain(phrase)
    expect(result).not.toMatch(/\bBSS\b|bss_level|estabilidade:/i)
  })

  it('omits unknown support and participation values', () => {
    const result = generateTdahParentSummary(session, [
      {
        task_description: 'Atividade planejada em equipe',
        pis_level: 'apoio_desconhecido',
        bss_level: 'participacao_desconhecida',
      },
    ])

    expect(result).toContain('• Atividade planejada em equipe.')
    expect(result).not.toContain('apoio_desconhecido')
    expect(result).not.toContain('participacao_desconhecida')
  })

  it('returns an empty string without observations', () => {
    expect(generateTdahParentSummary(session, [])).toBe('')
  })

  it('does not include clinical acronyms or technical fields', () => {
    const observation = {
      task_description: null,
      protocol_title: 'SAS score percentual',
      protocol_code: 'PIS-BSS',
      sas_score: 10,
      observation_notes: 'EXR SEN TRF RIG',
      exr_level: 'alto',
      sen_level: 'baixo',
      trf_level: 'moderado',
      rig_state: 'ativo',
      rig_severity: 'grave',
    }

    const result = generateTdahParentSummary(session, [observation])
    expect(result).toContain('• Atividade planejada.')
    expect(result).not.toMatch(clinicalTerms)
  })

  it.each([
    ['home', 'sessão domiciliar'],
    ['school', 'sessão escolar'],
  ])('preserves the %s session context', (sessionContext, expected) => {
    const result = generateTdahParentSummary(
      { ...session, session_context: sessionContext },
      [{ task_description: 'Atividade planejada' }]
    )

    expect(result).toContain(expected)
  })
})
