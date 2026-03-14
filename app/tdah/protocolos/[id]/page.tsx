'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// =====================================================
// AXIS TDAH - Detalhe do Protocolo
// Exibe dados, transições de status (Bible §12),
// observações vinculadas, critério de maestria.
// =====================================================

const TDAH_COLOR = '#0d7377'
const TDAH_LIGHT = 'rgba(13, 115, 119, 0.1)'

interface Protocol {
  id: string
  patient_id: string
  patient_name: string
  code: string
  title: string
  block: string
  status: string
  requires_audhd_layer: boolean
  audhd_adaptation_notes: string | null
  protocol_engine_version: string | null
  started_at: string | null
  mastered_at: string | null
  archived_at: string | null
  created_at: string
  library_description: string | null
  library_objective: string | null
  library_measurement: string | null
  library_mastery_criteria: string | null
  library_domain: string | null
}

interface Observation {
  id: string
  observation_type: string
  observation_value: string | null
  score: number | null
  sen_level: string | null
  trf_level: string | null
  notes: string | null
  observed_at: string
}

// Bible §12: Transições válidas
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'archived'],
  active: ['mastered', 'suspended', 'discontinued', 'regression'],
  mastered: ['generalization', 'maintenance', 'archived'],
  generalization: ['maintenance', 'regression', 'suspended'],
  maintenance: ['maintained', 'regression', 'suspended'],
  maintained: ['archived'],
  regression: ['active', 'suspended', 'discontinued'],
  suspended: ['active', 'discontinued', 'archived'],
  discontinued: ['archived'],
}

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', active: 'Ativo', mastered: 'Dominado',
  generalization: 'Generalização', maintenance: 'Manutenção',
  maintained: 'Mantido', regression: 'Regressão',
  suspended: 'Suspenso', discontinued: 'Descontinuado', archived: 'Arquivado',
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  active: 'bg-green-50 text-green-600',
  mastered: 'bg-emerald-50 text-emerald-700',
  generalization: 'bg-blue-50 text-blue-600',
  maintenance: 'bg-indigo-50 text-indigo-600',
  maintained: 'bg-violet-50 text-violet-600',
  regression: 'bg-red-50 text-red-600',
  suspended: 'bg-amber-50 text-amber-600',
  discontinued: 'bg-slate-100 text-slate-400',
  archived: 'bg-slate-50 text-slate-400',
}

const blockLabels: Record<string, string> = {
  A: 'Base', B: 'Executivo', C: 'AuDHD',
  D: 'Acadêmico', E: 'Social', F: 'Emocional', G: 'Autonomia',
}

// Ícones para ações de transição
const transitionStyles: Record<string, { color: string; icon: string }> = {
  active: { color: 'bg-green-500 hover:bg-green-600', icon: '▶' },
  mastered: { color: 'bg-emerald-500 hover:bg-emerald-600', icon: '★' },
  generalization: { color: 'bg-blue-500 hover:bg-blue-600', icon: '↗' },
  maintenance: { color: 'bg-indigo-500 hover:bg-indigo-600', icon: '⟳' },
  maintained: { color: 'bg-violet-500 hover:bg-violet-600', icon: '✓' },
  regression: { color: 'bg-red-500 hover:bg-red-600', icon: '↓' },
  suspended: { color: 'bg-amber-500 hover:bg-amber-600', icon: '⏸' },
  discontinued: { color: 'bg-slate-400 hover:bg-slate-500', icon: '✕' },
  archived: { color: 'bg-slate-300 hover:bg-slate-400', icon: '📦' },
}

