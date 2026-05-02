import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <span className="text-7xl font-light text-slate-200">404</span>
        </div>
        <h1 className="font-serif text-2xl text-slate-800 mb-2">Página não encontrada</h1>
        <p className="text-slate-500 mb-8">
          A página que você procura não existe ou foi movida.
        </p>
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          ← Voltar ao Dashboard
        </Link>
      </div>
    </div>
  )
}
