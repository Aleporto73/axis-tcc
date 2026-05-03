'use client'

import { useUsage } from '@/app/hooks/useUsage'

// =====================================================
// Barra de uso de transcricao - Fase 12.2
// FREE: "45/300 min" com barra de progresso (acumulado lifetime)
// PAGO: "Transcricao ilimitada" (verde)
// =====================================================

export default function TranscriptionUsageBar() {
  const { data } = useUsage()

  if (!data) return null

  // Pago -> badge simples
  if (!data.is_free) {
    return (
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-green-700 font-medium">Transcrição ilimitada</span>
        </div>
      </div>
    )
  }

  // Free -> barra de progresso acumulado (lifetime)
  const limit = data.limit || 300
  const used = data.minutes_used
  const pct = Math.min((used / limit) * 100, 100)
  const isWarning = pct >= 80
  const isLimit = used >= limit

  return (
    <div className="px-3 py-2 bg-slate-50 rounded-lg">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">Transcrição</span>
        <span className={`text-xs font-semibold ${isLimit ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-600'}`}>
          {used}/{limit} min
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isLimit ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
