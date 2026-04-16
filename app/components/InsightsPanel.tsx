'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Zap, CheckCircle, Activity, TrendingUp, TrendingDown, Minus, Heart } from 'lucide-react'

interface InsightsPanelProps {
  insights: {
    emotions?: { name: string; intensity: number }[]
    topics?: string[]
    distortions?: { type: string; label: string; example: string }[]
    techniques_identified?: string[]
  } | null
  microEvents?: { type: string; intensity: number; note: string; created_at: string }[]
  cso?: {
    activation_level: number | null
    cognitive_rigidity: number | null
    emotional_load: number | null
    flex_trend: string | null
  } | null
  openSection?: string | null
}

const EMOTION_COLORS: Record<string, string> = {
  raiva: 'bg-red-50 text-red-700 border-red-200',
  tristeza: 'bg-blue-50 text-blue-700 border-blue-200',
  medo: 'bg-violet-50 text-violet-700 border-violet-200',
  ansiedade: 'bg-amber-50 text-amber-700 border-amber-200',
  confianca: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  alegria: 'bg-green-50 text-green-700 border-green-200',
  culpa: 'bg-slate-100 text-slate-700 border-slate-300',
  vergonha: 'bg-pink-50 text-pink-700 border-pink-200',
}

const EMOTION_BAR_COLORS: Record<string, string> = {
  raiva: 'bg-red-400',
  tristeza: 'bg-blue-400',
  medo: 'bg-violet-400',
  ansiedade: 'bg-amber-400',
  confianca: 'bg-emerald-400',
  alegria: 'bg-green-400',
  culpa: 'bg-slate-400',
  vergonha: 'bg-pink-400',
}

const MICRO_LABELS: Record<string, { label: string; style: string }> = {
  AVOIDANCE_OBSERVED: { label: 'Evitou', style: 'bg-red-100 text-red-700' },
  CONFRONTATION_OBSERVED: { label: 'Enfrentou', style: 'bg-amber-100 text-amber-700' },
  ADJUSTMENT_OBSERVED: { label: 'Ajustou', style: 'bg-blue-100 text-blue-700' },
  RECOVERY_OBSERVED: { label: 'Recuperou', style: 'bg-emerald-100 text-emerald-700' },
}

function getEmotionColor(name: string): string {
  const key = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return EMOTION_COLORS[key] || 'bg-slate-50 text-slate-700 border-slate-200'
}

function getEmotionBarColor(name: string): string {
  const key = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return EMOTION_BAR_COLORS[key] || 'bg-slate-400'
}

function normalizeIntensity(v: number): number {
  return v > 1 ? v / 10 : v
}

