'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRole } from '@/app/components/RoleProvider'
import {
  User, Bell, Shield, Database, Calendar, RefreshCw,
  Check, X, Zap, Unlink, Building2, Clock, FileText
} from 'lucide-react'

// =====================================================
// AXIS ABA - Configurações (Multi-Terapeuta, Role-Aware)
// Conforme AXIS ABA Bible v2.6.1:
//   - S13.1 LGPD: Operador (Psiform) vs Controlador (Clínica)
//   - S13.2 Política de Retenção (7a clínico, 5a logs, 90d cancelamento)
//   - S19 Google Calendar Bidirecional (cada terapeuta conecta seu Gmail)
//   - S20 Push Notifications (preferences por user)
//   - Blindagem Jurídica: disclaimer no rodapé
//
// Visibilidade:
//   admin      → tudo + Clínica + Retenção de Dados
//   supervisor → Google Calendar, Perfil, Notificações, Privacidade, Dados
//   terapeuta  → Google Calendar, Perfil, Notificações
// =====================================================

export default function ConfiguracoesABAPage() {
  const { profile: roleProfile, role, isAdmin, isTerapeuta, loading: roleLoading } = useRole()

  // Google Calendar — Bible S19
  const [googleStatus, setGoogleStatus] = useState<any>(null)
  const [googleLoading, setGoogleLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [activatingWebhook, setActivatingWebhook] = useState(false)
  const [webhookResult, setWebhookResult] = useState<any>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [googleCallbackMsg, setGoogleCallbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Perfil pessoal
  const [profileForm, setProfileForm] = useState({ name: '', crp: '' })
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Notificações
  const [notifPrefs, setNotifPrefs] = useState({
    session_reminder: true,
    maintenance_due: true,
    regression_alert: true,
    summary_approved: true,
  })

  // Dados
  const [exporting, setExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletionStatus, setDeletionStatus] = useState<any>(null)
  const [deletionLoading, setDeletionLoading] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)

  // ============================================
  // Detectar callback do Google OAuth (?google=success/error)
  // Conforme Bible S19: callback redireciona para /aba/configuracoes
  // ============================================
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const googleParam = params.get('google')
    if (googleParam) {
      if (googleParam === 'success') {
        setGoogleCallbackMsg({ type: 'success', text: 'Google Calendar conectado com sucesso!' })
      } else {
        const messages: Record<string, string> = {
          error: 'Erro ao conectar Google Calendar. Tente novamente.',
          token_error: 'Erro ao obter autorização do Google. Tente novamente.',
          tenant_error: 'Perfil não encontrado. Verifique se sua conta está ativa.',
          missing_params: 'Parâmetros de autorização incompletos. Tente novamente.',
        }
        setGoogleCallbackMsg({ type: 'error', text: messages[googleParam] || 'Erro desconhecido na conexão.' })
      }
      // Limpar query param da URL sem reload
      window.history.replaceState({}, '', window.location.pathname)
      // Auto-clear msg após 8s
      setTimeout(() => setGoogleCallbackMsg(null), 8000)
    }
  }, [])

  // ============================================
  // Fetch inicial
  // ============================================
  useEffect(() => {
    fetchGoogleStatus()
    fetchProfile()
    if (isAdmin) fetchDeletionStatus()
  }, [isAdmin])

  // ============================================
  // Google Calendar (cada terapeuta conecta o seu)
  // ============================================
  const fetchGoogleStatus = async () => {
    setGoogleLoading(true)
    try {
      const res = await fetch('/api/aba/google/status')
      if (res.ok) {
        const data = await res.json()
        setGoogleStatus(data)
      }
    } catch (err) {
      console.error('Erro ao buscar status Google:', err)
    }
    setGoogleLoading(false)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/aba/google/sync', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data)
      fetchGoogleStatus()
    } catch {
      setSyncResult({ error: 'Erro ao sincronizar' })
    }
    setSyncing(false)
  }

  const handleActivateWebhook = async () => {
    setActivatingWebhook(true)
    setWebhookResult(null)
    try {
      const res = await fetch('/api/aba/google/watch', { method: 'POST' })
      const data = await res.json()
      setWebhookResult(data)
      fetchGoogleStatus()
    } catch {
      setWebhookResult({ error: 'Erro ao ativar sync automático' })
    }
    setActivatingWebhook(false)
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/aba/google/disconnect', { method: 'POST' })
      if (res.ok) {
        setGoogleStatus({ connected: false })
        setShowDisconnectConfirm(false)
        setSyncResult(null)
        setWebhookResult(null)
      }
    } catch {
      console.error('Erro ao desconectar')
    }
    setDisconnecting(false)
  }

  // ============================================
  // Perfil pessoal (lê de profiles via /api/aba/me)
  // ============================================
  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/aba/me')
      if (res.ok) {
        const data = await res.json()
        const p = data.profile
        const crpFormatted = p.crp_uf && p.crp ? `${p.crp_uf}/${p.crp}` : p.crp || ''
        setProfileForm({
          name: p.name || '',
          crp: crpFormatted,
        })
      }
    } catch (err) {
      console.error('Erro ao buscar perfil:', err)
    }
    setProfileLoading(false)
  }

  const saveProfile = async (data: { name: string; crp: string }) => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      console.error('Erro ao salvar perfil')
    }
    setSaving(false)
  }

  const debouncedSave = useCallback(
    debounce((data: { name: string; crp: string }) => saveProfile(data), 1000),
    []
  )

  const handleProfileChange = (field: 'name' | 'crp', value: string) => {
    const updated = { ...profileForm, [field]: value }
    setProfileForm(updated)
    debouncedSave(updated)
  }

  // ============================================
  // Exclusão LGPD — Bible S13.2
  // "Após cancelamento: 90 dias retenção, depois anonimização irreversível"
  // ============================================
  const fetchDeletionStatus = async () => {
    try {
      const res = await fetch('/api/aba/lgpd/delete')
      if (res.ok) {
        const data = await res.json()
        setDeletionStatus(data)
      }
    } catch {
      console.error('Erro ao buscar status de exclusão')
    }
  }

  const handleRequestDeletion = async () => {
    setDeletionLoading(true)
    setDeletionError(null)
    try {
      const res = await fetch('/api/aba/lgpd/delete', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setDeletionError(data.error || 'Erro ao solicitar exclusão')
        return
      }
      setDeletionStatus(data)
      setShowDeleteConfirm(false)
    } catch {
      setDeletionError('Erro de conexão. Tente novamente.')
    } finally {
      setDeletionLoading(false)
    }
  }

  const handleCancelDeletion = async () => {
    setDeletionLoading(true)
    setDeletionError(null)
    try {
      const res = await fetch('/api/aba/lgpd/delete', { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) {
        setDeletionError(data.error || 'Erro ao cancelar exclusão')
        return
      }
      setDeletionStatus(data)
    } catch {
      setDeletionError('Erro de conexão. Tente novamente.')
    } finally {
      setDeletionLoading(false)
    }
  }

  // ============================================
  // Exportação LGPD (Bible S13.2)
  // ============================================
  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/aba/lgpd/export')
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        alert(`Erro ao exportar: ${err.error || 'Falha na requisição'}`)
        return
      }
      // Trigger download do JSON
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Extrair filename do Content-Disposition ou usar padrão
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^"]+)"?/)
      a.download = match?.[1] || `axis_aba_export_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      console.error('Erro ao exportar dados LGPD')
      alert('Erro de conexão ao exportar dados. Tente novamente.')
    }
    setExporting(false)
  }

  // ============================================
  // Render
  // ============================================
  if (roleLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-100 rounded w-48" />
          <div className="h-4 bg-slate-100 rounded w-72" />
          <div className="h-48 bg-slate-50 rounded-xl" />
          <div className="h-48 bg-slate-50 rounded-xl" />
        </div>
      </div>
    )
  }

  // Role badge
  const roleLabel = role === 'admin' ? 'Admin' : role === 'supervisor' ? 'Supervisor Clínico' : 'Terapeuta'
  const roleColor = role === 'admin'
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : role === 'supervisor'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-emerald-100 text-emerald-700 border-emerald-200'

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-800">Configurações</h1>
          <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${roleColor}`}>
            {roleLabel}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {isAdmin
            ? 'Gerencie configurações da clínica e preferências pessoais'
            : 'Gerencie suas preferências pessoais'}
        </p>
      </div>

      <div className="space-y-6">

        {/* ============================================ */}
        {/* SEÇÃO: Clínica (admin only) */}
        {/* Conforme Bible S18: Separação por product_type + company_id */}
        {/* ============================================ */}
        {isAdmin && (
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Clínica</h2>
                <p className="text-sm text-slate-500">Informações da organização</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome da clínica</label>
                <input
                  type="text"
                  value={roleProfile?.tenant_name || ''}
                  readOnly
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Plano</label>
                <input
                  type="text"
                  value={roleProfile?.tenant_plan || 'standard'}
                  readOnly
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Para alterar dados da clínica, entre em contato com o suporte.
            </p>
          </section>
        )}

        {/* ============================================ */}
        {/* SEÇÃO: Google Calendar (todos os roles) */}
        {/* Conforme Bible S19 + docs/GOOGLE_CALENDAR_INTEGRATION.md */}
        {/* Multi-terapeuta: cada profissional conecta seu Gmail */}
        {/* Tokens salvos por profile_id em calendar_connections */}
        {/* ============================================ */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Google Calendar</h2>
              <p className="text-sm text-slate-500">
                Sincronize sua agenda pessoal — cada profissional conecta seu próprio Gmail
              </p>
            </div>
          </div>

          {/* Mensagem de callback OAuth */}
          {googleCallbackMsg && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              googleCallbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {googleCallbackMsg.text}
            </div>
          )}

          {googleLoading ? (
            <div className="space-y-3">
              <div className="h-5 bg-slate-100 rounded w-32 animate-pulse" />
              <div className="h-4 bg-slate-50 rounded w-48 animate-pulse" />
              <div className="h-10 bg-slate-50 rounded w-40 animate-pulse" />
            </div>
          ) : googleStatus?.connected ? (
            <div className="space-y-4">
              {/* Status de conexão */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Check className="w-5 h-5" />
                  <span className="font-medium text-sm">Conectado</span>
                </div>
                {googleStatus.token_expired && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[11px] font-medium">
                    Token expirado — será renovado automaticamente
                  </span>
                )}
              </div>

              {/* Detalhes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Calendário</p>
                  <p className="text-sm text-slate-700 mt-0.5">{googleStatus.calendar_id || 'primary'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Última sincronização</p>
                  <p className="text-sm text-slate-700 mt-0.5">
                    {googleStatus.last_sync_at
                      ? new Date(googleStatus.last_sync_at).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })
                      : 'Nunca sincronizado'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Sync automático</p>
                  {googleStatus.webhook_active ? (
                    <p className="text-sm text-emerald-600 font-medium mt-0.5">
                      Ativo até {new Date(googleStatus.webhook_expiration).toLocaleDateString('pt-BR')}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 mt-0.5">Inativo</p>
                  )}
                </div>
              </div>

              {/* Conectado desde */}
              {googleStatus.connected_at && (
                <p className="text-xs text-slate-400">
                  Conectado desde {new Date(googleStatus.connected_at).toLocaleDateString('pt-BR')}
                </p>
              )}

              {/* Ações */}
              <div className="flex gap-3 flex-wrap pt-1">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={syncing ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                </button>
                {!googleStatus.webhook_active && (
                  <button
                    onClick={handleActivateWebhook}
                    disabled={activatingWebhook}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <Zap className={activatingWebhook ? 'w-4 h-4 animate-pulse' : 'w-4 h-4'} />
                    {activatingWebhook ? 'Ativando...' : 'Ativar Sync Automático'}
                  </button>
                )}
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Unlink className="w-4 h-4" />
                  Desconectar
                </button>
              </div>

              {/* Feedback de sync manual */}
              {syncResult && (
                <div className={`p-3 rounded-lg text-sm ${syncResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {syncResult.error
                    ? syncResult.error
                    : `Sincronização concluída: ${syncResult.imported} importado(s), ${syncResult.updated} atualizado(s), ${syncResult.skipped} ignorado(s)`
                  }
                </div>
              )}

              {/* Feedback de webhook */}
              {webhookResult && (
                <div className={`p-3 rounded-lg text-sm ${webhookResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {webhookResult.error
                    ? webhookResult.error
                    : 'Sync automático ativado! Eventos do Google serão importados em tempo real.'
                  }
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400">
                <X className="w-5 h-5" />
                <span className="text-sm">Não conectado</span>
              </div>
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                <p className="text-sm text-slate-700 mb-3">
                  Conecte seu Google Calendar para sincronizar sessões de forma bidirecional.
                  Eventos criados no Google aparecem no AXIS ABA, e sessões agendadas aqui
                  são enviadas para sua agenda com link do Google Meet.
                </p>
                <a
                  href="/api/aba/google"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Calendar className="w-4 h-4" />
                  Conectar Google Calendar
                </a>
              </div>
              <p className="text-xs text-slate-400">
                Cada profissional da clínica conecta sua própria conta Google.
                Tokens OAuth são armazenados de forma segura por perfil.
              </p>
            </div>
          )}
        </section>

        {/* ============================================ */}
        {/* SEÇÃO: Perfil (todos os roles) */}
        {/* Conforme Bible S14: Terminologia Brasil */}
        {/* ============================================ */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Perfil</h2>
                <p className="text-sm text-slate-500">Informações pessoais e registro profissional</p>
              </div>
            </div>
            {(saving || saved) && (
              <div className={`flex items-center gap-1.5 text-xs ${saved ? 'text-emerald-600' : 'text-slate-400'}`}>
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Salvo
                  </>
                )}
              </div>
            )}
          </div>
          {profileLoading ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aba-500/30 focus:border-aba-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Registro Profissional (CRP/CRFa)
                </label>
                <input
                  type="text"
                  value={profileForm.crp}
                  onChange={(e) => handleProfileChange('crp', e.target.value)}
                  placeholder="UF/00000"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aba-500/30 focus:border-aba-500"
                />
              </div>
            </div>
          )}
        </section>

        {/* ============================================ */}
        {/* SEÇÃO: Notificações (todos os roles) */}
        {/* Conforme Bible S20: Push Notifications */}
        {/* session_reminder, maintenance_due, regression_alert */}
        {/* ============================================ */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <Bell className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Notificações</h2>
              <p className="text-sm text-slate-500">Preferências de alertas e lembretes</p>
            </div>
          </div>
          <div className="space-y-4">
            {/* Lembrete de sessão — Bible S20: 1h antes */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">Lembrete de sessão</p>
                <p className="text-xs text-slate-500">Notificação 1h antes da sessão agendada</p>
              </div>
              <ToggleSwitch
                checked={notifPrefs.session_reminder}
                onChange={(v) => setNotifPrefs(p => ({ ...p, session_reminder: v }))}
              />
            </div>

            {/* Sonda de manutenção — Bible S5: 2/6/12 semanas */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">Sonda de manutenção pendente</p>
                <p className="text-xs text-slate-500">Aviso quando sonda 2/6/12 semanas está próxima</p>
              </div>
              <ToggleSwitch
                checked={notifPrefs.maintenance_due}
                onChange={(v) => setNotifPrefs(p => ({ ...p, maintenance_due: v }))}
              />
            </div>

            {/* Alerta de regressão — Bible S6 */}
            {!isTerapeuta && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Alerta de regressão</p>
                  <p className="text-xs text-slate-500">Notificação quando regressão é detectada em protocolo</p>
                </div>
                <ToggleSwitch
                  checked={notifPrefs.regression_alert}
                  onChange={(v) => setNotifPrefs(p => ({ ...p, regression_alert: v }))}
                />
              </div>
            )}

            {/* Resumo aprovado — Bible S21: terapeuta aprova antes do envio */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">Resumo enviado para responsáveis</p>
                <p className="text-xs text-slate-500">Notificação quando resumo de sessão é aprovado e enviado</p>
              </div>
              <ToggleSwitch
                checked={notifPrefs.summary_approved}
                onChange={(v) => setNotifPrefs(p => ({ ...p, summary_approved: v }))}
              />
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* SEÇÃO: Privacidade (admin + supervisor) */}
        {/* Conforme Bible S13: LGPD, Criptografia, Audit Logs */}
        {/* ============================================ */}
        {!isTerapeuta && (
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Privacidade</h2>
                <p className="text-sm text-slate-500">Segurança e proteção de dados clínicos</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Criptografia de dados</p>
                  <p className="text-xs text-slate-500">Todos os dados clínicos são criptografados em repouso</p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                  Ativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Backup automático</p>
                  <p className="text-xs text-slate-500">Backup diário dos dados da clínica</p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                  Ativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Audit logs</p>
                  <p className="text-xs text-slate-500">Registro imutável de todas as ações (append-only)</p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                  Ativo
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ============================================ */}
        {/* SEÇÃO: Retenção de Dados (admin only) */}
        {/* Conforme Bible S13.2 — Política de Retenção */}
        {/* ============================================ */}
        {isAdmin && (
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Política de Retenção</h2>
                <p className="text-sm text-slate-500">Conforme LGPD e regulamentações CFM/CRP</p>
              </div>
            </div>
            <div className="space-y-3">
              <RetentionRow label="Dados clínicos" period="7 anos" basis="CFM/CRP" />
              <RetentionRow label="Relatórios gerados" period="7 anos" basis="CFM/CRP" />
              <RetentionRow label="Logs de auditoria" period="5 anos" basis="Compliance" />
              <RetentionRow label="Portal família" period="Enquanto vínculo ativo" basis="Consentimento" />
              <RetentionRow label="Histórico de emails" period="5 anos" basis="Compliance" />
              <RetentionRow label="Notificações" period="1 ano" basis="Operacional" />
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                Após cancelamento da conta: período de retenção de 90 dias com exportação disponível.
                Após 90 dias: anonimização irreversível dos dados.
              </p>
            </div>
          </section>
        )}

        {/* ============================================ */}
        {/* SEÇÃO: Dados (admin + supervisor) */}
        {/* Conforme Bible S13.1 LGPD: Portabilidade mediante solicitação */}
        {/* ============================================ */}
        {!isTerapeuta && (
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Database className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Dados</h2>
                <p className="text-sm text-slate-500">Exportação e gerenciamento — LGPD</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {exporting ? 'Exportando...' : 'Exportar Dados (LGPD)'}
              </button>
              {isAdmin && deletionStatus?.status !== 'anonymized' && (
                deletionStatus?.status === 'scheduled' ? (
                  <button
                    onClick={handleCancelDeletion}
                    disabled={deletionLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
                  >
                    {deletionLoading ? 'Processando...' : 'Cancelar Exclusão'}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Excluir Conta
                  </button>
                )
              )}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              A exportação inclui todos os dados clínicos, protocolos, sessões e relatórios
              em formato estruturado, conforme Art. 18 da LGPD.
            </p>

            {/* Status da exclusão agendada */}
            {deletionStatus?.status === 'scheduled' && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-800">
                  Exclusão agendada — {deletionStatus.days_remaining} dia(s) restantes
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Anonimização irreversível programada para{' '}
                  {new Date(deletionStatus.anonymization_date).toLocaleDateString('pt-BR')}.
                  Exporte seus dados antes dessa data.
                </p>
              </div>
            )}

            {deletionStatus?.status === 'anonymized' && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800">
                  Conta anonimizada irreversivelmente
                </p>
                <p className="text-xs text-red-600 mt-1">
                  em {new Date(deletionStatus.anonymized_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}

            {deletionError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{deletionError}</p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ============================================ */}
      {/* DISCLAIMER JURÍDICO — Conforme Blindagem Jurídica */}
      {/* ============================================ */}
      <footer className="mt-10 pt-6 border-t border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-3xl">
          O AXIS ABA é uma ferramenta de apoio à organização de dados clínicos.
          Não realiza diagnóstico, prescrição ou decisão clínica automática.
          O julgamento final é sempre humano. Dados processados conforme LGPD —
          Psiform Tecnologia atua como Operador; a clínica é Controladora dos dados.
          Relatórios estruturados conforme diretrizes SBNI (Outubro 2025) e literatura baseada em evidência.
        </p>
        <p className="text-[10px] text-slate-300 mt-2">
          AXIS ABA v2.6.1 · Psiform Tecnologia · {new Date().getFullYear()}
        </p>
      </footer>

      {/* ============================================ */}
      {/* Modal: Desconectar Google Calendar */}
      {/* ============================================ */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDisconnectConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Desconectar Google Calendar?</h3>
            <p className="text-sm text-slate-600 mb-6">
              A sincronização automática será desativada.
              As sessões já importadas permanecerão no sistema.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* Modal: Excluir Conta */}
      {/* ============================================ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-700 mb-2">Excluir conta permanentemente?</h3>
            <div className="text-sm text-slate-600 space-y-2 mb-6">
              <p>Esta ação iniciará o processo de exclusão da conta conforme LGPD (Art. 18):</p>
              <p className="text-xs text-slate-500">
                1. Período de retenção de 90 dias (dados ainda acessíveis para exportação)
                <br />
                2. Terapeutas serão desativados imediatamente
                <br />
                3. Portal família será desconectado
                <br />
                4. Após 90 dias: anonimização irreversível dos dados pessoais
              </p>
              <p className="text-xs text-amber-600 font-medium mt-2">
                Você poderá cancelar a exclusão durante os 90 dias de retenção.
              </p>
            </div>
            {deletionError && (
              <p className="text-sm text-red-600 mb-3">{deletionError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletionError(null) }}
                className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRequestDeletion}
                disabled={deletionLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deletionLoading ? 'Processando...' : 'Solicitar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Componentes auxiliares
// ============================================

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-aba-500' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function RetentionRow({ label, period, basis }: { label: string; period: string; basis: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-800">{period}</span>
        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">{basis}</span>
      </div>
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
