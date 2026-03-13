'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// =====================================================
// AXIS TDAH - Relatórios de Evolução
// Gera relatório imprimível por paciente/período
// Inclui: dados, scores CSO, protocolos, sessões, DRC
// =====================================================

const TDAH_COLOR = '#0d7377'

interface Patient {
  id: string
  name: string
  birth_date: string | null
  diagnosis: string | null
  cid_code: string | null
  school_name: string | null
  audhd_layer_status: string
  therapist_name: string | null
}

interface ReportData {
  patient: Patient
  period: { start: string; end: string }
  protocols: any[]
  sessions: any[]
  session_summary: {
    total: number; completed: number; cancelled: number
    clinical: number; home: number; school: number; avg_duration: number
  }
  scores: any[]
  score_summary: {
    first_score: number; first_band: string; last_score: number; last_band: string
    delta: number; count: number
  } | null
  drcs: any[]
  drc_summary: {
    total: number; goals_met: number; goals_not_met: number; goals_pending: number
    reviewed: number; success_rate: number
  } | null
  engine_version: string
  generated_at: string
}

interface PatientOption {
  id: string
  name: string
}

const bandLabels: Record<string, string> = {
  excelente: 'Excelente', bom: 'Bom', atencao: 'Atenção', critico: 'Crítico', sem_dados: 'Sem dados',
}

