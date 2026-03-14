'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DemoNavTDAH, LockButtonTDAH, AuDHDBadge } from '../_components-tdah'
import {
  PATIENTS, CSO_HISTORY_TDAH, PROTOCOLS_TDAH, DRCS_TDAH,
  bandColorsTDAH, getBandTDAH, getBandLabelTDAH,
  type MockPatientTDAH, type MockCSOPointTDAH,
} from '../_mock-tdah'

/* ═══════ Band helpers ═══════ */

/* ═══════ Evolution Chart ═══════ */
function EvolutionChart({ data }: { data: MockCSOPointTDAH[] }) {
  const W = 520, H = 160
  const pad = { t: 12, r: 12, b: 28, l: 38 }
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b

  const pts = data.map((d, i) => ({
    x: pad.l + (data.length === 1 ? cW / 2 : (i / (data.length - 1)) * cW),
    y: pad.t + cH - (d.final_score / 100) * cH,
    v: d.final_score,
    date: d.session_date,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = line + ` L ${pts[pts.length - 1].x} ${pad.t + cH} L ${pts[0].x} ${pad.t + cH} Z`

  // core dashed
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {zones.map((z, i) => {
        const top = pad.t + cH - (z.y2 / 100) * cH
        const h = ((z.y2 - prev) / 100) * cH; prev = z.y2
        return <rect key={i} x={pad.l} y={top} width={cW} height={h} fill={z.c} />
      })}
      {[0, 25, 50, 75, 100].map(v => {
        const y = pad.t + cH - (v / 100) * cH
        return (
          <g key={v}>
            <line x1={pad.l} y1={y} x2={pad.l + cW} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={pad.l - 5} y={y + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{v}</text>
          </g>
        )
      })}
      <path d={coreLine} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5} />
      <path d={area} fill="#0d7377" opacity={0.12} />
      <path d={line} fill="none" stroke="#0d7377" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="white" stroke={bandColorsTDAH[getBandTDAH(p.v)]} strokeWidth={2} />
          <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize={8} fill="#475569" fontWeight="600">{p.v}</text>
          <text x={p.x} y={pad.t + cH + 14} textAnchor="middle" fontSize={7} fill="#94a3b8">
            {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </text>
        </g>
      ))}
    </svg>
  )
}

