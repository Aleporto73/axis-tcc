import Link from 'next/link'

// =====================================================
// AXIS TDAH - Página de Preços
// Mesma estrutura do ABA: Free + Clínica + Enterprise
// Pricing TDAH pendente (Hotmart product_id pendente Alê)
// =====================================================

const TDAH_COLOR = '#0d7377'

export default function PrecosTDAHPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900">
            Planos AXIS TDAH
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
              {['1 paciente ativo', 'Motor CSO-TDAH completo', 'Sessões tricontextuais', 'Sem prazo', 'Sem cartão'].map((item) => (
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

          {/* AXIS TDAH Clínica */}
          <div className="relative bg-white rounded-2xl border-2 shadow-md p-8 flex flex-col" style={{ borderColor: TDAH_COLOR }}>
            <span
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: TDAH_COLOR }}
            >
              Recomendado
            </span>

            <p className="text-sm font-medium uppercase tracking-wide" style={{ color: TDAH_COLOR }}>
              Programa Fundadores
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              AXIS TDAH Clínica
            </h2>

            <div className="mt-6">
              <span className="text-4xl font-bold text-slate-900">Em breve</span>
            </div>

            <ul className="mt-8 space-y-3 flex-1">
              {[
                'Pacientes ilimitados',
                'Multi-terapeuta',
                'Layer AuDHD completa',
                'DRC escolar',
                'Relatórios e alertas',
                'Motor CSO-TDAH v1.0',
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

            {/* TODO: substituir por link Hotmart quando product_id estiver definido */}
            <button
              disabled
              className="mt-8 block w-full text-center py-2.5 rounded-lg text-white text-sm font-medium opacity-60 cursor-not-allowed"
              style={{ backgroundColor: TDAH_COLOR }}
            >
              Disponível em breve
            </button>
          </div>

          {/* Enterprise / Clínica Grande */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col">
            <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">
              Para clínicas maiores
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Enterprise
            </h2>

            <div className="mt-6">
              <span className="text-4xl font-bold text-slate-900">Sob consulta</span>
            </div>

            <ul className="mt-8 space-y-3 flex-1">
              {[
                'Múltiplas unidades',
                'Tudo do plano anterior',
                'Relatórios consolidados',
                'API e integrações',
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

            <a
              href="mailto:suporte@axisclinico.com?subject=AXIS%20TDAH%20Enterprise"
              className="mt-8 block w-full text-center py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Fale conosco
            </a>
          </div>
        </div>

        {/* Rodapé */}
        <p className="mt-12 text-center text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          O plano gratuito inclui 1 paciente ativo com acesso completo ao motor CSO-TDAH,
          sessões tricontextuais e DRC. Ideal para testar e conhecer a plataforma.
        </p>
      </div>
    </div>
  )
}
