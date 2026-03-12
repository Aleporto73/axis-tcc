'use client'

import { useAuth } from '@clerk/nextjs'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { User, Bell, Shield, Database, Calendar, Check } from 'lucide-react'

export default function ConfiguracoesPage() {
  const { isLoaded } = useAuth()
  // Profile state
  const [profile, setProfile] = useState({ name: '', crp: '' })
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/tenant')
      const data = await res.json()
      if (data.tenantId) {
        // Busca dados completos do tenant
        const profileRes = await fetch('/api/user/profile')
        const profileData = await profileRes.json()
        setProfile({
          name: profileData.name || '',
          crp: profileData.crp || ''
        })
      }
    } catch (err) {
      console.error('Erro ao buscar perfil:', err)
    }
    setProfileLoading(false)
  }

  const saveProfile = async (newProfile: { name: string; crp: string }) => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile)
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (err) {
      console.error('Erro ao salvar perfil:', err)
    }
    setSaving(false)
  }

  // Debounce save
  const debouncedSave = useCallback(
    debounce((newProfile: { name: string; crp: string }) => {
      saveProfile(newProfile)
    }, 1000),
    []
  )

  const handleProfileChange = (field: 'name' | 'crp', value: string) => {
    const newProfile = { ...profile, [field]: value }
    setProfile(newProfile)
    debouncedSave(newProfile)
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen bg-neutral-50">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="animate-pulse">Carregando...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-900">Configurações</h1>
            <p className="text-neutral-500 mt-1">Gerencie suas preferências do sistema</p>
          </div>

          <div className="space-y-6">
            {/* Google Calendar — Em breve */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6 opacity-80">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-neutral-900">Google Calendar</h2>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">Em breve</span>
                  </div>
                  <p className="text-sm text-neutral-500">Sincronize sua agenda automaticamente</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-800">
                  A integração com o Google Calendar está aguardando a aprovação de verificação do Google.
                  Assim que aprovada, você poderá sincronizar suas sessões diretamente com sua agenda.
                </p>
              </div>
            </div>

            {/* Perfil */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Perfil</h2>
                    <p className="text-sm text-neutral-500">Informações pessoais e profissionais</p>
                  </div>
                </div>
                {(saving || saved) && (
                  <div className={`flex items-center gap-2 text-sm ${saved ? 'text-emerald-600' : 'text-neutral-500'}`}>
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-neutral-300 border-t-blue-600 rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Salvo
                      </>
                    )}
                  </div>
                )}
              </div>
              {profileLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
                  <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Nome</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => handleProfileChange('name', e.target.value)}
                      placeholder="Seu nome"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">CRP</label>
                    <input
                      type="text"
                      value={profile.crp}
                      onChange={(e) => handleProfileChange('crp', e.target.value)}
                      placeholder="00/00000"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notificações */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Notificações</h2>
                  <p className="text-sm text-neutral-500">Preferências de alertas e lembretes</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">Sugestões do AXIS Assist</p>
                    <p className="text-sm text-neutral-500">Receber notificações de novas sugestões</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-neutral-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Privacidade */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Privacidade</h2>
                  <p className="text-sm text-neutral-500">Segurança e proteção de dados</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">Criptografia de dados</p>
                    <p className="text-sm text-neutral-500">Todos os dados são criptografados em repouso</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">Ativo</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">Backup automático</p>
                    <p className="text-sm text-neutral-500">Backup diário dos seus dados</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">Ativo</span>
                </div>
              </div>
            </div>

            {/* Dados */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
                  <Database className="w-6 h-6 text-neutral-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Dados</h2>
                  <p className="text-sm text-neutral-500">Exportação e gerenciamento</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button disabled className="px-4 py-2 border border-neutral-200 text-neutral-400 rounded-lg cursor-not-allowed">Exportar Dados (em breve)</button>
                <button disabled className="px-4 py-2 border border-neutral-200 text-neutral-400 rounded-lg cursor-not-allowed">Excluir Conta (em breve)</button>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  )
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
