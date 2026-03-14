'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// =====================================================
// AXIS TDAH — Página Plano TDAH
// Equivalente ao PEI do ABA (app/aba/pei/page.tsx)
//
// Diferenças vs PEI:
//   - 14 domínios clínicos TDAH (Bible §13) vs 8 domínios ABA
//   - goal_description + target_criteria vs title + target_pct
//   - progress % por meta vs linked_protocols status
//   - Cor teal (#0d7377) vs coral ABA
//   - Paciente vs Aprendiz
// =====================================================

const TDAH_COLOR = '#0d7377'

interface PlanGoal {
  id: string
  domain: string
  goal_description: string
  target_criteria: string | null
  status: string
  progress: number | null
}

interface TDAHPlan {
  id: string
  patient_id: string
  patient_name: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: string
  goals: PlanGoal[]
  active_protocols: { id: string; title: string; status: string; block: string }[]
}

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', active: 'Ativo', completed: 'Concluído', archived: 'Arquivado',
}
const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  active: 'bg-emerald-50 text-emerald-600',
  completed: 'bg-blue-50 text-blue-600',
  archived: 'bg-slate-50 text-slate-400',
}
const goalStatusLabels: Record<string, string> = {
  active: 'Ativa', achieved: 'Atingida', paused: 'Pausada', discontinued: 'Descontinuada',
}
const goalStatusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-600',
  achieved: 'bg-blue-50 text-blue-600',
  paused: 'bg-amber-50 text-amber-600',
  discontinued: 'bg-red-50 text-red-500',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['completed', 'archived'],
  completed: ['archived'],
  archived: [],
}

const DOMAIN_OPTIONS = [
  { value: 'atencao_sustentada', label: 'Atenção sustentada' },
  { value: 'inicio_tarefa', label: 'Início de tarefa' },
  { value: 'permanencia_tarefa', label: 'Permanência na tarefa' },
  { value: 'conclusao_tarefa', label: 'Conclusão de tarefa' },
  { value: 'seguimento_instrucao', label: 'Seguimento de instrução' },
  { value: 'rotina_domestica', label: 'Rotina doméstica' },
  { value: 'rotina_escolar', label: 'Rotina escolar' },
  { value: 'controle_inibitorio', label: 'Controle inibitório' },
  { value: 'espera_turno', label: 'Espera de turno' },
  { value: 'organizacao', label: 'Organização' },
  { value: 'autorregulacao', label: 'Autorregulação' },
  { value: 'transicoes', label: 'Transições' },
  { value: 'integracao_contextual', label: 'Integração contextual' },
  { value: 'audhd', label: 'AuDHD' },
]

const domainLabel = (v: string) => DOMAIN_OPTIONS.find(d => d.value === v)?.label || v

