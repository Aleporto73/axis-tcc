export interface TdahParentSummarySession {
  patient_name: string | null
  session_context: string
  scheduled_at: string
}

export interface TdahParentSummaryObservation {
  task_description?: string | null
  protocol_title?: string | null
  pis_level?: string | null
  bss_level?: string | null
}

const CONTEXT_LABELS: Record<string, string> = {
  clinical: 'clínica',
  home: 'domiciliar',
  school: 'escolar',
}

const TECHNICAL_CONTENT = /\b(?:SAS|PIS|BSS|EXR|SEN|TRF|RIG|score|percentual)\b|\/\s*10\b|%/i

function normalizeLevel(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
}

function formatSessionDate(value: string): string {
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR')
}

function safeActivityName(observation: TdahParentSummaryObservation): string {
  const candidates = [observation.task_description, observation.protocol_title]

  for (const candidate of candidates) {
    const text = candidate?.trim()
    if (text && !TECHNICAL_CONTENT.test(text)) return text
  }

  return 'Atividade planejada'
}

function supportPhrase(value: string | null | undefined): string | null {
  switch (normalizeLevel(value)) {
    case 'independente':
      return 'realizou com autonomia'
    case 'minimo':
    case 'gestual':
    case 'verbal':
    case 'modelacao':
      return 'realizou com apoio leve'
    case 'moderado':
    case 'fisica_parcial':
      return 'realizou com apoio moderado'
    case 'total':
    case 'fisica_total':
      return 'realizou com apoio integral'
    default:
      return null
  }
}

function participationPhrase(value: string | null | undefined): string | null {
  switch (normalizeLevel(value)) {
    case 'estavel':
      return 'manteve participação estável'
    case 'leve':
    case 'oscilante':
      return 'apresentou pequenas oscilações na participação'
    case 'desregulado':
    case 'instavel':
      return 'precisou de apoio para se reorganizar'
    default:
      return null
  }
}

export function generateTdahParentSummary(
  session: TdahParentSummarySession,
  observations: TdahParentSummaryObservation[]
): string {
  if (observations.length === 0) return ''

  const context = CONTEXT_LABELS[session.session_context] || 'realizada'
  const date = formatSessionDate(session.scheduled_at)
  const patientName = session.patient_name?.trim() || 'o paciente'
  const introduction = `Na sessão ${context} de ${date}, realizamos com ${patientName} as seguintes atividades:`

  const activities = observations.map(observation => {
    const details = [
      supportPhrase(observation.pis_level),
      participationPhrase(observation.bss_level),
    ].filter((detail): detail is string => Boolean(detail))

    const description = details.length > 0 ? ` — ${details.join(' e ')}` : ''
    return `• ${safeActivityName(observation)}${description}.`
  })

  return [introduction, ...activities].join('\n')
}
