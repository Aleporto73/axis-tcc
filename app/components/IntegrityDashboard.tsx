'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, RefreshCw, Eye, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { HelpTip } from '@/components/Tooltip'

// =====================================================
// AXIS ABA - Painel de Conformidade (v2.7.0 Sprint 3)
//
// Dashboard de flags de integridade para admin/supervisor.
// Mostra contadores por severidade, lista de flags ativas,
// e permite revisão/resolução inline.
//
// Integra com: GET /api/aba/integrity-flags
//              PATCH /api/aba/integrity-flags/[id]
//              POST /api/aba/integrity-flags (trigger scan)
// =====================================================

interface IntegrityFlag {
  id: string
  entity_type: string
  entity_id: string
  rule_code: string
  severity: 'info' | 'warning' | 'critical'
  description: string
  metadata: Record<string, unknown> | null
  first_detected_at: string
  last_detected_at: string
  status: string
  reviewed_by: string | null
  reviewed_by_name?: string
  reviewed_at: string | null
  review_notes: string | null
  auto_resolved: boolean
}

interface SeverityCount {
  severity: string
  active_count: string
  total_count: string
}

interface Props {
  canEdit: boolean
}

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; icon: typeof ShieldAlert; label: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: ShieldAlert, label: 'Crítico' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle, label: 'Atenção' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Info, label: 'Info' },
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-red-50', text: 'text-red-600', label: 'Aberto' },
  reviewing: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Em Revisão' },
  resolved: { bg: 'bg-green-50', text: 'text-green-600', label: 'Resolvido' },
  waived: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Dispensado' },
}

const ENTITY_LABELS: Record<string, string> = {
  session: 'Sessão',
  provider: 'Profissional',
  packet: 'Pacote',
  learner: 'Aprendiz',
  coverage: 'Cobertura',
}

const RULE_LABELS: Record<string, string> = {
  OVERLAP_SESSIONS: 'Sessões sobrepostas',
  EXCESSIVE_DURATION: 'Duração excessiva',
  RECURRENT_EXCEPTION: 'Exceções recorrentes',
  EXPIRED_COUNCIL: 'Conselho vencido',
  EXPIRED_COVERAGE: 'Cobertura expirada',
  DUPLICATE_PHOTO: 'Foto duplicada',
  MISSING_GEO_REQUIRED: 'GPS ausente',
  NO_ATTESTATION: 'Sem atestação',
  HOURS_EXCEEDED: 'Horas excedidas',
  INCOMPLETE_PACKET: 'Pacote incompleto',
}

