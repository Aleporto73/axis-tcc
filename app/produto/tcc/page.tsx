'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Lock,
  FileText,
  Shield,
  Building,
  Brain,
  Zap,
  PenLine,
  BarChart3,
  FileCheck,
  Check,
  X,
  MessageCircle,
  Activity,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Mic,
  ListChecks,
} from 'lucide-react'

/* ─── palette ─── */
const azul = '#1a1f4e'
const azulHover = '#12163a'
const lilas = '#9a9ab8'
const lilasLight = '#b5b5cf'

/* ═══════════════════════ PAGE ═══════════════════════ */

export default function ProdutoTCCPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ────────────────── HEADER ────────────────── */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/">
            <Image src="/axis.png" alt="AXIS TCC" width={140} height={32} className="h-8 w-auto" priority />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#sistema" className="hover:text-slate-900 transition-colors">Sistema</a>
            <a href="#motor" className="hover:text-slate-900 transition-colors">Motor CSO</a>
            <a href="#documentacao" className="hover:text-slate-900 transition-colors">Documentação</a>
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
      <section className="py-24 md:py-32" style={{ backgroundColor: azul }}>
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight text-white max-w-3xl">
            Estrutura clínica para quem faz TCC de verdade.
          </h1>
          <p className="mt-6 text-lg md:text-xl max-w-2xl leading-relaxed" style={{ color: lilasLight }}>
            Registro estruturado de sessões, conceitualização cognitiva, monitoramento evolutivo e documentação com padrão institucional.
          </p>
          <div className="mt-10">
            <Link
              href="/sign-up?produto=tcc"
              className="inline-flex px-7 py-3.5 rounded-lg text-white text-base font-semibold transition-colors"
              style={{ backgroundColor: lilas }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = lilasLight)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = lilas)}
            >
              Começar com 1 paciente real
            </Link>
          </div>
          <p className="mt-4 text-sm" style={{ color: lilas }}>
            Sem cartão. Sem prazo.
          </p>
        </div>
      </section>

      {/* ────────────────── BLOCO 1 — POSICIONAMENTO ────────────────── */}
      <section id="sistema" className="bg-white py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-12">
            TCC exige estrutura. Estrutura exige sistema.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <ul className="space-y-5">
              {[
                'Conceitualização cognitiva precisa ser viva, não estatica.',
                'Registro de pensamentos automáticos se perde em anotações soltas.',
                'Evolução clínica não pode depender de memória.',
                'Documentação técnica precisa resistir a auditoria.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: azul }} />
                  <span className="text-base text-slate-600 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center">
              <p className="text-2xl md:text-3xl font-semibold text-slate-900 leading-snug">
                O AXIS organiza o que você ja faz.{' '}
                <span style={{ color: azul }}>Sem mudar seu método.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 2 — O PROBLEMA ────────────────── */}
      <section className="py-16 md:py-20" style={{ backgroundColor: '#f0f0f5' }}>
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
            Você sabe o que acontece na sessão. O problema e depois.
          </h2>
          <p className="text-base md:text-lg text-slate-500 leading-relaxed max-w-3xl mb-12">
            Anotacoes soltas, planilhas paralelas, relatórios montados na correria. O AXIS resolve isso com estrutura clínica real.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Registro se perde', desc: 'Pensamentos automáticos, distorções e técnicas aplicadas ficam em cadernos ou planilhas sem padrão.', Icon: AlertTriangle },
              { title: 'Evolução invisivel', desc: 'Sem dados estruturados, e impossível mostrar progresso real para o paciente ou para o convênio.', Icon: TrendingUp },
              { title: 'Documentação frágil', desc: 'Relatórios manuais não sustentam auditoria. Sem rastreabilidade, sem defesa técnica.', Icon: FileText },
            ].map((card) => (
              <div key={card.title} className="bg-white border border-slate-300 rounded-xl p-8">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: azul + '12' }}>
                  <card.Icon className="w-5 h-5" style={{ color: azul }} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 3 — COMO FUNCIONA ────────────────── */}
      <section className="bg-white py-16 md:py-20 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-12 text-center">
            Fluxo operacional
          </h2>
          <div className="relative">
            {/* Linha conectora (desktop) */}
            <div className="hidden md:block absolute top-7 left-[10%] right-[10%] h-px bg-slate-200" />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-4">
              {[
                { n: 1, label: 'Cadastro do paciente', Icon: Brain },
                { n: 2, label: 'Conceitualização cognitiva', Icon: Zap },
                { n: 3, label: 'Registro de sessão', Icon: PenLine },
                { n: 4, label: 'Processamento evolutivo', Icon: BarChart3 },
                { n: 5, label: 'Geração documental', Icon: FileCheck },
              ].map((step) => (
                <div key={step.n} className="flex flex-col items-center text-center relative z-10">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: azul + '10' }}>
                    <step.Icon className="w-5 h-5" style={{ color: azul }} />
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

      {/* ────────────────── BLOCO 4 — MOTOR CSO-TCC ────────────────── */}
      <section id="motor" className="py-20" style={{ backgroundColor: '#f0f0f5' }}>
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Motor CSO-TCC proprietário
          </h2>
          <p className="text-base md:text-lg text-slate-500 leading-relaxed max-w-3xl mb-12">
            O Clinical State Object calcula a evolução do paciente a cada evento clínico. Sem fórmulas manuais. Sem subjetividade.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Coluna esquerda — Dimensoes */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">
                Dimensões monitoradas
              </p>
              <div className="space-y-4">
                {[
                  { label: 'Nível de ativação', desc: 'Engajamento terapêutico e participação ativa nas sessões.', Icon: Activity },
                  { label: 'Carga emocional', desc: 'Intensidade emocional percebida a partir de eventos clínicos.', Icon: AlertTriangle },
                  { label: 'Adesão a tarefas', desc: 'Completude e consistência nas tarefas entre sessões.', Icon: ClipboardCheck },
                  { label: 'Rigidez cognitiva', desc: 'Proporção entre confrontações e esquivas ao longo do tempo. Quanto menor, mais flexível.', Icon: TrendingUp },
                ].map((dim) => (
                  <div key={dim.label} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: azul + '10' }}>
                      <dim.Icon className="w-5 h-5" style={{ color: azul }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{dim.label}</h4>
                      <p className="text-sm text-slate-500 leading-relaxed">{dim.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna direita — Sinais e eventos */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  Sinais capturados automáticamente
                </p>
                <div className="space-y-3">
                  {[
                    'Confrontação observada (CONFRONTATION_OBSERVED)',
                    'Esquiva observada (AVOIDANCE_OBSERVED)',
                    'Ajuste terapêutico (ADJUSTMENT_OBSERVED)',
                    'Recuperação observada (RECOVERY_OBSERVED)',
                    'Início / fim de sessão (SESSION_START / SESSION_END)',
                    'Tarefa concluída / não concluída (TASK_COMPLETED / TASK_INCOMPLETE)',
                    'Check de humor (MOOD_CHECK · escala 0-10)',
                  ].map((signal) => (
                    <div key={signal} className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lilas }} />
                      <span className="text-sm text-slate-600">{signal}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 leading-relaxed">
                  Cada evento gera um novo registro imutável (append-only). O sistema nunca sobrescreve dados anteriores. Histórico clínico preservado com integridade total.
                </p>
                <p className="text-xs text-slate-400 mt-3 font-mono">
                  Motor CSO-TCC v3.0.0 · Anti-duplicidade via SHA256
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 5 — REGISTRO DE SESSAO ────────────────── */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Registro estruturado de sessão
          </h2>
          <p className="text-base md:text-lg text-slate-500 leading-relaxed max-w-3xl mb-12">
            Cada sessão e registrada com estrutura clínica completa. O sistema captura o que importa sem atrapalhar o fluxo terapêutico.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Transcrição por áudio', desc: 'Grave pelo navegador ou suba o áudio do celular (MP3, WAV, M4A · até 25MB). Whisper transcreve sessões de 60+ min. Economia de 20 min por sessão.', Icon: Mic },
              { title: 'Análise TCC automática', desc: 'Identificação de pensamentos automáticos, distorções cognitivas e emoções a partir da transcrição.', Icon: Brain },
              { title: 'Tarefas entre sessões', desc: 'Atribuição e acompanhamento de tarefas com impacto direto no CSO.', Icon: ListChecks },
              { title: 'Check de humor', desc: 'Escala de humor (0-10) com impacto direto na carga emocional do CSO.', Icon: Activity },
              { title: 'Micro-eventos clínicos', desc: 'Confrontações, esquivas, ajustes e recuperações registrados dentro da sessão.', Icon: Zap },
              { title: 'Duração e aderência', desc: 'Tempo de sessão e completude das tarefas alimentam o calculo evolutivo.', Icon: Calendar },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: azul + '10' }}>
                  <item.Icon className="w-5 h-5" style={{ color: azul }} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 6 — PROVA DOCUMENTAL ────────────────── */}
      <section id="documentacao" className="py-20 md:py-24" style={{ backgroundColor: '#f0f0f5' }}>
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center">
            Veja na prática
          </h2>
          <p className="text-lg text-slate-500 text-center mt-4 mb-12">
            Relatórios gerados automáticamente a partir de dados estruturados.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Relatório mockup (55%) */}
            <div className="lg:col-span-7">
              <RelatórioTCCMockup />
              <p className="mt-4 text-xs text-slate-500 text-center lg:text-left">
                Documento gerado a partir de dados estruturados. Integridade preservada.
              </p>
            </div>

            {/* Cards laterais (45%) */}
            <div className="lg:col-span-5 space-y-4">
              {[
                { nome: 'Ana, 32 anos', cso: '0.45 → 0.72', badge: 'Progresso', desc: 'Redução consistente de esquivas', cor: '#10b981' },
                { nome: 'Carlos, 28 anos', cso: '0.60 → 0.58', badge: 'Atenção', desc: 'Oscilação na adesão a tarefas', cor: '#f59e0b' },
                { nome: 'Julia, 41 anos', cso: '0.38 → 0.71', badge: 'Excelente', desc: 'Flexibilidade cognitiva em alta', cor: '#0ea5e9' },
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
              href="/sign-up?produto=tcc"
              className="inline-block px-6 py-3 rounded-lg text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: azul }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = azulHover)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = azul)}
            >
              Gerar seu primeiro relatório
            </Link>
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 7 — SUPORTE INTELIGENTE ────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
            Dúvidas? A Ana resolve na hora.
          </h2>
          <p className="mt-4 text-base md:text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto">
            Nossa assistente virtual conhece cada detalhe do sistema e está disponível 24h dentro da plataforma.
          </p>

          {/* Chat mockup — conversa real */}
          <div className="mt-10 max-w-xl mx-auto rounded-2xl border border-slate-200 shadow-sm text-left" style={{ backgroundColor: '#f5f5f8' }}>
            {/* Header */}
            <div className="flex items-center gap-3 p-5 pb-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: azul + '12' }}>
                <MessageCircle className="w-[18px] h-[18px]" style={{ color: azul }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Não encontrou o que procura?</p>
                <p className="text-xs text-slate-400">Pergunte para a Ana — ela está aqui pra ajudar.</p>
              </div>
            </div>

            {/* Mensagens */}
            <div className="px-5 pt-4 space-y-3">
              {/* Usuário */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-white" style={{ backgroundColor: azul }}>
                  Olá, posso gravar a sessão presencial no meu celular sem estar logada no sistema?
                </div>
              </div>
              {/* Ana */}
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed bg-white text-slate-700 border border-slate-200">
                  <span className="block text-xs font-semibold mb-1" style={{ color: azul }}>Ana</span>
                  Oi! Sim, você pode gravar a sessão presencial no seu celular sem estar logada no sistema. É só usar qualquer aplicativo de gravação que você preferir. Depois, quando terminar a sessão, você pode fazer o upload do áudio no sistema. O AXIS TCC aceita arquivos em MP3, WAV e M4A, de até 25MB. Se precisar de ajuda com o upload, é só me avisar!
                </div>
              </div>
            </div>

            {/* Input + Disclaimer */}
            <div className="p-5 pt-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 select-none">
                  Qual sua dificuldade? Me conta o que você não entendeu...
                </div>
                <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white opacity-40" style={{ backgroundColor: azul }}>
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

      {/* ────────────────── BLOCO 8 — DOCUMENTACAO INSTITUCIONAL ────────────────── */}
      <section className="py-16 md:py-20" style={{ backgroundColor: '#f0f0f5' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
              Documentação com padrão institucional.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                'Estrutura compatível com auditoria',
                'Justificativa técnica de carga horária',
                'Registro longitudinal de evolução',
                'Histórico clínico preservado',
                'Modelo compatível com convênios',
                'Fundamentação metodológica declarada',
              ].map((item) => (
                <div key={item} className="group rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: azul + '10' }}>
                    <Check className="w-5 h-5" style={{ color: azul }} />
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

      {/* ────────────────── BLOCO 9 — O QUE NAO FAZ ────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8 text-center">
            O que o AXIS TCC não faz.
          </h2>
          <p className="text-base text-slate-500 text-center mb-10 max-w-2xl mx-auto">
            Transparência sobre os limites do sistema. Sem promessas exageradas.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              'Não substitui o julgamento clínico do terapeuta.',
              'Não faz diagnóstico.',
              'Não prescreve intervenções.',
              'Não interpreta resultados automáticamente.',
              'Não compartilha dados sem autorização explicita.',
              'Não gera laudos — gera relatórios estruturados.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-4 rounded-lg border border-slate-100">
                <X className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-600 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 10 — GOVERNANCA E SEGURANCA ────────────────── */}
      <section className="py-16 md:py-20" style={{ backgroundColor: '#f0f0f5' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Integridade documental', Icon: Lock },
              { label: 'Trilha de alterações', Icon: FileText },
              { label: 'LGPD aplicada', Icon: Shield },
              { label: 'Padronização institucional', Icon: Building },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-3">
                  <item.Icon className="w-6 h-6 text-slate-700" />
                </div>
                <p className="text-sm font-semibold text-slate-700">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────── BLOCO 11 — PLANOS (TABELA) ────────────────── */}
      <section id="planos" className="bg-white py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-6">

          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: azul }}>
                  <th className="text-left py-4 px-6 font-semibold w-[50%] text-white">Recurso</th>
                  <th className="text-center py-4 px-6 font-semibold text-white">
                    <span className="block">1 Paciente</span>
                    <span className="text-xs font-normal" style={{ color: lilas }}>Free</span>
                  </th>
                  <th className="text-center py-4 px-6 font-semibold text-white">
                    <span className="block">Profissional</span>
                    <span className="text-xs font-normal" style={{ color: lilas }}>R$59/mês</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {[
                  { label: 'Motor CSO-TCC completo', free: true },
                  { label: 'Registro estruturado', free: true },
                  { label: 'Transcrição por áudio', free: true },
                  { label: 'Relatório institucional', free: true },
                  { label: 'Google Calendar sync', free: false },
                  { label: 'Pacientes ilimitados', free: false },
                ].map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="py-3.5 px-6 text-slate-700 font-medium">{row.label}</td>
                    <td className="py-3.5 px-6 text-center">
                      {row.free ? (
                        <Check className="w-5 h-5 mx-auto" style={{ color: azul }} />
                      ) : (
                        <X className="w-4 h-4 mx-auto text-slate-300" />
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <Check className="w-5 h-5 mx-auto" style={{ color: azul }} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-white">
                  <td className="py-5 px-6 text-slate-900 font-bold">Investimento</td>
                  <td className="py-5 px-6 text-center">
                    <span className="text-lg font-bold text-slate-900">Sem custo</span>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <span className="text-lg font-bold text-slate-900">R$59</span>
                    <span className="text-sm text-slate-500">/mês</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-6">
            {[
              { name: '1 Paciente', price: 'Sem custo', features: ['Motor CSO-TCC completo', 'Registro estruturado', 'Transcrição por áudio', 'Relatório institucional'], href: '/sign-up?produto=tcc', cta: 'Começar com 1 paciente', highlight: false },
              { name: 'Profissional', price: 'R$59/mês', features: ['Motor CSO-TCC completo', 'Registro estruturado', 'Transcrição por áudio', 'Relatório institucional', 'Google Calendar sync', 'Pacientes ilimitados'], href: '/sign-up?produto=tcc', cta: 'Assinar Profissional', highlight: true },
            ].map((plan) => (
              <div key={plan.name} className={`bg-white rounded-xl p-6 ${plan.highlight ? 'border-2 shadow-md' : 'border border-slate-300'}`} style={plan.highlight ? { borderColor: azul } : undefined}>
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="text-2xl font-bold text-slate-900 mt-2">{plan.price}</p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 shrink-0" style={{ color: azul }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className="mt-6 block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  style={plan.highlight ? { backgroundColor: azul, color: 'white' } : { border: '1px solid #0F172A', color: '#0F172A' }}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          {/* Botoes desktop */}
          <div className="hidden md:flex gap-4 mt-6">
            <Link
              href="/sign-up?produto=tcc"
              className="flex-1 text-center py-2.5 rounded-lg border border-slate-900 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Começar com 1 paciente
            </Link>
            <Link
              href="/sign-up?produto=tcc"
              className="flex-1 text-center py-2.5 rounded-lg text-white text-sm font-semibold transition-colors"
              style={{ backgroundColor: azul }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = azulHover)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = azul)}
            >
              Assinar Profissional
            </Link>
          </div>
        </div>
      </section>

      {/* ────────────────── CTA FINAL ────────────────── */}
      <section className="py-20 md:py-24" style={{ backgroundColor: azul }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-white">
            Experimente a estrutura completa com 1 paciente real.
          </h2>
          <p className="mt-4 text-base md:text-lg" style={{ color: lilasLight }}>
            Avalie o padrão documental na prática. Sem custo. Sem cartão.
          </p>
          <div className="mt-10">
            <Link
              href="/sign-up?produto=tcc"
              className="inline-flex px-7 py-3.5 rounded-lg text-white text-base font-semibold transition-colors"
              style={{ backgroundColor: lilas }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = lilasLight)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = lilas)}
            >
              Começar com 1 paciente real
            </Link>
          </div>
          <p className="mt-4 text-sm" style={{ color: lilas }}>
            Sem cartão. Sem prazo.
          </p>
        </div>
      </section>

      {/* ────────────────── FOOTER ────────────────── */}
      <footer className="border-t border-slate-800 py-8" style={{ backgroundColor: azul }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm" style={{ color: lilas }}>
              &copy; 2026 AXIS TCC. Psiform Tecnologia.
            </p>
            <div className="flex items-center gap-6 text-sm" style={{ color: lilas }}>
              <Link href="/produto/tcc#planos" className="hover:text-white transition-colors">Preços</Link>
              <Link href="/sign-up?produto=tcc" className="hover:text-white transition-colors">Criar conta</Link>
            </div>
          </div>
          <p className="mt-4 text-xs text-center md:text-left" style={{ color: lilas + '80' }}>
            Este sistema é uma ferramenta de apoio e organização. Não substitui o julgamento clínico do profissional.
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ═══════════════════════ RELATORIO MOCKUP ═══════════════════════ */

function RelatórioTCCMockup() {
  const pontos = [0.45, 0.48, 0.52, 0.58, 0.63, 0.68, 0.72]
  const h = 48
  const w = 140
  const maxV = 0.85
  const minV = 0.35
  const range = maxV - minV
  const coords = pontos
    .map((v, i) => `${(i / (pontos.length - 1)) * w},${h - ((v - minV) / range) * h}`)
    .join(' ')

  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-md p-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 mb-4">
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: azul }}>
          AXIS TCC — Relatório de Evolução Clínica
        </p>
      </div>

      {/* Paciente */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Ana Beatriz</p>
          <p className="text-xs text-slate-400">32 anos · TAG + Depressão</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">0.72</p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            Progresso
          </span>
        </div>
      </div>

      {/* Grafico */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" fill="none">
          <polyline points={coords} stroke={azul} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={w} cy={h - ((0.72 - minV) / range) * h} r="3" fill={azul} />
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
            { dim: 'Ativação', prev: '0.50', curr: '0.68' },
            { dim: 'Carga emocional', prev: '0.72', curr: '0.45' },
            { dim: 'Adesão tarefas', prev: '0.40', curr: '0.78' },
            { dim: 'Rigidez cognitiva', prev: '0.65', curr: '0.38' },
          ].map((row) => (
            <tr key={row.dim} className="border-b border-slate-100 last:border-b-0">
              <td className="py-1.5 font-medium">{row.dim}</td>
              <td className="text-right py-1.5">{row.prev}</td>
              <td className="text-right py-1.5 font-semibold text-slate-800">{row.curr}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Rodape */}
      <div className="mt-4 pt-3 border-t border-slate-200">
        <p className="text-[9px] text-slate-300 font-mono">
          Motor CSO-TCC v3.0.0 · SHA256: a7f2b...
        </p>
      </div>
    </div>
  )
}
