'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Target, Activity, Clock, TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar, FileText, MessageSquare } from 'lucide-react'

interface EvolutionData {
  patient_name: string
  total_sessions: number
  total_events: number
  event_counts: { EVITOU: number; ENFRENTOU: number; AJUSTOU: number; RECUPEROU: number }
  event_percentages: { EVITOU: number; ENFRENTOU: number; AJUSTOU: number; RECUPEROU: number }
  avg_recovery_time: number
  trend: 'up' | 'down' | 'stable'
  timeline: { session_number: number; date: string; duration: number }[]
  sessions_early?: { count: number; events: number; avg_recovery: number }
  sessions_recent?: { count: number; events: number; avg_recovery: number }
  outlier_sessions?: { session_number: number; reason: string }[]
}

interface ClinicalRecord { complaint: string; patterns: string; interventions: string; current_state: string }

const AUTHORSHIP = {
  auto: { border: '#e2e8f0', label: 'Cálculo automático', dot: '#cbd5e1' },
  professional: { border: '#bbf7d0', label: 'Registro do Profissional', dot: '#86efac' },
  attention: { border: '#fde68a', label: 'Atenção', dot: '#fcd34d' },
}

function AuthorshipSection({ type, children, className = '' }: { type: keyof typeof AUTHORSHIP; children: React.ReactNode; className?: string }) {
  const style = AUTHORSHIP[type]
  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ border: `1px solid ${type === 'attention' ? '#fde68a' : '#e5e7eb'}` }}>
      <div style={{ display: 'flex' }}>
        <div style={{ width: '3px', flexShrink: 0, backgroundColor: style.border, borderRadius: '3px 0 0 3px' }} />
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

function AuthorshipTag({ type }: { type: keyof typeof AUTHORSHIP }) {
  const style = AUTHORSHIP[type]
  return (
    <span className="flex items-center gap-1.5">
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: style.dot, display: 'inline-block' }} />
      <span className="text-xs text-gray-400">{style.label}</span>
    </span>
  )
}

