'use client'

/**
 * EvolutionPanel — Painel de evolução CSO entre sessões
 *
 * Mostra deltas numéricos (só números + setas) e timeline das últimas sessões.
 * NÃO inclui frases interpretativas. Interpretação é do profissional.
 *
 * Regra R4: |delta| < 0.05 = estável (→)
 * Se evolution é null → return null (não renderiza)
 */

interface CsoDimensions {
  activation_level: number | null
  cognitive_rigidity: number | null
  emotional_load: number | null
  task_adherence: number | null
}

interface TimelineEntry {
  session_number: number
  scheduled_at: string
  cso: CsoDimensions | null
  headline: string | null
}

interface Evolution {
  delta: CsoDimensions | null
  timeline: TimelineEntry[]
}

interface EvolutionPanelProps {
  evolution: Evolution | null
  variant?: 'light' | 'dark'
}

const STABILITY_THRESHOLD = 0.05

function formatDelta(value: number | null, isDark = false): { label: string; arrow: string; colorClass: string } {
  const neutral = isDark ? 'text-slate-500' : 'text-slate-400'
  const up = isDark ? 'text-emerald-400' : 'text-emerald-600'
  const down = isDark ? 'text-amber-400' : 'text-amber-600'

  if (value === null) return { label: '—', arrow: '', colorClass: neutral }

  const abs = Math.abs(value)

  // R4: |delta| < 0.05 = estável
  if (abs < STABILITY_THRESHOLD) {
    return { label: '0.00', arrow: '→', colorClass: neutral }
  }

  if (value > 0) {
    return { label: `+${value.toFixed(2)}`, arrow: '↑', colorClass: up }
  }

  return { label: value.toFixed(2), arrow: '↓', colorClass: down }
}

const dimensionLabels: { key: keyof CsoDimensions; label: string }[] = [
  { key: 'activation_level', label: 'Ativação' },
  { key: 'emotional_load', label: 'Carga emocional' },
  { key: 'task_adherence', label: 'Adesão tarefas' },
  { key: 'cognitive_rigidity', label: 'Rigidez cogn.' },
]

export default function EvolutionPanel({ evolution, variant = 'light' }: EvolutionPanelProps) {
  if (!evolution) return null

  const { delta, timeline } = evolution
  if (!timeline) return null

  const isDark = variant === 'dark'
  const containerCls = isDark
    ? 'bg-slate-900/40 rounded-xl border border-slate-700 p-4 mb-6'
    : 'bg-white rounded-xl border border-slate-200 p-4 mb-6'
  const headingCls = isDark
    ? 'text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3'
    : 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3'
  const dimLabelCls = isDark ? 'text-xs text-slate-500 mb-1' : 'text-xs text-slate-400 mb-1'
  const timelineLineCls = isDark
    ? 'border-l-2 border-slate-700 ml-2 pl-4 space-y-2 mt-3'
    : 'border-l-2 border-slate-200 ml-2 pl-4 space-y-2 mt-3'
  const lastEntryCls = isDark ? 'font-medium text-slate-100' : 'font-medium text-slate-900'
  const entryCls = isDark ? 'text-slate-300' : 'text-slate-600'
  const headlineCls = isDark ? 'text-slate-400 ml-2' : 'text-slate-500 ml-2'
  const noReportCls = isDark ? 'text-slate-500 italic ml-2' : 'text-slate-400 italic ml-2'

  return (
    <div className={containerCls}>
      <h3 className={headingCls}>
        Evolução CSO
      </h3>

      {/* Delta grid */}
      {delta && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {dimensionLabels.map(({ key, label }) => {
            const d = formatDelta(delta[key], isDark)
            return (
              <div key={key} className="text-center">
                <p className={dimLabelCls}>{label}</p>
                <p className={`font-mono text-sm ${d.colorClass}`}>
                  {d.arrow} {d.label}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className={timelineLineCls}>
          {timeline.map((entry, i) => {
            const isLast = i === timeline.length - 1
            const date = new Date(entry.scheduled_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            })

            return (
              <div key={entry.session_number} className="text-sm">
                <span className={isLast ? lastEntryCls : entryCls}>
                  #{entry.session_number} ({date})
                </span>
                {entry.headline ? (
                  <span className={headlineCls}>{entry.headline}</span>
                ) : (
                  <span className={noReportCls}>sem relatório</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
