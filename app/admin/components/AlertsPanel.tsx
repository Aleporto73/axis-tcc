'use client'

import { useState, useEffect } from 'react'

interface AlertCounts {
  duplicate_licenses: number
  orphan_tenants: number
  orphan_licenses: number
  phantom_licenses: number
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

  return (
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
  )
}