export default function InsightsPanel({ insights, microEvents, cso, openSection }: InsightsPanelProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (openSection) {
      setOpenSections(prev => new Set(prev).add(openSection))
    }
  }, [openSection])

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const hasEmotions = insights?.emotions && insights.emotions.length > 0
  const hasTopics = insights?.topics && insights.topics.length > 0
  const hasDistortions = insights?.distortions && insights.distortions.length > 0
  const hasTechniques = insights?.techniques_identified && insights.techniques_identified.length > 0
  const hasMicroEvents = microEvents && microEvents.length > 0
  const hasCso = cso && (cso.activation_level !== null || cso.cognitive_rigidity !== null || cso.emotional_load !== null)

  const hasAnything = hasEmotions || hasTopics || hasDistortions || hasTechniques || hasMicroEvents || hasCso
  if (!hasAnything) return null

  const microCounts = microEvents?.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.type] = (acc[ev.type] || 0) + 1
    return acc
  }, {}) || {}

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide" title="An\u00e1lise inteligente extra\u00edda da transcri\u00e7\u00e3o. Diferencial exclusivo AXIS.">Insights AXIS</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {hasEmotions && (
          <AccordionItem
            title="Emo&#231;&#245;es identificadas"
            icon={<Heart className="w-4 h-4" />}
            isOpen={openSections.has('emotions')}
            onToggle={() => toggleSection('emotions')}
            count={insights!.emotions!.length}
          >
            <div className="space-y-2">
              {insights!.emotions!.map((em, i) => {
                const intensity = normalizeIntensity(em.intensity)
                return (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${getEmotionColor(em.name)}`}>
                    <span className="text-xs font-medium min-w-[80px]">{em.name}</span>
                    <div className="flex-1 h-2 bg-white/50 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getEmotionBarColor(em.name)}`} style={{ width: `${Math.round(intensity * 100)}%` }} />
                    </div>
                    <span className="text-xs font-mono">{intensity.toFixed(1)}</span>
                  </div>
                )
              })}
            </div>
          </AccordionItem>
        )}

        {hasTopics && (
          <AccordionItem
            title="T&#243;picos da sess&#227;o"
            icon={<span className="text-sm">#</span>}
            isOpen={openSections.has('topics')}
            onToggle={() => toggleSection('topics')}
            count={insights!.topics!.length}
          >
            <div className="flex flex-wrap gap-2">
              {insights!.topics!.map((t, i) => (
                <span key={i} className="bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1 text-xs font-medium">
                  # {t}
                </span>
              ))}
            </div>
          </AccordionItem>
        )}

        {hasDistortions && (
          <AccordionItem
            title="Poss&#237;veis distor&#231;&#245;es cognitivas"
            icon={<Zap className="w-4 h-4" />}
            isOpen={openSections.has('distortions')}
            onToggle={() => toggleSection('distortions')}
            count={insights!.distortions!.length}
          >
            <p className="text-xs text-amber-600 italic mb-3">
              {"Poss\u00edveis distor\u00e7\u00f5es identificadas \u2014 requer valida\u00e7\u00e3o do profissional"}
            </p>
            <div className="space-y-2">
              {insights!.distortions!.map((d, i) => (
                <div key={i} className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-sm font-medium text-orange-800">{d.label}</span>
                  </div>
                  {d.example && (
                    <p className="text-xs text-orange-600 italic ml-6">{`"${d.example}"`}</p>
                  )}
                </div>
              ))}
            </div>
          </AccordionItem>
        )}

        {hasTechniques && (
          <AccordionItem
            title="T&#233;cnicas identificadas na sess&#227;o"
            icon={<CheckCircle className="w-4 h-4" />}
            isOpen={openSections.has('techniques')}
            onToggle={() => toggleSection('techniques')}
            count={insights!.techniques_identified!.length}
          >
            <div className="flex flex-wrap gap-2">
              {insights!.techniques_identified!.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  {t}
                </span>
              ))}
            </div>
          </AccordionItem>
        )}

        {hasMicroEvents && (
          <AccordionItem
            title="Micro-eventos 3&#170; Onda"
            icon={<Activity className="w-4 h-4" />}
            isOpen={openSections.has('micro-events')}
            onToggle={() => toggleSection('micro-events')}
            count={microEvents!.length}
          >
            <div className="flex flex-wrap gap-3">
              {Object.entries(microCounts).map(([type, count]) => {
                const info = MICRO_LABELS[type]
                if (!info) return null
                return (
                  <span key={type} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${info.style}`}>
                    {info.label}: {count}
                  </span>
                )
              })}
            </div>
          </AccordionItem>
        )}

        {hasCso && (
          <AccordionItem
            title="Estado Cl&#237;nico (CSO)"
            icon={<TrendingUp className="w-4 h-4" />}
            isOpen={openSections.has('cso')}
            onToggle={() => toggleSection('cso')}
          >
            <div className="space-y-3">
              {cso!.activation_level !== null && (
                <CsoBar label="Ativa&#231;&#227;o" value={cso!.activation_level!} />
              )}
              {cso!.cognitive_rigidity !== null && (
                <CsoBar label="Rigidez cognitiva" value={cso!.cognitive_rigidity!} />
              )}
              {cso!.emotional_load !== null && (
                <CsoBar label="Carga emocional" value={cso!.emotional_load!} />
              )}
              {cso!.flex_trend && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">{"Tend\u00eancia:"}</span>
                  <FlexTrendBadge trend={cso!.flex_trend} />
                </div>
              )}
            </div>
          </AccordionItem>
        )}
      </div>
    </section>
  )
}

function FlexTrendBadge({ trend }: { trend: string }) {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
        <TrendingUp className="w-3 h-3" /> Subindo
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
        <TrendingDown className="w-3 h-3" /> Descendo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
      <Minus className="w-3 h-3" /> {"Est\u00e1vel"}
    </span>
  )
}

function AccordionItem({
  title, icon, isOpen, onToggle, count, children
}: {
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 text-slate-600">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          {count !== undefined && (
            <span className="text-xs text-slate-400">({count})</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}

function CsoBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.7 ? 'bg-emerald-400' : value >= 0.5 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 min-w-[120px]">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-600">{value.toFixed(2)}</span>
    </div>
  )
}
