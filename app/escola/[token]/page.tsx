'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

// =====================================================
// AXIS TDAH — Portal do Professor (Público)
// Acesso via token — SEM login Clerk
// Bible §14: Professor vê DRC + progresso resumido
// Bible §17: Máximo 3 metas por dia por paciente
// Visibility: ✅ DRC, ✅ protocolos título, ❌ scores CSO
// =====================================================

const TDAH_COLOR = '#0d7377'

interface DrcEntry {
  id: string
  drc_date: string
  goal_description: string
  goal_met: boolean | null
  score: number | null
  filled_by: string
  filled_by_name: string | null
  teacher_notes: string | null
  is_reviewed: boolean
  protocol_id: string | null
  protocol_code: string | null
  protocol_title: string | null
}

interface Protocol {
  id: string
  code: string
  title: string
  block: string
}

interface DrcSummary {
  total_entries: number
  goals_met: number
  goals_not_met: number
  goals_pending: number
  avg_score: number | null
}

interface PortalData {
  valid: boolean
  teacher_name: string
  school_name: string | null
  patient: { name: string; age: number | null; school: string | null }
  protocols: Protocol[]
  drc_entries: DrcEntry[]
  drc_summary: DrcSummary
}

const GOAL_MET_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  true: { label: 'Atingida', color: '#059669', bg: '#ecfdf5' },
  false: { label: 'Não atingida', color: '#dc2626', bg: '#fef2f2' },
  null: { label: 'Pendente', color: '#d97706', bg: '#fffbeb' },
}

