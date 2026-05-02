'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erro na aplicação:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <span className="text-7xl font-light text-slate-200">Ops</span>
        </div>
        <h1 className="font-serif text-2xl text-slate-800 mb-2">Algo deu errado</h1>
        <p className="text-slate-500 mb-8">
          Ocorreu um erro inesperado. Nossa equipe foi notificada.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
          <a 
            href="/dashboard"
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
