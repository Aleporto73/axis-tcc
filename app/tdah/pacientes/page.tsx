'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRole } from '@/app/components/RoleProvider'
import UpgradeModalTDAH from '@/app/components/UpgradeModalTDAH'

// =====================================================
// AXIS TDAH - Página de Pacientes
// Padrão clonado de ABA, adaptado para TDAH
// Cor: #0d7377 | Campos: escola, professor, AuDHD
// =====================================================

const TDAH_COLOR = '#0d7377'
const TDAH_LIGHT = 'rgba(13, 115, 119, 0.1)'
const TDAH_LIGHTER = 'rgba(13, 115, 119, 0.05)'

interface Patient {
  id: string
  name: string
  birth_date: string | null
  gender: string | null
  diagnosis: string | null
  cid_code: string | null
  support_level: number | null
  school_name: string | null
  teacher_name: string | null
  status: string
  total_sessions: number
  active_protocols: number
  created_at: string
}

function calcAge(birth: string): string {
  const b = new Date(birth)
  const now = new Date()
  let years = now.getFullYear() - b.getFullYear()
  let months = now.getMonth() - b.getMonth()
  if (months < 0) { years--; months += 12 }
  if (years < 1) return `${months}m`
  if (years < 6) return `${years}a ${months}m`
  return `${years}a`
}