/* ═══════ Dimension mini-chart ═══════ */
function DimChart({ data, accessor, color }: { data: MockCSOPointTDAH[]; accessor: (d: MockCSOPointTDAH) => number | null; color: string }) {
  const W = 120, H = 36, P = 6
  const vals = data.map(d => accessor(d) ?? 0)
  const min = Math.max(0, Math.min(...vals) - 10)
  const max = Math.min(100, Math.max(...vals) + 10)
  const pts = data.map((_, i) => {
    const x = P + (data.length === 1 ? (W - P * 2) / 2 : (i / (data.length - 1)) * (W - P * 2))
    const y = H - P - ((vals[i] - min) / (max - min || 1)) * (H - P * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((_, i) => {
        const x = P + (data.length === 1 ? (W - P * 2) / 2 : (i / (data.length - 1)) * (W - P * 2))
        const y = H - P - ((vals[i] - min) / (max - min || 1)) * (H - P * 2)
        return <circle key={i} cx={x} cy={y} r={2} fill={color} />
      })}
    </svg>
  )
}

/* ═══════ Report Modal ═══════ */
function ReportModal({ patient, cso, onClose }: { patient: MockPatientTDAH; cso: MockCSOPointTDAH[]; onClose: () => void }) {
  const last = cso[cso.length - 1]
  const first = cso[0]
  const delta = last.final_score - first.final_score
  const protocols = PROTOCOLS_TDAH[patient.id] || []
  const drcs = DRCS_TDAH.filter(d => d.patient_id === patient.id)
  const drcSuccess = drcs.filter(d => d.goal_met === 'yes').length
  const drcTotal = drcs.length

  type DimDef = { key: string; label: string; color: string; accessor: (d: MockCSOPointTDAH) => number | null }
  const dims: DimDef[] = [
    { key: 'sas', label: 'Atenção Sustentada', color: '#0d7377', accessor: d => d.sas },
    { key: 'pis', label: 'Independência de Prompts', color: '#6366f1', accessor: d => d.pis },
    { key: 'bss', label: 'Estabilidade Comportamental', color: '#10b981', accessor: d => d.bss },
    { key: 'exr', label: 'Função Executiva', color: '#f59e0b', accessor: d => d.exr },
    ...(last.sen !== null ? [{ key: 'sen', label: 'Sensorialidade (AuDHD)', color: '#7c3aed', accessor: (d: MockCSOPointTDAH) => d.sen }] : []),
    ...(last.trf !== null ? [{ key: 'trf', label: 'Transição Funcional (AuDHD)', color: '#a855f7', accessor: (d: MockCSOPointTDAH) => d.trf }] : []),
  ]

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    active: { label: 'Ativo', bg: 'bg-blue-50', text: 'text-blue-600' },
    mastered: { label: 'Dominado', bg: 'bg-green-50', text: 'text-green-600' },
    maintenance: { label: 'Manutenção', bg: 'bg-purple-50', text: 'text-purple-600' },
    regression: { label: 'Regressão', bg: 'bg-red-50', text: 'text-red-600' },
  }

  // Generate clinical narrative based on trajectory
  const narratives = getNarratives(patient, first, last, delta, protocols)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl">

        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8 sm:p-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: '#0d7377' }}>
                  <span className="text-white text-xs font-bold">AX</span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#0d7377' }}>AXIS TDAH</span>
                <AuDHDBadge layer={patient.audhd_layer} />
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mt-3">Relatório de Evolução Clínica</h1>
              <p className="text-xs text-slate-400 mt-1">Período: 06/01/2026 — 17/02/2026 · 7 snapshots · Tricontextual</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Emitido em</p>
              <p className="text-sm text-slate-600">14/03/2026</p>
              <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider">Documento</p>
              <p className="text-[10px] font-mono text-slate-500">DEMO-TDAH-2026-0001</p>
            </div>
          </div>

          {/* Patient info */}
          <div className="bg-slate-50 rounded-xl p-5 mb-8">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Dados do Paciente</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><p className="text-[10px] text-slate-400">Nome</p><p className="text-sm font-medium text-slate-800">{patient.name}</p></div>
              <div><p className="text-[10px] text-slate-400">Idade</p><p className="text-sm font-medium text-slate-800">{patient.age}</p></div>
              <div><p className="text-[10px] text-slate-400">Diagnóstico</p><p className="text-sm font-medium text-slate-800">{patient.diagnosis}</p></div>
              <div><p className="text-[10px] text-slate-400">CID</p><p className="text-sm font-medium text-slate-800">{patient.cid_code}</p></div>
              <div><p className="text-[10px] text-slate-400">Escola</p><p className="text-sm font-medium text-slate-800">{patient.school} ({patient.grade})</p></div>
              <div><p className="text-[10px] text-slate-400">Professora</p><p className="text-sm font-medium text-slate-800">{patient.teacher_name}</p></div>
              <div><p className="text-[10px] text-slate-400">Responsável</p><p className="text-sm font-medium text-slate-800">{patient.guardian_name} ({patient.guardian_relationship})</p></div>
              <div><p className="text-[10px] text-slate-400">Layer AuDHD</p><p className="text-sm font-medium text-slate-800">{patient.audhd_layer === 'off' ? 'Inativa' : patient.audhd_layer === 'active_core' ? 'Core' : 'Completa'}</p></div>
            </div>
          </div>

          {/* CSO Score highlight */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-xl border-2 text-center" style={{ borderColor: bandColorsTDAH[getBandTDAH(last.final_score)] + '40' }}>
              <p className="text-3xl font-semibold" style={{ color: bandColorsTDAH[getBandTDAH(last.final_score)] }}>{last.final_score}</p>
              <p className="text-xs font-medium mt-1" style={{ color: bandColorsTDAH[getBandTDAH(last.final_score)] }}>{getBandLabelTDAH(last.final_score)}</p>
              <p className="text-[10px] text-slate-400 mt-1">CSO-TDAH Atual</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 text-center">
              <p className="text-3xl font-semibold text-slate-700">{first.final_score}</p>
              <p className="text-xs text-slate-400 mt-1">CSO-TDAH Inicial</p>
              <p className="text-[10px] text-slate-300 mt-1">Linha de base</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 text-center">
              <p className={`text-3xl font-semibold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-slate-600'}`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Variação</p>
              <p className="text-[10px] text-slate-300 mt-1">{cso.length} snapshots</p>
            </div>
          </div>

          {/* Evolution chart */}
          <div className="mb-8">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Evolução CSO-TDAH</h2>
            <div className="bg-slate-50 rounded-xl p-4">
              <EvolutionChart data={cso} />
              <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#0d7377] inline-block" /> Final Score</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-slate-400 inline-block" style={{ borderBottom: '1px dashed' }} /> Core Score</span>
              </div>
            </div>
          </div>

          {/* Dimensions table */}
          <div className="mb-8">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Dimensões do Motor CSO-TDAH</h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Dimensão</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Inicial</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Atual</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Δ</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Tendência</th>
                  </tr>
                </thead>
                <tbody>
                  {dims.map(dim => {
                    const initial = dim.accessor(first) ?? 0
                    const current = dim.accessor(last) ?? 0
                    const diff = current - initial
                    return (
                      <tr key={dim.key} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dim.color }} />
                            <div>
                              <p className="text-xs font-medium text-slate-700 uppercase">{dim.key}</p>
                              <p className="text-[10px] text-slate-400">{dim.label}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-500">{initial}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-semibold" style={{ color: bandColorsTDAH[getBandTDAH(current)] }}>{current}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="w-24 mx-auto">
                            <DimChart data={cso} accessor={dim.accessor} color={dim.color} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Protocols */}
          <div className="mb-8">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Protocolos Terapêuticos</h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Protocolo</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Bloco</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Status</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {protocols.map((p, i) => {
                    const sc = statusConfig[p.status] || statusConfig.active
                    return (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-slate-700">{p.code}</p>
                            {p.is_audhd && <span className="text-[9px] text-purple-500 font-medium">AuDHD</span>}
                          </div>
                          <p className="text-[10px] text-slate-400">{p.title}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-500 hidden sm:table-cell">{p.block}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text}`}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-600">{p.observations}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DRC Summary (if available) */}
          {drcs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Daily Report Card (DRC)</h2>
              <div className="bg-blue-50/50 rounded-xl p-5">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-blue-600">{drcTotal}</p>
                    <p className="text-[10px] text-slate-500">Registros</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-green-600">{drcSuccess}</p>
                    <p className="text-[10px] text-slate-500">Metas atingidas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-amber-600">{drcTotal > 0 ? Math.round((drcSuccess / drcTotal) * 100) : 0}%</p>
                    <p className="text-[10px] text-slate-500">Taxa de sucesso</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clinical observations */}
          <div className="mb-8">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Observações Clínicas</h2>
            <div className="bg-slate-50 rounded-xl p-5 space-y-3">
              {narratives.map((n, i) => (
                <div key={i}>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{n.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400">Relatório estruturado · AXIS TDAH</p>
                <p className="text-[10px] text-slate-400">Motor CSO-TDAH v1.0.0 · Pesos configuráveis · Imutável · Auditável</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400">AXIS TDAH</p>
                <p className="text-[10px] font-mono text-slate-300">SHA256: a1b2c3d4e5f6...demo</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex items-center justify-between">
              <p className="text-[10px] text-slate-300">Este relatório foi gerado com dados demonstrativos.</p>
              <Link href="/sign-up?produto=tdah" className="text-[11px] font-medium hover:opacity-80 transition-colors" style={{ color: '#0d7377' }}>
                Gerar com dados reais →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════ Narrative generator ═══════ */
function getNarratives(
  patient: MockPatientTDAH,
  first: MockCSOPointTDAH,
  last: MockCSOPointTDAH,
  delta: number,
  protocols: { code: string; title: string; status: string; is_audhd: boolean }[]
) {
  const mastered = protocols.filter(p => p.status === 'mastered')
  const regression = protocols.filter(p => p.status === 'regression')

  if (delta > 10) {
    // Positive evolution (Lucas)
    return [
      { title: 'Evolução Geral', text: `O paciente apresentou evolução expressiva no período, com incremento de ${delta.toFixed(1)} pontos no CSO-TDAH (de ${first.final_score} para ${last.final_score}). A progressão foi sustentada sem regressões, refletindo boa resposta à intervenção tricontextual.` },
      { title: 'Pontos Fortes', text: `Destaque para BSS (Estabilidade Comportamental) como dimensão mais alta. ${mastered.length > 0 ? `Protocolos dominados: ${mastered.map(p => p.code).join(', ')}.` : ''} ${patient.audhd_layer !== 'off' ? `A Layer AuDHD ${patient.audhd_layer === 'active_core' ? 'Core' : 'Completa'} mostra ganhos consistentes em SEN e TRF.` : ''}` },
      { title: 'Recomendações', text: 'Manter frequência atual de sessões tricontextuais. Considerar avanço para protocolos de generalização nos domínios já dominados. Monitorar função executiva como área de maior potencial de crescimento.' },
    ]
  } else if (delta < -5) {
    // Regression (Sofia)
    return [
      { title: 'Evolução Geral', text: `O paciente apresentou regressão de ${Math.abs(delta).toFixed(1)} pontos no CSO-TDAH (de ${first.final_score} para ${last.final_score}) no período avaliado. A queda está associada à mudança de ambiente escolar ocorrida em janeiro.` },
      { title: 'Áreas de Atenção', text: `Atenção sustentada (SAS) e função executiva (EXR) apresentaram as maiores quedas. ${regression.length > 0 ? `Protocolo em regressão: ${regression[0].title}.` : ''} O DRC escolar confirma dificuldade em adaptar-se ao novo ambiente — recomenda-se revisão do plano com a nova professora.` },
      { title: 'Recomendações', text: 'Intensificar sessões em contexto escolar (2×/semana). Revisar critérios do DRC com a nova professora. Considerar adaptação do protocolo de organização de materiais. Reavaliar em 30 dias para verificar estabilização.' },
    ]
  } else {
    // Stabilization (Pedro)
    return [
      { title: 'Evolução Geral', text: `O paciente atingiu um platô funcional com variação de apenas ${Math.abs(delta).toFixed(1)} pontos no CSO-TDAH (${first.final_score} → ${last.final_score}). Esse padrão indica consolidação das habilidades adquiridas e estabilidade do repertório.` },
      { title: 'Pontos Fortes', text: `${mastered.length} protocolos dominados no período. Economia de fichas no domicílio funcionando de forma autônoma. Rotina matinal consolidada há 6 semanas sem necessidade de lembrete externo.` },
      { title: 'Recomendações', text: 'Reduzir gradualmente reforçadores externos (economia de fichas). Focar na generalização das habilidades domiciliares para o contexto escolar. Considerar espaçar sessões clínicas para quinzenal e manter domiciliares semanais.' },
    ]
  }
}

/* ═══════ Report type definitions ═══════ */
const REPORT_TYPES = [
  {
    key: 'evolucao', title: 'Relatório de Evolução', preview: true,
    desc: 'Progresso terapêutico com gráficos CSO-TDAH, dimensões, protocolos e DRC.',
    icon: <svg className="w-5 h-5" style={{ color: '#0d7377' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  },
  {
    key: 'drc', title: 'Relatório DRC Escolar', preview: false,
    desc: 'Consolidado do Daily Report Card com dados da professora e taxa de sucesso.',
    icon: <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" /></svg>,
  },
  {
    key: 'snapshot', title: 'Snapshot CSO-TDAH', preview: false,
    desc: 'Registro imutável do estado clínico com hash SHA256.',
    icon: <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
  },
  {
    key: 'auditoria', title: 'Log de Auditoria', preview: false,
    desc: 'Registro completo de ações clínicas para governança.',
    icon: <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
]

/* ═══════ Ana TDAH Chat ═══════ */
const chatBrand = '#0d7377'
const chatBrandLight = '#E0F2F1'

interface DemoChatStep { type: 'user' | 'typing' | 'ana'; content: string; delay: number }

const chatScript: DemoChatStep[] = [
  { type: 'user', content: 'O que é o CSO-TDAH?', delay: 600 },
  { type: 'typing', content: '', delay: 1200 },
  { type: 'ana', content: 'O CSO-TDAH é um indicador de 0 a 100 que combina 3 blocos: Base (atenção, prompts, comportamento), Executivo (função executiva) e, se ativada, a Layer AuDHD (sensorialidade e transição). O motor é determinístico e gera snapshots imutáveis a cada sessão fechada.', delay: 800 },
  { type: 'user', content: 'Como funciona o DRC escolar?', delay: 1400 },
  { type: 'typing', content: '', delay: 1200 },
  { type: 'ana', content: 'O Daily Report Card permite que a professora registre até 3 metas por dia diretamente no portal da escola (via token de acesso). O clínico pode revisar cada registro, e os dados alimentam o relatório de evolução e o dashboard tricontextual.', delay: 0 },
]

function DemoAnaChatTDAH() {
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showTyping, setShowTyping] = useState(false)

  const reset = useCallback(() => { setVisibleSteps(0); setShowTyping(false); setIsPlaying(true) }, [])

  useEffect(() => {
    if (!isPlaying) return
    if (visibleSteps >= chatScript.length) { setShowTyping(false); setIsPlaying(false); return }
    const step = chatScript[visibleSteps]
    const timer = setTimeout(() => {
      if (step.type === 'typing') setShowTyping(true); else setShowTyping(false)
      setVisibleSteps(prev => prev + 1)
    }, step.delay)
    return () => clearTimeout(timer)
  }, [visibleSteps, isPlaying])

  const messages = chatScript.slice(0, visibleSteps).filter(s => s.type === 'user' || s.type === 'ana')
  const finished = visibleSteps >= chatScript.length

  return (
    <section className="mt-10 mb-2">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold text-slate-800">Tire dúvidas com a Ana</h2>
        <p className="text-sm text-slate-400 mt-1">Assistente virtual treinada com a base de conhecimento TDAH.</p>
      </div>

      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 p-5 pb-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: chatBrandLight }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={chatBrand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Não encontrou o que procura?</p>
            <p className="text-xs text-slate-400">Pergunte para a Ana — ela conhece todo o sistema TDAH.</p>
          </div>
        </div>

        <div className="px-5 pt-4 space-y-3 min-h-[120px]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-[fadeSlideIn_0.35s_ease-out]`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.type === 'user' ? 'text-white rounded-br-md' : 'bg-slate-100 text-slate-700 rounded-bl-md'
                }`}
                style={msg.type === 'user' ? { backgroundColor: chatBrand } : undefined}
              >
                {msg.type === 'ana' && <span className="block text-xs font-semibold mb-1" style={{ color: chatBrand }}>Ana</span>}
                {msg.content}
              </div>
            </div>
          ))}
          {showTyping && (
            <div className="flex justify-start animate-[fadeSlideIn_0.25s_ease-out]">
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                <span className="block text-xs font-semibold mb-1" style={{ color: chatBrand }}>Ana</span>
                <span className="flex items-center gap-1 text-sm text-slate-400">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="ml-2">Ana está digitando...</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {finished && (
          <div className="px-5 pt-2 flex justify-center">
            <button onClick={reset} className="text-xs font-medium transition-colors hover:opacity-80" style={{ color: chatBrand }}>↻ Ver novamente</button>
          </div>
        )}

        <div className="p-5 pt-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-400 select-none">
              Qual sua dificuldade? Me conta...
            </div>
            <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white opacity-40" style={{ backgroundColor: chatBrand }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">Na versão completa, a Ana responde qualquer dúvida sobre TDAH, DRC e protocolos.</p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}

/* ═══════ Main page ═══════ */
export default function DemoTDAHRelatoriosPage() {
  const [showReport, setShowReport] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(PATIENTS[0].id)
  const patient = PATIENTS.find(p => p.id === selectedPatient) || PATIENTS[0]
  const cso = CSO_HISTORY_TDAH[selectedPatient] || []

  return (
    <>
      <DemoNavTDAH active="relatorios" />

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6">
          <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Relatórios</h1>
          <p className="text-xs text-slate-300 font-light">Geração de relatórios clínicos · Dados demonstrativos</p>
        </header>

        {/* Patient selector */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Selecione o paciente</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PATIENTS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPatient(p.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedPatient === p.id
                    ? 'border-[#0d7377] bg-[#0d7377]/5 shadow-sm'
                    : 'border-slate-200 hover:border-[#0d7377]/30'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-[#0d7377]/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-[#0d7377]">{p.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <AuDHDBadge layer={p.audhd_layer} />
                  </div>
                  <p className="text-[11px] text-slate-400">{p.age} · CSO {p.cso_tdah}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Report types */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Tipos de relatório disponíveis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REPORT_TYPES.map(r => (
              <button
                key={r.key}
                onClick={() => { if (r.preview) setShowReport(true) }}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                  r.preview
                    ? 'border-slate-200 hover:border-[#0d7377]/40 hover:shadow-sm cursor-pointer group'
                    : 'border-slate-200 bg-slate-50/50 cursor-default'
                }`}
              >
                <div className="mt-0.5 shrink-0">{r.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${r.preview ? 'text-slate-700 group-hover:text-[#0d7377]' : 'text-slate-500'}`}>{r.title}</p>
                    {r.preview && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#0d7377]/10 text-[#0d7377] uppercase">Preview</span>}
                    {!r.preview && (
                      <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{r.desc}</p>
                  {r.preview && <p className="text-[10px] text-[#0d7377] mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">Clique para visualizar →</p>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <LockButtonTDAH label="Exportar PDF" />
          <LockButtonTDAH label="Exportar Dados" />
          <LockButtonTDAH label="Enviar por E-mail" />
        </div>

        {/* Ana chat */}
        <DemoAnaChatTDAH />

        <p className="text-[10px] text-slate-300 text-center mt-8 mb-4">
          Na versão completa, relatórios são gerados em PDF com dados reais do paciente.
        </p>
      </div>

      {showReport && (
        <ReportModal
          patient={patient}
          cso={cso}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  )
}
