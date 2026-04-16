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

interface ContextData {
  has_previous: boolean
  previous_session: PreviousSession | null
  cso: CSOData | null
  headline: string | null
}

interface ClinicalContextProps {
  sessionId: string
}

function formatCSOValue(val: number | null): string {
  if (val === null || val === undefined) return '—'
  return val.toFixed(2)
}

function TrendIndicator({ trend }: { trend: string | null }) {
  if (!trend) return <span className="text-slate-500">—</span>

  switch (trend) {
    case 'up':
    case 'improving':
      return <span className="text-emerald-600">↑</span>
    case 'down':
    case 'declining':
      return <span className="text-amber-600">↓</span>
    default:
      return <span className="text-slate-500">→</span>
  }
}

export default function ClinicalContext({ sessionId }: ClinicalContextProps) {
  const [context, setContext] = useState<ContextData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false

    async function fetchContext() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/context`)
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        if (!cancelled) setContext(data.context)
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
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-48 mb-3" />
        <div className="h-3 bg-slate-100 rounded w-64" />
      </div>
    )
  }

  // Sem contexto ou erro → fallback primeira sessão
  if (!context || !context.has_previous) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6">
        <p className="text-lg font-semibold text-slate-900">Contexto Clínico</p>
        <p className="text-sm text-slate-600 mt-1">Primeira sessão do paciente</p>
      </div>
    )
  }

  const { previous_session, cso, headline } = context
  const prevDate = previous_session
    ? new Date(previous_session.scheduled_at).toLocaleDateString('pt-BR')
    : null

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-semibold text-slate-900">Contexto Clínico</p>
          {previous_session && (
            <p className="text-sm text-slate-600">
              Sessão anterior: #{previous_session.session_number} ({prevDate})
            </p>
          )}
        </div>
        {cso?.flex_trend && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-slate-500">Tendência:</span>
            <TrendIndicator trend={cso.flex_trend} />
          </div>
        )}
      </div>

      {/* Headline da sessão anterior */}
      <div className="mb-3">
        <p
          className="text-xs text-slate-400 uppercase tracking-wider mb-0.5"
          title="Este é o assunto da última sessão, não necessariamente o foco do tratamento."
        >
          Último tema da sessão anterior
        </p>
        <p className="text-slate-500 italic text-sm truncate max-w-xl">
          {headline || 'Foco não definido'}
        </p>
      </div>

      {/* CSO — 4 dimensões */}
      {cso ? (
        <div className="grid grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Ativação</p>
            <p className="font-mono font-medium text-sm text-slate-900">
              {formatCSOValue(cso.activation_level)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Carga emocional</p>
            <p className="font-mono font-medium text-sm text-slate-900">
              {formatCSOValue(cso.emotional_load)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Adesão tarefas</p>
            <p className="font-mono font-medium text-sm text-slate-900">
              {formatCSOValue(cso.task_adherence)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Rigidez cogn.</p>
            <p className="font-mono font-medium text-sm text-slate-900">
              {formatCSOValue(cso.cognitive_rigidity)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">CSO ainda não calculado</p>
      )}
    </div>
  )
}
