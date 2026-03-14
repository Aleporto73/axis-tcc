'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

/* ─── Colors ─── */
const navy = '#1e3a5f'
const teal = '#0d7377'

/* ─── JSON-LD ─── */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Psiform Tecnologia',
  url: 'https://axisclinico.com',
  logo: 'https://axisclinico.com/axis.png',
  description:
    'Infraestrutura clínica para saúde mental. Sistemas especializados para TCC, ABA e TDAH com acompanhamento longitudinal, documentação consistente e governança real.',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'contato@psiform.com.br',
    contactType: 'customer service',
    availableLanguage: 'Portuguese',
  },
  foundingDate: '2025',
  knowsAbout: [
    'Terapia Cognitivo-Comportamental',
    'Análise do Comportamento Aplicada',
    'TDAH',
    'Documentação clínica',
    'Gestão de clínicas de saúde mental',
  ],
}

/* ═══════════════════════════════════════════════════════
   HOME INSTITUCIONAL AXIS — 11 BLOCOS (VERSÃO 10/10)
   ═══════════════════════════════════════════════════════ */

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <>
      <SignedIn>
        <RedirectToHub />
      </SignedIn>

      <SignedOut>
        <div className="min-h-screen bg-neutral-50 text-slate-800 overflow-x-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

          {/* ════════════════ BLOCO 1 — MENU ════════════════ */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-50/90 backdrop-blur-md border-b border-slate-200/60">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight" style={{ color: navy }}>AXIS</span>
              </Link>
              <nav className="hidden md:flex items-center gap-8">
                <a href="#produtos" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Produtos</a>
                <a href="#como-funciona" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Como funciona</a>
                <a href="#governanca" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Governança</a>
                <a href="#base-clinica" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Base clínica</a>
                <a href="#contato" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Contato</a>
              </nav>
              <Link
                href="/sign-in"
                className="px-5 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all shadow-lg"
                style={{ backgroundColor: navy }}
              >
                Entrar
              </Link>
            </div>
          </header>

          {/* ════════════════ BLOCO 2 — HERO ════════════════ */}
          <section className="pt-28 pb-16 px-6 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-100/60 to-transparent pointer-events-none" />
            <div className="max-w-5xl mx-auto text-center relative">
              <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <span className="inline-block px-4 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-full mb-8">
                  Psiform Tecnologia
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.1] mb-8">
                  TCC, ABA e TDAH com acompanhamento
                  <br />
                  <span className="font-semibold" style={{ color: navy }}>
                    longitudinal, documentação consistente
                  </span>
                  <br />
                  <span className="font-semibold" style={{ color: navy }}>
                    e governança real
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-slate-600 font-light max-w-3xl mx-auto leading-relaxed mb-10">
                  Sistemas clínicos para organizar o caso ao longo do tempo, acompanhar evolução com mais clareza
                  e sustentar uma prática profissional mais sólida.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <a
                    href="#produtos"
                    className="px-8 py-4 text-white font-medium rounded-xl hover:opacity-90 transition-all shadow-lg"
                    style={{ backgroundColor: navy }}
                  >
                    Conhecer os sistemas
                  </a>
                  <Link
                    href="/sign-up"
                    className="px-8 py-4 bg-white font-medium rounded-xl border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all"
                    style={{ color: navy }}
                  >
                    Começar com 1 caso real
                  </Link>
                </div>
                <div className="mt-10 text-xs text-slate-500 tracking-wide">
                  Acompanhamento contínuo &bull; Histórico preservado &bull; Julgamento humano
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════ BLOCO 3 — ABERTURA ════════════════ */}
          <section id="como-funciona" className="py-16 px-6 bg-white border-t border-slate-200">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-light mb-6">
                Cada atendimento importa.{' '}
                <span className="font-semibold" style={{ color: navy }}>O que vem depois dele também.</span>
              </h2>
              <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed mb-4">
                O desafio não é apenas registrar uma sessão. É acompanhar o caso com continuidade,
                enxergar evolução com clareza e manter documentação que faça sentido ao longo do tempo.
              </p>
              <p className="text-lg font-medium" style={{ color: navy }}>
                O AXIS nasce para isso.
              </p>
            </div>
          </section>

          {/* ════════════════ BLOCO 4 — PRODUTOS ════════════════ */}
          <section id="produtos" className="py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-light mb-4">
                  Três sistemas. <span className="font-semibold" style={{ color: navy }}>Uma arquitetura clínica.</span>
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* ── TCC ── */}
                <div className="group bg-white rounded-2xl p-8 border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300">
                  <div className="h-1 w-full rounded-full mb-6" style={{ backgroundColor: navy }} />
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full mb-4" style={{ backgroundColor: navy + '0D', color: navy }}>
                    Para psicólogos clínicos
                  </span>
                  <h3 className="text-xl font-semibold mb-3" style={{ color: navy }}>AXIS TCC</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Registro estruturado, organização do processo terapêutico e acompanhamento longitudinal
                    para Terapia Cognitivo-Comportamental.
                  </p>
                  <ul className="space-y-2 mb-8 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navy }} />Sessões com estrutura real</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navy }} />Evolução clínica visível</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navy }} />Relatórios com histórico preservado</li>
                  </ul>
                  <div className="flex flex-col gap-2">
                    <Link href="/produto/tcc" className="w-full text-center px-4 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all" style={{ backgroundColor: navy }}>
                      Conhecer
                    </Link>
                    <Link href="/sign-up" className="w-full text-center px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-all" style={{ color: navy }}>
                      Começar com 1 caso real
                    </Link>
                  </div>
                </div>

                {/* ── ABA ── */}
                <div className="group bg-white rounded-2xl p-8 border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300">
                  <div className="h-1 w-full rounded-full mb-6" style={{ backgroundColor: navy }} />
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full mb-4" style={{ backgroundColor: navy + '0D', color: navy }}>
                    Para clínicas e equipes
                  </span>
                  <h3 className="text-xl font-semibold mb-3" style={{ color: navy }}>AXIS ABA</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Organização protocolar, acompanhamento evolutivo e documentação consistente
                    para Análise do Comportamento Aplicada.
                  </p>
                  <ul className="space-y-2 mb-8 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navy }} />Ciclo clínico organizado</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navy }} />Progressão documentada ao longo do tempo</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navy }} />Estrutura para prática, gestão e defesa técnica</li>
                  </ul>
                  <div className="flex flex-col gap-2">
                    <Link href="/produto/aba" className="w-full text-center px-4 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all" style={{ backgroundColor: navy }}>
                      Conhecer
                    </Link>
                    <Link href="/sign-up" className="w-full text-center px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-all" style={{ color: navy }}>
                      Começar com 1 caso real
                    </Link>
                  </div>
                </div>

                {/* ── TDAH ── */}
                <div className="group bg-white rounded-2xl p-8 border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300">
                  <div className="h-1 w-full rounded-full mb-6" style={{ backgroundColor: teal }} />
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full mb-4" style={{ backgroundColor: teal + '0D', color: teal }}>
                    Para clínica, escola e família
                  </span>
                  <h3 className="text-xl font-semibold mb-3" style={{ color: teal }}>AXIS TDAH</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Sistema tricontextual integrando consultório, escola e rotina familiar
                    em um acompanhamento contínuo e utilizável.
                  </p>
                  <ul className="space-y-2 mb-8 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: teal }} />Três contextos no mesmo eixo clínico</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: teal }} />Monitoramento funcional ao longo do tempo</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: teal }} />Organização real de casos que não cabem só no consultório</li>
                  </ul>
                  <div className="flex flex-col gap-2">
                    <Link href="/produto/tdah" className="w-full text-center px-4 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all" style={{ backgroundColor: teal }}>
                      Conhecer
                    </Link>
                    <Link href="/sign-up" className="w-full text-center px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-all" style={{ color: teal }}>
                      Começar com 1 caso real
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════ BLOCO 5 — DIFERENÇA ════════════════ */}
          <section className="py-16 px-6 bg-white border-t border-slate-200">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-light mb-6 text-center">
                O valor está na <span className="font-semibold" style={{ color: navy }}>continuidade</span>, não na tela.
              </h2>
              <p className="text-lg text-slate-600 text-center max-w-3xl mx-auto leading-relaxed mb-8">
                O AXIS não foi pensado para ser apenas um lugar onde o profissional guarda informações.
                Ele foi pensado para ajudar a:
              </p>
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {[
                  'Conectar o que aconteceu antes com o que vem depois',
                  'Reduzir perda de informação importante',
                  'Dar consistência à documentação clínica',
                  'Apoiar uma prática séria por dentro, não só bonita por fora',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: navy }} />
                    <p className="text-sm text-slate-700 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════ BLOCO 6 — ARQUITETURA + GOVERNANÇA ════════════════ */}
          <section id="governanca" className="py-16 px-6 bg-slate-50 border-t border-slate-200">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-light mb-4">
                  Uma arquitetura comum.{' '}
                  <span className="font-semibold" style={{ color: navy }}>Governança que sustenta.</span>
                </h2>
                <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
                  Os sistemas AXIS compartilham a mesma lógica de base: organização estruturada,
                  acompanhamento longitudinal, histórico preservado, rastreabilidade e julgamento humano no centro.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { title: 'Histórico preservado', desc: 'O passado clínico continua acessível, organizado e confiável.' },
                  { title: 'Rastreabilidade', desc: 'Mudanças e registros relevantes permanecem claros ao longo do uso.' },
                  { title: 'Organização consistente', desc: 'Os dados deixam de ficar espalhados entre anotações, memórias e documentos soltos.' },
                  { title: 'Estrutura profissional', desc: 'A documentação ganha consistência para a rotina clínica e para contextos institucionais.' },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 p-8">
                    <h3 className="text-lg font-semibold mb-3" style={{ color: navy }}>{item.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 text-center space-y-2">
                <p className="text-sm text-slate-500">
                  Cada produto mantém sua identidade. A base de confiança permanece comum.
                </p>
                <p className="text-sm font-medium" style={{ color: navy }}>
                  O sistema organiza e acompanha. A responsabilidade clínica continua sendo do profissional.
                </p>
              </div>
            </div>
          </section>

          {/* ════════════════ BLOCO 7 — BASE CLÍNICA ════════════════ */}
          <section id="base-clinica" className="py-16 px-6 bg-white border-t border-slate-200">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-light mb-4">
                  Base clínica <span className="font-semibold" style={{ color: navy }}>aplicada</span>
                </h2>
                <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
                  A arquitetura do AXIS foi desenhada para sustentar prática clínica real,
                  com foco em continuidade, organização do caso e documentação útil ao longo do tempo.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-10">
                {[
                  { area: 'No TCC', desc: 'Ajuda a organizar sessões, evidências clínicas e evolução do processo terapêutico.', color: navy },
                  { area: 'Na ABA', desc: 'Ajuda a acompanhar protocolos, progresso e histórico clínico com mais consistência.', color: navy },
                  { area: 'No TDAH', desc: 'Ajuda a integrar contextos que normalmente ficam separados: clínica, escola e rotina familiar.', color: teal },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 rounded-2xl border border-slate-200 p-8">
                    <h3 className="text-lg font-semibold mb-3" style={{ color: item.color }}>{item.area}</h3>
                    <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              <p className="text-center text-base text-slate-700">
                Em todos os casos, a lógica é a mesma:{' '}
                <span className="font-semibold" style={{ color: navy }}>
                  acompanhar melhor, documentar melhor e trabalhar com mais clareza.
                </span>
              </p>
            </div>
          </section>

          {/* ════════════════ BLOCO 8 — FILOSOFIA ════════════════ */}
          <section className="py-16 px-6 text-white relative overflow-hidden" style={{ backgroundColor: navy }}>
            <div className="absolute inset-0 opacity-5">
              <div
                className="absolute inset-0"
                style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
              />
            </div>
            <div className="max-w-4xl mx-auto text-center relative">
              <h2 className="text-3xl md:text-4xl font-light mb-12">
                Filosofia <span className="font-semibold">AXIS</span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-8 text-left mb-12">
                {[
                  { title: 'Estrutura antes de improviso', desc: 'Casos complexos precisam de continuidade, não de remendos.' },
                  { title: 'Clareza antes de excesso', desc: 'O sistema deve ajudar o profissional a enxergar melhor, não criar mais ruído.' },
                  { title: 'Tecnologia a serviço da prática', desc: 'O papel do software é sustentar o trabalho clínico, não competir com ele.' },
                  { title: 'Responsabilidade antes de discurso', desc: 'Em saúde mental, confiança vem de consistência.' },
                ].map((item, i) => (
                  <div key={i} className="p-6 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="text-white/70 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════ BLOCO 9 — ENTRADA ════════════════ */}
          <section className="py-16 px-6 bg-neutral-50 border-t border-slate-200">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-light mb-6">
                Entre pela <span className="font-semibold" style={{ color: navy }}>prática</span>, não pela promessa
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-3">
                Você pode começar com <strong>1 caso real</strong> e entender como a estrutura funciona no uso concreto.
              </p>
              <p className="text-sm text-slate-500 mb-10">
                Sem cartão. Sem pressão. Sem precisar mudar sua prática de uma vez.
              </p>
              <Link
                href="/sign-up"
                className="inline-block px-8 py-4 text-white font-medium rounded-xl hover:opacity-90 transition-all shadow-lg"
                style={{ backgroundColor: navy }}
              >
                Começar com 1 caso real →
              </Link>
            </div>
          </section>

          {/* ════════════════ BLOCO 10 — CTA FINAL ════════════════ */}
          <section className="py-16 px-6 bg-white border-t border-slate-200">
            <div className="max-w-5xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-light mb-12">
                Conheça o sistema certo <span className="font-semibold" style={{ color: navy }}>para a sua prática</span>
              </h2>

              <div className="grid md:grid-cols-3 gap-6 mb-10">
                <div className="p-6 rounded-2xl border border-slate-200 text-left">
                  <h3 className="text-lg font-semibold mb-2" style={{ color: navy }}>AXIS TCC</h3>
                  <p className="text-sm text-slate-600 mb-6">Para psicólogos que precisam acompanhar o processo terapêutico com mais clareza.</p>
                  <Link href="/produto/tcc" className="inline-block px-5 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all" style={{ backgroundColor: navy }}>
                    Conhecer AXIS TCC
                  </Link>
                </div>
                <div className="p-6 rounded-2xl border border-slate-200 text-left">
                  <h3 className="text-lg font-semibold mb-2" style={{ color: navy }}>AXIS ABA</h3>
                  <p className="text-sm text-slate-600 mb-6">Para equipes que precisam de continuidade clínica e documentação consistente.</p>
                  <Link href="/produto/aba" className="inline-block px-5 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all" style={{ backgroundColor: navy }}>
                    Conhecer AXIS ABA
                  </Link>
                </div>
                <div className="p-6 rounded-2xl border border-slate-200 text-left">
                  <h3 className="text-lg font-semibold mb-2" style={{ color: teal }}>AXIS TDAH</h3>
                  <p className="text-sm text-slate-600 mb-6">Para casos que exigem integração entre clínica, escola e família.</p>
                  <Link href="/produto/tdah" className="inline-block px-5 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all" style={{ backgroundColor: teal }}>
                    Conhecer AXIS TDAH
                  </Link>
                </div>
              </div>

              <p className="text-sm text-slate-500 mb-3">Ou:</p>
              <Link
                href="/sign-up"
                className="inline-block px-8 py-4 text-white font-medium rounded-xl hover:opacity-90 transition-all shadow-lg"
                style={{ backgroundColor: navy }}
              >
                Começar com 1 caso real →
              </Link>
            </div>
          </section>

          {/* ════════════════ BLOCO 11 — RODAPÉ ════════════════ */}
          <footer id="contato" className="py-12 px-6 text-white" style={{ backgroundColor: navy }}>
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Psiform Tecnologia</h3>
                  <p className="text-white/60 text-sm">Infraestrutura clínica para saúde mental</p>
                  <a href="mailto:contato@psiform.com.br" className="text-sm text-white/50 hover:text-white/80 transition-colors mt-2 inline-block">
                    contato@psiform.com.br
                  </a>
                </div>
                <div className="flex gap-6 text-sm text-white/50">
                  <Link href="/produto/tcc" className="hover:text-white/80 transition-colors">AXIS TCC</Link>
                  <Link href="/produto/aba" className="hover:text-white/80 transition-colors">AXIS ABA</Link>
                  <Link href="/produto/tdah" className="hover:text-white/80 transition-colors">AXIS TDAH</Link>
                </div>
              </div>
              <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <span className="text-sm text-white/40">© 2026 AXIS. Psiform Tecnologia.</span>
                <p className="text-xs text-white/30 text-center md:text-right max-w-lg">
                  AXIS é uma infraestrutura clínica de apoio à organização, ao acompanhamento e à documentação profissional.
                  Não substitui formação, supervisão ou julgamento clínico.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </SignedOut>
    </>
  )
}

function RedirectToHub() {
  const router = useRouter()
  useEffect(() => { router.replace('/hub') }, [router])
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mx-auto mb-4" />
        <p className="text-base text-slate-500">Carregando...</p>
      </div>
    </div>
  )
}
