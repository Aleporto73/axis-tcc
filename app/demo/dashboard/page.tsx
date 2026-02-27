'use client'

import { useState, useEffect, useCallback } from 'react'
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

        {/* ─── Chat simulado da Ana ─── */}
        <DemoAnaChat />

        <p className="text-[10px] text-slate-300 text-center mt-8 mb-4">AXIS ABA · Motor CSO-ABA v2.6.1 · Dados demonstrativos</p>
      </div>
    </>
  )
}

/* ═══════════════════════ DEMO ANA CHAT ═══════════════════════ */

const brand = '#c46a50'
const brandLight = '#f5ebe7'

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
        // Typing indicator stays visible until next step replaces it
      } else {
        setShowTyping(false)
      }
      setVisibleSteps((prev) => prev + 1)
    }, step.delay)

    return () => clearTimeout(timer)
  }, [visibleSteps, isPlaying])

  // Collect only user/ana messages (skip typing steps) for rendering
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
            style={{ backgroundColor: brandLight }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={brand}
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
                style={msg.type === 'user' ? { backgroundColor: brand } : undefined}
              >
                {msg.type === 'ana' && (
                  <span className="block text-xs font-semibold mb-1" style={{ color: brand }}>
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
                <span className="block text-xs font-semibold mb-1" style={{ color: brand }}>
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
              style={{ color: brand }}
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
              style={{ backgroundColor: brand }}
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