export default function ProtocoloDetalhePage() {
  const { id } = useParams()
  const router = useRouter()
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingObs, setLoadingObs] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [showConfirm, setShowConfirm] = useState<string | null>(null)

  const fetchProtocol = useCallback(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/tdah/protocols/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setProtocol(d.protocol); setLoading(false) })
      .catch(() => { setProtocol(null); setLoading(false) })
  }, [id])

  const fetchObservations = useCallback(() => {
    if (!protocol) return
    setLoadingObs(true)
    fetch(`/api/tdah/observations?protocol_id=${id}&limit=20`)
      .then(r => r.json())
      .then(d => { setObservations(d.observations || []); setLoadingObs(false) })
      .catch(() => setLoadingObs(false))
  }, [id, protocol])

  useEffect(() => { fetchProtocol() }, [fetchProtocol])
  useEffect(() => { if (protocol) fetchObservations() }, [protocol?.id])

  const transitionStatus = async (newStatus: string) => {
    setTransitioning(true)
    try {
      const res = await fetch(`/api/tdah/protocols/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        fetchProtocol()
        setShowConfirm(null)
      }
    } catch { /* silent */ }
    setTransitioning(false)
  }

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/3" />
          <div className="h-40 bg-slate-50 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!protocol) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center py-20">
        <p className="text-sm text-slate-500 mb-4">Protocolo não encontrado</p>
        <button onClick={() => router.back()} className="text-sm font-medium" style={{ color: TDAH_COLOR }}>
          &larr; Voltar
        </button>
      </div>
    )
  }

  const allowedTransitions = VALID_TRANSITIONS[protocol.status] || []

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href={`/tdah/pacientes/${protocol.patient_id}`} className="text-slate-400 hover:text-slate-600 transition-colors">
          {protocol.patient_name}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-700">{protocol.code}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: TDAH_LIGHT, color: TDAH_COLOR }}>
            {protocol.block}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{protocol.code} — {protocol.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span>{blockLabels[protocol.block] || protocol.block}</span>
              {protocol.library_domain && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{protocol.library_domain}</span>
                </>
              )}
              {protocol.requires_audhd_layer && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600">AuDHD</span>
                </>
              )}
              {protocol.protocol_engine_version && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{protocol.protocol_engine_version}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusColors[protocol.status] || 'bg-slate-100 text-slate-500'}`}>
          {statusLabels[protocol.status] || protocol.status}
        </span>
      </div>

      {/* Status + Transições */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Ciclo de Vida do Protocolo
        </h2>

        <div className="flex items-center gap-3 mb-4">
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusColors[protocol.status]}`}>
            {statusLabels[protocol.status]}
          </span>
          {allowedTransitions.length > 0 && (
            <span className="text-xs text-slate-400">→</span>
          )}
        </div>

        {allowedTransitions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allowedTransitions.map(target => {
              const style = transitionStyles[target] || { color: 'bg-slate-400 hover:bg-slate-500', icon: '→' }
              return (
                <button
                  key={target}
                  onClick={() => setShowConfirm(target)}
                  disabled={transitioning}
                  className={`px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${style.color}`}
                >
                  {style.icon} {statusLabels[target]}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Este protocolo está em estado final.</p>
        )}

        {/* Timestamps */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-50">
          {protocol.started_at && (
            <div className="text-[10px] text-slate-400">
              <span className="text-slate-500 font-medium">Iniciado:</span>{' '}
              {new Date(protocol.started_at).toLocaleDateString('pt-BR')}
            </div>
          )}
          {protocol.mastered_at && (
            <div className="text-[10px] text-slate-400">
              <span className="text-emerald-600 font-medium">Dominado:</span>{' '}
              {new Date(protocol.mastered_at).toLocaleDateString('pt-BR')}
            </div>
          )}
          {protocol.archived_at && (
            <div className="text-[10px] text-slate-400">
              <span className="text-slate-500 font-medium">Arquivado:</span>{' '}
              {new Date(protocol.archived_at).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
      </div>

      {/* Info da biblioteca */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {(protocol.library_description || protocol.library_objective) && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Descrição</h2>
            {protocol.library_description && (
              <p className="text-sm text-slate-600 leading-relaxed mb-3">{protocol.library_description}</p>
            )}
            {protocol.library_objective && (
              <div>
                <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Objetivo</p>
                <p className="text-sm text-slate-600">{protocol.library_objective}</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Critérios</h2>
          {protocol.library_measurement && (
            <div className="mb-3">
              <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Mensuração</p>
              <p className="text-sm text-slate-600">{protocol.library_measurement}</p>
            </div>
          )}
          {protocol.library_mastery_criteria && (
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Critério de maestria</p>
              <p className="text-sm text-slate-600">{protocol.library_mastery_criteria}</p>
            </div>
          )}
          {!protocol.library_measurement && !protocol.library_mastery_criteria && (
            <p className="text-xs text-slate-400">Sem critérios definidos na biblioteca</p>
          )}
        </div>
      </div>

      {/* Notas AuDHD */}
      {protocol.audhd_adaptation_notes && (
        <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6" style={{ borderLeftColor: '#7c3aed', borderLeftWidth: '3px' }}>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Adaptações AuDHD</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{protocol.audhd_adaptation_notes}</p>
        </div>
      )}

      {/* Observações do protocolo */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Observações vinculadas</h2>
          <span className="text-[10px] text-slate-400">{observations.length} registros</span>
        </div>

        {loadingObs ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="animate-pulse bg-slate-50 rounded-lg h-12" />)}
          </div>
        ) : observations.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">Nenhuma observação registrada para este protocolo</p>
        ) : (
          <div className="space-y-2">
            {observations.map(obs => (
              <div key={obs.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 w-20">
                    {new Date(obs.observed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700">
                    {obs.observation_type}
                  </span>
                  {obs.observation_value && (
                    <span className="text-xs text-slate-600">{obs.observation_value}</span>
                  )}
                  {obs.sen_level && (
                    <span className="px-1 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600">SEN: {obs.sen_level}</span>
                  )}
                  {obs.trf_level && (
                    <span className="px-1 py-0.5 rounded text-[10px] bg-fuchsia-50 text-fuchsia-600">TRF: {obs.trf_level}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {obs.score != null && (
                    <span className="text-sm font-bold" style={{ color: TDAH_COLOR }}>{obs.score}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal confirmação de transição */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-serif text-lg font-light text-slate-800">Confirmar Transição</h2>
              <p className="text-xs text-slate-400 mt-1">
                {statusLabels[protocol.status]} → {statusLabels[showConfirm]}
              </p>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600">
                Deseja alterar o status do protocolo <strong>{protocol.code}</strong> de{' '}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[protocol.status]}`}>
                  {statusLabels[protocol.status]}
                </span>{' '}
                para{' '}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[showConfirm]}`}>
                  {statusLabels[showConfirm]}
                </span>?
              </p>
              {showConfirm === 'mastered' && (
                <p className="text-[10px] text-emerald-600 mt-2 bg-emerald-50 p-2 rounded">
                  mastered_at será registrado automaticamente.
                </p>
              )}
              {(showConfirm === 'regression') && (
                <p className="text-[10px] text-red-600 mt-2 bg-red-50 p-2 rounded">
                  Regressão indica perda de habilidade previamente adquirida.
                </p>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => transitionStatus(showConfirm)}
                disabled={transitioning}
                className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: TDAH_COLOR }}
              >
                {transitioning ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
