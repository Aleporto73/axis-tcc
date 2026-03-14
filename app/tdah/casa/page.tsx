'use client'

import { useState, useEffect, useCallback } from 'react'

// =====================================================
// AXIS TDAH — Módulo Casa
// Rotinas domésticas + Economia de fichas + Treino parental
// Bible §18: Instrução curta, sequência clara, reforço previsível
// =====================================================

const TDAH_COLOR = '#0d7377'

const ROUTINE_TYPES = [
  { value: 'morning', label: 'Manhã', emoji: '🌅' },
  { value: 'afternoon', label: 'Tarde', emoji: '☀️' },
  { value: 'evening', label: 'Noite', emoji: '🌙' },
  { value: 'homework', label: 'Dever de casa', emoji: '📚' },
  { value: 'school_prep', label: 'Preparação escolar', emoji: '🎒' },
  { value: 'other', label: 'Outra', emoji: '📋' },
]

const TOKEN_TYPES = [
  { value: 'star', label: 'Estrela', symbol: '⭐' },
  { value: 'point', label: 'Ponto', symbol: '🔵' },
  { value: 'sticker', label: 'Adesivo', symbol: '🏷️' },
  { value: 'coin', label: 'Moeda', symbol: '🪙' },
]

interface Patient { id: string; name: string }
interface Routine {
  id: string; patient_id: string; patient_name: string; routine_type: string
  routine_name: string; steps_json: any[] | null; reinforcement_plan: string | null
  status: string; created_at: string
}
interface Economy {
  id: string; patient_id: string; patient_name: string; system_name: string
  token_type: string; token_label: string | null; target_behaviors: any[]
  reinforcers: any[]; status: string; current_balance: number
  total_transactions: number; total_earned: number; total_spent: number
}

