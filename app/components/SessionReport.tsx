'use client'

import { useState, useEffect } from 'react'
import { FileText, Clock, Calendar, Activity, X, AlertCircle } from 'lucide-react'

interface SessionReportData {
  session_number: number
  date: string
  duration: number | null
  status: string
  events: { type: string; count: number }[]
  total_events: number
  has_transcription: boolean
  cso: {
    activation_level: number | null
    cognitive_rigidity: number | null
    emotional_load: number | null
    flex_trend: string | null
  } | null
}

interface Props {
  sessionId: string
  onClose: () => void
}

export default function SessionReport({ sessionId, onClose }: Props) {
  const [data, setData] = useState<SessionReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/sessions/${sessionId}/report`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        // Audit log - REPORT_VIEW
        fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'REPORT_VIEW', entity_type: 'report', entity_id: sessionId, metadata: { report_type: 'session' } }) })
      } else {
        setError('Erro ao carregar dados')
      }
    } catch (e) {
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const eventLabel = (type: string) => {
    const labels: Record<string, string> = {
      'AVOIDANCE_OBSERVED': 'Evitou',
      'CONFRONTATION_OBSERVED': 'Enfrentou',
      'ADJUSTMENT_OBSERVED': 'Ajustou',
      'RECOVERY_OBSERVED': 'Recuperou'
    }
    return labels[type] || type
  }

  const eventColor = (type: string) => {
    const colors: Record<string, string> = {
      'AVOIDANCE_OBSERVED': 'bg-red-100 text-red-700',
      'CONFRONTATION_OBSERVED': 'bg-amber-100 text-amber-700',
      'ADJUSTMENT_OBSERVED': 'bg-blue-100 text-blue-700',
      'RECOVERY_OBSERVED': 'bg-emerald-100 text-emerald-700'
    }
    return colors[type] || 'bg-neutral-100 text-neutral-700'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-8 shadow-sm border border-blue-200 mt-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-red-200 mt-6">
        <p className="text-red-600">{error || 'Erro ao carregar dados'}</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-6 shadow-sm border border-indigo-100 mt-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Relatorio da Sessao #{data.session_number}</h2>
            <p className="text-sm text-neutral-500">Registro tecnico do processo observado</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg">
          <X className="w-5 h-5 text-neutral-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border border-neutral-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-medium text-neutral-500 uppercase">Data</span>
          </div>
          <p className="text-lg font-semibold text-neutral-900">
            {new Date(data.date).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-neutral-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-medium text-neutral-500 uppercase">Duracao</span>
          </div>
          <p className="text-lg font-semibold text-neutral-900">
            {data.duration ? `${data.duration} min` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-neutral-200">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-medium text-neutral-500 uppercase">Eventos</span>
          </div>
          <p className="text-lg font-semibold text-neutral-900">{data.total_events}</p>
        </div>
      </div>

      {data.events.length > 0 && (
        <div className="bg-white rounded-lg p-5 border border-neutral-200 mb-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 uppercase tracking-wide">Eventos Registrados</h3>
          <div className="flex flex-wrap gap-2">
            {data.events.map((e, idx) => (
              <span key={idx} className={`px-3 py-2 rounded-lg text-sm font-medium ${eventColor(e.type)}`}>
                {eventLabel(e.type)}: {e.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.cso && (
        <div className="bg-white rounded-lg p-5 border border-neutral-200 mb-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 uppercase tracking-wide">Indicadores de Processo (CSO)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-neutral-500 mb-1">Ativacao</p>
              <p className="text-lg font-semibold text-neutral-900">
                {data.cso.activation_level !== null ? data.cso.activation_level.toFixed(1) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1">Rigidez Cognitiva</p>
              <p className="text-lg font-semibold text-neutral-900">
                {data.cso.cognitive_rigidity !== null ? data.cso.cognitive_rigidity.toFixed(1) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1">Carga Emocional</p>
              <p className="text-lg font-semibold text-neutral-900">
                {data.cso.emotional_load !== null ? data.cso.emotional_load.toFixed(1) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1">Tendencia</p>
              <p className="text-lg font-semibold text-neutral-900">
                {data.cso.flex_trend === 'improving' ? '↑ Melhora' : data.cso.flex_trend === 'declining' ? '↓ Declinio' : '→ Estavel'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!data.has_transcription && (
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <p className="text-sm text-amber-700">Nenhuma transcricao disponivel para esta sessao.</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-neutral-200">
        <p className="text-xs text-neutral-400 text-center">
          Este relatório descreve eventos pontuais da sessão. Não contém inferência diagnóstica ou interpretação psicológica.
        </p>
      </div>
    </div>
  )
}