export default function PlanosTDAHPage() {
  const [plans, setPlans] = useState<TDAHPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [patients, setPatients] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [form, setForm] = useState({
    patient_id: '', title: '', description: '',
    start_date: new Date().toISOString().split('T')[0],
  })
  const [goalInputs, setGoalInputs] = useState([
    { goal_description: '', domain: 'atencao_sustentada', target_criteria: '' },
  ])

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/tdah/plans')
      const data = await res.json()
      setPlans(data.plans || [])
      setLoading(false)
    } catch {
      setError('Falha ao carregar')
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  useEffect(() => {
    if (showCreate && patients.length === 0) {
      fetch('/api/tdah/patients')
        .then(r => r.json())
        .then(d => setPatients(d.patients || []))
        .catch(() => {})
    }
  }, [showCreate, patients.length])

  const addGoalInput = () => {
    setGoalInputs([...goalInputs, { goal_description: '', domain: 'atencao_sustentada', target_criteria: '' }])
  }

  const removeGoalInput = (i: number) => {
    if (goalInputs.length > 1) setGoalInputs(goalInputs.filter((_, idx) => idx !== i))
  }

  const updateGoalInput = (i: number, field: string, value: string) => {
    const updated = [...goalInputs]
    updated[i] = { ...updated[i], [field]: value }
    setGoalInputs(updated)
  }

  const handleCreate = async () => {
    if (!form.patient_id || !form.title) {
      setError('Preencha paciente e título')
      return
    }
    const validGoals = goalInputs.filter(g => g.goal_description.trim())
    if (validGoals.length === 0) {
      setError('Adicione pelo menos 1 meta')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/tdah/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, goals: validGoals }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro')
        setCreating(false)
        return
      }
      setShowCreate(false)
      setForm({
        patient_id: '', title: '', description: '',
        start_date: new Date().toISOString().split('T')[0],
      })
      setGoalInputs([{ goal_description: '', domain: 'atencao_sustentada', target_criteria: '' }])
      await fetchPlans()
    } catch {
      setError('Falha de conexão')
    }
    setCreating(false)
  }

  const handleTransition = async (planId: string, newStatus: string) => {
    setTransitioning(planId)
    setError(null)
    try {
      const res = await fetch(`/api/tdah/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro')
        setTransitioning(null)
        return
      }
      await fetchPlans()
    } catch {
      setError('Falha de conexão')
    }
    setTransitioning(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
        <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
          <Link href="/tdah/dashboard" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
            Dashboard
          </Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/tdah/pacientes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
            Pacientes
          </Link>
          <span className="text-slate-300 text-xs">·</span>
          <span className="px-3 py-1 text-sm font-medium" style={{ color: TDAH_COLOR }}>
            Plano TDAH
          </span>
        </nav>
      </div>

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6">
          <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">
            Plano TDAH
          </h1>
          <p className="text-xs text-slate-300 font-light">
            Metas clínicas por domínio, vinculadas aos protocolos do paciente
          </p>
        </header>

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}

        <div className="max-w-4xl">
          {/* Botão criar */}
          <button
            onClick={() => setShowCreate(true)}
            className="w-full p-3 rounded-xl border-2 border-dashed text-sm font-medium transition-colors mb-6"
            style={{ borderColor: `${TDAH_COLOR}40`, color: TDAH_COLOR }}
          >
            + Novo Plano TDAH
          </button>

          {/* Lista vazia */}
          {plans.length === 0 ? (
            <div className="text-center py-16">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${TDAH_COLOR}15` }}
              >
                <svg className="w-8 h-8" style={{ color: TDAH_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 mb-1">Nenhum plano cadastrado</p>
              <p className="text-xs text-slate-400">Crie um Plano TDAH para definir metas clínicas</p>
            </div>
          ) : (
            <div className="space-y-6">
              {plans.map(plan => {
                const goalsAchieved = plan.goals.filter(g => g.status === 'achieved').length
                const avgProgress = plan.goals.length > 0
                  ? Math.round(plan.goals.reduce((sum, g) => sum + (g.progress || 0), 0) / plan.goals.length)
                  : 0

                return (
                  <div key={plan.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-medium text-slate-700">{plan.title}</h2>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[plan.status] || 'bg-slate-100 text-slate-500'}`}>
                            {statusLabels[plan.status] || plan.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {plan.patient_name}
                          {plan.start_date && ` · Início: ${new Date(plan.start_date).toLocaleDateString('pt-BR')}`}
                          {plan.end_date && ` · Fim: ${new Date(plan.end_date).toLocaleDateString('pt-BR')}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Transições */}
                        {VALID_TRANSITIONS[plan.status]?.length > 0 && (
                          <div className="flex gap-1">
                            {VALID_TRANSITIONS[plan.status].map(next => (
                              <button
                                key={next}
                                onClick={() => handleTransition(plan.id, next)}
                                disabled={transitioning === plan.id}
                                className={`px-2 py-1 text-[10px] rounded-lg border transition-colors ${
                                  next === 'archived'
                                    ? 'border-slate-200 text-slate-400 hover:text-slate-600'
                                    : 'hover:opacity-80'
                                }`}
                                style={next !== 'archived' ? { borderColor: `${TDAH_COLOR}40`, color: TDAH_COLOR } : undefined}
                              >
                                {transitioning === plan.id ? '...' : `→ ${statusLabels[next] || next}`}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Contadores */}
                        <div className="text-right">
                          <p className="text-lg font-medium" style={{ color: TDAH_COLOR }}>
                            {goalsAchieved}/{plan.goals.length}
                          </p>
                          <p className="text-[10px] text-slate-400">metas atingidas</p>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5">
                      {/* Progress bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${avgProgress}%`,
                            backgroundColor: TDAH_COLOR,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mb-4">Progresso médio: {avgProgress}%</p>

                      {/* Goals */}
                      <div className="space-y-3">
                        {plan.goals.map(goal => (
                          <div
                            key={goal.id}
                            className={`p-3 rounded-lg border ${
                              goal.status === 'achieved'
                                ? 'border-blue-200 bg-blue-50/50'
                                : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  goal.status === 'achieved' ? 'bg-blue-100' : 'bg-slate-100'
                                }`}>
                                  {goal.status === 'achieved' ? (
                                    <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-700">{goal.goal_description}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-400">{domainLabel(goal.domain)}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${goalStatusColors[goal.status] || ''}`}>
                                      {goalStatusLabels[goal.status] || goal.status}
                                    </span>
                                  </div>
                                  {goal.target_criteria && (
                                    <p className="text-[10px] text-slate-400 italic mt-0.5">Critério: {goal.target_criteria}</p>
                                  )}
                                </div>
                              </div>
                              {/* Progress */}
                              {goal.progress != null && (
                                <span className="text-xs font-medium" style={{ color: TDAH_COLOR }}>
                                  {goal.progress}%
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Protocolos ativos */}
                      {plan.active_protocols.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          <p className="text-[10px] text-slate-400 mb-2">Protocolos ativos do paciente:</p>
                          <div className="flex flex-wrap gap-1">
                            {plan.active_protocols.map(p => (
                              <span
                                key={p.id}
                                className="text-[9px] px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${TDAH_COLOR}15`, color: TDAH_COLOR }}
                              >
                                {p.title} · {p.block}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar Plano */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-slate-800">Novo Plano TDAH</h2>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                {/* Paciente */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Paciente *</label>
                  <select
                    value={form.patient_id}
                    onChange={e => setForm({ ...form, patient_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none bg-white"
                    style={{ borderColor: form.patient_id ? TDAH_COLOR : undefined }}
                  >
                    <option value="">Selecione</option>
                    {patients.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Título */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Título do Plano *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Ex: Plano TDAH - Semestre 1/2026"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none"
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Objetivos gerais do plano..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none resize-none"
                  />
                </div>

                {/* Data */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data de início</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none"
                  />
                </div>

                {/* Metas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-600">Metas clínicas *</label>
                    <button
                      onClick={addGoalInput}
                      className="text-[11px] font-medium"
                      style={{ color: TDAH_COLOR }}
                    >
                      + Adicionar meta
                    </button>
                  </div>
                  <div className="space-y-3">
                    {goalInputs.map((g, i) => (
                      <div key={i} className="p-3 border border-slate-200 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Meta {i + 1}</span>
                          {goalInputs.length > 1 && (
                            <button onClick={() => removeGoalInput(i)} className="text-[10px] text-red-400 hover:text-red-500">
                              Remover
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={g.goal_description}
                          onChange={e => updateGoalInput(i, 'goal_description', e.target.value)}
                          placeholder="Descrição da meta clínica"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none"
                        />
                        <select
                          value={g.domain}
                          onChange={e => updateGoalInput(i, 'domain', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white"
                        >
                          {DOMAIN_OPTIONS.map(d => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={g.target_criteria}
                          onChange={e => updateGoalInput(i, 'target_criteria', e.target.value)}
                          placeholder="Critério de sucesso (ex: 80% em 3 sessões consecutivas)"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors hover:opacity-90"
                  style={{ backgroundColor: TDAH_COLOR }}
                >
                  {creating ? 'Criando...' : 'Criar Plano'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
