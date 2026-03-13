'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// =====================================================
// AXIS TDAH - Condução de Sessão
// Tela de registro de observações em tempo real.
// Abrir → registrar trials → fechar sessão.
// Bible §7 (Base), §8 (Executiva), §9.6 (AuDHD layer)
// =====================================================

const TDAH_COLOR = '#0d7377'
const TDAH_LIGHT = 'rgba(13, 115, 119, 0.1)'

interface SessionData {
  id: string
  patient_id: string
  patient_name: string
  session_number: number | null
  session_context: string
  status: string
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  duration_minutes: number | null
  session_notes: string | null
}

interface Observation {
  id: string
  protocol_id: string | null
  protocol_code: string | null
  protocol_title: string | null
  protocol_block: string | null
  task_block_number: number | null
  task_description: string | null
  sas_score: number | null
  pis_level: string | null
  bss_level: string | null
  exr_level: string | null
  sen_level: string | null
  trf_level: string | null
  rig_state: string | null
  rig_severity: string | null
  observation_notes: string | null
  created_at: string
}

interface ActiveProtocol {
  id: string
  code: string
  title: string
  block: string
  requires_audhd_layer: boolean
}

const contextLabels: Record<string, string> = { clinical: 'Clínico', home: 'Domiciliar', school: 'Escolar' }
const contextColors: Record<string, string> = { clinical: 'bg-teal-50 text-teal-700', home: 'bg-sky-50 text-sky-700', school: 'bg-violet-50 text-violet-700' }
const statusLabels: Record<string, string> = { scheduled: 'Agendada', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada' }
const statusColors: Record<string, string> = { scheduled: 'bg-blue-50 text-blue-600', in_progress: 'bg-amber-50 text-amber-600', completed: 'bg-green-50 text-green-600', cancelled: 'bg-slate-100 text-slate-400' }

const PIS_OPTIONS = [
  { value: 'independente', label: 'Independente' },
  { value: 'gestual', label: 'Gestual' },
  { value: 'verbal', label: 'Verbal' },
  { value: 'modelacao', label: 'Modelação' },
  { value: 'fisica_parcial', label: 'Física parcial' },
  { value: 'fisica_total', label: 'Física total' },
]

const BSS_OPTIONS = [
  { value: 'estavel', label: 'Estável' },
  { value: 'oscilante', label: 'Oscilante' },
  { value: 'instavel', label: 'Instável' },
]

const EXR_OPTIONS = [
  { value: 'independente', label: 'Independente' },
  { value: 'apoio_minimo', label: 'Apoio mínimo' },
  { value: 'apoio_significativo', label: 'Apoio significativo' },
  { value: 'nao_realiza', label: 'Não realiza' },
]

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDatetime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + formatTime(iso)
}

