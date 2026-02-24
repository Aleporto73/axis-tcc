'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Session {
  id: string
  learner_id: string
  learner_name: string
  therapist_id: string
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  status: string
  location: string | null
  notes: string | null
}

interface Learner {
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
  in_progress: 'bg-aba-500/10 text-aba-500',
  completed: 'bg-green-50 text-green-600',
  cancelled: 'bg-slate-100 text-slate-400',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDatetime(iso: string): string {
  return `${formatDate(iso)} às ${formatTime(iso)}`
}

function SessionCard({ s, highlight }: { s: Session; highlight?: boolean }) {
  return (
    <Link
      href={`/aba/sessoes/${s.id}`}
      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
        highlight
          ? 'border-aba-500/20 bg-aba-500/5 hover:bg-aba-500/10'
          : 'border-slate-200 hover:border-aba-500/30 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${highlight ? 'bg-white border border-aba-500/20' : 'bg-aba-500/10'}`}>
          <span className="text-sm font-medium text-aba-500">{s.learner_name.charAt(0)}</span>
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-800">{s.learner_name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">{highlight ? formatTime(s.scheduled_at) : formatDatetime(s.scheduled_at)}</span>
            {s.location && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-400">{s.location}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[s.status] || 'bg-slate-100 text-slate-500'}`}>
        {statusLabels[s.status] || s.status}
      </span>
    </Link>
  )
}

export default function SessoesPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [form, setForm] = useState({
    learner_id: '',
    scheduled_date: '',
    scheduled_time: '',
    location: '',
    notes: '',
  })

  const fetchSessions = useCallback(() => {
    setLoading(true)
    const params = filter !== 'all' ? `?status=${filter}` : ''
    fetch(`/api/aba/sessions${params}`)
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filter])

  const fetchLearners = useCallback(() => {
    fetch('/api/aba/learners')
      .then(r => r.json())
      .then(d => setLearners(d.learners || []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])
  useEffect(() => { fetchLearners() }, [fetchLearners])

  const handleSubmit = async () => {
    if (!form.learner_id || !form.scheduled_date || !form.scheduled_time) {
      setError('Aprendiz, data e horário são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const scheduled_at = `${form.scheduled_date}T${form.scheduled_time}:00`
      const res = await fetch('/api/aba/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learner_id: form.learner_id,
          scheduled_at,
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro ao agendar')
        setSaving(false)
        return
      }
      setForm({ learner_id: '', scheduled_date: '', scheduled_time: '', location: '', notes: '' })
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
      <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
        <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
          <Link href="/aba" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Painel</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/aba/aprendizes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Aprendizes</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/aba/sessoes" className="px-3 py-1 text-sm font-medium text-aba-500">Sessões</Link>
          <span className="text-slate-300 text-xs hidden sm:inline">·</span>
          <Link href="/aba/relatorios" className="hidden sm:inline px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Relatórios</Link>
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
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 transition-colors">
            + Nova Sessão
          </button>
        </header>

        <div className="flex gap-2 mb-6">
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
                filter === f.key
                  ? 'border-aba-500 text-aba-500 bg-aba-500/5'
                  : 'border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="animate-pulse bg-slate-50 rounded-xl h-20"></div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-aba-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 mb-1">Nenhuma sessão encontrada</p>
            <p className="text-xs text-slate-400">Clique em "+ Nova Sessão" para agendar</p>
          </div>
        ) : (
          <>
            {todaySessions.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xs font-medium text-aba-500 uppercase tracking-wider mb-3">Hoje</h2>
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
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Aprendiz *</label>
                <select value={form.learner_id} onChange={e => setForm({...form, learner_id: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                  <option value="">Selecione...</option>
                  {learners.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data *</label>
                  <input type="date" value={form.scheduled_date} onChange={e => setForm({...form, scheduled_date: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Horário *</label>
                  <input type="time" value={form.scheduled_time} onChange={e => setForm({...form, scheduled_time: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Local</label>
                <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Ex: Sala 3, Clínica Centro" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 resize-none" placeholder="Notas sobre a sessão" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => { setShowModal(false); setError(null) }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50">
                {saving ? 'Agendando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
