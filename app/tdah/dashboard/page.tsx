'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// =====================================================
// AXIS TDAH - Dashboard (Métricas Reais)
// KPIs: pacientes, sessões tricontextuais, protocolos,
// CSO-TDAH médio, AuDHD ativos, pacientes críticos
// =====================================================

const TDAH_COLOR = '#0d7377'
const TDAH_LIGHT = 'rgba(13, 115, 119, 0.08)'

interface Alert {
  type: string
  severity: 'high' | 'medium' | 'low'
  patient_id: string
  patient_name: string
  message: string
  detail?: string
}

interface DashboardData {
  total_patients: number
  audhd_active: number
  sessions_month: number
  sessions_today: number
  active_protocols: number
  mastered_protocols: number
  avg_cso: number | null
  patients_critical: number
  sessions_clinical: number
  sessions_home: number
  sessions_school: number
  avg_session_duration: number
  protocols_regression: number
  total_sessions_completed: number
  engine_version: string
  _scope: 'personal' | 'clinic'
  _role: string
}

const bandColor = (score: number | null) => {
  if (score === null) return 'text-slate-400'
  if (score >= 70) return 'text-emerald-600'
  if (score >= 50) return 'text-green-600'
  if (score >= 30) return 'text-amber-600'
  return 'text-red-600'
}