export default function SessaoConduzirPage() {
  const { id } = useParams()
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [protocols, setProtocols] = useState<ActiveProtocol[]>([])
  const [loading, setLoading] = useState(true)
  const [showObsForm, setShowObsForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    protocol_id: '',
    task_block_number: '',
    task_description: '',
    sas_score: '',
    pis_level: '',
    bss_level: '',
    exr_level: '',
    observation_notes: '',
  })

  const fetchSession = useCallback(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/tdah/sessions/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(d => {
        setSession(d.session)
        setObservations(d.observations || [])
        setProtocols(d.protocols || [])
        setLoading(false)
      })
      .catch(() => { setSession(null); setLoading(false) })
  }, [id])

  useEffect(() => { fetchSession() }, [fetchSession])

  const doAction = async (action: string) => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tdah/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro na ação')
      } else {
        fetchSession()
      }
    } catch {
      setError('Falha de conexão')
    }
    setActionLoading(false)
  }

  const resetForm = () => setForm({
    protocol_id: '', task_block_number: '', task_description: '',
    sas_score: '', pis_level: '', bss_level: '', exr_level: '',
    observation_notes: '',
  })

  const submitObservation = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/tdah/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: id,
          protocol_id: form.protocol_id || null,
          task_block_number: form.task_block_number ? Number(form.task_block_number) : null,
          task_description: form.task_description.trim() || null,
          sas_score: form.sas_score ? Number(form.sas_score) : null,
          pis_level: form.pis_level || null,
          bss_level: form.bss_level || null,
          exr_level: form.exr_level || null,
          observation_notes: form.observation_notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro ao registrar')
        setSaving(false)
        return
      }
      resetForm()
      setShowObsForm(false)
      setSaving(false)
      fetchSession()
    } catch {
      setError('Falha de conexão')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/3" />
          <div className="h-40 bg-slate-50 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center py-20">
        <p className="text-sm text-slate-500 mb-4">Sessão não encontrada</p>
        <Link href="/tdah/sessoes" className="text-sm font-medium" style={{ color: TDAH_COLOR }}>&larr; Voltar</Link>
      </div>
    )
  }

  const isOpen = session.status === 'in_progress'
  const isClosed = session.status === 'completed'
  const isScheduled = session.status === 'scheduled'

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/tdah/sessoes" className="text-slate-400 hover:text-slate-600 transition-colors">Sessões</Link>
        <span className="text-slate-300">/</span>
        <Link href={`/tdah/pacientes/${session.patient_id}`} className="text-slate-400 hover:text-slate-600 transition-colors">{session.patient_name}</Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-700">Sessão {session.session_number ? `#${session.session_number}` : ''}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-800">{session.patient_name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[session.status]}`}>
              {statusLabels[session.status]}
            </span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${contextColors[session.session_context]}`}>
              {contextLabels[session.session_context]}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {formatDatetime(session.scheduled_at)}
            {session.duration_minutes != null && ` · ${session.duration_minutes} min`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {isScheduled && (
            <button
              onClick={() => doAction('open')}
              disabled={actionLoading}
              className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: TDAH_COLOR }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a5c5f')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = TDAH_COLOR)}
            >
              {actionLoading ? '...' : 'Abrir Sessão'}
            </button>
          )}
          {isOpen && (
            <>
              <button
                onClick={() => setShowObsForm(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                style={{ borderColor: TDAH_COLOR, color: TDAH_COLOR }}
              >
                + Observação
              </button>
              <button
                onClick={() => doAction('close')}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Fechar Sessão'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-xs">{error}</div>
      )}

      {/* Observations list */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Observações ({observations.length})
        </h2>

        {observations.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-slate-400">
              {isOpen ? 'Clique em "+ Observação" para registrar' : 'Nenhuma observação registrada'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {observations.map((obs, idx) => (
              <div key={obs.id} className="p-4 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: TDAH_LIGHT, color: TDAH_COLOR }}>
                      {idx + 1}
                    </span>
                    {obs.protocol_code && (
                      <span className="text-xs font-medium text-slate-600">{obs.protocol_code}</span>
                    )}
                    {obs.task_description && (
                      <span className="text-xs text-slate-400">— {obs.task_description}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">{formatTime(obs.created_at)}</span>
                </div>

                {/* Metrics row */}
                <div className="flex flex-wrap gap-2">
                  {obs.sas_score != null && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-medium">
                      SAS: {obs.sas_score}%
                    </span>
                  )}
                  {obs.pis_level && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      PIS: {obs.pis_level}
                    </span>
                  )}
                  {obs.bss_level && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      BSS: {obs.bss_level}
                    </span>
                  )}
                  {obs.exr_level && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                      EXR: {obs.exr_level}
                    </span>
                  )}
                  {obs.sen_level && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                      SEN: {obs.sen_level}
                    </span>
                  )}
                  {obs.rig_state && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700">
                      RIG: {obs.rig_state} ({obs.rig_severity})
                    </span>
                  )}
                </div>

                {obs.observation_notes && (
                  <p className="text-xs text-slate-500 mt-2 italic">{obs.observation_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session notes */}
      {session.session_notes && (
        <div className="mt-4 bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notas da sessão</h2>
          <p className="text-sm text-slate-600">{session.session_notes}</p>
        </div>
      )}

      {/* Modal: Nova Observação */}
      {showObsForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-serif text-lg font-light text-slate-800">Nova Observação</h2>
              <button onClick={() => { setShowObsForm(false); setError(null) }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              {/* Protocolo */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Protocolo</label>
                <select value={form.protocol_id} onChange={e => setForm({ ...form, protocol_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                  onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}>
                  <option value="">— Sem protocolo —</option>
                  {protocols.map(p => (
                    <option key={p.id} value={p.id}>[{p.block}] {p.code} — {p.title}</option>
                  ))}
                </select>
              </div>

              {/* Tarefa */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bloco #</label>
                  <input type="number" value={form.task_block_number} onChange={e => setForm({ ...form, task_block_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="1" min="1" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descrição da tarefa</label>
                  <input type="text" value={form.task_description} onChange={e => setForm({ ...form, task_description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="Ex: Organizar mochila" />
                </div>
              </div>

              {/* Camada Base */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Camada Base (§7)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">SAS (%)</label>
                    <input type="number" value={form.sas_score} onChange={e => setForm({ ...form, sas_score: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="0-100" min="0" max="100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">PIS</label>
                    <select value={form.pis_level} onChange={e => setForm({ ...form, pis_level: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}>
                      <option value="">—</option>
                      {PIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">BSS</label>
                    <select value={form.bss_level} onChange={e => setForm({ ...form, bss_level: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}>
                      <option value="">—</option>
                      {BSS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Camada Executiva */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Camada Executiva (§8)</p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">EXR</label>
                  <select value={form.exr_level} onChange={e => setForm({ ...form, exr_level: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}>
                    <option value="">—</option>
                    {EXR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
                <textarea value={form.observation_notes} onChange={e => setForm({ ...form, observation_notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
                  onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}
                  placeholder="Observações livres" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => { setShowObsForm(false); setError(null) }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
              <button onClick={submitObservation} disabled={saving}
                className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: TDAH_COLOR }}>
                {saving ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
