'use client'

import Link from 'next/link'
import { DemoNavTDAH, LockButtonTDAH, AuDHDBadge } from '../_components-tdah'
import { PATIENTS, bandColorsTDAH, getBandLabelTDAH } from '../_mock-tdah'

const bandClasses: Record<string, string> = {
  critico: 'text-red-500',
  atencao: 'text-amber-500',
  bom: 'text-green-500',
  excelente: 'text-emerald-500',
}

export default function DemoTDAHPacientesPage() {
  return (
    <>
      <DemoNavTDAH active="pacientes" />

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Pacientes</h1>
            <p className="text-xs text-slate-300 font-light">{PATIENTS.length} pacientes cadastrados · Dados demonstrativos</p>
          </div>
          <LockButtonTDAH label="+ Novo Paciente" />
        </header>

        <div className="space-y-2">
          {PATIENTS.map(p => (
            <Link
              key={p.id}
              href={`/demo/tdah/pacientes?id=${p.id}`}
              className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-200 bg-white gap-3 hover:border-[#0d7377]/30 transition-colors"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#0d7377]/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-[#0d7377]">{p.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-slate-800 truncate">{p.name}</h3>
                    <AuDHDBadge layer={p.audhd_layer} />
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400">{p.age}</span>
                    <span className="text-slate-300">&middot;</span>
                    <span className="text-xs text-slate-400">{p.cid_code}</span>
                    <span className="text-slate-300 hidden sm:inline">&middot;</span>
                    <span className="text-xs text-slate-400 hidden sm:inline">{p.school}</span>
                    <span className="text-slate-300 hidden sm:inline">&middot;</span>
                    <span className="text-xs text-slate-400 hidden sm:inline">{p.grade}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
                  <span>{p.protocols_active} {p.protocols_active === 1 ? 'protocolo' : 'protocolos'}</span>
                  <span className="text-slate-300">&middot;</span>
                  <span>{p.total_sessions} sessões</span>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${bandClasses[p.cso_band] || 'text-slate-500'}`}>{p.cso_tdah}</p>
                  <p className={`text-[10px] ${bandClasses[p.cso_band] || 'text-slate-400'}`}>{getBandLabelTDAH(p.cso_tdah)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex gap-2 flex-wrap">
          <LockButtonTDAH label="Ver Perfil Completo" />
          <LockButtonTDAH label="Novo Protocolo" />
          <LockButtonTDAH label="Gerar Relatório" />
        </div>
      </div>
    </>
  )
}
