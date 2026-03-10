'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Tooltip, { HelpTip } from '@/components/Tooltip'

interface Learner { id: string; name: string; birth_date: string; diagnosis: string; cid_code: string; cid_system: string | null; cid_label: string | null; support_level: number }
interface Protocol { id: string; title: string; domain: string; status: string; ebp_name: string; objective: string; mastery_criteria_pct: number; mastery_criteria_sessions: number; generalization_status: string; regression_count: number; activated_at: string|null; mastered_at: string|null; created_at: string; discontinuation_reason: string|null; pei_goal_id: string|null; pei_goal_title: string|null; pei_goal_domain: string|null; gen_cells_passed: number|null }
interface SessionSummary { id: string; scheduled_at: string; ended_at: string|null; status: string; location: string|null }
interface CSOPoint { session_date: string; cso_aba: number; sas: number; pis: number; bss: number; tcm: number }
interface EBPPractice { id: number; name: string; description: string }
interface LibraryProtocol { id: string; title: string; domain: string; objective: string; ebp_practice_name: string; ebp_practice_id: number | null; measurement_type: string; default_mastery_pct: number; default_mastery_sessions: number; default_mastery_trials: number; difficulty_level: number; tags: string[] }

const protocolStatusLabels: Record<string,string> = { draft:'Rascunho', active:'Ativo', mastered:'Dominado', generalization:'Generalização', mastered_validated:'Validado', maintenance:'Manutenção', maintained:'Mantido', archived:'Arquivado', suspended:'Suspenso', discontinued:'Descontinuado', regression:'Regressão' }
const protocolStatusColors: Record<string,string> = { draft:'bg-slate-100 text-slate-500', active:'bg-blue-50 text-blue-600', mastered:'bg-green-50 text-green-600', generalization:'bg-purple-50 text-purple-600', mastered_validated:'bg-teal-50 text-teal-600', maintenance:'bg-cyan-50 text-cyan-600', maintained:'bg-emerald-50 text-emerald-600', archived:'bg-slate-50 text-slate-400', suspended:'bg-amber-50 text-amber-600', discontinued:'bg-red-50 text-red-500', regression:'bg-orange-50 text-orange-600' }
const sessionStatusColors: Record<string,string> = { scheduled:'bg-blue-50 text-blue-600', in_progress:'bg-aba-500/10 text-aba-500', completed:'bg-green-50 text-green-600', cancelled:'bg-slate-100 text-slate-400' }
const sessionStatusLabels: Record<string,string> = { scheduled:'Agendada', in_progress:'Em andamento', completed:'Concluída', cancelled:'Cancelada' }
const validTransitions: Record<string,string[]> = { draft:['active','archived'], active:['mastered','suspended','discontinued'], mastered:['generalization','regression'], generalization:['mastered_validated','regression'], mastered_validated:['maintenance','regression'], maintenance:['maintained','regression'], maintained:['archived','regression'], regression:['active'], suspended:['active','discontinued'] }

const domainOptions = [
  { value: 'comunicacao', label: 'Comunicação' },
  { value: 'social', label: 'Social' },
  { value: 'academico', label: 'Acadêmico' },
  { value: 'autocuidado', label: 'Autocuidado' },
  { value: 'motor', label: 'Motor' },
  { value: 'comportamento', label: 'Comportamento' },
  { value: 'brincar', label: 'Brincar' },
  { value: 'cognitivo', label: 'Cognitivo' },
]

