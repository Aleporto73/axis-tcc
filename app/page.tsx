'use client'

import { SignedIn, SignedOut } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
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
  UserRound,
  Eye,
  Landmark,
  ChevronRight,
  Users,
  MessageCircle,
} from 'lucide-react'

/* ─── brand color ─── */
const brand = '#c46a50'
const brandLight = '#f5ebe7'

/* ───────────────────────── mini-data ───────────────────────── */

const aprendizes = [
  { nome: 'Lucas, 6 anos', de: 72, para: 86, badge: 'Excelente', cor: 'emerald' },
  { nome: 'Marina, 8 anos', de: 65, para: 64, badge: 'Atenção', cor: 'amber' },
  { nome: 'Pedro, 5 anos', de: 58, para: 82, badge: 'Bom', cor: 'sky' },
]

const etapas = [
  { n: 1, label: 'Cadastre o aprendiz', icon: ClipboardList },
  { n: 2, label: 'Ative o protocolo', icon: Zap },
  { n: 3, label: 'Registre a sessão', icon: PenLine },
  { n: 4, label: 'Sistema calcula evolução', icon: BarChart3 },
  { n: 5, label: 'Relatório pronto', icon: FileCheck },
]

const defesas = [
  'Evolução baseada em dados reais',
  'Justificativa técnica de carga horária',
  'Estrutura compatível com ANS',
  'Fundamentação SBNI 2025',
  'Histórico preservado e rastreável',
]

const perfis = [
  {
    titulo: 'Terapeuta ABA',
    texto: 'Registro organizado, menos papelada. Foco no que importa: o atendimento.',
    icon: UserRound,
  },
  {
    titulo: 'Supervisor Clínico',
    texto: 'Visão longitudinal de cada caso. Detecta regressão antes que vire crise.',
    icon: Eye,
  },
  {
    titulo: 'Clínica / Instituição',
    texto: 'Padronização, governança e proteção documental em toda a operação.',
    icon: Landmark,
  },
]

const seguranca = [
  { label: 'Registros imutáveis', icon: Lock },
  { label: 'Histórico completo', icon: FileText },
  { label: 'LGPD aplicada', icon: Shield },
  { label: 'Padrão institucional', icon: Building },
]

/* ───────────────────────── helpers ──────────────────────────── */

