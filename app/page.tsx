'use client'
import Image from 'next/image'
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
    <div className="min-h-screen bg-[#fafafa] text-[#1a1f4e] overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#fafafa]/90 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/axis.png"
              alt="AXIS - Plataforma clínica para profissionais de saúde mental"
              width={100}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#produtos" className="text-sm font-medium text-slate-600 hover:text-[#1a1f4e] transition-colors">
              Produtos
            </Link>
            <Link href="#sobre" className="text-sm font-medium text-slate-600 hover:text-[#1a1f4e] transition-colors">
              Sobre
            </Link>
            <Link href="#contato" className="text-sm font-medium text-slate-600 hover:text-[#1a1f4e] transition-colors">
              Contato
            </Link>
          </nav>
          <Link
            href="/sign-in"
            className="px-5 py-2.5 bg-[#1a1f4e] text-white text-sm font-medium rounded-lg hover:bg-[#2a2f5e] transition-all duration-300 shadow-lg shadow-[#1a1f4e]/20"
          >
            Entrar
          </Link>
        </div>
      </header>
      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-100/50 to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative">
          <div
            className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <span className="inline-block px-4 py-2 bg-[#1a1f4e]/5 text-[#1a1f4e] text-sm font-medium rounded-full mb-8">
              Psiform Tecnologia
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.1] mb-8">
              Estrutura clínica para
              <br />
              <span className="font-semibold bg-gradient-to-r from-[#1a1f4e] to-[#4a4f7e] bg-clip-text text-transparent">
                profissionais de saúde mental
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 font-light max-w-3xl mx-auto leading-relaxed mb-12">
              Organização, governança e documentação estruturada para sua prática.
              O julgamento clínico permanece humano. A estrutura permanece sistêmica.
            </p>
          </div>
          <div
            className={`transition-all duration-1000 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <span className="text-xs tracking-widest uppercase">Conheça nossos produtos</span>
              <div className="w-px h-12 bg-gradient-to-b from-slate-300 to-transparent animate-pulse" />
            </div>
          </div>
        </div>
      </section>
      {/* Products Section */}
      <section id="produtos" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-light mb-4">
              Dois sistemas. <span className="font-semibold">Uma filosofia.</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Cada especialidade exige estrutura própria. Desenvolvemos soluções específicas para TCC e ABA.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* AXIS TCC Card */}
            <Link
              href="/produto/tcc"
              className="group relative bg-white rounded-2xl p-8 md:p-10 border border-slate-200 hover:border-[#9a9ab8] transition-all duration-500 hover:shadow-2xl hover:shadow-[#1a1f4e]/10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1a1f4e] to-[#9a9ab8] transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

              <div className="flex flex-col h-full">
                <Image
                  src="/axistcc.png"
                  alt="AXIS TCC - Sistema para Terapia Cognitivo-Comportamental"
                  width={140}
                  height={40}
                  className="h-10 w-auto mb-8"
                />

                <h3 className="text-2xl font-semibold mb-4 text-[#1a1f4e]">
                  Terapia Cognitivo-Comportamental
                </h3>

                <p className="text-slate-600 mb-8 flex-grow">
                  Registro estruturado de sessões, conceitualização cognitiva,
                  monitoramento evolutivo via Motor CSO-TCC e documentação com padrão institucional.
                </p>
                <ul className="space-y-3 mb-8 text-sm text-slate-600">
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9a9ab8]" />
                    Transcrição de sessões por áudio (Whisper)
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9a9ab8]" />
                    Análise TCC automática
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9a9ab8]" />
                    Relatórios institucionais auditáveis
                  </li>
                </ul>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Para psicólogos</span>
                  <span className="inline-flex items-center gap-2 text-[#1a1f4e] font-medium group-hover:gap-3 transition-all">
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
              className="group relative bg-white rounded-2xl p-8 md:p-10 border border-slate-200 hover:border-[#c4785a] transition-all duration-500 hover:shadow-2xl hover:shadow-[#c4785a]/10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1a1f4e] to-[#c4785a] transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

              <div className="flex flex-col h-full">
                <Image
                  src="/axisaba.png"
                  alt="AXIS ABA - Sistema para Análise do Comportamento Aplicada"
                  width={140}
                  height={40}
                  className="h-10 w-auto mb-8"
                />

                <h3 className="text-2xl font-semibold mb-4 text-[#1a1f4e]">
                  Análise do Comportamento Aplicada
                </h3>

                <p className="text-slate-600 mb-8 flex-grow">
                  Gestão de protocolos, registro de trials estruturado,
                  Motor CSO-ABA multidimensional e documentação para defesa técnica.
                </p>
                <ul className="space-y-3 mb-8 text-sm text-slate-600">
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c4785a]" />
                    Ciclo completo: Aquisição → Generalização → Manutenção
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c4785a]" />
                    Generalização 3×2 e Manutenção 2-6-12
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c4785a]" />
                    Portal Família integrado
                  </li>
                </ul>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Para clínicas ABA</span>
                  <span className="inline-flex items-center gap-2 text-[#1a1f4e] font-medium group-hover:gap-3 transition-all">
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
      {/* Philosophy Section */}
      <section id="sobre" className="py-24 px-6 bg-[#1a1f4e] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-light mb-12">
            Nossa <span className="font-semibold">filosofia</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">Integridade documental</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Registros imutáveis com SHA256. Histórico clínico preservado. Auditoria garantida.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">LGPD aplicada</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Consentimento explícito, portabilidade de dados e direito ao esquecimento.
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
              &ldquo;Não fazemos diagnóstico. Não prescrevemos intervenções.
              Não substituímos o julgamento clínico.
              <span className="font-semibold text-white"> Estruturamos o que você já faz.&rdquo;</span>
            </p>
          </div>
        </div>
      </section>
      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-light mb-6">
            Comece com <span className="font-semibold">1 paciente real</span>
          </h2>
          <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
            Avalie o padrão documental na prática. Sem custo. Sem cartão. Sem prazo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/produto/tcc"
              className="px-8 py-4 bg-[#1a1f4e] text-white font-medium rounded-xl hover:bg-[#2a2f5e] transition-all duration-300 shadow-lg shadow-[#1a1f4e]/20 flex items-center gap-3"
            >
              <Image src="/axistcc.png" alt="TCC" width={80} height={24} className="h-5 w-auto brightness-0 invert" />
              <span>Experimentar TCC</span>
            </Link>
            <Link
              href="/produto/aba"
              className="px-8 py-4 bg-white text-[#1a1f4e] font-medium rounded-xl border-2 border-[#1a1f4e] hover:bg-[#1a1f4e] hover:text-white transition-all duration-300 flex items-center gap-3"
            >
              <Image src="/axisaba.png" alt="ABA" width={80} height={24} className="h-5 w-auto" />
              <span>Experimentar ABA</span>
            </Link>
          </div>
        </div>
      </section>
      {/* Contact Section */}
      <section id="contato" className="py-16 px-6 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-lg font-semibold mb-4 text-[#1a1f4e]">Psiform Tecnologia</h3>
          <p className="text-slate-600 mb-6">
            Desenvolvimento de soluções para saúde mental
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
            <a href="mailto:contato@psiform.com.br" className="hover:text-[#1a1f4e] transition-colors">
              contato@psiform.com.br
            </a>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="py-8 px-6 bg-[#1a1f4e] text-white/60">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image
              src="/axis.png"
              alt="AXIS"
              width={80}
              height={24}
              className="h-6 w-auto brightness-0 invert opacity-60"
            />
            <span className="text-sm">© 2026 AXIS. Psiform Tecnologia.</span>
          </div>
          <p className="text-xs text-center md:text-right max-w-md">
            Este sistema é uma ferramenta de apoio e organização.
            Não substitui o julgamento clínico do profissional.
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
