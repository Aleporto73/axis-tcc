'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

/**
 * CaseBaseForm — Formulario Base do Caso TCC
 *
 * 4 campos TCC editaveis com auto-save (debounce 3s) + botao manual.
 * Props: patientId
 */

interface CaseBase {
  chief_complaint: string
  identified_pattern: string
  triggers: string
  core_belief: string
}

interface CaseBaseFormProps {
  patientId: string
}

const EMPTY: CaseBase = {
  chief_complaint: '',
  identified_pattern: '',
  triggers: '',
  core_belief: '',
}

const DEBOUNCE_MS = 3000

export default function CaseBaseForm({ patientId }: CaseBaseFormProps) {
  const [data, setData] = useState<CaseBase>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const dirtyRef = useRef(false)
  const mountedRef = useRef(true)

  // Fetch on mount
  useEffect(() => {
    mountedRef.current = true
    async function load() {
      try {
        const res = await fetch(`/api/patients/${patientId}/case-base`)
        if (res.ok) {
          const json = await res.json()
          if (json.case_base && mountedRef.current) {
            setData({
              chief_complaint: json.case_base.chief_complaint || '',
              identified_pattern: json.case_base.identified_pattern || '',
              triggers: json.case_base.triggers || '',
              core_belief: json.case_base.core_belief || '',
            })
          }
        }
      } catch (err) {
        console.error('[CaseBaseForm] Erro ao carregar:', err)
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }
    load()
    return () => { mountedRef.current = false }
  }, [patientId])

  // Auto-save debounce
  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    dirtyRef.current = true
    setSaved(false)
    debounceRef.current = setTimeout(() => {
      doSave()
    }, DEBOUNCE_MS)
  }, [patientId])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const doSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/case-base`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok && mountedRef.current) {
        setSaved(true)
        dirtyRef.current = false
        // Esconder "Salvo" apos 3s
        setTimeout(() => {
          if (mountedRef.current) setSaved(false)
        }, 3000)
      }
    } catch (err) {
      console.error('[CaseBaseForm] Erro ao salvar:', err)
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  const handleChange = (field: keyof CaseBase, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
    scheduleSave()
  }

  const handleManualSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    doSave()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-40 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-56" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
      {/* Header colapsavel */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between"
      >
        <div>
          <h3 className="text-lg font-semibold text-slate-900 text-left">Base do Caso</h3>
          <p className="text-xs text-slate-400 text-left">Formulacao TCC do paciente</p>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Conteudo */}
      {!collapsed && (
        <div className="mt-4 space-y-4">
          {/* Queixa principal */}
          <div>
            <label className="block text-xs uppercase text-slate-500 tracking-wide font-medium mb-1">
              Queixa principal
            </label>
            <textarea
              value={data.chief_complaint}
              onChange={(e) => handleChange('chief_complaint', e.target.value)}
              placeholder="O que trouxe o paciente"
              className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Padrao identificado */}
          <div>
            <label className="block text-xs uppercase text-slate-500 tracking-wide font-medium mb-1">
              Padrao identificado
            </label>
            <textarea
              value={data.identified_pattern}
              onChange={(e) => handleChange('identified_pattern', e.target.value)}
              placeholder="Evitacao / enfrentamento / ruminacao / controle"
              className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Gatilhos */}
          <div>
            <label className="block text-xs uppercase text-slate-500 tracking-wide font-medium mb-1">
              Gatilhos
            </label>
            <textarea
              value={data.triggers}
              onChange={(e) => handleChange('triggers', e.target.value)}
              placeholder="Situacoes que disparam o padrao"
              className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Crenca central */}
          <div>
            <label className="block text-xs uppercase text-slate-500 tracking-wide font-medium mb-1">
              Crenca central (hipotese)
            </label>
            <textarea
              value={data.core_belief}
              onChange={(e) => handleChange('core_belief', e.target.value)}
              placeholder="Formulacao do caso"
              title="Hipotese do profissional — a IA trata este campo como input subjetivo, nao como diagnostico."
              className="w-full border border-slate-200 rounded-lg p-3 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Footer: status + botao */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs">
              {saving && <span className="text-slate-500">Salvando...</span>}
              {saved && !saving && <span className="text-emerald-600">Salvo</span>}
            </div>
            <button
              onClick={handleManualSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