export default function PacientesTDAHPage() {
  const { profile } = useRole()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    birth_date: '',
    gender: '',
    diagnosis: '',
    cid_code: '',
    support_level: '',
    school_name: '',
    school_contact: '',
    teacher_name: '',
    teacher_email: '',
    clinical_notes: '',
    guardian_name: '',
    guardian_email: '',
    guardian_phone: '',
    guardian_relationship: 'Responsável',
  })

  const fetchPatients = useCallback(() => {
    setLoading(true)
    fetch('/api/tdah/patients')
      .then(r => r.json())
      .then(d => { setPatients(d.patients || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  const resetForm = () => setForm({
    name: '', birth_date: '', gender: '', diagnosis: '', cid_code: '',
    support_level: '', school_name: '', school_contact: '',
    teacher_name: '', teacher_email: '', clinical_notes: '',
    guardian_name: '', guardian_email: '', guardian_phone: '',
    guardian_relationship: 'Responsável',
  })

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/tdah/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          birth_date: form.birth_date || null,
          gender: form.gender || null,
          diagnosis: form.diagnosis.trim() || null,
          cid_code: form.cid_code.trim() || null,
          support_level: form.support_level ? Number(form.support_level) : null,
          school_name: form.school_name.trim() || null,
          school_contact: form.school_contact.trim() || null,
          teacher_name: form.teacher_name.trim() || null,
          teacher_email: form.teacher_email.trim() || null,
          clinical_notes: form.clinical_notes.trim() || null,
          guardian_name: form.guardian_name.trim() || null,
          guardian_email: form.guardian_email.trim() || null,
          guardian_phone: form.guardian_phone.trim() || null,
          guardian_relationship: form.guardian_relationship || 'Responsável',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        if (err.code === 'PLAN_LIMIT_REACHED') {
          setShowModal(false)
          setShowUpgrade(true)
          setSaving(false)
          return
        }
        setError(err.error || 'Erro ao cadastrar')
        setSaving(false)
        return
      }
      resetForm()
      setShowModal(false)
      setSaving(false)
      fetchPatients()
    } catch {
      setError('Falha de conexão.')
      setSaving(false)
    }
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor'

  return (
    <>
      {/* Nav pills */}
      <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
        <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
          <Link href="/tdah/dashboard" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Dashboard</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/tdah/pacientes" className="px-3 py-1 text-sm font-medium" style={{ color: TDAH_COLOR }}>Pacientes</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/tdah/sessoes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Sessões</Link>
        </nav>
      </div>

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Pacientes</h1>
            <p className="text-xs text-slate-300 font-light">
              {loading ? '...' : `${patients.length} ${patients.length === 1 ? 'paciente cadastrado' : 'pacientes cadastrados'}`}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                const isFree = !profile?.tenant_plan || profile.tenant_plan === 'free'
                if (isFree && patients.length >= 1) {
                  setShowUpgrade(true)
                } else {
                  setShowModal(true)
                }
              }}
              className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
              style={{ backgroundColor: TDAH_COLOR }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a5c5f')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = TDAH_COLOR)}
            >
              + Novo Paciente
            </button>
          )}
        </header>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-slate-50 rounded-xl h-20" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: TDAH_LIGHT }}>
              <svg className="w-8 h-8" style={{ color: TDAH_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 mb-1">Nenhum paciente cadastrado</p>
            <p className="text-xs text-slate-400">
              {isAdmin ? 'Clique em "+ Novo Paciente" para começar' : 'Aguarde o administrador cadastrar pacientes'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {patients.map((p) => (
              <Link
                key={p.id}
                href={`/tdah/pacientes/${p.id}`}
                className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-200 hover:shadow-sm transition-all cursor-pointer gap-3"
                style={{ ['--hover-border' as any]: `${TDAH_COLOR}4D` }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${TDAH_COLOR}4D`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: TDAH_LIGHT }}>
                    <span className="text-sm font-medium" style={{ color: TDAH_COLOR }}>{p.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-slate-800 truncate">{p.name}</h3>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                      {p.birth_date && <span className="text-xs text-slate-400">{calcAge(p.birth_date)}</span>}
                      {p.cid_code && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{p.cid_code}</span>
                        </>
                      )}
                      {p.school_name && (
                        <>
                          <span className="text-slate-300 hidden sm:inline">·</span>
                          <span className="text-xs text-slate-400 hidden sm:inline">{p.school_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 shrink-0">
                  <span>{p.active_protocols} {Number(p.active_protocols) === 1 ? 'protocolo' : 'protocolos'}</span>
                  <span className="text-slate-300">·</span>
                  <span>{p.total_sessions} {Number(p.total_sessions) === 1 ? 'sessão' : 'sessões'}</span>
                </div>
                <div className="sm:hidden text-right shrink-0">
                  <p className="text-xs font-medium" style={{ color: TDAH_COLOR }}>{p.active_protocols}p</p>
                  <p className="text-[10px] text-slate-400">{p.total_sessions}s</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <UpgradeModalTDAH open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      {/* Modal: Novo Paciente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-light text-slate-800">Novo Paciente</h2>
                <button onClick={() => { setShowModal(false); setError(null) }} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              {/* Nome */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                  style={{ ['--tw-ring-color' as any]: TDAH_COLOR }}
                  onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}
                  placeholder="Nome do paciente" />
              </div>

              {/* Nascimento + Gênero */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data de nascimento</label>
                  <input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Gênero</label>
                  <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}>
                    <option value="">—</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="O">Outro</option>
                  </select>
                </div>
              </div>

              {/* Diagnóstico + CID */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Diagnóstico</label>
                  <input type="text" value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="Ex: TDAH combinado" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">CID</label>
                  <input type="text" value={form.cid_code} onChange={e => setForm({ ...form, cid_code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                    onBlur={e => (e.currentTarget.style.borderColor = '')}
                    placeholder="F90.0" />
                </div>
              </div>

              {/* Escola */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Dados escolares</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Escola</label>
                    <input type="text" value={form.school_name} onChange={e => setForm({ ...form, school_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="Nome da escola" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Contato escola</label>
                    <input type="text" value={form.school_contact} onChange={e => setForm({ ...form, school_contact: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="Telefone ou email" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Professor(a)</label>
                    <input type="text" value={form.teacher_name} onChange={e => setForm({ ...form, teacher_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="Nome do professor" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email professor</label>
                    <input type="email" value={form.teacher_email} onChange={e => setForm({ ...form, teacher_email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="professor@escola.com" />
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Responsável</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
                    <input type="text" value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="Nome do responsável" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Parentesco</label>
                    <select value={form.guardian_relationship} onChange={e => setForm({ ...form, guardian_relationship: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}>
                      <option value="Responsável">Responsável</option>
                      <option value="Mãe">Mãe</option>
                      <option value="Pai">Pai</option>
                      <option value="Avó/Avô">Avó/Avô</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input type="email" value={form.guardian_email} onChange={e => setForm({ ...form, guardian_email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="responsavel@email.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Telefone</label>
                    <input type="tel" value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                      placeholder="(11) 99999-0000" />
                  </div>
                </div>
              </div>

              {/* Notas clínicas */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observações clínicas</label>
                <textarea value={form.clinical_notes} onChange={e => setForm({ ...form, clinical_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
                  onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}
                  placeholder="Informações clínicas relevantes" />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => { setShowModal(false); setError(null) }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: TDAH_COLOR }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a5c5f')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = TDAH_COLOR)}>
                {saving ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
