'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

// =====================================================
// AXIS TDAH — Portal Família (Público)
// Acesso via token — SEM login Clerk
// Fluxo: Consentimento LGPD → Dados do paciente
// Visibility: Progresso, DRC resumo, sessões, conquistas
// ❌ Scores CSO-TDAH, ❌ Snapshots, ❌ Layer AuDHD
// =====================================================

const TDAH_COLOR = '#0d7377'

const CONTEXT_LABELS: Record<string, string> = {
  clinical: 'Clínico',
  home: 'Domiciliar',
  school: 'Escolar',
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  conquistado: { label: 'Conquistado', color: '#059669', bg: '#ecfdf5' },
  em_progresso: { label: 'Em progresso', color: '#2563eb', bg: '#eff6ff' },
  em_revisao: { label: 'Em revisão', color: '#d97706', bg: '#fffbeb' },
  active: { label: 'Ativo', color: '#2563eb', bg: '#eff6ff' },
}

interface PortalData {
  valid: boolean
  needs_consent: boolean
  guardian_name: string
  relationship?: string
  patient_name?: string
  patient?: {
    name: string
    age: number | null
    school: string | null
    status: string
  }
  protocols?: any[]
  drc_summary?: any
  upcoming_sessions?: any[]
  recent_sessions?: any[]
  session_summaries?: any[]
  achievements?: any[]
}

