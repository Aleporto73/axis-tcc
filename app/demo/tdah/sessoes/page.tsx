'use client'

import { DemoNavTDAH, LockButtonTDAH, ContextBadge } from '../_components-tdah'
import { SESSIONS_TDAH } from '../_mock-tdah'

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada',
}
const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-600', in_progress: 'bg-[#0d7377]/10 text-[#0d7377]',
  completed: 'bg-green-50 text-green-600', cancelled: 'bg-slate-100 text-slate-400',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function DemoTDAHSessoesPage() {
  const today = new Date().toISOString().split('T')[0]
  const todaySessions = SESSIONS_TDAH.filter(s => s.scheduled_at.startsWith(today))
  const otherSessions = SESSIONS_TDAH.filter(s => !s.scheduled_at.startsWith(today))

  return (
    <>
      <DemoNavTDAH active="sessoes" />

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Sessões</h1>
            <p className="text-xs text-slate-300 font-light">{SESSIONS_TDAH.length} sessões · Tricontextual · Dados demonstrativos</p>
          </div>
          <LockButtonTDAH label="+ Nova Sessão" />
        </header>

        {/* Filters (visual only) */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['Todas', 'Agendadas', 'Concluídas'].map((label, i) => (
            <button
              key={label}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                i === 0 ? 'border-[#0d7377] text-[#0d7377] bg-[#0d7377]/5' : 'border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="text-slate-300 text-xs leading-6">|</span>
          {['Clínico', 'Domiciliar', 'Escolar'].map(label => (
            <button
              key={label}
              className="px-3 py-1 text-xs rounded-full border border-slate-200 text-slate-400 cursor-not-allowed"
            >
              {label}
            </button>
          ))}
        </div>

        {todaySessions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-medium text-[#0d7377] uppercase tracking-wider mb-3">Hoje</h2>
            <div className="space-y-2">
              {todaySessions.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-[#0d7377]/20 bg-[#0d7377]/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white border border-[#0d7377]/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-[#0d7377]">{s.patient_name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-800">{s.patient_name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{formatTime(s.scheduled_at)}</span>
                        <span className="text-slate-300">&middot;</span>
                        <span className="text-xs text-slate-400">{s.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ContextBadge context={s.context} />
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[s.status]}`}>
                      {statusLabels[s.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {otherSessions.length > 0 && (
          <div>
            {todaySessions.length > 0 && (
              <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Anteriores e futuras</h2>
            )}
            <div className="space-y-2">
              {otherSessions.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#0d7377]/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-[#0d7377]">{s.patient_name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-800">{s.patient_name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{formatDate(s.scheduled_at)} às {formatTime(s.scheduled_at)}</span>
                        <span className="text-slate-300">&middot;</span>
                        <span className="text-xs text-slate-400">{s.location}</span>
                        {s.duration_minutes && (
                          <>
                            <span className="text-slate-300">&middot;</span>
                            <span className="text-xs text-slate-400">{s.duration_minutes} min</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ContextBadge context={s.context} />
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[s.status]}`}>
                      {statusLabels[s.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
