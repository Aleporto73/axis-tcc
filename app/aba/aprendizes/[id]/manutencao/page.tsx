'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Probe { id:string; protocol_id:string; protocol_title:string; learner_name:string; week_number:number; label:string; scheduled_at:string; status:string; result:string|null; trials_total:number|null; trials_correct:number|null; score_pct:number|null; evaluated_at:string|null }
const promptLabels: Record<string,string> = { independent:'Independente', gestural:'Gestual', verbal:'Verbal', modeling:'Modelagem', partial_physical:'Física parcial', full_physical:'Física total' }

export default function ManutencaoPage() {
  const params = useParams(); const searchParams = useSearchParams()
  const learnerId = params.id as string; const protocolId = searchParams.get('protocol_id')
  const [probes, setProbes] = useState<Probe[]>([]); const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string|null>(null); const [error, setError] = useState<string|null>(null)
  const [success, setSuccess] = useState<string|null>(null); const [evaluating, setEvaluating] = useState<string|null>(null)
  const [form, setForm] = useState({ trials_total:10, trials_correct:0, prompt_level:'independent', notes:'' })

  const fetchProbes = useCallback(async () => {
    let url = `/api/aba/maintenance?learner_id=${learnerId}`
    if (protocolId) url += `&protocol_id=${protocolId}`
    try { const res = await fetch(url); const data = await res.json(); setProbes(data.probes || []) } catch {}; setLoading(false)
  }, [learnerId, protocolId])
  useEffect(() => { fetchProbes() }, [fetchProbes])

  const handleSchedule = async () => {
    if (!protocolId) return; setSaving('schedule'); setError(null)
    try {
      const res = await fetch('/api/aba/maintenance', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'schedule', protocol_id:protocolId }) })
      const data = await res.json()
      if (!res.ok) setError(data.error||'Erro'); else { setSuccess(`${data.scheduled} sonda(s) agendada(s)`); fetchProbes() }
    } catch { setError('Falha de conexão') }; setSaving(null)
  }

  const handleEvaluate = async (probeId: string) => {
    setSaving(probeId); setError(null); setSuccess(null)
    try {
      const res = await fetch('/api/aba/maintenance', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'evaluate', probe_id:probeId, trials_total:form.trials_total, trials_correct:form.trials_correct, prompt_level:form.prompt_level, notes:form.notes||null }) })
      const data = await res.json()
      if (!res.ok) setError(data.error||'Erro'); else {
        if (data.regression) setSuccess(`Sonda falhou (${data.score_pct}%). Regressão — protocolo voltou para Ativo.`); else setSuccess(`Sonda aprovada (${data.score_pct}%)!`)
        setEvaluating(null); setForm({ trials_total:10, trials_correct:0, prompt_level:'independent', notes:'' }); fetchProbes()
      }
    } catch { setError('Falha de conexão') }; setSaving(null)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><p className="text-slate-400 text-sm animate-pulse">Carregando...</p></div>
  const pending = probes.filter(p => p.status === 'pending'); const completed = probes.filter(p => p.status === 'completed')

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 pt-5">
      <Link href={`/aba/aprendizes/${learnerId}`} className="text-xs text-slate-400 hover:text-aba-500">← Voltar ao aprendiz</Link>
      <div className="mt-4 mb-6 flex items-start justify-between">
        <div><h1 className="text-lg font-normal text-slate-800">Manutenção — Sondas</h1><p className="text-xs text-slate-400">Sondas pós-domínio (2, 6 e 12 semanas)</p></div>
        {protocolId && <button onClick={handleSchedule} disabled={saving==='schedule'} className="px-4 py-2 text-xs bg-aba-500 text-white rounded-lg hover:bg-aba-600 disabled:opacity-50">{saving==='schedule' ? 'Agendando...' : 'Agendar Sondas 2-6-12'}</button>}
      </div>
      {error && <div className="mb-4 p-3 bg-red-50 rounded-lg"><p className="text-xs text-red-500">{error}</p></div>}
      {success && <div className="mb-4 p-3 bg-green-50 rounded-lg"><p className="text-xs text-green-600">{success}</p></div>}

      {probes.length === 0 ? <div className="text-center py-12"><p className="text-sm text-slate-400">Nenhuma sonda agendada.</p></div> : (<>
        {pending.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-medium text-aba-500 uppercase tracking-wider mb-3">Pendentes ({pending.length})</h2>
            <div className="space-y-2">{pending.map(p => (
              <div key={p.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                <div className="flex items-center justify-between mb-2">
                  <div><h3 className="text-sm font-medium text-slate-800">{p.label}</h3><p className="text-[11px] text-slate-400">{p.protocol_title} · {new Date(p.scheduled_at).toLocaleDateString('pt-BR')}</p></div>
                  {new Date(p.scheduled_at) <= new Date() ? <button onClick={() => setEvaluating(evaluating===p.id ? null : p.id)} className="px-3 py-1 text-[11px] bg-aba-500 text-white rounded-lg hover:bg-aba-600">{evaluating===p.id ? 'Cancelar' : 'Avaliar'}</button> : <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-500">Futura</span>}
                </div>
                {evaluating === p.id && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div><label className="block text-[11px] text-slate-500 mb-1">Total tentativas</label><input type="number" min={1} value={form.trials_total} onChange={e => setForm({...form, trials_total:parseInt(e.target.value)||0})} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-aba-500" /></div>
                      <div><label className="block text-[11px] text-slate-500 mb-1">Corretas</label><input type="number" min={0} value={form.trials_correct} onChange={e => setForm({...form, trials_correct:parseInt(e.target.value)||0})} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-aba-500" /></div>
                      <div><label className="block text-[11px] text-slate-500 mb-1">Nível de dica</label><select value={form.prompt_level} onChange={e => setForm({...form, prompt_level:e.target.value})} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-aba-500 bg-white">{Object.entries(promptLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                    </div>
                    <div className="flex justify-end"><button onClick={() => handleEvaluate(p.id)} disabled={saving===p.id} className="px-4 py-1.5 text-xs bg-aba-500 text-white rounded-lg hover:bg-aba-600 disabled:opacity-50">{saving===p.id ? 'Salvando...' : 'Registrar Resultado'}</button></div>
                  </div>
                )}
              </div>
            ))}</div>
          </div>
        )}
        {completed.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Concluídas ({completed.length})</h2>
            <div className="space-y-2">{completed.map(p => (
              <div key={p.id} className={`p-4 rounded-xl border ${p.result==='passed' ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-medium text-slate-800">{p.label}</h3><p className="text-[11px] text-slate-400">{p.protocol_title} · {p.trials_correct}/{p.trials_total} ({p.score_pct}%)</p></div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.result==='passed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>{p.result==='passed' ? 'Mantida' : 'Regressão'}</span>
                </div>
              </div>
            ))}</div>
          </div>
        )}
      </>)}
    </div>
  )
}
