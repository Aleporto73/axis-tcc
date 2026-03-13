'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRole } from '@/app/components/RoleProvider'
import { useRouter } from 'next/navigation'

// =====================================================
// AXIS TDAH - Página de Gestão de Equipe
// Acesso: admin apenas
// Listar, convidar, editar role, desativar membros
// Sem vínculos terapeuta-paciente (TDAH usa created_by)
// =====================================================

const TDAH_COLOR = '#0d7377'

interface TeamMember {
  id: string
  clerk_user_id: string
  role: 'admin' | 'supervisor' | 'terapeuta'
  name: string
  email: string
  crp: string | null
  crp_uf: string | null
  is_active: boolean
  created_at: string
  patient_count: number
  session_count: number
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor Clínico',
  terapeuta: 'Terapeuta',
}

const roleColors: Record<string, string> = {
  admin: 'bg-amber-100 text-amber-700 border-amber-200',
  supervisor: 'bg-blue-100 text-blue-700 border-blue-200',
  terapeuta: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

export default function EquipeTDAHPage() {
  const { isAdmin, loading: roleLoading } = useRole()
  const router = useRouter()

  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRoles, setShowRoles] = useState(false)

  // Modal de convite
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'terapeuta', crp: '', crp_uf: '' })
  const [inviting, setInviting] = useState(false)

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch('/api/tdah/team')
      if (res.ok) {
        const data = await res.json()
        setTeam(data.team)
      }
    } catch {
      setError('Erro ao carregar equipe')
    }
  }, [])

  useEffect(() => {
    if (roleLoading) return
    if (!isAdmin) {
      router.push('/tdah')
      return
    }
    fetchTeam().finally(() => setLoading(false))
  }, [isAdmin, roleLoading, router, fetchTeam])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setError('')

    try {
      const res = await fetch('/api/tdah/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })

      if (res.ok) {
        setShowInvite(false)
        setInviteForm({ name: '', email: '', role: 'terapeuta', crp: '', crp_uf: '' })
        await fetchTeam()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao convidar')
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      const res = await fetch(`/api/tdah/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (res.ok) {
        await fetchTeam()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao alterar role')
      }
    } catch {
      setError('Erro de conexão')
    }
  }

  async function handleDeactivate(memberId: string, name: string) {
    if (!confirm(`Desativar ${name}? Os pacientes criados por esse membro continuarão acessíveis, mas ele perderá acesso ao sistema.`)) return

    try {
      const res = await fetch(`/api/tdah/team/${memberId}`, { method: 'DELETE' })

      if (res.ok) {
        await fetchTeam()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao desativar')
      }
    } catch {
      setError('Erro de conexão')
    }
  }

  if (roleLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400">Carregando...</div>
      </div>
    )
  }

  if (!isAdmin) return null

  const activeMembers = team.filter(m => m.is_active)
  const inactiveMembers = team.filter(m => !m.is_active)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-800">Equipe</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie membros da equipe TDAH da clínica
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: TDAH_COLOR }}
        >
          Convidar Membro
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">x</button>
        </div>
      )}

      {/* Card: Perfis de Acesso */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
        <button
          onClick={() => setShowRoles(prev => !prev)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TDAH_COLOR}15` }}>
              <svg className="w-4 h-4" style={{ color: TDAH_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Perfis de Acesso</h2>
              <p className="text-xs text-slate-400">Entenda o que cada perfil pode fazer no módulo TDAH</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showRoles ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {showRoles && (
          <div className="px-6 pb-5 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200">Admin</span>
                </div>
                <p className="text-xs font-medium text-slate-700 mb-1.5">Dono da clínica</p>
                <ul className="space-y-1">
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Acesso total ao sistema</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Gerencia protocolos e sessões tricontextuais</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Gera relatórios e DRC</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Convida e gerencia equipe</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Gerencia assinatura</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">Supervisor</span>
                </div>
                <p className="text-xs font-medium text-slate-700 mb-1.5">Supervisor Clínico</p>
                <ul className="space-y-1">
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Vê todos os pacientes</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Gerencia protocolos e sessões</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Gera relatórios e revisa DRC</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-slate-300 mt-0.5">&#10007;</span> Não gerencia equipe</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-slate-300 mt-0.5">&#10007;</span> Não gerencia assinatura</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Terapeuta</span>
                </div>
                <p className="text-xs font-medium text-slate-700 mb-1.5">Aplicador</p>
                <ul className="space-y-1">
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Seus pacientes (criados por ele)</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Conduz sessões tricontextuais</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">&#10003;</span> Registra observações e DRC</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-slate-300 mt-0.5">&#10007;</span> Não gera relatórios globais</li>
                  <li className="text-[11px] text-slate-500 flex items-start gap-1.5"><span className="text-slate-300 mt-0.5">&#10007;</span> Não acessa outros pacientes</li>
                </ul>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 text-center italic">No TDAH, cada terapeuta vê apenas os pacientes que cadastrou (via created_by). Admin e Supervisor veem todos.</p>
          </div>
        )}
      </div>

      {/* Membros Ativos */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Membros Ativos ({activeMembers.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-50">
          {activeMembers.map((member) => (
            <div key={member.id} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0" style={{ backgroundColor: TDAH_COLOR }}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">{member.name}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border shrink-0 ${roleColors[member.role]}`}>
                      {roleLabels[member.role]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {member.email}
                    {member.crp && ` · CRP ${member.crp_uf}/${member.crp}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 ml-[3.25rem] sm:ml-0">
                <div className="flex gap-3 text-xs text-slate-400 sm:text-right">
                  <span>{member.patient_count} pac.</span>
                  <span className="text-slate-200">·</span>
                  <span>{member.session_count} sessões</span>
                </div>
                {member.role !== 'admin' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white"
                    >
                      <option value="terapeuta">Terapeuta</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => handleDeactivate(member.id, member.name)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                      title="Desativar membro"
                    >
                      Desativar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {activeMembers.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              Nenhum membro ativo.
            </div>
          )}
        </div>
      </div>

      {/* Membros Inativos */}
      {inactiveMembers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden opacity-60">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-500">
              Membros Inativos ({inactiveMembers.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {inactiveMembers.map((member) => (
              <div key={member.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">{member.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{member.email}</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{roleLabels[member.role]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Convidar Membro */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Convidar Membro</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome</label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0d7377]"
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0d7377]"
                  placeholder="email@clinica.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0d7377]"
                >
                  <option value="terapeuta">Terapeuta</option>
                  <option value="supervisor">Supervisor Clínico</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">CRP</label>
                  <input
                    type="text"
                    value={inviteForm.crp}
                    onChange={e => setInviteForm(f => ({ ...f, crp: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0d7377]"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={inviteForm.crp_uf}
                    onChange={e => setInviteForm(f => ({ ...f, crp_uf: e.target.value.toUpperCase() }))}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0d7377]"
                    placeholder="SP"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: TDAH_COLOR }}
                >
                  {inviting ? 'Convidando...' : 'Convidar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
