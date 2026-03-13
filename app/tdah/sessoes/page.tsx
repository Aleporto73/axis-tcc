'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRole } from '@/app/components/RoleProvider'

// =====================================================
// AXIS TDAH - Página de Sessões (Tricontextual)
// Contextos: clinical | home | school
// Padrão clonado de ABA, adaptado para TDAH
// Cor: #0d7377
// =====================================================

const TDAH_COLOR = '#0d7377'
const TDAH_LIGHT = 'rgba(13, 115, 119, 0.1)'

interface Session {
  id: string
  patient_id: string
  patient_name: string
  session_number: number | null
  therapist_id: string
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  status: string
  session_context: string
  session_notes: string | null
}

interface Patient {
  id: string
  name: string
}

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-600',
  in_progress: 'bg-amber-50 text-amber-600',
  completed: 'bg-green-50 text-green-600',
  cancelled: 'bg-slate-100 text-slate-400',
}

const contextLabels: Record<string, string> = {
  clinical: 'Clínico',
  home: 'Domiciliar',
  school: 'Escolar',
}

const contextColors: Record<string, string> = {
  clinical: 'bg-teal-50 text-teal-700',
  home: 'bg-sky-50 text-sky-700',
  school: 'bg-violet-50 text-violet-700',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDatetime(iso: string): string {
  return `${formatDate(iso)} às ${formatTime(iso)}`
}

function SessionCard({ s, highlight }: { s: Session; highlight?: boolean }) {
  return (
    <Link
      href={`/tdah/sessoes/${s.id}`}
      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
        highlight
          ? 'border-slate-200 bg-gradient-to-r from-teal-50/50 to-transparent hover:shadow-sm'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: TDAH_LIGHT }}>
          <span className="text-sm font-medium" style={{ color: TDAH_COLOR }}>{s.patient_name.charAt(0)}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800">
              {s.patient_name}
            </span>
            {s.session_number && (
              <span className="text-[10px] text-slate-400">#{s.session_number}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">
              {highlight ? formatTime(s.scheduled_at) : formatDatetime(s.scheduled_at)}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${contextColors[s.session_context] || 'bg-slate-100 text-slate-500'}`}>
              {contextLabels[s.session_context] || s.session_context}
            </span>
          </div>
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[s.status] || 'bg-slate-100 text-slate-500'}`}>
        {statusLabels[s.status] || s.status}
      </span>
    </Link>
  )
}