export default function TDAHDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/tdah/dashboard').then(r => r.json()),
      fetch('/api/tdah/alerts').then(r => r.json()).catch(() => ({ alerts: [] })),
    ]).then(([dashData, alertData]) => {
      if (dashData.error) { setError(dashData.error); setLoading(false); return }
      setData(dashData)
      setAlerts(alertData.alerts || [])
      setLoading(false)
    }).catch(() => {
      setError('Falha de conexão com o servidor.')
      setLoading(false)
    })
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center max-w-md">
          <p className="text-sm text-slate-600 mb-2">{error}</p>
          <button onClick={() => window.location.reload()} className="text-xs font-medium" style={{ color: TDAH_COLOR }}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-100 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-slate-50 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-slate-50 rounded-xl" />
            <div className="h-48 bg-slate-50 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  const totalContextSessions = data.sessions_clinical + data.sessions_home + data.sessions_school
  const contextPct = (val: number) => totalContextSessions > 0 ? Math.round((val / totalContextSessions) * 100) : 0

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Painel TDAH</h1>
          <p className="text-sm text-slate-400 mt-1">
            {data._scope === 'personal' ? 'Seus pacientes' : 'Visão da clínica'}
            {' · '}{data.engine_version}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/tdah/pacientes"
            className="px-4 py-2 text-xs font-medium rounded-lg border transition-colors"
            style={{ borderColor: TDAH_COLOR, color: TDAH_COLOR }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = TDAH_LIGHT)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
          >
            Pacientes
          </Link>
          <Link href="/tdah/sessoes"
            className="px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: TDAH_COLOR }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a5c5f')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = TDAH_COLOR)}
          >
            Sessões
          </Link>
        </div>
      </div>

      {/* KPI Row 1 — números principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {([
          { label: 'Pacientes ativos', value: data.total_patients, sub: undefined as string | undefined },
          { label: 'Sessões (30d)', value: data.sessions_month, sub: data.sessions_today > 0 ? `${data.sessions_today} hoje` : undefined },
          { label: 'Protocolos ativos', value: data.active_protocols, sub: data.mastered_protocols > 0 ? `${data.mastered_protocols} dominados` : undefined },
          { label: 'AuDHD ativos', value: data.audhd_active, sub: data.total_patients > 0 ? `${Math.round((data.audhd_active / data.total_patients) * 100)}% dos pacientes` : undefined },
        ]).map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-100 p-5" style={{ borderTopColor: TDAH_COLOR, borderTopWidth: '2px' }}>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
            <p className="text-3xl font-bold text-slate-800 mt-2">{card.value}</p>
            {card.sub && <p className="text-[11px] text-slate-400 mt-1">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Alertas Clínicos */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              Alertas Clínicos
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">{alerts.length}</span>
            </h2>
            <Link href="/tdah/alertas" className="text-xs font-medium" style={{ color: TDAH_COLOR }}>
              Ver todos &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 8).map((alert, i) => {
              const severityStyles = {
                high: 'border-l-red-500 bg-red-50/30',
                medium: 'border-l-amber-500 bg-amber-50/30',
                low: 'border-l-blue-400 bg-blue-50/20',
              }
              const severityIcons = { high: '🔴', medium: '🟡', low: '🔵' }
              return (
                <Link
                  key={`${alert.type}-${alert.patient_id}-${i}`}
                  href={`/tdah/pacientes/${alert.patient_id}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border-l-3 hover:shadow-sm transition-all ${severityStyles[alert.severity]}`}
                  style={{ borderLeftWidth: '3px' }}
                >
                  <span className="text-sm mt-0.5">{severityIcons[alert.severity]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-700">{alert.patient_name}</span>
                      <span className="text-[10px] text-slate-400">·</span>
                      <span className="text-xs text-slate-600">{alert.message}</span>
                    </div>
                    {alert.detail && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{alert.detail}</p>
                    )}
                  </div>
                </Link>
              )
            })}
            {alerts.length > 8 && (
              <p className="text-[10px] text-slate-400 text-center pt-2">
                +{alerts.length - 8} alertas adicionais
              </p>
            )}
          </div>
        </div>
      )}

      {/* Row 2 — CSO + Contextos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* CSO-TDAH médio */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">CSO-TDAH Médio</h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center justify-center w-24 h-24 rounded-full border-4" style={{ borderColor: TDAH_COLOR }}>
              <span className={`text-3xl font-bold ${bandColor(data.avg_cso)}`}>
                {data.avg_cso !== null ? data.avg_cso : '—'}
              </span>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Pacientes em estado crítico</span>
                <span className={`text-sm font-bold ${data.patients_critical > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {data.patients_critical}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Protocolos em regressão</span>
                <span className={`text-sm font-bold ${data.protocols_regression > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {data.protocols_regression}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Duração média sessão</span>
                <span className="text-sm font-bold text-slate-700">
                  {data.avg_session_duration > 0 ? `${data.avg_session_duration} min` : '—'}
                </span>
              </div>
            </div>
          </div>
          {data.avg_cso === null && (
            <p className="text-[10px] text-slate-300 mt-3 text-center">
              Scores gerados automaticamente ao fechar sessões com observações.
            </p>
          )}
        </div>

        {/* Distribuição tricontextual */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Sessões por Contexto (30d)</h2>
          {totalContextSessions === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-slate-400">Nenhuma sessão concluída nos últimos 30 dias</p>
            </div>
          ) : (
            <div className="space-y-4">
              {([
                { label: 'Clínico', value: data.sessions_clinical, color: '#0d7377', icon: '🏥' },
                { label: 'Domiciliar', value: data.sessions_home, color: '#6366f1', icon: '🏠' },
                { label: 'Escolar', value: data.sessions_school, color: '#f59e0b', icon: '🏫' },
              ] as const).map(ctx => (
                <div key={ctx.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span>{ctx.icon}</span>
                      {ctx.label}
                    </span>
                    <span className="text-xs font-medium text-slate-700">{ctx.value} ({contextPct(ctx.value)}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${contextPct(ctx.value)}%`,
                        backgroundColor: ctx.color,
                        minWidth: ctx.value > 0 ? '4px' : '0',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {([
          { label: 'Total sessões', value: data.total_sessions_completed, warn: false },
          { label: 'Protocolos dominados', value: data.mastered_protocols, warn: false },
          { label: 'Em regressão', value: data.protocols_regression, warn: data.protocols_regression > 0 },
          { label: 'AuDHD layer', value: data.audhd_active, warn: false },
        ]).map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.warn ? 'text-red-600' : 'text-slate-800'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Atalhos rápidos */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Acesso rápido</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            { label: 'Novo paciente', href: '/tdah/pacientes', icon: '👤' },
            { label: 'Agendar sessão', href: '/tdah/sessoes', icon: '📅' },
            { label: 'Ver protocolos', href: '/tdah/pacientes', icon: '📋' },
            { label: 'Sessões hoje', href: '/tdah/sessoes', icon: '⏱️' },
          ] as const).map(a => (
            <Link key={a.label} href={a.href}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
            >
              <span className="text-lg">{a.icon}</span>
              <span className="text-xs font-medium text-slate-600">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
