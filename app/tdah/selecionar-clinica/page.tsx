'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// =====================================================
// AXIS TDAH - Seletor de Clínica (Multi-Tenant)
//
// Exibida quando o usuário tem profiles em múltiplos tenants.
// Reutiliza API /api/aba/tenant-select (profiles compartilhados).
// Redireciona para /tdah ao selecionar.
// =====================================================

const TDAH_COLOR = '#0d7377'

interface TenantOption {
  profile_id: string
  tenant_id: string
  role: string
  tenant_name: string
  plan_tier: string
  learner_count: number
  member_count: number
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor Clínico',
  terapeuta: 'Terapeuta',
}

const roleColors: Record<string, string> = {
  admin: 'bg-amber-100 text-amber-700 border-amber-200',
  supervisor: 'bg-blue-100 text-blue-700 border-blue-200',
  terapeuta: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const roleIcons: Record<string, string> = {
  admin: '👑',
  supervisor: '🔬',
  terapeuta: '🩺',
}

export default function SelecionarClinicaTDAHPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTenants() {
      try {
        const res = await fetch('/api/aba/tenant-select')
        if (!res.ok) throw new Error('Erro ao carregar')
        const data = await res.json()
        setTenants(data.tenants || [])

        if (data.tenants?.length === 1) {
          await selectTenant(data.tenants[0].tenant_id)
          return
        }
      } catch {
        setError('Falha ao carregar clínicas')
      }
      setLoading(false)
    }
    fetchTenants()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function selectTenant(tenantId: string) {
    setSelecting(tenantId)
    setError(null)
    try {
      const res = await fetch('/api/aba/tenant-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      })
      if (!res.ok) throw new Error('Erro ao selecionar')
      router.push('/tdah')
    } catch {
      setError('Falha ao selecionar clínica')
      setSelecting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm animate-pulse">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${TDAH_COLOR}15` }}>
            <span className="text-lg font-bold" style={{ color: TDAH_COLOR }}>TDAH</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Qual clínica você quer acessar?</h1>
          <p className="text-sm text-slate-400 mt-1">Você tem acesso a mais de uma clínica no AXIS TDAH</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-xl text-xs text-red-500 text-center">{error}</div>
        )}

        {/* Tenant Cards */}
        <div className="space-y-3">
          {tenants.map((t) => (
            <button
              key={t.tenant_id}
              onClick={() => selectTenant(t.tenant_id)}
              disabled={selecting !== null}
              className={`w-full text-left p-5 rounded-2xl border-2 bg-white transition-all ${
                selecting === t.tenant_id
                  ? 'shadow-md'
                  : 'border-slate-200 hover:shadow-sm'
              } disabled:opacity-60`}
              style={selecting === t.tenant_id ? { borderColor: TDAH_COLOR } : undefined}
              onMouseEnter={e => { if (selecting !== t.tenant_id) e.currentTarget.style.borderColor = `${TDAH_COLOR}80` }}
              onMouseLeave={e => { if (selecting !== t.tenant_id) e.currentTarget.style.borderColor = '#e2e8f0' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
                    {roleIcons[t.role] || '🏥'}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">{t.tenant_name}</h2>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${roleColors[t.role] || 'bg-slate-100 text-slate-500'}`}>
                      {roleLabels[t.role] || t.role}
                    </span>
                  </div>
                </div>
                {selecting === t.tenant_id ? (
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: TDAH_COLOR, borderTopColor: 'transparent' }} />
                ) : (
                  <svg className="w-5 h-5 text-slate-300 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
              <div className="flex gap-4 mt-3 ml-[52px] text-[11px] text-slate-400">
                <span>{t.learner_count} paciente{t.learner_count !== 1 ? 's' : ''}</span>
                <span className="text-slate-200">·</span>
                <span>{t.member_count} membro{t.member_count !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
        </div>

        {tenants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-400">Nenhuma clínica encontrada para seu perfil.</p>
            <p className="text-xs text-slate-300 mt-1">Entre em contato com o administrador da clínica.</p>
          </div>
        )}
      </div>
    </div>
  )
}
