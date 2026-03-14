'use client'

import { useState, useEffect, useCallback } from 'react'

// =====================================================
// AXIS TDAH — Módulo Escola (Admin/Supervisor)
// Gerenciar tokens de acesso para professores
// Gerar links de acesso, visualizar logs de uso
// Bible §14: Perfil professor (acesso simplificado)
// =====================================================

const TDAH_COLOR = '#0d7377'

interface TeacherToken {
  id: string
  patient_id: string
  patient_name: string
  token: string
  teacher_name: string
  teacher_email: string | null
  school_name: string | null
  is_active: boolean
  expires_at: string | null
  created_at: string
  last_used_at: string | null
  created_by_name: string | null
  access_count: number
}

interface Patient {
  id: string
  name: string
  school_name: string | null
  teacher_name: string | null
  teacher_email: string | null
}

export default function EscolaPage() {
  const [tokens, setTokens] = useState<TeacherToken[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState<TeacherToken | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'active' | 'revoked' | 'all'>('active')
  const [form, setForm] = useState({
    patient_id: '',
    teacher_name: '',
    teacher_email: '',
    school_name: '',
    expires_days: 0,
  })

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/tdah/escola/tokens')
      if (res.ok) {
        const data = await res.json()
        setTokens(data.tokens || [])
      }
    } catch (e) { console.error(e) }
  }, [])

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch('/api/tdah/patients')
      if (res.ok) {
        const data = await res.json()
        setPatients(data.patients || [])
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    Promise.all([fetchTokens(), fetchPatients()]).finally(() => setLoading(false))
  }, [fetchTokens, fetchPatients])

  const handleCreate = async () => {
    if (!form.patient_id || !form.teacher_name) return
    setSaving(true)
    try {
      const res = await fetch('/api/tdah/escola/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: form.patient_id,
          teacher_name: form.teacher_name,
          teacher_email: form.teacher_email || undefined,
          school_name: form.school_name || undefined,
          expires_days: form.expires_days || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setShowModal(false)
        setForm({ patient_id: '', teacher_name: '', teacher_email: '', school_name: '', expires_days: 0 })
        await fetchTokens()
        setShowLinkModal(data.token)
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revogar acesso deste professor? Ele não poderá mais acessar o portal.')) return
    try {
      await fetch(`/api/tdah/escola/tokens/${id}`, { method: 'DELETE' })
      await fetchTokens()
    } catch (e) { console.error(e) }
  }

  const getPortalUrl = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/escola/${token}`
    }
    return `/escola/${token}`
  }

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getPortalUrl(token))
  }

  const filteredTokens = tokens.filter(t => {
    if (filter === 'active') return t.is_active
    if (filter === 'revoked') return !t.is_active
    return true
  })

  // Pre-fill form when patient selected
  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId)
    setForm(prev => ({
      ...prev,
      patient_id: patientId,
      teacher_name: patient?.teacher_name || prev.teacher_name,
      teacher_email: patient?.teacher_email || prev.teacher_email,
      school_name: patient?.school_name || prev.school_name,
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${TDAH_COLOR}40`, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-5xl mx-auto px-4 py-8 md:pl-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Módulo Escola</h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie o acesso de professores ao portal de registro DRC
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: TDAH_COLOR }}
          >
            + Novo Acesso
          </button>
        </div>

        {/* Info card */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${TDAH_COLOR}15` }}>
              <svg className="w-5 h-5" style={{ color: TDAH_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-700">Como funciona</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Cada token gera um link único para o professor acessar o portal de registro DRC do paciente.
                O professor pode registrar até 3 metas por dia, ver protocolos ativos e o progresso resumido.
                Dados clínicos (scores CSO-TDAH, snapshots, layer AuDHD) não são visíveis para o professor.
              </p>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'active' as const, label: 'Ativos', count: tokens.filter(t => t.is_active).length },
            { key: 'revoked' as const, label: 'Revogados', count: tokens.filter(t => !t.is_active).length },
            { key: 'all' as const, label: 'Todos', count: tokens.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === tab.key ? 'text-white' : 'text-slate-500 bg-white border border-slate-200'
              }`}
              style={filter === tab.key ? { backgroundColor: TDAH_COLOR } : {}}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Tokens list */}
        {filteredTokens.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-sm text-slate-500">Nenhum token de professor {filter === 'active' ? 'ativo' : filter === 'revoked' ? 'revogado' : 'encontrado'}</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-sm font-medium"
              style={{ color: TDAH_COLOR }}
            >
              Gerar primeiro acesso
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTokens.map(t => (
              <div key={t.id} className={`bg-white rounded-xl border p-4 ${t.is_active ? 'border-slate-100' : 'border-slate-200 opacity-60'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-800">{t.teacher_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        t.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                      }`}>
                        {t.is_active ? 'Ativo' : 'Revogado'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Paciente: <span className="font-medium text-slate-600">{t.patient_name}</span>
                      {t.school_name && <> · {t.school_name}</>}
                      {t.teacher_email && <> · {t.teacher_email}</>}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                      <span>Criado: {new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                      {t.last_used_at && <span>Último acesso: {new Date(t.last_used_at).toLocaleDateString('pt-BR')}</span>}
                      <span>{t.access_count} acesso{t.access_count !== 1 ? 's' : ''}</span>
                      {t.expires_at && (
                        <span className={new Date(t.expires_at) < new Date() ? 'text-red-400' : ''}>
                          Expira: {new Date(t.expires_at).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.is_active && (
                      <>
                        <button
                          onClick={() => copyLink(t.token)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="Copiar link"
                        >
                          Copiar Link
                        </button>
                        <button
                          onClick={() => handleRevoke(t.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50"
                        >
                          Revogar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Novo acesso */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Novo Acesso — Professor</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Paciente *</label>
                <select
                  value={form.patient_id}
                  onChange={e => handlePatientSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': TDAH_COLOR } as any}
                >
                  <option value="">Selecionar paciente...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome do Professor(a) *</label>
                <input
                  type="text"
                  value={form.teacher_name}
                  onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))}
                  placeholder="Prof. Ana Silva"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': TDAH_COLOR } as any}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email do Professor(a)</label>
                <input
                  type="email"
                  value={form.teacher_email}
                  onChange={e => setForm(f => ({ ...f, teacher_email: e.target.value }))}
                  placeholder="ana.silva@escola.edu.br"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': TDAH_COLOR } as any}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Escola</label>
                <input
                  type="text"
                  value={form.school_name}
                  onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))}
                  placeholder="Colégio São Paulo"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': TDAH_COLOR } as any}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expiração (dias)</label>
                <select
                  value={form.expires_days}
                  onChange={e => setForm(f => ({ ...f, expires_days: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': TDAH_COLOR } as any}
                >
                  <option value={0}>Sem expiração</option>
                  <option value={30}>30 dias</option>
                  <option value={90}>90 dias (trimestre)</option>
                  <option value={180}>180 dias (semestre)</option>
                  <option value={365}>365 dias (ano letivo)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.patient_id || !form.teacher_name}
                className="px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: TDAH_COLOR }}
              >
                {saving ? 'Gerando...' : 'Gerar Acesso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Link gerado */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${TDAH_COLOR}15` }}>
                <svg className="w-6 h-6" style={{ color: TDAH_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Acesso Gerado!</h2>
              <p className="text-sm text-slate-500 mt-1">Envie este link para o professor(a)</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-slate-500 mb-1">Link do portal:</p>
              <p className="text-sm font-mono text-slate-700 break-all">{getPortalUrl(showLinkModal.token)}</p>
            </div>

            <div className="text-xs text-slate-400 mb-4 space-y-1">
              <p>Professor(a): {showLinkModal.teacher_name}</p>
              {showLinkModal.school_name && <p>Escola: {showLinkModal.school_name}</p>}
              <p>O professor poderá: registrar DRCs, ver protocolos ativos e progresso resumido</p>
              <p>O professor NÃO verá: scores clínicos, snapshots ou dados da layer AuDHD</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { copyLink(showLinkModal.token); setShowLinkModal(null) }}
                className="flex-1 px-4 py-2 rounded-lg text-sm text-white font-medium"
                style={{ backgroundColor: TDAH_COLOR }}
              >
                Copiar Link
              </button>
              <button
                onClick={() => setShowLinkModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 border border-slate-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
