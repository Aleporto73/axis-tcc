'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '../components/Sidebar'

interface Session {
  id: string
  patient_id: string
  patient_name: string
  created_at: string
  scheduled_at: string
  started_at: string
  status: string
  session_number: number
  duration_minutes: number
  patient_response: string
  push_enabled?: boolean
}

interface Patient {
  id: string
  full_name: string
}

export default function SessoesPage() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState('')
  const [sessionMode, setSessionMode] = useState<'now' | 'schedule'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [creating, setCreating] = useState(false)
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const [periodFilter, setPeriodFilter] = useState('semana')
  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 15

  useEffect(() => {
    if (isLoaded && userId) loadData()
  }, [isLoaded, userId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [sessionsRes, patientsRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/patients')
      ])
      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessions(data.sessions || [])
      }
      if (patientsRes.ok) {
        const data = await patientsRes.json()
        setPatients(data.patients || [])
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSession = async () => {
    if (!selectedPatient) return
    if (sessionMode === 'schedule' && (!scheduledDate || !scheduledTime)) {
      alert('Selecione data e hora para agendar')
      return
    }
    try {
      setCreating(true)
      const body: any = { patient_id: selectedPatient }
      if (sessionMode === 'now') {
        body.start_now = true
      } else {
        body.start_now = false
        const localDateTime = new Date(scheduledDate + 'T' + scheduledTime + ':00')
        body.scheduled_at = localDateTime.toISOString()
      }
      const res = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        const data = await res.json()
        setShowModal(false)
        setSelectedPatient('')
        setScheduledDate('')
        setScheduledTime('')
        setSessionMode('now')
        if (sessionMode === 'now') {
          router.push('/sessoes/' + data.session.id)
        } else {
          loadData()
        }
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusText = (status: string, patientResponse: string) => {
    if (status === 'em_andamento') return 'Em andamento'
    if (status === 'finalizada') return 'Finalizada'
    if (status === 'cancelada') return 'Cancelada'
    if (status === 'agendada') {
      switch (patientResponse) {
        case 'accepted': return 'Confirmada'
        case 'declined': return 'Recusada'
        case 'tentative': return 'Pendente'
        default: return 'Agendada'
      }
    }
    return status
  }

  const getStatusStyle = (status: string, patientResponse: string) => {
    if (status === 'em_andamento') return 'text-[#FC608F]'
    if (status === 'finalizada') return 'text-slate-400'
    if (status === 'cancelada') return 'text-slate-400 line-through'
    if (status === 'agendada') {
      switch (patientResponse) {
        case 'accepted': return 'text-emerald-600'
        case 'declined': return 'text-rose-500'
        case 'tentative': return 'text-amber-500'
        default: return 'text-slate-600'
      }
    }
    return 'text-slate-500'
  }

  const getStatusDot = (status: string, patientResponse: string) => {
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
  // Helpers de data
  const isToday = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isTomorrow = (dateStr: string) => {
    const date = new Date(dateStr)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return date.toDateString() === tomorrow.toDateString()
  }

  const isThisWeek = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    return date >= startOfWeek && date <= endOfWeek
  }

  const isNextWeek = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const startOfNextWeek = new Date(today)
    startOfNextWeek.setDate(today.getDate() - today.getDay() + 7)
    const endOfNextWeek = new Date(startOfNextWeek)
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6)
    return date >= startOfNextWeek && date <= endOfNextWeek
  }

  const isThisMonth = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }

  // Filtrar sessões
  const filteredSessions = sessions.filter(s => {
    const dateStr = s.scheduled_at || s.started_at || s.created_at
    
    // Filtro de busca
    const matchesSearch = search === '' || s.patient_name.toLowerCase().includes(search.toLowerCase())
    
    // Filtro de status
    const matchesStatus = statusFilter === 'todas' || 
      (statusFilter === 'agendadas' && s.status === 'agendada') ||
      (statusFilter === 'finalizadas' && s.status === 'finalizada') ||
      (statusFilter === 'em_andamento' && s.status === 'em_andamento')
    
    // Filtro de período
    let matchesPeriod = true
    if (periodFilter === 'hoje') matchesPeriod = isToday(dateStr)
    else if (periodFilter === 'amanha') matchesPeriod = isTomorrow(dateStr)
    else if (periodFilter === 'semana') matchesPeriod = isThisWeek(dateStr)
    else if (periodFilter === 'proxima_semana') matchesPeriod = isNextWeek(dateStr)
    else if (periodFilter === 'mes') matchesPeriod = isThisMonth(dateStr)
    
    return matchesSearch && matchesStatus && matchesPeriod
  }).sort((a, b) => {
    const dateA = new Date(a.scheduled_at || a.started_at || a.created_at)
    const dateB = new Date(b.scheduled_at || b.started_at || b.created_at)
    return dateA.getTime() - dateB.getTime()
  })

  const totalPages = Math.ceil(filteredSessions.length / perPage)
  const paginatedSessions = filteredSessions.slice((currentPage - 1) * perPage, currentPage * perPage)

  useEffect(() => { setCurrentPage(1) }, [search, statusFilter, periodFilter])

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="md:ml-20 min-h-screen flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#FC608F] border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      
      <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
        
        <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
          <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
            <Link href="/dashboard" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Hoje</Link>
            <span className="text-slate-300 text-xs">·</span>
            <Link href="/sessoes" className="px-3 py-1 text-sm font-medium text-[#FC608F]">Sessões</Link>
            <span className="text-slate-300 text-xs">·</span>
            <Link href="/pacientes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Pacientes</Link>
            <span className="text-slate-300 text-xs hidden sm:inline">·</span>
            <Link href="/sugestoes" className="hidden sm:inline px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Sugestões</Link>
          </nav>
        </div>

        <div className="px-4 md:px-8 lg:px-12 xl:px-16">
          
          <header className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Sessões</h1>
              <p className="text-xs text-slate-300 font-light">Histórico de sessões clínicas</p>
            </div>
            <button onClick={() => setShowModal(true)} data-onboarding="new-session" className="flex items-center gap-2 px-5 py-2.5 bg-[#a2acb9]/20 text-[#344155] border border-[#a2acb9]/40 rounded-lg hover:bg-[#a2acb9]/30 transition-colors text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Nova Sessão
            </button>
          </header>

          {/* Filtros */}
          <section className="flex flex-col gap-3 mb-6 pb-6 border-b border-slate-100">
            {/* Período */}
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'hoje', label: 'Hoje' },
                { value: 'amanha', label: 'Amanhã' },
                { value: 'semana', label: 'Esta semana' },
                { value: 'proxima_semana', label: 'Próxima semana' },
                { value: 'mes', label: 'Este mês' },
                { value: 'todas', label: 'Todas' },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriodFilter(p.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${periodFilter === p.value ? 'bg-slate-200 text-slate-700 border border-slate-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Busca e Status */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Buscar por paciente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
              >
                <option value="todas">Todos os status</option>
                <option value="agendadas">Agendadas</option>
                <option value="em_andamento">Em andamento</option>
                <option value="finalizadas">Finalizadas</option>
              </select>
            </div>
          </section>

          {/* Tabela */}
          {paginatedSessions.length > 0 ? (
            <>
              <div className="w-full overflow-x-auto">
                <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 font-medium min-w-[700px]">
                  <div className="col-span-2">Data</div>
                  <div className="col-span-1">Hora</div>
                  <div className="col-span-4">Paciente</div>
                  <div className="col-span-1 text-center">Sessão</div>
                  <div className="col-span-1 text-center">Push</div>
                  <div className="col-span-3">Status</div>
                </div>

                <div className="flex flex-col min-w-[700px]">
                  {paginatedSessions.map((session) => {
                    const dateStr = session.scheduled_at || session.started_at || session.created_at
                    return (
                      <div 
                        key={session.id}
                        onClick={() => router.push(`/sessoes/${session.id}`)}
                        className="group grid grid-cols-12 gap-4 py-4 items-center hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100"
                      >
                        <div className="col-span-2">
                          <span className="text-sm text-slate-700">{formatDate(dateStr)}</span>
                        </div>
                        <div className="col-span-1">
                          <span className="text-sm text-slate-500">{formatTime(dateStr)}</span>
                        </div>
                        <div className="col-span-4">
                          <span className="text-base font-medium text-slate-900">{session.patient_name}</span>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-sm text-slate-500">#{session.session_number}</span>
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
                    )
                  })}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Página {currentPage} de {totalPages} · {filteredSessions.length} sessões</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">← Anterior</button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Próxima →</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-slate-400 italic">{search || statusFilter !== 'todas' || periodFilter !== 'todas' ? 'Nenhuma sessão encontrada com esses filtros' : 'Nenhuma sessão registrada'}</p>
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-serif text-xl font-light text-slate-900">Nova Sessão</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Paciente</label>
                <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
                  <option value="">Escolha um paciente...</option>
                  {patients.map((p) => (<option key={p.id} value={p.id}>{p.full_name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quando</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSessionMode('now')} className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${sessionMode === 'now' ? 'border-[#FC608F] bg-[#FC608F]/10 text-[#FC608F]' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Iniciar Agora</button>
                  <button type="button" onClick={() => setSessionMode('schedule')} className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${sessionMode === 'schedule' ? 'border-[#FC608F] bg-[#FC608F]/10 text-[#FC608F]' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>Agendar</button>
                </div>
              </div>
              {sessionMode === 'schedule' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
                    <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Hora</label>
                    <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleCreateSession} disabled={creating || !selectedPatient} className="px-5 py-2 bg-[#FC608F] text-white rounded-lg hover:bg-[#FC608F]/90 disabled:opacity-50 text-sm font-medium flex items-center gap-2">
                {creating ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Criando...</>) : sessionMode === 'now' ? 'Iniciar Sessão' : 'Agendar Sessão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
