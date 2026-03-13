'use client'

import { useAuth } from '@clerk/nextjs'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { User, Bell, Shield, Database, Calendar, Check, X, RefreshCw, Unlink } from 'lucide-react'

interface GoogleStatus {
  connected: boolean
  calendar_id?: string
  sync_enabled?: boolean
  token_expired?: boolean
  connected_at?: string
  last_sync_at?: string | null
  webhook_active?: boolean
}

export default function ConfiguracoesPage() {
  const { isLoaded } = useAuth()
  // Profile state
  const [profile, setProfile] = useState({ name: '', crp: '' })
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Google Calendar state
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ connected: false })
  const [googleLoading, setGoogleLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetchProfile()
    fetchGoogleStatus()
  }, [])

  const fetchGoogleStatus = async () => {
    try {
      const res = await fetch('/api/google/status')
      if (res.ok) {
        const data = await res.json()
        setGoogleStatus(data)
      }
    } catch (err) {
      console.error('Erro ao buscar status Google:', err)
    }
    setGoogleLoading(false)
  }

  const handleGoogleConnect = () => {
    window.location.href = '/api/google'
  }

  const handleGoogleDisconnect = async () => {
    if (!confirm('Deseja desconectar o Google Calendar?')) return
    try {
      const res = await fetch('/api/google/disconnect', { method: 'POST' })
      if (res.ok) {
        setGoogleStatus({ connected: false })
      } else {
        alert('Erro ao desconectar Google Calendar')
      }
    } catch (err) {
      console.error('Erro ao desconectar Google:', err)
      alert('Erro ao desconectar Google Calendar')
    }
  }

  const handleGoogleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' })
      if (res.ok) {
        await fetchGoogleStatus()
      } else {
        alert('Erro ao sincronizar com Google Calendar')
      }
    } catch (err) {
      console.error('Erro ao sincronizar Google:', err)
      alert('Erro ao sincronizar')
    }
    setSyncing(false)
  }

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
            {/* Google Calendar */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-neutral-900">Google Calendar</h2>
                    {googleStatus.connected && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">Conectado</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500">Sincronize sua agenda automaticamente</p>
                </div>
              </div>

              {googleLoading ? (
                <div className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
              ) : googleStatus.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Check className="w-5 h-5" />
                    <span className="text-sm font-medium">Google Calendar conectado</span>
                  </div>
                  {googleStatus.last_sync_at && (
                    <p className="text-xs text-neutral-500">
                      Última sincronização: {new Date(googleStatus.last_sync_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                  {googleStatus.token_expired && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">Token expirado — reconecte para continuar sincronizando.</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={handleGoogleSync}
                      disabled={syncing}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </button>
                    <button
                      onClick={handleGoogleDisconnect}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50"
                    >
                      <Unlink className="w-4 h-4" />
                      Desconectar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <X className="w-5 h-5" />
                    <span className="text-sm">Não conectado</span>
                  </div>
                  <p className="text-sm text-neutral-600">
                    Conecte seu Google Calendar para sincronizar suas sessões diretamente com sua agenda.
                  </p>
                  <button
                    onClick={handleGoogleConnect}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    <Calendar className="w-4 h-4" />
                    Conectar Google Calendar
                  </button>
                </div>
              )}
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