export default function RelatorioPrintPage() {
  const params = useParams()
  const patientId = params.patientId as string
  const [data, setData] = useState<EvolutionData | null>(null)
  const [patientName, setPatientName] = useState('')
  const [clinicalRecord, setClinicalRecord] = useState<ClinicalRecord | null>(null)
  const [supervisionContext, setSupervisionContext] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [patientId])

  const loadData = async () => {
    try {
      const [evoRes, patientRes, clinicalRes, supRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/evolution`),
        fetch(`/api/patients/${patientId}`),
        fetch(`/api/patients/${patientId}/clinical-record`),
        fetch(`/api/patients/${patientId}/supervision`)
      ])
      if (evoRes.ok) setData(await evoRes.json())
      if (patientRes.ok) { const json = await patientRes.json(); setPatientName(json.patient?.full_name || '') }
      if (clinicalRes.ok) { const json = await clinicalRes.json(); if (json.exists) setClinicalRecord(json.record) }
      if (supRes.ok) { const json = await supRes.json(); if (json.context) setSupervisionContext(json.context) }
    } catch (e) { console.error('Erro:', e) }
    finally { setLoading(false) }
  }

  const getTrendText = (trend: string, data: EvolutionData) => {
    const sorted = Object.entries(data.event_counts).sort((a, b) => b[1] - a[1])
    const labelMap: Record<string, string> = { EVITOU: 'Evitação', ENFRENTOU: 'Enfrentamento', AJUSTOU: 'Ajuste', RECUPEROU: 'Recuperação' }
    if (data.total_events < 3) return 'Dados insuficientes para caracterização de tendência no período analisado.'
    return `Ao longo das sessões analisadas, a distribuição dos micro-eventos manteve configuração semelhante, com predominância relativa de ${labelMap[sorted[0][0]]}. Não foram identificadas variações progressivas sustentadas no perfil de eventos no período.`
  }

  const getDistributionText = (data: EvolutionData) => {
    const sorted = Object.entries(data.event_counts).sort((a, b) => b[1] - a[1])
    const labelMap: Record<string, string> = { EVITOU: 'Evitação', ENFRENTOU: 'Enfrentamento', AJUSTOU: 'Ajuste', RECUPEROU: 'Recuperação' }
    return `Maior frequência de ${labelMap[sorted[0][0]]} (${data.event_percentages[sorted[0][0] as keyof typeof data.event_percentages]}%), seguido por ${labelMap[sorted[1][0]]} (${data.event_percentages[sorted[1][0] as keyof typeof data.event_percentages]}%).`
  }

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-pulse space-y-4 w-full max-w-4xl px-8"><div className="h-8 bg-gray-100 rounded w-1/3"></div></div></div>
  if (!data) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-500">Erro ao carregar dados</p></div>

  const maxBar = Math.max(data.event_percentages.EVITOU, data.event_percentages.ENFRENTOU, data.event_percentages.AJUSTOU, data.event_percentages.RECUPEROU, 1)
  const radarSize = 180, radarCenter = 90, radarRadius = 60
  const radarPoints = [
    { label: 'Evitou', value: data.event_percentages.EVITOU, angle: -90, color: '#d97706' },
    { label: 'Enfrentou', value: data.event_percentages.ENFRENTOU, angle: 0, color: '#059669' },
    { label: 'Recuperou', value: data.event_percentages.RECUPEROU, angle: 90, color: '#7c3aed' },
    { label: 'Ajustou', value: data.event_percentages.AJUSTOU, angle: 180, color: '#0891b2' }
  ]
  const getRadarPoint = (value: number, angle: number) => {
    const r = (value / 100) * radarRadius, rad = (angle * Math.PI) / 180
    return { x: radarCenter + r * Math.cos(rad), y: radarCenter + r * Math.sin(rad) }
  }
  const radarPath = radarPoints.map((p, i) => { const pt = getRadarPoint(p.value, p.angle); return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}` }).join(' ') + ' Z'

  return (
    <div className="min-h-screen bg-white p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6 mb-8">
        <h1 className="font-serif text-3xl text-gray-800 mb-1">Evolução do Processo</h1>
        <p className="text-gray-500 italic">Relatório longitudinal • {data.total_sessions} sessões analisadas</p>
        <p className="text-lg text-gray-700 mt-3">Paciente: {patientName}</p>
        <p className="text-xs text-gray-400 mt-2">Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — AXIS TCC</p>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
        <p className="text-sm text-gray-600">Este relatório descreve padrões observáveis ao longo do tempo. Não contém inferência diagnóstica, interpretação psicológica ou juízo clínico.</p>
      </div>

      {/* Legenda de Autoria */}
      <div className="mb-8 flex items-center gap-5 px-1">
        <span className="text-xs text-gray-400 uppercase tracking-wide" style={{ fontSize: '10px' }}>Autoria:</span>
        {Object.entries(AUTHORSHIP).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: val.dot, display: 'inline-block' }} />
            <span className="text-xs text-gray-400">{val.label}</span>
          </span>
        ))}
      </div>

      <div className="space-y-6">
        {/* Contexto Clínico */}
        {clinicalRecord && (
          <AuthorshipSection type="professional">
            <div className="p-5 bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide flex items-center gap-2"><FileText className="w-4 h-4 text-gray-400" />Contexto Clínico Inicial</h3>
                <AuthorshipTag type="professional" />
              </div>
              <p className="text-xs text-gray-500 mb-4">Registro retrospectivo informado pelo profissional antes do início das sessões no sistema.</p>
              <div className="grid grid-cols-2 gap-4">
                {clinicalRecord.complaint && <div><h4 className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Evento ou contexto inicial</h4><p className="text-sm text-gray-700">{clinicalRecord.complaint}</p></div>}
                {clinicalRecord.patterns && <div><h4 className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Aspectos mencionados no histórico</h4><p className="text-sm text-gray-700">{clinicalRecord.patterns}</p></div>}
                {clinicalRecord.interventions && <div><h4 className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Intervenções prévias relatadas</h4><p className="text-sm text-gray-700">{clinicalRecord.interventions}</p></div>}
                {clinicalRecord.current_state && <div><h4 className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Situação atual conforme relato</h4><p className="text-sm text-gray-700">{clinicalRecord.current_state}</p></div>}
              </div>
            </div>
          </AuthorshipSection>
        )}

        {/* Indicadores */}
        <AuthorshipSection type="auto">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide">Indicadores</h3>
              <AuthorshipTag type="auto" />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500 uppercase tracking-wide">Sessões</span></div>
                <p className="text-3xl font-light text-gray-900">{data.total_sessions}</p>
                <p className="text-xs text-gray-400 mt-1">finalizadas</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500 uppercase tracking-wide">Eventos</span></div>
                <p className="text-3xl font-light text-gray-900">{data.total_events}</p>
                <p className="text-xs text-gray-400 mt-1">registrados</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500 uppercase tracking-wide">Recuperação</span></div>
                <p className="text-3xl font-light text-gray-900">{data.avg_recovery_time || '-'}</p>
                <p className="text-xs text-gray-400 mt-1">min (média)</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  {data.trend === 'up' ? <TrendingUp className="w-4 h-4 text-gray-400" /> : data.trend === 'down' ? <TrendingDown className="w-4 h-4 text-gray-400" /> : <Minus className="w-4 h-4 text-gray-400" />}
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Tendência</span>
                </div>
                <p className="text-xl font-medium text-gray-900">{data.trend === 'up' ? 'Positiva' : data.trend === 'down' ? 'Observada' : 'Estável'}</p>
                <p className="text-xs text-gray-400 mt-1">últimas sessões</p>
              </div>
            </div>
          </div>
        </AuthorshipSection>

        {/* Tendência */}
        <AuthorshipSection type="auto">
          <div className="p-5" style={{ backgroundColor: '#f8fafc' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide">Tendência de Processo</h3>
              <AuthorshipTag type="auto" />
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{getTrendText(data.trend, data)}</p>
          </div>
        </AuthorshipSection>

        {/* Gráficos */}
        <div className="grid grid-cols-2 gap-6">
          {data.total_events >= 2 && (
            <AuthorshipSection type="auto">
              <div className="p-5" style={{ backgroundColor: '#f8fafc' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide">Perfil de Distribuição</h3>
                  <AuthorshipTag type="auto" />
                </div>
                <div className="flex justify-center">
                  <svg width={radarSize} height={radarSize} className="overflow-visible">
                    {[25, 50, 75, 100].map(level => <circle key={level} cx={radarCenter} cy={radarCenter} r={(level / 100) * radarRadius} fill="none" stroke="#e5e7eb" strokeWidth="1" />)}
                    {radarPoints.map((p, i) => { const end = getRadarPoint(100, p.angle); return <line key={i} x1={radarCenter} y1={radarCenter} x2={end.x} y2={end.y} stroke="#e5e7eb" strokeWidth="1" /> })}
                    <path d={radarPath} fill="rgba(107, 114, 128, 0.1)" stroke="#6b7280" strokeWidth="1.5" />
                    {radarPoints.map((p, i) => { const pt = getRadarPoint(p.value, p.angle); return <circle key={i} cx={pt.x} cy={pt.y} r="4" fill={p.color} /> })}
                    {radarPoints.map((p, i) => { const lp = getRadarPoint(120, p.angle); return <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" className="text-xs fill-gray-500">{p.label}</text> })}
                  </svg>
                </div>
              </div>
            </AuthorshipSection>
          )}

          <AuthorshipSection type="auto">
            <div className="p-5" style={{ backgroundColor: '#f8fafc' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide">Distribuição de Eventos</h3>
                <AuthorshipTag type="auto" />
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Evitou</span><span className="text-gray-500">{data.event_counts.EVITOU} ({data.event_percentages.EVITOU}%)</span></div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(data.event_percentages.EVITOU / maxBar) * 100}%`, backgroundColor: '#d97706' }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Enfrentou</span><span className="text-gray-500">{data.event_counts.ENFRENTOU} ({data.event_percentages.ENFRENTOU}%)</span></div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(data.event_percentages.ENFRENTOU / maxBar) * 100}%`, backgroundColor: '#059669' }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Ajustou</span><span className="text-gray-500">{data.event_counts.AJUSTOU} ({data.event_percentages.AJUSTOU}%)</span></div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(data.event_percentages.AJUSTOU / maxBar) * 100}%`, backgroundColor: '#0891b2' }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Recuperou</span><span className="text-gray-500">{data.event_counts.RECUPEROU} ({data.event_percentages.RECUPEROU}%)</span></div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(data.event_percentages.RECUPEROU / maxBar) * 100}%`, backgroundColor: '#7c3aed' }}></div></div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">{getDistributionText(data)}</p>
            </div>
          </AuthorshipSection>
        </div>

        {/* Comparativo */}
        {data.sessions_early && data.sessions_recent && data.total_sessions >= 4 && (
          <AuthorshipSection type="auto">
            <div className="p-5" style={{ backgroundColor: '#f8fafc' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide">Comparativo Temporal</h3>
                <AuthorshipTag type="auto" />
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200"><th className="text-left py-2 text-gray-500 font-medium">Período</th><th className="text-center py-2 text-gray-500 font-medium">Sessões</th><th className="text-center py-2 text-gray-500 font-medium">Eventos</th><th className="text-center py-2 text-gray-500 font-medium">Recuperação</th></tr></thead>
                <tbody>
                  <tr className="border-b border-gray-100"><td className="py-3 text-gray-700">Sessões iniciais</td><td className="py-3 text-center text-gray-600">{data.sessions_early.count}</td><td className="py-3 text-center text-gray-600">{data.sessions_early.events}</td><td className="py-3 text-center text-gray-600">{data.sessions_early.avg_recovery} min</td></tr>
                  <tr><td className="py-3 text-gray-700">Sessões recentes</td><td className="py-3 text-center text-gray-600">{data.sessions_recent.count}</td><td className="py-3 text-center text-gray-600">{data.sessions_recent.events}</td><td className="py-3 text-center text-gray-600">{data.sessions_recent.avg_recovery} min</td></tr>
                </tbody>
              </table>
            </div>
          </AuthorshipSection>
        )}

        {/* Outliers */}
        {data.outlier_sessions && data.outlier_sessions.length > 0 && (
          <AuthorshipSection type="attention">
            <div className="p-5" style={{ backgroundColor: '#fffbeb' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium uppercase tracking-wide flex items-center gap-2" style={{ color: '#92400e' }}><AlertTriangle className="w-4 h-4" />Sessões com Variação</h3>
                <AuthorshipTag type="attention" />
              </div>
              <ul className="space-y-1">{data.outlier_sessions.map((s, i) => <li key={i} className="text-sm" style={{ color: '#92400e' }}><span className="font-medium">Sessão #{s.session_number}</span> — {s.reason}</li>)}</ul>
            </div>
          </AuthorshipSection>
        )}

        {/* Timeline */}
        <AuthorshipSection type="auto">
          <div className="p-5" style={{ backgroundColor: '#f8fafc' }}>
            <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />Linha do Tempo</h3>
            <div className="grid grid-cols-4 gap-3">
              {data.timeline.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-200">
                  <div className="w-6 h-6 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center text-xs text-gray-600 font-medium">{s.session_number}</div>
                  <div><p className="text-xs text-gray-700">{new Date(s.date).toLocaleDateString('pt-BR')}</p><p className="text-xs text-gray-400">{s.duration ? `${s.duration} min` : ''}</p></div>
                </div>
              ))}
            </div>
          </div>
        </AuthorshipSection>

        {/* Contexto Supervisão - do banco */}
        {supervisionContext && (
          <AuthorshipSection type="professional">
            <div className="p-5 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide flex items-center gap-2"><MessageSquare className="w-4 h-4 text-gray-400" />Contexto para Supervisão</h3>
                <AuthorshipTag type="professional" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{supervisionContext}</p>
            </div>
          </AuthorshipSection>
        )}
      </div>

      {/* Rodapé */}
      <div className="border-t border-gray-200 pt-6 mt-8">
        <p className="text-xs text-gray-500 text-center">Este relatório não substitui avaliação clínica profissional. Interpretação exclusiva do profissional responsável.</p>
      </div>

      {/* Botão Imprimir */}
      <div className="mt-8 flex justify-center print:hidden">
        <button onClick={() => window.print()} className="px-6 py-3 text-white rounded-xl text-sm font-medium transition-all hover:opacity-90" style={{ backgroundColor: '#16a34a' }}>Imprimir / Salvar PDF</button>
      </div>
    </div>
  )
}
