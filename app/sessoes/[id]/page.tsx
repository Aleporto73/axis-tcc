'use client'

import { useEffect, useState, use, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import ClinicalReport from '../../components/ClinicalReport'
import SignalsPreview from '../../components/SignalsPreview'
import AnalyticalStructure from '../../components/AnalyticalStructure'
import UpgradeModalTCC from '@/app/components/UpgradeModalTCC'
import TranscriptView from './components/TranscriptView'
import ClinicalContext from './components/ClinicalContext'
import EvolutionPanel from './components/EvolutionPanel'
import * as Sentry from '@sentry/nextjs'

interface Session {
  id: string
  patient_id: string
  patient_name: string
  session_number: number
  session_type: string
  scheduled_at: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  status: string
  mood_check: string | null
  bridge_from_last: string | null
  google_meet_link: string | null
}

interface Transcript { id: string; text?: string; text_preview?: string; created_at: string; processed: boolean }
interface TCCAnalysis { fatos: string[]; pensamentos: string[]; emocoes: string[] }
interface MicroEvent { type: string; intensity: number; note: string; created_at: string }
interface PipelineResult { event_created: boolean; cso_updated: boolean; suggestion_generated: boolean; flex_trend: string; micro_events: { confrontations: number; avoidances: number; adjustments: number; recoveries: number } }
interface TranscriptionJob { job_id: string; status: string; transcript_id?: string; error_message?: string }

export default function SessaoDetalhesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { isLoaded, userId } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [analysis, setAnalysis] = useState<TCCAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [notes, setNotes] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [microEvents, setMicroEvents] = useState<MicroEvent[]>([])
  const [showMicroModal, setShowMicroModal] = useState(false)
  const [microType, setMicroType] = useState('')
  const [microIntensity, setMicroIntensity] = useState(0.5)
  const [microNote, setMicroNote] = useState('')
  const [savingMicro, setSavingMicro] = useState(false)
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null)
  const [transcriptionJob, setTranscriptionJob] = useState<TranscriptionJob | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitReason, setLimitReason] = useState<'transcription' | 'report'>('transcription')
  const [clinicalReport, setClinicalReport] = useState<{ insights?: { emotions?: { name: string; intensity: number }[]; topics?: string[]; distortions?: { type: string; label: string; example: string }[]; techniques_identified?: string[] } } | null>(null)
  const [openInsightSection, setOpenInsightSection] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'transcricao' | 'relatorio'>('relatorio')
  const [evolution, setEvolution] = useState<any>(null)
  const [mobileContextOpen, setMobileContextOpen] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { if (isLoaded && userId) loadSession() }, [isLoaded, userId, id])
  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); stopPolling() } }, [])

  const stopPolling = () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null } }

  const startPolling = (jobId: string) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/transcribe/status/${jobId}`)
        if (!res.ok) return
        const data = await res.json()
        setTranscriptionJob(data)

        if (data.status === 'completed' && data.transcript_id) {
          stopPolling()
          // Buscar texto completo
          const textRes = await fetch(`/api/transcribe/text/${data.transcript_id}`)
          if (textRes.ok) {
            const textData = await textRes.json()
            setTranscript({ id: data.transcript_id, text: textData.text, created_at: textData.created_at, processed: textData.processed })
          }
          setTranscriptionJob(null)
          setUploading(false)
        } else if (data.status === 'failed') {
          stopPolling()
          setTranscriptionJob(data)
          setUploading(false)
        }
      } catch (e) { Sentry.captureException(e); console.error('[POLLING] Erro:', e) }
    }, 5000)
  }

  const loadSession = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/sessions/${id}`)
      if (!res.ok) { router.push('/sessoes'); return }
      const data = await res.json()
      setSession(data.session)

      // Transcript: sempre buscar texto completo via endpoint dedicado
      if (data.transcript) {
        if (data.transcript.id) {
          // Setar preview imediato para não ficar vazio enquanto carrega
          setTranscript(data.transcript)
          // Buscar texto completo em paralelo
          fetch(`/api/transcribe/text/${data.transcript.id}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(textData => {
              if (textData.text) {
                setTranscript(prev => prev ? { ...prev, text: textData.text } : prev)
              }
            })
            .catch(() => { /* fallback: mantém preview já setado */ })
        } else {
          setTranscript(data.transcript)
        }
      }

      // Tab default: Transcrição se tem transcript, senão Relatório
      if (data.transcript?.id) {
        setActiveTab('transcricao')
      } else {
        setActiveTab('relatorio')
      }

      // Job ativo? Iniciar polling
      if (data.transcription_job) {
        const job = data.transcription_job
        setTranscriptionJob(job)
        if (job.status === 'pending' || job.status === 'processing') {
          setUploading(true)
          startPolling(job.job_id)
        }
      }
    } catch (e) { Sentry.captureException(e); console.error(e); alert('Erro ao carregar sessão') } finally { setLoading(false) }
  }

  const handleFinish = async () => {
    try {
      setFinishing(true)
      const res = await fetch(`/api/sessions/${id}/finish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) })
      if (res.ok) { const data = await res.json(); if (data.pipeline) setPipelineResult(data.pipeline); loadSession() }
    } catch (e) { Sentry.captureException(e); console.error(e); alert('Erro ao finalizar sessão') } finally { setFinishing(false) }
  }

  const sendAudio = async (fd: FormData) => {
    try {
      setUploading(true)

      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })

      // ── Limite de transcrição atingido ──
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}))
        if (data.error === 'LIMIT_REACHED') {
          setLimitReason('transcription')
          setShowLimitModal(true)
          setUploading(false)
          return
        }
      }

      // ── Conflito: já existe job ativo para esta sessão ──
      if (res.status === 409) {
        alert('Já existe uma transcrição em andamento para esta sessão.')
        setUploading(false)
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao enviar áudio' }))
        alert(err.error || 'Erro ao enviar áudio')
        setUploading(false)
        return
      }

      const data = await res.json()

      if (data.job_id) {
        setTranscriptionJob({ job_id: data.job_id, status: 'pending' })
        startPolling(data.job_id)
      }
    } catch (e) {
      Sentry.captureException(e)
      console.error(e)
      alert('Erro ao enviar audio')
      setUploading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    const fd = new FormData(); fd.append('audio', file); fd.append('session_id', session.id); fd.append('patient_id', session.patient_id)
    await sendAudio(fd)
  }

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr; chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); await sendBlob(blob) }
      mr.start(); setIsRecording(true); setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (e) { alert('Erro ao acessar microfone') }
  }

  const stopRec = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); if (timerRef.current) clearInterval(timerRef.current) } }

  const sendBlob = async (blob: Blob) => {
    if (!session) return
    const file = new File([blob], 'gravacao.webm', { type: 'audio/webm' })
    const fd = new FormData(); fd.append('audio', file); fd.append('session_id', session.id); fd.append('patient_id', session.patient_id)
    await sendAudio(fd)
  }

  const handleTCC = async () => {
    if (!transcript || !session) return
    try {
      setAnalyzing(true)
      const res = await fetch('/api/analyze-tcc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_id: transcript.id,
          text: transcript.text || transcript.text_preview,
          session_id: session.id,
          patient_id: session.patient_id
        })
      })
      if (res.ok) {
        const data = await res.json()
        setAnalysis(data.analysis)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Erro ao analisar TCC')
      }
    } catch (e) { Sentry.captureException(e); console.error(e); alert('Erro ao analisar TCC') } finally { setAnalyzing(false) }
  }

  const openMicroModal = (type: string) => { setMicroType(type); setMicroIntensity(0.5); setMicroNote(''); setShowMicroModal(true) }

  const saveMicroEvent = async () => {
    if (!session) return
    try {
      setSavingMicro(true)
      const res = await fetch('/api/events/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: session.patient_id, event_type: microType, payload: { intensity: microIntensity, note: microNote, context: 'session' }, related_entity_id: session.id }) })
      if (res.ok) { setMicroEvents(prev => [...prev, { type: microType, intensity: microIntensity, note: microNote, created_at: new Date().toISOString() }]); setShowMicroModal(false) }
    } catch (e) { Sentry.captureException(e); console.error(e); alert('Erro ao salvar evento') } finally { setSavingMicro(false) }
  }

  const microLabel = (type: string) => { switch (type) { case 'AVOIDANCE_OBSERVED': return 'Evitou'; case 'CONFRONTATION_OBSERVED': return 'Enfrentou'; case 'ADJUSTMENT_OBSERVED': return 'Ajustou'; case 'RECOVERY_OBSERVED': return 'Recuperou'; default: return type } }
  const fmtTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  const getStatusText = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'Em andamento'
      case 'agendada': return 'Agendada'
      case 'finalizada': return 'Finalizada'
      default: return status
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'em_andamento': return 'text-sky-600 bg-sky-50 border-sky-200'
      case 'agendada': return 'text-slate-600 bg-slate-50 border-slate-200'
      case 'finalizada': return 'text-slate-500 bg-slate-50 border-slate-200'
      default: return 'text-slate-600 bg-slate-50 border-slate-200'
    }
  }

  if (!isLoaded || loading) return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="md:ml-20 min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" role="status" aria-label="Carregando"></div>
      </main>
    </div>
  )

  if (!session) return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="md:ml-20 min-h-screen flex items-center justify-center">
        <p className="text-slate-500 italic">Sessão não encontrada</p>
      </main>
    </div>
  )

  // ─────────────────────────────────────────────
  // Sidebar (dark on desktop / light accordion on mobile)
  // ─────────────────────────────────────────────
  const sidebarContent = (variant: 'light' | 'dark') => {
    const isDark = variant === 'dark'
    const sectionLabelCls = isDark
      ? 'text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2'
      : 'text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2'
    return (
      <div className="space-y-5">
        {/* PACIENTE */}
        <div>
          <p className={sectionLabelCls}>Paciente</p>
          <Link
            href={`/pacientes/${session.patient_id}`}
            className={isDark
              ? 'block text-base font-medium text-slate-100 hover:text-white transition-colors'
              : 'block text-base font-medium text-slate-900 hover:text-slate-700 transition-colors'}
          >
            {session.patient_name}
          </Link>
          <div className={isDark ? 'mt-2 text-xs text-slate-400 space-y-0.5' : 'mt-2 text-xs text-slate-500 space-y-0.5'}>
            <p>Sessão #{session.session_number}</p>
            <p>{new Date(session.scheduled_at).toLocaleDateString('pt-BR')}</p>
            <p>
              {session.duration_minutes
                ? `${session.duration_minutes} min`
                : session.status === 'agendada'
                ? 'Aguardando'
                : 'Em andamento'}
            </p>
          </div>
        </div>

        <div className={isDark ? 'border-t border-slate-700' : 'border-t border-slate-200'} />

        {/* CONTEXTO CLÍNICO */}
        <div>
          <p className={sectionLabelCls}>Contexto</p>
          <ClinicalContext
            sessionId={id}
            patientId={session.patient_id}
            onEvolutionLoaded={setEvolution}
            variant={variant}
          />
        </div>

        {/* INSIGHTS AXIS — inline, expandido, sem accordion */}
        {clinicalReport?.insights && (
          (clinicalReport.insights.emotions?.length || clinicalReport.insights.distortions?.length || clinicalReport.insights.techniques_identified?.length) ? (
            <div>
              <p className={sectionLabelCls}>Insights AXIS</p>

              {/* Emoções com barras */}
              {clinicalReport.insights.emotions && clinicalReport.insights.emotions.length > 0 && (
                <div className="mb-4">
                  <p className={isDark ? 'text-[11px] font-medium text-slate-300 mb-2' : 'text-[11px] font-medium text-slate-600 mb-2'}>Emoções</p>
                  <div className="space-y-1.5">
                    {clinicalReport.insights.emotions.map((em, i) => {
                      // normalizeIntensity: aceita 0-1 ou 0-10 (legado). Width = intensity*100. Label = intensity.toFixed(1).
                      const raw = em.intensity || 0
                      const intensity = raw > 1 ? raw / 10 : raw
                      const widthPct = Math.max(0, Math.min(100, Math.round(intensity * 100)))
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className={isDark ? 'text-[11px] text-slate-300 w-20 truncate' : 'text-[11px] text-slate-700 w-20 truncate'} title={em.name}>{em.name}</span>
                          <div className={isDark ? 'flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden' : 'flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden'}>
                            <div
                              className={isDark ? 'h-full bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full' : 'h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full'}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                          <span className={isDark ? 'text-[10px] font-mono text-slate-400 w-8 text-right' : 'text-[10px] font-mono text-slate-500 w-8 text-right'}>{intensity.toFixed(1)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Distorções com border-left amarelo */}
              {clinicalReport.insights.distortions && clinicalReport.insights.distortions.length > 0 && (
                <div className="mb-4">
                  <p className={isDark ? 'text-[11px] font-medium text-slate-300 mb-2' : 'text-[11px] font-medium text-slate-600 mb-2'}>Distorções cognitivas</p>
                  <div className="space-y-2">
                    {clinicalReport.insights.distortions.map((d, i) => (
                      <div
                        key={i}
                        className={isDark
                          ? 'border-l-2 border-amber-400 bg-amber-900/10 pl-2 py-1'
                          : 'border-l-2 border-amber-400 bg-amber-50 pl-2 py-1'}
                      >
                        <p className={isDark ? 'text-[11px] font-semibold text-amber-200' : 'text-[11px] font-semibold text-amber-800'}>{d.label}</p>
                        {d.example && (
                          <p className={isDark ? 'text-[11px] italic text-slate-400 mt-0.5 break-words' : 'text-[11px] italic text-slate-600 mt-0.5 break-words'}>&ldquo;{d.example}&rdquo;</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Técnicas como chips verdes */}
              {clinicalReport.insights.techniques_identified && clinicalReport.insights.techniques_identified.length > 0 && (
                <div>
                  <p className={isDark ? 'text-[11px] font-medium text-slate-300 mb-2' : 'text-[11px] font-medium text-slate-600 mb-2'}>Técnicas identificadas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {clinicalReport.insights.techniques_identified.map((t, i) => (
                      <span
                        key={i}
                        className={isDark
                          ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-800'
                          : 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200'}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null
        )}

        {/* EVOLUÇÃO CSO — movida para depois de Insights AXIS */}
        {evolution && (
          <div>
            <p className={sectionLabelCls}>Evolução</p>
            <EvolutionPanel evolution={evolution} variant={variant} />
          </div>
        )}

        {/* MICRO-EVENTOS */}
        <div>
          <p className={sectionLabelCls}>Micro-eventos</p>
          {session.status === 'em_andamento' && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => openMicroModal('AVOIDANCE_OBSERVED')}
                className={isDark
                  ? 'px-2 py-1.5 rounded-md text-xs font-medium border border-amber-800 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50 transition-colors'
                  : 'px-2 py-1.5 rounded-md text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors'}
              >
                Evitou
              </button>
              <button
                onClick={() => openMicroModal('CONFRONTATION_OBSERVED')}
                className={isDark
                  ? 'px-2 py-1.5 rounded-md text-xs font-medium border border-emerald-800 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 transition-colors'
                  : 'px-2 py-1.5 rounded-md text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors'}
              >
                Enfrentou
              </button>
              <button
                onClick={() => openMicroModal('ADJUSTMENT_OBSERVED')}
                className={isDark
                  ? 'px-2 py-1.5 rounded-md text-xs font-medium border border-sky-800 bg-sky-900/30 text-sky-300 hover:bg-sky-900/50 transition-colors'
                  : 'px-2 py-1.5 rounded-md text-xs font-medium border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors'}
              >
                Ajustou
              </button>
              <button
                onClick={() => openMicroModal('RECOVERY_OBSERVED')}
                className={isDark
                  ? 'px-2 py-1.5 rounded-md text-xs font-medium border border-violet-800 bg-violet-900/30 text-violet-300 hover:bg-violet-900/50 transition-colors'
                  : 'px-2 py-1.5 rounded-md text-xs font-medium border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors'}
              >
                Recuperou
              </button>
            </div>
          )}
          {microEvents.length === 0 ? (
            <p className={isDark ? 'text-xs text-slate-500 italic' : 'text-xs text-slate-400 italic'}>
              {session.status === 'em_andamento' ? 'Nenhum registrado ainda' : 'Nenhum registrado'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {microEvents.map((ev, i) => (
                <span
                  key={i}
                  className={isDark
                    ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-900/50 text-slate-200 border border-slate-700'
                    : 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200'}
                  title={ev.note || undefined}
                >
                  {microLabel(ev.type)} ({(ev.intensity * 10).toFixed(0)}/10)
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
        {/* 2-column grid (desktop) / stacked (mobile) */}
        <div className="md:grid md:grid-cols-[480px_minmax(0,1fr)]">

          {/* ───── Sidebar DARK (desktop only) — sticky com scroll próprio ───── */}
          <aside className="hidden md:block bg-slate-800 text-slate-100 p-6 md:sticky md:top-0 md:max-h-screen md:overflow-y-auto">
            {sidebarContent('dark')}
          </aside>

          {/* ───── Main column ───── */}
          <div className="min-w-0 px-4 md:px-8 lg:px-10 xl:px-12 pt-6">
            <div className="max-w-5xl">

              {/* Voltar */}
              <Link href="/sessoes" className="inline-flex items-center gap-2 text-slate-500 hover:text-sky-600 transition-colors mb-4 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Voltar
              </Link>

              {/* Mobile accordion: contexto clínico (substitui sidebar em mobile) */}
              <div className="md:hidden mb-6">
                <button
                  onClick={() => setMobileContextOpen(!mobileContextOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                  aria-expanded={mobileContextOpen}
                >
                  <span className="text-sm font-medium text-slate-700">Contexto clínico & micro-eventos</span>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${mobileContextOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mobileContextOpen && (
                  <div className="mt-3 p-4 bg-white border border-slate-200 rounded-lg">
                    {sidebarContent('light')}
                  </div>
                )}
              </div>

              {/* Header */}
              <header className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">
                    Sessão #{session.session_number}
                  </h1>
                  <p className="text-base text-slate-400 italic font-light">{session.patient_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {session.google_meet_link && (
                    <a href={session.google_meet_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Entrar no Meet
                    </a>
                  )}
                  <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusStyle(session.status)}`}>
                    {getStatusText(session.status)}
                  </span>
                </div>
              </header>

              {/* ═══ Tabs ═══ */}
              <nav className="flex gap-6 border-b border-slate-200 mb-6">
                <button
                  onClick={() => setActiveTab('transcricao')}
                  className={`py-3 text-sm font-medium transition-colors relative ${
                    activeTab === 'transcricao'
                      ? 'text-slate-900 border-b-2 border-tcc-700'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Transcrição
                </button>
                <button
                  onClick={() => setActiveTab('relatorio')}
                  className={`py-3 text-sm font-medium transition-colors relative ${
                    activeTab === 'relatorio'
                      ? 'text-slate-900 border-b-2 border-tcc-700'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Relatório
                </button>
                {/* Aba Anotações oculta - Fase 13.1 (sem funcionalidade ainda)
                <button
                  onClick={() => setActiveTab('anotacoes' as any)}
                  className={`py-3 text-sm font-medium transition-colors relative ${
                    (activeTab as string) === 'anotacoes'
                      ? 'text-slate-900 border-b-2 border-tcc-700'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Anotações
                </button>
                */}
              </nav>

              {/* ═══ Tab: Transcrição ═══ */}
              {activeTab === 'transcricao' && (
                <section className="mb-8 pb-8 border-b border-slate-100">
                  {/* Progresso da transcrição (background job) */}
                  {transcriptionJob && (transcriptionJob.status === 'pending' || transcriptionJob.status === 'processing') && (
                    <div className="mb-4 p-4 bg-sky-50 rounded-lg border border-sky-200">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-medium text-sky-800">
                          {transcriptionJob.status === 'pending' ? 'Aguardando processamento...' : 'Transcrevendo áudio...'}
                        </p>
                      </div>
                      <div className="w-full bg-sky-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-sky-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
                      </div>
                      <p className="text-sm text-sky-700 mt-3">
                        Você pode continuar usando o sistema normalmente. A transcrição será processada em segundo plano.
                      </p>
                      <p className="mt-2 text-slate-400" style={{ fontSize: '12px', lineHeight: '1.4' }}>
                        Processamos as conversas em infraestrutura própria, com padrão de segurança hospitalar e proteção adicional além da LGPD.
                      </p>
                    </div>
                  )}
                  {transcriptionJob && transcriptionJob.status === 'failed' && (
                    <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm font-medium text-red-800">Erro na transcrição</p>
                      <p className="text-sm text-red-600 mt-1">{transcriptionJob.error_message || 'Ocorreu um erro ao processar o áudio. Tente novamente.'}</p>
                    </div>
                  )}

                  {transcript ? (
                    <div>
                      <TranscriptView
                        transcriptId={transcript.id}
                        fallbackText={transcript.text || transcript.text_preview}
                        previewMode={!transcriptExpanded}
                        previewBlocks={1}
                        onExpand={() => setTranscriptExpanded(true)}
                      />
                      <p className="text-xs text-slate-400 mt-4 mb-4">Transcrito em {new Date(transcript.created_at).toLocaleString('pt-BR')}</p>
                      {!analysis && (
                        <button onClick={handleTCC} disabled={analyzing} className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50 transition-colors text-sm font-medium">
                          {analyzing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                          {analyzing ? 'Analisando...' : 'Analisar TCC'}
                        </button>
                      )}

                      {/* Estrutura Analítica (Fatos/Pensamentos/Emoções) — colapsado por default. Insights ficam SÓ na sidebar. */}
                      {analysis && (
                        <div className="mt-8">
                          <AnalyticalStructure analysis={analysis} />
                        </div>
                      )}
                    </div>
                  ) : !uploading && !transcriptionJob && (
                    <div>
                      <p className="text-slate-400 italic mb-4 text-sm">Nenhuma transcrição</p>
                      <div className="flex gap-3">
                        {!isRecording ? (
                          <button onClick={startRec} disabled={uploading} className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-colors text-sm font-medium">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            Gravar
                          </button>
                        ) : (
                          <button onClick={stopRec} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg animate-pulse text-sm font-medium">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" /></svg>
                            Parar ({fmtTime(recordingTime)})
                          </button>
                        )}
                        <label className={`flex items-center gap-2 px-5 py-2.5 bg-sky-50 text-sky-600 border border-sky-200 rounded-lg cursor-pointer hover:bg-sky-100 transition-colors text-sm font-medium ${uploading ? 'opacity-50' : ''}`}>
                          {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" role="status" aria-label="Enviando"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                          {uploading ? 'Enviando...' : 'Upload'}
                          <input type="file" accept="audio/*" onChange={handleUpload} disabled={uploading} className="hidden" />
                        </label>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* ═══ Tab: Relatório ═══ */}
              {/* ClinicalReport mounted always so onReportLoaded fires and feeds Insights na sidebar */}
              <div className={activeTab === 'relatorio' ? '' : 'hidden'}>
                <ClinicalReport
                  sessionId={id}
                  hasTranscript={!!transcript?.text || !!transcript?.text_preview}
                  hasAnalysis={!!analysis}
                  onReportLoaded={(r) => setClinicalReport(r)}
                  onLimitReached={() => {
                    setLimitReason('report')
                    setShowLimitModal(true)
                  }}
                />

                {clinicalReport?.insights && (
                  <SignalsPreview
                    insights={clinicalReport.insights as { emotions?: { name: string; intensity: number }[]; distortions?: { type: string; label: string; example: string }[] }}
                    microEvents={microEvents.reduce<{ type: string; count: number }[]>((acc, ev) => {
                      const existing = acc.find(a => a.type === ev.type)
                      if (existing) existing.count++
                      else acc.push({ type: ev.type, count: 1 })
                      return acc
                    }, [])}
                    onClickSignal={(section) => {
                      setOpenInsightSection(section)
                      setActiveTab('transcricao')
                    }}
                  />
                )}
              </div>

              {/* Tab Anotações ocultada - Fase 13.1 (sem funcionalidade ainda)
              {(activeTab as string) === 'anotacoes' && (
                <section className="mb-8 pb-8">
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-slate-400 text-sm">Funcionalidade em breve</p>
                    <p className="text-slate-300 text-xs mt-1">Anotações livres durante e após a sessão</p>
                  </div>
                </section>
              )}
              */}

              {/* Finalizar */}
              {session.status === 'em_andamento' && (
                <section>
                  <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">Finalizar Sessão</h2>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações finais..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg mb-4 h-32 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleFinish}
                    disabled={finishing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    {finishing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" role="status" aria-label="Finalizando"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    {finishing ? 'Finalizando...' : 'Finalizar Sessão'}
                  </button>
                </section>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Modal Micro-evento */}
      {showMicroModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-serif text-xl font-light text-slate-900">Registrar: {microLabel(microType)}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Intensidade: {(microIntensity * 10).toFixed(0)}/10</label>
                <input type="range" min="0" max="1" step="0.1" value={microIntensity} onChange={(e) => setMicroIntensity(parseFloat(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nota curta (opcional)</label>
                <input type="text" value={microNote} onChange={(e) => setMicroNote(e.target.value)} placeholder="Ex: evitou contato visual ao falar do pai" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" maxLength={200} />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowMicroModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-sm text-slate-600">Cancelar</button>
              <button onClick={saveMicroEvent} disabled={savingMicro} className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 text-sm font-medium">
                {savingMicro ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal limite de transcricao / relatorio (Fase 12.3) */}
      <UpgradeModalTCC
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        reason={limitReason}
      />
    </div>
  )
}
