'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DemoNav, LockButton } from '../_components'
import { LEARNERS, CSO_HISTORY, type MockLearner, type MockCSOPoint } from '../_mock'

// =====================================================
// Band helpers
// =====================================================
const bandColors: Record<string, string> = {
  critico: '#ef4444', alerta: '#f59e0b', moderado: '#3b82f6', bom: '#22c55e', excelente: '#10b981',
}
function getBand(c: number) {
  if (c < 40) return 'critico'; if (c < 55) return 'alerta'; if (c < 70) return 'moderado'; if (c < 85) return 'bom'; return 'excelente'
}
function getBandLabel(c: number) {
  if (c < 40) return 'Crítico'; if (c < 55) return 'Alerta'; if (c < 70) return 'Moderado'; if (c < 85) return 'Bom'; return 'Excelente'
}

// =====================================================
// Mock protocols for Davi
// =====================================================
const MOCK_PROTOCOLS = [
  { name: 'Mando com suporte visual', domain: 'Comunicação', status: 'active', trials: 48, accuracy: 72, criteria: '80% em 3 sessões consecutivas' },
  { name: 'Tato de objetos funcionais', domain: 'Comunicação', status: 'active', trials: 36, accuracy: 68, criteria: '80% em 3 sessões consecutivas' },
  { name: 'Imitação motora grossa', domain: 'Motor', status: 'mastered', trials: 60, accuracy: 92, criteria: 'Atingido em 12/02/2026' },
  { name: 'Seguir instruções 1 passo', domain: 'Comportamento', status: 'active', trials: 42, accuracy: 65, criteria: '80% em 3 sessões consecutivas' },
  { name: 'Contato visual funcional', domain: 'Habilidades Sociais', status: 'mastered', trials: 54, accuracy: 88, criteria: 'Atingido em 28/01/2026' },
  { name: 'Emparelhamento idêntico', domain: 'Cognitivo', status: 'active', trials: 30, accuracy: 58, criteria: '80% em 3 sessões consecutivas' },
]

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Ativo', bg: 'bg-blue-50', text: 'text-blue-600' },
  mastered: { label: 'Dominado', bg: 'bg-green-50', text: 'text-green-600' },
  maintenance: { label: 'Manutenção', bg: 'bg-purple-50', text: 'text-purple-600' },
}

// =====================================================
// Evolution chart (SVG)
// =====================================================
function EvolutionChart({ data }: { data: MockCSOPoint[] }) {
  const W = 520, H = 160
  const pad = { t: 12, r: 12, b: 28, l: 38 }
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b

  const pts = data.map((d, i) => ({
    x: pad.l + (data.length === 1 ? cW / 2 : (i / (data.length - 1)) * cW),
    y: pad.t + cH - (d.cso_aba / 100) * cH,
    v: d.cso_aba,
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
      <path d={area} fill="#e07a2f" opacity={0.12} />
      <path d={line} fill="none" stroke="#e07a2f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="white" stroke={bandColors[getBand(p.v)]} strokeWidth={2} />
          <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize={8} fill="#475569" fontWeight="600">{p.v}</text>
          <text x={p.x} y={pad.t + cH + 14} textAnchor="middle" fontSize={7} fill="#94a3b8">
            {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </text>
        </g>
      ))}
    </svg>
  )
}

