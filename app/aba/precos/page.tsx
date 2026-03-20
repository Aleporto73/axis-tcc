'use client'

import Link from 'next/link'
import { Check, X, ArrowRight } from 'lucide-react'
import { HelpTip } from '@/components/Tooltip'
import type { TooltipKey } from '@/lib/tooltips'

/* ─── palette ─── */
const coral = '#B4532F'
const coralLight = '#c46a50'

/* ─── plan data ─── */
const plans = [
  {
    id: 'free',
    name: '1 Aprendiz',
    subtitle: 'Para começar',
    price: 'Gratuito',
    priceNote: 'Sem cartão, sem prazo',
    href: '/sign-up?produto=aba',
    cta: 'Começar agora',
    highlight: false,
    external: false,
  },
  {
    id: 'founders',
    name: 'Clínica 100',
    subtitle: 'Programa Fundadores',
    price: 'R$147',
    priceNote: '/mês — preço de lançamento',
    originalPrice: 'R$247',
    href: 'https://pay.hotmart.com/H104663812P?off=u2t04kz5',
    cta: 'Quero ser Fundador',
    highlight: true,
    external: true,
  },
  {
    id: 'clinica100',
    name: 'Clínica 100',
    subtitle: 'Plano profissional',
    price: 'R$247',
    priceNote: '/mês',
    href: 'https://pay.hotmart.com/H104663812P?off=iwqieqxc',
    cta: 'Assinar Clínica 100',
    highlight: false,
    external: true,
  },
  {
    id: 'clinica250',
    name: 'Clínica 250',
    subtitle: 'Para clínicas maiores',
    price: 'R$497',
    priceNote: '/mês',
    href: 'https://pay.hotmart.com/H104663812P?off=gona25or',
    cta: 'Solicitar adesão',
    highlight: false,
    external: true,
  },
]

type RowValue = boolean | string

interface FeatureRow {
  label: string
  tip?: TooltipKey
  values: [RowValue, RowValue, RowValue, RowValue]
}

interface FeatureGroup {
  section: string
  sectionColor?: string
  rows: FeatureRow[]
}

const features: FeatureGroup[] = [
  {
    section: 'Motor Clínico (CSO-ABA v2.6.1)',
    rows: [
      { label: 'Motor CSO-ABA completo', tip: 'pub_cso', values: [true, true, true, true] },
      { label: 'Registro estruturado de sessões', values: [true, true, true, true] },
      { label: 'Ciclo de protocolo (rascunho → mantido)', values: [true, true, true, true] },
      { label: 'Generalização 3×2', values: [true, true, true, true] },
      { label: 'Manutenção 2-6-12', values: [true, true, true, true] },
      { label: 'Relatório institucional', values: [true, true, true, true] },
      { label: 'Aprendizes', values: ['1', 'Até 100', 'Até 100', 'Até 250'] },
      { label: 'Multi-terapeuta', tip: 'pub_multi_tenant', values: [false, true, true, true] },
      { label: 'Relatórios consolidados', values: [false, true, true, true] },
      { label: 'Onboarding dedicado', values: [false, true, true, true] },
    ],
  },
  {
    section: 'Operadora Ready (v2.7.0)',
    sectionColor: coral,
    rows: [
      { label: 'Presença GPS (check-in / check-out)', tip: 'pub_gps', values: [false, true, true, true] },
      { label: 'Atestações digitais (terapeuta)', tip: 'pub_atestacao', values: [false, true, true, true] },
      { label: 'Locais de atendimento (service sites)', tip: 'pub_service_sites', values: [false, false, true, true] },
      { label: 'Bundles de evidência', tip: 'pub_bundle', values: [false, false, true, true] },
      { label: 'Anexos de sessão', values: [false, false, true, true] },
      { label: 'Perfis de cobertura (plano de saúde)', tip: 'pub_cobertura', values: [false, false, true, true] },
      { label: 'Claim packets (faturamento)', tip: 'pub_claim', values: [false, false, true, true] },
      { label: 'Credenciais do provedor', tip: 'pub_credenciais', values: [false, false, true, true] },
      { label: 'Flags de integridade', tip: 'pub_flags', values: [false, false, true, true] },
      { label: 'Perfis de operadora / payer', tip: 'pub_payer_profiles', values: [false, false, true, true] },
      { label: 'Dashboard de compliance', tip: 'pub_dashboard_compliance', values: [false, false, false, true] },
    ],
  },
  {
    section: 'Plataforma',
    rows: [
      { label: 'Assistente Ana (suporte in-app)', values: [true, true, true, true] },
      { label: 'LGPD aplicada', tip: 'pub_lgpd', values: [true, true, true, true] },
      { label: 'Histórico append-only', tip: 'pub_append_only', values: [true, true, true, true] },
      { label: 'Multi-tenant isolado', tip: 'pub_multi_tenant', values: [true, true, true, true] },
      { label: 'Suporte prioritário', values: [false, true, true, true] },
    ],
  },
]

