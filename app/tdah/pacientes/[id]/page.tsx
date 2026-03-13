'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// =====================================================
// AXIS TDAH - Ficha do Paciente (Fase 3)
// Exibe dados, sessões recentes, protocolos ativos.
// Gráficos CSO e AuDHD layer em fase futura.
// =====================================================

const TDAH_COLOR = '#0d7377'
const TDAH_LIGHT = 'rgba(13, 115, 119, 0.1)'

interface Patient {
  id: string
  name: string
  birth_date: string | null
  gender: string | null
  diagnosis: string | null
  cid_code: string | null
  support_level: number | null
  school_name: string | null
  school_contact: string | null
  teacher_name: string | null
  teacher_email: string | null
  clinical_notes: string | null
  status: string
  audhd_layer_status: string | null
  audhd_layer_activated_at: string | null
  audhd_layer_reason: string | null
  total_sessions: number
  active_protocols: number
  created_at: string
}

interface Session {
  id: string
  patient_name: string
  session_number: number | null
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  status: string
  session_context: string
  session_notes: string | null
}

interface Protocol {
  id: string
  code: string
  title: string
  block: string
  status: string
  requires_audhd_layer: boolean
  started_at: string | null
  mastered_at: string | null
  library_domain: string | null
}

interface LibraryProtocol {
  id: string
  code: string
  title: string
  block: string
  priority: string
  domain: string | null
  requires_audhd_layer: boolean
  description: string | null
}

interface CsoScore {
  id: string
  session_number: number | null
  session_context: string | null
  core_score: number | null
  executive_score: number | null
  audhd_layer_score: number | null
  final_score: number | null
  final_band: string
  confidence_flag: string
  snapshot_at: string
}

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-600',
  in_progress: 'bg-amber-50 text-amber-600',
  completed: 'bg-green-50 text-green-600',
  cancelled: 'bg-slate-100 text-slate-400',
}

const contextLabels: Record<string, string> = {
  clinical: 'Clínico',
  home: 'Domiciliar',
  school: 'Escolar',
}

const protocolStatusLabels: Record<string, string> = {
  draft: 'Rascunho', active: 'Ativo', mastered: 'Dominado',
  generalization: 'Generalização', maintenance: 'Manutenção',
  maintained: 'Mantido', regression: 'Regressão',
  suspended: 'Suspenso', discontinued: 'Descontinuado', archived: 'Arquivado',
}

