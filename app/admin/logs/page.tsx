'use client'

import { useState, useEffect } from 'react'
import { Shield, Clock, User, Filter, RefreshCw } from 'lucide-react'

interface AuditLog {
  id: string
  user_id: string
  actor: string
  action: string
  entity_type: string
  entity_id: string
  metadata: any
  axis_version: string
  created_at: string
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const loadLogs = async () => {
    setLoading(true)
    try {
      const url = filter ? `/api/audit?action=${filter}&limit=100` : '/api/audit?limit=100'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (e) {
      console.error('Erro ao carregar logs:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [filter])

  const actionColors: Record<string, string> = {
    'REPORT_VIEW': 'bg-blue-100 text-blue-700',
    'SESSION_START': 'bg-green-100 text-green-700',
    'SESSION_FINISH': 'bg-emerald-100 text-emerald-700',
    'EVENT_MARK': 'bg-purple-100 text-purple-700',
    'PATIENT_CREATE': 'bg-amber-100 text-amber-700',
    'SUPERVISION_CONTEXT_ADD': 'bg-indigo-100 text-indigo-700',
    'SUGGESTION_ACCEPT': 'bg-teal-100 text-teal-700',
    'SUGGESTION_REJECT': 'bg-red-100 text-red-700'
  }

  const actionLabels: Record<string, string> = {
    'REPORT_VIEW': 'Visualizou Relatório',
    'SESSION_START': 'Iniciou Sessão',
    'SESSION_FINISH': 'Finalizou Sessão',
    'EVENT_MARK': 'Marcou Evento',
    'PATIENT_CREATE': 'Criou Paciente',
    'SUPERVISION_CONTEXT_ADD': 'Adicionou Contexto',
    'SUGGESTION_ACCEPT': 'Aceitou Sugestão',
    'SUGGESTION_REJECT': 'Rejeitou Sugestão'
  }

  const actions = [
    'REPORT_VIEW',
    'SESSION_START', 
    'SESSION_FINISH',
    'EVENT_MARK',
    'PATIENT_CREATE',
    'SUPERVISION_CONTEXT_ADD',
    'SUGGESTION_ACCEPT',
    'SUGGESTION_REJECT'
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
                <p className="text-slate-500 text-sm">AXIS_AUDIT_FRAMEWORK_v1.0 - Registro de decisões humanas</p>
              </div>
            </div>
            <button onClick={loadLogs} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-xs text-amber-700">
            <strong>Uso interno.</strong> Estes logs registram apenas metadados de ações. Nenhum conteúdo clínico é armazenado.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600 font-medium">Filtrar:</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="">Todas as ações</option>
              {actions.map(action => (<option key={action} value={action}>{actionLabels[action]}</option>))}
            </select>
            <span className="text-xs text-slate-400 ml-auto">{logs.length} registros</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Nenhum log encontrado</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start gap-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${actionColors[log.action] || 'bg-slate-100 text-slate-700'}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <User className="w-3 h-3" />
                        <span className="font-mono text-xs">{log.user_id?.slice(0, 20)}...</span>
                        <span className="text-slate-300">|</span>
                        <span>{log.entity_type}</span>
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-1 text-xs text-slate-400 font-mono">{JSON.stringify(log.metadata)}</div>
                      )}
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(log.created_at).toLocaleDateString('pt-BR')}</div>
                      <div>{new Date(log.created_at).toLocaleTimeString('pt-BR')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">Logs imutáveis. Nenhum dado clínico registrado.</p>
        </div>
      </div>
    </div>
  )
}
