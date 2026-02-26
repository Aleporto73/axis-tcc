import Link from 'next/link'

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Banner CTA fixo */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-orange-500 to-rose-500 text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium">Experimentar com um caso real — sem compromisso</p>
            <p className="text-[11px] text-white/80">1 aprendiz · Acesso completo · Sem cartão</p>
          </div>
          <Link
            href="/sign-up"
            className="shrink-0 px-5 py-2 bg-white text-orange-600 text-sm font-semibold rounded-lg hover:bg-orange-50 transition-colors shadow-sm"
          >
            Começar grátis
          </Link>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5">
        <p className="text-center text-[11px] text-amber-700">
          Ambiente demonstrativo · Dados fictícios · Ações desabilitadas
        </p>
      </div>

      {children}
    </div>
  )
}
