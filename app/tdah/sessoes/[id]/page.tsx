'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { HelpTipTDAH } from '@/components/TooltipTDAH'

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
  audhd_layer_status: string | null
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

interface TDAHEvent {
  id: string
  event_type: string
  antecedent: string | null
  behavior: string | null
  consequence: string | null
  description: string | null
  intensity: string | null
  context: string | null
  occurred_at: string
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

const SEN_OPTIONS = [
  { value: 'sem_impacto', label: 'Sem impacto' },
  { value: 'impacto_moderado', label: 'Impacto moderado' },
  { value: 'impacto_significativo', label: 'Impacto significativo' },
]

const TRF_OPTIONS = [
  { value: 'transicao_fluida', label: 'Transição fluida' },
  { value: 'com_resistencia', label: 'Com resistência' },
  { value: 'com_ruptura', label: 'Com ruptura' },
]

const RIG_STATE_OPTIONS = [
  { value: 'balanced', label: 'Equilibrado' },
  { value: 'rigidity_leaning', label: 'Tendência rigidez' },
  { value: 'impulsivity_leaning', label: 'Tendência impulsividade' },
  { value: 'dual_risk', label: 'Risco duplo' },
]

const RIG_SEVERITY_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'mild', label: 'Leve' },
  { value: 'moderate', label: 'Moderada' },
  { value: 'high', label: 'Alta' },
]

const EVENT_TYPE_OPTIONS = [
  { value: 'transition', label: 'Transição' },
  { value: 'sensory', label: 'Sensorial' },
  { value: 'behavioral', label: 'Comportamental' },
  { value: 'abc', label: 'ABC (Antecedente-Comportamento-Consequência)' },
  { value: 'task_avoidance', label: 'Esquiva de tarefa' },
  { value: 'task_engagement', label: 'Engajamento na tarefa' },
  { value: 'self_regulation', label: 'Autorregulação' },
  { value: 'other', label: 'Outro' },
]

const INTENSITY_OPTIONS = [
  { value: 'leve', label: 'Leve' },
  { value: 'moderada', label: 'Moderada' },
  { value: 'alta', label: 'Alta' },
  { value: 'severa', label: 'Severa' },
]

const eventTypeColors: Record<string, string> = {
  transition: 'bg-amber-50 text-amber-700',
  sensory: 'bg-purple-50 text-purple-700',
  behavioral: 'bg-red-50 text-red-700',
  abc: 'bg-blue-50 text-blue-700',
  task_avoidance: 'bg-orange-50 text-orange-700',
  task_engagement: 'bg-green-50 text-green-700',
  self_regulation: 'bg-teal-50 text-teal-700',
  other: 'bg-slate-100 text-slate-600',
}