const protocolStatusLabels: Record<string, string> = {
  draft: 'Rascunho', active: 'Ativo', mastered: 'Dominado', generalization: 'Generalização',
  maintenance: 'Manutenção', maintained: 'Mantido', regression: 'Regressão',
  suspended: 'Suspenso', discontinued: 'Descontinuado', archived: 'Arquivado',
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

function calcAge(birth: string): string {
  const b = new Date(birth)
  const now = new Date()
  let years = now.getFullYear() - b.getFullYear()
  let months = now.getMonth() - b.getMonth()
  if (months < 0) { years--; months += 12 }
  if (years < 1) return `${months}m`
  return `${years}a ${months}m`
}

export default function RelatoriosPage() {
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState('')
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  })
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/tdah/patients')
      .then(r => r.json())
      .then(d => setPatients(d.patients || []))
      .catch(() => {})
  }, [])

  const generate = async () => {
    if (!selectedPatient) return
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const res = await fetch(`/api/tdah/reports?patient_id=${selectedPatient}&period_start=${periodStart}&period_end=${periodEnd}`)
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Erro'); setLoading(false); return }
      const data = await res.json()
      setReport(data)
    } catch { setError('Falha de conexão') }
    setLoading(false)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6">
      {/* Breadcrumb — hidden on print */}
      <div className="mb-6 flex items-center gap-2 text-sm print:hidden">
        <Link href="/tdah/dashboard" className="text-slate-400 hover:text-slate-600 transition-colors">TDAH</Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-700">Relatórios</span>
      </div>

      {/* Controls — hidden on print */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6 print:hidden">
        <h1 className="text-lg font-semibold text-slate-800 mb-4">Relatório de Evolução TDAH</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Paciente</label>
            <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none bg-white"
              onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
              onBlur={e => (e.currentTarget.style.borderColor = '')}>
              <option value="">Selecione</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Início</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
              onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
              onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fim</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
              onFocus={e => (e.currentTarget.style.borderColor = TDAH_COLOR)}
              onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>
          <div className="flex items-end">
            <button onClick={generate} disabled={!selectedPatient || loading}
              className="w-full px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: TDAH_COLOR }}>
              {loading ? 'Gerando...' : 'Gerar Relatório'}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* Report — printable */}
      {report && (
        <>
          <div className="flex justify-end mb-4 print:hidden">
            <button onClick={handlePrint}
              className="px-4 py-2 text-xs font-medium rounded-lg border transition-colors"
              style={{ borderColor: TDAH_COLOR, color: TDAH_COLOR }}>
              Imprimir / PDF
            </button>
          </div>

          <div ref={printRef} className="bg-white rounded-xl border border-slate-100 p-8 print:border-none print:shadow-none print:p-0">
            {/* Header */}
            <div className="border-b-2 pb-4 mb-6" style={{ borderColor: TDAH_COLOR }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: TDAH_COLOR }}>
                    AXIS TDAH — Relatório de Evolução Clínica
                  </p>
                  <h2 className="text-xl font-bold text-slate-900 mt-2">{report.patient.name}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    {report.patient.birth_date && <span>{calcAge(report.patient.birth_date)}</span>}
                    {report.patient.cid_code && <span>· {report.patient.cid_code}</span>}
                    {report.patient.diagnosis && <span>· {report.patient.diagnosis}</span>}
                    {report.patient.audhd_layer_status !== 'off' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600">
                        AuDHD {report.patient.audhd_layer_status === 'active_core' ? 'Core' : 'Completa'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>Período: {formatDate(report.period.start)} a {formatDate(report.period.end)}</p>
                  <p className="mt-0.5">Terapeuta: {report.patient.therapist_name || '—'}</p>
                  <p className="mt-0.5">{report.engine_version}</p>
                </div>
              </div>
            </div>

            {/* Score Evolution */}
            {report.score_summary && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Evolução CSO-TDAH</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] text-slate-400">Score Inicial</p>
                    <p className="text-xl font-bold text-slate-800">{report.score_summary.first_score.toFixed(0)}</p>
                    <p className="text-[10px] text-slate-500">{bandLabels[report.score_summary.first_band]}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] text-slate-400">Score Atual</p>
                    <p className="text-xl font-bold" style={{ color: TDAH_COLOR }}>{report.score_summary.last_score.toFixed(0)}</p>
                    <p className="text-[10px] text-slate-500">{bandLabels[report.score_summary.last_band]}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] text-slate-400">Variação</p>
                    <p className={`text-xl font-bold ${report.score_summary.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {report.score_summary.delta >= 0 ? '+' : ''}{report.score_summary.delta.toFixed(1)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] text-slate-400">Avaliações</p>
                    <p className="text-xl font-bold text-slate-800">{report.score_summary.count}</p>
                  </div>
                </div>

                {/* Score table */}
                {report.scores.length > 0 && (
                  <table className="w-full text-xs mt-4">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="text-left py-1.5 font-medium">Data</th>
                        <th className="text-center py-1.5 font-medium">#</th>
                        <th className="text-center py-1.5 font-medium">Contexto</th>
                        <th className="text-right py-1.5 font-medium">Base</th>
                        <th className="text-right py-1.5 font-medium">Exec</th>
                        <th className="text-right py-1.5 font-medium">AuDHD</th>
                        <th className="text-right py-1.5 font-medium">Final</th>
                        <th className="text-right py-1.5 font-medium">Banda</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-600">
                      {report.scores.map((s: any) => (
                        <tr key={s.id} className="border-b border-slate-100">
                          <td className="py-1.5">{new Date(s.snapshot_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td>
                          <td className="text-center py-1.5">{s.session_number || '—'}</td>
                          <td className="text-center py-1.5">
                            {{ clinical: 'Clín', home: 'Dom', school: 'Esc' }[s.session_context as string] || s.session_context}
                          </td>
                          <td className="text-right py-1.5">{s.core_score != null ? Number(s.core_score).toFixed(0) : '—'}</td>
                          <td className="text-right py-1.5">{s.executive_score != null ? Number(s.executive_score).toFixed(0) : '—'}</td>
                          <td className="text-right py-1.5">{s.audhd_layer_score != null ? Number(s.audhd_layer_score).toFixed(0) : '—'}</td>
                          <td className="text-right py-1.5 font-semibold">{s.final_score != null ? Number(s.final_score).toFixed(0) : '—'}</td>
                          <td className="text-right py-1.5">{bandLabels[s.final_band] || s.final_band}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Session Summary */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Sessões no Período</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {([
                  { label: 'Total', value: report.session_summary.total },
                  { label: 'Concluídas', value: report.session_summary.completed },
                  { label: 'Canceladas', value: report.session_summary.cancelled },
                  { label: 'Clínicas', value: report.session_summary.clinical },
                  { label: 'Domiciliares', value: report.session_summary.home },
                  { label: 'Escolares', value: report.session_summary.school },
                ]).map(s => (
                  <div key={s.label} className="p-2 rounded-lg bg-slate-50 text-center">
                    <p className="text-[10px] text-slate-400">{s.label}</p>
                    <p className="text-lg font-bold text-slate-800">{s.value}</p>
                  </div>
                ))}
              </div>
              {report.session_summary.avg_duration > 0 && (
                <p className="text-[10px] text-slate-400 mt-2">Duração média: {report.session_summary.avg_duration} min</p>
              )}
            </div>

            {/* Protocols */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Protocolos ({report.protocols.length})</h3>
              {report.protocols.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum protocolo registrado</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="text-left py-1.5 font-medium">Código</th>
                      <th className="text-left py-1.5 font-medium">Título</th>
                      <th className="text-center py-1.5 font-medium">Bloco</th>
                      <th className="text-center py-1.5 font-medium">Status</th>
                      <th className="text-center py-1.5 font-medium">AuDHD</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-600">
                    {report.protocols.map((p: any) => (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="py-1.5 font-medium">{p.code}</td>
                        <td className="py-1.5">{p.title}</td>
                        <td className="text-center py-1.5">{p.block}</td>
                        <td className="text-center py-1.5">{protocolStatusLabels[p.status] || p.status}</td>
                        <td className="text-center py-1.5">{p.requires_audhd_layer ? 'Sim' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* DRC Summary */}
            {report.drc_summary && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Daily Report Card (DRC)</h3>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {([
                    { label: 'Total metas', value: report.drc_summary.total },
                    { label: 'Atingidas', value: report.drc_summary.goals_met },
                    { label: 'Não atingidas', value: report.drc_summary.goals_not_met },
                    { label: 'Revisadas', value: report.drc_summary.reviewed },
                    { label: 'Taxa sucesso', value: `${report.drc_summary.success_rate}%` },
                  ]).map(s => (
                    <div key={s.label} className="p-2 rounded-lg bg-slate-50 text-center">
                      <p className="text-[10px] text-slate-400">{s.label}</p>
                      <p className="text-lg font-bold text-slate-800">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t-2" style={{ borderColor: TDAH_COLOR }}>
              <div className="flex items-center justify-between text-[9px] text-slate-400">
                <div>
                  <p>AXIS TDAH — Relatório de Evolução Clínica</p>
                  <p>Gerado em {new Date(report.generated_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className="text-right">
                  <p>{report.engine_version}</p>
                  <p>Este relatório é uma ferramenta de apoio. Não substitui o julgamento clínico.</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
