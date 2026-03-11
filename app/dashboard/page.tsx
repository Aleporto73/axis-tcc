'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '../components/Sidebar'
import { TableSkeleton } from '../components/Skeleton'
import TermsModal from '../components/TermsModal'

interface Stats {
  patients: number
  suggestions: number
  sessions_today: number
  sessions_month: number
  completion_rate: number
  total_sessions: number
  in_progress: number
  pending_confirmation: number
  pending_notes: { id: string; patient_name: string; date: string }[]
  upcoming: { id: string; patient_name: string; scheduled_at: string; status: string; push_enabled?: boolean; patient_response?: string }[]
}

interface CSOPoint {
  index: number
  date: string
  activation_level: number | null
  emotional_load: number | null
  task_adherence: number | null
  flex_trend: string
}

interface CSOHistory {
  patient_name: string
  total_records: number
  history: CSOPoint[]
  latest: CSOPoint | null
  delta: number | null
}

interface PatientOption {
  id: string
  full_name: string
}

/* ─── Mini Line Chart SVG ─── */
function DimensionChart({
  data,
  label,
  color,
  getValue,
  invert = false,
}: {
  data: CSOPoint[]
  label: string
  color: string
  getValue: (p: CSOPoint) => number | null
  invert?: boolean
}) {
  if (data.length < 2) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
        <p className="text-xs text-slate-400 italic">Dados insuficientes</p>
      </div>
    )
  }

  const w = 280, h = 80, pad = 4
  const values = data.map(p => {
    const v = getValue(p)
    if (v == null) return 0.5
    return invert ? 1 - v : v
  })
  const latest = values[values.length - 1]
  const band = latest >= 0.85 ? 'Excelente' : latest >= 0.70 ? 'Bom' : latest >= 0.50 ? 'Atencao' : 'Critico'
  const bandColor = latest >= 0.85 ? '#10b981' : latest >= 0.70 ? '#22c55e' : latest >= 0.50 ? '#f59e0b' : '#ef4444'

  const xStep = (w - pad * 2) / (values.length - 1)
  const points = values.map((v, i) => ({
    x: pad + i * xStep,
    y: pad + (1 - v) * (h - pad * 2),
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: bandColor + '20', color: bandColor }}>
          {Math.round(latest * 100)}% · {band}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(v => (
          <line key={v} x1={pad} y1={pad + (1 - v) * (h - pad * 2)} x2={w - pad} y2={pad + (1 - v) * (h - pad * 2)} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {/* Area fill */}
        <path d={areaPath} fill={color} opacity="0.08" />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2} fill={i === points.length - 1 ? color : 'white'} stroke={color} strokeWidth="1.5" />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400">Sessao 1</span>
        <span className="text-[10px] text-slate-400">Sessao {data.length}</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTerms, setShowTerms] = useState(false)
  const [acceptingTerms, setAcceptingTerms] = useState(false)
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<string>('')
  const [csoHistory, setCsoHistory] = useState<CSOHistory | null>(null)
  const [csoLoading, setCsoLoading] = useState(false)

  useEffect(() => {
    if (isLoaded && userId) {
      fetch('/api/user/tenant')
        .then(r => r.json())
        .then(data => {
          if (!data.termsAccepted) {
            setShowTerms(true)
          }
          return fetch('/api/stats')
        })
        .then(r => r.json())
        .then(data => {
          setStats(data.stats)
          setLoading(false)
        })
        .catch(() => setLoading(false))

      // Busca lista de pacientes para o seletor
      fetch('/api/patients')
        .then(r => r.json())
        .then(data => {
          const list: PatientOption[] = (data.patients || []).map((p: any) => ({ id: p.id, full_name: p.full_name }))
          setPatients(list)
          if (list.length > 0) setSelectedPatient(list[0].id)
        })
        .catch(() => {})
    }
  }, [isLoaded, userId])

  const loadCSO = useCallback(async (patientId: string) => {
    if (!patientId) return
    setCsoLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/cso-history`)
      if (res.ok) {
        const data = await res.json()
        setCsoHistory(data)
      }
    } catch { /* silent */ }
    finally { setCsoLoading(false) }
  }, [])

  useEffect(() => {
    if (selectedPatient) loadCSO(selectedPatient)
  }, [selectedPatient, loadCSO])

  const handleAcceptTerms = async () => {
    setAcceptingTerms(true)
    try {
      const res = await fetch('/api/user/accept-terms', { method: 'POST' })
      if (res.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Erro ao aceitar termos:', error)
    } finally {
      setAcceptingTerms(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (date.toDateString() === today.toDateString()) return 'Hoje'
    if (date.toDateString() === tomorrow.toDateString()) return 'Amanhã'
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  }

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const getStatusText = (status: string, patientResponse?: string) => {
    if (status === "em_andamento") return "Em andamento"
    if (status === "finalizada") return "Finalizada"
    if (status === "cancelada") return "Cancelada"
    if (status === "agendada") {
      switch (patientResponse) {
        case "accepted": return "Confirmada"
        case "declined": return "Recusada"
        case "tentative": return "Pendente"
        default: return "Agendada"
      }
    }
    return status
  }

  const getStatusStyle = (status: string, patientResponse?: string) => {
    if (status === "em_andamento") return "text-sky-600"
    if (status === "finalizada") return "text-slate-400"
    if (status === "cancelada") return "text-slate-400 line-through"
    if (status === "agendada") {
      switch (patientResponse) {
        case "accepted": return "text-emerald-600"
        case "declined": return "text-rose-500"
        case "tentative": return "text-amber-500"
        default: return "text-amber-600"
      }
    }
    return "text-slate-500"
  }

  const getStatusDot = (status: string, patientResponse?: string) => {
    if (status === "em_andamento") return "bg-[#FC608F]"
    if (status === "finalizada") return "bg-slate-300"
    if (status === "cancelada") return "bg-slate-300"
    if (status === "agendada") {
      switch (patientResponse) {
        case "accepted": return "bg-emerald-500"
        case "declined": return "bg-rose-500"
        case "tentative": return "bg-amber-400"
        default: return "bg-amber-400"
      }
    }
    return "bg-slate-400"
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
          <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
            <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
              <div className="animate-pulse bg-slate-100 rounded h-4 w-10"></div>
              <span className="text-slate-300 text-xs">·</span>
              <div className="animate-pulse bg-slate-100 rounded h-4 w-14"></div>
              <span className="text-slate-300 text-xs">·</span>
              <div className="animate-pulse bg-slate-100 rounded h-4 w-16"></div>
            </div>
          </div>
          <div className="px-4 md:px-8 lg:px-12 xl:px-16">
            <div className="mb-2">
              <div className="animate-pulse bg-slate-100 rounded h-10 w-48 mb-2"></div>
              <div className="animate-pulse bg-slate-100 rounded h-5 w-32"></div>
            </div>
            <div className="mb-6 md:mb-8 pb-5 md:pb-6 border-b border-slate-100">
              <div className="animate-pulse bg-slate-100 rounded h-6 w-36"></div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <div className="animate-pulse bg-slate-100 rounded h-6 w-40"></div>
                <div className="animate-pulse bg-slate-100 rounded h-4 w-32"></div>
              </div>
              <TableSkeleton rows={6} />
            </div>
          </div>
        </main>
      </div>
    )
  }

  const todaySessions = stats?.upcoming?.filter(s => isToday(s.scheduled_at)) || []
  const futureSessions = stats?.upcoming?.filter(s => !isToday(s.scheduled_at)) || []
  const sessionsToday = todaySessions.length
  const inProgress = stats?.in_progress || 0
  const suggestions = stats?.suggestions || 0

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      
      {showTerms && (
        <TermsModal onAccept={handleAcceptTerms} loading={acceptingTerms} />
      )}
      
      <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
        
        {/* Top Capsule Navigation */}
        <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
          <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
            <Link href="/dashboard" className="px-3 py-1 text-sm font-medium text-[#FC608F]">Hoje</Link>
            <span className="text-slate-300 text-xs">·</span>
            <Link href="/sessoes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Sessões</Link>
            <span className="text-slate-300 text-xs">·</span>
            <Link href="/pacientes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Pacientes</Link>
            <span className="text-slate-300 text-xs hidden sm:inline">·</span>
            <Link href="/sugestoes" className="hidden sm:inline px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Sugestões</Link>
          </nav>
        </div>

        <div className="px-4 md:px-8 lg:px-12 xl:px-16">
          
          {/* Header Editorial */}
          <header className="mb-2">
            <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Dashboard</h1>
            <p className="text-xs text-slate-300 font-light">Visão clínica do dia</p>
          </header>

          {/* Metrics Line + AXIS Assist */}
          <section className="mb-6 md:mb-8 pb-5 md:pb-6 border-b border-slate-100">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base md:text-xl text-slate-700 mb-1">
              <span className="text-xs text-[#FC608F]">{sessionsToday} {sessionsToday === 1 ? 'sessão' : 'sessões'} hoje</span>
              {inProgress > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{inProgress} em andamento</span>
                </>
              )}
            </div>
            
            {suggestions > 0 && (
              <p className="text-sm text-slate-500 mt-1">
                AXIS Assist — {suggestions} {suggestions === 1 ? 'sugestão aguarda' : 'sugestões aguardam'} revisão{' '}
                <Link href="/sugestoes" className="text-[#FC608F] hover:text-[#FC608F]/80 font-medium">→ Ver</Link>
              </p>
            )}
          </section>

          {/* Próximas Sessões */}
          <section data-onboarding="today-sessions">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-serif text-lg md:text-xl font-light text-slate-800">Próximas Sessões</h2>
              <span className="text-xs md:text-sm text-slate-400 italic">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>

            {(todaySessions.length > 0 || futureSessions.length > 0) ? (
              <div className="w-full overflow-x-auto">
                <div className="hidden md:grid grid-cols-10 gap-4 pb-3 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 font-medium min-w-[600px]">
                  <div className="col-span-2">Horário</div>
                  <div className="col-span-4">Paciente</div>
                  <div className="col-span-1 text-center">Push</div>
                  <div className="col-span-3">Status</div>
                </div>

                {todaySessions.length > 0 && (
                  <div className="flex flex-col min-w-[600px]">
                    {todaySessions.map((session, index) => (
                      <div 
                        key={session.id}
                        data-onboarding={index === 0 ? "session-card" : undefined}
                        onClick={() => router.push(`/sessoes/${session.id}`)}
                        className="group grid grid-cols-10 gap-4 py-4 items-center hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100"
                      >
                        <div className="col-span-2 flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{formatTime(session.scheduled_at)}</span>
                          <span className="text-xs text-slate-400">· Hoje</span>
                        </div>
                        <div className="col-span-4">
                          <span className="text-base font-medium text-slate-900">{session.patient_name}</span>
                        </div>
                        <div data-onboarding={index === 0 ? "reminders" : undefined} className="col-span-1 flex justify-center">
                          {session.push_enabled ? (
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18" />
                            </svg>
                          )}
                        </div>
                        <div data-onboarding={index === 0 ? "session-status" : undefined} className="col-span-3">
                          <span className={`inline-flex items-center gap-1.5 text-sm ${getStatusStyle(session.status, session.patient_response)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(session.status, session.patient_response)}`}></span>
                            {getStatusText(session.status, session.patient_response)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {todaySessions.length > 0 && futureSessions.length > 0 && (
                  <div className="min-w-[600px] py-3">
                    <div className="flex items-center gap-4">
                      <div className="h-px bg-slate-300 flex-1"></div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Próximos dias</span>
                      <div className="h-px bg-slate-300 flex-1"></div>
                    </div>
                  </div>
                )}

                {futureSessions.length > 0 && (
                  <div className="flex flex-col min-w-[600px]">
                    {futureSessions.map((session, index) => (
                      <div 
                        key={session.id}
                        data-onboarding={index === 0 ? "session-card" : undefined}
                        onClick={() => router.push(`/sessoes/${session.id}`)}
                        className="group grid grid-cols-10 gap-4 py-4 items-center hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100"
                      >
                        <div className="col-span-2 flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-600">{formatTime(session.scheduled_at)}</span>
                          <span className="text-xs text-slate-400">· {formatDateLabel(session.scheduled_at)}</span>
                        </div>
                        <div className="col-span-4">
                          <span className="text-base font-medium text-slate-700">{session.patient_name}</span>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          {session.push_enabled ? (
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18" />
                            </svg>
                          )}
                        </div>
                        <div className="col-span-3">
                          <span className={`inline-flex items-center gap-1.5 text-sm ${getStatusStyle(session.status, session.patient_response)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(session.status, session.patient_response)}`}></span>
                            {getStatusText(session.status, session.patient_response)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-slate-400 italic text-sm">Nenhuma sessão agendada</p>
              </div>
            )}
          </section>

          {/* ─── Evolução CSO-TCC ─── */}
          {patients.length > 0 && (
            <section className="mt-10 md:mt-12">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-5">
                <h2 className="font-serif text-lg md:text-xl font-light text-slate-800">Evolução Clínica</h2>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a1f4e]/20 max-w-xs"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              {csoLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100 animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
                      <div className="h-20 bg-slate-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : csoHistory && csoHistory.history.length >= 2 ? (
                <>
                  {/* Delta badge */}
                  {csoHistory.delta != null && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                        csoHistory.delta > 0 ? 'bg-emerald-50 text-emerald-700' :
                        csoHistory.delta < 0 ? 'bg-red-50 text-red-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {csoHistory.delta > 0 ? '↑' : csoHistory.delta < 0 ? '↓' : '→'} {csoHistory.delta > 0 ? '+' : ''}{csoHistory.delta}% vs sessão anterior
                      </span>
                      <span className="text-xs text-slate-400">{csoHistory.total_records} registros</span>
                    </div>
                  )}

                  {/* 4 dimension charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DimensionChart
                      data={csoHistory.history}
                      label="Ativação / Engajamento"
                      color="#6366f1"
                      getValue={(p) => p.activation_level}
                    />
                    <DimensionChart
                      data={csoHistory.history}
                      label="Carga Emocional"
                      color="#f59e0b"
                      getValue={(p) => p.emotional_load}
                      invert
                    />
                    <DimensionChart
                      data={csoHistory.history}
                      label="Adesão às Tarefas"
                      color="#10b981"
                      getValue={(p) => p.task_adherence}
                    />
                    <DimensionChart
                      data={csoHistory.history}
                      label="Flexibilidade Cognitiva"
                      color="#8b5cf6"
                      getValue={(p) => {
                        // flex_trend: 'improving' → high, 'declining' → low, 'flat' → mid
                        if (p.flex_trend === 'improving') return 0.85
                        if (p.flex_trend === 'declining') return 0.35
                        return 0.6
                      }}
                    />
                  </div>

                  {/* Faixas legend */}
                  <div className="flex items-center gap-4 mt-4 px-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Faixas:</span>
                    {[
                      { label: 'Excelente', color: '#10b981' },
                      { label: 'Bom', color: '#22c55e' },
                      { label: 'Atenção', color: '#f59e0b' },
                      { label: 'Crítico', color: '#ef4444' },
                    ].map(f => (
                      <span key={f.label} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }}></span>
                        <span className="text-[10px] text-slate-400">{f.label}</span>
                      </span>
                    ))}
                  </div>
                </>
              ) : csoHistory ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-100">
                  <p className="text-sm text-slate-400 italic">Este paciente precisa de pelo menos 2 sessões finalizadas para exibir a evolução.</p>
                </div>
              ) : null}
            </section>
          )}

        </div>
      </main>
    </div>
  )
}
