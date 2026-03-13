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

export default function PacienteDetalhePage() {
  const { id } = useParams()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [library, setLibrary] = useState<LibraryProtocol[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingProtocols, setLoadingProtocols] = useState(true)
  const [showLibrary, setShowLibrary] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)

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

  useEffect(() => { fetchPatient() }, [fetchPatient])
  useEffect(() => { fetchSessions() }, [fetchSessions])
  useEffect(() => { fetchProtocols() }, [fetchProtocols])

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
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
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
              </div>
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

      {/* Placeholder: CSO graphs future */}
      <div className="mt-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
        <p className="text-xs text-slate-400">
          Gráficos CSO-TDAH e layer AuDHD serão exibidos aqui em fase futura.
        </p>
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
