'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Psiform Tecnologia',
  url: 'https://axisclinico.com',
  logo: 'https://axisclinico.com/axis.png',
  description:
    'Desenvolvimento de soluções tecnológicas para profissionais de saúde mental. Sistemas clínicos para TCC e ABA.',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'contato@psiform.com.br',
    contactType: 'customer service',
    availableLanguage: 'Portuguese',
  },
  sameAs: [],
  foundingDate: '2025',
  knowsAbout: [
    'Terapia Cognitivo-Comportamental',
    'Análise do Comportamento Aplicada',
    'Documentação clínica',
    'Gestão de clínicas de saúde mental',
  ],
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return (
    <>
      <SignedIn>
        <RedirectToHub />
      </SignedIn>

      <SignedOut>
    <div className="min-h-screen bg-neutral-50 text-tcc-700 overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-50/90 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-tcc-700 tracking-tight">AXIS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#produtos" className="text-sm font-medium text-slate-600 hover:text-tcc-700 transition-colors">
              Produtos
            </Link>
            <Link href="#governanca" className="text-sm font-medium text-slate-600 hover:text-tcc-700 transition-colors">
              Governança
            </Link>
            <Link href="#base" className="text-sm font-medium text-slate-600 hover:text-tcc-700 transition-colors">
              Base científica
            </Link>
            <Link href="#contato" className="text-sm font-medium text-slate-600 hover:text-tcc-700 transition-colors">
              Contato
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="px-5 py-2.5 bg-tcc-700 text-white text-sm font-medium rounded-lg hover:bg-tcc-600 transition-all duration-300 shadow-lg shadow-tcc-700/20"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-100/60 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative">
          <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="inline-block px-4 py-2 bg-tcc-700/5 text-tcc-700 text-sm font-medium rounded-full mb-8">
              Psiform Tecnologia
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.08] mb-8">
              Infraestrutura clínica
              <br />
              <span className="font-semibold bg-gradient-to-r from-tcc-700 to-tcc-500 bg-clip-text text-transparent">
                para práticas estruturadas
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 font-light max-w-3xl mx-auto leading-relaxed mb-10">
              Sistemas especializados para documentação, cálculo evolutivo e governança
              em Terapia Cognitivo-Comportamental e Análise do Comportamento Aplicada.
              O julgamento clínico permanece humano.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="#produtos"
                className="px-8 py-4 bg-tcc-700 text-white font-medium rounded-xl hover:bg-tcc-600 transition-all duration-300 shadow-lg shadow-tcc-700/20"
              >
                Conhecer sistemas
              </Link>
              <Link
                href="#governanca"
                className="px-8 py-4 bg-white text-tcc-700 font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-300"
              >
                Ver governança
              </Link>
            </div>
            <div className="mt-10 text-xs text-slate-500 tracking-wide">
              Documentação estruturada • Rastreamento longitudinal • Integridade preservada
            </div>
          </div>
        </div>
      </section>
      {/* Products Section */}
      <section id="produtos" className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-light mb-4">
              Dois sistemas. <span className="font-semibold">Uma filosofia.</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Cada especialidade exige estrutura própria. AXIS entrega documentação e governança com padrão institucional.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* AXIS TCC Card */}
            <Link
              href="/produto/tcc"
              className="group relative bg-white rounded-2xl p-10 md:p-12 border border-slate-200/80 shadow-md shadow-slate-200/50 hover:border-tcc-300 hover:shadow-2xl hover:shadow-tcc-700/12 hover:scale-[1.02] transition-all duration-500 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tcc-700 to-tcc-300 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              <div className="flex flex-col h-full">
                <img src="/logo-axis-tcc.jpg" alt="AXIS TCC" className="h-16 object-contain object-left mb-6" />
                <span className="inline-block self-start px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full bg-tcc-700/5 text-tcc-700 mb-6">
                  Para psicólogos
                </span>
                <h3 className="text-2xl font-semibold mb-4 text-tcc-700">
                  Terapia Cognitivo-Comportamental
                </h3>
                <p className="text-slate-600 mb-8 flex-grow leading-relaxed">
                  Sistema estruturado para organização documental em TCC, com separação formal entre
                  cálculo automatizado e registro profissional, e acompanhamento longitudinal com padrão institucional.
                </p>
                <ul className="space-y-3 mb-8 text-sm text-slate-600">
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-tcc-300" />
                    Transcrição integrada ao fluxo clínico
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-tcc-300" />
                    Indicadores evolutivos descritivos (não diagnósticos)
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-tcc-300" />
                    Relatórios institucionais com histórico preservado
                  </li>
                </ul>
                <div className="flex items-center justify-end">
                  <span className="inline-flex items-center gap-2 text-tcc-700 font-medium group-hover:gap-3 transition-all">
                    Conhecer
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
            {/* AXIS ABA Card */}
            <Link
              href="/produto/aba"
              className="group relative bg-white rounded-2xl p-10 md:p-12 border border-slate-200/80 shadow-md shadow-slate-200/50 hover:border-aba-500 hover:shadow-2xl hover:shadow-aba-500/12 hover:scale-[1.02] transition-all duration-500 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tcc-700 to-aba-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              <div className="flex flex-col h-full">
                <img src="/logo-axis-aba.jpg" alt="AXIS ABA" className="h-16 object-contain object-left mb-6" />
                <span className="inline-block self-start px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full bg-aba-500/10 text-aba-500 mb-6">
                  Para clínicas
                </span>
                <h3 className="text-2xl font-semibold mb-4 text-tcc-700">
                  Análise do Comportamento Aplicada
                </h3>
                <p className="text-slate-600 mb-8 flex-grow leading-relaxed">
                  Governança clínica para ABA com motor multidimensional, ciclo protocolar validado e documentação
                  compatível com auditoria e convênios brasileiros.
                </p>
                <ul className="space-y-3 mb-8 text-sm text-slate-600">
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-aba-500" />
                    Ciclo protocolar completo e versionado
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-aba-500" />
                    Generalização 3×2 e Manutenção 2-6-12
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-aba-500" />
                    Snapshot imutável com engine lock
                  </li>
                </ul>
                <div className="flex items-center justify-end">
                  <span className="inline-flex items-center gap-2 text-tcc-700 font-medium group-hover:gap-3 transition-all">
                    Conhecer
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
      {/* Architecture & Governance */}
      <section id="governanca" className="py-16 px-6 bg-slate-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-light mb-6">
            Arquitetura e <span className="font-semibold">Governança Clínica</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed mb-14">
            AXIS foi desenhado para estabilidade documental, rastreabilidade e separação formal entre
            dado estruturado e registro profissional.
          </p>
          <div className="grid md:grid-cols-2 gap-10 text-left">
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-semibold mb-3 text-tcc-700">Versionamento metodológico</h3>
              <p className="text-slate-600 leading-relaxed">
                Cada cálculo é vinculado a uma versão formal do motor. Dados históricos não são reprocessados retroativamente.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-semibold mb-3 text-tcc-700">Snapshot imutável</h3>
              <p className="text-slate-600 leading-relaxed">
                Sessões finalizadas tornam-se registros append-only. O passado clínico não pode ser sobrescrito.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-semibold mb-3 text-tcc-700">Trilha de auditoria</h3>
              <p className="text-slate-600 leading-relaxed">
                Ações relevantes possuem rastreabilidade e trilha de alterações. Estrutura desenhada para governança organizacional.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-semibold mb-3 text-tcc-700">LGPD aplicada</h3>
              <p className="text-slate-600 leading-relaxed">
                Separação formal entre Operador e Controlador, retenção definida e consentimento explícito versionado.
              </p>
            </div>
          </div>
          <div className="mt-14 text-center">
            <p className="text-sm text-slate-500">
              O sistema organiza e calcula indicadores. Não interpreta, não diagnostica, não decide.
            </p>
          </div>
        </div>
      </section>
      {/* Scientific & Normative Base */}
      <section id="base" className="py-16 px-6 bg-white border-t border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-light mb-6">
              Base científica e <span className="font-semibold">normativa</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
              A arquitetura dos sistemas AXIS é fundamentada em práticas baseadas em evidência e estruturada para
              compatibilidade com diretrizes nacionais e internacionais.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-10">
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-semibold mb-4 text-tcc-700">Fundamentação científica</h3>
              <ul className="space-y-3 text-sm text-slate-700 leading-relaxed">
                <li>• FPG/UNC — Práticas Baseadas em Evidência (ABA)</li>
                <li>• Diretrizes SBNI — Brasil</li>
                <li>• BACB Ethics Code (2020)</li>
                <li>• RBT Ethics Code 2.0</li>
              </ul>
            </div>
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-semibold mb-4 text-tcc-700">Compatibilidade regulatória</h3>
              <ul className="space-y-3 text-sm text-slate-700 leading-relaxed">
                <li>• LGPD aplicada com separação Operador / Controlador</li>
                <li>• Estrutura documental compatível com auditoria</li>
                <li>• Versionamento metodológico formal (engine lock)</li>
                <li>• Histórico preservado e rastreabilidade</li>
              </ul>
            </div>
          </div>
          <div className="mt-16 text-center border-t border-slate-200 pt-12">
            <p className="text-base text-slate-600 max-w-3xl mx-auto leading-relaxed">
              AXIS não substitui formação, supervisão ou julgamento clínico. Ele estrutura documentação e organiza dados
              para suportar práticas responsáveis e rastreáveis.
            </p>
          </div>
        </div>
      </section>
      {/* Philosophy Section */}
      <section className="py-16 px-6 bg-tcc-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-light mb-10">
            Filosofia <span className="font-semibold">AXIS</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mb-14">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">Estabilidade documental</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Registros preservados, rastreáveis e consistentes ao longo do tempo.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">Privacidade aplicada</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Governança de dados, controle de acesso e princípios compatíveis com LGPD.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">Julgamento humano</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                O sistema organiza. A responsabilidade clínica permanece do profissional.
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-12">
            <p className="text-xl md:text-2xl font-light leading-relaxed text-white/90 max-w-3xl mx-auto">
              Sistemas clínicos devem ser estáveis. Dados devem ser rastreáveis. Decisões continuam sendo humanas.
            </p>
          </div>
        </div>
      </section>
      {/* CTA Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-light mb-6">
            Avalie a estrutura na prática
          </h2>
          <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
            Utilize o sistema com um caso real e analise o padrão documental antes de qualquer decisão.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/produto/tcc"
              className="px-8 py-4 bg-tcc-700 text-white font-medium rounded-xl hover:bg-tcc-600 transition-all duration-300 shadow-lg shadow-tcc-700/20"
            >
              Experimentar TCC
            </Link>
            <Link
              href="/produto/aba"
              className="px-8 py-4 bg-white text-tcc-700 font-medium rounded-xl border-2 border-tcc-700 hover:bg-tcc-700 hover:text-white transition-all duration-300"
            >
              Experimentar ABA
            </Link>
          </div>
        </div>
      </section>
      {/* Contact Section */}
      <section id="contato" className="py-16 px-6 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-lg font-semibold mb-3 text-tcc-700">Psiform Tecnologia</h3>
          <p className="text-slate-600 mb-6">Desenvolvimento de soluções para saúde mental</p>
          <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
            <a href="mailto:contato@psiform.com.br" className="hover:text-tcc-700 transition-colors">
              contato@psiform.com.br
            </a>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="py-8 px-6 bg-tcc-700 text-white/60">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm">© 2026 AXIS. Psiform Tecnologia.</span>
          <p className="text-xs text-center md:text-right max-w-md">
            Este sistema é uma ferramenta de apoio e organização. Não substitui o julgamento clínico do profissional.
          </p>
        </div>
      </footer>
    </div>
      </SignedOut>
    </>
  )
}

function RedirectToHub() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/hub')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mx-auto mb-4" aria-label="Carregando"></div>
        <p className="text-base text-slate-500">Carregando...</p>
      </div>
    </div>
  )
}
