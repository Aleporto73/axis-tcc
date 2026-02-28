'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Search,
  ChevronDown,
  Rocket,
  ClipboardList,
  TrendingUp,
  Lightbulb,
  FileText,
  Mic,
  BookOpen,
  MessageCircle,
  Send,
  Bot,
} from 'lucide-react'

/* ─── brand TCC ─── */
const brand = '#1a1f4e'
const brandAccent = '#9a9ab8'
const brandLight = '#eeeef4'

/* ─── types ─── */
interface HelpItem {
  title: string
  content: string[]
}

interface HelpSection {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  items: HelpItem[]
}

/* ─── data (linguagem simples e acolhedora) ─── */

const sections: HelpSection[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros Passos',
    icon: Rocket,
    items: [
      {
        title: 'Como cadastrar um paciente',
        content: [
          'Clique em "Pacientes" na barra lateral.',
          'No canto superior direito, clique em "Novo Paciente".',
          'Preencha o nome, data de nascimento e informações de contato.',
          'Salve. O paciente já aparece na sua lista e está pronto para agendar sessões.',
        ],
      },
      {
        title: 'Como criar uma sessão',
        content: [
          'Vá até "Sessões" na barra lateral.',
          'Clique em "Nova Sessão".',
          'Escolha o paciente, a data e o horário.',
          'A sessão fica agendada e pronta para ser iniciada no dia marcado.',
        ],
      },
      {
        title: 'Como conectar o Google Calendar',
        content: [
          'Acesse "Configurações" na barra lateral.',
          'Na seção "Integrações", clique em "Conectar Google Calendar".',
          'Autorize o acesso quando a janela do Google aparecer.',
          'Pronto — suas sessões agora aparecem automaticamente na sua agenda do Google.',
        ],
      },
      {
        title: 'Entendendo o painel principal',
        content: [
          'O painel mostra um resumo do seu consultório.',
          'Você vê quantas sessões tem na semana e o progresso dos seus pacientes.',
          'Alertas aparecem quando algo precisa da sua atenção — como tarefas pendentes ou pacientes sem sessão recente.',
          'Pense no painel como seu "mural de avisos" digital.',
        ],
      },
    ],
  },
  {
    id: 'registro-sessao',
    title: 'Registro de Sessão',
    icon: ClipboardList,
    items: [
      {
        title: 'Como iniciar uma sessão',
        content: [
          'Na tela de Sessões, encontre a sessão agendada para hoje.',
          'Clique em "Iniciar". O cronômetro começa automaticamente.',
          'Se não tem sessão agendada, você pode criar uma na hora.',
        ],
      },
      {
        title: 'Como usar a gravação de áudio',
        content: [
          'Você tem duas opções: gravar direto pelo navegador (botão de microfone na sessão) ou gravar no celular e subir o arquivo depois.',
          'Para gravar pelo navegador: clique no microfone, uma bolinha vermelha indica que está gravando. Clique de novo para parar.',
          'Para subir um áudio gravado no celular: na página do paciente, use o botão de upload. Aceita MP3, WAV e M4A, de até 25MB.',
          'Nos dois casos, o sistema transcreve tudo automaticamente. Você economiza cerca de 20 minutos por sessão.',
        ],
      },
      {
        title: 'Como registrar o que aconteceu na sessão',
        content: [
          'Use o campo de anotações para escrever os pontos principais.',
          'Se você gravou o áudio, a transcrição já estará disponível — basta revisar.',
          'Você pode adicionar observações sobre o humor do paciente, temas abordados e próximos passos.',
        ],
      },
      {
        title: 'Como atribuir tarefas para o paciente fazer em casa',
        content: [
          'Dentro da sessão, vá até a seção "Tarefas entre sessões".',
          'Clique em "Nova Tarefa" e descreva a atividade.',
          'O sistema lembra você de verificar o andamento na próxima sessão.',
          'Você pode acompanhar todas as tarefas pendentes no painel do paciente.',
        ],
      },
      {
        title: 'Como finalizar a sessão',
        content: [
          'Clique em "Finalizar Sessão" quando terminar o atendimento.',
          'O sistema salva tudo: anotações, gravação, transcrição e tarefas.',
          'Um registro permanente é gerado — ele não pode ser alterado depois, garantindo a integridade dos dados.',
          'Esse registro recebe um código de autenticidade que comprova que o documento é original.',
        ],
      },
    ],
  },
  {
    id: 'evolucao-paciente',
    title: 'Evolução do Paciente',
    icon: TrendingUp,
    items: [
      {
        title: 'O que é o índice de evolução (CSO)',
        content: [
          'CSO é o índice que mostra como o paciente está progredindo ao longo do tempo.',
          'Internamente, ele vai de 0 a 1 — mas na tela você vê as faixas: Excelente, Bom, Atenção ou Crítico.',
          'O sistema calcula tudo automaticamente com base no que você registra nas sessões.',
          'Você não precisa fazer nenhuma conta — só acompanhar.',
        ],
      },
      {
        title: 'Como o sistema calcula o progresso',
        content: [
          'O sistema acompanha 4 coisas sobre cada paciente:',
          'Ativação (activation_level) — o quanto o paciente está engajado e participando das sessões.',
          'Carga emocional (emotional_load) — a intensidade emocional que ele está sentindo.',
          'Adesão às tarefas (task_adherence) — se ele está fazendo as atividades que você passou.',
          'Rigidez cognitiva (cognitive_rigidity) — se ele está conseguindo mudar padrões de pensamento ou ainda está preso em esquivas.',
          'Cada uma dessas áreas vale 25% do índice total.',
        ],
      },
      {
        title: 'O que significam os indicadores',
        content: [
          'Excelente (0.85–1.00): evolução consistente, o paciente está respondendo bem.',
          'Bom (0.70–0.84): progresso adequado, continue acompanhando normalmente.',
          'Atenção (0.50–0.69): possível estagnação — vale conversar com o paciente sobre o que pode estar travando.',
          'Crítico (0.00–0.49): pouco progresso ou falta de dados — vale revisar a abordagem.',
        ],
      },
      {
        title: 'Como ver o histórico completo',
        content: [
          'Abra o perfil do paciente e clique na aba "Evolução".',
          'Você verá um gráfico com a linha do tempo de todas as sessões.',
          'Pode filtrar por período para comparar momentos diferentes do tratamento.',
          'Cada ponto no gráfico corresponde a uma sessão registrada.',
        ],
      },
      {
        title: 'Por que os dados nunca são apagados',
        content: [
          'Cada sessão gera um registro permanente que não pode ser alterado.',
          'Isso garante a integridade da documentação para fins éticos e legais.',
          'Mesmo que o paciente encerre o tratamento, o histórico fica preservado.',
          'É a sua segurança como profissional — e a do paciente também.',
        ],
      },
    ],
  },
  {
    id: 'sugestoes-sistema',
    title: 'Sugestões do Sistema',
    icon: Lightbulb,
    items: [
      {
        title: 'Como funcionam as sugestões',
        content: [
          'Com base nos dados que você registra, o sistema pode identificar padrões e oferecer sugestões.',
          'O sistema gera no máximo 1 sugestão por ciclo — ele avalia vários candidatos e mostra só o mais relevante.',
          'Existem 11 tipos de sugestão, como: verificar adesão às tarefas, pausar exposição, regulação emocional, celebrar progresso, entre outros.',
          'As sugestões aparecem como cards na tela de Sugestões e no painel do paciente.',
        ],
      },
      {
        title: 'Como aprovar, editar ou ignorar uma sugestão',
        content: [
          'Cada sugestão tem três opções: Aprovar, Editar ou Ignorar.',
          'Aprovar — você concorda e o sistema registra a decisão.',
          'Editar — você ajusta o texto antes de aprovar.',
          'Ignorar — a sugestão some e não volta a aparecer.',
          'Nenhuma sugestão é executada automaticamente. Você sempre decide.',
        ],
      },
      {
        title: 'Por que às vezes o sistema não sugere nada',
        content: [
          'Isso acontece quando nenhuma das regras internas é acionada pelos dados atuais do paciente.',
          'O sistema simplesmente não gera sugestão se não tem algo relevante para dizer — é o comportamento normal.',
          'Conforme você registra mais sessões, as sugestões aparecem com mais frequência.',
          'Também pode acontecer se o paciente é novo e ainda não tem dados suficientes.',
        ],
      },
      {
        title: 'Quem decide sou eu, não o sistema',
        content: [
          'O AXIS TCC nunca toma decisões por você.',
          'Ele organiza dados, identifica padrões e oferece sugestões — mas a decisão é 100% sua.',
          'Nenhuma sugestão substitui seu julgamento clínico.',
          'O sistema é uma ferramenta de apoio, não de substituição.',
        ],
      },
    ],
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    icon: FileText,
    items: [
      {
        title: 'Como ver o relatório de evolução',
        content: [
          'Abra o perfil do paciente e clique na aba "Relatórios".',
          'Selecione o período que deseja visualizar.',
          'O sistema monta o relatório automaticamente com gráficos e resumos.',
          'Inclui o índice de evolução, frequência de sessões e observações registradas.',
        ],
      },
      {
        title: 'Como exportar em PDF',
        content: [
          'Após gerar o relatório, clique em "Exportar PDF".',
          'O navegador abre a tela de impressão — escolha "Salvar como PDF" como destino.',
          'O documento inclui layout profissional, seus dados de identificação e um código de autenticidade no rodapé.',
          'Pronto para enviar por e-mail ou imprimir.',
        ],
      },
      {
        title: 'O que é o código de autenticidade',
        content: [
          'Cada relatório recebe um código único no momento em que é gerado.',
          'Esse código funciona como uma "impressão digital" do documento.',
          'Se qualquer parte do relatório for alterada depois, o código deixa de ser válido.',
          'Serve como garantia de que o relatório não foi adulterado.',
        ],
      },
      {
        title: 'Como usar em convênios',
        content: [
          'O relatório do AXIS TCC foi projetado para atender as exigências de operadoras de saúde.',
          'Inclui dados objetivos: frequência de sessões, evolução medida e justificativa de carga horária.',
          'O código de autenticidade dá credibilidade ao documento.',
          'Basta exportar o PDF e enviar para o convênio.',
        ],
      },
    ],
  },
  {
    id: 'gravacao-transcricao',
    title: 'Gravação e Transcrição',
    icon: Mic,
    items: [
      {
        title: 'Como gravar a sessão',
        content: [
          'Opção 1 — Pelo navegador: dentro da sessão, clique no botão de microfone. A gravação começa imediatamente (formato WebM).',
          'Opção 2 — Pelo celular: grave a sessão com qualquer app de gravação do celular. Depois, suba o arquivo no sistema.',
          'Para subir o arquivo: na página do paciente, clique no botão de upload. Aceita MP3, WAV e M4A, de até 25MB.',
          'Não precisa estar logado durante a sessão presencial — grave no celular e suba depois, no seu tempo.',
        ],
      },
      {
        title: 'Como funciona a transcrição automática',
        content: [
          'O sistema usa o Whisper (tecnologia da OpenAI) para converter áudio em texto, em português.',
          'Áudios curtos (até 5MB) são transcritos direto. Áudios maiores são divididos em pedaços de 5 minutos e processados automaticamente.',
          'Sessões longas de até 60 minutos ou mais funcionam sem problema — você acompanha o progresso na tela.',
          'Você pode revisar e editar o texto depois. A transcrição fica vinculada à sessão e aparece no histórico do paciente.',
        ],
      },
      {
        title: 'O que o sistema identifica na conversa',
        content: [
          'O sistema analisa a transcrição para identificar temas recorrentes, emoções predominantes e pontos importantes.',
          'Essas informações alimentam o índice de evolução e as sugestões.',
          'Tudo é feito de forma automática — você não precisa marcar nada manualmente.',
          'As informações são usadas apenas para organizar seus dados, nunca para tomar decisões.',
        ],
      },
      {
        title: 'Quanto tempo eu economizo',
        content: [
          'Em média, terapeutas economizam 20 minutos por sessão com a gravação e transcrição.',
          'Sem o sistema, você precisaria anotar tudo durante ou depois da sessão.',
          'Com a transcrição automática, basta revisar e ajustar.',
          'Ao final do mês, são horas a mais para você dedicar a outros pacientes — ou a si mesmo.',
        ],
      },
    ],
  },
  {
    id: 'glossario',
    title: 'Glossário',
    icon: BookOpen,
    items: [
      { title: 'Sessão', content: ['Encontro entre o terapeuta e o paciente, registrado no sistema com data, duração, anotações e gravação (quando houver).'] },
      { title: 'Paciente', content: ['A pessoa que está em atendimento terapêutico. No AXIS TCC, cada paciente tem um perfil com histórico completo.'] },
      { title: 'Tarefa entre sessões', content: ['Atividade que o terapeuta pede para o paciente fazer em casa entre um atendimento e outro. O sistema acompanha se foi feita.'] },
      { title: 'Transcrição', content: ['Conversão automática do áudio da sessão em texto usando Whisper (OpenAI). Aceita áudios de até 25MB (MP3, WAV, M4A). Permite revisar o que foi dito sem ouvir a gravação inteira.'] },
      { title: 'Evolução', content: ['Acompanhamento do progresso do paciente ao longo do tempo, medido pelo índice de evolução (CSO) e pelos registros de sessão.'] },
      { title: 'Indicador', content: ['Cada uma das 4 áreas que compõem o índice de evolução: ativação (engajamento), carga emocional, adesão às tarefas e rigidez cognitiva.'] },
      { title: 'Sugestão', content: ['Observação gerada automaticamente pelo sistema com base nos dados registrados. O sistema gera no máximo 1 por ciclo. O terapeuta decide se aceita, edita ou ignora.'] },
      { title: 'Relatório', content: ['Documento gerado pelo sistema com o resumo da evolução do paciente. Exportado em PDF via impressão do navegador. Inclui código de autenticidade SHA256.'] },
      { title: 'CSO (índice de evolução)', content: ['Índice de 0 a 1 (normalizado) que resume o progresso do paciente em 4 áreas: ativação, carga emocional, adesão às tarefas e rigidez cognitiva. Calculado automaticamente.'] },
      { title: 'Histórico', content: ['Registro completo e permanente de todas as sessões, anotações, transcrições e relatórios do paciente. Nunca é apagado.'] },
    ],
  },
]

