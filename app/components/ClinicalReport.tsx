'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Pencil, Check, Download, RefreshCw, X, Plus } from 'lucide-react'
import { jsPDF } from 'jspdf'

interface ReportData {
  id: string
  session_id: string
  headline: string | null
  objectives: string
  summary: string
  intervention: string
  observations: string | null
  closing: string | null
  insights: Record<string, unknown>
  status: string
  generated_by: string
  ai_model: string | null
  created_at: string
  updated_at: string
  exported_at: string | null
  export_count: number
}

interface ClinicalReportProps {
  sessionId: string
  hasTranscript: boolean
  hasAnalysis: boolean
  onReportLoaded?: (report: ReportData | null) => void
}

const REPORT_FIELDS = [
  { key: 'objectives', label: 'Objetivos da Sessão', required: true },
  { key: 'summary', label: 'Resumo', required: true },
  { key: 'intervention', label: 'Intervenção do Psicólogo', required: true },
  { key: 'observations', label: 'Observações Clínicas', required: false },
  { key: 'closing', label: 'Encerramento / Tarefa de Casa', required: false },
] as const

export default function ClinicalReport({ sessionId, hasTranscript, hasAnalysis, onReportLoaded }: ClinicalReportProps) {
  const [report, setReport] = useState<ReportData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedFields, setEditedFields] = useState<Record<string, string>>({})
  const [loadingReport, setLoadingReport] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onReportLoadedRef = useRef(onReportLoaded)
  onReportLoadedRef.current = onReportLoaded

  const fetchReport = useCallback(async () => {
    try {
      setLoadingReport(true)
      const res = await fetch(`/api/sessions/${sessionId}/report`)
      if (!res.ok) return
      const data = await res.json()
      setReport(data.report)
      onReportLoadedRef.current?.(data.report)
    } catch {
      // silencioso - componente mostra estado vazio
    } finally {
      setLoadingReport(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleGenerate = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      const res = await fetch(`/api/sessions/${sessionId}/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erro ao gerar relatorio')
        return
      }
      const data = await res.json()
      setReport(data.report)
      onReportLoadedRef.current?.(data.report)
    } catch {
      setError('Erro de conexao ao gerar relatorio')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (Object.keys(editedFields).length === 0) {
      setEditMode(false)
      return
    }
    try {
      setIsSaving(true)
      const res = await fetch(`/api/sessions/${sessionId}/report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedFields),
      })
      if (res.ok) {
        const data = await res.json()
        setReport(data.report)
        onReportLoadedRef.current?.(data.report)
        setEditMode(false)
        setEditedFields({})
      }
    } catch {
      setError('Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleApprove = async () => {
    try {
      setIsSaving(true)
      const res = await fetch(`/api/sessions/${sessionId}/report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'final' }),
      })
      if (res.ok) {
        const data = await res.json()
        setReport(data.report)
        onReportLoadedRef.current?.(data.report)
      }
    } catch {
      setError('Erro ao aprovar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFieldChange = (key: string, value: string) => {
    setEditedFields(prev => ({ ...prev, [key]: value }))
  }

  const getFieldValue = (key: string): string => {
    if (editedFields[key] !== undefined) return editedFields[key]
    if (!report) return ''
    return (report as unknown as Record<string, string>)[key] || ''
  }

  const canGenerate = hasTranscript || hasAnalysis

  // Loading state
  if (loadingReport) {
    return (
      <section className="mb-8 pb-8 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Relatório Clínico</h2>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3" />
        </div>
      </section>
    )
  }

  // Estado 1: Sem relatorio
  if (!report && !isGenerating) {
    return (
      <section className="mb-8 pb-8 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Relatório Clínico</h2>
        </div>
        <p className="text-sm text-slate-400 italic mb-4">Nenhum relatório gerado para esta sessão.</p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {canGenerate && (
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            aria-label="Gerar relatorio clinico com IA"
          >
            <RefreshCw className="w-4 h-4" />
            Gerar Relatório
          </button>
        )}
        {!canGenerate && (
          <p className="text-xs text-slate-400">Adicione uma transcrição ou análise TCC para gerar o relatório.</p>
        )}
      </section>
    )
  }

  // Estado 2: Gerando
  if (isGenerating) {
    return (
      <section className="mb-8 pb-8 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Relatório Clínico</h2>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-indigo-700">Gerando relatório...</p>
          </div>
          <p className="text-xs text-slate-500 mb-4">Analisando transcrição e extraindo insights</p>
          <div className="space-y-3">
            {REPORT_FIELDS.map(f => (
              <div key={f.key}>
                <div className="h-3 bg-slate-100 rounded animate-pulse w-24 mb-2" />
                <div className="h-4 bg-slate-50 rounded animate-pulse w-full" />
                <div className="h-4 bg-slate-50 rounded animate-pulse w-4/5 mt-1" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Estado 3 e 4: Relatorio existe
  return (
    <section className="mb-8 pb-8 border-b border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Relatório Clínico</h2>
          <span
            className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
              report!.status === 'final'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
            role="status"
          >
            {report!.status === 'final' ? 'Aprovado' : 'Rascunho'}
          </span>
        </div>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Editar relatorio"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="bg-white border border-blue-200 rounded-xl p-6">
        {/* Headline */}
        {editMode ? (
          <div className="mb-5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Insight principal
            </label>
            <input
              type="text"
              maxLength={120}
              value={getFieldValue('headline')}
              onChange={(e) => handleFieldChange('headline', e.target.value)}
              placeholder="1 frase-síntese da sessão (máx 120 caracteres)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-blue-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
            />
            <p className="text-xs text-slate-400 mt-1">{getFieldValue('headline').length}/120</p>
          </div>
        ) : report!.headline ? (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-5 rounded-r-lg">
            <p className="text-sm text-blue-900 font-medium">{report!.headline}</p>
          </div>
        ) : (
          <button
            onClick={() => { setEditMode(true); handleFieldChange('headline', '') }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-5"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar insight principal
          </button>
        )}

        {/* Campos do relatorio */}
        {REPORT_FIELDS.map((field) => {
          const value = getFieldValue(field.key)
          if (!editMode && !value) return null

          return (
            <div key={field.key} className="mb-5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                {field.label}
              </label>
              {editMode ? (
                <textarea
                  value={value}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              ) : (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{value}</p>
              )}
            </div>
          )
        })}

        {/* Footer IA */}
        {report!.generated_by === 'ai' && (
          <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-3 mt-4">
            Relatório assistido por IA — conteúdo revisado e aprovado pelo profissional responsável
          </p>
        )}
      </div>

      {/* Botoes de acao */}
      <div className="flex items-center gap-3 mt-4">
        {editMode ? (
          <>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
              aria-label="Salvar edicoes"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => { setEditMode(false); setEditedFields({}) }}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </>
        ) : (
          <>
            {report!.status === 'draft' && (
              <>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                  aria-label="Regenerar relatorio"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerar
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-medium"
                  aria-label="Aprovar relatorio"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? 'Aprovando...' : 'Aprovar'}
                </button>
              </>
            )}
            <button
              onClick={async () => {
                try {
                  // 1. Buscar metadados do servidor + atualizar export_count
                  const res = await fetch(`/api/sessions/${sessionId}/report/export-pdf`, { method: 'POST' })
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    alert(data.error || 'Erro ao exportar PDF')
                    return
                  }
                  const meta = await res.json()

                  // 2. Gerar PDF client-side com jsPDF
                  const doc = new jsPDF()
                  const w = doc.internal.pageSize.getWidth()
                  const margin = 20
                  const contentW = w - margin * 2
                  let y = 20

                  const strip = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  const addText = (text: string, x: number, yPos: number, opts: { size?: number; style?: string; color?: [number, number, number]; maxWidth?: number } = {}) => {
                    doc.setFontSize(opts.size || 10)
                    doc.setFont('helvetica', opts.style || 'normal')
                    doc.setTextColor(...(opts.color || [51, 51, 51]))
                    if (opts.maxWidth) doc.text(strip(text), x, yPos, { maxWidth: opts.maxWidth })
                    else doc.text(strip(text), x, yPos)
                  }
                  const checkPage = (needed: number) => { if (y + needed > 275) { doc.addPage(); y = 20 } }
                  const drawLine = () => { doc.setDrawColor(200, 200, 200); doc.line(margin, y, w - margin, y); y += 6 }

                  // Header
                  addText('AXIS Clinico', margin, y, { size: 16, style: 'bold', color: [30, 30, 80] })
                  y += 6
                  addText('Relatorio de Sessao', margin, y, { size: 11, color: [100, 100, 100] })
                  y += 8
                  drawLine()

                  // Professional
                  addText(`Profissional: ${meta.professional.name || 'Profissional'}`, margin, y, { size: 10 })
                  y += 5
                  if (meta.professional.crp) {
                    const crpLabel = meta.professional.crp_uf
                      ? `CRP: ${meta.professional.crp}/${meta.professional.crp_uf}`
                      : `CRP: ${meta.professional.crp}`
                    addText(crpLabel, margin, y, { size: 10 })
                    y += 5
                  }
                  y += 3
                  doc.setDrawColor(220, 220, 220); doc.line(margin, y, w - margin, y); y += 5

                  // Session info
                  addText(`Paciente: ${meta.patient.name || '-'}`, margin, y, { size: 10 })
                  y += 5
                  const dateStr = meta.session.date ? new Date(meta.session.date).toLocaleDateString('pt-BR') : '-'
                  const sessLabel = meta.session.number
                    ? `Sessao: #${meta.session.number} - ${strip(dateStr)}`
                    : `Sessao: ${strip(dateStr)}`
                  addText(sessLabel, margin, y, { size: 10 })
                  y += 5
                  if (meta.session.duration) {
                    addText(`Duracao: ${meta.session.duration} minutos`, margin, y, { size: 10 })
                    y += 5
                  }
                  if (meta.session.type) {
                    const typeLabels: Record<string, string> = { presencial: 'Presencial', online: 'Online', hibrida: 'Hibrida' }
                    addText(`Modalidade: ${typeLabels[meta.session.type] || meta.session.type}`, margin, y, { size: 10 })
                    y += 5
                  }
                  y += 3
                  drawLine()

                  // Headline
                  if (report!.headline && report!.headline.trim()) {
                    checkPage(15)
                    addText(report!.headline.trim(), margin, y, { size: 14, style: 'bold', color: [30, 30, 80] })
                    y += 10
                  }

                  // Sections
                  const sections = [
                    { num: '1', title: 'OBJETIVOS DA SESSAO', content: report!.objectives },
                    { num: '2', title: 'RESUMO', content: report!.summary },
                    { num: '3', title: 'INTERVENCAO DO PSICOLOGO', content: report!.intervention },
                    { num: '4', title: 'OBSERVACOES CLINICAS', content: report!.observations },
                    { num: '5', title: 'ENCERRAMENTO / TAREFA DE CASA', content: report!.closing },
                  ]

                  for (const section of sections) {
                    if (!section.content || !section.content.trim()) continue
                    checkPage(25)
                    addText(`${section.num}. ${section.title}`, margin, y, { size: 11, style: 'bold', color: [30, 30, 80] })
                    y += 6
                    const lines = doc.splitTextToSize(strip(section.content.trim()), contentW)
                    for (const line of lines) {
                      checkPage(6)
                      addText(line, margin, y, { size: 10 })
                      y += 5
                    }
                    y += 5
                  }

                  // Footer
                  checkPage(25)
                  y += 5
                  drawLine()
                  addText('Relatorio assistido por IA - conteudo revisado e aprovado pelo profissional responsavel.', margin, y, { size: 8, style: 'italic', color: [140, 140, 140] })
                  y += 5
                  const now = new Date()
                  addText(`Exportado em: ${strip(now.toLocaleDateString('pt-BR'))} ${strip(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}`, margin, y, { size: 8, color: [140, 140, 140] })
                  y += 4
                  addText('AXIS Clinico - axisclinico.com', margin, y, { size: 8, color: [140, 140, 140] })

                  // 3. Download
                  const fileName = `relatorio_sessao_${meta.session.number || 'x'}_${meta.session.date ? new Date(meta.session.date).toISOString().slice(0, 10) : 'sem-data'}.pdf`
                  doc.save(fileName)
                } catch (e) {
                  console.error('Erro ao exportar PDF:', e)
                  alert('Erro ao exportar PDF')
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              aria-label="Exportar relatorio em PDF"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>
          </>
        )}
      </div>
    </section>
  )
}
