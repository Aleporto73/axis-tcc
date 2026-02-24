'use client'

import { useEffect, useState, use, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import SessionReport from '../../components/SessionReport'

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

interface Transcript { id: string; text: string; created_at: string; processed: boolean }
interface TCCAnalysis { fatos: string[]; pensamentos: string[]; emocoes: string[] }
interface MicroEvent { type: string; intensity: number; note: string; created_at: string }
interface PipelineResult { event_created: boolean; cso_updated: boolean; suggestion_generated: boolean; flex_trend: string; micro_events: { confrontations: number; avoidances: number; adjustments: number; recoveries: number } }
interface TranscribeProgress { type: string; current?: number; total?: number; percent?: number; minutesLeft?: number; message?: string; transcript?: Transcript }

export default function SessaoDetalhesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { isLoaded, userId } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [analysis, setAnalysis] = useState<TCCAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
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
  const [showReport, setShowReport] = useState(false)
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null)
  const [transcribeProgress, setTranscribeProgress] = useState<TranscribeProgress | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { if (isLoaded && userId) loadSession() }, [isLoaded, userId, id])
  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current) } }, [])

  const loadSession = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/sessions/${id}`)
      if (res.ok) { const data = await res.json(); setSession(data.session); if (data.transcript) setTranscript(data.transcript) }
      else router.push('/sessoes')
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleFinish = async () => {
    try {
      setFinishing(true)
      const res = await fetch(`/api/sessions/${id}/finish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) })
      if (res.ok) { const data = await res.json(); if (data.pipeline) setPipelineResult(data.pipeline); loadSession() }
    } catch (e) { console.error(e) } finally { setFinishing(false) }
  }

  const sendAudio = async (fd: FormData) => {
    try {
      setUploading(true)
      setTranscribeProgress({ type: 'status', message: 'Enviando audio...', percent: 0 })

      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })

      const contentType = res.headers.get('content-type') || ''

      // Audio pequeno - resposta JSON direta
      if (contentType.includes('application/json')) {
        if (res.ok) {
          const data = await res.json()
          setTranscript(data.transcript)
          setTranscribeProgress(null)
        } else {
          const err = await res.json()
          alert(err.error || 'Erro')
          setTranscribeProgress(null)
        }
        return
      }

      // Audio grande - resposta streaming com progresso
      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          alert('Erro ao ler resposta')
          setTranscribeProgress(null)
          return
        }

        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.type === 'progress' || data.type === 'status') {
                  setTranscribeProgress(data)
                }

                if (data.type === 'done' && data.transcript) {
                  setTranscript(data.transcript)
                  setTranscribeProgress(null)
                }

                if (data.type === 'error') {
                  alert(data.message || 'Erro na transcricao')
                  setTranscribeProgress(null)
                }
              } catch (e) {
                console.error('Erro ao parsear progresso:', e)
              }
            }
          }
        }

        return
      }

      // Fallback
      alert('Resposta inesperada do servidor')
      setTranscribeProgress(null)

    } catch (e) {
      console.error(e)
      alert('Erro ao enviar audio')
      setTranscribeProgress(null)
    } finally {
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
      const res = await fetch('/api/analyze-tcc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript_id: transcript.id, text: transcript.text, session_id: session.id, patient_id: session.patient_id }) })
      if (res.ok) { const data = await res.json(); setAnalysis(data.analysis) }
    } catch (e) { console.error(e) } finally { setAnalyzing(false) }
  }

  const openMicroModal = (type: string) => { setMicroType(type); setMicroIntensity(0.5); setMicroNote(''); setShowMicroModal(true) }

  const saveMicroEvent = async () => {
    if (!session) return
    try {
      setSavingMicro(true)
      const res = await fetch('/api/events/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: session.patient_id, event_type: microType, payload: { intensity: microIntensity, note: microNote, context: 'session' }, related_entity_id: session.id }) })
      if (res.ok) { setMicroEvents(prev => [...prev, { type: microType, intensity: microIntensity, note: microNote, created_at: new Date().toISOString() }]); setShowMicroModal(false) }
    } catch (e) { console.error(e) } finally { setSavingMicro(false) }
  }

  const microLabel = (type: string) => { switch (type) { case 'AVOIDANCE_OBSERVED': return 'Evitou'; case 'CONFRONTATION_OBSERVED': return 'Enfrentou'; case 'ADJUSTMENT_OBSERVED': return 'Ajustou'; case 'RECOVERY_OBSERVED': return 'Recuperou'; default: return type } }
  const microColor = (type: string) => { switch (type) { case 'AVOIDANCE_OBSERVED': return 'bg-amber-50 text-amber-700 border-amber-200'; case 'CONFRONTATION_OBSERVED': return 'bg-emerald-50 text-emerald-700 border-emerald-200'; case 'ADJUSTMENT_OBSERVED': return 'bg-sky-50 text-sky-700 border-sky-200'; case 'RECOVERY_OBSERVED': return 'bg-violet-50 text-violet-700 border-violet-200'; default: return 'bg-slate-50 text-slate-700 border-slate-200' } }
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
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
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

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
        <div className="px-4 md:px-8 lg:px-12 xl:px-16 pt-6">
          <div className="max-w-4xl mx-auto">
            
            {/* Voltar */}
            <Link href="/sessoes" className="inline-flex items-center gap-2 text-slate-500 hover:text-sky-600 transition-colors mb-6 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Voltar
            </Link>

            {/* Header */}
            <header className="flex items-start justify-between mb-8">
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
                {session.status === 'finalizada' && (
                  <button onClick={() => setShowReport(!showReport)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Relatório
                  </button>
                )}
                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusStyle(session.status)}`}>
                  {getStatusText(session.status)}
                </span>
              </div>
            </header>

            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8 pb-8 border-b border-slate-100">
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Paciente</p>
                <p className="text-slate-900 font-medium">{session.patient_name}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Data</p>
                <p className="text-slate-900 font-medium">{new Date(session.scheduled_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Duração</p>
                <p className="text-slate-900 font-medium">{session.duration_minutes ? `${session.duration_minutes} min` : session.status === 'agendada' ? 'Aguardando' : 'Em andamento'}</p>
              </div>
            </div>

            {showReport && <SessionReport sessionId={id} onClose={() => setShowReport(false)} />}

            {/* Micro-eventos */}
            {session.status === 'em_andamento' && (
              <section className="mb-8 pb-8 border-b border-slate-100">
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">Micro-eventos de Flexibilidade</h2>
                <p className="text-sm text-slate-400 mb-4">Marque comportamentos observados durante a sessão</p>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { type: 'AVOIDANCE_OBSERVED', label: 'Evitou', color: 'amber' },
                    { type: 'CONFRONTATION_OBSERVED', label: 'Enfrentou', color: 'emerald' },
                    { type: 'ADJUSTMENT_OBSERVED', label: 'Ajustou', color: 'sky' },
                    { type: 'RECOVERY_OBSERVED', label: 'Recuperou', color: 'violet' },
                  ].map(m => (
                    <button key={m.type} onClick={() => openMicroModal(m.type)} className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-${m.color}-200 bg-${m.color}-50 hover:bg-${m.color}-100 transition-colors`}>
                      <span className={`text-sm font-medium text-${m.color}-700`}>{m.label}</span>
                    </button>
                  ))}
                </div>
                {microEvents.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {microEvents.map((ev, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${microColor(ev.type)}`}>
                        {microLabel(ev.type)} ({(ev.intensity * 10).toFixed(0)}/10)
                        {ev.note && <span className="text-slate-400">- {ev.note}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Transcrição */}
            <section className="mb-8 pb-8 border-b border-slate-100">
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">Transcrição</h2>
              
              {/* Barra de progresso */}
              {transcribeProgress && (
                <div className="mb-4 p-4 bg-sky-50 rounded-lg border border-sky-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-sky-800">{transcribeProgress.message}</p>
                    {transcribeProgress.percent !== undefined && (
                      <span className="text-sm font-semibold text-sky-700">{transcribeProgress.percent}%</span>
                    )}
                  </div>
                  <div className="w-full bg-sky-100 rounded-full h-2.5">
                    <div 
                      className="bg-sky-500 h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${transcribeProgress.percent || 0}%` }}
                    ></div>
                  </div>
                  {transcribeProgress.minutesLeft !== undefined && transcribeProgress.minutesLeft > 0 && (
                    <p className="text-xs text-sky-600 mt-2">
                      Tempo estimado: ~{transcribeProgress.minutesLeft} min restante{transcribeProgress.minutesLeft > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {transcript ? (
                <div>
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 max-h-48 overflow-y-auto mb-4">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{transcript.text}</p>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Transcrito em {new Date(transcript.created_at).toLocaleString('pt-BR')}</p>
                  {!analysis && (
                    <button onClick={handleTCC} disabled={analyzing} className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50 transition-colors text-sm font-medium">
                      {analyzing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                      {analyzing ? 'Analisando...' : 'Analisar TCC'}
                    </button>
                  )}
                </div>
              ) : !transcribeProgress && (
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
                      {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                      {uploading ? 'Enviando...' : 'Upload'}
                      <input type="file" accept="audio/*" onChange={handleUpload} disabled={uploading} className="hidden" />
                    </label>
                  </div>
                </div>
              )}
            </section>

            {/* Análise TCC */}
            {analysis && (
              <section className="mb-8 pb-8 border-b border-slate-100">
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">Análise TCC</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-sky-50 rounded-lg p-4 border border-sky-200">
                    <h3 className="font-medium text-sky-800 mb-3 text-sm">Fatos</h3>
                    <ul className="space-y-2">{analysis.fatos.map((f,i) => <li key={i} className="text-sm bg-white rounded p-2 border border-sky-100">{f}</li>)}</ul>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <h3 className="font-medium text-amber-800 mb-3 text-sm">Pensamentos</h3>
                    <ul className="space-y-2">{analysis.pensamentos.map((p,i) => <li key={i} className="text-sm bg-white rounded p-2 border border-amber-100">{p}</li>)}</ul>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                    <h3 className="font-medium text-rose-800 mb-3 text-sm">Emoções</h3>
                    <ul className="space-y-2">{analysis.emocoes.map((e,i) => <li key={i} className="text-sm bg-white rounded p-2 border border-rose-100">{e}</li>)}</ul>
                  </div>
                </div>
              </section>
            )}

            {/* Pipeline Result */}
            {pipelineResult && (
              <section className="mb-8 pb-8 border-b border-slate-100">
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">Pipeline TCC Processado</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    {pipelineResult.event_created ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <span className="w-4 h-4 rounded-full bg-slate-200" />}
                    <span className="text-slate-600">Evento SESSION_END criado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pipelineResult.cso_updated ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <span className="w-4 h-4 rounded-full bg-slate-200" />}
                    <span className="text-slate-600">CSO atualizado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pipelineResult.suggestion_generated ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <span className="w-4 h-4 rounded-full bg-slate-200" />}
                    <span className="text-slate-600">Sugestão gerada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${pipelineResult.flex_trend === 'up' ? 'bg-emerald-50 text-emerald-700' : pipelineResult.flex_trend === 'down' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'}`}>
                      Flexibilidade: {pipelineResult.flex_trend}
                    </span>
                  </div>
                </div>
                {(pipelineResult.micro_events.confrontations + pipelineResult.micro_events.avoidances + pipelineResult.micro_events.adjustments + pipelineResult.micro_events.recoveries) > 0 && (
                  <div className="mt-4 flex gap-3 text-xs">
                    <span className="px-2 py-1 bg-emerald-50 rounded border border-emerald-200 text-emerald-700">Enfrentou: {pipelineResult.micro_events.confrontations}</span>
                    <span className="px-2 py-1 bg-amber-50 rounded border border-amber-200 text-amber-700">Evitou: {pipelineResult.micro_events.avoidances}</span>
                    <span className="px-2 py-1 bg-sky-50 rounded border border-sky-200 text-sky-700">Ajustou: {pipelineResult.micro_events.adjustments}</span>
                    <span className="px-2 py-1 bg-violet-50 rounded border border-violet-200 text-violet-700">Recuperou: {pipelineResult.micro_events.recoveries}</span>
                  </div>
                )}
              </section>
            )}

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
                  {finishing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                  {finishing ? 'Finalizando...' : 'Finalizar Sessão'}
                </button>
              </section>
            )}

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
    </div>
  )
}
