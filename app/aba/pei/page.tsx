'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface PEIGoal {
  id: string
  title: string
  domain: string
  target_pct: number
  notes: string | null
}

interface LinkedProtocol {
  id: string
  title: string
  status: string
  pei_goal_id: string
}

interface PEIPlan {
  id: string
  learner_id: string
  learner_name: string
  title: string
  start_date: string
  end_date: string | null
  status: string
  goals: PEIGoal[]
  linked_protocols: LinkedProtocol[]
}

const statusLabels: Record<string,string> = { draft:'Rascunho', active:'Ativo', completed:'Concluído', archived:'Arquivado' }
const statusColors: Record<string,string> = { draft:'bg-slate-100 text-slate-500', active:'bg-green-50 text-green-600', completed:'bg-blue-50 text-blue-600', archived:'bg-slate-50 text-slate-400' }
const protocolStatusLabels: Record<string,string> = { draft:'Rascunho', active:'Ativo', mastered:'Dominado', generalization:'Generalização', maintained:'Mantido', archived:'Arquivado', suspended:'Suspenso', discontinued:'Descontinuado' }

export default function PEIPage() {
  const [plans, setPlans] = useState<PEIPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [learners, setLearners] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ learner_id: '', title: '', start_date: new Date().toISOString().split('T')[0] })
  const [goalInputs, setGoalInputs] = useState([{ title: '', domain: 'Comunicação', target_pct: 80, notes: '' }])

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/aba/pei')
      const data = await res.json()
      setPlans(data.plans || [])
      setLoading(false)
    } catch { setError('Falha ao carregar'); setLoading(false) }
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  useEffect(() => {
    if (showCreate && learners.length === 0) {
      fetch('/api/aba/learners').then(r => r.json()).then(d => setLearners(d.learners || [])).catch(() => {})
    }
  }, [showCreate, learners.length])

  const addGoalInput = () => {
    setGoalInputs([...goalInputs, { title: '', domain: 'Comunicação', target_pct: 80, notes: '' }])
  }

  const removeGoalInput = (i: number) => {
    if (goalInputs.length > 1) setGoalInputs(goalInputs.filter((_, idx) => idx !== i))
  }

  const updateGoalInput = (i: number, field: string, value: any) => {
    const updated = [...goalInputs]
    updated[i] = { ...updated[i], [field]: value }
    setGoalInputs(updated)
  }

  const handleCreate = async () => {
    if (!form.learner_id || !form.title) { setError('Preencha aprendiz e título'); return }
    const validGoals = goalInputs.filter(g => g.title.trim())
    if (validGoals.length === 0) { setError('Adicione pelo menos 1 meta'); return }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/aba/pei', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, goals: validGoals })
      })
      if (!res.ok) { const err = await res.json(); setError(err.error || 'Erro'); setCreating(false); return }
      setShowCreate(false)
      setForm({ learner_id: '', title: '', start_date: new Date().toISOString().split('T')[0] })
      setGoalInputs([{ title: '', domain: 'Comunicação', target_pct: 80, notes: '' }])
      await fetchPlans()
    } catch { setError('Falha de conexão') }
    setCreating(false)
  }

  const domainOptions = ['Comunicação', 'Social', 'Acadêmico', 'Autocuidado', 'Motor', 'Comportamento', 'Brincar', 'Cognitivo']

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-pulse text-slate-400 text-sm">Carregando...</div></div>

  return (
    <>
      <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
        <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
          <Link href="/aba" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Painel</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/aba/aprendizes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Aprendizes</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/aba/pei" className="px-3 py-1 text-sm font-medium text-aba-500">PEI</Link>
        </nav>
      </div>

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6">
          <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Plano Educacional Individualizado</h1>
          <p className="text-xs text-slate-300 font-light">Metas semestrais vinculadas aos protocolos ABA</p>
        </header>

        {error && <div className="mb-4 p-3 bg-red-50 rounded-lg"><p className="text-xs text-red-500">{error}</p></div>}

        <div className="max-w-4xl">
          <button onClick={() => setShowCreate(true)} className="w-full p-3 rounded-xl border-2 border-dashed border-aba-500/30 text-aba-500 text-sm font-medium hover:bg-aba-500/5 transition-colors mb-6">+ Novo PEI</button>

          {plans.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-aba-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 mb-1">Nenhum PEI cadastrado</p>
              <p className="text-xs text-slate-400">Crie um Plano Educacional Individualizado para começar</p>
            </div>
          ) : (
            <div className="space-y-6">
              {plans.map(plan => {
                const goalsMet = plan.goals.filter(g => {
                  const linked = plan.linked_protocols.filter(p => p.pei_goal_id === g.id)
                  return linked.some(p => ['mastered', 'generalization', 'maintained', 'archived'].includes(p.status))
                }).length
                return (
                  <div key={plan.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-medium text-slate-700">{plan.title}</h2>
                          <span className={'text-[10px] px-2 py-0.5 rounded-full ' + (statusColors[plan.status] || 'bg-slate-100 text-slate-500')}>{statusLabels[plan.status] || plan.status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{plan.learner_name} · Início: {new Date(plan.start_date).toLocaleDateString('pt-BR')}{plan.end_date ? ' · Fim: ' + new Date(plan.end_date).toLocaleDateString('pt-BR') : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-medium text-aba-500">{goalsMet}/{plan.goals.length}</p>
                        <p className="text-[10px] text-slate-400">metas atingidas</p>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                        <div className="bg-aba-500 h-2 rounded-full transition-all" style={{ width: plan.goals.length > 0 ? (goalsMet / plan.goals.length * 100) + '%' : '0%' }}></div>
                      </div>
                      <div className="space-y-3">
                        {plan.goals.map(goal => {
                          const linked = plan.linked_protocols.filter(p => p.pei_goal_id === goal.id)
                          const met = linked.some(p => ['mastered', 'generalization', 'maintained', 'archived'].includes(p.status))
                          return (
                            <div key={goal.id} className={'p-3 rounded-lg border ' + (met ? 'border-green-200 bg-green-50/50' : 'border-slate-200')}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-2">
                                  <div className={'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ' + (met ? 'bg-green-100' : 'bg-slate-100')}>
                                    {met ? <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : <span className="w-2 h-2 rounded-full bg-slate-300"></span>}
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-slate-700">{goal.title}</p>
                                    <p className="text-[10px] text-slate-400">{goal.domain} · Meta: {goal.target_pct}%</p>
                                    {goal.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{goal.notes}</p>}
                                  </div>
                                </div>
                              </div>
                              {linked.length > 0 && (
                                <div className="mt-2 ml-7 flex flex-wrap gap-1">
                                  {linked.map(p => (
                                    <span key={p.id} className="text-[9px] px-2 py-0.5 rounded-full bg-aba-500/10 text-aba-500">{p.title} · {protocolStatusLabels[p.status] || p.status}</span>
                                  ))}
                                </div>
                              )}
                              {linked.length === 0 && (
                                <p className="mt-1 ml-7 text-[10px] text-slate-300 italic">Nenhum protocolo vinculado</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-slate-800">Novo PEI</h2>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Aprendiz *</label>
                  <select value={form.learner_id} onChange={e => setForm({...form, learner_id: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500 bg-white">
                    <option value="">Selecione</option>
                    {learners.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Título do PEI *</label>
                  <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Ex: PEI Semestre 1 - 2026" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data de início *</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-aba-500" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-600">Metas *</label>
                    <button onClick={addGoalInput} className="text-[11px] text-aba-500 hover:text-aba-600 font-medium">+ Adicionar meta</button>
                  </div>
                  <div className="space-y-3">
                    {goalInputs.map((g, i) => (
                      <div key={i} className="p-3 border border-slate-200 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Meta {i + 1}</span>
                          {goalInputs.length > 1 && <button onClick={() => removeGoalInput(i)} className="text-[10px] text-red-400 hover:text-red-500">Remover</button>}
                        </div>
                        <input type="text" value={g.title} onChange={e => updateGoalInput(i, 'title', e.target.value)} placeholder="Descrição da meta" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-aba-500" />
                        <div className="flex gap-2">
                          <select value={g.domain} onChange={e => updateGoalInput(i, 'domain', e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-aba-500 bg-white">
                            {domainOptions.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <input type="number" min={50} max={100} value={g.target_pct} onChange={e => updateGoalInput(i, 'target_pct', parseInt(e.target.value) || 80)} className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-aba-500" placeholder="%" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Cancelar</button>
                <button onClick={handleCreate} disabled={creating} className="flex-1 px-4 py-2 rounded-lg bg-aba-500 text-white text-sm font-medium hover:bg-aba-500/90 disabled:opacity-50 transition-colors">
                  {creating ? 'Criando...' : 'Criar PEI'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
