'use client'

import { DemoNav, LockButton } from '../_components'
import { LEARNERS } from '../_mock'

export default function DemoRelatoriosPage() {
  return (
    <>
      <DemoNav active="relatorios" />

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6">
          <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Relatórios</h1>
          <p className="text-xs text-slate-300 font-light">Geração de relatórios clínicos · Dados demonstrativos</p>
        </header>

        {/* Learner selector (visual) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Selecione o aprendiz</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LEARNERS.map(l => (
              <div
                key={l.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-aba-500/30 transition-colors cursor-default"
              >
                <div className="w-9 h-9 rounded-full bg-aba-500/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-aba-500">{l.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{l.name}</p>
                  <p className="text-[11px] text-slate-400">{l.age} · CSO {l.cso_aba}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Report types */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Tipos de relatório disponíveis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                title: 'Relatório de Evolução',
                desc: 'Progresso terapêutico com gráficos CSO-ABA, dimensões e protocolos.',
                icon: (
                  <svg className="w-5 h-5 text-aba-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                ),
              },
              {
                title: 'Relatório para Convênio',
                desc: 'Documentação formatada para operadoras de saúde (RN 469/541).',
                icon: (
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                ),
              },
              {
                title: 'Snapshot CSO-ABA',
                desc: 'Registro imutável do estado clínico atual com hash SHA256.',
                icon: (
                  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
              {
                title: 'Log de Auditoria',
                desc: 'Registro completo de ações clínicas para governança institucional.',
                icon: (
                  <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
            ].map(r => (
              <div key={r.title} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="mt-0.5 shrink-0">{r.icon}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{r.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <LockButton label="Gerar Relatório PDF" />
          <LockButton label="Exportar Dados" />
          <LockButton label="Ver Snapshot" />
          <LockButton label="Log de Auditoria" />
        </div>

        <p className="text-[10px] text-slate-300 text-center mt-8 mb-4">
          Na versão completa, relatórios são gerados em PDF com dados reais do aprendiz.
        </p>
      </div>
    </>
  )
}
