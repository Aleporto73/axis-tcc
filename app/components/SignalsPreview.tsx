'use client'

import { AlertCircle, Zap } from 'lucide-react'

interface SignalsPreviewProps {
  insights: {
    emotions?: { name: string; intensity: number }[]
    distortions?: { type: string; label: string; example: string }[]
  } | null
  microEvents?: { type: string; count: number }[]
  onClickSignal?: (section: string) => void
}

const MICRO_LABELS: Record<string, string> = {
  'AVOIDANCE_OBSERVED': 'Evitacao',
  'CONFRONTATION_OBSERVED': 'Enfrentamento',
  'ADJUSTMENT_OBSERVED': 'Ajuste',
  'RECOVERY_OBSERVED': 'Recuperacao',
}

export default function SignalsPreview({ insights, microEvents, onClickSignal }: SignalsPreviewProps) {
  const chips: { label: string; section: string; style: string }[] = []

  // 1. Micro-evento dominante (count >= 2)
  if (microEvents && microEvents.length > 0) {
    const dominant = microEvents
      .filter(e => e.count >= 2)
      .sort((a, b) => b.count - a.count)[0]
    if (dominant) {
      const label = MICRO_LABELS[dominant.type] || dominant.type
      chips.push({
        label: `${label} (${dominant.count})`,
        section: 'micro-events',
        style: 'bg-red-50 text-red-700 border border-red-200',
      })
    }
  }

  // 2. Emocao com maior intensidade (>= 0.5 na escala 0-1)
  if (insights?.emotions && insights.emotions.length > 0) {
    const normalized = insights.emotions.map(e => ({
      ...e,
      intensity: e.intensity > 1 ? e.intensity / 10 : e.intensity,
    }))
    const top = normalized
      .filter(e => e.intensity >= 0.5)
      .sort((a, b) => b.intensity - a.intensity)[0]
    if (top) {
      chips.push({
        label: `${top.name} ${top.intensity.toFixed(1)}`,
        section: 'emotions',
        style: 'bg-amber-50 text-amber-700 border border-amber-200',
      })
    }
  }

  // Max 2 chips, distorcoes NAO entram no preview (sao interpretativas)
  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 rounded-lg border border-slate-200 mb-8">
      <Zap className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <div className="flex items-center gap-2 flex-wrap">
        {chips.map((chip, i) => (
          <span key={i}>
            {i > 0 && <span className="text-slate-300 mx-1">·</span>}
            <button
              onClick={() => onClickSignal?.(chip.section)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${chip.style}`}
            >
              {chip.section === 'micro-events' && <AlertCircle className="w-3 h-3" />}
              {chip.label}
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
