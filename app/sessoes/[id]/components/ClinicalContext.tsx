'use client'

import { useEffect, useState } from 'react'

interface CSOData {
  activation_level: number | null
  cognitive_rigidity: number | null
  emotional_load: number | null
  task_adherence: number | null
  flex_trend: string | null
  clinical_phase: string | null
}

interface PreviousSession {
  id: string
  session_number: number
  scheduled_at: string
}

interface CaseBase {
  chief_complaint: string | null
  identified_pattern: string | null
  triggers: string | null
  core_belief: string | null
}

interface ContextData {
  has_previous: boolean
  previous_session: PreviousSession | null
  cso: CSOData | null
  headline: string | null
  case_base: CaseBase | null
}

interface ClinicalContextProps {
  sessionId: string
  patientId?: string
  onEvolutionLoaded?: (evolution: any) => void
  variant?: 'light' | 'dark'
}

// AXIS-TCC ClinicalContext — variant-aware
function formatCSOValue(val: number | null): string {
  if (val === null || val === undefined) return '—'
  return val.toFixed(2)
}

function TrendIndicator({ trend, variant = 'light' }: { trend: string | null; variant?: 'light' | 'dark' }) {
  const neutral = variant === 'dark' ? 'text-slate-400' : 'text-slate-500'
  if (!trend) return <span className={neutral}>—</span>

  switch (trend) {
    case 'up':
    case 'improving':
      return <span className={variant === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}>↑</span>
    case 'down':
    case 'declining':
      return <span className={variant === 'dark' ? 'text-amber-400' : 'text-amber-600'}>↓</span>
    default:
      return <span className={neutral}>→</span>
  }
}

