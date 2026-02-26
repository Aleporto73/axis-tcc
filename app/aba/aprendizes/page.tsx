'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRole } from '@/app/components/RoleProvider'
import UpgradeModal from '@/app/components/UpgradeModal'

interface Learner {
  id: string
  name: string
  birth_date: string
  diagnosis: string | null
  cid_code: string | null
  support_level: number
  school: string | null
  is_active: boolean
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

const supportLabels: Record<number, string> = {
  1: 'Nível 1',
  2: 'Nível 2',
  3: 'Nível 3',
}

export default function AprendizesPage() {
  const { profile } = useRole()
  const [learners, setLearners] = useState<Learner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    birth_date: '',
    diagnosis: '',
    cid_code: '',
    support_level: 2,
    school: '',
    notes: '',
  })

  const fetchLearners = useCallback(() => {
    setLoading(true)
    fetch('/api/aba/learners')
      .then(r => r.json())
      .then(d => { setLearners(d.learners || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLearners() }, [fetchLearners])

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.birth_date) {
      setError('Nome e data de nascimento são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/aba/learners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          birth_date: form.birth_date,
          diagnosis: form.diagnosis.trim() || null,
          cid_code: form.cid_code.trim() || null,
          support_level: form.support_level,
          school: form.school.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erro ao cadastrar')
        setSaving(false)
        return
      }
      setForm({ name: '', birth_date: '', diagnosis: '', cid_code: '', support_level: 2, school: '', notes: '' })
      setShowModal(false)
      setSaving(false)
      fetchLearners()
    } catch {
      setError('Falha de conexão.')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
        <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
          <Link href="/aba" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Painel</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/aba/aprendizes" className="px-3 py-1 text-sm font-medium text-aba-500">Aprendizes</Link>
          <span className="text-slate-300 text-xs">·</span>
          <Link href="/aba/sessoes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Sessões</Link>
          <span className="text-slate-300 text-xs hidden sm:inline">·</span>
          <Link href="/aba/relatorios" className="hidden sm:inline px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Relatórios</Link>
        </nav>
      </div>

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Aprendizes</h1>
            <p className="text-xs text-slate-300 font-light">
              {loading ? '...' : `${learners.length} ${learners.length === 1 ? 'aprendiz cadastrado' : 'aprendizes cadastrados'}`}
            </p>
          </div>
          <button
            onClick={() => {
              const isFree = !profile?.tenant_plan || profile.tenant_plan === 'free'
              if (isFree && learners.length >= 1) {
                setShowUpgrade(true)
              } else {
                setShowModal(true)
              }
            }}
            className="px-4 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 transition-colors"
          >
            + Novo Aprendiz
          </button>
        </header>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="animate-pulse bg-slate-50 rounded-xl h-20"></div>
            ))}
          </div>
        ) : learners.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-aba-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 mb-1">Nenhum aprendiz cadastrado</p>
            <p className="text-xs text-slate-400">Clique em "+ Novo Aprendiz" para começar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {learners.map((l) => (
              <Link key={l.id} href={`/aba/aprendizes/${l.id}`} className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-aba-500/30 hover:shadow-sm transition-all cursor-pointer gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-aba-500/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-aba-500">{l.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-slate-800 truncate">{l.name}</h3>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-400">{calcAge(l.birth_date)}</span>
                      {l.cid_code && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{l.cid_code}</span>
                        </>
                      )}
                      <span className="text-slate-300 hidden sm:inline">·</span>
                      <span className="text-xs text-slate-400 hidden sm:inline">{supportLabels[l.support_level]}</span>
                    </div>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 shrink-0">
                  <span>{l.active_protocols} {l.active_protocols === 1 ? 'protocolo' : 'protocolos'}</span>
                  <span className="text-slate-300">·</span>
                  <span>{l.total_sessions} {l.total_sessions === 1 ? 'sessão' : 'sessões'}</span>
                </div>
                <div className="sm:hidden text-right shrink-0">
                  <p className="text-xs font-medium text-aba-500">{l.active_protocols}p</p>
                  <p className="text-[10px] text-slate-400">{l.total_sessions}s</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-light text-slate-800">Novo Aprendiz</h2>
                <button onClick={() => { setShowModal(false); setError(null) }} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Nome do aprendiz" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data de nascimento *</label>
                  <input type="date" value={form.birth_date} onChange={e => setForm({...form, birth_date: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nível de suporte</label>
                  <select value={form.support_level} onChange={e => setForm({...form, support_level: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                    <option value={1}>Nível 1</option>
                    <option value={2}>Nível 2</option>
                    <option value={3}>Nível 3</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Diagnóstico</label>
                  <input type="text" value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Ex: TEA" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">CID</label>
                  <input type="text" value={form.cid_code} onChange={e => setForm({...form, cid_code: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Ex: F84.0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Escola</label>
                <input type="text" value={form.school} onChange={e => setForm({...form, school: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Nome da escola" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 resize-none" placeholder="Informações adicionais" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => { setShowModal(false); setError(null) }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 bg-aba-500 text-white text-sm font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