/* ═══════════════════════ PAGE ═══════════════════════ */

export default function PrecosPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ────────── HEADER ────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/produto/aba" className="text-lg font-bold tracking-tight" style={{ color: coral }}>
            AXIS ABA
          </Link>
          <Link
            href="/sign-in"
            className="hidden sm:inline-flex px-5 py-2 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
          >
            Acessar plataforma
          </Link>
        </div>
      </header>

      {/* ────────── HERO ────────── */}
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-light leading-tight mb-4">
            Planos <span className="font-semibold" style={{ color: coral }}>AXIS ABA</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Motor clínico completo em todos os planos. Camada Operadora Ready disponível
            a partir do plano Founders. Escolha o que faz sentido para sua clínica.
          </p>
        </div>
      </section>

      {/* ────────── PLAN CARDS ────────── */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl p-7 flex flex-col ${
                plan.highlight
                  ? 'border-2 shadow-lg'
                  : 'border border-slate-200 shadow-sm'
              }`}
              style={plan.highlight ? { borderColor: coral } : undefined}
            >
              {plan.highlight && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: coral }}
                >
                  Recomendado
                </span>
              )}

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {plan.subtitle}
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{plan.name}</h2>

              <div className="mt-5">
                {plan.originalPrice && (
                  <span className="text-sm text-slate-400 line-through mr-2">{plan.originalPrice}</span>
                )}
                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-500">{plan.priceNote?.replace(plan.price, '')}</span>
              </div>

              {/* Quick highlights per plan */}
              <div className="mt-6 space-y-2 flex-1">
                {plan.id === 'free' && (
                  <>
                    <QuickItem text="Motor CSO-ABA completo" />
                    <QuickItem text="1 aprendiz" />
                    <QuickItem text="Relatório institucional" />
                    <QuickItem text="Sem operadora" muted />
                  </>
                )}
                {plan.id === 'founders' && (
                  <>
                    <QuickItem text="Até 100 aprendizes" />
                    <QuickItem text="Multi-terapeuta" />
                    <QuickItem text="Presença GPS" accent />
                    <QuickItem text="Atestações digitais" accent />
                    <QuickItem text="Preço congelado para sempre" accent />
                  </>
                )}
                {plan.id === 'clinica100' && (
                  <>
                    <QuickItem text="Tudo do Founders +" />
                    <QuickItem text="Bundles de evidência" accent />
                    <QuickItem text="Claim packets" accent />
                    <QuickItem text="Perfis de cobertura" accent />
                    <QuickItem text="Flags de integridade" accent />
                  </>
                )}
                {plan.id === 'clinica250' && (
                  <>
                    <QuickItem text="Tudo do Clínica 100 +" />
                    <QuickItem text="Até 250 aprendizes" />
                    <QuickItem text="Dashboard de compliance" accent />
                    <QuickItem text="Perfis de operadora/payer" accent />
                    <QuickItem text="Suporte prioritário" />
                  </>
                )}
              </div>

              {plan.external ? (
                <a
                  href={plan.href}
                  target="_blank"
                  className="mt-6 block w-full text-center py-3 rounded-lg text-sm font-semibold transition-colors"
                  style={
                    plan.highlight
                      ? { backgroundColor: coral, color: 'white' }
                      : { border: '1px solid #334155', color: '#334155' }
                  }
                >
                  {plan.cta}
                </a>
              ) : (
                <Link
                  href={plan.href}
                  className="mt-6 block w-full text-center py-3 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ────────── COMPARISON TABLE (desktop) ────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-3">
            Comparativo completo
          </h2>
          <p className="text-base text-slate-500 text-center mb-10 max-w-xl mx-auto">
            Veja exatamente o que cada plano inclui no motor clínico e na camada Operadora Ready.
          </p>

          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="text-left py-4 px-6 font-semibold w-[36%]">Recurso</th>
                  <th className="text-center py-4 px-3 font-semibold">
                    <span className="block">1 Aprendiz</span>
                    <span className="text-xs font-normal text-slate-400">Free</span>
                  </th>
                  <th className="text-center py-4 px-3 font-semibold">
                    <span className="block">Clínica 100</span>
                    <span className="text-xs font-normal text-slate-400">Founders</span>
                  </th>
                  <th className="text-center py-4 px-3 font-semibold">Clínica 100</th>
                  <th className="text-center py-4 px-3 font-semibold">Clínica 250</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {features.map((group) => (
                  <>
                    <tr
                      key={'section-' + group.section}
                      style={group.sectionColor ? { backgroundColor: group.sectionColor + '10' } : undefined}
                      className={group.sectionColor ? '' : 'bg-slate-800'}
                    >
                      <td
                        colSpan={5}
                        className="py-2 px-6 text-xs font-bold tracking-widest uppercase"
                        style={group.sectionColor ? { color: group.sectionColor } : { color: '#94a3b8' }}
                      >
                        {group.section}
                      </td>
                    </tr>
                    {group.rows.map((row, i) => (
                      <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="py-3 px-6 text-slate-700 font-medium">{row.label} {row.tip && <HelpTip tip={row.tip} />}</td>
                        {row.values.map((v, j) => (
                          <td key={j} className="py-3 px-3 text-center">
                            {typeof v === 'string' ? (
                              <span className="text-sm font-semibold text-slate-700">{v}</span>
                            ) : v ? (
                              <Check className="w-5 h-5 mx-auto" style={{ color: coral }} />
                            ) : (
                              <X className="w-4 h-4 mx-auto text-slate-300" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
                {/* Price row */}
                <tr className="border-t-2 border-slate-200 bg-white">
                  <td className="py-5 px-6 text-slate-900 font-bold">Investimento</td>
                  <td className="py-5 px-3 text-center">
                    <span className="text-lg font-bold text-slate-900">Sem custo</span>
                  </td>
                  <td className="py-5 px-3 text-center">
                    <span className="text-sm text-slate-400 line-through block">R$247</span>
                    <span className="text-lg font-bold text-slate-900">R$147</span>
                    <span className="text-sm text-slate-500">/mês</span>
                  </td>
                  <td className="py-5 px-3 text-center">
                    <span className="text-lg font-bold text-slate-900">R$247</span>
                    <span className="text-sm text-slate-500">/mês</span>
                  </td>
                  <td className="py-5 px-3 text-center">
                    <span className="text-lg font-bold text-slate-900">R$497</span>
                    <span className="text-sm text-slate-500">/mês</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile: horizontal scroll table */}
          <div className="md:hidden overflow-x-auto -mx-6 px-6 pb-4">
            <p className="text-xs text-slate-400 mb-3 text-center">← Deslize para ver todos os planos →</p>
            <table className="text-xs min-w-[600px] w-full">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="text-left py-3 px-3 font-semibold w-[36%]">Recurso</th>
                  <th className="text-center py-3 px-2 font-semibold">Free</th>
                  <th className="text-center py-3 px-2 font-semibold">Founders</th>
                  <th className="text-center py-3 px-2 font-semibold">Clínica 100</th>
                  <th className="text-center py-3 px-2 font-semibold">Clínica 250</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {features.map((group) => (
                  <>
                    <tr key={'m-' + group.section} style={group.sectionColor ? { backgroundColor: group.sectionColor + '10' } : undefined} className={group.sectionColor ? '' : 'bg-slate-800'}>
                      <td colSpan={5} className="py-1.5 px-3 text-[10px] font-bold tracking-widest uppercase" style={group.sectionColor ? { color: group.sectionColor } : { color: '#94a3b8' }}>
                        {group.section}
                      </td>
                    </tr>
                    {group.rows.map((row, i) => (
                      <tr key={'m-' + row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="py-2 px-3 text-slate-700 font-medium">{row.label}</td>
                        {row.values.map((v, j) => (
                          <td key={j} className="py-2 px-2 text-center">
                            {typeof v === 'string' ? (
                              <span className="text-[11px] font-semibold text-slate-700">{v}</span>
                            ) : v ? (
                              <Check className="w-4 h-4 mx-auto" style={{ color: coral }} />
                            ) : (
                              <X className="w-3.5 h-3.5 mx-auto text-slate-300" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
                <tr className="border-t-2 border-slate-200 bg-white">
                  <td className="py-3 px-3 text-slate-900 font-bold">Preço</td>
                  <td className="py-3 px-2 text-center font-bold text-slate-900">Grátis</td>
                  <td className="py-3 px-2 text-center font-bold text-slate-900">R$147</td>
                  <td className="py-3 px-2 text-center font-bold text-slate-900">R$247</td>
                  <td className="py-3 px-2 text-center font-bold text-slate-900">R$497</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* CTA buttons mobile */}
          <div className="md:hidden flex flex-col gap-3 mt-6">
            <Link
              href="/sign-up?produto=aba"
              className="text-center py-3 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Começar grátis
            </Link>
            <a
              href="https://pay.hotmart.com/H104663812P?off=u2t04kz5"
              target="_blank"
              className="text-center py-3 rounded-lg text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: coral }}
            >
              Entrar como Fundador — R$147/mês
            </a>
          </div>

          {/* CTA buttons desktop */}
          <div className="hidden md:flex gap-4 mt-6">
            <Link
              href="/sign-up?produto=aba"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Começar grátis
            </Link>
            <a
              href="https://pay.hotmart.com/H104663812P?off=u2t04kz5"
              target="_blank"
              className="flex-1 text-center py-2.5 rounded-lg text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: coral }}
            >
              Entrar como Fundador
            </a>
            <a
              href="https://pay.hotmart.com/H104663812P?off=iwqieqxc"
              target="_blank"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Clínica 100
            </a>
            <a
              href="https://pay.hotmart.com/H104663812P?off=gona25or"
              target="_blank"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Clínica 250
            </a>
          </div>
        </div>
      </section>

      {/* ────────── FAQ SECTION ────────── */}
      <section className="py-16 px-6 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
            Perguntas frequentes
          </h2>
          <div className="space-y-6">
            {[
              {
                q: 'O plano gratuito tem limitação de funcionalidade?',
                a: 'Não. O motor clínico CSO-ABA é completo em todos os planos. A limitação é de 1 aprendiz e não inclui a camada Operadora Ready.',
              },
              {
                q: 'O que é o Programa Fundadores?',
                a: 'É o preço de lançamento do Clínica 100: R$147/mês em vez de R$247. Quem entra agora mantém esse preço para sempre, mesmo quando novos recursos forem adicionados.',
              },
              {
                q: 'O que é a camada Operadora Ready?',
                a: 'É o conjunto de funcionalidades v2.7.0 para compliance institucional: presença GPS, atestações digitais, bundles de evidência, claim packets para faturamento, perfis de cobertura e dashboard de integridade.',
              },
              {
                q: 'A camada Operadora altera o motor clínico?',
                a: 'Não. A camada é 100% aditiva. O motor CSO-ABA v2.6.1 permanece congelado e intacto. Nenhum dado clínico existente é modificado.',
              },
              {
                q: 'Qual a diferença entre Clínica 100 Founders e Clínica 100?',
                a: 'As funcionalidades são idênticas. A única diferença é o preço: Founders paga R$147/mês (congelado) enquanto o plano regular é R$247/mês. GPS e atestações estão incluídos em ambos.',
              },
              {
                q: 'Quando preciso do Clínica 250?',
                a: 'Quando sua clínica ultrapassar 100 aprendizes ou precisar do dashboard de compliance e perfis de operadora/payer. Também inclui suporte prioritário.',
              },
            ].map((item) => (
              <div key={item.q} className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-2">{item.q}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── CTA FINAL ────────── */}
      <section className="py-16 px-6" style={{ backgroundColor: '#1a1a2e' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Comece com 1 aprendiz real. Sem custo.
          </h2>
          <p className="text-base text-white/60 mb-8">
            Avalie o motor clínico completo na prática antes de decidir.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up?produto=aba"
              className="px-7 py-3.5 rounded-lg text-white text-base font-semibold transition-colors"
              style={{ backgroundColor: coralLight }}
            >
              Começar grátis <ArrowRight className="w-4 h-4 inline ml-1" />
            </Link>
            <Link
              href="/produto/aba"
              className="px-7 py-3.5 rounded-lg border border-white/30 text-white/90 text-base font-medium hover:bg-white/10 transition-colors"
            >
              Ver o sistema por dentro
            </Link>
          </div>
        </div>
      </section>

      {/* ────────── FOOTER ────────── */}
      <footer className="py-8 px-6 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            © 2026 AXIS ABA. Psiform Tecnologia.
          </p>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link href="/produto/aba" className="hover:text-slate-700 transition-colors">Produto</Link>
            <Link href="/termos" className="hover:text-slate-700 transition-colors">Termos</Link>
            <Link href="/privacidade" className="hover:text-slate-700 transition-colors">Privacidade</Link>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400 text-center max-w-3xl mx-auto">
          AXIS ABA é uma infraestrutura clínica de apoio à organização, ao acompanhamento e à documentação profissional.
          Não substitui formação, supervisão ou julgamento clínico.
        </p>
      </footer>
    </div>
  )
}

/* ═══════════════════════ COMPONENTS ═══════════════════════ */

function QuickItem({ text, accent, muted }: { text: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {muted ? (
        <X className="w-4 h-4 text-slate-300 shrink-0" />
      ) : (
        <Check className="w-4 h-4 shrink-0" style={{ color: accent ? coral : '#10b981' }} />
      )}
      <span className={muted ? 'text-slate-400' : 'text-slate-600'}>{text}</span>
    </div>
  )
}
