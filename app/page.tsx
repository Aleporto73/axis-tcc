'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { HelpTip } from '@/components/Tooltip'

/* ─── Colors ─── */
const navy = '#1e3a5f'
const teal = '#0d7377'
const aba = '#C46A2F'

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
                <a href="#operadora" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Operadora Ready</a>
                <a href="#como-funciona" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Como funciona</a>
                <a href="#governanca" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Governança</a>
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
          <section className="pt-32 pb-20 px-6 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-100/60 to-transparent pointer-events-none" />
            <div className="max-w-5xl mx-auto text-center relative">
              <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <span className="inline-block px-4 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-full mb-10">
                  Psiform Tecnologia
                </span>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.15] mb-6">
                  TCC, ABA e TDAH
                </h1>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.15] mb-10" style={{ color: navy }}>
                  com acompanhamento longitudinal,
                  <br />
                  documentação consistente e governança real
                </h1>

                <p className="text-lg md:text-xl text-slate-600 font-light max-w-2xl mx-auto leading-[1.8] mb-12">
                  Sistemas clínicos para organizar o caso ao longo do tempo,
                  acompanhar evolução com mais clareza
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

                <div className="mt-12 text-xs text-slate-500 tracking-wide">
                  Acompanhamento contínuo &bull; Histórico preservado &bull; Julgamento humano
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════ BLOCO 3 — ABERTURA ════════════════ */}
          <section id="como-funciona" className="py-20 px-6 bg-white border-t border-slate-200">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-light leading-snug mb-8">
                Cada atendimento importa.
                <br />
                <span className="font-semibold" style={{ color: navy }}>O que vem depois dele também.</span>
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-[1.8] mb-6">
                O desafio não é apenas registrar uma sessão.
                É acompanhar o caso com continuidade, enxergar evolução com clareza
                e manter documentação que faça sentido ao longo do tempo.
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
                  <img src="/axistcc.png" alt="AXIS TCC" className="h-14 w-auto mb-6 object-contain" />
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full mb-4" style={{ backgroundColor: navy + '0D', color: navy }}>
                    Para psicólogos clínicos
                  </span>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Organização do processo terapêutico com registro estruturado e acompanhamento longitudinal.
                  </p>
                  <ul className="space-y-2 mb-8 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navy }} />Sessões com estrutura real</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navy }} />Evolução clínica visível</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navy }} />Histórico preservado</li>
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
                <div className="group bg-white rounded-2xl p-8 border-2 hover:shadow-lg transition-all duration-300 relative" style={{ borderColor: aba + '40' }}>
                  <div className="h-1 w-full rounded-full mb-6" style={{ backgroundColor: aba }} />
                  <div className="flex items-center gap-3 mb-6">
                    <img src="/axisaba.png" alt="AXIS ABA" className="h-14 w-auto object-contain" />
                    <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded" style={{ backgroundColor: aba + '18', color: aba }}>
                      Operadora Ready
                    </span>
                  </div>
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full mb-4" style={{ backgroundColor: aba + '0D', color: aba }}>
                    Para clínicas e operadoras
                  </span>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Motor clínico completo + camada institucional para conformidade, reembolso e auditoria com operadoras de saúde.
                  </p>
                  <ul className="space-y-2 mb-8 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: aba }} />Presença comprovada por localização</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: aba }} />Assinatura digital do terapeuta e responsável</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: aba }} />Documentação pronta para auditoria</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: aba }} />Conformidade automática da equipe</li>
                  </ul>
                  <div className="flex flex-col gap-2">
                    <Link href="/produto/aba" className="w-full text-center px-4 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all" style={{ backgroundColor: aba }}>
                      Conhecer
                    </Link>
                    <Link href="/sign-up" className="w-full text-center px-4 py-2.5 text-sm font-medium rounded-lg border hover:bg-slate-50 transition-all" style={{ color: aba, borderColor: aba + '40' }}>
                      Começar com 1 caso real
                    </Link>
                  </div>
                </div>

                {/* ── TDAH ── */}
                <div className="group bg-white rounded-2xl p-8 border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300">
                  <div className="h-1 w-full rounded-full mb-6" style={{ backgroundColor: teal }} />
                  <img src="/axistdah.png" alt="AXIS TDAH" className="h-14 w-auto mb-6 object-contain" />
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full mb-4" style={{ backgroundColor: teal + '0D', color: teal }}>
                    Para clínica, escola e família
                  </span>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Integração entre consultório, escola e rotina familiar com acompanhamento tricontextual e documentação unificada.
                  </p>
                  <ul className="space-y-2 mb-8 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: teal }} />Clínica, escola e casa integrados</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: teal }} />Monitoramento funcional contínuo</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: teal }} />Casos além do consultório</li>
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

          {/* ════════════════ BLOCO 4B — OPERADORA READY (ABA v2.7.0) ════════════════ */}
          <section id="operadora" className="py-20 px-6 relative overflow-hidden" style={{ backgroundColor: '#1a1a2e' }}>
            <div className="absolute inset-0 opacity-[0.03]">
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
            </div>
            <div className="max-w-6xl mx-auto relative">
              <div className="text-center mb-14">
                <span className="inline-block px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-full mb-6" style={{ backgroundColor: aba + '20', color: aba }}>
                  Novo — AXIS ABA v2.7.0
                </span>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-white leading-snug mb-4">
                  Pronto para <span className="font-semibold" style={{ color: aba }}>operadoras</span>.
                  <br />
                  Pronto para auditoria.
                </h2>
                <p className="text-lg text-white/60 max-w-2xl mx-auto leading-[1.8]">
                  O AXIS ABA agora inclui a camada institucional que clínicas precisam
                  para comprovar presença, atestar sessões, documentar evidências
                  e gerar a documentação necessária para reembolso junto a operadoras de saúde.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-5 mb-12">
                <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all">
                  <svg className="w-8 h-8 mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" /></svg>
                  <h3 className="text-base font-semibold text-white mb-2">Presença comprovada por localização <HelpTip tip="pub_gps" color="bg-white/10 text-white/60" /></h3>
                  <p className="text-sm text-white/50 leading-relaxed">Check-in e check-out com geolocalização. Prova objetiva de que o atendimento aconteceu no local registrado.</p>
                </div>
                <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all">
                  <svg className="w-8 h-8 mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.397-1.308 7.362M15.75 15.75l-2.489 3.584a.75.75 0 01-1.271-.078l-2.24-4.032" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a7.46 7.46 0 01-4.636-1.607M4.5 10.5a7.47 7.47 0 011.022-3.773" /></svg>
                  <h3 className="text-base font-semibold text-white mb-2">Assinatura digital de sessão <HelpTip tip="pub_atestacao" color="bg-white/10 text-white/60" /></h3>
                  <p className="text-sm text-white/50 leading-relaxed">Terapeuta e responsável confirmam cada atendimento com assinatura digital vinculada ao prontuário.</p>
                </div>
                <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all">
                  <svg className="w-8 h-8 mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                  <h3 className="text-base font-semibold text-white mb-2">Pacote de evidências auditável <HelpTip tip="pub_bundle" color="bg-white/10 text-white/60" /></h3>
                  <p className="text-sm text-white/50 leading-relaxed">Dados clínicos, localização, assinaturas e anexos reunidos em um pacote protegido e imutável.</p>
                </div>
                <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all">
                  <svg className="w-8 h-8 mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  <h3 className="text-base font-semibold text-white mb-2">Documentação para reembolso <HelpTip tip="pub_claim" color="bg-white/10 text-white/60" /></h3>
                  <p className="text-sm text-white/50 leading-relaxed">Cada sessão gera automaticamente a documentação exigida por operadoras para solicitação de reembolso.</p>
                </div>
                <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all">
                  <svg className="w-8 h-8 mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                  <h3 className="text-base font-semibold text-white mb-2">Conformidade e integridade <HelpTip tip="pub_compliance" color="bg-white/10 text-white/60" /></h3>
                  <p className="text-sm text-white/50 leading-relaxed">Verificação automática de documentos vencidos, sessões sem comprovação e inconsistências da equipe.</p>
                </div>
                <div className="bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all">
                  <svg className="w-8 h-8 mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm-3.375 6.75h4.5c.621 0 1.125-.504 1.125-1.125a3 3 0 00-6.75 0c0 .621.504 1.125 1.125 1.125z" /></svg>
                  <h3 className="text-base font-semibold text-white mb-2">Perfis de cobertura <HelpTip tip="pub_cobertura" color="bg-white/10 text-white/60" /></h3>
                  <p className="text-sm text-white/50 leading-relaxed">Plano de saúde, autorização, vigência e limites do paciente vinculados ao prontuário em um só lugar.</p>
                </div>
              </div>

              <div className="bg-white/[0.06] backdrop-blur-sm rounded-2xl border border-white/10 p-8 md:p-10 mb-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold mb-1" style={{ color: aba }}>100%</div>
                    <div className="text-xs text-white/40 leading-snug">Aditivo ao motor clínico <HelpTip tip="pub_motor_congelado" color="bg-white/10 text-white/40" /></div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1" style={{ color: aba }}>LGPD</div>
                    <div className="text-xs text-white/40 leading-snug">Dados geo com retenção controlada <HelpTip tip="pub_lgpd" color="bg-white/10 text-white/40" /></div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1" style={{ color: aba }}>4 planos</div>
                    <div className="text-xs text-white/40 leading-snug">De gratuito a enterprise</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold mb-1" style={{ color: aba }}>Zero</div>
                    <div className="text-xs text-white/40 leading-snug">Impacto no fluxo clínico existente</div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <Link
                  href="/produto/aba"
                  className="inline-block px-8 py-4 text-white font-medium rounded-xl hover:opacity-90 transition-all shadow-lg"
                  style={{ backgroundColor: aba }}
                >
                  Conhecer AXIS ABA Operadora Ready →
                </Link>
                <p className="text-xs text-white/30 mt-4">
                  A camada operadora é 100% aditiva. O motor clínico CSO-ABA v2.6.1 permanece congelado e intacto.
                </p>
              </div>
            </div>
          </section>

          {/* ════════════════ BLOCO 5 — DIFERENÇA ════════════════ */}
          <section className="py-20 px-6 bg-white border-t border-slate-200">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-light leading-snug mb-8">
                O profissional quer ver o <span className="font-semibold" style={{ color: navy }}>antes e o depois</span>.
                <br />
                O AXIS torna isso visível.
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-[1.8] mb-10">
                Com o tempo, a memória do caso se dilui.
                O que mudou, quando mudou e por que mudou ficam cada vez menos claros.
              </p>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-[1.8] mb-10">
                O AXIS mede e organiza a evolução de cada caso,
                para que o profissional consiga comparar momentos,
                enxergar progresso real e decidir com mais segurança.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {[
                  'Comparar o início com o momento atual do caso',
                  'Reduzir perda de informação ao longo do tempo',
                  'Manter documentação com consistência real',
                  'Decidir com base no que ficou registrado',
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
                <h2 className="text-3xl md:text-4xl font-light leading-snug mb-4">
                  Para que essa visão funcione,{' '}
                  <span className="font-semibold" style={{ color: navy }}>a base precisa ser sólida.</span>
                </h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-[1.8]">
                  Os três sistemas compartilham a mesma lógica:
                  organização estruturada, histórico preservado
                  e julgamento humano no centro de cada decisão.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { title: 'Histórico preservado', desc: 'O passado clínico permanece acessível, organizado e confiável ao longo do tempo.' },
                  { title: 'Rastreabilidade', desc: 'Cada registro e cada mudança ficam claros, sem depender de memória ou improviso.' },
                  { title: 'Organização consistente', desc: 'Os dados deixam de ficar espalhados entre anotações soltas, planilhas e memórias.' },
                  { title: 'Estrutura profissional', desc: 'A documentação ganha forma para a rotina clínica, supervisão e contextos institucionais.' },
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
                <div className="p-6 rounded-2xl border-2 text-left" style={{ borderColor: aba + '30' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold" style={{ color: aba }}>AXIS ABA</h3>
                    <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded" style={{ backgroundColor: aba + '15', color: aba }}>Operadora Ready</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-6">Motor clínico completo + conformidade, reembolso e auditoria para operadoras de saúde.</p>
                  <Link href="/produto/aba" className="inline-block px-5 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-all" style={{ backgroundColor: aba }}>
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
