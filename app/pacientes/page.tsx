'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'

export default function PacientesPage() {
  const router = useRouter()
  const { isLoaded, userId } = useAuth()
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', birth_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const loadPatients = async () => {
    try {
      const url = search ? `/api/patients?search=${encodeURIComponent(search)}` : '/api/patients'
      const res = await fetch(url)
      const data = await res.json()
      setPatients(data.patients)
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/patients/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({ name: '', email: '', phone: '', birth_date: '', notes: '' })
        loadPatients()
      } else {
        alert('Erro ao cadastrar paciente')
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatPhone = (phone: string) => {
    if (!phone) return '-'
    const clean = phone.replace(/\D/g, '')
    if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`
    if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`
    return phone
  }

  useEffect(() => { if (userId) loadPatients() }, [userId, search])

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="md:ml-20 min-h-screen flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#FC608F] border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      
      <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
        
        {/* Top Capsule Navigation */}
        <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
          <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
            <Link href="/dashboard" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Hoje</Link>
            <span className="text-slate-300 text-xs">·</span>
            <Link href="/sessoes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Sessões</Link>
            <span className="text-slate-300 text-xs">·</span>
            <Link href="/pacientes" className="px-3 py-1 text-sm font-medium text-[#FC608F]">Pacientes</Link>
            <span className="text-slate-300 text-xs hidden sm:inline">·</span>
            <Link href="/sugestoes" className="hidden sm:inline px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Sugestões</Link>
          </nav>
        </div>

        <div className="px-4 md:px-8 lg:px-12 xl:px-16">
          
          {/* Header */}
          <header className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Pacientes</h1>
              <p className="text-xs text-slate-300 font-light">Gerencie seus pacientes</p>
            </div>
            <button onClick={() => setShowModal(true)} data-onboarding="new-patient" className="flex items-center gap-2 px-5 py-2.5 bg-[#a2acb9]/20 text-[#344155] border border-[#a2acb9]/40 rounded-lg hover:bg-[#a2acb9]/30 transition-colors text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Novo Paciente
            </button>
          </header>

          {/* Busca */}
          <section className="mb-6 pb-6 border-b border-slate-100">
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </section>

          {/* Tabela */}
          {patients.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 font-medium min-w-[800px]">
                <div className="col-span-3">Nome</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Telefone</div>
                <div className="col-span-1 text-center">Sessões</div>
                <div className="col-span-2">Última Sessão</div>
                <div className="col-span-1 text-center">Push</div>
              </div>

              <div className="flex flex-col min-w-[800px]">
                {patients.map((patient) => (
                  <div 
                    key={patient.id}
                    onClick={() => router.push(`/pacientes/${patient.id}`)}
                    className="group grid grid-cols-12 gap-4 py-4 items-center hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100"
                  >
                    <div className="col-span-3">
                      <span className="text-base font-medium text-slate-900">{patient.name}</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-sm text-slate-500">{patient.email || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm text-slate-500">{formatPhone(patient.phone)}</span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-sm text-slate-600">{patient.total_sessions || 0}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm text-slate-500">
                        {patient.last_session ? new Date(patient.last_session).toLocaleDateString('pt-BR') : 'Nunca'}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {Number(patient.push_tokens) > 0 ? (
                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-slate-400 italic">{search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}</p>
              {!search && (
                <button onClick={() => setShowModal(true)} className="mt-4 px-5 py-2.5 bg-[#a2acb9]/20 text-[#344155] border border-[#a2acb9]/40 rounded-lg hover:bg-[#a2acb9]/30 transition-colors text-sm font-medium">
                  Cadastrar Primeiro Paciente
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-serif text-xl font-light text-slate-900">Novo Paciente</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nome *</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Telefone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Data de Nascimento</label>
                  <input type="date" value={formData.birth_date} onChange={(e) => setFormData({...formData, birth_date: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Observações</label>
                  <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" />
                </div>
              </div>
              <div className="flex gap-3 p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-sm text-slate-600">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