export default function ClinicalContext({ sessionId, patientId, onEvolutionLoaded, variant = 'light' }: ClinicalContextProps) {
  const [context, setContext] = useState<ContextData | null>(null)
  const [loading, setLoading] = useState(true)
  const isDark = variant === 'dark'

  // Theme tokens
  const containerCls = isDark
    ? 'bg-slate-900/40 rounded-xl border border-slate-700 p-4 mb-6'
    : 'bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6'
  const titleCls = isDark ? 'text-lg font-semibold text-slate-100' : 'text-lg font-semibold text-slate-900'
  const subCls = isDark ? 'text-sm text-slate-400' : 'text-sm text-slate-600'
  const labelCls = isDark
    ? 'text-xs text-slate-500 uppercase tracking-wider'
    : 'text-xs text-slate-400 uppercase tracking-wider'
  const valueCls = isDark
    ? 'font-mono font-medium text-sm text-slate-100'
    : 'font-mono font-medium text-sm text-slate-900'
  const mutedTrend = isDark ? 'text-slate-400' : 'text-slate-500'
  const italicValueCls = isDark ? 'text-slate-500 italic text-sm truncate max-w-xl' : 'text-slate-500 italic text-sm truncate max-w-xl'
  const mainValueCls = isDark ? 'text-slate-200 text-sm font-medium truncate max-w-xl' : 'text-slate-700 text-sm font-medium truncate max-w-xl'
  const csoMutedCls = isDark ? 'text-sm text-slate-500' : 'text-sm text-slate-400'

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false

    async function fetchContext() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/context`)
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setContext(data.context)
          if (onEvolutionLoaded) onEvolutionLoaded(data.evolution ?? null)
        }
      } catch (err) {
        console.error('[ClinicalContext] Erro:', err)
        if (!cancelled) setContext(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchContext()
    return () => { cancelled = true }
  }, [sessionId])

  if (loading) {
    return (
      <div className={`${containerCls} animate-pulse`}>
        <div className={`h-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'} rounded w-48 mb-3`} />
        <div className={`h-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'} rounded w-64`} />
      </div>
    )
  }

  // Sem contexto ou erro → fallback primeira sessão
  if (!context || !context.has_previous) {
    const firstSessionCaseBase = context?.case_base
    const firstHasCaseBase = !!(firstSessionCaseBase?.identified_pattern?.trim())
    return (
      <div className={containerCls}>
        <div className="flex items-center gap-2">
          <p className={titleCls}>Contexto Clínico</p>
          {!firstHasCaseBase && patientId && (
            <a
              href={`/pacientes/${patientId}`}
              className={isDark
                ? 'bg-amber-900/40 text-amber-300 border border-amber-800 text-xs rounded-full px-2 py-0.5 hover:bg-amber-900/60 transition-colors'
                : 'bg-amber-100 text-amber-700 text-xs rounded-full px-2 py-0.5 hover:bg-amber-200 transition-colors'}
            >
              Base do caso incompleta
            </a>
          )}
        </div>
        <p className={`${subCls} mt-1`}>Primeira sessão do paciente</p>
        {firstHasCaseBase && (
          <div className="mt-2">
            <p className={`${labelCls} mb-0.5`}>Foco do tratamento</p>
            <p className={isDark ? 'text-slate-200 text-sm font-medium' : 'text-slate-700 text-sm font-medium'}>{firstSessionCaseBase!.identified_pattern}</p>
          </div>
        )}
      </div>
    )
  }

  const { previous_session, cso, headline, case_base } = context
  const hasCaseBase = !!(case_base?.identified_pattern?.trim())
  const prevDate = previous_session
    ? new Date(previous_session.scheduled_at).toLocaleDateString('pt-BR')
    : null

  return (
    <div className={containerCls}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={titleCls}>Contexto Clínico</p>
          {previous_session && (
            <p className={subCls}>
              Sessão anterior: #{previous_session.session_number} ({prevDate})
            </p>
          )}
        </div>
        {cso?.flex_trend && (
          <div className="flex items-center gap-1 text-sm">
            <span className={mutedTrend}>Tendência:</span>
            <TrendIndicator trend={cso.flex_trend} variant={variant} />
          </div>
        )}
      </div>

      {/* R1: Foco do tratamento (Base do Caso) OU Headline da sessão anterior */}
      <div className="mb-3">
        {hasCaseBase ? (
          <>
            <p
              className={`${labelCls} mb-0.5`}
              title="Padrão identificado na Base do Caso"
            >
              Foco do tratamento
            </p>
            <p className={mainValueCls}>
              {case_base!.identified_pattern}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p
                className={`${labelCls} whitespace-nowrap`}
                title="Este é o assunto da última sessão, não necessariamente o foco do tratamento."
              >
                Tema anterior
              </p>
              {patientId && (
                <a
                  href={`/pacientes/${patientId}`}
                  className={isDark
                    ? 'bg-amber-900/40 text-amber-300 border border-amber-800 text-xs rounded-full px-2 py-0.5 hover:bg-amber-900/60 transition-colors whitespace-nowrap'
                    : 'bg-amber-100 text-amber-700 text-xs rounded-full px-2 py-0.5 hover:bg-amber-200 transition-colors whitespace-nowrap'}
                >
                  Base do caso incompleta
                </a>
              )}
            </div>
            <p className={italicValueCls}>
              {headline || 'Foco não definido'}
            </p>
          </>
        )}
      </div>

      {/* CSO — 4 dimensões */}
      {cso ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className={labelCls}>Ativação</p>
            <p className={valueCls}>
              {formatCSOValue(cso.activation_level)}
            </p>
          </div>
          <div>
            <p className={labelCls}>Carga emocional</p>
            <p className={valueCls}>
              {formatCSOValue(cso.emotional_load)}
            </p>
          </div>
          <div>
            <p className={labelCls}>Adesão tarefas</p>
            <p className={valueCls}>
              {formatCSOValue(cso.task_adherence)}
            </p>
          </div>
          <div>
            <p className={labelCls}>Rigidez cogn.</p>
            <p className={valueCls}>
              {formatCSOValue(cso.cognitive_rigidity)}
            </p>
          </div>
        </div>
      ) : (
        <p className={csoMutedCls}>CSO ainda não calculado</p>
      )}
    </div>
  )
}