export default function CasaPage() {
  const [tab, setTab] = useState<'rotinas' | 'fichas'>('rotinas')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState('')
  const [routines, setRoutines] = useState<Routine[]>([])
  const [economies, setEconomies] = useState<Economy[]>([])
  const [loading, setLoading] = useState(true)

  // Routine modal
  const [showRoutineModal, setShowRoutineModal] = useState(false)
  const [savingRoutine, setSavingRoutine] = useState(false)
  const [routineForm, setRoutineForm] = useState({
    routine_type: 'morning', routine_name: '', reinforcement_plan: '',
    steps: [{ description: '', visual_cue: '' }],
  })

  // Economy modal
  const [showEconomyModal, setShowEconomyModal] = useState(false)
  const [savingEconomy, setSavingEconomy] = useState(false)
  const [economyForm, setEconomyForm] = useState({
    system_name: 'Economia de Fichas', token_type: 'star', token_label: '',
    target_behaviors: [{ behavior: '', tokens_earned: 1, description: '' }],
    reinforcers: [{ reward: '', tokens_required: 5, category: '' }],
  })

  // Transaction modal
  const [showTxModal, setShowTxModal] = useState<Economy | null>(null)
  const [txForm, setTxForm] = useState({ type: 'earn' as string, amount: 1, reason: '', behavior_index: -1, reinforcer_index: -1 })
  const [savingTx, setSavingTx] = useState(false)

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch('/api/tdah/patients')
      if (res.ok) setPatients((await res.json()).patients || [])
    } catch (e) { console.error(e) }
  }, [])

  const fetchRoutines = useCallback(async () => {
    if (!selectedPatient) { setRoutines([]); return }
    try {
      const res = await fetch(`/api/tdah/routines?patient_id=${selectedPatient}`)
      if (res.ok) setRoutines((await res.json()).routines || [])
    } catch (e) { console.error(e) }
  }, [selectedPatient])

  const fetchEconomies = useCallback(async () => {
    if (!selectedPatient) { setEconomies([]); return }
    try {
      const res = await fetch(`/api/tdah/token-economy?patient_id=${selectedPatient}`)
      if (res.ok) setEconomies((await res.json()).economies || [])
    } catch (e) { console.error(e) }
  }, [selectedPatient])

  useEffect(() => { fetchPatients().finally(() => setLoading(false)) }, [fetchPatients])
  useEffect(() => { fetchRoutines(); fetchEconomies() }, [fetchRoutines, fetchEconomies])

  const handleCreateRoutine = async () => {
    if (!selectedPatient || !routineForm.routine_name) return
    setSavingRoutine(true)
    try {
      const res = await fetch('/api/tdah/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient,
          routine_type: routineForm.routine_type,
          routine_name: routineForm.routine_name,
          steps: routineForm.steps.filter(s => s.description),
          reinforcement_plan: routineForm.reinforcement_plan || undefined,
        }),
      })
      if (res.ok) {
        setShowRoutineModal(false)
        setRoutineForm({ routine_type: 'morning', routine_name: '', reinforcement_plan: '', steps: [{ description: '', visual_cue: '' }] })
        await fetchRoutines()
      }
    } catch (e) { console.error(e) }
    setSavingRoutine(false)
  }

  const handleCreateEconomy = async () => {
    if (!selectedPatient) return
    setSavingEconomy(true)
    try {
      const res = await fetch('/api/tdah/token-economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient,
          system_name: economyForm.system_name,
          token_type: economyForm.token_type,
          token_label: economyForm.token_label || undefined,
          target_behaviors: economyForm.target_behaviors.filter(b => b.behavior),
          reinforcers: economyForm.reinforcers.filter(r => r.reward),
        }),
      })
      if (res.ok) {
        setShowEconomyModal(false)
        setEconomyForm({ system_name: 'Economia de Fichas', token_type: 'star', token_label: '', target_behaviors: [{ behavior: '', tokens_earned: 1, description: '' }], reinforcers: [{ reward: '', tokens_required: 5, category: '' }] })
        await fetchEconomies()
      }
    } catch (e) { console.error(e) }
    setSavingEconomy(false)
  }

  const handleTransaction = async () => {
    if (!showTxModal) return
    setSavingTx(true)
    try {
      const res = await fetch(`/api/tdah/token-economy/${showTxModal.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: txForm.type,
          amount: txForm.amount,
          reason: txForm.reason || undefined,
          behavior_index: txForm.behavior_index >= 0 ? txForm.behavior_index : undefined,
          reinforcer_index: txForm.reinforcer_index >= 0 ? txForm.reinforcer_index : undefined,
        }),
      })
      if (res.ok) {
        setShowTxModal(null)
        setTxForm({ type: 'earn', amount: 1, reason: '', behavior_index: -1, reinforcer_index: -1 })
        await fetchEconomies()
      } else {
        const err = await res.json()
        alert(err.error || 'Erro')
      }
    } catch (e) { console.error(e) }
    setSavingTx(false)
  }

  const handleRoutineStatus = async (routineId: string, status: string) => {
    try {
      await fetch(`/api/tdah/routines/${routineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await fetchRoutines()
    } catch (e) { console.error(e) }
  }

  const getTokenSymbol = (type: string) => TOKEN_TYPES.find(t => t.value === type)?.symbol || '⭐'

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${TDAH_COLOR}40`, borderTopColor: 'transparent' }} />
    </div>
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-5xl mx-auto px-4 py-8 md:pl-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Módulo Casa</h1>
            <p className="text-sm text-slate-500 mt-1">Rotinas domésticas, treino parental e economia de fichas</p>
          </div>
        </div>

        {/* Patient selector */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 mb-6">
          <label className="block text-xs font-medium text-slate-600 mb-1">Paciente</label>
          <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Selecionar paciente...</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {selectedPatient && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {[
                { key: 'rotinas' as const, label: 'Rotinas', count: routines.filter(r => r.status === 'active').length },
                { key: 'fichas' as const, label: 'Economia de Fichas', count: economies.filter(e => e.status === 'active').length },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'text-white' : 'text-slate-500 bg-white border border-slate-200'}`}
                  style={tab === t.key ? { backgroundColor: TDAH_COLOR } : {}}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            {/* ── TAB: ROTINAS ── */}
            {tab === 'rotinas' && (
              <div>
                <div className="flex justify-end mb-4">
                  <button onClick={() => setShowRoutineModal(true)} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: TDAH_COLOR }}>
                    + Nova Rotina
                  </button>
                </div>

                {routines.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
                    <p className="text-sm text-slate-400">Nenhuma rotina cadastrada para este paciente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {routines.map(r => {
                      const typeInfo = ROUTINE_TYPES.find(t => t.value === r.routine_type)
                      const steps = r.steps_json || []
                      return (
                        <div key={r.id} className={`bg-white rounded-xl border p-4 ${r.status !== 'active' ? 'opacity-60' : 'border-slate-100'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{typeInfo?.emoji || '📋'}</span>
                                <h3 className="text-sm font-medium text-slate-800">{r.routine_name}</h3>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{typeInfo?.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${r.status === 'active' ? 'bg-emerald-50 text-emerald-600' : r.status === 'paused' ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
                                  {r.status === 'active' ? 'Ativa' : r.status === 'paused' ? 'Pausada' : r.status === 'completed' ? 'Concluída' : 'Arquivada'}
                                </span>
                              </div>
                              {/* Steps */}
                              {steps.length > 0 && (
                                <div className="ml-8 mt-2 space-y-1">
                                  {steps.map((s: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: TDAH_COLOR }}>{s.order || i + 1}</span>
                                      <span className="text-slate-600">{s.description}</span>
                                      {s.visual_cue && <span className="text-slate-400 italic">({s.visual_cue})</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {r.reinforcement_plan && (
                                <p className="ml-8 mt-2 text-xs text-emerald-600 italic">Reforço: {r.reinforcement_plan}</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {r.status === 'active' && (
                                <button onClick={() => handleRoutineStatus(r.id, 'paused')} className="px-2 py-1 text-[10px] rounded border border-amber-200 text-amber-500 hover:bg-amber-50">Pausar</button>
                              )}
                              {r.status === 'paused' && (
                                <button onClick={() => handleRoutineStatus(r.id, 'active')} className="px-2 py-1 text-[10px] rounded border border-emerald-200 text-emerald-500 hover:bg-emerald-50">Reativar</button>
                              )}
                              {(r.status === 'active' || r.status === 'paused') && (
                                <button onClick={() => handleRoutineStatus(r.id, 'completed')} className="px-2 py-1 text-[10px] rounded border border-slate-200 text-slate-500 hover:bg-slate-50">Concluir</button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: FICHAS ── */}
            {tab === 'fichas' && (
              <div>
                <div className="flex justify-end mb-4">
                  <button onClick={() => setShowEconomyModal(true)} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: TDAH_COLOR }}>
                    + Novo Sistema
                  </button>
                </div>

                {economies.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
                    <p className="text-sm text-slate-400">Nenhum sistema de fichas cadastrado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {economies.map(eco => {
                      const symbol = getTokenSymbol(eco.token_type)
                      const behaviors = eco.target_behaviors || []
                      const rewards = eco.reinforcers || []
                      return (
                        <div key={eco.id} className={`bg-white rounded-xl border p-5 ${eco.status !== 'active' ? 'opacity-60' : 'border-slate-100'}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-sm font-medium text-slate-800">{eco.system_name}</h3>
                              <p className="text-[10px] text-slate-400">{eco.token_label || eco.token_type} · {eco.total_transactions} transações</p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1">
                                <span className="text-2xl">{symbol}</span>
                                <span className="text-2xl font-bold" style={{ color: TDAH_COLOR }}>{eco.current_balance}</span>
                              </div>
                              <p className="text-[10px] text-slate-400">saldo atual</p>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="text-center bg-emerald-50 rounded-lg py-2">
                              <p className="text-sm font-semibold text-emerald-600">{eco.total_earned}</p>
                              <p className="text-[10px] text-emerald-500">Ganhas</p>
                            </div>
                            <div className="text-center bg-red-50 rounded-lg py-2">
                              <p className="text-sm font-semibold text-red-500">{eco.total_spent}</p>
                              <p className="text-[10px] text-red-400">Trocadas</p>
                            </div>
                            <div className="text-center bg-slate-50 rounded-lg py-2">
                              <p className="text-sm font-semibold text-slate-600">{behaviors.length}</p>
                              <p className="text-[10px] text-slate-400">Comportamentos</p>
                            </div>
                          </div>

                          {/* Behaviors */}
                          {behaviors.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[10px] font-medium text-slate-500 mb-1">Comportamentos que ganham fichas:</p>
                              <div className="flex flex-wrap gap-1">
                                {behaviors.map((b: any, i: number) => (
                                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                    {b.behavior} (+{b.tokens_earned}{symbol})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Rewards */}
                          {rewards.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[10px] font-medium text-slate-500 mb-1">Recompensas disponíveis:</p>
                              <div className="flex flex-wrap gap-1">
                                {rewards.map((r: any, i: number) => (
                                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                                    {r.reward} ({r.tokens_required}{symbol})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          {eco.status === 'active' && (
                            <div className="flex gap-2 pt-2 border-t border-slate-50">
                              <button onClick={() => { setShowTxModal(eco); setTxForm({ type: 'earn', amount: 1, reason: '', behavior_index: -1, reinforcer_index: -1 }) }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#059669' }}>
                                + Ganhar Ficha
                              </button>
                              <button onClick={() => { setShowTxModal(eco); setTxForm({ type: 'spend', amount: 1, reason: '', behavior_index: -1, reinforcer_index: -1 }) }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50">
                                Trocar Ficha
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal: Nova Rotina ── */}
      {showRoutineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Nova Rotina Doméstica</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de rotina *</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROUTINE_TYPES.map(t => (
                    <button key={t.value} onClick={() => setRoutineForm(f => ({ ...f, routine_type: t.value }))}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-colors text-center ${routineForm.routine_type === t.value ? 'border-current text-white' : 'border-slate-200 text-slate-500'}`}
                      style={routineForm.routine_type === t.value ? { backgroundColor: TDAH_COLOR, borderColor: TDAH_COLOR } : {}}>
                      <span className="text-lg block mb-0.5">{t.emoji}</span>{t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome da rotina *</label>
                <input type="text" value={routineForm.routine_name} onChange={e => setRoutineForm(f => ({ ...f, routine_name: e.target.value }))}
                  placeholder="Ex: Rotina matinal do João" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Passos (instrução curta + pista visual)</label>
                {routineForm.steps.map((step, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-1" style={{ backgroundColor: TDAH_COLOR }}>{i + 1}</span>
                    <div className="flex-1 space-y-1">
                      <input type="text" value={step.description} placeholder="Descrição do passo"
                        onChange={e => { const s = [...routineForm.steps]; s[i] = { ...s[i], description: e.target.value }; setRoutineForm(f => ({ ...f, steps: s })) }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs" />
                      <input type="text" value={step.visual_cue} placeholder="Pista visual (opcional)"
                        onChange={e => { const s = [...routineForm.steps]; s[i] = { ...s[i], visual_cue: e.target.value }; setRoutineForm(f => ({ ...f, steps: s })) }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-100 text-xs text-slate-400" />
                    </div>
                    {routineForm.steps.length > 1 && (
                      <button onClick={() => setRoutineForm(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))}
                        className="text-red-400 text-xs mt-1">✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setRoutineForm(f => ({ ...f, steps: [...f.steps, { description: '', visual_cue: '' }] }))}
                  className="text-xs font-medium mt-1" style={{ color: TDAH_COLOR }}>+ Adicionar passo</button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Plano de reforço</label>
                <textarea value={routineForm.reinforcement_plan} onChange={e => setRoutineForm(f => ({ ...f, reinforcement_plan: e.target.value }))}
                  placeholder="Ex: Completar todos os passos = 10 min de tablet" rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowRoutineModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleCreateRoutine} disabled={savingRoutine || !routineForm.routine_name}
                className="px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50" style={{ backgroundColor: TDAH_COLOR }}>
                {savingRoutine ? 'Criando...' : 'Criar Rotina'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Novo Sistema de Fichas ── */}
      {showEconomyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Novo Sistema de Fichas</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome do sistema</label>
                <input type="text" value={economyForm.system_name} onChange={e => setEconomyForm(f => ({ ...f, system_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Tipo de ficha</label>
                <div className="flex gap-2">
                  {TOKEN_TYPES.map(t => (
                    <button key={t.value} onClick={() => setEconomyForm(f => ({ ...f, token_type: t.value }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 text-center ${economyForm.token_type === t.value ? 'text-white' : 'border-slate-200 text-slate-500'}`}
                      style={economyForm.token_type === t.value ? { backgroundColor: TDAH_COLOR, borderColor: TDAH_COLOR } : {}}>
                      <span className="text-lg block">{t.symbol}</span>{t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Comportamentos que ganham fichas</label>
                {economyForm.target_behaviors.map((b, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={b.behavior} placeholder="Comportamento"
                      onChange={e => { const bs = [...economyForm.target_behaviors]; bs[i] = { ...bs[i], behavior: e.target.value }; setEconomyForm(f => ({ ...f, target_behaviors: bs })) }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs" />
                    <input type="number" min={1} value={b.tokens_earned} style={{ width: 60 }}
                      onChange={e => { const bs = [...economyForm.target_behaviors]; bs[i] = { ...bs[i], tokens_earned: parseInt(e.target.value) || 1 }; setEconomyForm(f => ({ ...f, target_behaviors: bs })) }}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center" />
                    {economyForm.target_behaviors.length > 1 && (
                      <button onClick={() => setEconomyForm(f => ({ ...f, target_behaviors: f.target_behaviors.filter((_, j) => j !== i) }))} className="text-red-400 text-xs">✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setEconomyForm(f => ({ ...f, target_behaviors: [...f.target_behaviors, { behavior: '', tokens_earned: 1, description: '' }] }))}
                  className="text-xs font-medium" style={{ color: TDAH_COLOR }}>+ Comportamento</button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Recompensas (trocáveis por fichas)</label>
                {economyForm.reinforcers.map((r, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={r.reward} placeholder="Recompensa"
                      onChange={e => { const rs = [...economyForm.reinforcers]; rs[i] = { ...rs[i], reward: e.target.value }; setEconomyForm(f => ({ ...f, reinforcers: rs })) }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs" />
                    <input type="number" min={1} value={r.tokens_required} style={{ width: 60 }}
                      onChange={e => { const rs = [...economyForm.reinforcers]; rs[i] = { ...rs[i], tokens_required: parseInt(e.target.value) || 1 }; setEconomyForm(f => ({ ...f, reinforcers: rs })) }}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center" />
                    {economyForm.reinforcers.length > 1 && (
                      <button onClick={() => setEconomyForm(f => ({ ...f, reinforcers: f.reinforcers.filter((_, j) => j !== i) }))} className="text-red-400 text-xs">✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setEconomyForm(f => ({ ...f, reinforcers: [...f.reinforcers, { reward: '', tokens_required: 5, category: '' }] }))}
                  className="text-xs font-medium" style={{ color: TDAH_COLOR }}>+ Recompensa</button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEconomyModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleCreateEconomy} disabled={savingEconomy}
                className="px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50" style={{ backgroundColor: TDAH_COLOR }}>
                {savingEconomy ? 'Criando...' : 'Criar Sistema'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Transação ── */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              {txForm.type === 'earn' ? 'Ganhar Ficha' : 'Trocar Ficha'}
            </h2>
            <p className="text-xs text-slate-400 mb-4">Saldo atual: {showTxModal.current_balance} {getTokenSymbol(showTxModal.token_type)}</p>

            <div className="space-y-3">
              {txForm.type === 'earn' && (showTxModal.target_behaviors || []).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Comportamento</label>
                  <select value={txForm.behavior_index}
                    onChange={e => {
                      const idx = parseInt(e.target.value)
                      const b = (showTxModal.target_behaviors || [])[idx]
                      setTxForm(f => ({ ...f, behavior_index: idx, amount: b?.tokens_earned || 1, reason: b?.behavior || '' }))
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value={-1}>Selecionar...</option>
                    {(showTxModal.target_behaviors || []).map((b: any, i: number) => (
                      <option key={i} value={i}>{b.behavior} (+{b.tokens_earned})</option>
                    ))}
                  </select>
                </div>
              )}

              {txForm.type === 'spend' && (showTxModal.reinforcers || []).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Recompensa</label>
                  <select value={txForm.reinforcer_index}
                    onChange={e => {
                      const idx = parseInt(e.target.value)
                      const r = (showTxModal.reinforcers || [])[idx]
                      setTxForm(f => ({ ...f, reinforcer_index: idx, amount: r?.tokens_required || 1, reason: r?.reward || '' }))
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value={-1}>Selecionar...</option>
                    {(showTxModal.reinforcers || []).map((r: any, i: number) => (
                      <option key={i} value={i}>{r.reward} ({r.tokens_required} fichas)</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantidade</label>
                <input type="number" min={1} value={txForm.amount}
                  onChange={e => setTxForm(f => ({ ...f, amount: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleTransaction} disabled={savingTx}
                className={`flex-1 py-2.5 rounded-lg text-sm text-white font-medium disabled:opacity-50`}
                style={{ backgroundColor: txForm.type === 'earn' ? '#059669' : '#dc2626' }}>
                {savingTx ? 'Registrando...' : txForm.type === 'earn' ? `+ ${txForm.amount} ${getTokenSymbol(showTxModal.token_type)}` : `- ${txForm.amount} ${getTokenSymbol(showTxModal.token_type)}`}
              </button>
              <button onClick={() => setShowTxModal(null)} className="px-4 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
