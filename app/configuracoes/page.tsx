'use client'

import { useAuth } from '@clerk/nextjs'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { User, Bell, Shield, Database, Calendar, RefreshCw, Check, X, Zap, Unlink, Save } from 'lucide-react'

export default function ConfiguracoesPage() {
  const { isLoaded } = useAuth()
  const [googleStatus, setGoogleStatus] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [activatingWebhook, setActivatingWebhook] = useState(false)
  const [webhookResult, setWebhookResult] = useState<any>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  
  // Profile state
  const [profile, setProfile] = useState({ name: '', crp: '' })
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchGoogleStatus()
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

  const fetchGoogleStatus = async () => {
    try {
      const res = await fetch('/api/google/status')
      const data = await res.json()
      setGoogleStatus(data)
    } catch (err) {
      console.error('Erro ao buscar status do Google:', err)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data)
      fetchGoogleStatus()
    } catch (err) {
      setSyncResult({ error: 'Erro ao sincronizar' })
    }
    setSyncing(false)
  }

  const handleActivateWebhook = async () => {
    setActivatingWebhook(true)
    setWebhookResult(null)
    try {
      const res = await fetch('/api/google/watch', { method: 'POST' })
      const data = await res.json()
      setWebhookResult(data)
      fetchGoogleStatus()
    } catch (err) {
      setWebhookResult({ error: 'Erro ao ativar sync automático' })
    }
    setActivatingWebhook(false)
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/google/disconnect', { method: 'POST' })
      if (res.ok) {
        setGoogleStatus({ connected: false })
        setShowDisconnectConfirm(false)
        setSyncResult(null)
        setWebhookResult(null)
      }
    } catch (err) {
      console.error('Erro ao desconectar:', err)
    }
    setDisconnecting(false)
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
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Google Calendar</h2>
                  <p className="text-sm text-neutral-500">Sincronize sua agenda automaticamente</p>
                </div>
              </div>
              
              {googleStatus?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">Conectado</span>
                  </div>
                  <div className="text-sm text-neutral-500">
                    <p>Calendário: {googleStatus.calendar_id}</p>
                    {googleStatus.last_sync_at && (
                      <p>Última sincronização: {new Date(googleStatus.last_sync_at).toLocaleString('pt-BR')}</p>
                    )}
                    {googleStatus.webhook_active && (
                      <p className="text-emerald-600 font-medium">Sync automático ativo até {new Date(googleStatus.webhook_expiration).toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={syncing ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                      {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </button>
                    {!googleStatus.webhook_active && (
                      <button
                        onClick={handleActivateWebhook}
                        disabled={activatingWebhook}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        <Zap className={activatingWebhook ? 'w-4 h-4 animate-pulse' : 'w-4 h-4'} />
                        {activatingWebhook ? 'Ativando...' : 'Ativar Sync Automático'}
                      </button>
                    )}
                    <button
                      onClick={() => setShowDisconnectConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Unlink className="w-4 h-4" />
                      Desconectar
                    </button>
                  </div>
                  {syncResult && (
                    <div className={syncResult.error ? 'p-4 rounded-lg bg-red-50 text-red-800' : 'p-4 rounded-lg bg-emerald-50 text-emerald-800'}>
                      {syncResult.error ? (
                        <p>{syncResult.error}</p>
                      ) : (
                        <p>Sincronização concluída: {syncResult.imported} importados, {syncResult.updated} atualizados, {syncResult.skipped} ignorados</p>
                      )}
                    </div>
                  )}
                  {webhookResult && (
                    <div className={webhookResult.error ? 'p-4 rounded-lg bg-red-50 text-red-800' : 'p-4 rounded-lg bg-emerald-50 text-emerald-800'}>
                      {webhookResult.error ? (
                        <p>{webhookResult.error}</p>
                      ) : (
                        <p>Sync automático ativado! Eventos do Google Calendar serão importados instantaneamente.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-neutral-500">
                    <X className="w-5 h-5" />
                    <span>Não conectado</span>
                  </div>
                  <a href="/api/google" data-onboarding="connect-google" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Calendar className="w-4 h-4" />
                    Conectar Google Calendar
                  </a>
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
                <button className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors">Exportar Dados</button>
                <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">Excluir Conta</button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">Desconectar Google Calendar?</h3>
            <p className="text-neutral-600 mb-6">A sincronização automática será desativada. As sessões já importadas permanecerão no sistema.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          </div>
        </div>
      )}
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
