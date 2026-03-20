'use client'

import { useState, useCallback } from 'react'
import { HelpTip } from '@/components/Tooltip'

// =====================================================
// AXIS ABA - GPS Check-in / Check-out (v2.7.0 Sprint 1)
//
// Captura GPS do navegador e envia prova de presença.
// Classificação automática (valid/warning/exception).
// Mostra feedback visual do resultado.
//
// Integra com: POST /api/aba/presence-proofs
// =====================================================

interface PresenceProof {
  id: string
  proof_type: 'checkin' | 'checkout'
  confidence_status: 'valid' | 'warning' | 'exception'
  exception_reason: string | null
  accuracy_meters: number | null
  distance_to_site_meters: number | null
  captured_at: string
}

interface Props {
  sessionId: string
  sessionStatus: string
  serviceMode: string
  existingProofs: PresenceProof[]
  onProofRecorded: () => void
}

const statusConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  valid: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    icon: '✓',
    label: 'GPS válido',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    icon: '⚠',
    label: 'GPS com ressalva',
  },
  exception: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: '✕',
    label: 'Exceção GPS',
  },
}

export default function GPSCheckIn({
  sessionId,
  sessionStatus,
  serviceMode,
  existingProofs,
  onProofRecorded,
}: Props) {
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exceptionReason, setExceptionReason] = useState('')
  const [showExceptionInput, setShowExceptionInput] = useState(false)

  const checkin = existingProofs.find(p => p.proof_type === 'checkin')
  const checkout = existingProofs.find(p => p.proof_type === 'checkout')
  const isActive = sessionStatus === 'in_progress'

  // Telehealth: presença não necessária
  if (serviceMode === 'telehealth') {
    return (
      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2">
        <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-xs text-purple-700">Sessão telehealth — verificação de presença dispensada</span>
      </div>
    )
  }

  const captureGPS = useCallback(async (proofType: 'checkin' | 'checkout') => {
    setCapturing(true)
    setError(null)

    // Verificar suporte a geolocalização
    if (!navigator.geolocation) {
      // GPS indisponível — enviar como exceção
      await sendProof(proofType, {
        gps_denied: true,
        exception_reason: exceptionReason || 'Navegador não suporta geolocalização',
      })
      return
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })

      await sendProof(proofType, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: Math.round(position.coords.accuracy),
        altitude_meters: position.coords.altitude
          ? Math.round(position.coords.altitude)
          : null,
        capture_source: 'browser_gps',
      })
    } catch (geoError: unknown) {
      const err = geoError as GeolocationPositionError
      if (err.code === 1) {
        // Permissão negada — enviar como GPS denied
        setShowExceptionInput(true)
        setCapturing(false)
        return
      }
      // Timeout ou indisponível
      setError(
        err.code === 3
          ? 'Tempo esgotado. Tente novamente em local com melhor sinal.'
          : 'GPS indisponível no momento. Tente novamente.'
      )
      setCapturing(false)
    }
  }, [sessionId, exceptionReason])

  const sendProof = async (
    proofType: 'checkin' | 'checkout',
    payload: Record<string, unknown>
  ) => {
    try {
      const res = await fetch('/api/aba/presence-proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          proof_type: proofType,
          ...payload,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao registrar presença')
        setCapturing(false)
        return
      }
      setShowExceptionInput(false)
      setExceptionReason('')
      setCapturing(false)
      onProofRecorded()
    } catch {
      setError('Falha de conexão')
      setCapturing(false)
    }
  }

  const sendGPSDenied = async (proofType: 'checkin' | 'checkout') => {
    if (!exceptionReason.trim()) {
      setError('Justificativa obrigatória quando GPS é negado')
      return
    }
    setCapturing(true)
    setError(null)
    await sendProof(proofType, {
      gps_denied: true,
      exception_reason: exceptionReason.trim(),
    })
  }

  const nextProofType: 'checkin' | 'checkout' | null = !checkin
    ? 'checkin'
    : !checkout && isActive
      ? 'checkout'
      : null

  return (
    <div className="mb-4 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="text-xs font-medium text-slate-600">Prova de Presença</h3>
        <HelpTip tip="presenca_gps" className="w-3.5 h-3.5 text-[9px]" />
      </div>

      {/* Provas já registradas */}
      <div className="flex flex-wrap gap-2">
        {checkin && (
          <ProofBadge proof={checkin} label="Check-in" />
        )}
        {checkout && (
          <ProofBadge proof={checkout} label="Check-out" />
        )}
        {!checkin && !isActive && (
          <span className="text-[11px] text-slate-400">Nenhuma prova de presença registrada</span>
        )}
      </div>

      {/* Botão de captura */}
      {isActive && nextProofType && !showExceptionInput && (
        <button
          onClick={() => captureGPS(nextProofType)}
          disabled={capturing}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50"
        >
          {capturing ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Capturando GPS...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {nextProofType === 'checkin' ? 'Registrar Check-in' : 'Registrar Check-out'}
            </>
          )}
        </button>
      )}

      {/* Input de justificativa (GPS negado) */}
      {showExceptionInput && (
        <div className="space-y-2">
          <p className="text-[11px] text-amber-700">
            GPS negado pelo dispositivo. Informe a justificativa:
          </p>
          <input
            type="text"
            value={exceptionReason}
            onChange={e => setExceptionReason(e.target.value)}
            placeholder="Ex: Paciente em área sem sinal GPS"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => sendGPSDenied(nextProofType!)}
              disabled={capturing || !exceptionReason.trim()}
              className="px-3 py-1.5 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50"
            >
              {capturing ? 'Enviando...' : 'Confirmar'}
            </button>
            <button
              onClick={() => { setShowExceptionInput(false); setExceptionReason('') }}
              className="px-3 py-1.5 text-slate-400 text-xs hover:text-slate-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-500">{error}</p>
      )}
    </div>
  )
}

// ─── Badge de prova já registrada ─────────────────────
function ProofBadge({ proof, label }: { proof: PresenceProof; label: string }) {
  const config = statusConfig[proof.confidence_status] || statusConfig.warning

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg ${config.bg}`}>
      <span className={`text-xs font-medium ${config.text}`}>
        {config.icon} {label}
      </span>
      <span className={`text-[10px] ${config.text} opacity-75`}>
        {config.label}
        {proof.accuracy_meters !== null && ` · ${proof.accuracy_meters}m`}
        {proof.distance_to_site_meters !== null && ` · ${Math.round(proof.distance_to_site_meters)}m do local`}
      </span>
      <span className="text-[10px] text-slate-400">
        {new Date(proof.captured_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
