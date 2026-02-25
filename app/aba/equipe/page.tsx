'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRole } from '@/app/components/RoleProvider'
import { useRouter } from 'next/navigation'

// =====================================================
// AXIS ABA - Página de Gestão de Equipe
// Acesso: admin apenas
// Listar, convidar, editar role, desativar membros
// Atribuir terapeutas a aprendizes
// =====================================================

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
  learner_count: number
  session_count: number
}

interface Learner {
  id: string
  name: string
}

interface Assignment {
  id: string
  learner_id: string
  profile_id: string
  is_primary: boolean
  therapist_name: string
  therapist_role: string
  learner_name: string
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

export default function EquipePage() {
  const { isAdmin, loading: roleLoading } = useRole()
  const router = useRouter()

  const [team, setTeam] = useState<TeamMember[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal de convite
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'terapeuta', crp: '', crp_uf: '' })
  const [inviting, setInviting] = useState(false)

  // Modal de atribuição
  const [showAssign, setShowAssign] = useState(false)
  const [assignForm, setAssignForm] = useState({ learner_id: '', profile_id: '', is_primary: false })
  const [assigning, setAssigning] = useState(false)

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch('/api/aba/team')
      if (res.ok) {
        const data = await res.json()
        setTeam(data.team)
      }
    } catch (err) {
      setError('Erro ao carregar equipe')
    }
  }, [])

  const fetchLearners = useCallback(async () => {
    try {
      const res = await fetch('/api/aba/learners')
      if (res.ok) {
        const data = await res.json()
        setLearners(data.learners)
      }
    } catch (_) {}
  }, [])

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/aba/learner-therapists')
      if (res.ok) {
        const data = await res.json()
        setAssignments(data.assignments)
      }
    } catch (_) {}
  }, [])

  useEffect(() => {
    if (roleLoading) return
    if (!isAdmin) {
      router.push('/aba')
      return
    }

    Promise.all([fetchTeam(), fetchLearners(), fetchAssignments()])
      .finally(() => setLoading(false))
  }, [isAdmin, roleLoading, router, fetchTeam, fetchLearners, fetchAssignments])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setError('')

    try {
      const res = await fetch('/api/aba/team', {
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
    } catch (_) {
      setError('Erro de conexão')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      const res = await fetch(`/api/aba/team/${memberId}`, {
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
    } catch (_) {
      setError('Erro de conexão')
    }
  }

  async function handleDeactivate(memberId: string, name: string) {
    if (!confirm(`Desativar ${name}? Vínculos com aprendizes serão removidos.`)) return

    try {
      const res = await fetch(`/api/aba/team/${memberId}`, { method: 'DELETE' })

      if (res.ok) {
        await Promise.all([fetchTeam(), fetchAssignments()])
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao desativar')
      }
    } catch (_) {
      setError('Erro de conexão')
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    setAssigning(true)
    setError('')

    try {
      const res = await fetch('/api/aba/learner-therapists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm),
      })

      if (res.ok) {
        setShowAssign(false)
        setAssignForm({ learner_id: '', profile_id: '', is_primary: false })
        await fetchAssignments()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao atribuir')
      }
    } catch (_) {
      setError('Erro de conexão')
    } finally {
      setAssigning(false)
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    try {
      const res = await fetch(`/api/aba/learner-therapists?id=${assignmentId}`, { method: 'DELETE' })
      if (res.ok) await fetchAssignments()
    } catch (_) {}
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
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Equipe</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie membros e atribua terapeutas aos aprendizes
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAssign(true)}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Atribuir Terapeuta
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-aba-500 rounded-lg hover:bg-aba-600 transition-colors"
          >
            Convidar Membro
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">x</button>
        </div>
      )}

      {/* Membros Ativos */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Membros Ativos ({activeMembers.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-50">
          {activeMembers.map((member) => (
            <div key={member.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{member.name}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${roleColors[member.role]}`}>
                      {roleLabels[member.role]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {member.email}
                    {member.crp && ` · CRP ${member.crp_uf}/${member.crp}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right text-xs text-slate-400">
                  <div>{member.learner_count} aprendizes</div>
                  <div>{member.session_count} sessões</div>
                </div>
                {member.role !== 'admin' && (
                  <div className="flex items-center gap-2">
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

      {/* Vínculos Terapeuta-Aprendiz */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Vínculos Terapeuta-Aprendiz ({assignments.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-50">
          {assignments.map((a) => (
            <div key={a.id} className="px-6 py-3 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium text-slate-700">{a.therapist_name}</span>
                <span className="text-slate-400 mx-2">→</span>
                <span className="text-slate-600">{a.learner_name}</span>
                {a.is_primary && (
                  <span className="ml-2 text-[10px] font-semibold text-aba-500 bg-aba-500/10 px-1.5 py-0.5 rounded-full">
                    Principal
                  </span>
                )}
              </div>
              <button
                onClick={() => handleRemoveAssignment(a.id)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Remover
              </button>
            </div>
          ))}
          {assignments.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-slate-400">
              Nenhum vínculo. Clique em "Atribuir Terapeuta" para começar.
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
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="email@clinica.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    placeholder="SP"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={inviting} className="flex-1 px-4 py-2 text-sm bg-aba-500 text-white rounded-lg hover:bg-aba-600 disabled:opacity-50">
                  {inviting ? 'Convidando...' : 'Convidar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Atribuir Terapeuta */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAssign(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Atribuir Terapeuta a Aprendiz</h3>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Aprendiz</label>
                <select
                  required
                  value={assignForm.learner_id}
                  onChange={e => setAssignForm(f => ({ ...f, learner_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Selecione...</option>
                  {learners.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Terapeuta</label>
                <select
                  required
                  value={assignForm.profile_id}
                  onChange={e => setAssignForm(f => ({ ...f, profile_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Selecione...</option>
                  {activeMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({roleLabels[m.role]})
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={assignForm.is_primary}
                  onChange={e => setAssignForm(f => ({ ...f, is_primary: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                Terapeuta principal
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAssign(false)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={assigning} className="flex-1 px-4 py-2 text-sm bg-aba-500 text-white rounded-lg hover:bg-aba-600 disabled:opacity-50">
                  {assigning ? 'Atribuindo...' : 'Atribuir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
