'use client'
import { useState, useEffect } from 'react'

const bandColors: Record<string,string> = { excelente:'text-emerald-600', bom:'text-green-600', atencao:'text-amber-500', critico:'text-red-500' }
const bandLabels: Record<string,string> = { excelente:'Excelente', bom:'Bom', atencao:'Atenção', critico:'Crítico' }
const domainLabels: Record<string,string> = { comunicacao:'Comunicação', comportamento:'Comportamento', habilidades_sociais:'Habilidades Sociais', autonomia:'Autonomia', cognitivo:'Cognitivo', motor:'Motor' }

function LockButton({ label }: { label: string }) {
  const [tip, setTip] = useState(false)
  return (
    <div className="relative inline-block">
      <button onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 border border-slate-200 rounded-lg bg-slate-50 cursor-not-allowed">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        {label}
      </button>
      {tip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl z-50">
          Ambiente demonstrativo do padrão AXIS. Para aplicação clínica real, utilize a opção "Aplicar em um Caso Real".
        </div>
      )}
    </div>
  )
}

export default function DemoPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nome: '', clinica: '', email: '', aprendizes: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    fetch('/api/demo/data').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const handleSolicitar = async () => {
    if (!form.nome || !form.email) return
    setSending(true)
    try {
      await fetch('/api/demo/solicitar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      setSent(true)
    } catch {}
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-aba-500 uppercase tracking-wider">AXIS ABA</p>
            <p className="text-[10px] text-slate-400">Ambiente Institucional Demonstrativo</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-aba-500 text-white text-sm font-medium rounded-xl hover:bg-aba-600 transition-colors shadow-sm">
            Aplicar em um Caso Real
          </button>
        </div>
      </header>

      {/* Banner demo */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
        <p className="text-center text-xs text-amber-700">
          Estrutura completa visível. Aplicação clínica disponível via Acesso Essencial.
        </p>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Título */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-light text-slate-800 mb-2">Padrão Estruturado de Governança Clínica em ABA</h1>
          <p className="text-sm text-slate-400">Motor CSO-ABA v2.6.1 · Alinhado SBNI 2025 · RN 469 · RN 541 · RN 539</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="animate-pulse bg-white rounded-2xl h-48 border border-slate-200" />)}
          </div>
        ) : (
          <>
            {/* Cards aprendizes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {(data?.learners || []).map((l: any) => (
                <button key={l.id} onClick={() => setSelected(selected?.id === l.id ? null : l)}
                  className={`text-left p-5 rounded-2xl border transition-all ${selected?.id === l.id ? 'border-aba-500 bg-aba-500/5 shadow-sm' : 'border-slate-200 bg-white hover:border-aba-500/40 hover:shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-full bg-aba-500/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-aba-500">{l.full_name?.charAt(0)}</span>
                    </div>
                    {l.has_alert && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-500">Alerta</span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-slate-800 mb-0.5">{l.full_name}</h3>
                  <p className="text-xs text-slate-400 mb-3">{l.diagnosis || 'TEA'} · Nível {l.support_level}</p>
                  {l.cso ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xl font-light ${bandColors[l.cso.cso_band] || 'text-slate-600'}`}>{l.cso.cso_aba}</span>
                      <span className={`text-xs ${bandColors[l.cso.cso_band] || 'text-slate-400'}`}>{bandLabels[l.cso.cso_band] || l.cso.cso_band}</span>
                    </div>
                  ) : <p className="text-xs text-slate-300">CSO não calculado</p>}
                  <div className="flex gap-3 mt-2">
                    <span className="text-[10px] text-slate-400">{l.protocols?.active || 0} ativos</span>
                    <span className="text-[10px] text-slate-400">{l.protocols?.mastered || 0} dominados</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detalhe aprendiz selecionado */}
            {selected && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-medium text-slate-800">{selected.full_name}</h2>
                  <div className="flex gap-2">
                    <LockButton label="Novo Protocolo" />
                    <LockButton label="Nova Sessão" />
                  </div>
                </div>

                {/* Gráfico linha temporal CSO + dimensões */}
                {selected.cso_history?.length >= 2 && (() => {
                  const hist = selected.cso_history
                  const W = 560; const H = 80; const PAD = 24
                  const vals = hist.map((h: any) => parseFloat(h.cso_aba))
                  const min = Math.max(0, Math.min(...vals) - 10)
                  const max = Math.min(100, Math.max(...vals) + 10)
                  const xScale = (i: number) => PAD + (i / (hist.length - 1)) * (W - PAD * 2)
                  const yScale = (v: number) => H - PAD/2 - ((v - min) / (max - min)) * (H - PAD)
                  const points = hist.map((h: any, i: number) => `${xScale(i)},${yScale(parseFloat(h.cso_aba))}`).join(' ')
                  const dimColors: Record<string,string> = { sas:'#C46A2F', pis:'#6366f1', bss:'#10b981', tcm:'#f59e0b' }
                  return (
                    <div className="mb-4">
                      <p className="text-[10px] font-medium text-slate-400 mb-2 uppercase tracking-wider">Evolução CSO-ABA</p>
                      <div className="bg-slate-50 rounded-xl p-3 mb-3">
                        <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
                          {/* Eixo Y discreto */}
                          {[60,70,80,90].map(v => (
                            <g key={v}>
                              <line x1={PAD} x2={W-PAD} y1={yScale(v)} y2={yScale(v)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,3"/>
                              <text x={PAD-4} y={yScale(v)+3} textAnchor="end" fontSize="8" fill="#cbd5e1">{v}</text>
                            </g>
                          ))}
                          {/* Linha CSO */}
                          <polyline points={points} fill="none" stroke="#C46A2F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          {/* Pontos + valores + datas */}
                          {hist.map((h: any, i: number) => {
                            const val = parseFloat(h.cso_aba)
                            const x = xScale(i); const y = yScale(val)
                            const band = h.cso_band
                            const dotColor = band === 'excelente' ? '#10b981' : band === 'bom' ? '#10b981' : '#C46A2F'
                            // Detectar datas repetidas
                            const dateStr = new Date(h.created_at).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})
                            const sameDate = hist.filter((hh: any) => new Date(hh.created_at).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'}) === dateStr)
                            const sessionIdx = sameDate.findIndex((hh: any) => hh === h)
                            const label = sameDate.length > 1 ? `${dateStr} S${sessionIdx+1}` : dateStr
                            return (
                              <g key={i}>
                                <circle cx={x} cy={y} r="4" fill={dotColor} stroke="white" strokeWidth="1.5"/>
                                <text x={x} y={y-8} textAnchor="middle" fontSize="9" fill="#475569" fontWeight="500">{Math.round(val)}</text>
                                <text x={x} y={H-2} textAnchor="middle" fontSize="8" fill="#94a3b8">{label}</text>
                              </g>
                            )
                          })}
                        </svg>
                      </div>
                      {/* Mini gráficos por dimensão */}
                      <p className="text-[10px] font-medium text-slate-400 mb-2 uppercase tracking-wider">Evolução por Dimensão</p>
                      <div className="grid grid-cols-4 gap-2">
                        {(['sas','pis','bss','tcm'] as const).map((dim: string) => {
                          const dVals = hist.map((h: any) => parseFloat(h[dim] || 0))
                          const dMin = Math.max(0, Math.min(...dVals) - 10)
                          const dMax = Math.min(100, Math.max(...dVals) + 10)
                          const dW = 120; const dH = 40; const dPad = 8
                          const dX = (i: number) => dPad + (i / (hist.length - 1)) * (dW - dPad * 2)
                          const dY = (v: number) => dH - dPad - ((v - dMin) / (dMax - dMin)) * (dH - dPad * 2)
                          const dPts = hist.map((h: any, i: number) => `${dX(i)},${dY(parseFloat(h[dim] || 0))}`).join(' ')
                          const last = dVals[dVals.length - 1]
                          return (
                            <div key={dim} className="bg-slate-50 rounded-lg p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-medium uppercase" style={{color: dimColors[dim]}}>{dim}</span>
                                <span className="text-[10px] font-medium text-slate-600">{Math.round(last)}</span>
                              </div>
                              <svg width="100%" viewBox={`0 0 ${dW} ${dH}`}>
                                <polyline points={dPts} fill="none" stroke={dimColors[dim]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                {hist.map((_: any, i: number) => (
                                  <circle key={i} cx={dX(i)} cy={dY(parseFloat(hist[i][dim] || 0))} r="2.5" fill={dimColors[dim]}/>
                                ))}
                              </svg>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                    <p className="text-3xl font-light text-slate-800">{selected.cso ? parseFloat(selected.cso.cso_aba).toFixed(1) : '—'}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Índice CSO-ABA</p>
                    {selected.cso?.cso_band && <p className={`text-xs font-medium mt-1 ${selected.cso.cso_band === 'excelente' ? 'text-emerald-500' : selected.cso.cso_band === 'bom' ? 'text-green-500' : 'text-amber-500'}`}>{selected.cso.cso_band.charAt(0).toUpperCase() + selected.cso.cso_band.slice(1)}</p>}
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl text-center">
                    <p className="text-lg font-light text-slate-700">{selected.protocols?.active || 0}</p>
                    <p className="text-[10px] text-slate-400">Protocolos Ativos</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl text-center">
                    <p className="text-lg font-light text-emerald-600">{selected.protocols?.mastered || 0}</p>
                    <p className="text-[10px] text-slate-400">Dominados</p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <LockButton label="Gerar Relatório PDF" />
                  <LockButton label="Ver Snapshot" />
                  <LockButton label="Log de Auditoria" />
                  <LockButton label="Generalização 3×2" />
                </div>
              </div>
            )}

            {/* Bloco motor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Motor CSO-ABA v2.6.1</h3>
                <div className="space-y-2">
                  {[['SAS','Aquisição de Habilidades'],['PIS','Independência de Prompts'],['BSS','Estabilidade Comportamental'],['TCM','Consistência Terapêutica']].map(([k,v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{v}</span>
                      <span className="text-xs font-medium text-aba-500">{k}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400">Pesos fixos · Imutável · Auditável · SHA256</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Blindagem Jurídica</h3>
                <div className="space-y-2">
                  {['Snapshot imutável com hash SHA256','Justificativa automática de carga horária','Política de alta parcial documentada','Evidência bibliográfica por técnica','Versionamento metodológico explícito'].map((v,i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-aba-500 flex-shrink-0" />
                      <span className="text-xs text-slate-500">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>



      {/* Modal solicitação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { if (!sending) setShowModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              {sent ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <h3 className="text-base font-medium text-slate-800 mb-1">Solicitação recebida</h3>
                  <p className="text-sm text-slate-500 mb-4">Você receberá o link de acesso em breve.</p>
                  <button onClick={() => { setShowModal(false); setSent(false) }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Fechar</button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center mb-5">
                    <div className="mb-3">
                      <img src="/axaba.png" alt="AXIS ABA" className="h-8 object-contain mx-auto" />
                    </div>
                    <h3 className="text-base font-medium text-slate-800 mb-1 text-center">Acesso institucional imediato ao ambiente clínico real.</h3>
                    <p className="text-xs text-slate-400 text-center">Sem cartão. Sem aprovação manual. Sem limite temporal.</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                      <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Seu nome completo" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Clínica</label>
                      <input type="text" value={form.clinica} onChange={e => setForm({...form, clinica: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Nome da clínica ou instituição" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                      <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="seu@email.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nº aproximado de aprendizes <span className="text-slate-300">(opcional)</span></label>
                      <input type="text" value={form.aprendizes} onChange={e => setForm({...form, aprendizes: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="Ex: 5, 10, 20..." />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-5">
                    <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                    <button onClick={handleSolicitar} disabled={sending || !form.nome || !form.email}
                      className="px-5 py-2 bg-aba-500 text-white text-sm font-medium rounded-xl hover:bg-aba-600 disabled:opacity-50 transition-colors">
                      {sending ? 'Enviando...' : 'Solicitar Acesso'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
