'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Probe { id:string; variation_number:number; context_number:number; variation_desc:string|null; context_desc:string|null; trials_total:number; trials_correct:number; score_pct:number; prompt_level:string; created_at:string }
const promptLabels: Record<string,string> = { independent:'Independente', gestural:'Gestual', verbal:'Verbal', modeling:'Modelagem', partial_physical:'Física parcial', full_physical:'Física total' }

export default function GeneralizacaoPage() {
  const params = useParams(); const searchParams = useSearchParams()
  const learnerId = params.id as string; const protocolId = searchParams.get('protocol_id')
  const [probes, setProbes] = useState<Probe[]>([]); const [protocolTitle, setProtocolTitle] = useState('')
  const [criteriaPct, setCriteriaPct] = useState(80); const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string|null>(null)
  const [success, setSuccess] = useState<string|null>(null)
  const [selectedCell, setSelectedCell] = useState<{v:number;c:number}|null>(null)
  const [form, setForm] = useState({ variation_desc:'', context_desc:'', trials_total:10, trials_correct:0, prompt_level:'independent', notes:'' })

  const fetchProbes = useCallback(async () => {
    if (!protocolId) return
    try {
      const res = await fetch(`/api/aba/generalization?protocol_id=${protocolId}`); const data = await res.json(); setProbes(data.probes || [])
      const pRes = await fetch(`/api/aba/protocols?learner_id=${learnerId}`); const pData = await pRes.json()
      const proto = pData.protocols?.find((p:any) => p.id === protocolId)
      if (proto) { setProtocolTitle(proto.title); setCriteriaPct(proto.mastery_criteria_pct || 80) }
    } catch {}; setLoading(false)
  }, [protocolId, learnerId])
  useEffect(() => { fetchProbes() }, [fetchProbes])

  const getCell = (v:number, c:number) => {
    const cp = probes.filter(p => p.variation_number===v && p.context_number===c)
    const latest = cp[0] || undefined
    return { latest, passed: latest ? latest.score_pct >= criteriaPct : false }
  }

  const handleSubmit = async () => {
    if (!selectedCell || !protocolId) return; setSaving(true); setError(null); setSuccess(null)
    try {
      const res = await fetch('/api/aba/generalization', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ protocol_id:protocolId, variation_number:selectedCell.v, context_number:selectedCell.c, variation_desc:form.variation_desc||null, context_desc:form.context_desc||null, trials_total:form.trials_total, trials_correct:form.trials_correct, prompt_level:form.prompt_level, notes:form.notes||null }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error||'Erro') } else {
        if (data.auto_transitioned) setSuccess('Generalização completa! Protocolo → Mantido'); else setSuccess(`${data.matrix.passing_cells}/6 células aprovadas`)
        setSelectedCell(null); setForm({ variation_desc:'', context_desc:'', trials_total:10, trials_correct:0, prompt_level:'independent', notes:'' }); fetchProbes()
      }
    } catch { setError('Falha de conexão') }; setSaving(false)
  }

  if (!protocolId) return <div className="px-4 pt-8 text-center"><p className="text-slate-400 text-sm">protocol_id ausente.</p><Link href={`/aba/aprendizes/${learnerId}`} className="text-xs text-aba-500 mt-2 inline-block">← Voltar</Link></div>
  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><p className="text-slate-400 text-sm animate-pulse">Carregando...</p></div>
  const totalPassed = [1,2,3].flatMap(v => [1,2].map(c => getCell(v,c))).filter(c => c.passed).length

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 pt-5">
      <Link href={`/aba/aprendizes/${learnerId}`} className="text-xs text-slate-400 hover:text-aba-500">← Voltar ao aprendiz</Link>
      <div className="mt-4 mb-6"><h1 className="text-lg font-normal text-slate-800">Generalização 3×2</h1><p className="text-xs text-slate-400">{protocolTitle} · Critério: {criteriaPct}% · {totalPassed}/6 células</p></div>
      {error && <div className="mb-4 p-3 bg-red-50 rounded-lg"><p className="text-xs text-red-500">{error}</p></div>}
      {success && <div className="mb-4 p-3 bg-green-50 rounded-lg"><p className="text-xs text-green-600">{success}</p></div>}

      <div className="mb-6">
        <div className="grid grid-cols-3 gap-px bg-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 p-2 text-center text-[10px] font-medium text-slate-500 uppercase">Variação</div>
          <div className="bg-slate-50 p-2 text-center text-[10px] font-medium text-slate-500 uppercase">Contexto 1</div>
          <div className="bg-slate-50 p-2 text-center text-[10px] font-medium text-slate-500 uppercase">Contexto 2</div>
          {[1,2,3].map(v => (<>
            <div key={`v${v}`} className="bg-slate-50 p-3 flex items-center justify-center"><span className="text-xs font-medium text-slate-600">V{v}</span></div>
            {[1,2].map(c => { const cell = getCell(v,c); return (
              <button key={`${v}-${c}`} onClick={() => setSelectedCell({v,c})} className={`p-3 text-center transition-colors ${cell.passed ? 'bg-green-50 hover:bg-green-100' : cell.latest ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-aba-500/5'} ${selectedCell?.v===v&&selectedCell?.c===c ? 'ring-2 ring-aba-500' : ''}`}>
                {cell.latest ? (<><p className={`text-sm font-medium ${cell.passed?'text-green-600':'text-amber-600'}`}>{cell.latest.score_pct}%</p><p className="text-[10px] text-slate-400">{cell.latest.trials_correct}/{cell.latest.trials_total}</p></>) : <p className="text-xs text-slate-300">Vazio</p>}
              </button>
            )})}
          </>))}
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-center">Clique numa célula para registrar probe</p>
      </div>

      {selectedCell && (
        <div className="p-4 rounded-xl border border-aba-500/30 bg-aba-500/5 mb-6">
          <h3 className="text-sm font-medium text-slate-800 mb-3">Probe — V{selectedCell.v} × C{selectedCell.c}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="block text-[11px] text-slate-500 mb-1">Descrição variação</label><input type="text" value={form.variation_desc} onChange={e => setForm({...form, variation_desc:e.target.value})} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-aba-500" placeholder="Ex: Com brinquedo diferente" /></div>
            <div><label className="block text-[11px] text-slate-500 mb-1">Descrição contexto</label><input type="text" value={form.context_desc} onChange={e => setForm({...form, context_desc:e.target.value})} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-aba-500" placeholder="Ex: Na sala de espera" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="block text-[11px] text-slate-500 mb-1">Total tentativas</label><input type="number" min={1} value={form.trials_total} onChange={e => setForm({...form, trials_total:parseInt(e.target.value)||0})} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-aba-500" /></div>
            <div><label className="block text-[11px] text-slate-500 mb-1">Corretas</label><input type="number" min={0} value={form.trials_correct} onChange={e => setForm({...form, trials_correct:parseInt(e.target.value)||0})} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-aba-500" /></div>
            <div><label className="block text-[11px] text-slate-500 mb-1">Nível de dica</label><select value={form.prompt_level} onChange={e => setForm({...form, prompt_level:e.target.value})} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-aba-500 bg-white">{Object.entries(promptLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setSelectedCell(null)} className="px-3 py-1.5 text-xs text-slate-500">Cancelar</button>
            <button onClick={handleSubmit} disabled={saving} className="px-4 py-1.5 text-xs bg-aba-500 text-white rounded-lg hover:bg-aba-600 disabled:opacity-50">{saving ? 'Salvando...' : 'Registrar Probe'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