function age(b: string): string {
  return Math.floor((Date.now() - new Date(b).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) + 'a'
}

export default function LearnerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const learnerId = params.id as string
  const [learner, setLearner] = useState<Learner|null>(null)
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [csoHistory, setCsoHistory] = useState<CSOPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [tab, setTab] = useState<'protocols'|'sessions'|'cso'|'guardians'>('protocols')
  const [transitioning, setTransitioning] = useState<string|null>(null)
  const [showCreateProtocol, setShowCreateProtocol] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [guardians, setGuardians] = useState<{id:string;name:string;email:string|null;phone:string|null;relationship:string|null}[]>([])
  const [guardianLoading, setGuardianLoading] = useState(false)
  const [showGuardianModal, setShowGuardianModal] = useState(false)
  const [guardianForm, setGuardianForm] = useState({ name: '', email: '', phone: '', relationship: '' })
  const [guardianSaving, setGuardianSaving] = useState(false)
  const [linkingPeiProtocolId, setLinkingPeiProtocolId] = useState<string|null>(null)
  const [linkingPeiGoalId, setLinkingPeiGoalId] = useState('')
  const [linkingPeiSaving, setLinkingPeiSaving] = useState(false)
  const [probeStats, setProbeStats] = useState<Record<string, { total: number; completed: number; passed: number; nextDate: string | null }>>({})


  const fetchGuardians = async () => {
    setGuardianLoading(true)
    try {
      const res = await fetch('/api/aba/guardians?learner_id=' + learnerId)
      const d = await res.json()
      setGuardians(d.guardians || [])
    } catch {}
    setGuardianLoading(false)
  }

  const saveGuardian = async () => {
    if (!guardianForm.name) return
    setGuardianSaving(true)
    try {
      const res = await fetch('/api/aba/guardians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learner_id: learnerId, ...guardianForm })
      })
      if (res.ok) {
        setGuardianForm({ name: '', email: '', phone: '', relationship: '' })
        setShowGuardianModal(false)
        fetchGuardians()
      }
    } catch {}
    setGuardianSaving(false)
  }

  const removeGuardian = async (id: string) => {
    if (!confirm('Remover este responsável?')) return
    await fetch('/api/aba/guardians?id=' + id, { method: 'DELETE' })
    fetchGuardians()
  }

  const handleLinkPei = async (protocolId: string) => {
    setLinkingPeiSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/aba/protocols/' + protocolId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pei_goal_id: linkingPeiGoalId || null })
      })
      if (!res.ok) throw new Error('Erro ao vincular')
      setLinkingPeiProtocolId(null)
      setLinkingPeiGoalId('')
      fetchData()
    } catch { setError('Erro ao vincular protocolo ao PEI') }
    setLinkingPeiSaving(false)
  }

  const handleUnlinkPei = async (protocolId: string) => {
    setLinkingPeiSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/aba/protocols/' + protocolId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pei_goal_id: null })
      })
      if (!res.ok) throw new Error('Erro ao desvincular')
      fetchData()
    } catch { setError('Erro ao desvincular protocolo do PEI') }
    setLinkingPeiSaving(false)
  }

  const [inviteLoading, setInviteLoading] = useState(false)

  const generateInviteLink = async (guardian: { id: string; name: string; email: string | null }) => {
    setInviteLoading(true)
    try {
      const res = await fetch('/api/portal/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learner_id: learnerId, guardian_id: guardian.id, guardian_name: guardian.name, guardian_email: guardian.email })
      })
      const d = await res.json()
      if (!res.ok) { alert(d.error || 'Erro ao gerar link do portal'); setInviteLoading(false); return }
      if (d.link) {
        window.open(d.link, '_blank')
        setInviteLink(d.link)
      }
    } catch { alert('Erro de conexão ao gerar link') }
    setInviteLoading(false)
  }
  const [ebpPractices, setEbpPractices] = useState<EBPPractice[]>([])
  const [ebpLoading, setEbpLoading] = useState(false)
  const [ebpError, setEbpError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({ title: '', domain: 'comunicacao', ebp_practice_id: '', objective: '', mastery_criteria_pct: 80, pei_goal_id: '' })
  const [peiGoals, setPeiGoals] = useState<{id:string;title:string;domain:string}[]>([])
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryProtocols, setLibraryProtocols] = useState<LibraryProtocol[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryFilter, setLibraryFilter] = useState('')

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const [lRes, pRes, sRes] = await Promise.all([
        fetch('/api/aba/learners?id=' + learnerId),
        fetch('/api/aba/protocols?learner_id=' + learnerId),
        fetch('/api/aba/sessions?learner_id=' + learnerId)
      ])
      const lData = await lRes.json()
      const pData = await pRes.json()
      const sData = await sRes.json()
      setLearner(lData.learners?.find((l:any) => l.id === learnerId) || lData.learner || null)
      const protos = pData.protocols || []
      setProtocols(protos)
      setSessions(sData.sessions || [])
      try {
        const cRes = await fetch('/api/aba/learners/' + learnerId + '/cso-history')
        if (cRes.ok) { const cData = await cRes.json(); setCsoHistory(cData.history || []) }
      } catch {}
      // Fetch probe stats for maintenance/maintained protocols
      const maintenanceProtos = protos.filter((p: Protocol) => p.status === 'maintenance' || p.status === 'maintained')
      if (maintenanceProtos.length > 0) {
        try {
          const mRes = await fetch('/api/aba/maintenance?learner_id=' + learnerId)
          if (mRes.ok) {
            const mData = await mRes.json()
            const stats: Record<string, { total: number; completed: number; passed: number; nextDate: string | null }> = {}
            for (const proto of maintenanceProtos) {
              const probes = (mData.probes || []).filter((pr: any) => pr.protocol_id === proto.id)
              const completed = probes.filter((pr: any) => pr.status === 'completed').length
              const passed = probes.filter((pr: any) => pr.result === 'passed').length
              const nextPending = probes.find((pr: any) => pr.status === 'pending')
              stats[proto.id] = { total: probes.length, completed, passed, nextDate: nextPending?.scheduled_at || null }
            }
            setProbeStats(stats)
          }
        } catch {}
      }
      setLoading(false)
    } catch { setError('Falha ao carregar'); setLoading(false) }
  }, [learnerId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (showCreateProtocol && ebpPractices.length === 0 && !ebpLoading) {
      setEbpLoading(true)
      setEbpError(false)
      fetch('/api/aba/ebp-practices')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
        .then(d => { if (d.practices) setEbpPractices(d.practices) })
        .catch(() => setEbpError(true))
        .finally(() => setEbpLoading(false))
    }
    if ((showCreateProtocol || linkingPeiProtocolId) && peiGoals.length === 0) {
      fetch('/api/aba/pei?learner_id=' + learnerId).then(r => r.json()).then(d => {
        const goals: {id:string;title:string;domain:string}[] = []
        ;(d.plans || []).forEach((p: any) => { (p.goals || []).forEach((g: any) => goals.push({ id: g.id, title: g.title, domain: g.domain })) })
        setPeiGoals(goals)
      }).catch(() => {})
    }
  }, [showCreateProtocol, ebpPractices.length, ebpLoading, peiGoals.length, learnerId, linkingPeiProtocolId])

  // Carregar metas PEI ao abrir a página (para saber se mostra botão "Vincular ao PEI")
  const [peiLoaded, setPeiLoaded] = useState(false)
  useEffect(() => {
    if (!peiLoaded) {
      fetch('/api/aba/pei?learner_id=' + learnerId).then(r => r.json()).then(d => {
        const goals: {id:string;title:string;domain:string}[] = []
        ;(d.plans || []).forEach((p: any) => { (p.goals || []).forEach((g: any) => goals.push({ id: g.id, title: g.title, domain: g.domain })) })
        setPeiGoals(goals)
        setPeiLoaded(true)
      }).catch(() => setPeiLoaded(true))
    }
  }, [learnerId, peiLoaded])

  useEffect(() => {
    if (tab === 'guardians' && guardians.length === 0) { fetchGuardians() }
  }, [tab, guardians.length])

  const handleTransition = async (protocolId: string, newStatus: string) => {
    setTransitioning(protocolId)
    setError(null)
    const body: any = { status: newStatus }
    if (newStatus === 'discontinued') {
      const reason = window.prompt('Motivo da descontinuação (obrigatório):')
      if (!reason || !reason.trim()) { setTransitioning(null); return }
      body.discontinuation_reason = reason.trim()
    }
    try {
      const res = await fetch('/api/aba/protocols/' + protocolId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro na transição')
        setTransitioning(null)
        return
      }
      await fetchData()
    } catch { setError('Falha de conexão') }
    setTransitioning(null)
  }

  const handleCreateProtocol = async () => {
    if (!formData.title || !formData.ebp_practice_id || !formData.objective) { setError('Preencha todos os campos obrigatórios'); return }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/aba/protocols', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learner_id: learnerId, title: formData.title, domain: formData.domain, ebp_practice_id: parseInt(formData.ebp_practice_id), objective: formData.objective, mastery_criteria_pct: formData.mastery_criteria_pct, pei_goal_id: formData.pei_goal_id || null })
      })
      if (!res.ok) { const err = await res.json(); setError(err.error || 'Erro ao criar protocolo'); setCreating(false); return }
      setShowCreateProtocol(false)
      setFormData({ title: '', domain: 'comunicacao', ebp_practice_id: '', objective: '', mastery_criteria_pct: 80, pei_goal_id: '' })
      await fetchData()
    } catch { setError('Falha de conexão') }
    setCreating(false)
  }

  const openLibrary = async () => {
    setShowLibrary(true)
    if (libraryProtocols.length === 0) {
      setLibraryLoading(true)
      try {
        const res = await fetch('/api/aba/library')
        const d = await res.json()
        setLibraryProtocols(d.protocols || [])
      } catch {}
      setLibraryLoading(false)
    }
  }

  const selectFromLibrary = (proto: LibraryProtocol) => {
    // ebp_practice_id vem resolvido do servidor via JOIN
    setFormData({
      title: proto.title,
      domain: proto.domain,
      ebp_practice_id: proto.ebp_practice_id ? String(proto.ebp_practice_id) : '',
      objective: proto.objective,
      mastery_criteria_pct: proto.default_mastery_pct,
      pei_goal_id: ''
    })
    setShowLibrary(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-pulse text-slate-400 text-sm">Carregando...</div></div>
  if (!learner) return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-slate-400 text-sm">Aprendiz não encontrado</p></div>

  const activeP = protocols.filter(p => p.status === 'active').length
  const masteredP = protocols.filter(p => ['mastered','generalization','maintained','archived'].includes(p.status)).length
  const completedS = sessions.filter(s => s.status === 'completed').length
  const lastCSO = csoHistory.length > 0 ? csoHistory[csoHistory.length - 1] : null

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 pt-5 md:pt-6">
      <Link href="/aba/aprendizes" className="text-xs text-slate-400 hover:text-aba-500 transition-colors">&larr; Voltar para aprendizes</Link>
      <div className="mt-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-aba-500/10 flex items-center justify-center"><span className="text-xl font-medium text-aba-500">{learner.name.charAt(0)}</span></div>
          <div>
            <h1 className="text-xl font-normal text-slate-800 tracking-tight">{learner.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {age(learner.birth_date)}
              {learner.cid_code ? (
                <> · <span className="inline-flex items-center gap-1"><span className="bg-aba-500/10 text-aba-600 px-1.5 py-0.5 rounded text-[10px] font-medium">{learner.cid_system || 'CID-10'}</span>{learner.cid_code}{learner.cid_label && ` — ${learner.cid_label}`}</span></>
              ) : ' · Sem CID'}
              {' · Nível '}{learner.support_level}
              {learner.diagnosis && (' · ' + learner.diagnosis)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div className="relative p-3 rounded-xl bg-blue-50/50 text-center"><div className="absolute top-2 right-2"><HelpTip tip="aprendiz_protocolos_ativos" color="bg-blue-100/60 text-blue-500" /></div><p className="text-lg font-medium text-blue-600">{activeP}</p><p className="text-[11px] text-slate-400">Protocolos ativos</p></div>
          <div className="relative p-3 rounded-xl bg-green-50/50 text-center"><div className="absolute top-2 right-2"><HelpTip tip="aprendiz_dominados" color="bg-green-100/60 text-green-600" /></div><p className="text-lg font-medium text-green-600">{masteredP}</p><p className="text-[11px] text-slate-400">Dominados</p></div>
          <div className="p-3 rounded-xl bg-aba-500/5 text-center"><p className="text-lg font-medium text-aba-500">{completedS}</p><p className="text-[11px] text-slate-400">Sessões</p></div>
          <div className="relative p-3 rounded-xl bg-slate-50 text-center"><div className="absolute top-2 right-2"><HelpTip tip="aprendiz_cso_atual" color="bg-slate-200/60 text-slate-500" /></div><p className="text-lg font-medium text-slate-700">{lastCSO ? lastCSO.cso_aba : '—'}</p><p className="text-[11px] text-slate-400">CSO atual</p></div>
        </div>
      </div>
      {error && <div className="mb-4 p-3 bg-red-50 rounded-lg"><p className="text-xs text-red-500">{error}</p></div>}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {([['protocols','Protocolos (' + protocols.length + ')'],['sessions','Sessões (' + sessions.length + ')'],['cso','Evolução CSO'],['guardians','Responsáveis']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={'px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ' + (tab===k ? 'border-aba-500 text-aba-500' : 'border-transparent text-slate-400 hover:text-slate-600')}>{l}</button>
        ))}
      </div>

      {tab === 'protocols' && (
        <div className="space-y-3">

        <button onClick={() => setShowCreateProtocol(true)} className="w-full p-3 rounded-xl border-2 border-dashed border-aba-500/30 text-aba-500 text-sm font-medium hover:bg-aba-500/5 transition-colors">+ Novo Protocolo</button>
          {protocols.length === 0 ? <div className="text-center py-12"><div className="w-12 h-12 rounded-full bg-aba-500/10 flex items-center justify-center mx-auto mb-3"><svg className="w-6 h-6 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div><p className="text-sm text-slate-500 mb-1">Nenhum protocolo cadastrado</p><p className="text-xs text-slate-400">Clique em "+ Novo Protocolo" para começar</p></div> : protocols.map(p => (
            <div key={p.id} className="p-4 rounded-xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-medium text-slate-800">{p.title}</h3>
                    <span className={'px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ' + (protocolStatusColors[p.status] || 'bg-slate-100 text-slate-500')}>{protocolStatusLabels[p.status] || p.status}</span>
                    {p.status === 'generalization' && p.gen_cells_passed != null && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${p.gen_cells_passed >= 6 ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                        {p.gen_cells_passed >= 6 ? '✓' : ''} {p.gen_cells_passed}/6 células
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{p.domain} · {p.ebp_name} · <Tooltip tip="aprendiz_criterio_pct"><span>Critério: {p.mastery_criteria_pct}%</span></Tooltip></p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">{p.objective}</p>
              {p.pei_goal_id && p.pei_goal_title ? (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
                  <span className="text-[11px] text-indigo-600">Meta PEI: {p.pei_goal_title} ({p.pei_goal_domain})</span>
                  <button onClick={() => handleUnlinkPei(p.id)} disabled={linkingPeiSaving} className="ml-auto text-[10px] text-slate-400 hover:text-red-500 transition-colors" title="Desvincular">✕</button>
                </div>
              ) : linkingPeiProtocolId === p.id ? (
                <div className="flex items-center gap-2 mb-2">
                  <select value={linkingPeiGoalId} onChange={e => setLinkingPeiGoalId(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-aba-500 bg-white">
                    <option value="">Selecione uma meta</option>
                    {peiGoals.map(g => <option key={g.id} value={g.id}>{g.title} ({g.domain})</option>)}
                  </select>
                  <button onClick={() => handleLinkPei(p.id)} disabled={!linkingPeiGoalId || linkingPeiSaving} className="px-2 py-1.5 text-[11px] rounded-lg bg-aba-500 text-white hover:bg-aba-500/90 disabled:opacity-50 transition-colors">{linkingPeiSaving ? '...' : 'Vincular'}</button>
                  <button onClick={() => { setLinkingPeiProtocolId(null); setLinkingPeiGoalId('') }} className="px-2 py-1.5 text-[11px] rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 transition-colors">Cancelar</button>
                </div>
              ) : peiGoals.length > 0 ? (
                <button onClick={() => setLinkingPeiProtocolId(p.id)} className="inline-block mb-2 px-3 py-1 text-[11px] rounded-lg border border-indigo-200 text-indigo-500 hover:bg-indigo-50 transition-colors">🎯 Vincular ao PEI</button>
              ) : null}
              {p.regression_count > 0 && <p className="text-[11px] text-red-500 mb-2">⚠ {p.regression_count} regressão(ões)</p>}
              {p.status === 'discontinued' && p.discontinuation_reason && <p className="text-[11px] text-slate-400 italic mb-2">Motivo: {p.discontinuation_reason}</p>}
              {p.status === 'generalization' && (
                <Link href={'/aba/aprendizes/' + learnerId + '/generalizacao?protocol_id=' + p.id} className="inline-flex items-center gap-1.5 mb-2 px-3 py-1 text-[11px] rounded-lg border border-purple-300 text-purple-600 hover:bg-purple-50">
                  📊 Matriz 3×2
                  {p.gen_cells_passed != null && <span className="text-[10px] text-purple-400">({p.gen_cells_passed}/6)</span>}
                </Link>
              )}
              {(p.status === 'maintenance' || p.status === 'maintained') && (
                <div className="mb-2">
                  <Link href={'/aba/aprendizes/' + learnerId + '/manutencao?protocol_id=' + p.id} className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] rounded-lg border border-cyan-300 text-cyan-600 hover:bg-cyan-50">
                    🔄 Sondas
                    {probeStats[p.id] && (
                      <span className="text-[10px] text-cyan-400">
                        ({probeStats[p.id].completed}/{probeStats[p.id].total})
                      </span>
                    )}
                  </Link>
                  {probeStats[p.id]?.nextDate && (
                    <p className="text-[10px] text-slate-400 mt-1 ml-1">
                      Próxima sonda: {new Date(probeStats[p.id].nextDate!).toLocaleDateString('pt-BR')}
                      {(() => {
                        const days = Math.ceil((new Date(probeStats[p.id].nextDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        if (days < 0) return <span className="text-amber-500 font-medium"> (atrasada {Math.abs(days)}d)</span>
                        if (days === 0) return <span className="text-aba-500 font-medium"> (hoje)</span>
                        return <span> (em {days}d)</span>
                      })()}
                    </p>
                  )}
                </div>
              )}
              {validTransitions[p.status] && validTransitions[p.status].length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  {validTransitions[p.status].map(next => {
                    const tipMap: Record<string, any> = { mastered:'aprendiz_btn_dominado', suspended:'aprendiz_btn_suspenso', discontinued:'aprendiz_btn_descontinuado', generalization:'aprendiz_btn_generalizacao', regression:'aprendiz_btn_regressao', mastered_validated:'aprendiz_btn_validado', maintenance:'aprendiz_btn_manutencao', maintained:'aprendiz_btn_mantido', archived:'aprendiz_btn_arquivado' }
                    const btn = (
                      <button key={next} onClick={() => handleTransition(p.id, next)} disabled={transitioning===p.id}
                        className={'px-3 py-1 text-[11px] rounded-lg border transition-colors ' + (next==='discontinued'||next==='suspended' ? 'border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200' : 'border-aba-500/30 text-aba-500 hover:bg-aba-500/5')}>
                        {transitioning===p.id ? '...' : '→ ' + (protocolStatusLabels[next] || next)}
                      </button>
                    )
                    return tipMap[next] ? <Tooltip key={next} tip={tipMap[next]}>{btn}</Tooltip> : btn
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'sessions' && (
        <div className="space-y-2">
          {sessions.length === 0 ? <div className="text-center py-12"><div className="w-12 h-12 rounded-full bg-aba-500/10 flex items-center justify-center mx-auto mb-3"><svg className="w-6 h-6 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><p className="text-sm text-slate-500 mb-1">Nenhuma sessão registrada</p><p className="text-xs text-slate-400 mb-4">Agende a primeira sessão deste aprendiz</p><button onClick={() => router.push(`/aba/sessoes?novo=true&aprendiz=${learnerId}`)} className="inline-flex items-center gap-1.5 px-4 py-2 border border-aba-500/30 text-aba-500 text-sm font-medium rounded-lg hover:bg-aba-500/5 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Agendar Sessão</button></div> : sessions.map(s => (
            <Link key={s.id} href={'/aba/sessoes/' + s.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 hover:border-aba-500/30 transition-all cursor-pointer">
              <div>
                <p className="text-sm text-slate-800">{new Date(s.scheduled_at).toLocaleDateString('pt-BR')} às {new Date(s.scheduled_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
                {s.location && <p className="text-[11px] text-slate-400">{s.location}</p>}
              </div>
              <span className={'px-2 py-0.5 rounded-full text-[10px] font-medium ' + (sessionStatusColors[s.status]||'bg-slate-100 text-slate-500')}>{sessionStatusLabels[s.status]||s.status}</span>
            </Link>
          ))}
        </div>
      )}

      {tab === 'cso' && (
        <div>
          {csoHistory.length === 0 ? <p className="text-xs text-slate-400 text-center py-12">Sem dados de CSO. Complete sessões para gerar histórico.</p> : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200">
                <h3 className="text-xs font-medium text-slate-600 mb-3 flex items-center gap-1">Evolução CSO-ABA <HelpTip tip="cso_evolucao" /></h3>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="relative" style={{height: '180px', minWidth: Math.max(csoHistory.length * 80, 200) + 'px'}}>
                  <svg viewBox={'0 0 ' + Math.max(csoHistory.length * 80, 200) + ' 180'} className="w-full h-full">
                    {[0, 25, 50, 75, 100].map(v => (
                      <g key={v}>
                        <line x1="30" y1={160 - v * 1.5} x2={Math.max(csoHistory.length * 80, 200)} y2={160 - v * 1.5} stroke="#f1f5f9" strokeWidth="1" />
                        <text x="26" y={164 - v * 1.5} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
                      </g>
                    ))}
                    {csoHistory.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#C46A2F"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={csoHistory.map((c, i) => (40 + i * 70) + ',' + (160 - Number(c.cso_aba) * 1.5)).join(' ')}
                      />
                    )}
                    {csoHistory.map((c, i) => (
                      <g key={i}>
                        <circle cx={40 + i * 70} cy={160 - Number(c.cso_aba) * 1.5} r="5" fill="#C46A2F" stroke="white" strokeWidth="2" />
                        <text x={40 + i * 70} y={152 - Number(c.cso_aba) * 1.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#C46A2F">{c.cso_aba}</text>
                        <text x={40 + i * 70} y="175" textAnchor="middle" fontSize="8" fill="#94a3b8">{new Date(c.session_date).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}</text>
                      </g>
                    ))}
                  </svg>
                </div>
                </div>
              </div>
              <div className="space-y-2">
                {csoHistory.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                    <div className="min-w-0"><p className="text-sm text-slate-800">{new Date(c.session_date).toLocaleDateString('pt-BR')}</p><Tooltip tip="cso_dimensoes"><p className="text-[11px] text-slate-400 truncate cursor-help">SAS {c.sas} · PIS {c.pis} · BSS {c.bss} · TCM {c.tcm}</p></Tooltip></div>
                    <div className="text-right"><p className="text-lg font-medium text-aba-500">{c.cso_aba}</p><p className="text-[10px] text-slate-400">CSO-ABA</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {inviteLink && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setInviteLink(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-medium text-slate-800 mb-2">Link do Portal do Responsável</h3>
            <p className="text-xs text-slate-500 mb-4">Compartilhe este link com o responsável. Válido por 90 dias.</p>
            <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2 mb-4">
              <p className="text-xs text-slate-600 flex-1 break-all">{inviteLink}</p>
              <button onClick={() => navigator.clipboard.writeText(inviteLink)} className="flex-shrink-0 text-xs text-aba-500 font-medium hover:text-aba-600">Copiar</button>
            </div>
            <button onClick={() => setInviteLink(null)} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">Fechar</button>
          </div>
        </div>
      )}
            {tab === 'guardians' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-400">{guardians.length === 0 ? 'Nenhum responsável cadastrado' : `${guardians.length} responsável(is)`}</p>
            <button onClick={() => setShowGuardianModal(true)} className="px-3 py-1.5 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors">+ Adicionar</button>
          </div>
          {guardianLoading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-16"></div>)}</div>
          ) : guardians.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-aba-500/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              </div>
              <p className="text-sm text-slate-500 mb-1">Nenhum responsável cadastrado</p>
              <p className="text-xs text-slate-400">Adicione para enviar resumos por email</p>
            </div>
          ) : (
            <div className="space-y-3">
              {guardians.map(g => (
                <div key={g.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-aba-500/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-aba-500">{g.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{g.name}{g.relationship ? <span className="text-xs text-slate-400 ml-1">({g.relationship})</span> : null}</p>
                      {g.email && <p className="text-xs text-slate-400 truncate">{g.email}</p>}
                      {g.phone && <p className="text-xs text-slate-400">{g.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button onClick={() => generateInviteLink(g)} disabled={inviteLoading} className="text-xs text-aba-500 hover:text-aba-600 px-2 py-1 rounded border border-aba-500/20 hover:bg-aba-500/5 transition-colors">
                      {inviteLoading ? '...' : 'Portal'}
                    </button>
                    <button onClick={() => removeGuardian(g.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Remover</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showGuardianModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowGuardianModal(false)}>
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-medium text-slate-800 mb-4">Adicionar Responsável</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                    <input type="text" value={guardianForm.name} onChange={e => setGuardianForm({...guardianForm, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Nome completo" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input type="email" value={guardianForm.email} onChange={e => setGuardianForm({...guardianForm, email: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Telefone / WhatsApp</label>
                    <input type="text" value={guardianForm.phone} onChange={e => setGuardianForm({...guardianForm, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="(81) 99999-9999" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Parentesco</label>
                    <select value={guardianForm.relationship} onChange={e => setGuardianForm({...guardianForm, relationship: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                      <option value="">Selecione...</option>
                      <option value="Mãe">Mãe</option>
                      <option value="Pai">Pai</option>
                      <option value="Avó">Avó</option>
                      <option value="Avô">Avô</option>
                      <option value="Tutor legal">Tutor legal</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-5">
                  <button onClick={() => setShowGuardianModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                  <button onClick={saveGuardian} disabled={guardianSaving || !guardianForm.name} className="px-5 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 disabled:opacity-50 transition-colors">
                    {guardianSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateProtocol && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateProtocol(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-slate-800">Novo Protocolo</h2>
                <button onClick={() => setShowCreateProtocol(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
              </div>
              <button onClick={openLibrary} className="w-full mb-5 p-3 rounded-xl border-2 border-dashed border-aba-500/30 text-aba-500 text-sm font-medium hover:bg-aba-500/5 transition-colors flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                Usar da Biblioteca
              </button>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Título do protocolo *</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Mando com apoio visual" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Domínio clínico *</label>
                  <select value={formData.domain} onChange={e => setFormData({...formData, domain: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500 bg-white">
                    {domainOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Técnica Validada (SBNI/FPG) *</label>
                  {ebpError ? (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-red-500">Erro ao carregar práticas.</p>
                      <button type="button" onClick={() => { setEbpError(false); setEbpPractices([]) }} className="text-xs text-aba-500 underline hover:text-aba-600">Tentar novamente</button>
                    </div>
                  ) : (
                    <select value={formData.ebp_practice_id} onChange={e => setFormData({...formData, ebp_practice_id: e.target.value})} disabled={ebpLoading} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500 bg-white disabled:opacity-50">
                      <option value="">{ebpLoading ? 'Carregando práticas...' : 'Selecione uma prática'}</option>
                      {ebpPractices.map(p => <option key={p.id} value={String(p.id)}>{p.id}. {p.name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Objetivo operacional *</label>
                  <textarea value={formData.objective} onChange={e => setFormData({...formData, objective: e.target.value})} rows={3} placeholder="Ex: O aprendiz solicitará itens desejados usando frases de 2+ palavras em 80% das oportunidades por 3 sessões consecutivas." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Critério de domínio (%)</label>
                  <input type="number" min={50} max={100} value={formData.mastery_criteria_pct} onChange={e => setFormData({...formData, mastery_criteria_pct: parseInt(e.target.value) || 80})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500" />
                  <p className="text-[11px] text-slate-400 mt-1">Padrão: 80%. Mínimo recomendado: 70%.</p>
                </div>
                {peiGoals.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Vincular a meta do PEI <span className="text-slate-400">(opcional)</span></label>
                    <select value={formData.pei_goal_id} onChange={e => setFormData({...formData, pei_goal_id: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500 bg-white">
                      <option value="">Sem vínculo</option>
                      {peiGoals.map(g => <option key={g.id} value={g.id}>{g.title} ({g.domain})</option>)}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">Vincula este protocolo a uma meta do PEI do aprendiz.</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => setShowCreateProtocol(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Cancelar</button>
                <button onClick={handleCreateProtocol} disabled={creating} className="flex-1 px-4 py-2 rounded-lg bg-aba-500 text-white text-sm font-medium hover:bg-aba-500/90 disabled:opacity-50 transition-colors">
                  {creating ? 'Criando...' : 'Criar protocolo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLibrary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowLibrary(false)}>
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-medium text-slate-800">Biblioteca de Protocolos</h3>
                <button onClick={() => setShowLibrary(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
              </div>
              <select value={libraryFilter} onChange={e => setLibraryFilter(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500 bg-white">
                <option value="">Todos os domínios</option>
                {domainOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {libraryLoading ? (
                <div className="text-center py-8"><div className="animate-pulse text-slate-400 text-sm">Carregando biblioteca...</div></div>
              ) : (libraryProtocols.filter(p => !libraryFilter || p.domain === libraryFilter)).length === 0 ? (
                <div className="text-center py-8"><p className="text-slate-400 text-sm">Nenhum protocolo encontrado.</p></div>
              ) : (
                (libraryProtocols.filter(p => !libraryFilter || p.domain === libraryFilter)).map(proto => (
                  <button key={proto.id} onClick={() => selectFromLibrary(proto)} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-aba-500/40 hover:bg-aba-500/5 transition-all group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 group-hover:text-aba-600">{proto.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{domainOptions.find(d => d.value === proto.domain)?.label || proto.domain} · {proto.ebp_practice_name} · Nível {proto.difficulty_level}</p>
                      </div>
                      <span className="text-[10px] text-aba-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">Usar &rarr;</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{proto.objective}</p>
                    {proto.tags && proto.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {proto.tags.slice(0, 4).map((tag, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-400">{tag}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
