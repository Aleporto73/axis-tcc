'use client'

import { useState } from 'react'
import { DemoNav, LockButton } from '../_components'
import { LEARNERS, CSO_HISTORY, type MockCSOPoint } from '../_mock'

const bandColors: Record<string, string> = {
  critico: '#ef4444', alerta: '#f59e0b', moderado: '#3b82f6', bom: '#22c55e', excelente: '#10b981',
}

function getBand(c: number) {
  if (c < 40) return 'critico'
  if (c < 55) return 'alerta'
  if (c < 70) return 'moderado'
  if (c < 85) return 'bom'
  return 'excelente'
}

function getBandLabel(c: number) {
  if (c < 40) return 'Crítico'
  if (c < 55) return 'Alerta'
  if (c < 70) return 'Moderado'
  if (c < 85) return 'Bom'
  return 'Excelente'
}

function MiniChart({ data }: { data: MockCSOPoint[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-32 text-xs text-slate-300">Sem dados</div>
  const width = 600, height = 180
  const pad = { t: 10, r: 10, b: 25, l: 35 }
  const cW = width - pad.l - pad.r, cH = height - pad.t - pad.b
  const pts = data.map((d, i) => ({
    x: pad.l + (data.length === 1 ? cW / 2 : (i / (data.length - 1)) * cW),
    y: pad.t + cH - (d.cso_aba / 100) * cH,
    cso: d.cso_aba,
    date: d.session_date,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = line + ` L ${pts[pts.length - 1].x} ${pad.t + cH} L ${pts[0].x} ${pad.t + cH} Z`
  const zones = [
    { y2: 40, c: '#fef2f2' }, { y2: 55, c: '#fffbeb' }, { y2: 70, c: '#eff6ff' },
    { y2: 85, c: '#f0fdf4' }, { y2: 100, c: '#ecfdf5' },
  ]
  let prev = 0

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {zones.map((z, i) => {
        const top = pad.t + cH - (z.y2 / 100) * cH
        const h = ((z.y2 - prev) / 100) * cH
        prev = z.y2
        return <rect key={i} x={pad.l} y={top} width={cW} height={h} fill={z.c} />
      })}
      {[0, 25, 50, 75, 100].map(v => {
        const y = pad.t + cH - (v / 100) * cH
        return (
          <g key={v}>
            <line x1={pad.l} y1={y} x2={pad.l + cW} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={pad.l - 5} y={y + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{v}</text>
          </g>
        )
      })}
      <path d={area} fill="#e07a2f" opacity={0.15} />
      <path d={line} fill="none" stroke="#e07a2f" strokeWidth={2} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="white" stroke={bandColors[getBand(p.cso)]} strokeWidth={2} />
          {data.length <= 10 && (
            <text x={p.x} y={pad.t + cH + 15} textAnchor="middle" fontSize={8} fill="#94a3b8">
              {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

export default function DemoDashboardPage() {
  const [sel, setSel] = useState(LEARNERS[0].id)
  const learner = LEARNERS.find(l => l.id === sel) || LEARNERS[0]
  const cso = CSO_HISTORY[sel] || []
  const last = cso.length > 0 ? cso[cso.length - 1] : null
  const prev = cso.length > 1 ? cso[cso.length - 2] : null
  const delta = last && prev ? last.cso_aba - prev.cso_aba : 0

  return (
    <>
      <DemoNav active="dashboard" />

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-lg font-normal text-slate-400">Dashboard Clínico</h1>
            <p className="text-xs text-slate-300">Progresso terapêutico · Dados demonstrativos</p>
          </div>
          <select
            value={sel}
            onChange={e => setSel(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
          >
            {LEARNERS.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Chart + Dimensions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2 p-5 rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-medium text-slate-800">Evolução CSO-ABA</h2>
                <p className="text-[11px] text-slate-400">Motor v2.6.1 · {cso.length} pontos</p>
              </div>
              {last && (
                <div className="text-right">
                  <p className="text-2xl font-medium" style={{ color: bandColors[getBand(last.cso_aba)] }}>
                    {last.cso_aba}
                  </p>
                  <p className="text-[10px]" style={{ color: bandColors[getBand(last.cso_aba)] }}>
                    {getBandLabel(last.cso_aba)}
                    {delta !== 0 && (
                      <span className={delta > 0 ? 'text-green-500' : 'text-red-500'}>
                        {' '}({delta > 0 ? '+' : ''}{delta.toFixed(1)})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
            <MiniChart data={cso} />
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-white">
            <h3 className="text-xs font-medium text-slate-600 mb-3">Dimensões</h3>
            {last ? (
              <div className="space-y-2">
                {[
                  { l: 'SAS', v: last.sas, d: 'Aquisição' },
                  { l: 'PIS', v: last.pis, d: 'Implementação' },
                  { l: 'BSS', v: last.bss, d: 'Comportamento' },
                  { l: 'TCM', v: last.tcm, d: 'Tratamento' },
                ].map(x => (
                  <div key={x.l}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[11px] text-slate-500">{x.l} <span className="text-slate-300">({x.d})</span></span>
                      <span className="text-xs font-medium text-slate-700">{x.v}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${x.v}%`, backgroundColor: bandColors[getBand(x.v)] }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-300">Sem dados</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
            <p className="text-2xl font-medium text-blue-600">{learner.protocols_active}</p>
            <p className="text-[11px] text-slate-500">Protocolos ativos</p>
          </div>
          <div className="p-4 rounded-xl bg-green-50/50 border border-green-100">
            <p className="text-2xl font-medium text-green-600">{learner.protocols_mastered}</p>
            <p className="text-[11px] text-slate-500">Dominados</p>
          </div>
          <div className="p-4 rounded-xl bg-aba-500/5 border border-aba-500/20">
            <p className="text-2xl font-medium text-aba-500">{learner.total_sessions}</p>
            <p className="text-[11px] text-slate-500">Sessões concluídas</p>
          </div>
          <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100">
            <p className="text-2xl font-medium text-purple-600">3</p>
            <p className="text-[11px] text-slate-500">Agendadas</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap mb-6">
          <LockButton label="Novo Protocolo" />
          <LockButton label="Nova Sessão" />
          <LockButton label="Gerar Relatório" />
        </div>

        {/* Band legend */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <h3 className="text-xs font-medium text-slate-600 mb-3">Bandas CSO-ABA</h3>
          <div className="flex gap-3 flex-wrap">
            {[
              { l: 'Crítico', r: '0–39', c: '#ef4444' },
              { l: 'Alerta', r: '40–54', c: '#f59e0b' },
              { l: 'Moderado', r: '55–69', c: '#3b82f6' },
              { l: 'Bom', r: '70–84', c: '#22c55e' },
              { l: 'Excelente', r: '85–100', c: '#10b981' },
            ].map(b => (
              <div key={b.l} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: b.c }} />
                <span className="text-[11px] text-slate-500">{b.l} ({b.r})</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-slate-300 text-center mt-8 mb-4">AXIS ABA · Motor CSO-ABA v2.6.1 · Dados demonstrativos</p>
      </div>
    </>
  )
}