function MiniSparkline({ de, para, cor }: { de: number; para: number; cor: string }) {
  const mid = Math.round((de + para) / 2 + (Math.random() * 6 - 3))
  const points = [de, mid, para]
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const h = 32
  const w = 64
  const coords = points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ')

  const strokeColor =
    cor === 'emerald' ? '#10b981' : cor === 'amber' ? '#f59e0b' : '#0ea5e9'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-16 h-8" fill="none">
      <polyline points={coords} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Badge({ label, cor }: { label: string; cor: string }) {
  const cls =
    cor === 'emerald'
      ? 'bg-emerald-50 text-emerald-700'
      : cor === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-sky-50 text-sky-700'
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

/* ───────────────── Relatório miniatura ──────────────────────── */

function RelatorioMiniatura() {
  const pontos = [74, 76, 78, 80, 82, 84, 86]
  const h = 48
  const w = 140
  const max = 90
  const min = 70
  const range = max - min
  const coords = pontos
    .map((v, i) => `${(i / (pontos.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ')

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-5 w-full max-w-sm transform rotate-1 hover:rotate-0 transition-transform duration-300">
      {/* Header */}
      <div className="border-b border-slate-100 pb-3 mb-3">
        <p className="text-[10px] font-bold tracking-wide uppercase" style={{ color: brand }}>
          AXIS ABA — Relatório de Evolução Clínica
        </p>
      </div>

      {/* Paciente */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-800">Laura Oliveira</p>
          <p className="text-[10px] text-slate-400">6a 7m</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">86.1</p>
          <Badge label="Excelente" cor="emerald" />
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-slate-50 rounded-lg p-2 mb-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" fill="none">
          <polyline
            points={coords}
            stroke={brand}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={w} cy={h - ((86 - min) / range) * h} r="3" fill={brand} />
        </svg>
        <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-1">
          <span>Set</span>
          <span>Out</span>
          <span>Nov</span>
          <span>Dez</span>
          <span>Jan</span>
          <span>Fev</span>
          <span>Mar</span>
        </div>
      </div>

      {/* Tabela dimensões */}
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-slate-400 border-b border-slate-100">
            <th className="text-left py-1 font-medium">Dimensão</th>
            <th className="text-right py-1 font-medium">Anterior</th>
            <th className="text-right py-1 font-medium">Atual</th>
          </tr>
        </thead>
        <tbody className="text-slate-600">
          <tr><td className="py-0.5">SAS</td><td className="text-right">78.2</td><td className="text-right font-semibold text-slate-800">88.4</td></tr>
          <tr><td className="py-0.5">PIS</td><td className="text-right">71.0</td><td className="text-right font-semibold text-slate-800">84.6</td></tr>
          <tr><td className="py-0.5">BSS</td><td className="text-right">69.5</td><td className="text-right font-semibold text-slate-800">83.1</td></tr>
          <tr><td className="py-0.5">TCM</td><td className="text-right">77.8</td><td className="text-right font-semibold text-slate-800">88.2</td></tr>
        </tbody>
      </table>

      {/* Rodapé */}
      <div className="mt-3 pt-2 border-t border-slate-100">
        <p className="text-[8px] text-slate-300 font-mono">
          Motor CSO-ABA v2.6.1 · SHA256: e3d8c...
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════ LANDING PAGE ═══════════════════════ */

export default function Home() {
  return (
    <>
      <SignedIn>
        <RedirectToHub />
      </SignedIn>

      <SignedOut>
        <div className="min-h-screen bg-white text-slate-800">
          {/* ─── HEADER ─── */}
          <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/axisaba.png" alt="AXIS ABA" width={140} height={40} className="h-9 w-auto" priority />
              </Link>
              <nav className="hidden md:flex items-center gap-6 text-sm text-slate-500">
                <Link href="#como-funciona" className="hover:text-slate-800 transition-colors">Como funciona</Link>
                <Link href="#planos" className="hover:text-slate-800 transition-colors">Planos</Link>
                <Link href="/sign-up" className="px-4 py-2 rounded-lg text-white font-medium transition-colors" style={{ backgroundColor: brand }}>
                  Começar grátis
                </Link>
              </nav>
            </div>
          </header>

          {/* ─── HERO ─── */}
          <section className="bg-white py-20 md:py-28">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
                Estrutura clínica real. Documentação que sustenta sua carga horária.
              </h1>
              <p className="mt-6 text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Registros organizados, evolução mensurável e relatórios que convênios não podem ignorar. Pensado para a realidade brasileira.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/demo"
                  className="px-8 py-3 rounded-lg text-white font-medium transition-colors text-base"
                  style={{ backgroundColor: brand }}
                >
                  Ver demonstração
                </Link>
                <Link
                  href="/sign-up"
                  className="px-8 py-3 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors text-base"
                >
                  Começar com 1 aprendiz
                </Link>
              </div>
            </div>
          </section>

          {/* ─── BLOCO 1 — A DOR ─── */}
          <section className="bg-slate-50 py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                Você domina a clínica. Mas a documentação ainda te vulnerabiliza.
              </h2>
              <p className="mt-6 text-base md:text-lg text-slate-500 leading-relaxed">
                Convênio questiona carga horária. Relatórios levam horas. Evolução fica em planilhas. Supervisão sem visão clara. Não é falta de competência — é falta de estrutura.
              </p>
            </div>
          </section>

          {/* ─── BLOCO 2 — O QUE É ─── */}
          <section className="bg-white py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                Organização que libera você para fazer o que importa: atender.
              </h2>
              <p className="mt-6 text-base md:text-lg text-slate-500 leading-relaxed">
                Você registra a sessão. O sistema organiza os dados. O relatório já nasce pronto. Sem improviso. Sem retrabalho.
              </p>
            </div>
          </section>

          {/* ─── BLOCO 3 — VEJA NA PRÁTICA ─── */}
          <section className="bg-slate-50 py-16 md:py-20">
            <div className="max-w-6xl mx-auto px-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-12">
                Veja na prática
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                {/* Cards de aprendizes */}
                <div className="space-y-4">
                  {aprendizes.map((a) => (
                    <div
                      key={a.nome}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{a.nome}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          CSO {a.de} → {a.para}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <MiniSparkline de={a.de} para={a.para} cor={a.cor} />
                        <Badge label={a.badge} cor={a.cor} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Relatório miniatura */}
                <div className="flex flex-col items-center gap-4">
                  <RelatorioMiniatura />
                  <p className="text-xs text-slate-400 max-w-sm text-center leading-relaxed">
                    Documento gerado automaticamente a partir de dados de sessão. Registros imutáveis. Histórico auditável.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ─── BLOCO 4 — COMO FUNCIONA ─── */}
          <section id="como-funciona" className="bg-white py-16 md:py-20">
            <div className="max-w-5xl mx-auto px-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-12">
                Como funciona
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {etapas.map((e) => {
                  const Icon = e.icon
                  return (
                    <div key={e.n} className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 relative" style={{ backgroundColor: brandLight }}>
                        <Icon className="w-6 h-6" style={{ color: brand }} />
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: brand }}>
                          {e.n}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">{e.label}</p>
                    </div>
                  )
                })}
              </div>

              {/* Seta visual entre passos (desktop) */}
              <div className="hidden md:flex justify-center mt-6">
                <div className="flex items-center gap-2 text-slate-300">
                  {[1, 2, 3, 4].map((i) => (
                    <ChevronRight key={i} className="w-4 h-4" />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ─── BLOCO 5 — RELATÓRIOS QUE DEFENDEM ─── */}
          <section className="bg-slate-50 py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-10">
                Documentação que convênio respeita.
              </h2>

              <div className="space-y-4">
                {defesas.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-base text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── BLOCO 6 — COMUNICAÇÃO COM FAMÍLIAS ─── */}
          <section className="bg-white py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: brandLight }}>
                <MessageCircle className="w-6 h-6" style={{ color: brand }} />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                Pais informados. Dados clínicos protegidos.
              </h2>
              <p className="mt-6 text-base md:text-lg text-slate-500 leading-relaxed">
                O sistema gera o resumo. Você revisa e aprova. A família recebe o progresso, não dados brutos. Tudo com consentimento registrado.
              </p>
            </div>
          </section>

          {/* ─── BLOCO 6.5 — SUPORTE INTELIGENTE (Ana) ─── */}
          <section className="bg-slate-50 py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                Dúvidas? A Ana resolve na hora.
              </h2>
              <p className="mt-4 text-base md:text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto">
                Nossa assistente virtual conhece cada detalhe do sistema e está disponível 24h dentro da plataforma.
              </p>

              {/* Card simulando chat da Ana */}
              <div className="mt-10 max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm text-left">
                {/* Header do chat */}
                <div className="flex items-center gap-3 p-5 pb-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: brandLight }}>
                    <MessageCircle className="w-[18px] h-[18px]" style={{ color: brand }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Não encontrou o que procura?</p>
                    <p className="text-xs text-slate-400">Pergunte para a Ana — ela está aqui pra ajudar.</p>
                  </div>
                </div>

                {/* Mensagens simuladas */}
                <div className="px-5 pt-4 space-y-3">
                  {/* Balão do usuário */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-white" style={{ backgroundColor: brand }}>
                      Os pais podem acessar o sistema?
                    </div>
                  </div>

                  {/* Balão da Ana */}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed bg-slate-100 text-slate-700">
                      <span className="block text-xs font-semibold mb-1" style={{ color: brand }}>Ana</span>
                      Sim, os pais podem acessar através do Portal Família. O profissional configura o acesso e eles acompanham o progresso do aprendiz.
                    </div>
                  </div>
                </div>

                {/* Input fake */}
                <div className="p-5 pt-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-400 select-none">
                      Qual sua dificuldade? Me conta...
                    </div>
                    <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white opacity-40" style={{ backgroundColor: brand }}>
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

          {/* ─── BLOCO 7 — PARA QUEM É ─── */}
          <section className="bg-slate-50 py-16 md:py-20">
            <div className="max-w-5xl mx-auto px-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-12">
                Para quem é
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {perfis.map((p) => {
                  const Icon = p.icon
                  return (
                    <div
                      key={p.titulo}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center"
                    >
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: brandLight }}>
                        <Icon className="w-6 h-6" style={{ color: brand }} />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">{p.titulo}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{p.texto}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ─── BLOCO 8 — PLANOS ─── */}
          <section id="planos" className="bg-white py-16 md:py-20">
            <div className="max-w-5xl mx-auto px-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-12">
                Planos
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Essencial */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col">
                  <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Para começar</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">Acesso Essencial</h3>
                  <div className="mt-6">
                    <span className="text-lg font-medium text-slate-500">Uso inicial</span>
                  </div>
                  <ul className="mt-8 space-y-3 flex-1">
                    {['1 aprendiz', 'Acesso completo', 'Sem prazo', 'Sem cartão'].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
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

                {/* AXIS Clínica 100 — Fundadores */}
                <div className="relative bg-white rounded-2xl border-2 shadow-md p-8 flex flex-col" style={{ borderColor: brand }}>
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: brand }}>
                    Recomendado
                  </span>
                  <p className="text-sm font-medium uppercase tracking-wide" style={{ color: brand }}>Programa Fundadores</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">AXIS Clínica 100</h3>
                  <div className="mt-6">
                    <span className="text-lg text-slate-400 line-through mr-2">R$297</span>
                    <br />
                    <span className="text-4xl font-bold text-slate-900">R$147</span>
                    <span className="text-base text-slate-500">/mês</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Preço de lançamento para os primeiros 100 clientes. Garantido enquanto mantiver a assinatura.
                  </p>
                  <ul className="mt-8 space-y-3 flex-1">
                    {[
                      'Até 100 aprendizes',
                      'Multi-terapeuta',
                      'Relatórios para convênio',
                      'Motor CSO-ABA completo',
                      'Suporte prioritário',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="https://pay.hotmart.com/H104663812P?off=u2t04kz5"
                    target="_blank"
                    className="mt-8 block w-full text-center py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
                    style={{ backgroundColor: brand }}
                  >
                    Quero ser Fundador
                  </a>
                </div>

                {/* AXIS Clínica 250 */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col">
                  <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Para clínicas maiores</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">AXIS Clínica 250</h3>
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
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="https://pay.hotmart.com/H104663812P?off=gona25or"
                    target="_blank"
                    className="mt-8 block w-full text-center py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Assinar agora
                  </a>
                </div>
              </div>

              <p className="mt-8 text-center text-sm text-slate-400">
                Clínicas com até 50 aprendizes podem começar com{' '}
                <a href="https://abasimples.com.br" target="_blank" className="underline hover:text-slate-800">AbaSimples</a>.
              </p>
            </div>
          </section>

          {/* ─── BLOCO 9 — SEGURANÇA ─── */}
          <section className="bg-slate-50 py-16 md:py-20">
            <div className="max-w-4xl mx-auto px-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-12">
                Segurança e conformidade
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {seguranca.map((s) => {
                  const Icon = s.icon
                  return (
                    <div key={s.label} className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
                        <Icon className="w-6 h-6 text-slate-700" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">{s.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ─── CTA FINAL ─── */}
          <section className="bg-white py-20 md:py-28">
            <div className="max-w-3xl mx-auto px-6 text-center">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900">
                Estruture sua clínica hoje.
              </h2>
              <p className="mt-4 text-base md:text-lg text-slate-500">
                Organize sua prática. Defenda sua carga horária. Cresça com segurança.
              </p>
              <p className="mt-6 text-sm text-slate-400 italic">
                Se sua documentação não sustenta sua carga horária, alguém vai questionar.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/demo"
                  className="px-8 py-3 rounded-lg text-white font-medium transition-colors text-base"
                  style={{ backgroundColor: brand }}
                >
                  Ver demonstração
                </Link>
                <Link
                  href="/sign-up"
                  className="px-8 py-3 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors text-base"
                >
                  Começar com 1 aprendiz
                </Link>
              </div>
            </div>
          </section>

          {/* ─── FOOTER ─── */}
          <footer className="border-t border-slate-100 bg-white py-8">
            <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-400">
                © 2026 AXIS ABA. Plataforma clínica profissional.
              </p>
              <div className="flex items-center gap-6 text-sm text-slate-400">
                <Link href="/aba/precos" className="hover:text-slate-600 transition-colors">Preços</Link>
                <Link href="/sign-up" className="hover:text-slate-600 transition-colors">Criar conta</Link>
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

  useEffect(() => {
    router.replace('/hub')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: brand }} aria-label="Carregando"></div>
        <p className="text-base text-slate-500">Carregando...</p>
      </div>
    </div>
  )
}
