'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  CID_CATALOG,
  searchCID,
  getCoreCatalog,
  groupByDiagnosticGroup,
  GROUP_LABELS,
  type CIDSystem,
  type CIDCode,
  type DiagnosticGroup,
} from '@/lib/cid'

interface CIDSelectorProps {
  value?: string
  system?: CIDSystem
  label?: string
  onChange: (code: string, system: CIDSystem, label: string) => void
}

export function CIDSelector({ value, system: initialSystem, label, onChange }: CIDSelectorProps) {
  const [system, setSystem] = useState<CIDSystem>(initialSystem || 'CID-10')
  const [showAll, setShowAll] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const manualRef = useRef<HTMLInputElement>(null)

  // Focar input manual quando ativar
  useEffect(() => {
    if (manualMode && manualRef.current) {
      manualRef.current.focus()
    }
  }, [manualMode])

  const filteredCodes = useMemo(() => {
    if (searchQuery.trim()) {
      return searchCID(searchQuery, system)
    }
    return showAll
      ? CID_CATALOG.filter(c => c.system === system)
      : getCoreCatalog(system)
  }, [system, showAll, searchQuery])

  const grouped = groupByDiagnosticGroup(filteredCodes)

  const handleSelect = (code: string) => {
    if (code === '__MANUAL__') {
      setManualMode(true)
      return
    }
    const item = CID_CATALOG.find(c => c.code === code)
    onChange(code, system, item?.label_short || code)
    setManualMode(false)
  }

  const handleManualConfirm = () => {
    const trimmed = manualCode.trim()
    if (trimmed) {
      onChange(trimmed, system, trimmed)
    }
    setManualMode(false)
    setManualCode('')
  }

  const handleSystemChange = (newSystem: CIDSystem) => {
    setSystem(newSystem)
    setSearchQuery('')
    // NÃO limpa a seleção atual — só muda o filtro do dropdown
  }

  const groupOrder: DiagnosticGroup[] = ['TEA', 'TDAH', 'DI', 'LINGUAGEM', 'MOTOR', 'OUTRO']

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600 mb-1">
        CID (diagnóstico)
      </label>

      {/* Toggle CID-10 / CID-11 */}
      <div className="flex gap-1.5">
        {(['CID-10', 'CID-11'] as CIDSystem[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => handleSystemChange(s)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              system === s
                ? 'bg-aba-500 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Campo de busca */}
      <input
        type="text"
        placeholder="Buscar: autismo, TEA, TDAH, F84..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-aba-500 text-slate-600 placeholder:text-slate-300"
      />

      {/* Dropdown agrupado */}
      <select
        value={value || ''}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white text-slate-700"
      >
        <option value="">Selecione o CID (opcional)</option>

        {groupOrder.map(g => {
          const items = grouped[g]
          if (!items || items.length === 0) return null
          return (
            <optgroup key={g} label={GROUP_LABELS[g]}>
              {items.map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label_short}
                </option>
              ))}
            </optgroup>
          )
        })}

        <optgroup label="Entrada manual">
          <option value="__MANUAL__">Digitar código manualmente...</option>
        </optgroup>
      </select>

      {/* Input manual inline (substitui prompt()) */}
      {manualMode && (
        <div className="flex gap-2 items-center">
          <input
            ref={manualRef}
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualConfirm()
              if (e.key === 'Escape') { setManualMode(false); setManualCode('') }
            }}
            placeholder="Ex: F84.0 ou 6A02.3"
            className="flex-1 px-3 py-1.5 border border-aba-500/50 rounded-lg text-xs focus:outline-none focus:border-aba-500 text-slate-600"
          />
          <button
            type="button"
            onClick={handleManualConfirm}
            className="px-3 py-1.5 bg-aba-500 text-white text-xs rounded-lg hover:bg-aba-600 transition-colors"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => { setManualMode(false); setManualCode('') }}
            className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Footer: toggle ver todos + hint */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] text-slate-400 hover:text-aba-500 transition-colors"
        >
          {showAll ? 'Mostrar principais' : 'Ver todos os códigos'}
        </button>
        <span className="text-[10px] text-slate-300">
          Opcional — para relatórios e convênios
        </span>
      </div>

      {/* Badge do valor selecionado */}
      {value && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-aba-500/10 text-aba-600 px-2.5 py-1 rounded-md text-xs">
            <span className="font-medium">{value}</span>
            {label && label !== value && (
              <>
                <span className="text-aba-400">—</span>
                <span>{label}</span>
              </>
            )}
            <span className="text-[10px] text-aba-400 ml-1">{system}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange('', system, '')}
            className="text-slate-300 hover:text-slate-500 transition-colors"
            title="Limpar CID"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
