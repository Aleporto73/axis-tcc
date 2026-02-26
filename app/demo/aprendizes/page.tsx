'use client'

import { DemoNav, LockButton } from '../_components'
import { LEARNERS } from '../_mock'

const bandColors: Record<string, string> = {
  critico: 'text-red-500', alerta: 'text-amber-500', moderado: 'text-blue-500', bom: 'text-green-500', excelente: 'text-emerald-500',
}
const bandLabels: Record<string, string> = {
  critico: 'Crítico', alerta: 'Alerta', moderado: 'Moderado', bom: 'Bom', excelente: 'Excelente',
}
const supportLabels: Record<number, string> = { 1: 'Nível 1', 2: 'Nível 2', 3: 'Nível 3' }

export default function DemoAprendizesPage() {
  return (
    <>
      <DemoNav active="aprendizes" />

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Aprendizes</h1>
            <p className="text-xs text-slate-300 font-light">3 aprendizes cadastrados · Dados demonstrativos</p>
          </div>
          <LockButton label="+ Novo Aprendiz" />
        </header>

        <div className="space-y-2">
          {LEARNERS.map(l => (
            <div
              key={l.id}
              className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-200 bg-white gap-3"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-aba-500/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-aba-500">{l.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-slate-800 truncate">{l.name}</h3>
                  <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400">{l.age}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-400">{l.cid_code}</span>
                    <span className="text-slate-300 hidden sm:inline">·</span>
                    <span className="text-xs text-slate-400 hidden sm:inline">{supportLabels[l.support_level]}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
                  <span>{l.protocols_active} {l.protocols_active === 1 ? 'protocolo' : 'protocolos'}</span>
                  <span className="text-slate-300">·</span>
                  <span>{l.total_sessions} {l.total_sessions === 1 ? 'sessão' : 'sessões'}</span>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${bandColors[l.cso_band] || 'text-slate-500'}`}>{l.cso_aba}</p>
                  <p className={`text-[10px] ${bandColors[l.cso_band] || 'text-slate-400'}`}>{bandLabels[l.cso_band]}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-2 flex-wrap">
          <LockButton label="Ver Perfil Completo" />
          <LockButton label="Novo Protocolo" />
          <LockButton label="Gerar Relatório" />
        </div>
      </div>
    </>
  )
}
