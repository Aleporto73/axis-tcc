'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Lock,
  FileText,
  Shield,
  Building,
  ClipboardList,
  Zap,
  PenLine,
  BarChart3,
  FileCheck,
  Check,
  X,
  MessageCircle,
  Layers,
  GraduationCap,
  Home,
  Stethoscope,
} from 'lucide-react'

/* ─── palette ─── */
const teal = '#0d7377'
const tealHover = '#0a5c5f'
const tealLight = '#0d9da2'

/* ═══════════════════════ PAGE ═══════════════════════ */

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AXIS TDAH',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  description: 'Sistema clínico para acompanhamento tricontextual em TDAH. Sessões tricontextuais, Daily Report Card escolar, Layer AuDHD e motor CSO-TDAH.',
  url: 'https://axisclinico.com/produto/tdah',
  offers: [
    {
      '@type': 'Offer',
      name: '1 Paciente',
      price: '0',
      priceCurrency: 'BRL',
      description: 'Motor CSO-TDAH completo, DRC escolar, Layer AuDHD e sessões tricontextuais para 1 paciente.',
    },
    {
      '@type': 'Offer',
      name: 'Founders',
      price: '97',
      priceCurrency: 'BRL',
      billingIncrement: 'P1M',
      description: 'Até 50 pacientes, multi-terapeuta, relatórios consolidados.',
    },
    {
      '@type': 'Offer',
      name: 'Clínica 100',
      price: '247',
      priceCurrency: 'BRL',
      billingIncrement: 'P1M',
      description: 'Até 100 pacientes com todos os recursos profissionais.',
    },
    {
      '@type': 'Offer',
      name: 'Clínica 250',
      price: '497',
      priceCurrency: 'BRL',
      billingIncrement: 'P1M',
      description: 'Até 250 pacientes com todos os recursos profissionais.',
    },
  ],
  publisher: {
    '@type': 'Organization',
    name: 'Psiform Tecnologia',
    url: 'https://axisclinico.com',
  },
}