export default function TeacherPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState({
    drc_date: new Date().toISOString().split('T')[0],
    goal_description: '',
    goal_met: null as boolean | null,
    score: '' as string,
    protocol_id: '',
    teacher_notes: '',
  })

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/escola/${token}`)
      if (!res.ok) {
        if (res.status === 401) {
          setError('Link inválido, expirado ou revogado. Solicite um novo link ao clínico responsável.')
        } else {
          setError('Erro ao carregar dados. Tente novamente.')
        }
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError('Erro de conexão. Verifique sua internet.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async () => {
    if (!form.goal_description || !form.drc_date) return
    setSaving(true)
    setSuccessMsg('')
    try {
      const res = await fetch(`/api/escola/${token}/drc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drc_date: form.drc_date,
          goal_description: form.goal_description,
          goal_met: form.goal_met,
          score: form.score ? parseFloat(form.score) : undefined,
          protocol_id: form.protocol_id || undefined,
          teacher_notes: form.teacher_notes || undefined,
        }),
      })
      if (res.ok) {
        setForm({
          drc_date: form.drc_date,
          goal_description: '',
          goal_met: null,
          score: '',
          protocol_id: '',
          teacher_notes: '',
        })
        setShowForm(false)
        setSuccessMsg('Registro DRC enviado com sucesso!')
        await fetchData()
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        const err = await res.json()
        alert(err.error || 'Erro ao enviar DRC')
      }
    } catch {
      alert('Erro de conexão')
    }
    setSaving(false)
  }

  // Group DRC entries by date
  const groupedDrcs = (data?.drc_entries || []).reduce((acc, drc) => {
    const date = drc.drc_date?.split('T')[0] || drc.drc_date
    if (!acc[date]) acc[date] = []
    acc[date].push(drc)
    return acc
  }, {} as Record<string, DrcEntry[]>)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${TDAH_COLOR}40`, borderTopColor: 'transparent' }} />
          <p className="text-sm text-slate-500">Carregando portal...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-50">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-800 mb-2">Acesso não disponível</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const summary = data.drc_summary
  const successRate = summary.total_entries > 0
    ? Math.round((Number(summary.goals_met) / Number(summary.total_entries)) * 100)
    : 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${TDAH_COLOR}15` }}>
                <span className="text-[8px] font-bold" style={{ color: TDAH_COLOR }}>TDAH</span>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-800">Portal do Professor</h1>
                <p className="text-[10px] text-slate-400">{data.teacher_name}{data.school_name ? ` · ${data.school_name}` : ''}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-700">{data.patient.name}</p>
              {data.patient.age && <p className="text-[10px] text-slate-400">{data.patient.age} anos</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Success message */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMsg}
          </div>
        )}

        {/* Resumo 30 dias */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h2 className="text-xs font-medium text-slate-500 mb-3">Resumo dos últimos 30 dias</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-800">{summary.total_entries || 0}</p>
              <p className="text-[10px] text-slate-400">Registros</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-emerald-600">{summary.goals_met || 0}</p>
              <p className="text-[10px] text-slate-400">Atingidas</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-red-500">{summary.goals_not_met || 0}</p>
              <p className="text-[10px] text-slate-400">Não atingidas</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold" style={{ color: TDAH_COLOR }}>{successRate}%</p>
              <p className="text-[10px] text-slate-400">Taxa sucesso</p>
            </div>
          </div>
          {summary.avg_score && (
            <div className="mt-3 pt-3 border-t border-slate-50 text-center">
              <p className="text-xs text-slate-500">Score médio: <span className="font-medium text-slate-700">{summary.avg_score}%</span></p>
            </div>
          )}
        </div>

        {/* Protocolos ativos */}
        {data.protocols.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h2 className="text-xs font-medium text-slate-500 mb-2">Protocolos Ativos</h2>
            <div className="space-y-1.5">
              {data.protocols.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-100 text-slate-500">{p.code}</span>
                  <span className="text-xs text-slate-700">{p.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botão novo DRC */}
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl text-white font-medium text-sm transition-colors"
          style={{ backgroundColor: TDAH_COLOR }}
        >
          + Novo Registro DRC
        </button>

        {/* Form DRC */}
        {showForm && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Registro de Meta DRC</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data *</label>
                <input
                  type="date"
                  value={form.drc_date}
                  onChange={e => setForm(f => ({ ...f, drc_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': TDAH_COLOR } as any}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Meta / Comportamento Alvo *</label>
                <textarea
                  value={form.goal_description}
                  onChange={e => setForm(f => ({ ...f, goal_description: e.target.value }))}
                  placeholder="Ex: Permanecer sentado durante a atividade de matemática"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{ '--tw-ring-color': TDAH_COLOR } as any}
                />
              </div>

              {data.protocols.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Protocolo vinculado</label>
                  <select
                    value={form.protocol_id}
                    onChange={e => setForm(f => ({ ...f, protocol_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': TDAH_COLOR } as any}
                  >
                    <option value="">Nenhum</option>
                    {data.protocols.map(p => (
                      <option key={p.id} value={p.id}>[{p.code}] {p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Meta atingida?</label>
                <div className="flex gap-2">
                  {[
                    { value: true, label: 'Sim', color: '#059669', bg: '#ecfdf5' },
                    { value: false, label: 'Não', color: '#dc2626', bg: '#fef2f2' },
                    { value: null, label: 'Não avaliado', color: '#d97706', bg: '#fffbeb' },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setForm(f => ({ ...f, goal_met: opt.value as boolean | null }))}
                      className="flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-colors"
                      style={{
                        borderColor: form.goal_met === opt.value ? opt.color : '#e2e8f0',
                        backgroundColor: form.goal_met === opt.value ? opt.bg : 'white',
                        color: form.goal_met === opt.value ? opt.color : '#94a3b8',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Score (0-100%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.score}
                  onChange={e => setForm(f => ({ ...f, score: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': TDAH_COLOR } as any}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observações do Professor(a)</label>
                <textarea
                  value={form.teacher_notes}
                  onChange={e => setForm(f => ({ ...f, teacher_notes: e.target.value }))}
                  placeholder="Contexto, dificuldades observadas, estratégias usadas..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{ '--tw-ring-color': TDAH_COLOR } as any}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.goal_description}
                  className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: TDAH_COLOR }}
                >
                  {saving ? 'Enviando...' : 'Enviar Registro'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline DRC */}
        <div>
          <h2 className="text-sm font-medium text-slate-700 mb-3">Histórico de Registros</h2>
          {Object.keys(groupedDrcs).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
              <p className="text-sm text-slate-400">Nenhum registro DRC ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedDrcs).map(([date, entries]) => (
                <div key={date}>
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <div className="space-y-2">
                    {entries.map(drc => {
                      const metaStatus = GOAL_MET_LABELS[String(drc.goal_met)]
                      return (
                        <div key={drc.id} className="bg-white rounded-lg border border-slate-100 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm text-slate-700">{drc.goal_description}</p>
                              {drc.protocol_code && (
                                <p className="text-[10px] text-slate-400 mt-0.5">{drc.protocol_code} — {drc.protocol_title}</p>
                              )}
                              {drc.teacher_notes && (
                                <p className="text-xs text-slate-500 mt-1 italic">&quot;{drc.teacher_notes}&quot;</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {drc.score !== null && (
                                <span className="text-xs font-medium text-slate-600">{drc.score}%</span>
                              )}
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ color: metaStatus?.color, backgroundColor: metaStatus?.bg }}
                              >
                                {metaStatus?.label}
                              </span>
                              {drc.is_reviewed && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium">Revisado</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                            <span>por {drc.filled_by_name || drc.filled_by}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-slate-100 mt-8">
          <p className="text-[10px] text-slate-400">
            AXIS TDAH — Portal do Professor · Dados clínicos não visíveis neste portal
          </p>
          <p className="text-[10px] text-slate-300 mt-0.5">
            Em caso de dúvidas, contate o clínico responsável pelo paciente
          </p>
        </footer>
      </div>
    </div>
  )
}
