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
  Calendar,
} from 'lucide-react'

/* ─── palette ─── */
const coral = '#B4532F'
const coralHover = '#8F3E22'
const coralLight = '#c46a50'

/* ═══════════════════════ PAGE ═══════════════════════ */

export default function ProdutoABAPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ────────────────── HEADER ────────────────── */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/">
            <Image src="/axisaba.png" alt="AXIS ABA" width={140} height={32} className="h-8 w-auto" priority />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#sistema" className="hover:text-slate-900 transition-colors">Sistema</a>
            <a href="#arquitetura" className="hover:text-slate-900 transition-colors">Arquitetura</a>
            <a href="#relatorios" className="hover:text-slate-900 transition-colors">Relatórios</a>
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
            Infraestrutura clínica para operação real. Documentação estruturada para defesa técnica.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-300 max-w-2xl leading-relaxed">
            Sistema estruturado para organização terapêutica, cálculo evolutivo automatizado e emissão de relatórios com padrão institucional brasileiro.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/sign-up"
              className="px-7 py-3.5 rounded-lg text-white text-base font-semibold transition-colors"
              style={{ backgroundColor: coralLight }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = coral)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = coralLight)}
            >
              Utilizar com 1 aprendiz real
            </Link>
            <Link
              href="/demo"
              className="px-7 py-3.5 rounded-lg border border-white/30 text-white/90 text-base font-medium hover:bg-white/10 transition-colors"
            >
              Analisar o sistema por dentro
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Sistema completo · Sem custo · Sem cartão
          </p>
        </div>
      </section>

      {/* ────────────────── BLOCO 1 — CONTEXTO OPERACIONAL ────────────────── */}
      <section id="sistema" className="bg-white py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-12">
            A clínica evoluiu. A documentação precisa acompanhar.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <ul className="space-y-5">
              {[
                'Convênios exigem justificativa técnica.',
                'Auditorias exigem rastreabilidade.',
                'Planilhas não sustentam governança.',
                'Relatórios manuais não escalam operação.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: coral }} />
                  <span className="text-base text-slate-600 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center">
              <p className="text-2xl md:text-3xl font-semibold text-slate-900 leading-snug">
                Estrutura não é luxo.{' '}
                <span style={{ color: coral }}>É proteção clínica.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 2 — ARQUITETURA ────────────────── */}
      <section id="arquitetura" className="bg-slate-100 py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Motor CSO-ABA proprietário', desc: 'Cálculo multidimensional automatizado' },
              { title: 'Registro estruturado por protocolo', desc: 'Sessões organizadas com integridade' },
              { title: 'Emissão documental institucional', desc: 'Histórico preservado e auditável' },
            ].map((card) => (
              <div key={card.title} className="bg-white border border-slate-300 rounded-xl p-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-500 text-center">
            Motor clínico v2.6.1 · Estrutura modular · Emissão rastreável
          </p>
        </div>
      </section>

      {/* ────────────────── BLOCO 3 — FLUXO OPERACIONAL ────────────────── */}
      <section className="bg-white py-16 md:py-20 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative">
            {/* Linha conectora (desktop) */}
            <div className="hidden md:block absolute top-7 left-[10%] right-[10%] h-px bg-slate-200" />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-4">
              {[
                { n: 1, label: 'Cadastro do aprendiz', Icon: ClipboardList },
                { n: 2, label: 'Ativação protocolar', Icon: Zap },
                { n: 3, label: 'Registro estruturado', Icon: PenLine },
                { n: 4, label: 'Processamento evolutivo', Icon: BarChart3 },
                { n: 5, label: 'Geração documental', Icon: FileCheck },
              ].map((step) => (
                <div key={step.n} className="flex flex-col items-center text-center relative z-10">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: '#c46a5018' }}>
                    <step.Icon className="w-5 h-5" style={{ color: coral }} />
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

      {/* ────────────────── BLOCO 3.5 — CICLO ABA COMPLETO ────────────────── */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Ciclo ABA completo incorporado
          </h2>
          <p className="text-base md:text-lg text-slate-500 leading-relaxed max-w-3xl mb-12">
            O AXIS não registra apenas sessões. Ele estrutura o ciclo clínico completo.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Coluna esquerda — Máquina de Estados (stepper vertical) */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">
                Transição validada de protocolo
              </p>

              <div className="space-y-0">
                {[
                  { label: 'Rascunho', bg: '#e2e8f0', text: '#475569', dot: '#94a3b8' },
                  { label: 'Ativo', bg: '#cbd5e1', text: '#334155', dot: '#64748b' },
                  { label: 'Dominado', bg: '#f5e6e0', text: coralLight, dot: coralLight },
                  { label: 'Generalizado', bg: coralLight + '20', text: coralLight, dot: coralLight },
                  { label: 'Mantido', bg: coral + '18', text: coral, dot: coral },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-stretch gap-4">
                    {/* Linha + dot */}
                    <div className="flex flex-col items-center w-4 shrink-0">
                      <div className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: step.dot }} />
                      {i < arr.length - 1 && <div className="flex-1 w-px bg-slate-200 my-1" />}
                    </div>
                    {/* Badge + espaço */}
                    <div className="pb-4">
                      <span
                        className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: step.bg, color: step.text }}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-slate-500 leading-relaxed mt-4">
                Cada protocolo passa por estados validados. Sem pular etapas. Sem perder histórico.
              </p>
            </div>

            {/* Coluna direita — Generalização e Manutenção */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#c46a5018' }}>
                    <Layers className="w-5 h-5" style={{ color: coralLight }} />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-slate-900 mb-1">Generalização 3×2</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      3 variações de estímulo + 2 variações de contexto. Estrutura que garante generalização real, não apenas registro.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#c46a5018' }}>
                    <Calendar className="w-5 h-5" style={{ color: coralLight }} />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-slate-900 mb-1">Manutenção 2-6-12</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Sondas programadas em 2, 6 e 12 semanas. O sistema alerta quando é hora de verificar retenção.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-10 text-sm text-slate-500 italic text-center">
            Sem planilhas paralelas. Sem cálculos manuais. Sem esquecer de sondar.
          </p>
        </div>
      </section>

      {/* ────────────────── BLOCO 4 — PROVA DOCUMENTAL ────────────────── */}
      <section id="relatorios" className="bg-slate-100 py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center">
            Veja na prática
          </h2>
          <p className="text-lg text-slate-500 text-center mt-4 mb-12">
            Relatórios gerados automaticamente a partir de dados estruturados.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Relatório mockup (55%) */}
            <div className="lg:col-span-7">
              <RelatorioMockup />
              <p className="mt-4 text-xs text-slate-500 text-center lg:text-left">
                Documento gerado a partir de dados estruturados. Integridade preservada.
              </p>
            </div>

            {/* Cards laterais (45%) */}
            <div className="lg:col-span-5 space-y-4">
              {[
                { nome: 'Lucas, 6 anos', cso: '72 → 86', badge: 'Excelente', desc: 'Evolução consistente documentada', cor: '#10b981' },
                { nome: 'Marina, 8 anos', cso: '65 → 64', badge: 'Atenção', desc: 'Oscilação detectada precocemente', cor: '#f59e0b' },
                { nome: 'Pedro, 5 anos', cso: '58 → 82', badge: 'Bom', desc: 'Progressão validada', cor: '#0ea5e9' },
              ].map((card) => (
                <div key={card.nome} className="bg-white border border-slate-300 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{card.nome}</p>
                    <p className="text-xs text-slate-400 mt-0.5">CSO {card.cso}</p>
                    <p className="text-xs text-slate-500 mt-1">{card.desc}</p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ backgroundColor: card.cor + '15', color: card.cor }}
                  >
                    {card.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/demo"
              className="inline-block px-6 py-3 rounded-lg text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: coralLight }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = coral)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = coralLight)}
            >
              Ver relatório completo
            </Link>
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 5 — PADRÃO DOCUMENTAL ────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
              Documentação com padrão institucional.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                'Estrutura compatível com auditoria',
                'Justificativa técnica de carga horária',
                'Registro longitudinal',
                'Histórico preservado',
                'Modelo compatível com ANS',
                'Fundamentação metodológica declarada',
              ].map((item) => (
                <div key={item} className="group rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#c46a5015' }}>
                    <Check className="w-5 h-5" style={{ color: coralLight }} />
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

      {/* ────────────────── BLOCO 6 — SUPORTE INTELIGENTE ────────────────── */}
      <section className="bg-slate-100 py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
            Dúvidas? A Ana resolve na hora.
          </h2>
          <p className="mt-4 text-base md:text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto">
            Nossa assistente virtual conhece cada detalhe do sistema e está disponível 24h dentro da plataforma.
          </p>

          {/* Chat mockup */}
          <div className="mt-10 max-w-xl mx-auto bg-white rounded-xl border border-slate-300 shadow-sm text-left">
            <div className="flex items-center gap-3 p-5 pb-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: coralLight + '18' }}>
                <MessageCircle className="w-[18px] h-[18px]" style={{ color: coralLight }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Não encontrou o que procura?</p>
                <p className="text-xs text-slate-400">Pergunte para a Ana — ela está aqui pra ajudar.</p>
              </div>
            </div>

            <div className="px-5 pt-4 space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-white" style={{ backgroundColor: coralLight }}>
                  Os pais podem acessar o sistema?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed bg-slate-100 text-slate-700">
                  <span className="block text-xs font-semibold mb-1" style={{ color: coralLight }}>Ana</span>
                  Sim, os pais podem acessar através do Portal Família. O profissional configura o acesso e eles acompanham o progresso do aprendiz.
                </div>
              </div>
            </div>

            <div className="p-5 pt-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-400 select-none">
                  Qual sua dificuldade? Me conta...
                </div>
                <div className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-white opacity-40" style={{ backgroundColor: coralLight }}>
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

      {/* ────────────────── BLOCO 7 — GOVERNANÇA E SEGURANÇA ────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Integridade documental', Icon: Lock },
              { label: 'Trilha de alterações', Icon: FileText },
              { label: 'LGPD aplicada', Icon: Shield },
              { label: 'Padronização institucional', Icon: Building },
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

      {/* ────────────────── BLOCO 8 — PLANOS (TABELA) ────────────────── */}
      <section id="planos" className="bg-slate-100 py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6">

          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="text-left py-4 px-6 font-semibold w-[34%]">Recurso</th>
                  <th className="text-center py-4 px-3 font-semibold">1 Aprendiz</th>
                  <th className="text-center py-4 px-3 font-semibold">
                    <span className="block">Clínica 100</span>
                    <span className="text-xs font-normal text-slate-400">Founders</span>
                  </th>
                  <th className="text-center py-4 px-3 font-semibold">Clínica 100</th>
                  <th className="text-center py-4 px-3 font-semibold">Clínica 250</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {[
                  { label: 'Motor CSO-ABA completo', free: true },
                  { label: 'Registro estruturado', free: true },
                  { label: 'Relatório institucional', free: true },
                  { label: 'Multi-terapeuta', free: false },
                  { label: 'Relatórios consolidados', free: false },
                  { label: 'Onboarding dedicado', free: false },
                ].map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="py-3.5 px-6 text-slate-700 font-medium">{row.label}</td>
                    <td className="py-3.5 px-3 text-center">
                      {row.free ? (
                        <Check className="w-5 h-5 mx-auto" style={{ color: coral }} />
                      ) : (
                        <X className="w-4 h-4 mx-auto text-slate-300" />
                      )}
                    </td>
                    {[0, 1, 2].map((j) => (
                      <td key={j} className="py-3.5 px-3 text-center">
                        <Check className="w-5 h-5 mx-auto" style={{ color: coral }} />
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

          {/* Mobile cards */}
          <div className="md:hidden space-y-6">
            {[
              { name: '1 Aprendiz', price: 'Sem custo', features: ['Motor CSO-ABA completo', 'Registro estruturado', 'Relatório institucional'], href: '/sign-up', cta: 'Utilizar com 1 aprendiz real', highlight: false },
              { name: 'Clínica 100 — Founders', price: 'R$147/mês', features: ['Motor CSO-ABA completo', 'Registro estruturado', 'Relatório institucional', 'Multi-terapeuta', 'Relatórios consolidados', 'Onboarding dedicado'], href: 'https://pay.hotmart.com/H104663812P?off=u2t04kz5', cta: 'Entrar como Fundador', highlight: true },
              { name: 'Clínica 100', price: 'R$247/mês', features: ['Motor CSO-ABA completo', 'Registro estruturado', 'Relatório institucional', 'Multi-terapeuta', 'Relatórios consolidados', 'Onboarding dedicado'], href: 'https://pay.hotmart.com/H104663812P?off=iwqieqxc', cta: 'Assinar agora', highlight: false },
              { name: 'Clínica 250', price: 'R$497/mês', features: ['Motor CSO-ABA completo', 'Registro estruturado', 'Relatório institucional', 'Multi-terapeuta', 'Relatórios consolidados', 'Onboarding dedicado'], href: 'https://pay.hotmart.com/H104663812P?off=gona25or', cta: 'Solicitar adesão', highlight: false },
            ].map((plan) => (
              <div key={plan.name} className={`bg-white rounded-xl p-6 ${plan.highlight ? 'border-2 shadow-md' : 'border border-slate-300'}`} style={plan.highlight ? { borderColor: coral } : undefined}>
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="text-2xl font-bold text-slate-900 mt-2">{plan.price}</p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 shrink-0" style={{ color: coral }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  target={plan.href.startsWith('http') ? '_blank' : undefined}
                  className="mt-6 block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  style={plan.highlight ? { backgroundColor: coral, color: 'white' } : { border: '1px solid #0F172A', color: '#0F172A' }}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          {/* Botões desktop */}
          <div className="hidden md:flex gap-4 mt-6">
            <Link
              href="/sign-up"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Utilizar com 1 aprendiz real
            </Link>
            <a
              href="https://pay.hotmart.com/H104663812P?off=u2t04kz5"
              target="_blank"
              className="flex-1 text-center py-2.5 rounded-lg text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: coral }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = coralHover)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = coral)}
            >
              Entrar como Fundador
            </a>
            <a
              href="https://pay.hotmart.com/H104663812P?off=iwqieqxc"
              target="_blank"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Assinar agora
            </a>
            <a
              href="https://pay.hotmart.com/H104663812P?off=gona25or"
              target="_blank"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Solicitar adesão
            </a>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Clínicas com até 50 aprendizes podem começar com{' '}
            <a href="https://abasimples.com.br" target="_blank" className="underline hover:text-slate-800">AbaSimples</a>.
          </p>
        </div>
      </section>

      {/* ────────────────── CTA FINAL ────────────────── */}
      <section className="bg-slate-900 py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-white">
            Experimente a estrutura completa com 1 aprendiz real.
          </h2>
          <p className="mt-4 text-base md:text-lg text-slate-300">
            Avalie o padrão documental na prática.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="px-7 py-3.5 rounded-lg text-white text-base font-semibold transition-colors"
              style={{ backgroundColor: coralLight }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = coral)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = coralLight)}
            >
              Utilizar com 1 aprendiz real
            </Link>
            <Link
              href="/demo"
              className="px-7 py-3.5 rounded-lg border border-white/30 text-white/90 text-base font-medium hover:bg-white/10 transition-colors"
            >
              Analisar o sistema por dentro
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Sistema completo · Sem custo · Sem cartão
          </p>
        </div>
      </section>

      {/* ────────────────── FOOTER ────────────────── */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              © 2026 AXIS ABA. Psiform Tecnologia.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/aba/precos" className="hover:text-slate-200 transition-colors">Preços</Link>
              <Link href="/sign-up" className="hover:text-slate-200 transition-colors">Criar conta</Link>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500 text-center md:text-left">
            Este sistema é uma ferramenta de apoio e organização. Não substitui o julgamento clínico do profissional.
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ═══════════════════════ RELATÓRIO MOCKUP ═══════════════════════ */

function RelatorioMockup() {
  const pontos = [74, 76, 78, 80, 82, 84, 86]
  const h = 48
  const w = 140
  const maxV = 90
  const minV = 70
  const range = maxV - minV
  const coords = pontos
    .map((v, i) => `${(i / (pontos.length - 1)) * w},${h - ((v - minV) / range) * h}`)
    .join(' ')

  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-md p-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 mb-4">
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: coral }}>
          AXIS ABA — Relatório de Evolução Clínica
        </p>
      </div>

      {/* Paciente */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Laura Oliveira</p>
          <p className="text-xs text-slate-400">6a 7m</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">86.1</p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            Excelente
          </span>
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" fill="none">
          <polyline points={coords} stroke={coral} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={w} cy={h - ((86 - minV) / range) * h} r="3" fill={coral} />
        </svg>
        <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-0.5">
          {['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'].map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </div>

      {/* Tabela dimensões */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 border-b border-slate-200">
            <th className="text-left py-1.5 font-medium">Dimensão</th>
            <th className="text-right py-1.5 font-medium">Anterior</th>
            <th className="text-right py-1.5 font-medium">Atual</th>
          </tr>
        </thead>
        <tbody className="text-slate-600">
          {[
            { dim: 'SAS', prev: '78.2', curr: '88.4' },
            { dim: 'PIS', prev: '71.0', curr: '84.6' },
            { dim: 'BSS', prev: '69.5', curr: '83.1' },
            { dim: 'TCM', prev: '77.8', curr: '88.2' },
          ].map((row) => (
            <tr key={row.dim} className="border-b border-slate-100 last:border-b-0">
              <td className="py-1.5 font-medium">{row.dim}</td>
              <td className="text-right py-1.5">{row.prev}</td>
              <td className="text-right py-1.5 font-semibold text-slate-800">{row.curr}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Rodapé */}
      <div className="mt-4 pt-3 border-t border-slate-200">
        <p className="text-[9px] text-slate-300 font-mono">
          Motor CSO-ABA v2.6.1 · SHA256: e3d8c...
        </p>
      </div>
    </div>
  )
}