const eventTypeLabels: Record<string, string> = {
  transition: 'Transição', sensory: 'Sensorial', behavioral: 'Comportamental',
  abc: 'ABC', task_avoidance: 'Esquiva', task_engagement: 'Engajamento',
  self_regulation: 'Autorregulação', other: 'Outro',
}

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
  const [events, setEvents] = useState<TDAHEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showObsForm, setShowObsForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resumo para responsáveis (padrão ABA)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [summaryEmail, setSummaryEmail] = useState('')
  const [summaryGuardians, setSummaryGuardians] = useState<{id:string;name:string;email:string|null}[]>([])
  const [summaryCustomEmail, setSummaryCustomEmail] = useState(false)
  const [summarySaving, setSummarySaving] = useState(false)
  const [summaryStatus, setSummaryStatus] = useState<'idle'|'sent'|'error'>('idle')
  const [summaryError, setSummaryError] = useState<string|null>(null)

  const [eventForm, setEventForm] = useState({
    event_type: 'behavioral',
    description: '',
    antecedent: '',
    behavior: '',
    consequence: '',
    intensity: '',
  })

  const [form, setForm] = useState({
    protocol_id: '',
    task_block_number: '',
    task_description: '',
    sas_score: '',
    pis_level: '',
    bss_level: '',
    exr_level: '',
    sen_level: '',
    trf_level: '',
    rig_state: '',
    rig_severity: '',
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
      .then(async d => {
        setSession(d.session)
        setObservations(d.observations || [])
        setProtocols(d.protocols || [])
        setLoading(false)
        // Fetch events separately
        try {
          const evRes = await fetch(`/api/tdah/events?session_id=${id}`)
          if (evRes.ok) {
            const evData = await evRes.json()
            setEvents(evData.events || [])
          }
        } catch { /* silent */ }
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

  // ── Resumo para responsáveis ──
  const generateSummaryText = () => {
    if (!session || observations.length === 0) return ''
    const name = session.patient_name || 'o paciente'
    const ctx = contextLabels[session.session_context] || session.session_context
    const dateStr = new Date(session.scheduled_at).toLocaleDateString('pt-BR')
    const parts: string[] = [`Na sessão ${ctx.toLowerCase()} de ${dateStr}, trabalhamos com ${name} nos seguintes alvos:`]
    for (const obs of observations) {
      const line: string[] = []
      if (obs.protocol_code) line.push(obs.protocol_code)
      if (obs.task_description) line.push(obs.task_description)
      if (obs.sas_score != null) line.push(`atenção: ${obs.sas_score}/10`)
      if (obs.pis_level) line.push(`dica: ${obs.pis_level}`)
      if (obs.bss_level) line.push(`estabilidade: ${obs.bss_level}`)
      parts.push('• ' + (line.length > 0 ? line.join(', ') : 'Observação registrada') + '.')
    }
    return parts.join('\n')
  }

  const openSummaryModal = async () => {
    if (!session) return
    setSummaryText(generateSummaryText())
    setSummaryEmail('')
    setSummaryCustomEmail(false)
    setSummaryStatus('idle')
    setSummaryError(null)
    try {
      const res = await fetch(`/api/tdah/guardians?patient_id=${session.patient_id}`)
      if (res.ok) {
        const d = await res.json()
        const gs = d.guardians || []
        setSummaryGuardians(gs)
        const withEmail = gs.filter((g: any) => g.email)
        if (withEmail.length > 0) setSummaryEmail(withEmail[0].email)
      }
    } catch { /* silent */ }
    setShowSummaryModal(true)
  }

  const sendSummary = async () => {
    if (!summaryText.trim()) { setSummaryError('Escreva o resumo antes de enviar.'); return }
    if (!summaryEmail.trim()) { setSummaryError('Informe o email do destinatário.'); return }
    setSummarySaving(true)
    setSummaryError(null)
    try {
      // 1. Cria rascunho
      const postRes = await fetch(`/api/tdah/sessions/${id}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: summaryText })
      })
      const postData = await postRes.json()
      if (!postData.summary_id) throw new Error(postData.error || 'Erro ao criar resumo')
      const summary_id = postData.summary_id
      // 2. Aprova
      const approveRes = await fetch(`/api/tdah/sessions/${id}/summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_id, action: 'approve' })
      })
      if (!approveRes.ok) throw new Error('Erro ao aprovar resumo')
      // 3. Envia
      const sendRes = await fetch(`/api/tdah/sessions/${id}/summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_id, action: 'send', recipient_email: summaryEmail })
      })
      const sendData = await sendRes.json()
      if (!sendRes.ok) throw new Error(sendData.error || 'Erro ao enviar email')
      setSummaryStatus('sent')
    } catch (err: any) {
      setSummaryError(err.message || 'Erro ao enviar')
      setSummaryStatus('error')
    }
    setSummarySaving(false)
  }

  const resetForm = () => setForm({
    protocol_id: '', task_block_number: '', task_description: '',
    sas_score: '', pis_level: '', bss_level: '', exr_level: '',
    sen_level: '', trf_level: '', rig_state: '', rig_severity: '',
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
          sen_level: form.sen_level || null,
          trf_level: form.trf_level || null,
          rig_state: form.rig_state || null,
          rig_severity: form.rig_severity || null,
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
  const audhdActive = session.audhd_layer_status && session.audhd_layer_status !== 'off'
  const audhdFull = session.audhd_layer_status === 'active_full'

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
            {audhdActive && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600">
                AuDHD {audhdFull ? 'Full' : 'Core'}
              </span>
            )}
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
                onClick={() => setShowEventForm(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-amber-400 text-amber-600 transition-colors hover:bg-amber-50"
              >
                + Evento
              </button>
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
          {isClosed && (
            <button
              onClick={openSummaryModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-green-300 text-green-700 text-xs font-medium rounded-lg hover:bg-green-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              Enviar Resumo
            </button>
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
                  {obs.trf_level && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700">
                      TRF: {obs.trf_level}
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

      {/* Events section */}
      {events.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Eventos ({events.length})
          </h2>
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${eventTypeColors[ev.event_type] || 'bg-slate-100 text-slate-600'}`}>
                      {eventTypeLabels[ev.event_type] || ev.event_type}
                    </span>
                    {ev.intensity && (
                      <span className="text-[10px] text-slate-400">Intensidade: {ev.intensity}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">{formatTime(ev.occurred_at)}</span>
                </div>
                {ev.description && <p className="text-xs text-slate-600">{ev.description}</p>}
                {ev.event_type === 'abc' && (
                  <div className="mt-1.5 space-y-1 text-xs">
                    {ev.antecedent && <p className="text-slate-500"><span className="font-medium text-blue-600">A:</span> {ev.antecedent}</p>}
                    {ev.behavior && <p className="text-slate-500"><span className="font-medium text-amber-600">B:</span> {ev.behavior}</p>}
                    {ev.consequence && <p className="text-slate-500"><span className="font-medium text-green-600">C:</span> {ev.consequence}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
                <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide flex items-center gap-1.5">
                  Camada Base
                  <HelpTipTDAH tip="camada_base" />
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                      SAS (%) <HelpTipTDAH tip="sas" />
                    </label>
                    <input type="number" value={form.sas_score} onChange={e => setForm({ ...form, sas_score: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="0-100" min="0" max="100" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                      PIS <HelpTipTDAH tip="pis" />
                    </label>
                    <select value={form.pis_level} onChange={e => setForm({ ...form, pis_level: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}>
                      <option value="">—</option>
                      {PIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                      BSS <HelpTipTDAH tip="bss" />
                    </label>
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
                <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide flex items-center gap-1.5">
                  Camada Executiva
                  <HelpTipTDAH tip="camada_executiva" />
                </p>
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                    EXR <HelpTipTDAH tip="exr" />
                  </label>
                  <select value={form.exr_level} onChange={e => setForm({ ...form, exr_level: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}>
                    <option value="">—</option>
                    {EXR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Camada AuDHD — aparece quando layer está ativa */}
              {audhdActive && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-medium text-purple-500 mb-3 uppercase tracking-wide flex items-center gap-1.5">
                    Camada AuDHD
                    <HelpTipTDAH tip="camada_audhd" />
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                        SEN <HelpTipTDAH tip="sen" />
                      </label>
                      <select value={form.sen_level} onChange={e => setForm({ ...form, sen_level: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                        onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                        onBlur={e => (e.currentTarget.style.borderColor = '')}>
                        <option value="">—</option>
                        {SEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                        TRF <HelpTipTDAH tip="trf" />
                      </label>
                      <select value={form.trf_level} onChange={e => setForm({ ...form, trf_level: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                        onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                        onBlur={e => (e.currentTarget.style.borderColor = '')}>
                        <option value="">—</option>
                        {TRF_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {audhdFull && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                          RIG estado <HelpTipTDAH tip="rig" />
                        </label>
                        <select value={form.rig_state} onChange={e => setForm({ ...form, rig_state: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                          onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                          onBlur={e => (e.currentTarget.style.borderColor = '')}>
                          <option value="">—</option>
                          {RIG_STATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">RIG severidade</label>
                        <select value={form.rig_severity} onChange={e => setForm({ ...form, rig_severity: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                          onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                          onBlur={e => (e.currentTarget.style.borderColor = '')}>
                          <option value="">—</option>
                          {RIG_SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

      {/* Modal: Novo Evento */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-serif text-lg font-light text-slate-800">Novo Evento Clínico</h2>
              <button onClick={() => { setShowEventForm(false); setError(null) }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de evento *</label>
                <select
                  value={eventForm.event_type}
                  onChange={e => setEventForm({ ...eventForm, event_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                >
                  {EVENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                <textarea
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
                  placeholder="Descreva o evento observado..."
                />
              </div>

              {/* ABC fields — only if type is 'abc' */}
              {eventForm.event_type === 'abc' && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Análise ABC</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Antecedente *</label>
                    <input
                      type="text"
                      value={eventForm.antecedent}
                      onChange={e => setEventForm({ ...eventForm, antecedent: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      placeholder="O que aconteceu antes?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Comportamento *</label>
                    <input
                      type="text"
                      value={eventForm.behavior}
                      onChange={e => setEventForm({ ...eventForm, behavior: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      placeholder="O que a criança fez?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Consequência *</label>
                    <input
                      type="text"
                      value={eventForm.consequence}
                      onChange={e => setEventForm({ ...eventForm, consequence: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      placeholder="O que aconteceu depois?"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Intensidade</label>
                <select
                  value={eventForm.intensity}
                  onChange={e => setEventForm({ ...eventForm, intensity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                >
                  <option value="">— Não informar —</option>
                  {INTENSITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => { setShowEventForm(false); setError(null) }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
              <button
                onClick={async () => {
                  setSavingEvent(true)
                  setError(null)
                  try {
                    const res = await fetch('/api/tdah/events', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        session_id: id,
                        event_type: eventForm.event_type,
                        description: eventForm.description.trim() || null,
                        antecedent: eventForm.antecedent.trim() || null,
                        behavior: eventForm.behavior.trim() || null,
                        consequence: eventForm.consequence.trim() || null,
                        intensity: eventForm.intensity || null,
                      }),
                    })
                    if (!res.ok) {
                      const err = await res.json()
                      setError(err.error || 'Erro ao registrar evento')
                      setSavingEvent(false)
                      return
                    }
                    setEventForm({ event_type: 'behavioral', description: '', antecedent: '', behavior: '', consequence: '', intensity: '' })
                    setShowEventForm(false)
                    setSavingEvent(false)
                    fetchSession()
                  } catch {
                    setError('Falha de conexão')
                    setSavingEvent(false)
                  }
                }}
                disabled={savingEvent}
                className="px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 hover:bg-amber-600"
              >
                {savingEvent ? 'Salvando...' : 'Registrar Evento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enviar Resumo aos Pais */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { if (!summarySaving) setShowSummaryModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-medium text-slate-800">Enviar Resumo aos Pais</h3>
              <button onClick={() => setShowSummaryModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {summaryStatus === 'sent' ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700">Resumo enviado com sucesso!</p>
                  <p className="text-xs text-slate-400 mt-1">Email enviado para {summaryEmail}</p>
                  <button onClick={() => setShowSummaryModal(false)} className="mt-4 px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Fechar</button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Para</label>
                    {summaryGuardians.filter(g => g.email).length > 0 && (
                      <select
                        value={summaryCustomEmail ? '__custom__' : summaryEmail}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setSummaryCustomEmail(true)
                            setSummaryEmail('')
                          } else {
                            setSummaryCustomEmail(false)
                            setSummaryEmail(e.target.value)
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                        style={{ outlineColor: TDAH_COLOR }}
                      >
                        {summaryGuardians.filter(g => g.email).map(g => (
                          <option key={g.id} value={g.email!}>Responsável de {session?.patient_name} — {g.email}</option>
                        ))}
                        <option value="__custom__">Outro email...</option>
                      </select>
                    )}
                    {(summaryGuardians.filter(g => g.email).length === 0 || summaryCustomEmail) && (
                      <input
                        type="email"
                        value={summaryEmail}
                        onChange={e => setSummaryEmail(e.target.value)}
                        className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none ${summaryCustomEmail ? 'mt-2' : ''}`}
                        style={{ outlineColor: TDAH_COLOR }}
                        placeholder="email@exemplo.com"
                        autoFocus={summaryCustomEmail}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Resumo da sessão <span className="text-slate-400">(o que os pais verão)</span>
                    </label>
                    <textarea
                      value={summaryText}
                      onChange={e => setSummaryText(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
                      style={{ outlineColor: TDAH_COLOR }}
                      placeholder={`Hoje trabalhamos em... ${session?.patient_name || ''} demonstrou... Os próximos passos são...`}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Não inclua scores, percentuais ou notas clínicas. Este texto será enviado diretamente aos pais.</p>
                  </div>
                  {summaryError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{summaryError}</p>}
                  <div className="flex justify-end gap-3 pt-1">
                    <button onClick={() => setShowSummaryModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                    <button
                      onClick={sendSummary}
                      disabled={summarySaving}
                      className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      style={{ backgroundColor: TDAH_COLOR }}
                    >
                      {summarySaving ? 'Enviando...' : 'Aprovar e Enviar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
