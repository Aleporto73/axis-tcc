'use client'

import { useState } from 'react'
import { DemoNavTDAH, LockButtonTDAH, ContextBadge, AuDHDBadge } from '../_components-tdah'
import {
  PATIENTS,
  CSO_HISTORY_TDAH,
  DRCS_TDAH,
  bandColorsTDAH,
  getBandTDAH,
  getBandLabelTDAH,
  type MockCSOPointTDAH,
} from '../_mock-tdah'

/* ─── Mini chart ─── */
function MiniChart({ data }: { data: MockCSOPointTDAH[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-32 text-xs text-slate-300">Sem dados</div>
  const width = 600, height = 180
  const pad = { t: 10, r: 10, b: 25, l: 35 }
  const cW = width - pad.l - pad.r, cH = height - pad.t - pad.b
  const pts = data.map((d, i) => ({
    x: pad.l + (data.length === 1 ? cW / 2 : (i / (data.length - 1)) * cW),
    y: pad.t + cH - (d.final_score / 100) * cH,
    score: d.final_score,
    date: d.session_date,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = line + ` L ${pts[pts.length - 1].x} ${pad.t + cH} L ${pts[0].x} ${pad.t + cH} Z`

  // core_score dashed line
  const corePts = data.map((d, i) => ({
    x: pad.l + (data.length === 1 ? cW / 2 : (i / (data.length - 1)) * cW),
    y: pad.t + cH - (d.core_score / 100) * cH,
  }))
  const coreLine = corePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const zones = [
    { y2: 40, c: '#fef2f2' }, { y2: 55, c: '#fffbeb' }, { y2: 70, c: '#f0fdf4' }, { y2: 100, c: '#ecfdf5' },
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
      {/* Core line (dashed) */}
      <path d={coreLine} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5} />
      {/* Final score area + line */}
      <path d={area} fill="#0d7377" opacity={0.12} />
      <path d={line} fill="none" stroke="#0d7377" strokeWidth={2} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="white" stroke={bandColorsTDAH[getBandTDAH(p.score)]} strokeWidth={2} />
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

export default function DemoTDAHDashboardPage() {
  const [sel, setSel] = useState(PATIENTS[0].id)
  const patient = PATIENTS.find(p => p.id === sel) || PATIENTS[0]
  const cso = CSO_HISTORY_TDAH[sel] || []
  const last = cso.length > 0 ? cso[cso.length - 1] : null
  const prev = cso.length > 1 ? cso[cso.length - 2] : null
  const delta = last && prev ? last.final_score - prev.final_score : 0

  const audhd_active = PATIENTS.filter(p => p.audhd_layer !== 'off').length
  const today_sessions = 5
  const month_sessions = 24
  const drc_pending = DRCS_TDAH.filter(d => !d.reviewed).length

  return (
    <>
      <DemoNavTDAH active="dashboard" />

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-lg font-normal text-slate-400">Dashboard TDAH</h1>
            <p className="text-xs text-slate-300">Visão tricontextual · Dados demonstrativos</p>
          </div>
          <select
            value={sel}
            onChange={e => setSel(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
          >
            {PATIENTS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* KPIs row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-[#0d7377]/5 border border-[#0d7377]/20">
            <p className="text-2xl font-medium text-[#0d7377]">{PATIENTS.length}</p>
            <p className="text-[11px] text-slate-500">Pacientes</p>
          </div>
          <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100">
            <p className="text-2xl font-medium text-purple-600">{audhd_active}</p>
            <p className="text-[11px] text-slate-500">AuDHD ativa</p>
          </div>
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
            <p className="text-2xl font-medium text-blue-600">{today_sessions}</p>
            <p className="text-[11px] text-slate-500">Sessões hoje</p>
          </div>
          <div className="p-4 rounded-xl bg-green-50/50 border border-green-100">
            <p className="text-2xl font-medium text-green-600">{month_sessions}</p>
            <p className="text-[11px] text-slate-500">Sessões/mês</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
            <p className="text-2xl font-medium text-amber-600">{drc_pending}</p>
            <p className="text-[11px] text-slate-500">DRC pendentes</p>
          </div>
        </div>

        {/* Context distribution */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Clínico', count: patient.sessions_clinical, color: '#0d7377' },
            { label: 'Domiciliar', count: patient.sessions_home, color: '#7c3aed' },
            { label: 'Escolar', count: patient.sessions_school, color: '#2563eb' },
          ].map(c => {
            const pct = patient.total_sessions > 0 ? Math.round((c.count / patient.total_sessions) * 100) : 0
            return (
              <div key={c.label} className="p-3 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">{c.label}</span>
                  <span className="text-xs font-medium" style={{ color: c.color }}>{c.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{pct}%</p>
              </div>
            )
          })}
        </div>

        {/* Chart + Dimensions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2 p-5 rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-medium text-slate-800">Evolução CSO-TDAH</h2>
                <p className="text-[11px] text-slate-400">
                  Motor v1.0.0 · {cso.length} pontos
                  {patient.audhd_layer !== 'off' && <span className="text-purple-500 ml-1">· AuDHD {patient.audhd_layer === 'active_core' ? 'Core' : 'Full'}</span>}
                </p>
              </div>
              {last && (
                <div className="text-right">
                  <p className="text-2xl font-medium" style={{ color: bandColorsTDAH[getBandTDAH(last.final_score)] }}>
                    {last.final_score}
                  </p>
                  <p className="text-[10px]" style={{ color: bandColorsTDAH[getBandTDAH(last.final_score)] }}>
                    {getBandLabelTDAH(last.final_score)}
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
            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-4 h-0.5 bg-[#0d7377] inline-block" /> Final Score
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-0.5 bg-slate-400 inline-block" style={{ borderBottom: '1px dashed' }} /> Core Score
              </span>
            </div>
          </div>

          {/* Dimensions */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white">
            <h3 className="text-xs font-medium text-slate-600 mb-3">Blocos · Último Snapshot</h3>
            {last ? (
              <div className="space-y-2">
                {[
                  { l: 'SAS', v: last.sas, d: 'Atenção Sustentada' },
                  { l: 'PIS', v: last.pis, d: 'Independência Prompt' },
                  { l: 'BSS', v: last.bss, d: 'Estabilidade Comportamental' },
                  { l: 'EXR', v: last.exr, d: 'Função Executiva' },
                  ...(last.sen !== null ? [{ l: 'SEN', v: last.sen!, d: 'Sensorialidade (AuDHD)' }] : []),
                  ...(last.trf !== null ? [{ l: 'TRF', v: last.trf!, d: 'Transição Funcional (AuDHD)' }] : []),
                ].map(x => (
                  <div key={x.l}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[11px] text-slate-500">
                        {x.l} <span className="text-slate-300">({x.d})</span>
                      </span>
                      <span className="text-xs font-medium text-slate-700">{x.v}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${x.v}%`, backgroundColor: bandColorsTDAH[getBandTDAH(x.v)] }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-300">Sem dados</p>
            )}
          </div>
        </div>

        {/* Patient info strip */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0d7377]/10 flex items-center justify-center">
                <span className="text-sm font-medium text-[#0d7377]">{patient.name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{patient.name}</p>
                <p className="text-[10px] text-slate-400">{patient.age} · {patient.cid_code} · {patient.school}</p>
              </div>
            </div>
            <div className="flex gap-1.5 ml-auto">
              <AuDHDBadge layer={patient.audhd_layer} />
              <span className="text-[10px] text-slate-400">{patient.protocols_active} ativos · {patient.protocols_mastered} dominados</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap mb-6">
          <LockButtonTDAH label="Novo Paciente" />
          <LockButtonTDAH label="Nova Sessão" />
          <LockButtonTDAH label="Novo Protocolo" />
          <LockButtonTDAH label="Gerar Relatório" />
        </div>

        {/* Band legend */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <h3 className="text-xs font-medium text-slate-600 mb-3">Bandas CSO-TDAH</h3>
          <div className="flex gap-3 flex-wrap">
            {[
              { l: 'Crítico', r: '0–39', c: '#ef4444' },
              { l: 'Atenção', r: '40–54', c: '#f59e0b' },
              { l: 'Bom', r: '55–69', c: '#22c55e' },
              { l: 'Excelente', r: '70–100', c: '#10b981' },
            ].map(b => (
              <div key={b.l} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: b.c }} />
                <span className="text-[11px] text-slate-500">{b.l} ({b.r})</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-slate-300 text-center mt-8 mb-4">AXIS TDAH · Motor CSO-TDAH v1.0.0 · Dados demonstrativos</p>
      </div>
    </>
  )
}
