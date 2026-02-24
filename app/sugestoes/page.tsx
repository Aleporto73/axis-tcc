'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'

interface Suggestion {
  suggestion_id: string
  patient_id: string
  patient_name: string
  suggestion_type: string
  content: string
  reasoning: string
  priority: number
  suggested_at: string
}

export default function SugestoesPage() {
  const { isLoaded, userId } = useAuth()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded && userId) loadSuggestions()
  }, [isLoaded, userId])

  const loadSuggestions = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/suggestions')
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDecision = async (id: string, decision: string) => {
    try {
      setProcessing(id)
      const res = await fetch(`/api/suggestions/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      })
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.suggestion_id !== id))
      }
    } catch (error) {
      console.error('Erro ao processar decisão:', error)
    } finally {
      setProcessing(null)
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'session_focus': return 'Foco da Sessão'
      case 'homework': return 'Tarefa de Casa'
      case 'technique': return 'Técnica'
      case 'alert': return 'Alerta'
      default: return type
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="md:ml-20 min-h-screen flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#FC608F] border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      
      <main className="md:ml-20 min-h-screen pb-20 md:pb-8">
        
        {/* Top Capsule Navigation */}
        <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
          <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
            <Link href="/dashboard" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Hoje</Link>
            <span className="text-slate-300 text-xs">·</span>
            <Link href="/sessoes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Sessões</Link>
            <span className="text-slate-300 text-xs">·</span>
            <Link href="/pacientes" className="px-3 py-1 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Pacientes</Link>
            <span className="text-slate-300 text-xs hidden sm:inline">·</span>
            <Link href="/sugestoes" className="hidden sm:inline px-3 py-1 text-sm font-medium text-[#FC608F]">Sugestões</Link>
          </nav>
        </div>

        <div className="px-4 md:px-8 lg:px-12 xl:px-16">
          <div className="max-w-3xl mx-auto">
            
            {/* Header */}
            <header className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-lg font-normal text-slate-400 tracking-tight mb-0">Sugestões</h1>
                <p className="text-xs text-slate-300 font-light">AXIS Assist — sugestões para revisão</p>
              </div>
              {suggestions.length > 0 && (
                <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium">
                  {suggestions.length} pendente{suggestions.length !== 1 ? 's' : ''}
                </span>
              )}
            </header>

            {/* Sugestões */}
            {suggestions.length === 0 ? (
              <div className="py-16 text-center border-t border-slate-100">
                <p className="text-slate-400 italic mb-2">Nenhuma sugestão pendente</p>
                <p className="text-sm text-slate-300">O AXIS Assist gerará sugestões conforme os eventos forem processados</p>
              </div>
            ) : (
              <div className="space-y-4 border-t border-slate-100 pt-6">
                {suggestions.map((s) => (
                  <article key={s.suggestion_id} className="border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors">
                    
                    {/* Header da sugestão */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-slate-900">{s.patient_name || 'Paciente'}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {getTypeLabel(s.suggestion_type)} · Prioridade {s.priority} · {new Date(s.suggested_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    
                    {/* Conteúdo */}
                    <p className="text-slate-700 text-sm mb-3">{s.content}</p>
                    
                    {/* Raciocínio */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 mb-4">
                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-slate-600">Raciocínio: </span>
                        {s.reasoning}
                      </p>
                    </div>
                    
                    {/* Ações */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDecision(s.suggestion_id, 'ignored')}
                        disabled={processing === s.suggestion_id}
                        className="flex-1 px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        Ignorar
                      </button>
                      <button
                        onClick={() => handleDecision(s.suggestion_id, 'edited')}
                        disabled={processing === s.suggestion_id}
                        className="flex-1 px-3 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDecision(s.suggestion_id, 'approved')}
                        disabled={processing === s.suggestion_id}
                        className="flex-1 px-3 py-2 text-sm text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors font-medium"
                      >
                        {processing === s.suggestion_id ? 'Processando...' : 'Aprovar'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