export default function FamiliaPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [consenting, setConsenting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/familia/${token}`)
      if (!res.ok) {
        if (res.status === 401) {
          setError('Link inválido, expirado ou revogado. Solicite um novo link ao clínico responsável.')
        } else {
          setError('Erro ao carregar dados.')
        }
        return
      }
      setData(await res.json())
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  const acceptConsent = async () => {
    setConsenting(true)
    try {
      const res = await fetch(`/api/familia/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept_consent: true }),
      })
      if (res.ok) await fetchData()
    } catch { alert('Erro ao registrar consentimento') }
    setConsenting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${TDAH_COLOR}40`, borderTopColor: 'transparent' }} />
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

  // ── Tela de Consentimento LGPD ──
  if (data.needs_consent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${TDAH_COLOR}15` }}>
              <span className="text-xs font-bold" style={{ color: TDAH_COLOR }}>TDAH</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Portal da Família</h1>
            <p className="text-sm text-slate-500 mt-1">Bem-vindo(a), {data.guardian_name}</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-xs text-slate-600 leading-relaxed space-y-2">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Termo de Consentimento (LGPD)</h3>
            <p>
              Este portal permite que você acompanhe o progresso terapêutico de <strong>{data.patient_name}</strong> no sistema AXIS TDAH.
            </p>
            <p>Ao aceitar este termo, você terá acesso a:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Protocolos ativos e conquistas</li>
              <li>Resumo de progresso das metas DRC (Daily Report Card)</li>
              <li>Sessões agendadas e realizadas (data e contexto)</li>
              <li>Resumos de sessão aprovados pelo clínico</li>
            </ul>
            <p className="font-medium">Dados que NÃO são exibidos:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Scores clínicos (CSO-TDAH)</li>
              <li>Snapshots de estado clínico</li>
              <li>Dados da layer AuDHD</li>
              <li>Anotações internas do clínico</li>
            </ul>
            <p>
              Seus dados de acesso (data/hora) serão registrados para fins de auditoria.
              Você pode solicitar a revogação deste acesso a qualquer momento junto ao clínico responsável.
            </p>
          </div>

          <button
            onClick={acceptConsent}
            disabled={consenting}
            className="w-full py-3 rounded-xl text-white font-medium text-sm disabled:opacity-50"
            style={{ backgroundColor: TDAH_COLOR }}
          >
            {consenting ? 'Registrando...' : 'Aceitar e Acessar Portal'}
          </button>
        </div>
      </div>
    )
  }

  // ── Portal Principal ──
  const drc = data.drc_summary || {}
  const successRate = Number(drc.total_entries) > 0
    ? Math.round((Number(drc.goals_met) / Number(drc.total_entries)) * 100)
    : 0
  const mastered = (data.protocols || []).filter(p => p.status_label === 'conquistado').length
  const inProgress = (data.protocols || []).filter(p => p.status_label === 'em_progresso').length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${TDAH_COLOR}15` }}>
              <span className="text-[8px] font-bold" style={{ color: TDAH_COLOR }}>TDAH</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-800">Portal da Família</h1>
              <p className="text-[10px] text-slate-400">{data.guardian_name}{data.relationship ? ` · ${data.relationship}` : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-700">{data.patient?.name}</p>
            {data.patient?.age && <p className="text-[10px] text-slate-400">{data.patient.age} anos</p>}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Resumo geral */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h2 className="text-xs font-medium text-slate-500 mb-3">Visão Geral</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-lg font-semibold" style={{ color: TDAH_COLOR }}>{mastered}</p>
              <p className="text-[10px] text-slate-400">Conquistados</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-blue-600">{inProgress}</p>
              <p className="text-[10px] text-slate-400">Em progresso</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-emerald-600">{successRate}%</p>
              <p className="text-[10px] text-slate-400">DRC sucesso</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-600">{drc.avg_score || '—'}</p>
              <p className="text-[10px] text-slate-400">Score médio</p>
            </div>
          </div>
        </div>

        {/* Conquistas */}
        {(data.achievements || []).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h2 className="text-xs font-medium text-slate-500 mb-3">Conquistas Recentes</h2>
            <div className="space-y-2">
              {(data.achievements || []).map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">&#11088;</span>
                  <div>
                    <p className="text-sm text-slate-700">{a.title}</p>
                    <p className="text-[10px] text-slate-400">{a.code} · {a.mastered_at ? new Date(a.mastered_at).toLocaleDateString('pt-BR') : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Protocolos */}
        {(data.protocols || []).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h2 className="text-xs font-medium text-slate-500 mb-3">Protocolos</h2>
            <div className="space-y-2">
              {(data.protocols || []).map((p: any) => {
                const st = STATUS_STYLES[p.status_label] || STATUS_STYLES.active
                return (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-100 text-slate-500">{p.code}</span>
                      <span className="text-xs text-slate-700">{p.title}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: st.color, backgroundColor: st.bg }}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sessões futuras */}
        {(data.upcoming_sessions || []).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h2 className="text-xs font-medium text-slate-500 mb-3">Próximas Sessões</h2>
            <div className="space-y-2">
              {(data.upcoming_sessions || []).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between">
                  <p className="text-sm text-slate-700">
                    {new Date(s.session_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {CONTEXT_LABELS[s.session_context] || s.session_context}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessões recentes */}
        {(data.recent_sessions || []).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h2 className="text-xs font-medium text-slate-500 mb-3">Sessões Realizadas</h2>
            <div className="space-y-2">
              {(data.recent_sessions || []).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between">
                  <p className="text-xs text-slate-600">
                    {new Date(s.session_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                    {s.duration_minutes && <span className="text-slate-400"> · {s.duration_minutes} min</span>}
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {CONTEXT_LABELS[s.session_context] || s.session_context}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumos de sessão */}
        {(data.session_summaries || []).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h2 className="text-xs font-medium text-slate-500 mb-3">Resumos Enviados</h2>
            <div className="space-y-3">
              {(data.session_summaries || []).map((s: any) => (
                <div key={s.id} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">{new Date(s.created_at).toLocaleDateString('pt-BR')}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{s.summary_text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-6 border-t border-slate-100 mt-8">
          <p className="text-[10px] text-slate-400">AXIS TDAH — Portal da Família</p>
          <p className="text-[10px] text-slate-300 mt-0.5">Dados clínicos detalhados não são exibidos neste portal</p>
        </footer>
      </div>
    </div>
  )
}
