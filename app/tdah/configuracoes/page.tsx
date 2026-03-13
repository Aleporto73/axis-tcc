'use client'

import { useState, useEffect } from 'react'
import { useRole } from '@/app/components/RoleProvider'

// =====================================================
// AXIS TDAH - Configurações
// Espelhado do ABA: perfil, notificações, clínica, plano, dados
// Visibilidade por role:
//   admin      → tudo + Clínica + Dados
//   supervisor → Perfil, Notificações, Privacidade
//   terapeuta  → Perfil, Notificações
// =====================================================

const TDAH_COLOR = '#0d7377'

export default function ConfiguracoesTDAHPage() {
  const { profile: roleProfile, role, isAdmin, isTerapeuta, loading: roleLoading } = useRole()

  // Perfil pessoal
  const [profileForm, setProfileForm] = useState({ name: '', crp: '' })
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Notificações
  const [notifPrefs, setNotifPrefs] = useState({
    session_reminder: true,
    regression_alert: true,
    drc_pending: true,
    critical_score: true,
  })

  // Clínica
  const [clinicName, setClinicName] = useState('')
  const [clinicSaving, setClinicSaving] = useState(false)
  const [clinicSaved, setClinicSaved] = useState(false)

  // Plano
  const [planData, setPlanData] = useState<{
    plan_tier: string
    max_patients: number
    patient_count: number
  } | null>(null)

  // ── Fetch inicial ──
  useEffect(() => { fetchProfile() }, [])

  useEffect(() => {
    if (roleProfile?.tenant_name && !clinicName) {
      setClinicName(roleProfile.tenant_name)
    }
  }, [roleProfile?.tenant_name])

  useEffect(() => {
    if (isAdmin) fetchPlan()
  }, [isAdmin])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/aba/me')
      if (res.ok) {
        const data = await res.json()
        const p = data.profile
        const crpFormatted = p.crp_uf && p.crp ? `${p.crp_uf}/${p.crp}` : p.crp || ''
        setProfileForm({ name: p.name || '', crp: crpFormatted })
      }
    } catch { /* silent */ }
    setProfileLoading(false)
  }

  const saveProfile = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const [crp_uf, crp_number] = profileForm.crp.includes('/') ? profileForm.crp.split('/') : ['', profileForm.crp]
      const res = await fetch('/api/aba/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileForm.name.trim(), crp: crp_number, crp_uf }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch { /* silent */ }
    setSaving(false)
  }

  const saveClinicName = async () => {
    if (!clinicName.trim()) return
    setClinicSaving(true)
    setClinicSaved(false)
    try {
      const res = await fetch('/api/aba/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clinicName.trim() }),
      })
      if (res.ok) {
        setClinicSaved(true)
        setTimeout(() => setClinicSaved(false), 2000)
      }
    } catch { /* silent */ }
    setClinicSaving(false)
  }

  const fetchPlan = async () => {
    try {
      const res = await fetch('/api/aba/plan')
      if (res.ok) {
        const data = await res.json()
        setPlanData(data)
      }
    } catch { /* silent */ }
  }

  const tierLabels: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    clinic: 'Clínica',
    enterprise: 'Enterprise',
  }

  if (roleLoading) {
    return (
      <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/4" />
          <div className="h-40 bg-slate-50 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Configurações</h1>
        <p className="text-sm text-slate-400 mt-1">AXIS TDAH · {role}</p>
      </div>

      {/* ── Perfil ── */}
      <section className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          Perfil
        </h2>

        {profileLoading ? (
          <div className="animate-pulse h-20 bg-slate-50 rounded-lg" />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
              <input type="text" value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0d7377]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CRP (UF/número)</label>
              <input type="text" value={profileForm.crp}
                onChange={e => setProfileForm(f => ({ ...f, crp: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0d7377]"
                placeholder="SP/12345" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveProfile} disabled={saving}
                className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: TDAH_COLOR }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              {saved && <span className="text-xs text-green-600">Salvo!</span>}
            </div>
          </div>
        )}
      </section>

      {/* ── Notificações ── */}
      <section className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          Notificações
        </h2>
        <p className="text-[11px] text-slate-400 mb-4">Preferências de alertas e lembretes TDAH.</p>

        <div className="space-y-3">
          {([
            { key: 'session_reminder', label: 'Lembrete de sessão agendada' },
            { key: 'regression_alert', label: 'Alerta de protocolo em regressão' },
            { key: 'drc_pending', label: 'DRC pendente de revisão' },
            { key: 'critical_score', label: 'Score CSO em faixa crítica' },
          ] as const).map(item => (
            <label key={item.key} className="flex items-center justify-between py-2 cursor-pointer">
              <span className="text-sm text-slate-600">{item.label}</span>
              <div className="relative">
                <input type="checkbox" className="sr-only"
                  checked={notifPrefs[item.key]}
                  onChange={e => setNotifPrefs(p => ({ ...p, [item.key]: e.target.checked }))} />
                <div className={`w-10 h-5 rounded-full transition-colors ${notifPrefs[item.key] ? '' : 'bg-slate-200'}`}
                  style={notifPrefs[item.key] ? { backgroundColor: TDAH_COLOR } : {}} />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifPrefs[item.key] ? 'translate-x-5' : ''}`} />
              </div>
            </label>
          ))}
        </div>
        <p className="text-[10px] text-slate-300 mt-3">Notificações push serão ativadas em versão futura.</p>
      </section>

      {/* ── Clínica (admin only) ── */}
      {isAdmin && (
        <section className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Clínica
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome da clínica</label>
              <input type="text" value={clinicName}
                onChange={e => setClinicName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0d7377]" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveClinicName} disabled={clinicSaving}
                className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: TDAH_COLOR }}>
                {clinicSaving ? 'Salvando...' : 'Salvar'}
              </button>
              {clinicSaved && <span className="text-xs text-green-600">Salvo!</span>}
            </div>
          </div>
        </section>
      )}

      {/* ── Meu Plano (admin) ── */}
      {isAdmin && planData && (
        <section className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            Meu Plano
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50">
              <p className="text-[10px] text-slate-500 uppercase">Plano</p>
              <p className="text-lg font-bold text-slate-800 mt-1">{tierLabels[planData.plan_tier] || planData.plan_tier}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50">
              <p className="text-[10px] text-slate-500 uppercase">Pacientes</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {planData.patient_count ?? '—'} / {planData.max_patients}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50">
              <p className="text-[10px] text-slate-500 uppercase">Limite</p>
              <p className="text-lg font-bold text-slate-800 mt-1">{planData.max_patients} ativos</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-300 mt-3">
            Para upgrade, entre em contato ou acesse a loja Hotmart (em breve).
          </p>
        </section>
      )}

      {/* ── Privacidade & Dados ── */}
      {!isTerapeuta && (
        <section className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Privacidade & Dados
          </h2>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span>Retenção de dados clínicos</span>
              <span className="text-xs font-medium text-slate-500">7 anos</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span>Retenção de logs de auditoria</span>
              <span className="text-xs font-medium text-slate-500">5 anos</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span>Motor clínico</span>
              <span className="text-xs font-medium text-slate-500">CSO-TDAH v1.0.0</span>
            </div>
            <div className="flex justify-between py-2">
              <span>Isolamento de dados</span>
              <span className="text-xs font-medium text-slate-500">Multi-tenant (tenant_id)</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-300 mt-4">
            Conforme LGPD: a clínica é controladora dos dados, AXIS é operador.
            Dados clínicos são armazenados com isolamento por tenant e nunca compartilhados entre clínicas.
          </p>
        </section>
      )}

      {/* Rodapé legal */}
      <div className="text-center py-8">
        <p className="text-[10px] text-slate-300 leading-relaxed max-w-md mx-auto">
          AXIS TDAH é infraestrutura clínica. Não substitui julgamento profissional.
          Todas as decisões clínicas são de responsabilidade do profissional habilitado.
          Motor CSO-TDAH v1.0.0 · Dados isolados por tenant · Append-only audit log.
        </p>
      </div>
    </div>
  )
}
