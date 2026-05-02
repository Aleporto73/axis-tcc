'use client'

import { useState, useEffect } from 'react'

interface AlertCounts {
  duplicate_licenses: number
  orphan_tenants: number
  orphan_licenses: number
  phantom_licenses: number
}

interface SystemAlertCounts {
  unresolved: number
  critical: number
  warnings: number
  info: number
}

interface SystemAlert {
  id: string
  module: string
  severity: string
  source: string
  code: string | null
  message: string
  context: Record<string, unknown>
  resolved: boolean
  created_at: string
}

interface Props {
  counts: AlertCounts | null
}

const ALERT_TYPES = [
  { key: 'duplicate_licenses', label: 'Licenças Duplicadas', desc: 'Mesmo tenant + mesmo produto com múltiplas licenças ativas', queryParam: 'duplicates' },
  { key: 'orphan_tenants', label: 'Tenants sem Profile', desc: 'Tenant existe mas não tem profile associado', queryParam: 'orphan_tenants' },
  { key: 'orphan_licenses', label: 'Licenças Órfãs', desc: 'Licença sem tenant válido', queryParam: 'orphan_licenses' },
  { key: 'phantom_licenses', label: 'Licenças Fantasma', desc: 'Criadas por auto-provisioning (CLERK_FREE_TIER) ainda ativas', queryParam: 'phantom' },
] as const

export default function AlertsPanel({ counts }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // System alerts state
  const [systemCounts, setSystemCounts] = useState<SystemAlertCounts | null>(null)
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [showSystem, setShowSystem] = useState(false)
  const [systemLoading, setSystemLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // Fetch system alert counts on mount
  useEffect(() => {
    fetchSystemCounts()
  }, [])

  const fetchSystemCounts = async () => {
    try {
      const res = await fetch('/api/admin/system-alerts?resolved=false&limit=1')
      if (res.ok) {
        const data = await res.json()
        setSystemCounts(data.counts || null)
      }
    } catch { /* silent */ }
  }

  const fetchSystemAlerts = async () => {
    if (showSystem) { setShowSystem(false); return }
    setShowSystem(true)
    setSystemLoading(true)
    try {
      const res = await fetch('/api/admin/system-alerts?resolved=false&limit=50')
      if (res.ok) {
        const data = await res.json()
        setSystemAlerts(data.alerts || [])
        setSystemCounts(data.counts || null)
      }
    } catch { /* silent */ }
    setSystemLoading(false)
  }

  const resolveAlert = async (alertId: string) => {
    setResolvingId(alertId)
    try {
      const res = await fetch('/api/admin/system-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId, resolved: true }),
      })
      if (res.ok) {
        setSystemAlerts(prev => prev.filter(a => a.id !== alertId))
        fetchSystemCounts()
      }
    } catch { /* silent */ }
    setResolvingId(null)
  }

  const fetchDetails = async (type: string) => {
    if (expanded === type) { setExpanded(null); return }
    setExpanded(type)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/alerts?type=${type}`)
      if (res.ok) {
        const data = await res.json()
        setDetails(data.details || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  if (!counts) return null

  const hasAnyAlert = Object.values(counts).some(v => v > 0)
  const hasSystemAlerts = systemCounts && Number(systemCounts.unresolved) > 0

  const severityColor = (sev: string) => {
    if (sev === 'critical') return 'text-red-600 bg-red-50'
    if (sev === 'warning') return 'text-amber-600 bg-amber-50'
    return 'text-blue-600 bg-blue-50'
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  return (
    <div className="space-y-4">
      {/* Integrity Alerts (existing) */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            Alertas de Integridade
            {hasAnyAlert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </h3>
        </div>

        <div className="divide-y divide-slate-50">
          {ALERT_TYPES.map(alert => {
            const count = counts[alert.key as keyof AlertCounts]
            const isOpen = expanded === alert.queryParam
            return (
              <div key={alert.key}>
                <button
                  onClick={() => fetchDetails(alert.queryParam)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-700">{alert.label}</p>
                    <p className="text-[10px] text-slate-400">{alert.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${count > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {count}
                    </span>
                    {count > 0 && (
                      <span className="text-[10px] text-blue-500 font-medium">{isOpen ? 'Fechar' : 'Detalhes'}</span>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-3">
                    {loading ? (
                      <div className="animate-pulse h-12 bg-slate-50 rounded" />
                    ) : details.length === 0 ? (
                      <p className="text-xs text-slate-400">Sem detalhes</p>
                    ) : (
                      <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <pre className="text-[10px] text-slate-600 whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* System Alerts (new — from system_alerts table) */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="p-4 border-b border-slate-100">
          <button
            onClick={fetchSystemAlerts}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Erros de Sistema
              {hasSystemAlerts && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </h3>
            <div className="flex items-center gap-3">
              {systemCounts && (
                <>
                  {Number(systemCounts.critical) > 0 && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      {systemCounts.critical} critical
                    </span>
                  )}
                  {Number(systemCounts.warnings) > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      {systemCounts.warnings} warning
                    </span>
                  )}
                  <span className="text-lg font-bold text-slate-600">
                    {systemCounts.unresolved}
                  </span>
                </>
              )}
              <span className="text-[10px] text-blue-500 font-medium">
                {showSystem ? 'Fechar' : 'Ver'}
              </span>
            </div>
          </button>
        </div>

        {showSystem && (
          <div className="p-4">
            {systemLoading ? (
              <div className="space-y-2">
                <div className="animate-pulse h-10 bg-slate-50 rounded" />
                <div className="animate-pulse h-10 bg-slate-50 rounded" />
              </div>
            ) : systemAlerts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Nenhum alerta pendente</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {systemAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="bg-slate-50 rounded-lg p-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${severityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-400">{alert.module}</span>
                        {alert.code && (
                          <span className="text-[10px] text-slate-500 font-mono">{alert.code}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 truncate">{alert.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400">{alert.source}</span>
                        <span className="text-[10px] text-slate-300">{formatDate(alert.created_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      disabled={resolvingId === alert.id}
                      className="text-[10px] text-green-600 font-medium hover:text-green-800 disabled:opacity-50 shrink-0 px-2 py-1 rounded hover:bg-green-50 transition-colors"
                    >
                      {resolvingId === alert.id ? '...' : 'Resolver'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
