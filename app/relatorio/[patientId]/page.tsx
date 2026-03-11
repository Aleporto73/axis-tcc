'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Target, Activity, Clock, TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar, FileText, MessageSquare, Download } from 'lucide-react'
import { jsPDF } from 'jspdf'

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

  const downloadPDF = () => {
    if (!data) return
    const doc = new jsPDF()
    const w = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentW = w - margin * 2
    let y = 20

    // Helpers
    const addText = (text: string, x: number, yPos: number, opts: { size?: number; style?: string; color?: [number, number, number]; maxWidth?: number } = {}) => {
      doc.setFontSize(opts.size || 10)
      doc.setFont('helvetica', opts.style || 'normal')
      doc.setTextColor(...(opts.color || [51, 51, 51]))
      if (opts.maxWidth) {
        doc.text(text, x, yPos, { maxWidth: opts.maxWidth })
      } else {
        doc.text(text, x, yPos)
      }
    }

    const checkPage = (needed: number) => {
      if (y + needed > 275) {
        doc.addPage()
        y = 20
      }
    }

    const drawLine = () => {
      doc.setDrawColor(220, 220, 220)
      doc.line(margin, y, w - margin, y)
      y += 6
    }

    const sectionTitle = (title: string) => {
      checkPage(20)
      addText(title, margin, y, { size: 11, style: 'bold', color: [30, 30, 80] })
      y += 8
    }

    // ─── Logo ───
    const logoB64 = 'data:image/jpeg;base64,/9j/4QC8RXhpZgAASUkqAAgAAAAGABIBAwABAAAAAQAAABoBBQABAAAAVgAAABsBBQABAAAAXgAAACgBAwABAAAAAgAAABMCAwABAAAAAQAAAGmHBAABAAAAZgAAAAAAAABgAAAAAQAAAGAAAAABAAAABgAAkAcABAAAADAyMTABkQcABAAAAAECAwAAoAcABAAAADAxMDABoAMAAQAAAP//AAACoAQAAQAAAFgCAAADoAQAAQAAAMgAAAAAAAAA'
    try { doc.addImage(logoB64, 'JPEG', margin, y, 50, 17) } catch { /* logo skip */ }
    y += 22

    // ─── Header ───
    addText('Evolucao do Processo', margin, y, { size: 18, style: 'bold', color: [30, 30, 80] })
    y += 7
    addText(`Relatorio longitudinal - ${data.total_sessions} sessoes analisadas`, margin, y, { size: 10, color: [120, 120, 120] })
    y += 6
    addText(`Paciente: ${patientName}`, margin, y, { size: 12, style: 'bold' })
    y += 6
    const now = new Date()
    addText(`Gerado em ${now.toLocaleDateString('pt-BR')} as ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — AXIS TCC`, margin, y, { size: 8, color: [160, 160, 160] })
    y += 10

    drawLine()

    // ─── Disclaimer ───
    doc.setFillColor(248, 248, 248)
    doc.roundedRect(margin, y - 2, contentW, 14, 2, 2, 'F')
    addText('Este relatorio descreve padroes observaveis ao longo do tempo. Nao contem inferencia', margin + 3, y + 3, { size: 8, color: [100, 100, 100] })
    addText('diagnostica, interpretacao psicologica ou juizo clinico.', margin + 3, y + 8, { size: 8, color: [100, 100, 100] })
    y += 18

    // ─── Contexto Clínico ───
    if (clinicalRecord) {
      sectionTitle('Contexto Clinico Inicial')
      addText('[Registro do Profissional]', margin, y, { size: 7, color: [120, 180, 120] })
      y += 5
      const fields = [
        { label: 'Evento ou contexto inicial', value: clinicalRecord.complaint },
        { label: 'Aspectos mencionados no historico', value: clinicalRecord.patterns },
        { label: 'Intervencoes previas relatadas', value: clinicalRecord.interventions },
        { label: 'Situacao atual conforme relato', value: clinicalRecord.current_state },
      ]
      for (const f of fields) {
        if (f.value) {
          checkPage(14)
          addText(f.label, margin, y, { size: 8, style: 'bold', color: [100, 100, 100] })
          y += 4
          const lines = doc.splitTextToSize(f.value, contentW)
          addText(lines.join('\n'), margin, y, { size: 9, maxWidth: contentW })
          y += lines.length * 4.5 + 3
        }
      }
      y += 4
      drawLine()
    }

    // ─── Indicadores ───
    sectionTitle('Indicadores')
    addText('[Calculo automatico]', margin, y, { size: 7, color: [180, 180, 200] })
    y += 6

    const indicators = [
      { label: 'Sessoes finalizadas', value: String(data.total_sessions) },
      { label: 'Eventos registrados', value: String(data.total_events) },
      { label: 'Recuperacao media', value: data.avg_recovery_time ? `${data.avg_recovery_time} min` : '-' },
      { label: 'Tendencia', value: data.trend === 'up' ? 'Positiva' : data.trend === 'down' ? 'Observada' : 'Estavel' },
    ]

    const colW = contentW / 4
    indicators.forEach((ind, i) => {
      const x = margin + i * colW
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(x, y - 2, colW - 4, 18, 2, 2, 'F')
      addText(ind.label, x + 3, y + 3, { size: 7, color: [120, 120, 120] })
      addText(ind.value, x + 3, y + 11, { size: 14, style: 'bold', color: [30, 30, 30] })
    })
    y += 24

    // ─── Tendência ───
    sectionTitle('Tendencia de Processo')
    const trendText = getTrendText(data.trend, data)
    const trendLines = doc.splitTextToSize(trendText, contentW)
    addText(trendLines.join('\n'), margin, y, { size: 9, maxWidth: contentW })
    y += trendLines.length * 4.5 + 6
    drawLine()

    // ─── Distribuição de Eventos ───
    sectionTitle('Distribuicao de Eventos')
    const labelMap: Record<string, string> = { EVITOU: 'Evitou', ENFRENTOU: 'Enfrentou', AJUSTOU: 'Ajustou', RECUPEROU: 'Recuperou' }
    const colorMap: Record<string, [number, number, number]> = {
      EVITOU: [217, 119, 6], ENFRENTOU: [5, 150, 105], AJUSTOU: [8, 145, 178], RECUPEROU: [124, 58, 237]
    }
    const barMax = Math.max(data.event_percentages.EVITOU, data.event_percentages.ENFRENTOU, data.event_percentages.AJUSTOU, data.event_percentages.RECUPEROU, 1)

    for (const key of ['EVITOU', 'ENFRENTOU', 'AJUSTOU', 'RECUPEROU'] as const) {
      checkPage(12)
      addText(`${labelMap[key]}:  ${data.event_counts[key]} (${data.event_percentages[key]}%)`, margin, y, { size: 9 })
      y += 4
      doc.setFillColor(230, 230, 230)
      doc.roundedRect(margin, y, contentW, 4, 1, 1, 'F')
      const barW = (data.event_percentages[key] / barMax) * contentW
      if (barW > 0) {
        doc.setFillColor(...colorMap[key])
        doc.roundedRect(margin, y, Math.max(barW, 2), 4, 1, 1, 'F')
      }
      y += 8
    }

    addText(getDistributionText(data), margin, y, { size: 8, color: [120, 120, 120], maxWidth: contentW })
    y += 8
    drawLine()

    // ─── Comparativo ───
    if (data.sessions_early && data.sessions_recent && data.total_sessions >= 4) {
      sectionTitle('Comparativo Temporal')
      // Table header
      const cols = [margin, margin + 50, margin + 90, margin + 130]
      addText('Periodo', cols[0], y, { size: 8, style: 'bold', color: [100, 100, 100] })
      addText('Sessoes', cols[1], y, { size: 8, style: 'bold', color: [100, 100, 100] })
      addText('Eventos', cols[2], y, { size: 8, style: 'bold', color: [100, 100, 100] })
      addText('Recuperacao', cols[3], y, { size: 8, style: 'bold', color: [100, 100, 100] })
      y += 5
      doc.setDrawColor(220, 220, 220)
      doc.line(margin, y, w - margin, y)
      y += 5

      addText('Sessoes iniciais', cols[0], y, { size: 9 })
      addText(String(data.sessions_early.count), cols[1], y, { size: 9 })
      addText(String(data.sessions_early.events), cols[2], y, { size: 9 })
      addText(`${data.sessions_early.avg_recovery} min`, cols[3], y, { size: 9 })
      y += 6
      addText('Sessoes recentes', cols[0], y, { size: 9 })
      addText(String(data.sessions_recent.count), cols[1], y, { size: 9 })
      addText(String(data.sessions_recent.events), cols[2], y, { size: 9 })
      addText(`${data.sessions_recent.avg_recovery} min`, cols[3], y, { size: 9 })
      y += 8
      drawLine()
    }

    // ─── Outliers ───
    if (data.outlier_sessions && data.outlier_sessions.length > 0) {
      sectionTitle('Sessoes com Variacao')
      for (const s of data.outlier_sessions) {
        checkPage(8)
        addText(`Sessao #${s.session_number} — ${s.reason}`, margin, y, { size: 9, color: [146, 64, 14] })
        y += 5
      }
      y += 4
      drawLine()
    }

    // ─── Timeline ───
    sectionTitle('Linha do Tempo')
    const timeColW = contentW / 4
    data.timeline.forEach((s, idx) => {
      const col = idx % 4
      if (col === 0 && idx > 0) y += 10
      if (col === 0) checkPage(12)
      const x = margin + col * timeColW
      addText(`#${s.session_number}`, x, y, { size: 9, style: 'bold' })
      addText(new Date(s.date).toLocaleDateString('pt-BR'), x + 12, y, { size: 8, color: [100, 100, 100] })
      if (s.duration) addText(`${s.duration}min`, x + 42, y, { size: 7, color: [160, 160, 160] })
    })
    y += 14
    drawLine()

    // ─── Contexto Supervisão ───
    if (supervisionContext) {
      sectionTitle('Contexto para Supervisao')
      addText('[Registro do Profissional]', margin, y, { size: 7, color: [120, 180, 120] })
      y += 5
      const supLines = doc.splitTextToSize(supervisionContext, contentW)
      addText(supLines.join('\n'), margin, y, { size: 9, maxWidth: contentW })
      y += supLines.length * 4.5 + 6
    }

    // ─── Rodapé ───
    checkPage(20)
    drawLine()
    addText('Este relatorio nao substitui avaliacao clinica profissional.', margin, y, { size: 8, color: [160, 160, 160] })
    y += 4
    addText('Interpretacao exclusiva do profissional responsavel.', margin, y, { size: 8, color: [160, 160, 160] })
    y += 4
    addText(`AXIS TCC — CSO-TCC v3.0.0 — ${now.toLocaleDateString('pt-BR')}`, margin, y, { size: 7, color: [200, 200, 200] })

    // Download
    const safePatient = patientName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
    doc.save(`relatorio_${safePatient}_${now.toISOString().slice(0, 10)}.pdf`)
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

      {/* Botões PDF + Imprimir */}
      <div className="mt-8 flex justify-center gap-3 print:hidden">
        <button onClick={downloadPDF} className="flex items-center gap-2 px-6 py-3 text-white rounded-xl text-sm font-medium transition-all hover:opacity-90" style={{ backgroundColor: '#1a1f4e' }}>
          <Download className="w-4 h-4" />Baixar PDF
        </button>
        <button onClick={() => window.print()} className="px-6 py-3 rounded-xl text-sm font-medium transition-all border border-gray-300 text-gray-600 hover:bg-gray-50">
          Imprimir
        </button>
      </div>
    </div>
  )
}
