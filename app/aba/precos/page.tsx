import Link from 'next/link'

export default function PrecosPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900">
            Planos AXIS ABA
          </h1>
          <p className="mt-3 text-lg text-slate-500">
            Escolha o plano ideal para sua clínica
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Acesso Essencial */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col">
            <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              Para começar
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Acesso Essencial
            </h2>

            <div className="mt-6">
              <span className="text-4xl font-bold text-slate-900">Gratuito</span>
            </div>

            <ul className="mt-8 space-y-3 flex-1">
              {['1 aprendiz', 'Acesso completo', 'Sem prazo', 'Sem cartão'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/sign-up"
              className="mt-8 block w-full text-center py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Começar agora
            </Link>
          </div>

          {/* AXIS Clínica 100 */}
          <div className="relative bg-white rounded-2xl border-2 border-orange-400 shadow-md p-8 flex flex-col">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Recomendado
            </span>

            <p className="text-sm font-medium text-orange-500 uppercase tracking-wide">
              Programa Fundadores
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              AXIS Clínica 100
            </h2>

            <div className="mt-6">
              <span className="text-lg text-slate-400 line-through mr-2">R$297</span>
              <br />
              <span className="text-4xl font-bold text-slate-900">R$147</span>
              <span className="text-base text-slate-500">/mês</span>
            </div>

            <ul className="mt-8 space-y-3 flex-1">
              {[
                'Até 100 aprendizes',
                'Multi-terapeuta',
                'Relatórios para convênio',
                'Motor CSO-ABA completo',
                'Suporte prioritário',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="mt-8 block w-full text-center py-2.5 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors cursor-default"
            >
              Quero ser Fundador
            </button>
          </div>

          {/* AXIS Clínica 250 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col">
            <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              Para clínicas maiores
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              AXIS Clínica 250
            </h2>

            <div className="mt-6">
              <span className="text-4xl font-bold text-slate-900">R$497</span>
              <span className="text-base text-slate-500">/mês</span>
            </div>

            <ul className="mt-8 space-y-3 flex-1">
              {[
                'Até 250 aprendizes',
                'Tudo do plano anterior',
                'Múltiplas unidades',
                'Relatórios consolidados',
                'Onboarding dedicado',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="mt-8 block w-full text-center py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-default"
            >
              Falar com consultor
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <p className="mt-12 text-center text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Clínicas com até 50 aprendizes podem começar com AbaSimples. AXIS é
          recomendado para clínicas que precisam de governança, supervisão e
          documentação institucional.
        </p>
      </div>
    </div>
  )
}
