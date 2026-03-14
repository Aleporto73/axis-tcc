'use client'

import { useState, useEffect, useCallback } from 'react'

// =====================================================
// AXIS TDAH — Portal Família (Admin/Supervisor)
// Gerenciar tokens de acesso para responsáveis
// Gerar links, ver logs de uso, revogar acesso
// Bible visibility: Progresso resumido apenas
// =====================================================

const TDAH_COLOR = '#0d7377'

interface FamilyToken {
  id: string
  patient_id: string
  patient_name: string
  guardian_id: string | null
  token: string
  guardian_name: string
  guardian_email: string | null
  relationship: string | null
  is_active: boolean
  expires_at: string | null
  consent_accepted_at: string | null
  created_at: string
  last_accessed_at: string | null
  access_count: number
}

interface Patient {
  id: string
  name: string
}

interface Guardian {
  id: string
  name: string
  email: string | null
  relationship: string | null
  is_primary: boolean
}

export default function FamiliaPage() {
  const [tokens, setTokens] = useState<FamilyToken[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState<FamilyToken | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'active' | 'revoked' | 'all'>('active')
  const [form, setForm] = useState({
    patient_id: '',
    guardian_id: '',
    guardian_name: '',
    guardian_email: '',
    relationship: '',
    expires_days: 90,
  })

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/tdah/familia/tokens')
      if (res.ok) { setTokens((await res.json()).tokens || []) }
    } catch (e) { console.error(e) }
  }, [])

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch('/api/tdah/patients')
      if (res.ok) { setPatients((await res.json()).patients || []) }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    Promise.all([fetchTokens(), fetchPatients()]).finally(() => setLoading(false))
  }, [fetchTokens, fetchPatients])

  const fetchGuardians = async (patientId: string) => {
    try {
      const res = await fetch(`/api/tdah/guardians?patient_id=${patientId}`)
      if (res.ok) { setGuardians((await res.json()).guardians || []) }
    } catch (e) { console.error(e) }
  }

  const handlePatientSelect = (patientId: string) => {
    setForm(f => ({ ...f, patient_id: patientId, guardian_id: '', guardian_name: '', guardian_email: '', relationship: '' }))
    if (patientId) fetchGuardians(patientId)
    else setGuardians([])
  }

  const handleGuardianSelect = (guardianId: string) => {
    const g = guardians.find(x => x.id === guardianId)
    setForm(f => ({
      ...f,
      guardian_id: guardianId,
      guardian_name: g?.name || f.guardian_name,
      guardian_email: g?.email || f.guardian_email,
      relationship: g?.relationship || f.relationship,
    }))
  }

  const handleCreate = async () => {
    if (!form.patient_id || !form.guardian_name) return
    setSaving(true)
    try {
      const res = await fetch('/api/tdah/familia/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: form.patient_id,
          guardian_id: form.guardian_id || undefined,
          guardian_name: form.guardian_name,
          guardian_email: form.guardian_email || undefined,
          relationship: form.relationship || undefined,
          expires_days: form.expires_days,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setShowModal(false)
        setForm({ patient_id: '', guardian_id: '', guardian_name: '', guardian_email: '', relationship: '', expires_days: 90 })
        await fetchTokens()
        if (data.token.reused) {
          alert('Token ativo já existe para este responsável. Link copiado.')
        }
        setShowLinkModal(data.token)
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revogar acesso deste responsável?')) return
    try {
      await fetch(`/api/tdah/familia/tokens/${id}`, { method: 'DELETE' })
      await fetchTokens()
    } catch (e) { console.error(e) }
  }

  const getPortalUrl = (token: string) => typeof window !== 'undefined' ? `${window.location.origin}/familia/${token}` : `/familia/${token}`
  const copyLink = (token: string) => navigator.clipboard.writeText(getPortalUrl(token))

  const filteredTokens = tokens.filter(t => {
    if (filter === 'active') return t.is_active
    if (filter === 'revoked') return !t.is_active
    return true
  })

  const RELATIONSHIPS = ['Mãe', 'Pai', 'Avó', 'Avô', 'Tio(a)', 'Responsável legal', 'Outro']

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
            <h1 className="text-2xl font-semibold text-slate-800">Portal Família</h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie o acesso de responsáveis ao portal de acompanhamento
            </p>
          </div>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: TDAH_COLOR }}>
            + Novo Acesso
          </button>
        </div>

        {/* Info */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${TDAH_COLOR}15` }}>
              <svg className="w-5 h-5" style={{ color: TDAH_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-700">Como funciona</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Cada token gera um link para o responsável acompanhar o progresso do paciente.
                O responsável pode ver: protocolos (conquistados/em progresso), resumo DRC, sessões futuras e resumos aprovados.
                O responsável NÃO vê: scores CSO-TDAH, snapshots clínicos ou dados da layer AuDHD.
                O consentimento LGPD é solicitado no primeiro acesso.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'active' as const, label: 'Ativos', count: tokens.filter(t => t.is_active).length },
            { key: 'revoked' as const, label: 'Revogados', count: tokens.filter(t => !t.is_active).length },
            { key: 'all' as const, label: 'Todos', count: tokens.length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === tab.key ? 'text-white' : 'text-slate-500 bg-white border border-slate-200'}`}
              style={filter === tab.key ? { backgroundColor: TDAH_COLOR } : {}}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Token list */}
        {filteredTokens.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-slate-500">Nenhum token de família {filter === 'active' ? 'ativo' : ''}</p>
            <button onClick={() => setShowModal(true)} className="mt-3 text-sm font-medium" style={{ color: TDAH_COLOR }}>Gerar primeiro acesso</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTokens.map(t => (
              <div key={t.id} className={`bg-white rounded-xl border p-4 ${t.is_active ? 'border-slate-100' : 'border-slate-200 opacity-60'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-800">{t.guardian_name}</span>
                      {t.relationship && <span className="text-[10px] text-slate-400">({t.relationship})</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {t.is_active ? 'Ativo' : 'Revogado'}
                      </span>
                      {t.consent_accepted_at ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium">LGPD OK</span>
                      ) : t.is_active ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-500 font-medium">Aguardando consentimento</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      Paciente: <span className="font-medium text-slate-600">{t.patient_name}</span>
                      {t.guardian_email && <> · {t.guardian_email}</>}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                      <span>Criado: {new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                      {t.last_accessed_at && <span>Último acesso: {new Date(t.last_accessed_at).toLocaleDateString('pt-BR')}</span>}
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
                        <button onClick={() => copyLink(t.token)} className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50">Copiar Link</button>
                        <button onClick={() => handleRevoke(t.id)} className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50">Revogar</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal novo acesso */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Novo Acesso — Família</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Paciente *</label>
                <select value={form.patient_id} onChange={e => handlePatientSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="">Selecionar...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {guardians.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Responsável cadastrado</label>
                  <select value={form.guardian_id} onChange={e => handleGuardianSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value="">Novo responsável...</option>
                    {guardians.map(g => <option key={g.id} value={g.id}>{g.name} {g.is_primary ? '(Principal)' : ''} {g.relationship ? `— ${g.relationship}` : ''}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome do Responsável *</label>
                <input type="text" value={form.guardian_name}
                  onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))}
                  placeholder="Maria da Silva" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input type="email" value={form.guardian_email}
                  onChange={e => setForm(f => ({ ...f, guardian_email: e.target.value }))}
                  placeholder="maria@email.com" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Parentesco</label>
                <select value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="">Selecionar...</option>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expiração</label>
                <select value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value={30}>30 dias</option>
                  <option value={90}>90 dias (padrão)</option>
                  <option value={180}>180 dias</option>
                  <option value={365}>1 ano</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !form.patient_id || !form.guardian_name}
                className="px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50" style={{ backgroundColor: TDAH_COLOR }}>
                {saving ? 'Gerando...' : 'Gerar Acesso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal link gerado */}
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
              <p className="text-sm text-slate-500 mt-1">Envie este link para o responsável</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-slate-500 mb-1">Link do portal:</p>
              <p className="text-sm font-mono text-slate-700 break-all">{getPortalUrl(showLinkModal.token)}</p>
            </div>
            <div className="text-xs text-slate-400 mb-4 space-y-1">
              <p>Responsável: {showLinkModal.guardian_name}</p>
              <p>O responsável verá: protocolos, progresso DRC, sessões e resumos aprovados</p>
              <p>O consentimento LGPD será solicitado no primeiro acesso</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { copyLink(showLinkModal.token); setShowLinkModal(null) }}
                className="flex-1 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ backgroundColor: TDAH_COLOR }}>Copiar Link</button>
              <button onClick={() => setShowLinkModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 border border-slate-200">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
