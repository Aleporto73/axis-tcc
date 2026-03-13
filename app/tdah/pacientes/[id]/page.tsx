'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// =====================================================
// AXIS TDAH - Ficha do Paciente (Fase 2)
// Exibe dados do paciente, sessões recentes, status.
// Fase 3 expandirá: gráficos CSO, protocolos, AuDHD.
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
  const [loading, setLoading] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(true)

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

  useEffect(() => { fetchPatient() }, [fetchPatient])
  useEffect(() => { fetchSessions() }, [fetchSessions])

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

      {/* Placeholder: Protocolos e CSO virão na Fase 3 */}
      <div className="mt-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
        <p className="text-xs text-slate-400">
          Protocolos ativos, gráficos CSO-TDAH e layer AuDHD serão exibidos aqui na Fase 3.
        </p>
      </div>
    </div>
  )
}
