'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import AdminStats from '../components/AdminStats'
import AdminCharts from '../components/AdminCharts'
import UserTable, { type LicenseRow } from '../components/UserTable'
import UserDetail from '../components/UserDetail'
import WebhookLogs from '../components/WebhookLogs'
import AlertsPanel from '../components/AlertsPanel'

// =====================================================
// AXIS Admin Dashboard
// Acesso restrito a: porto.ar4@gmail.com, aleporto305@gmail.com
// =====================================================

const ADMIN_EMAILS = new Set([
  'porto.ar4@gmail.com',
  'aleporto305@gmail.com',
])

type Tab = 'overview' | 'users' | 'hotmart' | 'system' | 'alerts'

export default function AdminDashboardPage() {
  const { isSignedIn } = useAuth()
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [authorized, setAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Stats
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')

  // Alerts (independente do stats)
  const [alertCounts, setAlertCounts] = useState<any>(null)
  const [alertsLoading, setAlertsLoading] = useState(true)

  // Users (flat rows)
  const [rows, setRows] = useState<LicenseRow[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [filters, setFilters] = useState({ search: '', product: '', status: '' })
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Detail modal
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    if (isLoaded) {
      const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase()
      if (!email || !ADMIN_EMAILS.has(email)) {
        router.replace('/hub')
      } else {
        setAuthorized(true)
      }
    }
  }, [isLoaded, user])

  // Fetch on auth
  useEffect(() => {
    if (authorized) {
      fetchStats()
      fetchAlerts()
    }
  }, [authorized])

  // Fetch users on filter/page change
  useEffect(() => {
    if (authorized) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchUsers(), 300)
    }
  }, [authorized, filters, usersPage])

  const fetchStats = async () => {
    setStatsLoading(true)
    setStatsError('')
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      } else {
        const data = await res.json().catch(() => ({}))
        setStatsError(data.detail || data.error || `Erro ${res.status}`)
      }
    } catch (e) {
      setStatsError('Erro de conexão ao carregar stats')
    }
    setStatsLoading(false)
  }

  const fetchAlerts = async () => {
    setAlertsLoading(true)
    try {
      const res = await fetch('/api/admin/alerts', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setAlertCounts(data.counts)
      }
    } catch { /* silent */ }
    setAlertsLoading(false)
  }

  const abortRef = useRef<AbortController | null>(null)

  const fetchUsers = async () => {
    // Cancelar request anterior pra evitar race condition
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setUsersLoading(true)
    setUsersError('')
    try {
      const params = new URLSearchParams({ page: String(usersPage) })
      if (filters.search) params.set('search', filters.search)
      if (filters.product) params.set('product', filters.product)
      if (filters.status) params.set('status', filters.status)
      const res = await fetch(`/api/admin/users?${params}`, { signal: controller.signal, cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setRows(data.rows || [])
        setUsersTotal(data.total || 0)
        setUsersTotalPages(data.total_pages || 1)
      } else {
        const data = await res.json().catch(() => ({}))
        setUsersError(data.detail || data.error || `Erro ${res.status}`)
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return // Request cancelado, ignorar
      setUsersError('Erro de conexão')
    }
    setUsersLoading(false)
  }

  const handleFilterChange = (f: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...f }))
    setUsersPage(1)
  }

  const handleRefresh = () => {
    fetchStats()
    fetchAlerts()
    fetchUsers()
  }

  if (!isLoaded || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse space-y-3 text-center">
          <div className="h-8 bg-slate-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-slate-100 rounded w-32 mx-auto" />
        </div>
      </div>
    )
  }

  const hasAlerts = alertCounts && Object.values(alertCounts).some((v: any) => v > 0)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              AXIS Admin
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleRefresh} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Recarregar</button>
            <button onClick={() => router.push('/hub')} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Hub
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {([
            { id: 'overview' as Tab, label: 'Visão Geral' },
            { id: 'users' as Tab, label: 'Usuários & Licenças' },
            { id: 'hotmart' as Tab, label: 'Compras Hotmart' },
            { id: 'system' as Tab, label: 'Eventos Sistema' },
            { id: 'alerts' as Tab, label: 'Alertas' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {tab.id === 'alerts' && hasAlerts && <span className="ml-1.5 w-2 h-2 rounded-full bg-red-500 inline-block" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Quick Search */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Busca rápida por email..."
              className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value
                  setActiveTab('users')
                  handleFilterChange({ search: value })
                }
              }}
            />
          </div>
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <>
            {statsError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
                <strong>Erro ao carregar stats:</strong> {statsError}
                <button onClick={fetchStats} className="ml-3 text-xs font-bold text-red-700 underline">Tentar novamente</button>
              </div>
            )}
            {statsLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}</div>
              </div>
            ) : stats ? (
              <>
                <AdminStats
                  tenantsTotal={stats.tenants_total}
                  newToday={stats.new_today}
                  webhookErrors={stats.webhook_errors_24h}
                  licensesByProduct={stats.licenses_by_product}
                />
                <AdminCharts
                  licensesByProduct={stats.licenses_by_product}
                  signupsByDay={stats.signups_by_day}
                />
              </>
            ) : null}
            <AlertsPanel counts={alertCounts} />
          </>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <UserTable
            rows={rows}
            total={usersTotal}
            page={usersPage}
            totalPages={usersTotalPages}
            loading={usersLoading}
            error={usersError}
            onPageChange={setUsersPage}
            onViewUser={setSelectedTenant}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        )}

        {/* Compras Hotmart */}
        {activeTab === 'hotmart' && <WebhookLogs type="hotmart" title="Transações Hotmart" />}

        {/* Eventos Sistema */}
        {activeTab === 'system' && <WebhookLogs type="system" title="Eventos do Sistema" />}

        {/* Alerts */}
        {activeTab === 'alerts' && (
          alertsLoading ? (
            <div className="animate-pulse h-40 bg-slate-100 rounded-xl" />
          ) : (
            <AlertsPanel counts={alertCounts} />
          )
        )}
      </main>

      {/* Detail Modal */}
      {selectedTenant && (
        <UserDetail
          tenantId={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  )
}
