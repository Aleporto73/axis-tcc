'use client'

import { useState, useEffect } from 'react'
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

export default function DashboardPage() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTerms, setShowTerms] = useState(false)
  const [acceptingTerms, setAcceptingTerms] = useState(false)

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
    }
  }, [isLoaded, userId])

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

        </div>
      </main>
    </div>
  )
}