export default function ProdutoTDAHPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ────────────────── HEADER ────────────────── */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/">
            <Image src="/axisTDAH-transparente.png" alt="AXIS TDAH — Sistema clínico para acompanhamento tricontextual em TDAH" width={140} height={32} className="h-8 w-auto" priority />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#sistema" className="hover:text-slate-900 transition-colors">Sistema</a>
            <a href="#tricontextual" className="hover:text-slate-900 transition-colors">Tricontextual</a>
            <a href="#drc" className="hover:text-slate-900 transition-colors">DRC Escolar</a>
            <a href="#planos" className="hover:text-slate-900 transition-colors">Planos</a>
          </nav>
          <Link
            href="/sign-in"
            className="hidden sm:inline-flex px-5 py-2 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
          >
            Acessar plataforma
          </Link>
        </div>
      </header>

      {/* ────────────────── HERO ────────────────── */}
      <section className="bg-slate-900 py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight text-white max-w-3xl">
            TDAH com acompanhamento tricontextual, documentação consistente e governança real
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-300 max-w-2xl leading-relaxed">
            O AXIS TDAH ajuda profissionais e equipes a organizar o caso ao longo do tempo, integrar clínica, escola e família com mais clareza e sustentar uma prática mais sólida, contínua e profissional.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/sign-up?produto=tdah"
              className="px-7 py-3.5 rounded-lg text-white text-base font-semibold transition-colors"
              style={{ backgroundColor: tealLight }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = teal)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = tealLight)}
            >
              Começar com 1 paciente real
            </Link>
            <Link
              href="/demo/tdah"
              className="px-7 py-3.5 rounded-lg border border-white/30 text-white/90 text-base font-medium hover:bg-white/10 transition-colors"
            >
              Analisar o sistema por dentro
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Sem cartão • Sem custo • Estrutura real desde o primeiro caso
          </p>
        </div>
      </section>

      {/* ────────────────── BLOCO 1 — ABERTURA ────────────────── */}
      <section id="sistema" className="bg-white py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">
            TDAH não acontece só no consultório. O acompanhamento também não pode.
          </h2>
          <p className="text-base md:text-lg text-slate-600 leading-relaxed max-w-3xl">
            Na prática, o caso costuma ficar dividido entre o que o clínico observa, o que a escola relata e o que a família vive no dia a dia. O problema não é falta de esforço. É falta de uma estrutura que organize tudo isso com continuidade, clareza e utilidade clínica real.
          </p>
          <p className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed max-w-3xl">
            O AXIS TDAH nasce para isso.
          </p>
        </div>
      </section>

      {/* ────────────────── BLOCO DOR ────────────────── */}
      <section className="py-16 md:py-20" style={{ backgroundColor: '#f8f8fa' }}>
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-12">
            Quando cada contexto fala sozinho, o caso perde força
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: 'A clínica vê uma parte', desc: 'O consultório capta padrões importantes, mas não sustenta sozinho a leitura do caso no mundo real.', Icon: Stethoscope },
              { title: 'A escola vê outra', desc: 'O que acontece em sala de aula nem sempre chega ao clínico de forma simples, estruturada e utilizável.', Icon: GraduationCap },
              { title: 'A família carrega o resto', desc: 'Rotina, transições, tarefas e manejo do dia a dia acabam ficando soltos, sem um eixo clínico claro.', Icon: Home },
              { title: 'A evolução fica fragmentada', desc: 'Sem integração, o acompanhamento depende mais de memória, mensagens dispersas e improviso do que de continuidade organizada.', Icon: BarChart3 },
            ].map((card) => (
              <div key={card.title} className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: teal + '15' }}>
                  <card.Icon className="w-5 h-5" style={{ color: teal }} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 2 — TRICONTEXTUAL ────────────────── */}
      <section id="tricontextual" className="bg-slate-100 py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-12">
            Três contextos. Um acompanhamento mais claro.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Clínico', desc: 'Sessões estruturadas no consultório com observações clínicas e acompanhamento evolutivo.', Icon: Stethoscope, color: teal },
              { title: 'Domiciliar', desc: 'Orientação familiar, rotina e continuidade fora do consultório.', Icon: Home, color: '#6366f1' },
              { title: 'Escolar', desc: 'DRC diário, integração com professor, metas objetivas e revisão do clínico.', Icon: GraduationCap, color: '#f59e0b' },
            ].map((card) => (
              <div key={card.title} className="bg-white border border-slate-300 rounded-xl p-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: card.color + '15' }}>
                  <card.Icon className="w-6 h-6" style={{ color: card.color }} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-500 text-center">
            O valor do sistema está em conectar esses três eixos sem transformar o caso em ruído.
          </p>
        </div>
      </section>

      {/* ────────────────── BLOCO 3 — FLUXO OPERACIONAL ────────────────── */}
      <section className="bg-white py-16 md:py-20 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative">
            <div className="hidden md:block absolute top-7 left-[10%] right-[10%] h-px bg-slate-200" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-4">
              {[
                { n: 1, label: 'Cadastro do paciente', Icon: ClipboardList },
                { n: 2, label: 'Ativação protocolar', Icon: Zap },
                { n: 3, label: 'Sessão tricontextual', Icon: PenLine },
                { n: 4, label: 'Motor CSO-TDAH', Icon: BarChart3 },
                { n: 5, label: 'DRC + Relatório', Icon: FileCheck },
              ].map((step) => (
                <div key={step.n} className="flex flex-col items-center text-center relative z-10">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: teal + '18' }}>
                    <step.Icon className="w-5 h-5" style={{ color: teal }} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 mb-1">0{step.n}</span>
                  <span className="text-sm font-medium text-slate-700">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-12 text-center text-base text-slate-500 italic max-w-xl mx-auto">
            O julgamento clínico permanece humano. A estrutura permanece sistêmica.
          </p>
        </div>
      </section>

      {/* ────────────────── BLOCO 4 — DRC ESCOLAR ────────────────── */}
      <section id="drc" className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Daily Report Card — o coração do contexto escolar
          </h2>
          <p className="text-base md:text-lg text-slate-500 leading-relaxed max-w-3xl mb-12">
            Professor registra metas diárias. Clínico revisa e integra ao plano terapêutico.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* DRC Mockup */}
            <DrcMockup />

            {/* Features */}
            <div className="space-y-4">
              {[
                { title: 'Metas claras', desc: 'Poucas metas, bem definidas e observáveis no contexto real.' },
                { title: 'Preenchimento simples', desc: 'O professor registra de forma prática, sem virar burocracia.' },
                { title: 'Revisão clínica', desc: 'O profissional integra esse retorno ao acompanhamento do caso.' },
                { title: 'Continuidade real', desc: 'A escola deixa de ser apenas fonte de relato e passa a fazer parte de uma leitura mais organizada da evolução.' },
              ].map((f) => (
                <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-5">
                  <h4 className="text-sm font-semibold text-slate-800 mb-1">{f.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-500 italic text-center lg:text-left">
            Menos ruído. Mais utilidade clínica.
          </p>
        </div>
      </section>

      {/* ────────────────── BLOCO 5 — LAYER AuDHD ────────────────── */}
      <section className="bg-slate-100 py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-10">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#7c3aed18' }}>
                <Layers className="w-6 h-6" style={{ color: '#7c3aed' }} />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                  Layer AuDHD integrada
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Sobreposição autismo + TDAH ativável por paciente. Não é produto separado.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Off', desc: 'Apenas TDAH puro. Blocos Base + Executivo.' },
                { label: 'Core', desc: 'Ativa dimensões de sensorialidade e transições.' },
                { label: 'Completa', desc: 'Core + rigidez, impulsividade e outras dimensões relevantes.' },
              ].map((mode) => (
                <div key={mode.label} className="rounded-xl border border-slate-200 p-5">
                  <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: '#7c3aed15', color: '#7c3aed' }}>
                    {mode.label}
                  </span>
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed">{mode.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-500 italic">
              Toda mudança de layer é auditada. Histórico preservado. Desativação não apaga dados.
            </p>
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO DOCUMENTAÇÃO PROFISSIONAL ────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
              Documentação com padrão profissional
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                'Registro longitudinal do caso',
                'Histórico preservado e acessível',
                'Rastreabilidade de mudanças',
                'Estrutura útil para clínica e contextos institucionais',
                'Fundamentação metodológica declarada',
                'Integração entre contextos documentada',
              ].map((item) => (
                <div key={item} className="group rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: teal + '15' }}>
                    <Check className="w-5 h-5" style={{ color: teal }} />
                  </div>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-slate-500 italic">
              O sistema organiza. A responsabilidade clínica permanece do profissional.
            </p>
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 6 — GOVERNANÇA ────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Integridade documental', Icon: Lock },
              { label: 'Trilha de auditoria', Icon: FileText },
              { label: 'LGPD aplicada', Icon: Shield },
              { label: 'Multi-terapeuta', Icon: Building },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
                  <item.Icon className="w-6 h-6 text-slate-700" />
                </div>
                <p className="text-sm font-semibold text-slate-700">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO LIMITES ────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8 text-center">
            O que o AXIS TDAH não faz
          </h2>
          <p className="text-base text-slate-500 text-center mb-10 max-w-2xl mx-auto">
            Transparência também é parte da estrutura.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              'Não substitui o julgamento clínico do profissional.',
              'Não faz diagnóstico automaticamente.',
              'Não transforma retorno escolar em decisão clínica final.',
              'Não prescreve intervenção por conta própria.',
              'Não compartilha dados sem autorização.',
              'Não promete resolver o caso por software.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-4 rounded-lg border border-slate-100">
                <X className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-600 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 7 — SUPORTE ANA ────────────────── */}
      <section className="bg-slate-100 py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
            Dúvidas operacionais? A Ana responde dentro da plataforma.
          </h2>
          <p className="mt-4 text-base md:text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto">
            A Ana ajuda o profissional a entender funcionalidades, fluxos e dúvidas de uso no dia a dia.
          </p>

          <div className="mt-10 max-w-xl mx-auto bg-white rounded-xl border border-slate-300 shadow-sm text-left">
            <div className="flex items-center gap-3 p-5 pb-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: teal + '18' }}>
                <MessageCircle className="w-[18px] h-[18px]" style={{ color: teal }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Dúvida sobre o sistema?</p>
                <p className="text-xs text-slate-400">A Ana conhece cada detalhe.</p>
              </div>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-white" style={{ backgroundColor: teal }}>
                  O que é a Layer AuDHD?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed bg-slate-100 text-slate-700">
                  <span className="block text-xs font-semibold mb-1" style={{ color: teal }}>Ana</span>
                  A Layer AuDHD é uma camada de sobreposição para pacientes com TDAH + autismo. Ela ativa métricas adicionais (sensorial, transições, rigidez) sem criar um produto separado.
                </div>
              </div>
            </div>
            <div className="p-5 pt-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-400 select-none">
                  Me conta sua dúvida...
                </div>
                <div className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-white opacity-40" style={{ backgroundColor: teal }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center">
                A Ana é uma assistente virtual. Suas respostas não substituem orientação profissional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 8 — PLANOS ────────────────── */}
      <section id="planos" className="bg-slate-100 py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6">

          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="text-left py-4 px-6 font-semibold w-[34%]">Recurso</th>
                  <th className="text-center py-4 px-3 font-semibold">
                    <span className="block">1 Paciente</span>
                    <span className="text-xs font-normal text-slate-400">Free</span>
                  </th>
                  <th className="text-center py-4 px-3 font-semibold">
                    <span className="block">Founders</span>
                    <span className="text-xs font-normal text-slate-400">até 50</span>
                  </th>
                  <th className="text-center py-4 px-3 font-semibold">Clínica 100</th>
                  <th className="text-center py-4 px-3 font-semibold">Clínica 250</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {[
                  { label: 'Motor CSO-TDAH completo', free: true },
                  { label: 'Sessões tricontextuais', free: true },
                  { label: 'Daily Report Card (DRC)', free: true },
                  { label: 'Layer AuDHD', free: true },
                  { label: '46 protocolos clínicos', free: true },
                  { label: 'Multi-terapeuta', free: false },
                  { label: 'Relatórios consolidados', free: false },
                ].map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="py-3.5 px-6 text-slate-700 font-medium">{row.label}</td>
                    <td className="py-3.5 px-3 text-center">
                      {row.free ? (
                        <Check className="w-5 h-5 mx-auto" style={{ color: teal }} />
                      ) : (
                        <X className="w-4 h-4 mx-auto text-slate-300" />
                      )}
                    </td>
                    {[0, 1, 2].map((j) => (
                      <td key={j} className="py-3.5 px-3 text-center">
                        <Check className="w-5 h-5 mx-auto" style={{ color: teal }} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-white">
                  <td className="py-5 px-6 text-slate-900 font-bold">Investimento</td>
                  <td className="py-5 px-3 text-center">
                    <span className="text-lg font-bold text-slate-900">Sem custo</span>
                  </td>
                  <td className="py-5 px-3 text-center">
                    <span className="text-lg font-bold text-slate-900">R$97</span>
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

          {/* Mobile cards */}
          <div className="md:hidden space-y-6">
            {[
              { name: '1 Paciente', price: 'Sem custo', subtitle: '', features: ['Motor CSO-TDAH completo', 'Sessões tricontextuais', 'Daily Report Card (DRC)', 'Layer AuDHD', '46 protocolos clínicos'], href: '/sign-up?produto=tdah', cta: 'Começar com 1 paciente real', highlight: false },
              { name: 'Founders', price: 'R$97/mês', subtitle: 'até 50 pacientes', features: ['Tudo do plano Free', 'Multi-terapeuta', 'Relatórios consolidados'], href: 'https://pay.hotmart.com/7380571?off=xqzgdn1i', cta: 'Entrar como Fundador', highlight: true },
              { name: 'Clínica 100', price: 'R$247/mês', subtitle: '', features: ['Tudo do plano Free', 'Multi-terapeuta', 'Relatórios consolidados'], href: 'https://pay.hotmart.com/7380571?off=cr3rh0u9', cta: 'Assinar Clínica 100', highlight: false },
              { name: 'Clínica 250', price: 'R$497/mês', subtitle: '', features: ['Tudo do plano Free', 'Multi-terapeuta', 'Relatórios consolidados'], href: 'https://pay.hotmart.com/7380571?off=hxzwuwfh', cta: 'Solicitar Clínica 250', highlight: false },
            ].map((plan) => (
              <div key={plan.name} className={`bg-white rounded-xl p-6 ${plan.highlight ? 'border-2 shadow-md' : 'border border-slate-300'}`} style={plan.highlight ? { borderColor: teal } : undefined}>
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                {plan.subtitle && <p className="text-xs text-slate-400">{plan.subtitle}</p>}
                <p className="text-2xl font-bold text-slate-900 mt-2">{plan.price}</p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 shrink-0" style={{ color: teal }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  target={plan.href.startsWith('http') ? '_blank' : undefined}
                  className="mt-6 block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  style={plan.highlight ? { backgroundColor: teal, color: 'white' } : { border: '1px solid #0F172A', color: '#0F172A' }}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          {/* Botões desktop */}
          <div className="hidden md:flex gap-4 mt-6">
            <Link
              href="/sign-up?produto=tdah"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Começar com 1 paciente real
            </Link>
            <a
              href="https://pay.hotmart.com/7380571?off=xqzgdn1i"
              target="_blank"
              className="flex-1 text-center py-2.5 rounded-lg text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: teal }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = tealHover)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = teal)}
            >
              Entrar como Fundador
            </a>
            <a
              href="https://pay.hotmart.com/7380571?off=cr3rh0u9"
              target="_blank"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Assinar Clínica 100
            </a>
            <a
              href="https://pay.hotmart.com/7380571?off=hxzwuwfh"
              target="_blank"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Solicitar Clínica 250
            </a>
          </div>
        </div>
      </section>

      {/* ────────────────── CTA FINAL ────────────────── */}
      <section className="bg-slate-900 py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-white">
            Experimente a estrutura completa com 1 paciente real.
          </h2>
          <p className="mt-4 text-base md:text-lg text-slate-300">
            Clínica, escola e casa — tudo em um sistema.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up?produto=tdah"
              className="px-7 py-3.5 rounded-lg text-white text-base font-semibold transition-colors"
              style={{ backgroundColor: tealLight }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = teal)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = tealLight)}
            >
              Começar com 1 paciente real
            </Link>
            <Link
              href="/demo/tdah"
              className="px-7 py-3.5 rounded-lg border border-white/30 text-white/90 text-base font-medium hover:bg-white/10 transition-colors"
            >
              Analisar o sistema por dentro
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Sem cartão • Sem custo • Estrutura real desde o primeiro caso
          </p>
        </div>
      </section>

      {/* ────────────────── FOOTER ────────────────── */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              © 2026 AXIS TDAH. Psiform Tecnologia.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/termos" className="hover:text-slate-200 transition-colors">Termos de Uso</Link>
              <Link href="/privacidade" className="hover:text-slate-200 transition-colors">Privacidade</Link>
              <Link href="/sign-up?produto=tdah" className="hover:text-slate-200 transition-colors">Criar conta</Link>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500 text-center md:text-left">
            AXIS TDAH é uma infraestrutura clínica de apoio à organização, ao acompanhamento e à documentação profissional. Não substitui formação, supervisão ou julgamento clínico.
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ═══════════════════════ DRC MOCKUP ═══════════════════════ */

function DrcMockup() {
  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-md p-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 mb-4">
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: teal }}>
          AXIS TDAH — Daily Report Card
        </p>
      </div>

      {/* Paciente + Data */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Gabriel Santos</p>
          <p className="text-xs text-slate-400">8 anos · 3º ano</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">13/03/2026</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Escolar</span>
        </div>
      </div>

      {/* Metas */}
      <div className="space-y-3 mb-4">
        {[
          { goal: 'Permanecer sentado durante leitura (10 min)', met: true, score: 85 },
          { goal: 'Levantar a mão antes de falar', met: true, score: 70 },
          { goal: 'Completar atividade de matemática sem apoio', met: false, score: 40 },
        ].map((m, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
              m.met ? 'border-green-500 bg-green-500' : 'border-red-400 bg-red-50'
            }`}>
              {m.met ? (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700">{m.goal}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${m.score}%`, backgroundColor: m.score >= 70 ? '#10b981' : m.score >= 50 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <span className="text-[10px] text-slate-500 font-medium">{m.score}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notas */}
      <div className="border-t border-slate-200 pt-3">
        <p className="text-[10px] text-slate-400 font-medium mb-1">Nota da professora:</p>
        <p className="text-xs text-slate-600 italic">Boa participação na leitura. Matemática ainda precisa de apoio visual.</p>
      </div>

      {/* Review */}
      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
        <span className="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-600 font-medium">Revisado pelo clínico</span>
        <span className="text-[9px] text-slate-300 font-mono">CSO-TDAH v1.0.0</span>
      </div>
    </div>
  )
}
