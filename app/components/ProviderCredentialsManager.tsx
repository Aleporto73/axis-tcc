'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserCheck, Plus, Pencil, Check, X, ShieldCheck, AlertTriangle } from 'lucide-react'
import { HelpTip } from '@/components/Tooltip'

// =====================================================
// AXIS ABA - Credenciais de Prestadores (v2.7.0 Sprint 2)
//
// CRUD de dados institucionais dos profissionais.
// 1:1 com profiles (cada profissional tem uma credencial).
// Admin/Supervisor podem criar e editar.
//
// Integra com: GET/POST /api/aba/provider-credentials
//              PATCH /api/aba/provider-credentials/[id]
// =====================================================

interface ProviderCredential {
  id: string
  profile_id: string
  full_name: string
  council_type: string
  council_number: string
  council_uf: string
  council_valid_until: string | null
  specializations: string[]
  education_level: string
  role_in_team: string
  weekly_hours_total: number | null
  is_credentialed: boolean
  credential_code: string | null
  credential_status: string
  documents_complete: boolean
  last_verified_at: string | null
  profile_name: string
  profile_email: string
  created_at: string
}

interface Profile {
  id: string
  name: string
  role: string
  email: string
}

interface Props {
  canEdit: boolean
  profiles?: Profile[]
}

const COUNCIL_TYPES = [
  { value: 'CRP', label: 'CRP (Psicólogo)' },
  { value: 'CRFa', label: 'CRFa (Fonoaudiólogo)' },
  { value: 'CREFITO', label: 'CREFITO (TO/Fisio)' },
  { value: 'CRM', label: 'CRM (Médico)' },
  { value: 'BCBA', label: 'BCBA' },
  { value: 'other', label: 'Outro' },
] as const

const EDUCATION_LEVELS = [
  { value: 'graduacao', label: 'Graduação' },
  { value: 'especializacao', label: 'Especialização' },
  { value: 'mestrado', label: 'Mestrado' },
  { value: 'doutorado', label: 'Doutorado' },
] as const

const ROLES_IN_TEAM = [
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'terapeuta', label: 'Terapeuta ABA' },
  { value: 'fono', label: 'Fonoaudiólogo(a)' },
  { value: 'to', label: 'Terapeuta Ocupacional' },
  { value: 'psicopedagoga', label: 'Psicopedagogo(a)' },
] as const

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700', label: 'Ativo' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pendente' },
  expired: { bg: 'bg-red-50', text: 'text-red-700', label: 'Expirado' },
  blocked: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Bloqueado' },
}

const UF_LIST = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA',
  'PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