const protocolStatusColors: Record<string, string> = {
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

function calcAge(birth: string): string {
  const b = new Date(birth)
  const now = new Date()
  let years = now.getFullYear() - b.getFullYear()
  let months = now.getMonth() - b.getMonth()
  if (months < 0) { years--; months += 12 }
  if (years < 1) return `${months} meses`
  if (years < 6) return `${years} anos e ${months} meses`
  return `${years} anos`
}

function formatDatetime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const bandColors: Record<string, string> = {
  excelente: 'bg-emerald-50 text-emerald-700',
  bom: 'bg-green-50 text-green-600',
  atencao: 'bg-amber-50 text-amber-600',
  critico: 'bg-red-50 text-red-600',
  sem_dados: 'bg-slate-100 text-slate-400',
}

const bandLabels: Record<string, string> = {
  excelente: 'Excelente',
  bom: 'Bom',
  atencao: 'Atenção',
  critico: 'Crítico',
  sem_dados: 'Sem dados',
}

function BandBadge({ band }: { band: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${bandColors[band] || 'bg-slate-100 text-slate-400'}`}>
      {bandLabels[band] || band}
    </span>
  )
}

function CsoChart({ scores }: { scores: CsoScore[] }) {
  // Reverse to chronological order (API returns DESC)
  const data = [...scores].reverse().filter(s => s.final_score != null)
  if (data.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-16">Sem dados suficientes para gráfico</p>
  }

  const W = 600
  const H = 160
  const PAD_X = 40
  const PAD_Y = 20
  const chartW = W - PAD_X * 2
  const chartH = H - PAD_Y * 2

  const maxScore = 100
  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW / 2

  const toPoint = (idx: number, value: number) => ({
    x: PAD_X + (data.length > 1 ? idx * xStep : chartW / 2),
    y: PAD_Y + chartH - (value / maxScore) * chartH,
  })

  // Final score line
  const finalPoints = data.map((s, i) => toPoint(i, Number(s.final_score)))
  const finalPath = finalPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  // Core score line
  const corePoints = data.filter(s => s.core_score != null).map((s, i) => {
    const idx = data.indexOf(s)
    return toPoint(idx, Number(s.core_score))
  })
  const corePath = corePoints.length > 1 ? corePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') : ''

  // Band zones
  const zones = [
    { y: 0, h: 30, color: 'rgba(239, 68, 68, 0.04)' },   // critico
    { y: 30, h: 20, color: 'rgba(245, 158, 11, 0.04)' },  // atencao
    { y: 50, h: 20, color: 'rgba(34, 197, 94, 0.04)' },   // bom
    { y: 70, h: 30, color: 'rgba(16, 185, 129, 0.04)' },  // excelente
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Band zones */}
      {zones.map((z, i) => (
        <rect key={i}
          x={PAD_X} y={PAD_Y + chartH - ((z.y + z.h) / 100) * chartH}
          width={chartW} height={(z.h / 100) * chartH}
          fill={z.color} />
      ))}

      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(v => {
        const y = PAD_Y + chartH - (v / 100) * chartH
        return (
          <g key={v}>
            <line x1={PAD_X} y1={y} x2={PAD_X + chartW} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={PAD_X - 6} y={y + 3} textAnchor="end" fill="#94a3b8" fontSize={9}>{v}</text>
          </g>
        )
      })}

      {/* Core line (dashed, lighter) */}
      {corePath && (
        <path d={corePath} fill="none" stroke="#0d737766" strokeWidth={1.5} strokeDasharray="4,3" />
      )}

      {/* Final score line */}
      <path d={finalPath} fill="none" stroke={TDAH_COLOR} strokeWidth={2.5} strokeLinejoin="round" />

      {/* Dots */}
      {finalPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="white" stroke={TDAH_COLOR} strokeWidth={2} />
      ))}

      {/* Legend */}
      <line x1={PAD_X} y1={H - 4} x2={PAD_X + 15} y2={H - 4} stroke={TDAH_COLOR} strokeWidth={2} />
      <text x={PAD_X + 18} y={H - 1} fill="#64748b" fontSize={8}>Final</text>
      <line x1={PAD_X + 50} y1={H - 4} x2={PAD_X + 65} y2={H - 4} stroke="#0d737766" strokeWidth={1.5} strokeDasharray="4,3" />
      <text x={PAD_X + 68} y={H - 1} fill="#64748b" fontSize={8}>Base</text>
    </svg>
  )
}

export default function PacienteDetalhePage() {
  const { id } = useParams()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [library, setLibrary] = useState<LibraryProtocol[]>([])
  const [scores, setScores] = useState<CsoScore[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingProtocols, setLoadingProtocols] = useState(true)
  const [loadingScores, setLoadingScores] = useState(true)
  const [showLibrary, setShowLibrary] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)
  const [togglingAudhd, setTogglingAudhd] = useState(false)
  const [audhdReason, setAudhdReason] = useState('')
  const [showAudhdConfirm, setShowAudhdConfirm] = useState<string | null>(null)

  const fetchPatient = useCallback(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/tdah/patients/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(d => { setPatient(d.patient); setLoading(false) })
      .catch(() => { setPatient(null); setLoading(false) })
  }, [id])

  const fetchSessions = useCallback(() => {
    if (!id) return
    setLoadingSessions(true)
    fetch(`/api/tdah/sessions?patient_id=${id}`)
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoadingSessions(false) })
      .catch(() => setLoadingSessions(false))
  }, [id])

  const fetchProtocols = useCallback(() => {
    if (!id) return
    setLoadingProtocols(true)
    fetch(`/api/tdah/protocols?patient_id=${id}`)
      .then(r => r.json())
      .then(d => { setProtocols(d.protocols || []); setLoadingProtocols(false) })
      .catch(() => setLoadingProtocols(false))
  }, [id])

  const fetchLibrary = useCallback(() => {
    fetch('/api/tdah/protocol-library')
      .then(r => r.json())
      .then(d => setLibrary(d.protocols || []))
      .catch(() => {})
  }, [])

  const activateProtocol = async (libraryId: string) => {
    setActivating(libraryId)
    try {
      const res = await fetch('/api/tdah/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: id, library_protocol_id: libraryId }),
      })
      if (res.ok) {
        fetchProtocols()
        fetchPatient()
      }
    } catch { /* silent */ }
    setActivating(null)
  }

  const toggleAudhd = async (newStatus: string) => {
    setTogglingAudhd(true)
    try {
      const res = await fetch(`/api/tdah/patients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audhd_layer_status: newStatus,
          audhd_layer_reason: audhdReason.trim() || null,
        }),
      })
      if (res.ok) {
        fetchPatient()
        setAudhdReason('')
        setShowAudhdConfirm(null)
      }
    } catch { /* silent */ }
    setTogglingAudhd(false)
  }

  const fetchScores = useCallback(() => {
    if (!id) return
    setLoadingScores(true)
    fetch(`/api/tdah/scores?patient_id=${id}&limit=20`)
      .then(r => r.json())
      .then(d => { setScores(d.scores || []); setLoadingScores(false) })
      .catch(() => setLoadingScores(false))
  }, [id])

  useEffect(() => { fetchPatient() }, [fetchPatient])
  useEffect(() => { fetchSessions() }, [fetchSessions])
  useEffect(() => { fetchProtocols() }, [fetchProtocols])
  useEffect(() => { fetchScores() }, [fetchScores])

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

  if (!patient) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto text-center py-20">
        <p className="text-sm text-slate-500 mb-4">Paciente não encontrado</p>
        <Link href="/tdah/pacientes" className="text-sm font-medium" style={{ color: TDAH_COLOR }}>
          &larr; Voltar para Pacientes
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/tdah/pacientes" className="text-slate-400 hover:text-slate-600 transition-colors">Pacientes</Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-700">{patient.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: TDAH_LIGHT }}>
            <span className="text-xl font-medium" style={{ color: TDAH_COLOR }}>{patient.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{patient.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              {patient.birth_date && <span>{calcAge(patient.birth_date)}</span>}
              {patient.cid_code && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{patient.cid_code}</span>
                </>
              )}
              {patient.diagnosis && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{patient.diagnosis}</span>
                </>
              )}
              {patient.audhd_layer_status && patient.audhd_layer_status !== 'none' && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600">AuDHD</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/tdah/sessoes?novo=true&paciente=${patient.id}`)}
          className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
          style={{ backgroundColor: TDAH_COLOR }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0a5c5f')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = TDAH_COLOR)}
        >
          + Nova Sessão
        </button>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Sessões', value: patient.total_sessions },
          { label: 'Protocolos ativos', value: patient.active_protocols },
          { label: 'Status', value: patient.status === 'active' ? 'Ativo' : 'Inativo' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-slate-100 p-4" style={{ borderTopColor: TDAH_COLOR, borderTopWidth: '2px' }}>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{m.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Info cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Dados clínicos */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Dados clínicos</h2>
          <dl className="space-y-3 text-sm">
            {patient.birth_date && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Nascimento</dt>
                <dd className="text-slate-700">{new Date(patient.birth_date).toLocaleDateString('pt-BR')}</dd>
              </div>
            )}
            {patient.gender && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Gênero</dt>
                <dd className="text-slate-700">{{ M: 'Masculino', F: 'Feminino', O: 'Outro' }[patient.gender] || patient.gender}</dd>
              </div>
            )}
            {patient.diagnosis && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Diagnóstico</dt>
                <dd className="text-slate-700">{patient.diagnosis}</dd>
              </div>
            )}
            {patient.cid_code && (
              <div className="flex justify-between">
                <dt className="text-slate-400">CID</dt>
                <dd className="text-slate-700">{patient.cid_code}</dd>
              </div>
            )}
            {patient.clinical_notes && (
              <div className="pt-2 border-t border-slate-50">
                <dt className="text-slate-400 mb-1">Observações</dt>
                <dd className="text-slate-600 text-xs leading-relaxed">{patient.clinical_notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Dados escolares */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Dados escolares</h2>
          {patient.school_name ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Escola</dt>
                <dd className="text-slate-700">{patient.school_name}</dd>
              </div>
              {patient.school_contact && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">Contato</dt>
                  <dd className="text-slate-700">{patient.school_contact}</dd>
                </div>
              )}
              {patient.teacher_name && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">Professor(a)</dt>
                  <dd className="text-slate-700">{patient.teacher_name}</dd>
                </div>
              )}
              {patient.teacher_email && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">Email professor</dt>
                  <dd className="text-slate-700 text-xs">{patient.teacher_email}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-xs text-slate-400">Nenhum dado escolar informado</p>
          )}
        </div>
      </div>

      {/* Layer AuDHD — Bible §9 */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6" style={{ borderLeftColor: '#7c3aed', borderLeftWidth: '3px' }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              Layer AuDHD
              <span className="text-[10px] font-normal normal-case text-slate-400">(Bible §9)</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Camada de sobreposição autismo + TDAH. Ativa métricas SEN, TRF, RIG e MSK.
            </p>
          </div>
          {patient.audhd_layer_status && patient.audhd_layer_status !== 'off' && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600">
              {patient.audhd_layer_status === 'active_core' ? 'Core' : 'Completa'}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {(['off', 'active_core', 'active_full'] as const).map(status => {
            const labels: Record<string, string> = { off: 'Desativada', active_core: 'Core (SEN + TRF)', active_full: 'Completa (+ RIG + MSK)' }
            const isActive = patient.audhd_layer_status === status
            return (
              <button
                key={status}
                onClick={() => {
                  if (!isActive) {
                    setShowAudhdConfirm(status)
                    setAudhdReason('')
                  }
                }}
                disabled={togglingAudhd}
                className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all border ${
                  isActive
                    ? 'border-purple-300 bg-purple-50 text-purple-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                } disabled:opacity-50`}
              >
                {isActive && <span className="mr-1">●</span>}
                {labels[status]}
              </button>
            )
          })}
        </div>

        {patient.audhd_layer_reason && (
          <p className="text-[10px] text-slate-400 mt-2 italic">Motivo: {patient.audhd_layer_reason}</p>
        )}
        {patient.audhd_layer_activated_at && patient.audhd_layer_status !== 'off' && (
          <p className="text-[10px] text-slate-300 mt-1">
            Ativada em {new Date(patient.audhd_layer_activated_at).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      {/* Modal confirmação AuDHD toggle */}
      {showAudhdConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-serif text-lg font-light text-slate-800">Alterar Layer AuDHD</h2>
              <p className="text-xs text-slate-400 mt-1">
                {showAudhdConfirm === 'off' ? 'Desativar' : showAudhdConfirm === 'active_core' ? 'Ativar modo Core' : 'Ativar modo Completo'}
                {' '}— esta ação será registrada no log de auditoria.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Motivo clínico (opcional)</label>
                <textarea
                  value={audhdReason}
                  onChange={e => setAudhdReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none resize-none"
                  onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                  onBlur={e => (e.currentTarget.style.borderColor = '')}
                  placeholder="Ex: Avaliação aponta sobreposição autismo/TDAH"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowAudhdConfirm(null); setAudhdReason('') }}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => toggleAudhd(showAudhdConfirm)}
                disabled={togglingAudhd}
                className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#7c3aed' }}
              >
                {togglingAudhd ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessões recentes */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sessões recentes</h2>
          <Link href={`/tdah/sessoes?paciente=${patient.id}`} className="text-xs font-medium" style={{ color: TDAH_COLOR }}>
            Ver todas &rarr;
          </Link>
        </div>

        {loadingSessions ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="animate-pulse bg-slate-50 rounded-lg h-14" />)}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">Nenhuma sessão registrada</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 5).map(s => (
              <Link key={s.id} href={`/tdah/sessoes/${s.id}`} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: TDAH_COLOR }}>
                    {s.session_number || '#'}
                  </div>
                  <div>
                    <p className="text-sm text-slate-700">{formatDatetime(s.scheduled_at)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {contextLabels[s.session_context] || s.session_context}
                      {s.session_notes && ` — ${s.session_notes.substring(0, 40)}${s.session_notes.length > 40 ? '...' : ''}`}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[s.status] || 'bg-slate-100 text-slate-500'}`}>
                  {statusLabels[s.status] || s.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Protocolos ativos */}
      <div className="mt-6 bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Protocolos</h2>
          <button
            onClick={() => { fetchLibrary(); setShowLibrary(true) }}
            className="text-xs font-medium px-3 py-1 rounded-lg border transition-colors"
            style={{ borderColor: TDAH_COLOR, color: TDAH_COLOR }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${TDAH_COLOR}0D`)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
          >
            + Ativar Protocolo
          </button>
        </div>

        {loadingProtocols ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="animate-pulse bg-slate-50 rounded-lg h-14" />)}
          </div>
        ) : protocols.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">Nenhum protocolo ativo</p>
        ) : (
          <div className="space-y-2">
            {protocols.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: TDAH_LIGHT, color: TDAH_COLOR }}>
                    {p.block}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{p.code} — {p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">{blockLabels[p.block] || p.block}</span>
                      {p.requires_audhd_layer && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-purple-50 text-purple-600">AuDHD</span>
                      )}
                      {p.library_domain && (
                        <>
                          <span className="text-slate-200">·</span>
                          <span className="text-[10px] text-slate-400">{p.library_domain}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${protocolStatusColors[p.status] || 'bg-slate-100 text-slate-500'}`}>
                  {protocolStatusLabels[p.status] || p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gráfico CSO-TDAH */}
      <div className="mt-6 bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Evolução CSO-TDAH</h2>

        {loadingScores ? (
          <div className="animate-pulse bg-slate-50 rounded-lg h-48" />
        ) : scores.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-xs text-slate-400">Nenhum score CSO registrado ainda.</p>
            <p className="text-[10px] text-slate-300 mt-1">Scores são gerados automaticamente ao fechar sessões.</p>
          </div>
        ) : (
          <>
            {/* Mini chart: SVG line chart */}
            <div className="relative h-48 mb-4">
              <CsoChart scores={scores} />
            </div>

            {/* Score history table */}
            <div className="space-y-1.5">
              {scores.slice(0, 8).map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 w-16">
                      {new Date(s.snapshot_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    {s.session_number && (
                      <span className="text-[10px] text-slate-400">#{s.session_number}</span>
                    )}
                    <div className="flex items-center gap-2">
                      {s.core_score != null && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">Base: {Number(s.core_score).toFixed(0)}</span>
                      )}
                      {s.executive_score != null && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Exec: {Number(s.executive_score).toFixed(0)}</span>
                      )}
                      {s.audhd_layer_score != null && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">AuDHD: {Number(s.audhd_layer_score).toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: TDAH_COLOR }}>
                      {s.final_score != null ? Number(s.final_score).toFixed(0) : '—'}
                    </span>
                    <BandBadge band={s.final_band} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal: Biblioteca de Protocolos */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-serif text-lg font-light text-slate-800">Biblioteca de Protocolos</h2>
                <p className="text-xs text-slate-400 mt-1">{library.length} protocolos disponíveis</p>
              </div>
              <button onClick={() => setShowLibrary(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              {library.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Carregando...</p>
              ) : (
                <div className="space-y-2">
                  {library.map(lp => {
                    const alreadyActive = protocols.some(
                      p => p.code === lp.code && !['archived', 'discontinued'].includes(p.status)
                    )
                    return (
                      <div key={lp.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${alreadyActive ? 'border-green-200 bg-green-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: TDAH_LIGHT, color: TDAH_COLOR }}>
                            {lp.block}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{lp.code} — {lp.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400">{blockLabels[lp.block] || lp.block}</span>
                              <span className="text-[10px] text-slate-300">{lp.priority}</span>
                              {lp.requires_audhd_layer && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-purple-50 text-purple-600">AuDHD</span>
                              )}
                            </div>
                            {lp.description && (
                              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{lp.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 ml-3">
                          {alreadyActive ? (
                            <span className="text-[10px] text-green-600 font-medium">Ativo</span>
                          ) : (
                            <button
                              onClick={() => activateProtocol(lp.id)}
                              disabled={activating === lp.id}
                              className="px-3 py-1 text-xs text-white rounded-lg transition-colors disabled:opacity-50"
                              style={{ backgroundColor: TDAH_COLOR }}
                              onMouseEnter={e => { if (activating !== lp.id) e.currentTarget.style.backgroundColor = '#0a5c5f' }}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = TDAH_COLOR)}
                            >
                              {activating === lp.id ? '...' : 'Ativar'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