export default function SessoesTDAHPage() {
  const searchParams = useSearchParams()
  const { profile } = useRole()
  const [sessions, setSessions] = useState<Session[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [contextFilter, setContextFilter] = useState<string>('all')
  const [form, setForm] = useState({
    patient_id: '',
    scheduled_date: '',
    scheduled_time: '',
    session_context: 'clinical',
    session_notes: '',
  })

  // Detectar query params ?novo=true&paciente=xxx
  useEffect(() => {
    const novo = searchParams.get('novo')
    const paciente = searchParams.get('paciente')
    if (novo === 'true') {
      setShowModal(true)
      if (paciente) {
        setForm(f => ({ ...f, patient_id: paciente }))
      }
      window.history.replaceState({}, '', '/tdah/sessoes')
    }
    // Filtro por paciente na URL (sem modal)
    const pacienteFilter = searchParams.get('paciente')
    if (pacienteFilter && novo !== 'true') {
      // Usa query param para filtrar sessões
    }
  }, [searchParams])

  const fetchSessions = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)
    if (contextFilter !== 'all') params.set('context', contextFilter)
    const patientParam = searchParams.get('paciente')
    if (patientParam && !searchParams.get('novo')) params.set('patient_id', patientParam)
    const qs = params.toString()
    fetch(`/api/tdah/sessions${qs ? `?${qs}` : ''}`)
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filter, contextFilter, searchParams])

  const fetchPatients = useCallback(() => {
    fetch('/api/tdah/patients')
      .then(r => r.json())
      .then(d => setPatients(d.patients || []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])
  useEffect(() => { fetchPatients() }, [fetchPatients])

  const handleSubmit = async () => {
    if (!form.patient_id || !form.scheduled_date || !form.scheduled_time) {
      setError('Paciente, data e horário são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const scheduled_at = `${form.scheduled_date}T${form.scheduled_time}:00`
      const res = await fetch('/api/tdah/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: form.patient_id,
          scheduled_at,
          session_context: form.session_context,
          session_notes: form.session_notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro ao agendar')
        setSaving(false)
        return
      }
      setForm({ patient_id: '', scheduled_date: '', scheduled_time: '', session_context: 'clinical', session_notes: '' })
      setShowModal(false)
      setSaving(false)
      fetchSessions()
    } catch {
      setError('Falha de conexão.')
      setSaving(false)
    }
  }

  const todaySessions = sessions.filter(s => {
    const today = new Date().toISOString().split('T')[0]
    return s.scheduled_at.startsWith(today)
  })

  const otherSessions = sessions.filter(s => {
    const today = new Date().toISOString().split('T')[0]
    return !s.scheduled_at.startsWith(today)
  })

  return (
    <>
      {/* Nav pills */}
      <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
        <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
          <Link href="/tdah/dashboard" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Dashboard</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/tdah/pacientes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Pacientes</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/tdah/sessoes" className="px-3 py-1 text-sm font-medium" style={{ color: TDAH_COLOR }}>Sessões</Link>
        </nav>
      </div>

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Sessões</h1>
            <p className="text-xs text-slate-300 font-light">
              {loading ? '...' : `${sessions.length} ${sessions.length === 1 ? 'sessão' : 'sessões'}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
            style={{ backgroundColor: TDAH_COLOR }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a5c5f')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = TDAH_COLOR)}
          >
            + Nova Sessão
          </button>
        </header>

        {/* Filtros: status */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { key: 'all', label: 'Todas' },
            { key: 'scheduled', label: 'Agendadas' },
            { key: 'in_progress', label: 'Em andamento' },
            { key: 'completed', label: 'Concluídas' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                filter !== f.key ? 'border-slate-200 text-slate-400 hover:text-slate-600' : ''
              }`}
              style={filter === f.key ? { borderColor: TDAH_COLOR, color: TDAH_COLOR, backgroundColor: `${TDAH_COLOR}0D` } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Filtros: contexto */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'all', label: 'Todos contextos' },
            { key: 'clinical', label: 'Clínico' },
            { key: 'home', label: 'Domiciliar' },
            { key: 'school', label: 'Escolar' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setContextFilter(f.key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                contextFilter === f.key
                  ? 'border-slate-400 text-slate-600 bg-slate-50'
                  : 'border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-slate-50 rounded-xl h-20" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: TDAH_LIGHT }}>
              <svg className="w-8 h-8" style={{ color: TDAH_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 mb-1">Nenhuma sessão encontrada</p>
            <p className="text-xs text-slate-400">Clique em &quot;+ Nova Sessão&quot; para agendar</p>
          </div>
        ) : (
          <>
            {todaySessions.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: TDAH_COLOR }}>Hoje</h2>
                <div className="space-y-2">
                  {todaySessions.map(s => <SessionCard key={s.id} s={s} highlight />)}
                </div>
              </div>
            )}
            {otherSessions.length > 0 && (
              <div>
                {todaySessions.length > 0 && (
                  <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Anteriores e futuras</h2>
                )}
                <div className="space-y-2">
                  {otherSessions.map(s => <SessionCard key={s.id} s={s} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Nova Sessão */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-light text-slate-800">Nova Sessão</h2>
                <button onClick={() => { setShowModal(false); setError(null) }} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              {/* Paciente */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Paciente *</label>
                <select
                  value={form.patient_id}
                  onChange={e => setForm({ ...form, patient_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                  onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}
                >
                  <option value="">Selecione...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Data + Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data *</label>
                  <input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Horário *</label>
                  <input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')} />
                </div>
              </div>

              {/* Contexto tricontextual */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Contexto da sessão *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'clinical', label: 'Clínico', icon: '🏥' },
                    { value: 'home', label: 'Domiciliar', icon: '🏠' },
                    { value: 'school', label: 'Escolar', icon: '🏫' },
                  ].map(ctx => (
                    <button
                      key={ctx.value}
                      type="button"
                      onClick={() => setForm({ ...form, session_context: ctx.value })}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        form.session_context === ctx.value
                          ? 'border-2 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      style={form.session_context === ctx.value ? { borderColor: TDAH_COLOR, backgroundColor: `${TDAH_COLOR}08` } : {}}
                    >
                      <span className="text-lg block mb-1">{ctx.icon}</span>
                      <span className={`text-xs font-medium ${form.session_context === ctx.value ? '' : 'text-slate-500'}`}
                        style={form.session_context === ctx.value ? { color: TDAH_COLOR } : {}}>
                        {ctx.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
                <textarea value={form.session_notes} onChange={e => setForm({ ...form, session_notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
                  onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}
                  placeholder="Notas sobre a sessão" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => { setShowModal(false); setError(null) }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: TDAH_COLOR }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a5c5f')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = TDAH_COLOR)}>
                {saving ? 'Agendando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
