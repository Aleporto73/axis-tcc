'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Pencil, Check, Download, RefreshCw, X, Plus } from 'lucide-react'

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
                  const res = await fetch(`/api/sessions/${sessionId}/report/export-pdf`, { method: 'POST' })
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    alert(data.error || 'Erro ao exportar PDF')
                    return
                  }
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  const disposition = res.headers.get('Content-Disposition') || ''
                  const match = disposition.match(/filename="?([^"]+)"?/)
                  a.download = match ? match[1] : `relatorio_sessao.pdf`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
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