// =====================================================
// Dimension mini-chart
// =====================================================
function DimChart({ data, dim, color }: { data: MockCSOPoint[]; dim: 'sas' | 'pis' | 'bss' | 'tcm'; color: string }) {
  const W = 120, H = 36, P = 6
  const vals = data.map(d => d[dim])
  const min = Math.max(0, Math.min(...vals) - 10)
  const max = Math.min(100, Math.max(...vals) + 10)
  const pts = data.map((_, i) => {
    const x = P + (data.length === 1 ? (W - P * 2) / 2 : (i / (data.length - 1)) * (W - P * 2))
    const y = H - P - ((vals[i] - min) / (max - min)) * (H - P * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((_, i) => {
        const x = P + (data.length === 1 ? (W - P * 2) / 2 : (i / (data.length - 1)) * (W - P * 2))
        const y = H - P - ((vals[i] - min) / (max - min)) * (H - P * 2)
        return <circle key={i} cx={x} cy={y} r={2} fill={color} />
      })}
    </svg>
  )
}

// =====================================================
// Report Modal
// =====================================================
function ReportModal({ learner, cso, onClose }: { learner: MockLearner; cso: MockCSOPoint[]; onClose: () => void }) {
  const last = cso[cso.length - 1]
  const first = cso[0]
  const delta = last.cso_aba - first.cso_aba
  const dimColors: Record<string, string> = { sas: '#e07a2f', pis: '#6366f1', bss: '#10b981', tcm: '#f59e0b' }
  const dimLabels: Record<string, string> = { sas: 'Aquisição de Habilidades', pis: 'Independência de Prompts', bss: 'Estabilidade Comportamental', tcm: 'Consistência Terapêutica' }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl">

        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ===== REPORT CONTENT ===== */}
        <div className="p-8 sm:p-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded bg-aba-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AX</span>
                </div>
                <span className="text-xs font-semibold text-aba-500 uppercase tracking-wider">AXIS ABA</span>
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mt-3">Relatório de Evolução Clínica</h1>
              <p className="text-xs text-slate-400 mt-1">Período: 06/01/2026 — 17/02/2026 · 7 sessões avaliativas</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Emitido em</p>
              <p className="text-sm text-slate-600">26/02/2026</p>
              <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider">Documento</p>
              <p className="text-[10px] font-mono text-slate-500">DEMO-2026-0001</p>
            </div>
          </div>

          {/* Patient info */}
          <div className="bg-slate-50 rounded-xl p-5 mb-8">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Dados do Aprendiz</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-slate-400">Nome</p>
                <p className="text-sm font-medium text-slate-800">{learner.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Idade</p>
                <p className="text-sm font-medium text-slate-800">{learner.age}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Diagnóstico</p>
                <p className="text-sm font-medium text-slate-800">{learner.diagnosis} ({learner.cid_code})</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Nível de Suporte</p>
                <p className="text-sm font-medium text-slate-800">Nível {learner.support_level}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Data de Nascimento</p>
                <p className="text-sm font-medium text-slate-800">{new Date(learner.birth_date).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Escola</p>
                <p className="text-sm font-medium text-slate-800">{learner.school}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Total de Sessões</p>
                <p className="text-sm font-medium text-slate-800">{learner.total_sessions}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Responsável Técnico</p>
                <p className="text-sm font-medium text-slate-800">Dra. Ana Costa (CRP 06/12345)</p>
              </div>
            </div>
          </div>

          {/* CSO Score highlight */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-xl border-2 text-center" style={{ borderColor: bandColors[getBand(last.cso_aba)] + '40' }}>
              <p className="text-3xl font-semibold" style={{ color: bandColors[getBand(last.cso_aba)] }}>{last.cso_aba}</p>
              <p className="text-xs font-medium mt-1" style={{ color: bandColors[getBand(last.cso_aba)] }}>{getBandLabel(last.cso_aba)}</p>
              <p className="text-[10px] text-slate-400 mt-1">CSO-ABA Atual</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 text-center">
              <p className="text-3xl font-semibold text-slate-700">{first.cso_aba}</p>
              <p className="text-xs text-slate-400 mt-1">CSO-ABA Inicial</p>
              <p className="text-[10px] text-slate-300 mt-1">Linha de base</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 text-center">
              <p className={`text-3xl font-semibold ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Variação</p>
              <p className="text-[10px] text-slate-300 mt-1">{cso.length} pontos avaliados</p>
            </div>
          </div>

          {/* Evolution chart */}
          <div className="mb-8">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Evolução CSO-ABA</h2>
            <div className="bg-slate-50 rounded-xl p-4">
              <EvolutionChart data={cso} />
            </div>
          </div>

          {/* Dimensions table */}
          <div className="mb-8">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Dimensões do Motor CSO-ABA</h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Dimensão</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Inicial</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Atual</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Variação</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Tendência</th>
                  </tr>
                </thead>
                <tbody>
                  {(['sas', 'pis', 'bss', 'tcm'] as const).map(dim => {
                    const initial = first[dim]
                    const current = last[dim]
                    const diff = current - initial
                    return (
                      <tr key={dim} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dimColors[dim] }} />
                            <div>
                              <p className="text-xs font-medium text-slate-700 uppercase">{dim}</p>
                              <p className="text-[10px] text-slate-400">{dimLabels[dim]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-500">{initial}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-semibold" style={{ color: bandColors[getBand(current)] }}>{current}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-medium ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="w-24 mx-auto">
                            <DimChart data={cso} dim={dim} color={dimColors[dim]} />
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
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Domínio</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Status</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Tentativas</th>
                    <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-2.5">Acurácia</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_PROTOCOLS.map((p, i) => {
                    const sc = statusConfig[p.status] || statusConfig.active
                    return (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-700">{p.name}</p>
                          <p className="text-[10px] text-slate-400 sm:hidden">{p.domain}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{p.domain}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text}`}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-600">{p.trials}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${p.accuracy}%`, backgroundColor: bandColors[getBand(p.accuracy)] }} />
                            </div>
                            <span className="text-xs font-medium text-slate-600">{p.accuracy}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clinical observations */}
          <div className="mb-8">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Observações Clínicas</h2>
            <div className="bg-slate-50 rounded-xl p-5 space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Evolução Geral</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  O aprendiz apresentou evolução consistente no período avaliado, com incremento de {delta.toFixed(1)} pontos no índice CSO-ABA (de {first.cso_aba} para {last.cso_aba}). A progressão foi linear e sustentada ao longo das 7 sessões avaliativas, sem regressões significativas.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Pontos Fortes</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Destaque para a dimensão BSS (Estabilidade Comportamental), que manteve scores consistentes acima das demais dimensões. O protocolo de imitação motora grossa atingiu critério de domínio, indicando consolidação em habilidades motoras fundamentais.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Áreas de Atenção</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  A dimensão SAS (Aquisição de Habilidades) apresentou o menor score relativo, sugerindo necessidade de ajuste na intensidade de ensino ou nos critérios de prompts. O protocolo de emparelhamento idêntico permanece com acurácia abaixo do esperado (58%), recomendando-se revisão de procedimento.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Recomendações</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Manter frequência atual de sessões (3×/semana). Considerar redução de prompt no protocolo de mando com suporte visual. Iniciar protocolo de generalização para imitação motora grossa (domínio atingido). Reavaliar procedimento de emparelhamento idêntico com análise de erros.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400">Relatório estruturado conforme diretrizes SBNI</p>
                <p className="text-[10px] text-slate-400">Motor CSO-ABA v2.6.1 · Pesos fixos · Imutável · Auditável</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400">AXIS ABA</p>
                <p className="text-[10px] font-mono text-slate-300">SHA256: e3b0c44298fc...demo</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex items-center justify-between">
              <p className="text-[10px] text-slate-300">Este relatório foi gerado com dados demonstrativos.</p>
              <Link href="/sign-up" className="text-[11px] font-medium text-aba-500 hover:text-aba-600 transition-colors">
                Gerar com dados reais →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// Report type definitions
// =====================================================
const REPORT_TYPES = [
  {
    key: 'evolucao',
    title: 'Relatório de Evolução',
    desc: 'Progresso terapêutico com gráficos CSO-ABA, dimensões e protocolos.',
    preview: true,
    icon: (
      <svg className="w-5 h-5 text-aba-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    key: 'convenio',
    title: 'Relatório para Convênio',
    desc: 'Documentação formatada para operadoras de saúde (RN 469/541).',
    preview: false,
    icon: (
      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    key: 'snapshot',
    title: 'Snapshot CSO-ABA',
    desc: 'Registro imutável do estado clínico atual com hash SHA256.',
    preview: false,
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    key: 'auditoria',
    title: 'Log de Auditoria',
    desc: 'Registro completo de ações clínicas para governança institucional.',
    preview: false,
    icon: (
      <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

// =====================================================
// Main page
// =====================================================
export default function DemoRelatoriosPage() {
  const [showReport, setShowReport] = useState(false)
  const [selectedLearner, setSelectedLearner] = useState(LEARNERS[0].id)
  const learner = LEARNERS.find(l => l.id === selectedLearner) || LEARNERS[0]
  const cso = CSO_HISTORY[selectedLearner] || []

  return (
    <>
      <DemoNav active="relatorios" />

      <div className="px-4 md:px-8 lg:px-12 xl:px-16">
        <header className="mb-6">
          <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Relatórios</h1>
          <p className="text-xs text-slate-300 font-light">Geração de relatórios clínicos · Dados demonstrativos</p>
        </header>

        {/* Learner selector */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Selecione o aprendiz</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LEARNERS.map(l => (
              <button
                key={l.id}
                onClick={() => setSelectedLearner(l.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedLearner === l.id
                    ? 'border-aba-500 bg-aba-500/5 shadow-sm'
                    : 'border-slate-200 hover:border-aba-500/30'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-aba-500/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-aba-500">{l.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{l.name}</p>
                  <p className="text-[11px] text-slate-400">{l.age} · CSO {l.cso_aba}</p>
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
                onClick={() => {
                  if (r.preview) setShowReport(true)
                }}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                  r.preview
                    ? 'border-slate-200 hover:border-aba-500/40 hover:shadow-sm cursor-pointer group'
                    : 'border-slate-200 bg-slate-50/50 cursor-default'
                }`}
              >
                <div className="mt-0.5 shrink-0">{r.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${r.preview ? 'text-slate-700 group-hover:text-aba-500' : 'text-slate-500'}`}>{r.title}</p>
                    {r.preview && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-aba-500/10 text-aba-500 uppercase">Preview</span>
                    )}
                    {!r.preview && (
                      <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{r.desc}</p>
                  {r.preview && (
                    <p className="text-[10px] text-aba-500 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      Clique para visualizar →
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <LockButton label="Exportar PDF" />
          <LockButton label="Exportar Dados" />
          <LockButton label="Enviar por E-mail" />
        </div>

        {/* ─── Chat simulado da Ana ─── */}
        <DemoAnaChat />

        <p className="text-[10px] text-slate-300 text-center mt-8 mb-4">
          Na versão completa, relatórios são gerados em PDF com dados reais do aprendiz.
        </p>
      </div>

      {/* Report modal */}
      {showReport && (
        <ReportModal
          learner={learner}
          cso={cso}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  )
}

/* ═══════════════════════ DEMO ANA CHAT ═══════════════════════ */

const chatBrand = '#c46a50'
const chatBrandLight = '#f5ebe7'

interface DemoChatStep {
  type: 'user' | 'typing' | 'ana'
  content: string
  delay: number
}

const chatScript: DemoChatStep[] = [
  { type: 'user', content: 'O que é o CSO-ABA?', delay: 600 },
  { type: 'typing', content: '', delay: 1200 },
  {
    type: 'ana',
    content:
      'O CSO-ABA é um indicador de 0 a 100 que mostra o progresso do aprendiz em 4 dimensões: aquisição de habilidades, independência, estabilidade comportamental e consistência terapêutica.',
    delay: 800,
  },
  { type: 'user', content: 'Como gero um relatório para o convênio?', delay: 1400 },
  { type: 'typing', content: '', delay: 1200 },
  {
    type: 'ana',
    content:
      'Acesse Relatórios na barra lateral, selecione o aprendiz e o período, depois clique em "Relatório para Convênio". O documento já vem com justificativa técnica e estrutura compatível com ANS.',
    delay: 0,
  },
]

function DemoAnaChat() {
  const [visibleSteps, setVisibleSteps] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showTyping, setShowTyping] = useState(false)

  const reset = useCallback(() => {
    setVisibleSteps(0)
    setShowTyping(false)
    setIsPlaying(true)
  }, [])

  useEffect(() => {
    if (!isPlaying) return

    if (visibleSteps >= chatScript.length) {
      setShowTyping(false)
      setIsPlaying(false)
      return
    }

    const step = chatScript[visibleSteps]
    const timer = setTimeout(() => {
      if (step.type === 'typing') {
        setShowTyping(true)
      } else {
        setShowTyping(false)
      }
      setVisibleSteps((prev) => prev + 1)
    }, step.delay)

    return () => clearTimeout(timer)
  }, [visibleSteps, isPlaying])

  const messages = chatScript
    .slice(0, visibleSteps)
    .filter((s) => s.type === 'user' || s.type === 'ana')

  const finished = visibleSteps >= chatScript.length

  return (
    <section className="mt-10 mb-2">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold text-slate-800">Tire dúvidas com a Ana</h2>
        <p className="text-sm text-slate-400 mt-1">
          Nossa assistente virtual responde suas perguntas sobre o sistema.
        </p>
      </div>

      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 pb-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: chatBrandLight }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={chatBrand}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Não encontrou o que procura?</p>
            <p className="text-xs text-slate-400">
              Pergunte para a Ana — ela está aqui pra ajudar.
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="px-5 pt-4 space-y-3 min-h-[120px]">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-[fadeSlideIn_0.35s_ease-out]`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.type === 'user'
                    ? 'text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-700 rounded-bl-md'
                }`}
                style={msg.type === 'user' ? { backgroundColor: chatBrand } : undefined}
              >
                {msg.type === 'ana' && (
                  <span className="block text-xs font-semibold mb-1" style={{ color: chatBrand }}>
                    Ana
                  </span>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {showTyping && (
            <div className="flex justify-start animate-[fadeSlideIn_0.25s_ease-out]">
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                <span className="block text-xs font-semibold mb-1" style={{ color: chatBrand }}>
                  Ana
                </span>
                <span className="flex items-center gap-1 text-sm text-slate-400">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                  <span className="ml-2">Ana está digitando...</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Replay button */}
        {finished && (
          <div className="px-5 pt-2 flex justify-center">
            <button
              onClick={reset}
              className="text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: chatBrand }}
            >
              ↻ Ver novamente
            </button>
          </div>
        )}

        {/* Fake input */}
        <div className="p-5 pt-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-400 select-none">
              Qual sua dificuldade? Me conta...
            </div>
            <div
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white opacity-40"
              style={{ backgroundColor: chatBrand }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">
            Na versão completa, a Ana responde qualquer dúvida sobre o sistema.
          </p>
        </div>
      </div>

      {/* Keyframes for fade-slide animation */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  )
}