export default function IntegrityDashboard({ canEdit }: Props) {
  const [flags, setFlags] = useState<IntegrityFlag[]>([])
  const [counts, setCounts] = useState<SeverityCount[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<{ total_flags: number; inserted: number; auto_resolved: number } | null>(null)

  const fetchFlags = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (filter !== 'all') params.set('severity', filter)
      if (statusFilter === 'active') {
        params.set('status', 'open')
      }

      const res = await fetch(`/api/aba/integrity-flags?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar flags')
      const data = await res.json()
      setFlags(data.flags || [])
      setCounts(data.counts || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [filter, statusFilter])

  useEffect(() => { fetchFlags() }, [fetchFlags])

  const triggerScan = async () => {
    setScanning(true)
    setScanResult(null)
    setError(null)
    try {
      const res = await fetch('/api/aba/integrity-flags', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao executar scan')
      }
      const data = await res.json()
      setScanResult(data.scan)
      await fetchFlags()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro no scan')
    } finally {
      setScanning(false)
    }
  }

  const handleAction = async (flagId: string, newStatus: string) => {
    if (newStatus === 'waived') {
      const flag = flags.find(f => f.id === flagId)
      if (flag?.severity === 'critical' && !reviewNotes.trim()) {
        setError('Flag crítica exige justificativa para dispensar')
        return
      }
    }

    setActionLoading(flagId)
    setError(null)
    try {
      const res = await fetch(`/api/aba/integrity-flags/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          review_notes: reviewNotes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao atualizar flag')
      }
      setReviewNotes('')
      setExpandedId(null)
      await fetchFlags()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setActionLoading(null)
    }
  }

  const getCount = (severity: string) => {
    const c = counts.find(c => c.severity === severity)
    return c ? parseInt(c.active_count, 10) : 0
  }

  const criticalCount = getCount('critical')
  const warningCount = getCount('warning')
  const infoCount = getCount('info')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            criticalCount > 0 ? 'bg-red-100' : 'bg-green-50'
          }`}>
            <ShieldAlert className={`w-6 h-6 ${criticalCount > 0 ? 'text-red-600' : 'text-green-600'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Conformidade</h2>
              <HelpTip tip="config_audit_logs" className="w-4 h-4 text-[10px]" />
            </div>
            <p className="text-sm text-slate-500">
              Alertas de integridade e auditoria do sistema
            </p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Analisando...' : 'Executar Scan'}
          </button>
        )}
      </div>

      {/* Scan result banner */}
      {scanResult && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Scan concluído — {scanResult.total_flags} flag{scanResult.total_flags !== 1 ? 's' : ''} detectada{scanResult.total_flags !== 1 ? 's' : ''},
          {' '}{scanResult.inserted} nova{scanResult.inserted !== 1 ? 's' : ''},
          {' '}{scanResult.auto_resolved} auto-resolvida{scanResult.auto_resolved !== 1 ? 's' : ''}
        </div>
      )}

      {/* Severity counters */}
      <div className="grid grid-cols-3 gap-3">
        {(['critical', 'warning', 'info'] as const).map(sev => {
          const cfg = SEVERITY_CONFIG[sev]
          const count = getCount(sev)
          const Icon = cfg.icon
          const isActive = filter === sev

          return (
            <button
              key={sev}
              onClick={() => setFilter(f => f === sev ? 'all' : sev)}
              className={`p-3 rounded-lg border transition-colors text-left ${
                isActive
                  ? `${cfg.bg} ${cfg.border} border-2`
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${cfg.text}`} />
                <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${count > 0 ? cfg.text : 'text-slate-300'}`}>
                {count}
              </p>
            </button>
          )
        })}
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            statusFilter === 'active'
              ? 'bg-aba-500 text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          Ativos
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-aba-500 text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-[11px] text-red-500 bg-red-50 p-2 rounded">{error}</p>
      )}

      {/* Flags list */}
      {loading ? (
        <div className="text-sm text-slate-400 animate-pulse">Carregando flags...</div>
      ) : flags.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">
          {filter === 'all' && statusFilter === 'active'
            ? 'Nenhum alerta ativo — sistema em conformidade'
            : 'Nenhuma flag encontrada com esses filtros'
          }
        </div>
      ) : (
        <div className="space-y-2">
          {flags.map(flag => {
            const sevCfg = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.info
            const statusCfg = STATUS_CONFIG[flag.status] || STATUS_CONFIG.open
            const isExpanded = expandedId === flag.id
            const SevIcon = sevCfg.icon

            return (
              <div key={flag.id} className={`border rounded-lg transition-colors ${
                isExpanded ? `${sevCfg.border} ${sevCfg.bg}` : 'border-slate-200 hover:border-slate-300'
              }`}>
                {/* Flag row */}
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : flag.id)
                    setReviewNotes(flag.review_notes || '')
                  }}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SevIcon className={`w-4 h-4 flex-shrink-0 ${sevCfg.text}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-700">
                          {RULE_LABELS[flag.rule_code] || flag.rule_code}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sevCfg.bg} ${sevCfg.text}`}>
                          {sevCfg.label}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                          {statusCfg.label}
                        </span>
                        {flag.auto_resolved && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600">
                            Auto
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {ENTITY_LABELS[flag.entity_type] || flag.entity_type}
                        {' · '}
                        {flag.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-[10px] text-slate-400">
                      {new Date(flag.last_detected_at).toLocaleDateString('pt-BR')}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Primeira detecção</span>
                        <span className="text-xs text-slate-600">
                          {new Date(flag.first_detected_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Última detecção</span>
                        <span className="text-xs text-slate-600">
                          {new Date(flag.last_detected_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    {flag.metadata && Object.keys(flag.metadata).length > 0 && (
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Detalhes</span>
                        <div className="bg-white/60 rounded p-2 text-[11px] text-slate-600 font-mono">
                          {Object.entries(flag.metadata).map(([k, v]) => (
                            <div key={k}>{k}: {String(v)}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {flag.reviewed_by && (
                      <div className="text-[11px] text-slate-400">
                        Revisado por {flag.reviewed_by_name || flag.reviewed_by}
                        {flag.reviewed_at && ` em ${new Date(flag.reviewed_at).toLocaleString('pt-BR')}`}
                      </div>
                    )}

                    {/* Actions (only for open/reviewing, non-auto-resolved, with edit permission) */}
                    {canEdit && !flag.auto_resolved && ['open', 'reviewing'].includes(flag.status) && (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Notas de revisão
                            {flag.severity === 'critical' && ' (obrigatório para dispensar)'}
                          </label>
                          <input
                            type="text"
                            value={reviewNotes}
                            onChange={e => setReviewNotes(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-aba-500"
                            placeholder="Justificativa ou observações..."
                          />
                        </div>
                        <div className="flex gap-2">
                          {flag.status === 'open' && (
                            <button
                              onClick={() => handleAction(flag.id, 'reviewing')}
                              disabled={actionLoading === flag.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 text-white text-[11px] font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                            >
                              <Eye className="w-3 h-3" /> Revisar
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(flag.id, 'resolved')}
                            disabled={actionLoading === flag.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-500 text-white text-[11px] font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3 h-3" /> Resolver
                          </button>
                          <button
                            onClick={() => handleAction(flag.id, 'waived')}
                            disabled={actionLoading === flag.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-400 text-white text-[11px] font-medium rounded-lg hover:bg-slate-500 transition-colors disabled:opacity-50"
                          >
                            Dispensar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
