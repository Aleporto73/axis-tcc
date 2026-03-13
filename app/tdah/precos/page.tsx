import Link from 'next/link'

// =====================================================
// AXIS TDAH - Página de Preços
// Planos: Free (1 pac) + Founders (50) + Clínica 100 + Clínica 250 + Enterprise
// Hotmart product_id: 7380571
// =====================================================

const TDAH_COLOR = '#0d7377'

const Check = () => (
  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const PLANS = [
  {
    id: 'free',
    label: 'Para começar',
    name: 'Acesso Essencial',
    price: 'Gratuito',
    period: '',
    features: [
      '1 paciente ativo',
      'Motor CSO-TDAH completo',
      'Sessões tricontextuais',
      'Sem prazo',
      'Sem cartão',
    ],
    cta: 'Começar agora',
    href: '/sign-up',
    highlighted: false,
    badge: null,
    external: false,
  },
  {
    id: 'founders',
    label: 'Programa Fundadores',
    name: 'AXIS TDAH Founders',
    price: 'R$97',
    period: '/mês',
    features: [
      'Até 50 pacientes ativos',
      'Multi-terapeuta',
      'Layer AuDHD completa',
      'DRC escolar',
      'Relatórios e alertas',
      'Motor CSO-TDAH v1.0',
      'Suporte prioritário',
    ],
    cta: 'Assinar Founders',
    href: 'https://pay.hotmart.com/F104897641O?off=xqzgdn1i',
    highlighted: true,
    badge: 'Recomendado',
    external: true,
  },
  {
    id: 'clinica_100',
    label: 'Para clínicas',
    name: 'AXIS TDAH Clínica 100',
    price: 'R$247',
    period: '/mês',
    features: [
      'Até 100 pacientes ativos',
      'Tudo do plano Founders',
      'Ideal para clínicas médias',
      'Equipe expandida',
    ],
    cta: 'Assinar Clínica 100',
    href: 'https://pay.hotmart.com/F104897641O?off=cr3rh0u9',
    highlighted: false,
    badge: null,
    external: true,
  },
  {
    id: 'clinica_250',
    label: 'Para clínicas maiores',
    name: 'AXIS TDAH Clínica 250',
    price: 'R$497',
    period: '/mês',
    features: [
      'Até 250 pacientes ativos',
      'Tudo do plano Clínica 100',
      'Multi-unidade',
      'Relatórios consolidados',
    ],
    cta: 'Assinar Clínica 250',
    href: 'https://pay.hotmart.com/F104897641O?off=hxzwuwfh',
    highlighted: false,
    badge: null,
    external: true,
  },
  {
    id: 'enterprise',
    label: 'Sob medida',
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    features: [
      'Pacientes ilimitados',
      'Tudo dos planos anteriores',
      'API e integrações',
      'Onboarding dedicado',
      'SLA garantido',
    ],
    cta: 'Fale conosco',
    href: 'mailto:suporte@axisclinico.com?subject=AXIS%20TDAH%20Enterprise',
    highlighted: false,
    badge: null,
    external: true,
  },
]

export default function PrecosTDAHPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-16">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-sm p-6 flex flex-col ${
                plan.highlighted ? 'border-2 shadow-md' : 'border border-slate-200'
              }`}
              style={plan.highlighted ? { borderColor: TDAH_COLOR } : undefined}
            >
              {plan.badge && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: TDAH_COLOR }}
                >
                  {plan.badge}
                </span>
              )}

              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: plan.highlighted ? TDAH_COLOR : '#94a3b8' }}
              >
                {plan.label}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                {plan.name}
              </h2>

              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-slate-400">{plan.period}</span>
                )}
              </div>

              <ul className="mt-6 space-y-2.5 flex-1">
                {plan.features.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>

              {plan.external ? (
                <a
                  href={plan.href}
                  target={plan.id === 'enterprise' ? undefined : '_blank'}
                  rel={plan.id === 'enterprise' ? undefined : 'noopener noreferrer'}
                  className={`mt-6 block w-full text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    plan.highlighted
                      ? 'text-white hover:opacity-90'
                      : plan.id === 'enterprise'
                        ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                        : 'text-white hover:opacity-90'
                  }`}
                  style={
                    plan.id === 'enterprise'
                      ? undefined
                      : { backgroundColor: TDAH_COLOR }
                  }
                >
                  {plan.cta}
                </a>
              ) : (
                <Link
                  href={plan.href}
                  className="mt-6 block w-full text-center py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <p className="mt-12 text-center text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          O plano gratuito inclui 1 paciente ativo com acesso completo ao motor CSO-TDAH,
          sessões tricontextuais e DRC. Todos os planos pagos incluem Layer AuDHD, DRC escolar,
          relatórios completos e suporte prioritário.
        </p>
      </div>
    </div>
  )
}