/* ─── highlight helper ─── */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term.trim()) return <>{text}</>
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

/* ─── accordion item ─── */
function AccordionItem({
  item,
  isOpen,
  onToggle,
  searchTerm,
}: {
  item: HelpItem
  isOpen: boolean
  onToggle: () => void
  searchTerm: string
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [measuredHeight, setMeasuredHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setMeasuredHeight(contentRef.current.scrollHeight)
    }
  }, [isOpen, item.content])

  useEffect(() => {
    const handleResize = () => {
      if (contentRef.current && isOpen) {
        setMeasuredHeight(contentRef.current.scrollHeight)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3.5 px-4 text-left hover:bg-slate-50/50 transition-colors rounded-lg"
      >
        <span className="text-sm font-medium text-slate-700 pr-2">
          <Highlight text={item.title} term={searchTerm} />
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        style={{
          maxHeight: isOpen ? `${measuredHeight + 32}px` : '0px',
          opacity: isOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s ease, opacity 0.25s ease',
        }}
      >
        <div ref={contentRef} className="px-4 pt-1 pb-5">
          <ul className="space-y-3">
            {item.content.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: brandAccent }}
                />
                <Highlight text={line} term={searchTerm} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ─── section accordion ─── */
function SectionAccordion({
  section,
  searchTerm,
  forceOpen,
}: {
  section: HelpSection
  searchTerm: string
  forceOpen: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())
  const contentRef = useRef<HTMLDivElement>(null)
  const [measuredHeight, setMeasuredHeight] = useState(0)

  const expanded = forceOpen || isOpen

  useEffect(() => {
    if (contentRef.current) {
      const timer1 = setTimeout(() => {
        if (contentRef.current) {
          setMeasuredHeight(contentRef.current.scrollHeight)
        }
      }, 60)
      const timer2 = setTimeout(() => {
        if (contentRef.current) {
          setMeasuredHeight(contentRef.current.scrollHeight)
        }
      }, 400)
      return () => { clearTimeout(timer1); clearTimeout(timer2) }
    }
  }, [expanded, openItems, section.items])

  useEffect(() => {
    if (forceOpen && searchTerm) {
      const matching = new Set<number>()
      section.items.forEach((item, i) => {
        const term = searchTerm.toLowerCase()
        if (
          item.title.toLowerCase().includes(term) ||
          item.content.some((c) => c.toLowerCase().includes(term))
        ) {
          matching.add(i)
        }
      })
      setOpenItems(matching)
    }
  }, [forceOpen, searchTerm, section.items])

  const toggleItem = useCallback((index: number) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const Icon = section.icon

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="w-full flex items-center gap-4 p-5 md:p-6 text-left"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: brandLight }}
        >
          <Icon className="w-5 h-5" style={{ color: brand }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-800">
            <Highlight text={section.title} term={searchTerm} />
          </h2>
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
          {section.items.length}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        style={{
          maxHeight: expanded ? `${measuredHeight + 64}px` : '0px',
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.4s ease, opacity 0.3s ease',
        }}
      >
        <div ref={contentRef} className="px-5 md:px-6 pb-5 md:pb-6">
          <div className="border-t border-slate-100 pt-2">
            {section.items.map((item, i) => (
              <AccordionItem
                key={i}
                item={item}
                isOpen={openItems.has(i)}
                onToggle={() => toggleItem(i)}
                searchTerm={searchTerm}
              />
            ))}

            <div className="pt-3 pb-1 text-right">
              <a
                href="#chat-ana"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('chat-ana')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-sm italic transition-colors"
                style={{ color: brandAccent }}
              >
                Não encontrou? Pergunte para Ana ↓
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════ PAGE ═══════════════════════ */

interface ChatMessage {
  role: 'user' | 'ana'
  content: string
}

export default function AjudaPage() {
  const [search, setSearch] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || isLoading) return

    setChatInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat-ana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.ok) {
        throw new Error('Erro na resposta')
      }

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'ana', content: data.reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ana', content: 'Desculpe, tive um problema ao processar sua pergunta. Tente novamente em alguns segundos.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [chatInput, isLoading])

  const filtered = useMemo(() => {
    if (!search.trim()) return sections

    const term = search.toLowerCase()
    return sections
      .map((section) => {
        const titleMatch = section.title.toLowerCase().includes(term)
        const matchingItems = section.items.filter(
          (item) =>
            item.title.toLowerCase().includes(term) ||
            item.content.some((c) => c.toLowerCase().includes(term))
        )
        if (titleMatch || matchingItems.length > 0) {
          return {
            ...section,
            items: titleMatch ? section.items : matchingItems,
          }
        }
        return null
      })
      .filter(Boolean) as HelpSection[]
  }, [search])

  return (
    <div className="min-h-screen bg-slate-50" style={{ scrollBehavior: 'smooth' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand }}>
            Central de Ajuda
          </h1>
          <p className="mt-2 text-base text-slate-500">
            Tire suas dúvidas sobre o AXIS TCC no seu ritmo.
          </p>
        </div>

        {/* ─── Card Ana (assistente virtual) ─── */}
        <div
          className="mb-8 rounded-2xl bg-white p-5 md:p-6 flex items-center gap-4 shadow-sm"
          style={{ border: `1.5px solid ${brand}` }}
        >
          <div
            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: brandLight }}
          >
            <Bot className="w-6 h-6 md:w-7 md:h-7" style={{ color: brand }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-semibold text-slate-800">
              Pergunte para Ana, sua assistente virtual
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Tire suas dúvidas sobre o sistema de forma rápida
            </p>
          </div>
        </div>

        {/* ─── Search ─── */}
        <div className="relative max-w-lg mx-auto mb-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tema..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors shadow-sm"
            style={{
              // @ts-expect-error CSS custom focus styles
              '--tw-ring-color': `${brandAccent}40`,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Limpar
            </button>
          )}
        </div>

        {/* ─── Sections ─── */}
        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((section) => (
              <SectionAccordion
                key={section.id}
                section={section}
                searchTerm={search}
                forceOpen={search.trim().length > 0}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">
              Nenhum resultado encontrado para &quot;{search}&quot;
            </p>
            <button
              onClick={() => setSearch('')}
              className="mt-3 text-sm font-medium transition-colors"
              style={{ color: brand }}
            >
              Limpar busca
            </button>
          </div>
        )}

        {/* ─── Chat da Ana (integrado) ─── */}
        <div id="chat-ana" className="mt-14 bg-white rounded-2xl border border-slate-200 shadow-sm scroll-mt-8 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 p-5 md:p-6 pb-0 md:pb-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: brandLight }}
            >
              <MessageCircle style={{ color: brand, width: 18, height: 18 }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Não encontrou o que procura?
              </p>
              <p className="text-xs text-slate-400">
                Pergunte para a Ana — ela está aqui pra ajudar.
              </p>
            </div>
          </div>

          {/* Histórico de mensagens */}
          {messages.length > 0 && (
            <div className="px-5 md:px-6 pt-4 max-h-96 overflow-y-auto space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-700 rounded-bl-md'
                    }`}
                    style={msg.role === 'user' ? { backgroundColor: brand } : undefined}
                  >
                    {msg.role === 'ana' && (
                      <span className="block text-xs font-semibold mb-1" style={{ color: brand }}>
                        Ana
                      </span>
                    )}
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  </div>
                </div>
              ))}

              {/* Indicador de loading */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                    <span className="block text-xs font-semibold mb-1" style={{ color: brand }}>
                      Ana
                    </span>
                    <span className="flex items-center gap-1 text-sm text-slate-400">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="ml-2">Ana está digitando...</span>
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="p-5 md:p-6 pt-4 md:pt-4">
            <div className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Qual sua dificuldade? Me conta o que você não entendeu..."
                rows={2}
                disabled={isLoading}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50"
                style={{
                  // @ts-expect-error CSS custom focus styles
                  '--tw-ring-color': `${brandAccent}40`,
                }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !chatInput.trim()}
                className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white transition-colors hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: brand }}
                aria-label="Enviar mensagem"
              >
                <Send style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-3 text-center">
              A Ana é uma assistente virtual. Suas respostas não substituem orientação profissional.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