export default function ProviderCredentialsManager({ canEdit, profiles: externalProfiles }: Props) {
  const [credentials, setCredentials] = useState<ProviderCredential[]>([])
  const [internalProfiles, setInternalProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const profiles = externalProfiles || internalProfiles

  const [form, setForm] = useState({
    profile_id: '',
    full_name: '',
    council_type: 'CRP',
    council_number: '',
    council_uf: 'SP',
    council_valid_until: '',
    education_level: 'graduacao',
    role_in_team: 'terapeuta',
    weekly_hours_total: '',
    credential_code: '',
  })

  const fetchCredentials = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/aba/provider-credentials')
      if (!res.ok) throw new Error('Erro ao carregar credenciais')
      const data = await res.json()
      setCredentials(data.credentials || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProfiles = useCallback(async () => {
    if (externalProfiles) return
    try {
      const res = await fetch('/api/aba/team')
      if (res.ok) {
        const data = await res.json()
        setInternalProfiles((data.members || []).map((m: Record<string, string>) => ({
          id: m.id, name: m.name, role: m.role, email: m.email || '',
        })))
      }
    } catch { /* silencioso */ }
  }, [externalProfiles])

  useEffect(() => { fetchCredentials(); fetchProfiles() }, [fetchCredentials, fetchProfiles])

  const resetForm = () => {
    setForm({
      profile_id: '', full_name: '', council_type: 'CRP', council_number: '',
      council_uf: 'SP', council_valid_until: '', education_level: 'graduacao',
      role_in_team: 'terapeuta', weekly_hours_total: '', credential_code: '',
    })
    setEditingId(null)
    setShowForm(false)
    setError(null)
  }

  const startEdit = (cred: ProviderCredential) => {
    setForm({
      profile_id: cred.profile_id,
      full_name: cred.full_name,
      council_type: cred.council_type,
      council_number: cred.council_number,
      council_uf: cred.council_uf,
      council_valid_until: cred.council_valid_until?.split('T')[0] || '',
      education_level: cred.education_level,
      role_in_team: cred.role_in_team,
      weekly_hours_total: cred.weekly_hours_total?.toString() || '',
      credential_code: cred.credential_code || '',
    })
    setEditingId(cred.id)
    setShowForm(true)
  }

  // Profiles sem credencial (para o dropdown de novo cadastro)
  const availableProfiles = profiles.filter(
    p => !credentials.some(c => c.profile_id === p.id)
  )

  const handleSubmit = async () => {
    if (!editingId && !form.profile_id) { setError('Selecione o profissional'); return }
    if (!form.full_name.trim()) { setError('Nome completo obrigatório'); return }
    if (!form.council_number.trim()) { setError('Número do conselho obrigatório'); return }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        weekly_hours_total: form.weekly_hours_total ? parseFloat(form.weekly_hours_total) : null,
        council_valid_until: form.council_valid_until || null,
        credential_code: form.credential_code.trim() || null,
      }

      const url = editingId
        ? `/api/aba/provider-credentials/${editingId}`
        : '/api/aba/provider-credentials'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar')
        setSaving(false)
        return
      }

      resetForm()
      await fetchCredentials()
    } catch {
      setError('Falha de conexão')
    } finally {
      setSaving(false)
    }
  }

  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false
    const diff = new Date(dateStr).getTime() - Date.now()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000 // 30 dias
  }

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false
    return new Date(dateStr).getTime() < Date.now()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-aba-500/10 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-aba-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Credenciais da Equipe</h2>
              <HelpTip tip="credenciais_equipe" className="w-4 h-4 text-[10px]" />
            </div>
            <p className="text-sm text-slate-500">Dados institucionais e conselhos profissionais</p>
          </div>
        </div>
        {canEdit && !showForm && availableProfiles.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Cadastrar
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm text-slate-400 animate-pulse">Carregando credenciais...</div>
      ) : credentials.length === 0 && !showForm ? (
        <div className="text-center py-8 text-sm text-slate-400">
          Nenhuma credencial cadastrada
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.map(cred => {
            const statusCfg = STATUS_CONFIG[cred.credential_status] || STATUS_CONFIG.pending
            const councilExpiring = isExpiringSoon(cred.council_valid_until)
            const councilExpired = isExpired(cred.council_valid_until)

            return (
              <div key={cred.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cred.is_credentialed ? 'bg-green-50' : 'bg-slate-100'}`}>
                    {cred.is_credentialed
                      ? <ShieldCheck className="w-4 h-4 text-green-600" />
                      : <UserCheck className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{cred.full_name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{cred.council_type} {cred.council_number}/{cred.council_uf}</span>
                      <span>·</span>
                      <span>{ROLES_IN_TEAM.find(r => r.value === cred.role_in_team)?.label || cred.role_in_team}</span>
                      {cred.weekly_hours_total && (
                        <>
                          <span>·</span>
                          <span>{cred.weekly_hours_total}h/sem</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(councilExpiring || councilExpired) && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${councilExpired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                      <AlertTriangle className="w-3 h-3" />
                      {councilExpired ? 'Vencido' : 'Vencendo'}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                    {statusCfg.label}
                  </span>
                  {canEdit && (
                    <button onClick={() => startEdit(cred)} className="p-1 text-slate-300 hover:text-aba-500 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
          <h3 className="text-xs font-medium text-slate-600">
            {editingId ? 'Editar Credencial' : 'Nova Credencial'}
          </h3>

          {!editingId && (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Profissional *</label>
              <select
                value={form.profile_id}
                onChange={e => {
                  const p = profiles.find(x => x.id === e.target.value)
                  setForm({ ...form, profile_id: e.target.value, full_name: p?.name || form.full_name })
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white"
              >
                <option value="">Selecione...</option>
                {availableProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Nome completo *</label>
              <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Função na equipe</label>
              <select value={form.role_in_team} onChange={e => setForm({ ...form, role_in_team: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                {ROLES_IN_TEAM.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Conselho *</label>
              <select value={form.council_type} onChange={e => setForm({ ...form, council_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                {COUNCIL_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Número *</label>
              <input type="text" value={form.council_number} onChange={e => setForm({ ...form, council_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="06/12345" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">UF *</label>
              <select value={form.council_uf} onChange={e => setForm({ ...form, council_uf: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Validade conselho</label>
              <input type="date" value={form.council_valid_until} onChange={e => setForm({ ...form, council_valid_until: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Formação</label>
              <select value={form.education_level} onChange={e => setForm({ ...form, education_level: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                {EDUCATION_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Horas semanais</label>
              <input type="number" min="0" max="60" step="0.5" value={form.weekly_hours_total}
                onChange={e => setForm({ ...form, weekly_hours_total: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="20" />
            </div>
          </div>

          {error && <p className="text-[11px] text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : <><Check className="w-3.5 h-3.5" /> Salvar</>}
            </button>
            <button onClick={resetForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-400 text-xs hover:text-slate-600">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
