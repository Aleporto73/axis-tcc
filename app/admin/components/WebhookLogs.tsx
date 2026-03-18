'use client'

import { useState, useEffect } from 'react'

interface WebhookLog {
  id: string
  tenant_id: string
  user_id: string
  actor: string
  action: string
  entity_type: string
  metadata: string
  created_at: string
}

interface Props {
  type: 'hotmart' | 'system'
  title: string
}

export default function WebhookLogs({ type, title }: Props) {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)
  const [status, setStatus] = useState('')

  useEffect(() => { fetchLogs() }, [days, status, type])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type, days: String(days), limit: '50' })
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/webhooks?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.webhooks || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  const parseMetadata = (meta: string): Record<string, any> => {
    try { return typeof meta === 'string' ? JSON.parse(meta) : meta } catch { return {} }
  }

  const isHotmart = type === 'hotmart'

  return (
    <div className="bg-white rounded-xl border border-slate-100">
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase">{title}</h3>
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-xs">
          <option value="">Todos</option>
          <option value="success">Sucesso</option>
          <option value="error">Erro</option>
        </select>
        <select value={days} onChange={e => setDays(parseInt(e.target.value))} className="px-2 py-1.5 border border-slate-200 rounded text-xs">
          <option value={1}>24h</option>
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
        </select>
        <span className="text-xs text-slate-400 ml-auto">{logs.length} registros</span>
      </div>

      {loading ? (
        <div className="p-8 text-center"><div className="animate-pulse h-20 bg-slate-50 rounded" /></div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">Nenhum registro no período</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase">Data</th>
                {!isHotmart && <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase">Origem</th>}
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase">{isHotmart ? 'Evento' : 'Ação'}</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase">Email</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase">Produto</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase">{isHotmart ? 'Transação' : 'Detalhes'}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const meta = parseMetadata(log.metadata)
                const isError = log.action.includes('FAILED')
                return (
                  <tr key={log.id} className={`border-b border-slate-50 ${isError ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    {!isHotmart && <td className="px-4 py-2 text-slate-600 font-medium">{log.actor}</td>}
                    <td className="px-4 py-2">
                      <span className={`font-medium ${isError ? 'text-red-600' : 'text-slate-700'}`}>
                        {isHotmart ? (meta.event || log.action).replace('HOTMART_', '') : log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{meta.buyer_email || meta.email || '—'}</td>
                    <td className="px-4 py-2 text-slate-500 uppercase">{meta.product_type || '—'}</td>
                    <td className="px-4 py-2 text-slate-400 font-mono max-w-xs truncate">
                      {isHotmart
                        ? (meta.transaction_id || '—')
                        : (meta.source || meta.method || meta.old_clerk_id?.substring(0, 16) || '—')
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
