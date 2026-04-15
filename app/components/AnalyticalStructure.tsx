'use client'

import { useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

interface AnalyticalStructureProps {
  analysis: {
    fatos: string[]
    pensamentos: string[]
    emocoes: string[]
  } | null
}

export default function AnalyticalStructure({ analysis }: AnalyticalStructureProps) {
  const [mainOpen, setMainOpen] = useState(false)
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set())

  if (!analysis) return null

  const hasFatos = analysis.fatos && analysis.fatos.length > 0
  const hasPensamentos = analysis.pensamentos && analysis.pensamentos.length > 0
  const hasEmocoes = analysis.emocoes && analysis.emocoes.length > 0

  if (!hasFatos && !hasPensamentos && !hasEmocoes) return null

  const toggleSub = (key: string) => {
    setOpenSubs(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <section className="mb-8">
      <div
        className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"
        title="Dados extra\u00eddos pela IA a partir da transcri\u00e7\u00e3o. \u00datil para revis\u00e3o detalhada ou supervis\u00e3o."
      >
        <button
          onClick={() => setMainOpen(!mainOpen)}
          className="flex items-center justify-between w-full px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
          aria-expanded={mainOpen}
        >
          <div className="flex items-center gap-2 text-slate-500">
            <Search className="w-4 h-4" />
            <span className="text-sm font-medium">{"Ver estrutura da an\u00e1lise"}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${mainOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className={`transition-all duration-200 overflow-hidden ${mainOpen ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-4 pb-4 space-y-3">
            {hasFatos && (
              <SubSection
                title="Fatos extra\u00eddos"
                count={analysis.fatos.length}
                isOpen={openSubs.has('fatos')}
                onToggle={() => toggleSub('fatos')}
                bgClass="bg-sky-50"
                borderClass="border-sky-200"
                headerTextClass="text-sky-800"
                itemBorderClass="border-sky-100"
              >
                {analysis.fatos.map((f, i) => (
                  <li key={i} className="text-sm bg-white rounded p-2 border border-sky-100">{f}</li>
                ))}
              </SubSection>
            )}

            {hasPensamentos && (
              <SubSection
                title="Pensamentos identificados"
                count={analysis.pensamentos.length}
                isOpen={openSubs.has('pensamentos')}
                onToggle={() => toggleSub('pensamentos')}
                bgClass="bg-amber-50"
                borderClass="border-amber-200"
                headerTextClass="text-amber-800"
                itemBorderClass="border-amber-100"
              >
                {analysis.pensamentos.map((p, i) => (
                  <li key={i} className="text-sm bg-white rounded p-2 border border-amber-100">{p}</li>
                ))}
              </SubSection>
            )}

            {hasEmocoes && (
              <SubSection
                title={"Emo\u00e7\u00f5es brutas"}
                count={analysis.emocoes.length}
                isOpen={openSubs.has('emocoes')}
                onToggle={() => toggleSub('emocoes')}
                bgClass="bg-rose-50"
                borderClass="border-rose-200"
                headerTextClass="text-rose-800"
                itemBorderClass="border-rose-100"
              >
                {analysis.emocoes.map((e, i) => (
                  <li key={i} className="text-sm bg-white rounded p-2 border border-rose-100">{e}</li>
                ))}
              </SubSection>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function SubSection({
  title, count, isOpen, onToggle, bgClass, borderClass, headerTextClass, children
}: {
  title: string
  count: number
  isOpen: boolean
  onToggle: () => void
  bgClass: string
  borderClass: string
  headerTextClass: string
  itemBorderClass: string
  children: React.ReactNode
}) {
  return (
    <div className={`${bgClass} rounded-lg border ${borderClass} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
        aria-expanded={isOpen}
      >
        <span className={`text-sm font-medium ${headerTextClass}`}>
          {title} ({count})
        </span>
        <ChevronDown className={`w-3.5 h-3.5 ${headerTextClass} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <ul className="px-3 pb-3 space-y-2">
          {children}
        </ul>
      </div>
    </div>
  )
}
