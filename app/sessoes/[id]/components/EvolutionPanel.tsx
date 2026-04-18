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
}

const STABILITY_THRESHOLD = 0.05

function formatDelta(value: number | null): { label: string; arrow: string; colorClass: string } {
  if (value === null) return { label: '—', arrow: '', colorClass: 'text-slate-400' }

  const abs = Math.abs(value)

  // R4: |delta| < 0.05 = estável
  if (abs < STABILITY_THRESHOLD) {
    return { label: '0.00', arrow: '→', colorClass: 'text-slate-400' }
  }

  if (value > 0) {
    return { label: `+${value.toFixed(2)}`, arrow: '↑', colorClass: 'text-emerald-600' }
  }

  return { label: value.toFixed(2), arrow: '↓', colorClass: 'text-amber-600' }
}

const dimensionLabels: { key: keyof CsoDimensions; label: string }[] = [
  { key: 'activation_level', label: 'Ativação' },
  { key: 'emotional_load', label: 'Carga emocional' },
  { key: 'task_adherence', label: 'Adesão tarefas' },
  { key: 'cognitive_rigidity', label: 'Rigidez cogn.' },
]

export default function EvolutionPanel({ evolution }: EvolutionPanelProps) {
  if (!evolution) return null

  const { delta, timeline } = evolution
  if (!timeline) return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Evolução CSO
      </h3>

      {/* Delta grid */}
      {delta && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          {dimensionLabels.map(({ key, label }) => {
            const d = formatDelta(delta[key])
            return (
              <div key={key} className="text-center">
                <p className="text-xs text-slate-400 mb-1">{label}</p>
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
        <div className="border-l-2 border-slate-200 ml-2 pl-4 space-y-2 mt-3">
          {timeline.map((entry, i) => {
            const isLast = i === timeline.length - 1
            const date = new Date(entry.scheduled_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            })

            return (
              <div key={entry.session_number} className="text-sm">
                <span className={isLast ? 'font-medium text-slate-900' : 'text-slate-600'}>
                  #{entry.session_number} ({date})
                </span>
                {entry.headline ? (
                  <span className="text-slate-500 ml-2">{entry.headline}</span>
                ) : (
                  <span className="text-slate-400 italic ml-2">sem relatório</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
