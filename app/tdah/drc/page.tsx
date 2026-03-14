'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// =====================================================
// AXIS TDAH - Daily Report Card (DRC)
// Bible §14, §17: core do produto escolar TDAH
// Regra: 1-3 metas por DRC por dia por paciente
// =====================================================

const TDAH_COLOR = '#0d7377'

interface Patient {
  id: string
  name: string
}

interface DrcEntry {
  id: string
  patient_id: string
  drc_date: string
  goal_description: string
  goal_met: boolean | null
  score: number | null
  filled_by: string | null
  filled_by_name: string | null
  teacher_notes: string | null
  clinician_review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  reviewer_name: string | null
  protocol_id: string | null
  protocol_code: string | null
  protocol_title: string | null
  created_at: string
}

interface Protocol {
  id: string
  code: string
  title: string
  status: string
}

const filledByLabels: Record<string, string> = {
  teacher: 'Professor(a)',
  mediator: 'Mediador(a)',
  parent: 'Responsável',
  other: 'Outro',
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  })
}

export default function DRCPage() {
  const searchParams = useSearchParams()
  const patientIdParam = searchParams.get('paciente')

  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<string>(patientIdParam || '')
  const [entries, setEntries] = useState<DrcEntry[]>([])
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const [form, setForm] = useState({
    drc_date: new Date().toISOString().split('T')[0],
    goal_description: '',
    goal_met: '' as '' | 'true' | 'false',
    score: '',
    filled_by: 'teacher',
    filled_by_name: '',
    teacher_notes: '',
    protocol_id: '',
  })

  // Fetch patients list
  useEffect(() => {
    fetch('/api/tdah/patients')
      .then(r => r.json())
      .then(d => setPatients(d.patients || []))
      .catch(() => {})
  }, [])

  // Fetch DRC entries
  const fetchEntries = useCallback(() => {
    if (!selectedPatient) return
    setLoading(true)
    fetch(`/api/tdah/drc?patient_id=${selectedPatient}&limit=50`)
      .then(r => r.json())
      .then(d => { setEntries(d.drc_entries || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedPatient])

  // Fetch protocols for the patient
  const fetchProtocols = useCallback(() => {
    if (!selectedPatient) return
    fetch(`/api/tdah/protocols?patient_id=${selectedPatient}`)
      .then(r => r.json())
      .then(d => setProtocols((d.protocols || []).filter((p: Protocol) => p.status === 'active')))
      .catch(() => {})
  }, [selectedPatient])

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => { fetchProtocols() }, [fetchProtocols])

  const resetForm = () => setForm({
    drc_date: new Date().toISOString().split('T')[0],
    goal_description: '', goal_met: '', score: '',
    filled_by: 'teacher', filled_by_name: '', teacher_notes: '', protocol_id: '',
  })

  const submitDrc = async () => {
    if (!form.goal_description.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tdah/drc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient,
          drc_date: form.drc_date,
          goal_description: form.goal_description.trim(),
          goal_met: form.goal_met === '' ? null : form.goal_met === 'true',
          score: form.score ? parseFloat(form.score) : null,
          filled_by: form.filled_by || null,
          filled_by_name: form.filled_by_name.trim() || null,
          teacher_notes: form.teacher_notes.trim() || null,
          protocol_id: form.protocol_id || null,
        }),
      })
      if (res.ok) {
        resetForm()
        setShowForm(false)
        fetchEntries()
      } else {
        const d = await res.json()
        alert(d.error || 'Erro ao salvar')
      }
    } catch { /* silent */ }
    setSubmitting(false)
  }

  const reviewDrc = async (entryId: string) => {
    setReviewing(entryId)
    try {
      const res = await fetch(`/api/tdah/drc/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', clinician_review_notes: reviewNotes.trim() || null }),
      })
      if (res.ok) {
        setReviewing(null)
        setReviewNotes('')
        fetchEntries()
      }
    } catch { /* silent */ }
  }

  const toggleGoalMet = async (entryId: string, currentVal: boolean | null) => {
    const newVal = currentVal === true ? false : currentVal === false ? null : true
    try {
      await fetch(`/api/tdah/drc/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_met: newVal }),
      })
      fetchEntries()
    } catch { /* silent */ }
  }

  // Group entries by date
  const grouped = entries.reduce<Record<string, DrcEntry[]>>((acc, e) => {
    const key = e.drc_date
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/tdah/dashboard" className="text-slate-400 hover:text-slate-600 transition-colors">TDAH</Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-700">Daily Report Card</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Daily Report Card (DRC)</h1>
          <p className="text-xs text-slate-400 mt-1">
            O professor preenche as metas do dia — você revisa pelo sistema
          </p>
        </div>
        {selectedPatient && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
            style={{ backgroundColor: TDAH_COLOR }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a5c5f')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = TDAH_COLOR)}
          >
            + Novo DRC
          </button>
        )}
      </div>

      {/* Patient selector */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-6">
        <label className="block text-xs font-medium text-slate-600 mb-2">Paciente</label>
        <select
          value={selectedPatient}
          onChange={e => setSelectedPatient(e.target.value)}
          className="w-full md:w-80 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
          onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
          onBlur={e => (e.currentTarget.style.borderColor = '')}
        >
          <option value="">Selecione um paciente</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {!selectedPatient ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
          <p className="text-sm text-slate-400">Selecione um paciente para ver os DRCs</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-slate-50 rounded-xl h-20" />)}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
          <p className="text-sm text-slate-400 mb-2">Nenhum DRC registrado</p>
          <p className="text-[10px] text-slate-300">Clique em "+ Novo DRC" para começar o acompanhamento escolar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date} className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: TDAH_COLOR }}>
                  🏫
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{formatDate(date)}</p>
                  <p className="text-[10px] text-slate-400">{grouped[date].length} meta{grouped[date].length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="space-y-3">
                {grouped[date].map(entry => (
                  <div key={entry.id} className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Goal met toggle */}
                        <button
                          onClick={() => toggleGoalMet(entry.id, entry.goal_met)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            entry.goal_met === true
                              ? 'border-green-500 bg-green-500 text-white'
                              : entry.goal_met === false
                                ? 'border-red-400 bg-red-50'
                                : 'border-slate-300 bg-white'
                          }`}
                          title={entry.goal_met === true ? 'Meta atingida' : entry.goal_met === false ? 'Meta não atingida' : 'Pendente'}
                        >
                          {entry.goal_met === true && (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          )}
                          {entry.goal_met === false && (
                            <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                          )}
                        </button>

                        <div className="min-w-0">
                          <p className="text-sm text-slate-700">{entry.goal_description}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {entry.protocol_code && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">{entry.protocol_code}</span>
                            )}
                            {entry.filled_by && (
                              <span className="text-[10px] text-slate-400">
                                {filledByLabels[entry.filled_by] || entry.filled_by}
                                {entry.filled_by_name && ` — ${entry.filled_by_name}`}
                              </span>
                            )}
                            {entry.score !== null && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Score: {Number(entry.score).toFixed(0)}%</span>
                            )}
                          </div>
                          {entry.teacher_notes && (
                            <p className="text-[10px] text-slate-400 mt-1 italic">Prof: {entry.teacher_notes}</p>
                          )}
                          {entry.clinician_review_notes && (
                            <p className="text-[10px] text-purple-500 mt-1">Clínico: {entry.clinician_review_notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Review status */}
                      <div className="shrink-0">
                        {entry.reviewed_at ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600">Revisado</span>
                        ) : (
                          <button
                            onClick={() => { setReviewing(entry.id); setReviewNotes('') }}
                            className="text-[10px] px-2 py-1 rounded border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                          >
                            Revisar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Review inline form */}
                    {reviewing === entry.id && !entry.reviewed_at && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                        <input
                          value={reviewNotes}
                          onChange={e => setReviewNotes(e.target.value)}
                          placeholder="Notas de revisão (opcional)"
                          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
                          onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                          onBlur={e => (e.currentTarget.style.borderColor = '')}
                        />
                        <button
                          onClick={() => reviewDrc(entry.id)}
                          className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                          style={{ backgroundColor: TDAH_COLOR }}
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setReviewing(null)}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Novo DRC */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-serif text-lg font-light text-slate-800">Novo DRC</h2>
                <p className="text-xs text-slate-400 mt-1">Até 3 metas por dia por paciente</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Data */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data</label>
                <input type="date" value={form.drc_date} onChange={e => setForm({ ...form, drc_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                  onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}
                />
              </div>

              {/* Meta */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Meta *</label>
                <textarea
                  value={form.goal_description}
                  onChange={e => setForm({ ...form, goal_description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
                  onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}
                  placeholder="Ex: Permanecer sentado durante a atividade de leitura por 10 min"
                />
              </div>

              {/* Protocolo (opcional) */}
              {protocols.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Protocolo vinculado</label>
                  <select value={form.protocol_id} onChange={e => setForm({ ...form, protocol_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}>
                    <option value="">Nenhum</option>
                    {protocols.map(p => <option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}
                  </select>
                </div>
              )}

              {/* Goal met + Score */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Meta atingida?</label>
                  <select value={form.goal_met} onChange={e => setForm({ ...form, goal_met: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}>
                    <option value="">Pendente</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Score (%)</label>
                  <input type="number" min="0" max="100" value={form.score}
                    onChange={e => setForm({ ...form, score: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="0-100"
                  />
                </div>
              </div>

              {/* Quem preencheu */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Preenchido por</label>
                  <select value={form.filled_by} onChange={e => setForm({ ...form, filled_by: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}>
                    <option value="teacher">Professor(a)</option>
                    <option value="mediator">Mediador(a)</option>
                    <option value="parent">Responsável</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
                  <input value={form.filled_by_name} onChange={e => setForm({ ...form, filled_by_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="Nome do professor"
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas do professor</label>
                <textarea
                  value={form.teacher_notes}
                  onChange={e => setForm({ ...form, teacher_notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
                  onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}
                  placeholder="Observações do dia"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
              <button
                onClick={submitDrc}
                disabled={submitting || !form.goal_description.trim()}
                className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: TDAH_COLOR }}
              >
                {submitting ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
