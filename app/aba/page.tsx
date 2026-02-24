'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DashboardData {
  total_learners: number
  sessions_today: number
  sessions_week: number
  active_protocols: number
  mastered_protocols: number
  avg_cso: number | null
  learners_critical: number
  engine_version: string
  // KPIs avançados
  mastery_rate: number
  total_protocols: number
  avg_days_to_mastery: number
  total_sessions_completed: number
  avg_session_duration: number
  protocols_regression: number
  cancel_rate_30d: number
  protocols_gen_maint: number
  total_regressions: number
  active_learners: number
}

interface AlertItem {
  learner_id: string
  learner_name: string
  type: string
  message: string
  protocol_title: string
}

function isDashboardData(obj: unknown): obj is DashboardData {
  if (!obj || typeof obj !== 'object') return false
  const d = obj as Record<string, unknown>
  return (
    typeof d.total_learners === 'number' &&
    typeof d.sessions_today === 'number' &&
    typeof d.sessions_week === 'number' &&
    typeof d.active_protocols === 'number' &&
    typeof d.engine_version === 'string' &&
    'mastered_protocols' in d
  )
}

export default function ABADashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/aba/dashboard').then(r => r.json()),
      fetch('/api/aba/alerts').then(r => r.json()).catch(() => ({ alerts: [] }))
    ]).then(([dashJson, alertsJson]) => {
      if (isDashboardData(dashJson)) setData(dashJson)
      else setError('Resposta inválida do servidor.')
      setAlerts(alertsJson.alerts || [])
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
          <button onClick={() => window.location.reload()} className="text-xs text-aba-500 hover:text-aba-600 font-medium">Tentar novamente</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
        <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
          <Link href="/aba" className="px-3 py-1 text-sm font-medium text-aba-500">Painel</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/aba/aprendizes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Aprendizes</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/aba/sessoes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Sessões</Link>
          <span className="text-slate-300 text-xs hidden sm:inline">·</span>
          <Link href="/aba/relatorios" className="hidden sm:inline px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Relatórios</Link>
        </nav>
      </div>
      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-2">
          <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Painel ABA</h1>
          <p className="text-xs text-slate-300 font-light">Visão geral dos aprendizes</p>
        </header>
        <section className="mb-6 md:mb-8 pb-5 md:pb-6 border-b border-slate-100">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_,i) => <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-20"></div>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Aprendizes</p>
                <p className="text-2xl font-light text-aba-500">{data?.total_learners || 0}</p>
                <p className="text-[10px] text-slate-400">{(data?.sessions_today || 0)} sessão hoje</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Protocolos</p>
                <p className="text-2xl font-light text-slate-700">{data?.active_protocols || 0} <span className="text-sm text-slate-400">ativos</span></p>
                <p className="text-[10px] text-slate-400">{data?.mastered_protocols || 0} dominados</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">CSO Médio</p>
                {data?.avg_cso != null ? (
                  <>
                    <p className={`text-2xl font-light ${data.avg_cso >= 85 ? 'text-emerald-600' : data.avg_cso >= 70 ? 'text-green-600' : data.avg_cso >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{data.avg_cso}</p>
                    <p className="text-[10px] text-slate-400">{data.avg_cso >= 85 ? 'Excelente' : data.avg_cso >= 70 ? 'Bom' : data.avg_cso >= 50 ? 'Atenção' : 'Crítico'}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-300">—</p>
                )}
              </div>
              <div className={`p-4 rounded-xl border ${(data?.learners_critical || 0) > 0 ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'}`}>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Em Alerta</p>
                <p className={`text-2xl font-light ${(data?.learners_critical || 0) > 0 ? 'text-red-500' : 'text-slate-400'}`}>{data?.learners_critical || 0}</p>
                <p className="text-[10px] text-slate-400">{(data?.sessions_week || 0)} sessões na semana</p>
              </div>
            </div>
          )}
        </section>

        {!loading && data && (
          <section className="mb-6 md:mb-8 pb-5 md:pb-6 border-b border-slate-100">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Indicadores Avançados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Taxa Mastery</p>
                <p className={`text-xl font-light ${data.mastery_rate >= 60 ? 'text-emerald-600' : data.mastery_rate >= 30 ? 'text-amber-500' : 'text-slate-600'}`}>{data.mastery_rate}%</p>
                <p className="text-[10px] text-slate-400">{data.mastered_protocols} de {data.total_protocols} protocolos</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Tempo p/ Mastery</p>
                <p className="text-xl font-light text-slate-700">{data.avg_days_to_mastery > 0 ? data.avg_days_to_mastery + 'd' : '—'}</p>
                <p className="text-[10px] text-slate-400">média em dias</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Sessões Totais</p>
                <p className="text-xl font-light text-slate-700">{data.total_sessions_completed}</p>
                <p className="text-[10px] text-slate-400">{data.avg_session_duration > 0 ? '~' + data.avg_session_duration + 'min média' : 'sem dados'}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Gen. + Manut.</p>
                <p className="text-xl font-light text-purple-600">{data.protocols_gen_maint}</p>
                <p className="text-[10px] text-slate-400">protocolos em transição</p>
              </div>
              <div className={`p-3 rounded-xl border ${data.protocols_regression > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Regressões</p>
                <p className={`text-xl font-light ${data.protocols_regression > 0 ? 'text-red-500' : 'text-slate-400'}`}>{data.protocols_regression}</p>
                <p className="text-[10px] text-slate-400">{data.total_regressions} total histórico</p>
              </div>
              <div className={`p-3 rounded-xl border ${data.cancel_rate_30d > 20 ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cancelamento</p>
                <p className={`text-xl font-light ${data.cancel_rate_30d > 20 ? 'text-amber-500' : 'text-slate-600'}`}>{data.cancel_rate_30d}%</p>
                <p className="text-[10px] text-slate-400">últimos 30 dias</p>
              </div>
            </div>
          </section>
        )}

        {alerts.length > 0 && (
          <section className="mb-6 md:mb-8">
            <h2 className="text-xs font-medium text-red-500 uppercase tracking-wider mb-3">Alertas Ativos</h2>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <Link key={i} href={'/aba/aprendizes/' + a.learner_id} className="flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{a.learner_name}</p>
                    <p className="text-xs text-red-500">{a.message}</p>
                    <p className="text-[10px] text-slate-400">{a.protocol_title}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-serif text-lg md:text-xl font-light text-slate-800 mb-4">Acesso Rápido</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/aba/aprendizes" className="p-5 rounded-xl border border-slate-200 hover:border-aba-500/30 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-aba-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h3 className="text-sm font-medium text-slate-800">Aprendizes</h3>
              </div>
              <p className="text-xs text-slate-400">Cadastrar e acompanhar aprendizes</p>
            </Link>
            <Link href="/aba/sessoes" className="p-5 rounded-xl border border-slate-200 hover:border-aba-500/30 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-aba-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-sm font-medium text-slate-800">Sessões</h3>
              </div>
              <p className="text-xs text-slate-400">Agendar e registrar sessões ABA</p>
            </Link>
            <Link href="/aba/relatorios" className="p-5 rounded-xl border border-slate-200 hover:border-aba-500/30 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-aba-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-sm font-medium text-slate-800">Relatórios</h3>
              </div>
              <p className="text-xs text-slate-400">Gerar relatórios para convênio em 1 clique</p>
            </Link>
          </div>
        </section>
        <footer className="mt-12 pt-6 border-t border-slate-100">
          <p className="text-[11px] text-slate-300 italic">AXIS ABA — Motor CSO-ABA v{data?.engine_version || '...'}. Indicadores são descritivos, não diagnósticos. O julgamento clínico é sempre humano.</p>
        </footer>
      </div>
    </>
  )
}
