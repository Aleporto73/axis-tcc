'use client'

import { useState, useCallback, useEffect } from 'react'
import { HelpTip } from '@/components/Tooltip'

// =====================================================
// AXIS ABA - Painel de Evidência (v2.7.0 Sprint 1)
//
// Exibe o status do pacote de evidências da sessão.
// Aparece no painel pós-conclusão (ao lado do resumo).
//
// Bible v2.7.0:
//   - Bundle = snapshot + provas + atestações + anexos
//   - SHA256 hash unificado de todos componentes
//   - Imutável — correção cria nova versão
//   - Status: complete | partial | exception
//
// Integra com: GET/POST /api/aba/evidence-bundles
// =====================================================

interface BundleComponent {
  type: string
  ref_id: string
  individual_hash: string
}

interface EvidenceBundle {
  id: string
  session_id: string
  bundle_hash: string
  components: BundleComponent[]
  status: 'complete' | 'partial' | 'exception'
  missing_items: string[]
  version: number
  generated_at: string
}

interface Props {
  sessionId: string
  sessionStatus: string
}

const bundleStatusConfig: Record<string, { bg: string; border: string; text: string; label: string; icon: string }> = {
  complete: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    label: 'Evidência completa',
    icon: '✓',
  },
  partial: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    label: 'Evidência parcial',
    icon: '⚠',
  },
  exception: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    label: 'Evidência incompleta',
    icon: '✕',
  },
}

const componentLabels: Record<string, string> = {
  clinical_snapshot: 'Snapshot clínico',
  presence_checkin: 'Check-in GPS',
  presence_checkout: 'Check-out GPS',
  attestation_therapist: 'Atestação terapeuta',
  attestation_guardian: 'Atestação responsável',
  declared_site: 'Local declarado',
  session_metadata: 'Metadados',
}

const missingLabels: Record<string, string> = {
  clinical_snapshot: 'Snapshot clínico',
  presence_proof: 'Prova de presença',
  attestation_therapist: 'Atestação do terapeuta',
  declared_site: 'Local declarado',
}

export default function EvidenceCard({ sessionId, sessionStatus }: Props) {
  const [bundle, setBundle] = useState<EvidenceBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCompleted = sessionStatus === 'completed'

  const fetchBundle = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/aba/evidence-bundles?session_id=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        const bundles = data.bundles || []
        // Pegar o mais recente (já vem ordenado por version DESC)
        if (bundles.length > 0) {
          setBundle(bundles[0])
        }
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { fetchBundle() }, [fetchBundle])

  const generateBundle = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/aba/evidence-bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao gerar evidência')
        setGenerating(false)
        return
      }
      await fetchBundle()
      setGenerating(false)
    } catch {
      setError('Falha de conexão')
      setGenerating(false)
    }
  }

  // Só exibir em sessões concluídas
  if (!isCompleted) return null

  if (loading) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <span className="text-[11px] text-slate-400 animate-pulse">Carregando evidência...</span>
      </div>
    )
  }

  // Sem bundle — oferecer gerar
  if (!bundle) {
    return (
      <div className="p-3 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h3 className="text-xs font-medium text-slate-600">Pacote de Evidência</h3>
          <HelpTip tip="evidencia_bundle" className="w-3.5 h-3.5 text-[9px]" />
        </div>
        <p className="text-[11px] text-slate-400">Nenhum pacote gerado para esta sessão.</p>
        <button
          onClick={generateBundle}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50"
        >
          {generating ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Gerando...
            </>
          ) : (
            'Gerar Pacote de Evidência'
          )}
        </button>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
    )
  }

  // Bundle existente
  const config = bundleStatusConfig[bundle.status] || bundleStatusConfig.partial
  const components = typeof bundle.components === 'string'
    ? JSON.parse(bundle.components)
    : bundle.components || []

  return (
    <div className={`p-3 border rounded-xl space-y-2 ${config.bg} ${config.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h3 className="text-xs font-medium text-slate-600">Pacote de Evidência</h3>
          <HelpTip tip="evidencia_bundle" className="w-3.5 h-3.5 text-[9px]" />
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${config.text} ${config.bg}`}>
          {config.icon} {config.label}
        </span>
      </div>

      {/* Componentes coletados */}
      <div className="flex flex-wrap gap-1">
        {components.map((comp: BundleComponent, i: number) => {
          const label = componentLabels[comp.type] || comp.type.replace(/_/g, ' ').replace(/^attachment /, '📎 ')
          return (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/60 rounded text-[10px] text-slate-600">
              <svg className="w-2.5 h-2.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {label}
            </span>
          )
        })}
      </div>

      {/* Itens faltantes */}
      {bundle.missing_items && bundle.missing_items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {bundle.missing_items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/60 rounded text-[10px] text-red-500">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              {missingLabels[item] || item}
            </span>
          ))}
        </div>
      )}

      {/* Metadados do bundle */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-white/30">
        <span>v{bundle.version}</span>
        <span>{components.length} componentes</span>
        <span title={bundle.bundle_hash}>
          SHA256: {bundle.bundle_hash.substring(0, 12)}…
        </span>
        <span>
          {new Date(bundle.generated_at).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <button
          onClick={generateBundle}
          disabled={generating}
          className="text-[11px] text-aba-500 hover:underline disabled:opacity-50"
        >
          {generating ? 'Regenerando...' : 'Regenerar bundle'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
