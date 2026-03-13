'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// =====================================================
// AXIS TDAH - Página de Alertas Clínicos
// Lista completa de alertas com filtro por severidade
// Links diretos para ficha do paciente
// =====================================================

const TDAH_COLOR = '#0d7377'

interface Alert {
  type: string
  severity: 'high' | 'medium' | 'low'
  patient_id: string
  patient_name: string
  message: string
  detail?: string
}

const typeLabels: Record<string, string> = {
  critical_score: 'Score Crítico',
  regression: 'Regressão',
  no_session: 'Sem Sessão',
  drc_pending: 'DRC Pendente',
  score_drop: 'Queda de Score',
}

const severityLabels: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const severityStyles: Record<string, string> = {
  high: 'border-l-red-500 bg-red-50/40',
  medium: 'border-l-amber-500 bg-amber-50/40',
  low: 'border-l-blue-400 bg-blue-50/30',
}

const severityBadge: Record<string, string> = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-600',
  low: 'bg-blue-50 text-blue-600',
}

const severityIcons: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🔵',
}

export default function AlertasTDAHPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/tdah/alerts')
      .then(r => r.json())
      .then(d => { setAlerts(d.alerts || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter)

  const countBySeverity = (sev: string) => alerts.filter(a => a.severity === sev).length

  if (loading) {
    return (
      <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/4" />
          <div className="h-24 bg-slate-50 rounded-xl" />
          <div className="h-24 bg-slate-50 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alertas Clínicos</h1>
          <p className="text-sm text-slate-400 mt-1">
            {alerts.length === 0 ? 'Nenhum alerta ativo' : `${alerts.length} alerta${alerts.length > 1 ? 's' : ''} ativo${alerts.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/tdah"
          className="px-4 py-2 text-xs font-medium rounded-lg border transition-colors"
          style={{ borderColor: TDAH_COLOR, color: TDAH_COLOR }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${TDAH_COLOR}0D`)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
        >
          Voltar ao Painel
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['high', 'medium', 'low'] as const).map(sev => (
          <div key={sev} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
            <span className="text-lg">{severityIcons[sev]}</span>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{severityLabels[sev]}</p>
              <p className="text-2xl font-bold text-slate-800">{countBySeverity(sev)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'high', label: 'Alta' },
          { key: 'medium', label: 'Média' },
          { key: 'low', label: 'Baixa' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key
                ? 'text-white'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
            style={filter === f.key ? { backgroundColor: TDAH_COLOR } : {}}
          >
            {f.label}
            {f.key !== 'all' && ` (${countBySeverity(f.key)})`}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
          <p className="text-sm text-slate-400">
            {alerts.length === 0
              ? 'Nenhum alerta clínico no momento. Seus pacientes estão bem!'
              : 'Nenhum alerta nesta categoria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert, i) => (
            <Link
              key={`${alert.type}-${alert.patient_id}-${i}`}
              href={`/tdah/pacientes/${alert.patient_id}`}
              className={`flex items-start gap-4 p-4 rounded-xl hover:shadow-sm transition-all ${severityStyles[alert.severity]}`}
              style={{ borderLeftWidth: '4px' }}
            >
              <span className="text-base mt-0.5">{severityIcons[alert.severity]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800">{alert.patient_name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBadge[alert.severity]}`}>
                    {typeLabels[alert.type] || alert.type}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{alert.message}</p>
                {alert.detail && (
                  <p className="text-xs text-slate-400 mt-1">{alert.detail}</p>
                )}
              </div>
              <span className="text-xs text-slate-300 shrink-0 mt-1">&rarr;</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
