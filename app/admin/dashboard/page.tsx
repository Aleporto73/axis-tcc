'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import AdminStats from '../components/AdminStats'
import AdminCharts from '../components/AdminCharts'
import UserTable from '../components/UserTable'
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

type Tab = 'overview' | 'users' | 'webhooks' | 'alerts'

export default function AdminDashboardPage() {
  const { isSignedIn } = useAuth()
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [authorized, setAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Stats
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Users
  const [users, setUsers] = useState<any[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [usersLoading, setUsersLoading] = useState(false)
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

  // Fetch stats
  useEffect(() => {
    if (authorized) fetchStats()
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
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) setStats(await res.json())
    } catch { /* silent */ }
    setStatsLoading(false)
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ page: String(usersPage) })
      if (filters.search) params.set('search', filters.search)
      if (filters.product) params.set('product', filters.product)
      if (filters.status) params.set('status', filters.status)
      const res = await fetch(`/api/admin/users?${params}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
        setUsersTotal(data.total || 0)
        setUsersTotalPages(data.total_pages || 1)
      }
    } catch { /* silent */ }
    setUsersLoading(false)
  }

  const handleFilterChange = (f: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...f }))
    setUsersPage(1)
  }

  const handleRefresh = () => {
    fetchStats()
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
          <button
            onClick={() => router.push('/hub')}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Voltar ao Hub
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {([
            { id: 'overview' as Tab, label: 'Visão Geral' },
            { id: 'users' as Tab, label: 'Usuários & Licenças' },
            { id: 'webhooks' as Tab, label: 'Webhooks' },
            { id: 'alerts' as Tab, label: 'Alertas' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {tab.id === 'alerts' && stats?.alerts &&
                Object.values(stats.alerts).some((v: any) => v > 0) && (
                <span className="ml-1.5 w-2 h-2 rounded-full bg-red-500 inline-block" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Quick Search (always visible) */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Busca rápida por email do usuário..."
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {statsLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}</div>
                <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}</div>
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
                <AlertsPanel counts={stats.alerts} />
              </>
            ) : null}
          </>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            {usersLoading && users.length === 0 ? (
              <div className="animate-pulse h-64 bg-slate-100 rounded-xl" />
            ) : (
              <UserTable
                users={users}
                total={usersTotal}
                page={usersPage}
                totalPages={usersTotalPages}
                onPageChange={setUsersPage}
                onViewUser={setSelectedTenant}
                filters={filters}
                onFilterChange={handleFilterChange}
              />
            )}
          </>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && <WebhookLogs />}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <AlertsPanel counts={stats?.alerts || null} />
        )}
      </main>

      {/* User Detail Modal */}
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
