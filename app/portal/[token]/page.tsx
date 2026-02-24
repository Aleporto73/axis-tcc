'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const domainLabels: Record<string,string> = { comunicacao:'Comunicação', comportamento:'Comportamento', habilidades_sociais:'Habilidades Sociais', autonomia:'Autonomia', cognitivo:'Cognitivo', motor:'Motor' }
const statusLabels: Record<string,string> = { conquistado:'⭐ Conquistado', em_progresso:'Em progresso', em_revisao:'Em revisão', outro:'Outro' }

export default function PortalPage() {
  const { token } = useParams()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetch(`/api/portal/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
        setLoading(false)
      })
      .catch(() => { setError('Falha de conexão'); setLoading(false) })
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-orange-50/30 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-aba-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-orange-50/30 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/></svg>
        </div>
        <h1 className="text-lg font-medium text-slate-800 mb-2">Link inválido</h1>
        <p className="text-sm text-slate-500">{error === 'Link inválido ou expirado' ? 'Este link não existe ou expirou. Solicite um novo link ao terapeuta.' : error}</p>
      </div>
    </div>
  )

  const { learner, summaries, protocols, upcoming, achievements } = data
  const age = learner.date_of_birth ? Math.floor((Date.now() - new Date(learner.date_of_birth).getTime()) / (365.25*24*60*60*1000)) : null
  const conquistados = protocols.filter((p:any) => p.status_simplificado === 'conquistado').length
  const emProgresso = protocols.filter((p:any) => p.status_simplificado === 'em_progresso').length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-aba-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
          </div>
          <div>
            <h1 className="text-base font-medium text-slate-800">{learner.full_name}</h1>
            <p className="text-xs text-slate-400">Portal da Família · AXIS ABA{age ? ` · ${age} anos` : ''}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Resumo rápido */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-light text-aba-500">{conquistados}</p>
            <p className="text-xs text-slate-500 mt-1">habilidade{conquistados !== 1 ? 's' : ''} conquistada{conquistados !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-light text-slate-700">{emProgresso}</p>
            <p className="text-xs text-slate-500 mt-1">em progresso</p>
          </div>
        </div>

        {/* Conquistas */}
        {achievements.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <span>⭐</span> Conquistas
            </h2>
            <div className="space-y-2">
              {achievements.map((a:any, i:number) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm flex-shrink-0">🏅</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{a.title}</p>
                    <p className="text-xs text-slate-400">{domainLabels[a.domain] || a.domain} · {new Date(a.updated_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Próximas sessões */}
        {upcoming.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Próximas Sessões
            </h2>
            <div className="space-y-2">
              {upcoming.map((s:any, i:number) => {
                const d = new Date(s.scheduled_at)
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-10 text-center flex-shrink-0">
                      <p className="text-xs text-slate-400">{d.toLocaleDateString('pt-BR', {weekday:'short'})}</p>
                      <p className="text-base font-medium text-slate-700">{d.getDate()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700">{d.toLocaleDateString('pt-BR', {month:'long'})}</p>
                      <p className="text-xs text-slate-400">{d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}{s.duration_minutes ? ` · ${s.duration_minutes}min` : ''}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Resumos de sessão */}
        {summaries.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-aba-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Resumos das Sessões
            </h2>
            <div className="space-y-3">
              {summaries.map((s:any, i:number) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">{new Date(s.scheduled_at).toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'})}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{s.content}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {summaries.length === 0 && achievements.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">Nenhuma informação disponível ainda.</p>
            <p className="text-slate-300 text-xs mt-1">Os resumos aparecerão aqui após as sessões.</p>
          </div>
        )}

        {/* Habilidades */}
        {protocols.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-medium text-slate-700 mb-3">Habilidades Trabalhadas</h2>
            <div className="space-y-2">
              {protocols.map((p:any, i:number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm text-slate-700">{p.title}</p>
                    <p className="text-xs text-slate-400">{domainLabels[p.domain] || p.domain}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status_simplificado === 'conquistado' ? 'bg-emerald-100 text-emerald-700' : p.status_simplificado === 'em_progresso' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    {statusLabels[p.status_simplificado] || p.status_simplificado}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-6 px-4">
        <p className="text-[10px] text-slate-300">AXIS ABA · Portal da Família · Informações compartilhadas pelo terapeuta responsável</p>
      </footer>
    </div>
  )
}
