'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import EvolutionReport from '../../components/EvolutionReport'

export default function PatientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { isLoaded, userId } = useAuth()
  const [patient, setPatient] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [showPushLink, setShowPushLink] = useState(false)
  const [pushLink, setPushLink] = useState('')
  const [pushLoading, setPushLoading] = useState(false)
  const [pushCopied, setPushCopied] = useState(false)
  const [showEvolution, setShowEvolution] = useState(false)
  
  const [clinicalRecord, setClinicalRecord] = useState<any>(null)
  const [clinicalRecordExists, setClinicalRecordExists] = useState(false)
  const [showClinicalModal, setShowClinicalModal] = useState(false)
  const [clinicalStep, setClinicalStep] = useState<'record' | 'review' | 'edit'>('record')
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [clinicalData, setClinicalData] = useState({ complaint: '', patterns: '', interventions: '', current_state: '', transcript: '' })
  const [savingClinical, setSavingClinical] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isLoaded && userId && id) {
      loadPatient()
      loadClinicalRecord()
    }
  }, [isLoaded, userId, id])

  const loadPatient = async () => {
    try {
      setLoading(true)
      const [patientRes, sessionsRes] = await Promise.all([
        fetch(`/api/patients/${id}`),
        fetch(`/api/patients/${id}/sessions`)
      ])
      if (patientRes.ok) {
        const data = await patientRes.json()
        setPatient(data.patient)
      }
      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadClinicalRecord = async () => {
    try {
      const res = await fetch(`/api/patients/${id}/clinical-record`)
      if (res.ok) {
        const data = await res.json()
        setClinicalRecordExists(data.exists)
        if (data.exists) setClinicalRecord(data.record)
      }
    } catch (error) {
      console.error('Erro ao carregar registro clínico:', error)
    }
  }

  const openEdit = () => {
    setEditData({
      name: patient?.full_name || '',
      email: patient?.email || '',
      phone: patient?.phone || '',
      birth_date: patient?.birth_date ? patient.birth_date.split('T')[0] : '',
      gender: patient?.gender || '',
      diagnosis: patient?.diagnosis || '',
      medication: patient?.medication || '',
      notes: patient?.notes || ''
    })
    setShowEdit(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })
      if (res.ok) {
        setShowEdit(false)
        loadPatient()
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/patients/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/pacientes')
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handlePushLink = async () => {
    setPushLoading(true)
    try {
      const res = await fetch(`/api/patients/${id}/push-link`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setPushLink(data.link)
        setShowPushLink(true)
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setPushLoading(false)
    }
  }

  const copyPushLink = () => {
    navigator.clipboard.writeText(pushLink)
    setPushCopied(true)
    setTimeout(() => setPushCopied(false), 2000)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error)
      alert('Não foi possível acessar o microfone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAudioBlob(file)
  }

  const processAudio = async () => {
    if (!audioBlob) return
    setTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'clinical_record.webm')
      const transcribeRes = await fetch('/api/transcribe-audio', { method: 'POST', body: formData })
      if (!transcribeRes.ok) throw new Error('Erro na transcrição')
      const transcribeData = await transcribeRes.json()
      const transcript = transcribeData.text
      setClinicalData(prev => ({ ...prev, transcript }))
      setTranscribing(false)
      setAnalyzing(true)
      const analyzeRes = await fetch('/api/analyze-clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, patientName: patient?.full_name })
      })
      if (analyzeRes.ok) {
        const analyzeData = await analyzeRes.json()
        setClinicalData({
          complaint: analyzeData.complaint || '',
          patterns: analyzeData.patterns || '',
          interventions: analyzeData.interventions || '',
          current_state: analyzeData.current_state || '',
          transcript
        })
      }
      setClinicalStep('review')
    } catch (error) {
      console.error('Erro ao processar áudio:', error)
      alert('Erro ao processar áudio')
    } finally {
      setTranscribing(false)
      setAnalyzing(false)
    }
  }

  const saveClinicalRecord = async () => {
    setSavingClinical(true)
    try {
      const res = await fetch(`/api/patients/${id}/clinical-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaint: clinicalData.complaint,
          patterns: clinicalData.patterns,
          interventions: clinicalData.interventions,
          current_state: clinicalData.current_state,
          original_transcript: clinicalData.transcript
        })
      })
      if (res.ok) {
        setShowClinicalModal(false)
        setClinicalStep('record')
        setAudioBlob(null)
        setClinicalData({ complaint: '', patterns: '', interventions: '', current_state: '', transcript: '' })
        loadClinicalRecord()
      }
    } catch (error) {
      console.error('Erro ao salvar:', error)
    } finally {
      setSavingClinical(false)
    }
  }

  const formatPhone = (phone: string) => {
    if (!phone) return '-'
    const clean = phone.replace(/\D/g, '')
    if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`
    if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`
    return phone
  }

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
      case 'em_andamento': return 'text-sky-600'
      case 'agendada': return 'text-amber-600'
      case 'finalizada': return 'text-slate-500'
      default: return 'text-slate-500'
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="md:ml-20 min-h-screen flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="md:ml-20 min-h-screen flex items-center justify-center">
          <p className="text-slate-500 italic">Paciente não encontrado</p>
        </main>
      </div>
    )
  }return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
        <div className="px-4 md:px-8 lg:px-12 xl:px-16 pt-6">
          <div className="max-w-4xl mx-auto">
            
            {/* Voltar */}
            <Link href="/pacientes" className="inline-flex items-center gap-2 text-slate-500 hover:text-sky-600 transition-colors mb-6 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Voltar
            </Link>

            {/* Header */}
            <header className="flex items-start justify-between mb-8">
              <div>
                <h1 className="font-serif text-3xl md:text-4xl font-light text-slate-900 tracking-tight mb-1">
                  {patient.name || patient.full_name}
                </h1>
                <p className="text-base text-slate-400 italic font-light">Informações e histórico do paciente</p>
              </div>
              <div className="flex gap-2">
                {sessions.filter(s => s.status === "finalizada").length >= 3 && (
                  <button onClick={() => setShowEvolution(!showEvolution)} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    Evolução
                  </button>
                )}
                <button onClick={handlePushLink} disabled={pushLoading} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium disabled:opacity-50">
                  {pushLoading ? <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                  Lembretes
                </button>
                <button onClick={openEdit} className="flex items-center gap-2 px-4 py-2 bg-sky-50 text-sky-600 border border-sky-300 rounded-lg hover:bg-sky-100 transition-colors text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Editar
                </button>
                <button onClick={() => setShowDelete(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Excluir
                </button>
              </div>
            </header>

            {/* Info básico */}
            <section className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-slate-100">
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Email</p>
                <p className="text-slate-900 text-sm">{patient.email || '-'}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Telefone</p>
                <p className="text-slate-900 text-sm">{formatPhone(patient.phone)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Data de Nascimento</p>
                <p className="text-slate-900 text-sm">{patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('pt-BR') : '-'}</p>
              </div>
            </section>

            {/* Card Registro Clínico Assistido */}
            {!clinicalRecordExists && (
              <section className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <div>
                      <h3 className="font-medium text-sky-900 text-sm">Registro Clínico Assistido</h3>
                      <p className="text-xs text-sky-700">Para pacientes com histórico terapêutico anterior ao uso do AXIS</p>
                    </div>
                  </div>
                  <button onClick={() => setShowClinicalModal(true)} className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 text-sm font-medium transition-colors">
                    Registrar histórico
                  </button>
                </div>
              </section>
            )}

            {/* Exibir Registro Clínico se existir */}
            {clinicalRecordExists && clinicalRecord && (
              <section className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-6">
                <h3 className="font-medium text-slate-800 mb-1 text-sm">Contexto Clínico Inicial</h3>
                <p className="text-xs text-slate-400 mb-4">Registro retrospectivo informado pelo profissional antes do início das sessões no sistema.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clinicalRecord.complaint && <div><p className="text-xs text-slate-500 mb-1">Evento ou contexto inicial</p><p className="text-sm text-slate-800">{clinicalRecord.complaint}</p></div>}
                  {clinicalRecord.patterns && <div><p className="text-xs text-slate-500 mb-1">Aspectos mencionados no histórico</p><p className="text-sm text-slate-800">{clinicalRecord.patterns}</p></div>}
                  {clinicalRecord.interventions && <div><p className="text-xs text-slate-500 mb-1">Intervenções prévias relatadas</p><p className="text-sm text-slate-800">{clinicalRecord.interventions}</p></div>}
                  {clinicalRecord.current_state && <div><p className="text-xs text-slate-500 mb-1">Situação atual conforme relato</p><p className="text-sm text-slate-800">{clinicalRecord.current_state}</p></div>}
                </div>
              </section>
            )}

            {/* Informações Clínicas */}
            {(patient.diagnosis || patient.medication || patient.notes || patient.gender) && (
              <section className="mb-6 pb-6 border-b border-slate-100">
                <h2 className="font-serif text-xl font-light text-slate-800 mb-4">Informações Clínicas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {patient.gender && <div><p className="text-xs text-slate-400 mb-1">Gênero</p><p className="text-sm text-slate-800">{patient.gender}</p></div>}
                  {patient.diagnosis && <div><p className="text-xs text-slate-400 mb-1">Diagnóstico</p><p className="text-sm text-slate-800">{patient.diagnosis}</p></div>}
                  {patient.medication && <div><p className="text-xs text-slate-400 mb-1">Medicação</p><p className="text-sm text-slate-800">{patient.medication}</p></div>}
                  {patient.notes && <div className="md:col-span-2"><p className="text-xs text-slate-400 mb-1">Observações</p><p className="text-sm text-slate-800">{patient.notes}</p></div>}
                </div>
              </section>
            )}

            {/* Evolução - NÃO MEXER NO COMPONENTE */}
            {showEvolution && (
              <div id="evolution-report">
                <EvolutionReport patientId={id} sessionsCount={sessions.filter(s => s.status === "finalizada").length} onClose={() => setShowEvolution(false)} />
              </div>
            )}

            {/* Histórico de Sessões */}
            <section>
              <h2 className="font-serif text-xl font-light text-slate-800 mb-4">Histórico de Sessões ({sessions.length})</h2>
              {sessions.length === 0 ? (
                <p className="text-slate-400 italic text-sm">Nenhuma sessão registrada</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 font-medium">
                    <div className="col-span-1">#</div>
                    <div className="col-span-3">Data</div>
                    <div className="col-span-4">Status</div>
                    <div className="col-span-4">Duração</div>
                  </div>
                  <div className="flex flex-col">
                    {sessions.map((s) => (
                      <div 
                        key={s.id}
                        onClick={() => router.push(`/sessoes/${s.id}`)}
                        className="grid grid-cols-12 gap-4 py-3 items-center hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100"
                      >
                        <div className="col-span-1 text-sm text-slate-600">{s.session_number}</div>
                        <div className="col-span-3 text-sm text-slate-700">{new Date(s.scheduled_at || s.started_at || s.created_at).toLocaleDateString('pt-BR')}</div>
                        <div className="col-span-4">
                          <span className={`text-sm ${getStatusStyle(s.status)}`}>{getStatusText(s.status)}</span>
                        </div>
                        <div className="col-span-4 text-sm text-slate-500">{s.duration_minutes ? `${s.duration_minutes} min` : '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
      </main>{/* Modal Push Link */}
      {showPushLink && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-serif text-xl font-light text-slate-900">Link de Lembretes</h3>
              <button onClick={() => setShowPushLink(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">Envie este link para o paciente ativar lembretes no celular:</p>
              <div className="bg-slate-100 p-3 rounded-lg mb-4 break-all text-sm font-mono text-slate-700">{pushLink}</div>
              <div className="flex gap-3">
                <button onClick={copyPushLink} className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 text-sm font-medium">
                  {pushCopied ? 'Copiado!' : 'Copiar Link'}
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent('Olá! Ative seus lembretes de sessão: ' + pushLink)}`} target="_blank" className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium text-center">
                  Enviar WhatsApp
                </a>
              </div>
              <p className="text-xs text-slate-400 mt-3">O paciente só receberá lembretes logísticos (data/hora). Nenhuma informação clínica será enviada.</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {showEdit && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-serif text-xl font-light text-slate-900">Editar Paciente</h3>
              <button onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome</label><input type="text" value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" value={editData.email} onChange={(e) => setEditData({...editData, email: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label><input type="tel" value={editData.phone} onChange={(e) => setEditData({...editData, phone: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label><input type="date" value={editData.birth_date} onChange={(e) => setEditData({...editData, birth_date: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Gênero</label><input type="text" value={editData.gender} onChange={(e) => setEditData({...editData, gender: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Diagnóstico</label><input type="text" value={editData.diagnosis} onChange={(e) => setEditData({...editData, diagnosis: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Medicação</label><input type="text" value={editData.medication} onChange={(e) => setEditData({...editData, medication: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Observações</label><textarea value={editData.notes} onChange={(e) => setEditData({...editData, notes: e.target.value})} rows={3} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" /></div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl">
              <button onClick={() => setShowEdit(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-sm text-slate-600">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 text-sm font-medium">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {showDelete && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-6">
              <h3 className="font-serif text-xl font-light text-slate-900 mb-2">Excluir Paciente</h3>
              <p className="text-slate-600 text-sm mb-6">Tem certeza que deseja excluir <strong>{patient.full_name}</strong>? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDelete(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-sm text-slate-600">Cancelar</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50 text-sm font-medium">
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registro Clínico Assistido */}
      {showClinicalModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-serif text-xl font-light text-slate-900">Registro Clínico Assistido</h3>
              <button onClick={() => { setShowClinicalModal(false); setClinicalStep('record'); setAudioBlob(null) }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {clinicalStep === 'record' && (
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-2">Grave ou importe um resumo clínico inicial com base no seu conhecimento prévio do paciente.</p>
                <p className="text-xs text-slate-400 mb-6">Inclua contexto inicial, intervenções prévias e situação atual.</p>
                <input type="file" ref={fileInputRef} accept="audio/*" onChange={handleFileUpload} className="hidden" />
                <div className="flex flex-col items-center gap-4">
                  {!audioBlob ? (
                    <>
                      <div className="flex items-center gap-6">
                        {!isRecording ? (
                          <button onClick={startRecording} className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white transition-colors">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                          </button>
                        ) : (
                          <button onClick={stopRecording} className="w-20 h-20 rounded-full bg-rose-600 animate-pulse flex items-center justify-center text-white">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" /></svg>
                          </button>
                        )}
                        <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors" title="Importar áudio">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </button>
                      </div>
                      <p className="text-sm text-slate-500">{isRecording ? 'Gravando... Clique para parar' : 'Grave ou importe um áudio'}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-emerald-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="text-sm">Áudio pronto</span>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setAudioBlob(null)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm text-slate-600">Escolher outro</button>
                        <button onClick={processAudio} disabled={transcribing || analyzing} className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 text-sm font-medium flex items-center gap-2">
                          {(transcribing || analyzing) && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                          {transcribing ? 'Transcrevendo...' : analyzing ? 'Analisando...' : 'Processar'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {clinicalStep === 'review' && (
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">Resumo clínico preliminar gerado. Revise e edite se necessário.</p>
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Evento ou contexto inicial</label><textarea value={clinicalData.complaint} onChange={(e) => setClinicalData({...clinicalData, complaint: e.target.value})} rows={2} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Aspectos mencionados no histórico</label><textarea value={clinicalData.patterns} onChange={(e) => setClinicalData({...clinicalData, patterns: e.target.value})} rows={2} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Intervenções prévias relatadas</label><textarea value={clinicalData.interventions} onChange={(e) => setClinicalData({...clinicalData, interventions: e.target.value})} rows={2} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Situação atual conforme relato</label><textarea value={clinicalData.current_state} onChange={(e) => setClinicalData({...clinicalData, current_state: e.target.value})} rows={2} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" /></div>
                </div>
                <p className="text-xs text-slate-400 mt-4 italic">Este registro é descritivo, retrospectivo e não substitui sessões clínicas.</p>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => { setClinicalStep('record'); setAudioBlob(null) }} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm text-slate-600">Voltar</button>
                  <button onClick={saveClinicalRecord} disabled={savingClinical} className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 text-sm font-medium">
                    {savingClinical ? 'Salvando...' : 'Confirmar e salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
