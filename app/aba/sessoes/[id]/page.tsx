'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Session {
  id: string
  learner_id: string
  learner_name: string
  status: string
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  location: string | null
  notes: string | null
}

interface Target {
  id: string
  protocol_id: string
  target_name: string
  trials_total: number
  trials_correct: number
  prompt_level: string
  score_pct: number
  notes: string | null
  protocol_objective: string
}

interface Behavior {
  id: string
  behavior_type: string
  antecedent: string
  behavior: string
  consequence: string
  intensity: string
  duration_seconds: number | null
  recorded_at: string
}

interface Protocol {
  id: string
  title: string
  domain: string
  status: string
  ebp_name: string
  objective: string
}

interface EBP {
  id: number
  name: string
  name_pt: string
  domain: string
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

const promptLabels: Record<string, string> = {
  independent: 'Independente',
  gestural: 'Gestual',
  verbal: 'Verbal',
  modeling: 'Modelagem',
  partial_physical: 'Física parcial',
  full_physical: 'Física total',
}

const intensityLabels: Record<string, string> = {
  leve: 'Leve',
  moderada: 'Moderada',
  alta: 'Alta',
  severa: 'Severa',
}

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [behaviors, setBehaviors] = useState<Behavior[]>([])
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [ebps, setEbps] = useState<EBP[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<'trials' | 'behaviors'>('trials')

  const [trialForm, setTrialForm] = useState({
    protocol_id: '', target_name: '', trials_total: 10, trials_correct: 0, prompt_level: 'full_physical', notes: '',
  })
  const [behaviorForm, setBehaviorForm] = useState({
    behavior_type: '', antecedent: '', behavior: '', consequence: '', intensity: 'leve' as string, duration_seconds: '', location: '',
  })
  const [savingTrial, setSavingTrial] = useState(false)
  const [savingBehavior, setSavingBehavior] = useState(false)

  const [showProtocolModal, setShowProtocolModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [summaryEmail, setSummaryEmail] = useState('')
  const [summaryGuardians, setSummaryGuardians] = useState<{id:string;name:string;email:string|null}[]>([])
  const [summarySaving, setSummarySaving] = useState(false)
  const [summaryStatus, setSummaryStatus] = useState<'idle'|'sent'|'error'>('idle')
  const [summaryError, setSummaryError] = useState<string|null>(null)

  const openSummaryModal = async () => {
    if (!session) return
    setSummaryText('')
    setSummaryEmail('')
    setSummaryStatus('idle')
    setSummaryError(null)
    try {
      const res = await fetch('/api/aba/guardians?learner_id=' + session.learner_id)
      const d = await res.json()
      const gs = d.guardians || []
      setSummaryGuardians(gs)
      if (gs.length > 0 && gs[0].email) setSummaryEmail(gs[0].email)
    } catch {}
    setShowSummaryModal(true)
  }

  const sendSummary = async () => {
    if (!summaryText.trim()) { setSummaryError('Escreva o resumo antes de enviar.'); return }
    if (!summaryEmail.trim()) { setSummaryError('Informe o email do destinatário.'); return }
    setSummarySaving(true)
    setSummaryError(null)
    try {
      // 1. Cria rascunho
      const postRes = await fetch('/api/aba/sessions/' + sessionId + '/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: summaryText })
      })
      const postData = await postRes.json()
      if (!postData.summary_id) throw new Error(postData.error || 'Erro ao criar resumo')
      const summary_id = postData.summary_id
      // 2. Aprova
      const approveRes = await fetch('/api/aba/sessions/' + sessionId + '/summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_id, action: 'approve' })
      })
      if (!approveRes.ok) throw new Error('Erro ao aprovar resumo')
      // 3. Envia
      const sendRes = await fetch('/api/aba/sessions/' + sessionId + '/summary', {
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
  const [savingProtocol, setSavingProtocol] = useState(false)
  const [protocolForm, setProtocolForm] = useState({
    title: '', ebp_practice_id: 7, domain: 'Aquisição', objective: '',
    mastery_criteria_pct: 80, mastery_criteria_sessions: 3, mastery_criteria_trials: 10,
  })

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/aba/sessions/${sessionId}`)
      if (!res.ok) { setError('Sessão não encontrada'); setLoading(false); return }
      const data = await res.json()
      setSession(data.session)
      setTargets(data.targets || [])
      setBehaviors(data.behaviors || [])
      if (data.session?.learner_id) {
        const pRes = await fetch(`/api/aba/protocols?learner_id=${data.session.learner_id}`)
        const pData = await pRes.json()
        setProtocols(pData.protocols || [])
      }
      setLoading(false)
    } catch { setError('Falha de conexão'); setLoading(false) }
  }, [sessionId])

  const fetchEbps = useCallback(async () => {
    try {
      const res = await fetch('/api/aba/ebp-practices')
      if (res.ok) { const data = await res.json(); setEbps(data.practices || []) }
    } catch {}
  }, [])

  useEffect(() => { fetchSession(); fetchEbps() }, [fetchSession, fetchEbps])

  const handleAction = async (action: 'open' | 'close') => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/aba/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro na ação')
        setActionLoading(false)
        return
      }
      await fetchSession()
      setActionLoading(false)
    } catch {
      setError('Falha de conexão')
      setActionLoading(false)
    }
  }

  const handleAddTrial = async () => {
    if (!trialForm.protocol_id || !trialForm.target_name) {
      setError('Selecione o protocolo e nome do alvo'); return
    }
    setSavingTrial(true); setError(null)
    try {
      const res = await fetch(`/api/aba/sessions/${sessionId}/trials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol_id: trialForm.protocol_id,
          target_name: trialForm.target_name.trim(),
          trials_total: trialForm.trials_total,
          trials_correct: trialForm.trials_correct,
          prompt_level: trialForm.prompt_level,
          notes: trialForm.notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro ao registrar trial')
        setSavingTrial(false); return
      }
      setTrialForm({ ...trialForm, target_name: '', trials_correct: 0, notes: '' })
      await fetchSession()
      setSavingTrial(false)
    } catch { setError('Falha de conexão'); setSavingTrial(false) }
  }

  const handleAddBehavior = async () => {
    if (!behaviorForm.behavior_type || !behaviorForm.antecedent || !behaviorForm.behavior || !behaviorForm.consequence) {
      setError('Preencha todos os campos ABC'); return
    }
    setSavingBehavior(true); setError(null)
    try {
      const res = await fetch(`/api/aba/sessions/${sessionId}/behaviors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          behavior_type: behaviorForm.behavior_type.trim(),
          antecedent: behaviorForm.antecedent.trim(),
          behavior: behaviorForm.behavior.trim(),
          consequence: behaviorForm.consequence.trim(),
          intensity: behaviorForm.intensity,
          duration_seconds: behaviorForm.duration_seconds ? parseInt(behaviorForm.duration_seconds) : null,
          location: behaviorForm.location.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro ao registrar comportamento')
        setSavingBehavior(false); return
      }
      setBehaviorForm({ behavior_type: '', antecedent: '', behavior: '', consequence: '', intensity: 'leve', duration_seconds: '', location: '' })
      await fetchSession()
      setSavingBehavior(false)
    } catch { setError('Falha de conexão'); setSavingBehavior(false) }
  }

  const handleCreateProtocol = async () => {
    if (!protocolForm.title || !protocolForm.objective) {
      setError('Título e objetivo são obrigatórios'); return
    }
    setSavingProtocol(true); setError(null)
    try {
      const res = await fetch('/api/aba/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learner_id: session?.learner_id,
          title: protocolForm.title.trim(),
          ebp_practice_id: protocolForm.ebp_practice_id,
          domain: protocolForm.domain.trim(),
          objective: protocolForm.objective.trim(),
          mastery_criteria_pct: protocolForm.mastery_criteria_pct,
          mastery_criteria_sessions: protocolForm.mastery_criteria_sessions,
          mastery_criteria_trials: protocolForm.mastery_criteria_trials,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro ao criar protocolo')
        setSavingProtocol(false); return
      }
      setShowProtocolModal(false)
      setProtocolForm({ title: '', ebp_practice_id: 7, domain: 'Aquisição', objective: '', mastery_criteria_pct: 80, mastery_criteria_sessions: 3, mastery_criteria_trials: 10 })
      setSavingProtocol(false)
      await fetchSession()
    } catch { setError('Falha de conexão'); setSavingProtocol(false) }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-pulse text-slate-400 text-sm">Carregando sessão...</div></div>
  if (!session) return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-slate-400 text-sm">{error || 'Sessão não encontrada'}</p></div>

  const isActive = session.status === 'in_progress'
  const isScheduled = session.status === 'scheduled'
  const isCompleted = session.status === 'completed'

  return (
    <>
      <div className="px-4 md:px-8 lg:px-12 xl:px-16 pt-5 md:pt-6">
        <Link href="/aba/sessoes" className="text-xs text-slate-400 hover:text-aba-500 transition-colors">&larr; Voltar para sessões</Link>

        <div className="mt-4 flex items-start justify-between mb-6">
          <div>
            <h1 className="text-lg font-normal text-slate-800 tracking-tight">{session.learner_name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(session.scheduled_at).toLocaleDateString('pt-BR')} às {new Date(session.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {session.location && ` · ${session.location}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[session.status] || 'bg-slate-100 text-slate-500'}`}>
              {statusLabels[session.status] || session.status}
            </span>
            {isScheduled && (
              <button onClick={() => handleAction('open')} disabled={actionLoading} className="px-4 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50">
                {actionLoading ? 'Iniciando...' : 'Iniciar Sessão'}
              </button>
            )}
            {isActive && (
              <button onClick={() => handleAction('close')} disabled={actionLoading} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                {actionLoading ? 'Finalizando...' : 'Finalizar Sessão'}
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 rounded-lg"><p className="text-xs text-red-500">{error}</p></div>}

        {isCompleted && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-green-700 font-medium">Sessão finalizada</p>
              <p className="text-xs text-green-600 mt-1">
                {targets.length} {targets.length === 1 ? 'trial registrado' : 'trials registrados'} · {behaviors.length} {behaviors.length === 1 ? 'comportamento' : 'comportamentos'}
                {session.started_at && session.ended_at && ` · Duração: ${Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000)} min`}
              </p>
            </div>
            <button onClick={openSummaryModal} className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-green-300 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              Enviar Resumo
            </button>
          </div>
        )}

        {isActive && protocols.length === 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 font-medium">Nenhum protocolo ativo</p>
              <p className="text-xs text-amber-600 mt-0.5">Crie um protocolo para registrar trials</p>
            </div>
            <button onClick={() => setShowProtocolModal(true)} className="px-4 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 transition-colors">
              + Protocolo
            </button>
          </div>
        )}

        {(isActive || isCompleted) && (
          <>
            <div className="flex gap-1 mb-6 border-b border-slate-200">
              <button onClick={() => setTab('trials')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'trials' ? 'border-aba-500 text-aba-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                Trials ({targets.length})
              </button>
              <button onClick={() => setTab('behaviors')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'behaviors' ? 'border-aba-500 text-aba-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                Comportamentos ({behaviors.length})
              </button>
            </div>

            {tab === 'trials' && (
              <div className="space-y-4">
                {isActive && protocols.length > 0 && (
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-medium text-slate-600">Registrar Trial (DTT)</h3>
                      <button onClick={() => setShowProtocolModal(true)} className="text-[11px] text-aba-500 hover:underline">+ Protocolo</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Protocolo *</label>
                        <select value={trialForm.protocol_id} onChange={e => setTrialForm({...trialForm, protocol_id: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                          <option value="">Selecione...</option>
                          {protocols.filter(p => p.status === 'active' || p.status === 'draft').map(p => (
                            <option key={p.id} value={p.id}>{p.title} ({p.domain})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Alvo *</label>
                        <input type="text" value={trialForm.target_name} onChange={e => setTrialForm({...trialForm, target_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Ex: Apontar para copo" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Total tentativas</label>
                        <input type="number" min="1" max="100" value={trialForm.trials_total} onChange={e => setTrialForm({...trialForm, trials_total: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Corretas</label>
                        <input type="number" min="0" max={trialForm.trials_total} value={trialForm.trials_correct} onChange={e => setTrialForm({...trialForm, trials_correct: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Nível de dica</label>
                        <select value={trialForm.prompt_level} onChange={e => setTrialForm({...trialForm, prompt_level: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                          {Object.entries(promptLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={handleAddTrial} disabled={savingTrial} className="px-4 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50">
                        {savingTrial ? 'Salvando...' : 'Registrar Trial'}
                      </button>
                    </div>
                  </div>
                )}

                {targets.length > 0 ? (
                  <div className="space-y-2">
                    {targets.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{t.target_name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{promptLabels[t.prompt_level] || t.prompt_level}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-aba-500">{t.trials_correct}/{t.trials_total}</p>
                          <p className="text-[11px] text-slate-400">{t.score_pct}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-8">Nenhum trial registrado</p>
                )}
              </div>
            )}

            {tab === 'behaviors' && (
              <div className="space-y-4">
                {isActive && (
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-medium text-slate-600">Registrar Comportamento (ABC)</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Tipo *</label>
                        <input type="text" value={behaviorForm.behavior_type} onChange={e => setBehaviorForm({...behaviorForm, behavior_type: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Ex: Autolesão, Estereotipia" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Intensidade *</label>
                        <select value={behaviorForm.intensity} onChange={e => setBehaviorForm({...behaviorForm, intensity: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                          {Object.entries(intensityLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Antecedente (A) *</label>
                      <input type="text" value={behaviorForm.antecedent} onChange={e => setBehaviorForm({...behaviorForm, antecedent: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="O que aconteceu antes" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Comportamento (B) *</label>
                      <input type="text" value={behaviorForm.behavior} onChange={e => setBehaviorForm({...behaviorForm, behavior: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="O que o aprendiz fez" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Consequência (C) *</label>
                      <input type="text" value={behaviorForm.consequence} onChange={e => setBehaviorForm({...behaviorForm, consequence: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="O que aconteceu depois" />
                    </div>
                    <div className="flex justify-end">
                      <button onClick={handleAddBehavior} disabled={savingBehavior} className="px-4 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50">
                        {savingBehavior ? 'Salvando...' : 'Registrar'}
                      </button>
                    </div>
                  </div>
                )}

                {behaviors.length > 0 ? (
                  <div className="space-y-2">
                    {behaviors.map(b => (
                      <div key={b.id} className="p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-800">{b.behavior_type}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${b.intensity === 'severa' ? 'bg-red-50 text-red-600' : b.intensity === 'alta' ? 'bg-orange-50 text-orange-600' : b.intensity === 'moderada' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
                            {intensityLabels[b.intensity] || b.intensity}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div><span className="text-slate-400">A:</span> <span className="text-slate-600">{b.antecedent}</span></div>
                          <div><span className="text-slate-400">B:</span> <span className="text-slate-600">{b.behavior}</span></div>
                          <div><span className="text-slate-400">C:</span> <span className="text-slate-600">{b.consequence}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-8">Nenhum comportamento registrado</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showProtocolModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-light text-slate-800">Novo Protocolo</h2>
                <button onClick={() => setShowProtocolModal(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
                <input type="text" value={protocolForm.title} onChange={e => setProtocolForm({...protocolForm, title: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Ex: Mando - Solicitar itens preferidos" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prática EBP</label>
                  <select value={protocolForm.ebp_practice_id} onChange={e => setProtocolForm({...protocolForm, ebp_practice_id: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                    {ebps.length > 0 ? ebps.map((e: any) => <option key={e.id} value={e.id}>{e.name_pt}</option>) : <option>Carregando...</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Domínio</label>
                  <input type="text" value={protocolForm.domain} onChange={e => setProtocolForm({...protocolForm, domain: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Ex: Comunicação" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Objetivo *</label>
                <textarea value={protocolForm.objective} onChange={e => setProtocolForm({...protocolForm, objective: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 resize-none" placeholder="Ex: O aprendiz solicitará itens preferidos usando mando vocal em 80% das tentativas" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Critério %</label>
                  <input type="number" min="50" max="100" value={protocolForm.mastery_criteria_pct} onChange={e => setProtocolForm({...protocolForm, mastery_criteria_pct: parseInt(e.target.value) || 80})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Sessões consecutivas</label>
                  <input type="number" min="1" max="10" value={protocolForm.mastery_criteria_sessions} onChange={e => setProtocolForm({...protocolForm, mastery_criteria_sessions: parseInt(e.target.value) || 3})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Min tentativas</label>
                  <input type="number" min="1" max="50" value={protocolForm.mastery_criteria_trials} onChange={e => setProtocolForm({...protocolForm, mastery_criteria_trials: parseInt(e.target.value) || 10})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowProtocolModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleCreateProtocol} disabled={savingProtocol} className="px-5 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50">
                {savingProtocol ? 'Criando...' : 'Criar Protocolo'}
              </button>
            </div>
          </div>
        </div>
      )}
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
                    {summaryGuardians.length > 0 && (
                      <select value={summaryEmail} onChange={e => setSummaryEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white mb-2">
                        {summaryGuardians.filter(g => g.email).map(g => (
                          <option key={g.id} value={g.email!}>{g.name} — {g.email}</option>
                        ))}
                        <option value="">Outro email...</option>
                      </select>
                    )}
                    {(summaryGuardians.length === 0 || summaryEmail === '') && (
                      <input type="email" value={summaryEmail} onChange={e => setSummaryEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="email@exemplo.com" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Resumo da sessão <span className="text-slate-400">(o que os pais verão)</span></label>
                    <textarea value={summaryText} onChange={e => setSummaryText(e.target.value)} rows={6} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 resize-none" placeholder={'Hoje trabalhamos em... ' + (session?.learner_name || '') + ' demonstrou... Os próximos passos são...'} />
                    <p className="text-[10px] text-slate-400 mt-1">Não inclua scores, percentuais ou notas clínicas. Este texto será enviado diretamente aos pais.</p>
                  </div>
                  {summaryError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{summaryError}</p>}
                  <div className="flex justify-end gap-3 pt-1">
                    <button onClick={() => setShowSummaryModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                    <button onClick={sendSummary} disabled={summarySaving} className="px-5 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 disabled:opacity-50 transition-colors">
                      {summarySaving ? 'Enviando...' : 'Aprovar e Enviar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
