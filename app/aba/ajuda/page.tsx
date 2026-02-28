'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Search,
  ChevronDown,
  Rocket,
  ClipboardList,
  Brain,
  FileText,
  Users,
  Shield,
  BookOpen,
  MessageCircle,
  Send,
  Bot,
} from 'lucide-react'

/* ─── brand ─── */
const brand = '#c46a50'
const brandLight = '#f5ebe7'

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

/* ─── data (linguagem simplificada) ─── */

const sections: HelpSection[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros Passos',
    icon: Rocket,
    items: [
      {
        title: 'Como cadastrar um aprendiz',
        content: [
          'Acesse o menu Aprendizes na barra lateral.',
          'Clique em "Novo Aprendiz" no canto superior direito.',
          'Preencha nome, data de nascimento e responsável.',
          'Salve. O aprendiz já aparece no painel principal.',
        ],
      },
      {
        title: 'Como criar um protocolo de intervenção',
        content: [
          'Abra o perfil do aprendiz e acesse a aba PEI (Plano Educacional Individualizado).',
          'Clique em "Novo Protocolo".',
          'Defina o título, domínio, objetivo, prática EBP (baseada em evidência) e os critérios de maestria (% de acerto, nº de sessões, nº de trials).',
          'Opcionalmente vincule a uma meta do PEI para rastreabilidade completa.',
          'O protocolo começa como "rascunho" e segue o ciclo: rascunho → ativo → dominado → generalização → validado → manutenção → mantido.',
        ],
      },
      {
        title: 'Como agendar a primeira sessão',
        content: [
          'Vá ao menu Sessões na barra lateral.',
          'Clique em "Nova Sessão".',
          'Selecione o aprendiz, a data e o terapeuta responsável.',
          'A sessão aparece na agenda e pode ser iniciada no horário marcado.',
        ],
      },
      {
        title: 'Entendendo o painel principal',
        content: [
          'O painel mostra um resumo geral da clínica.',
          'CSO-ABA dos aprendizes ativos com faixas de evolução (Excelente, Bom, Atenção, Crítico).',
          'Sessões realizadas na semana.',
          'Alertas de regressão ou protocolos sem sessão recente.',
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
          'Na tela de Sessões, encontre a sessão agendada.',
          'Clique em "Iniciar". O cronômetro começa automaticamente.',
          'Se não há sessão agendada, crie uma nova antes de iniciar.',
        ],
      },
      {
        title: 'Registrando tentativas de ensino (trials)',
        content: [
          'Dentro da sessão ativa, selecione o protocolo e o alvo (habilidade).',
          'Registre o total de tentativas e quantas foram corretas.',
          'Informe o nível de ajuda (prompt) usado: independente, gestual, verbal, modelação, física parcial ou física total.',
          'O sistema calcula a porcentagem de acerto automaticamente e usa esses dados no cálculo do SAS e do PIS.',
        ],
      },
      {
        title: 'Registrando comportamentos ABC (antecedente, comportamento, consequência)',
        content: [
          'Use a aba "Comportamento" na sessão ativa.',
          'Registre o que aconteceu antes (antecedente), o comportamento observado e o que aconteceu depois (consequência).',
          'Informe a intensidade do comportamento: leve, moderada, alta ou severa — isso alimenta o BSS.',
          'Opcionalmente registre a duração em segundos, o local e a hipótese funcional.',
          'Cada registro é salvo com horário automático.',
        ],
      },
      {
        title: 'Finalizando a sessão e gerando o snapshot',
        content: [
          'Clique em "Finalizar Sessão" quando terminar.',
          'O sistema gera um snapshot (registro permanente e imutável) com os valores de CSO-ABA, SAS, PIS, BSS e TCM daquele momento.',
          'O snapshot registra também a versão do motor de cálculo usada (Engine Version Lock).',
          'Uma vez gerado, não pode ser alterado — garante a integridade da documentação.',
        ],
      },
      {
        title: 'O que é o snapshot e por que é importante',
        content: [
          'É uma cópia fiel e imutável dos dados da sessão, criada no momento do fechamento.',
          'Contém todos os indicadores calculados: CSO-ABA, SAS, PIS, BSS, TCM e a faixa interpretativa.',
          'Uma vez gerado, não pode ser alterado nem excluído por ninguém (append-only).',
          'Garante a integridade da documentação para auditorias, convênios e supervisão.',
        ],
      },
    ],
  },
  {
    id: 'motor-cso',
    title: 'Índice de Situação Clínica (CSO)',
    icon: Brain,
    items: [
      {
        title: 'O que é o CSO-ABA',
        content: [
          'CSO-ABA (Clinical State Object) é o índice de evolução clínica do sistema.',
          'Ele transforma os dados das sessões em um número de 0 a 100, fácil de interpretar.',
          'Quanto maior, melhor a evolução documentada do aprendiz.',
          'É calculado automaticamente a cada sessão finalizada e armazenado de forma permanente (append-only).',
        ],
      },
      {
        title: 'As 4 dimensões que compõem o CSO-ABA',
        content: [
          'SAS (Skill Acquisition Score) — Aquisição de habilidades: mede a taxa de acerto nos alvos ativos, ponderada pelo número de tentativas, combinada com o percentual de alvos já dominados.',
          'PIS (Prompt Independence Score) — Independência de dicas: mede o quanto o aprendiz está respondendo sem ajuda. Vai de física total (mais ajuda) até independente (sem ajuda nenhuma). Quanto menos dica, maior o PIS.',
          'BSS (Behavioral Stability Score) — Estabilidade comportamental: mede a intensidade dos comportamentos-alvo (leve, moderada, alta, severa) e a tendência ao longo do tempo. Quanto menor a intensidade, maior o BSS.',
          'TCM (Therapeutic Consistency Metric) — Consistência terapêutica: mede o quanto os resultados estão estáveis entre as últimas 5 sessões. Menos variação = maior consistência. Com menos de 2 sessões, assume valor neutro (75).',
        ],
      },
      {
        title: 'Como interpretar as faixas de pontuação',
        content: [
          'Excelente (85–100): evolução consistente, documentação sólida.',
          'Bom (70–84): progresso adequado, acompanhar normalmente.',
          'Atenção (50–69): possível estagnação — vale revisar o protocolo.',
          'Crítico (0–49): regressão ou falta de dados — necessita ação imediata.',
        ],
      },
      {
        title: 'Por que cada dimensão tem o mesmo peso (25%)',
        content: [
          'A fórmula é: CSO-ABA = (0.25 × SAS) + (0.25 × PIS) + (0.25 × BSS) + (0.25 × TCM).',
          'Os pesos são fixos e iguais (25% cada) — padrão nacional, não ajustável por clínica.',
          'Isso evita que uma única dimensão distorça a avaliação geral.',
          'A decisão clínica continua com o profissional — o CSO-ABA organiza os dados, não toma decisões.',
        ],
      },
      {
        title: 'O CSO-ABA é uma ferramenta de apoio, não um diagnóstico',
        content: [
          'O CSO-ABA não diagnostica nem classifica o aprendiz.',
          'Ele organiza os dados de sessão para facilitar a supervisão e a documentação.',
          'Nunca deve ser usado isoladamente para decisões clínicas.',
          'É uma ferramenta de suporte ao profissional, não de substituição do seu julgamento.',
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
        title: 'Como gerar um relatório de evolução',
        content: [
          'Acesse Relatórios na barra lateral.',
          'Selecione o aprendiz e o período desejado.',
          'Clique em "Gerar Relatório". O documento é montado automaticamente.',
          'Inclui o CSO-ABA com as 4 dimensões (SAS, PIS, BSS, TCM), gráficos de evolução e resumo por área.',
        ],
      },
      {
        title: 'Relatório para convênio (ANS/SBNI)',
        content: [
          'Use o modelo "Relatório para Convênio" na tela de Relatórios.',
          'O sistema preenche automaticamente a justificativa de carga horária.',
          'A estrutura é compatível com as exigências da ANS e fundamentação SBNI 2025.',
          'Inclui dados objetivos que sustentam a necessidade do tratamento.',
        ],
      },
      {
        title: 'Exportar relatório em PDF',
        content: [
          'Após gerar o relatório, clique em "Exportar PDF".',
          'O documento é gerado com layout profissional e cabeçalho da clínica.',
          'Inclui um código de autenticidade no rodapé, para comprovar que o relatório é original.',
        ],
      },
      {
        title: 'O que é o código de autenticidade do relatório',
        content: [
          'Cada relatório recebe um código único no momento em que é gerado.',
          'Esse código funciona como uma "impressão digital" do documento.',
          'Se qualquer parte do relatório for alterada depois, o código deixa de ser válido.',
          'Serve como garantia de que o relatório não foi adulterado.',
        ],
      },
      {
        title: 'Justificativa de carga horária no relatório',
        content: [
          'O relatório inclui uma seção específica de justificativa.',
          'É baseada em dados reais: frequência de sessões, evolução medida e protocolos ativos.',
          'Fundamenta a necessidade de cada hora de atendimento com evidência documental.',
        ],
      },
    ],
  },
  {
    id: 'portal-familia',
    title: 'Portal Família',
    icon: Users,
    items: [
      {
        title: 'Como ativar o Portal Família',
        content: [
          'Acesse Configurações e ative a opção "Portal Família".',
          'Defina quais aprendizes terão o portal habilitado.',
          'O responsável recebe um link de acesso por e-mail.',
        ],
      },
      {
        title: 'Consentimento obrigatório (LGPD)',
        content: [
          'Antes de compartilhar qualquer informação, o responsável precisa dar o consentimento.',
          'O sistema registra automaticamente a data, hora e origem do consentimento.',
          'Sem consentimento, nenhuma informação é exibida no portal.',
        ],
      },
      {
        title: 'O que os pais conseguem ver (e o que não)',
        content: [
          'Podem ver: resumo de evolução, frequência de sessões e marcos alcançados.',
          'Não podem ver: dados detalhados de sessão, anotações clínicas nem registros de comportamento.',
          'O conteúdo mostrado é um resumo aprovado pelo profissional.',
        ],
      },
      {
        title: 'Envio de resumo após cada sessão',
        content: [
          'Após finalizar a sessão, o sistema gera um resumo para a família.',
          'O terapeuta revisa e aprova antes do envio.',
          'A família recebe uma notificação com o resumo no portal.',
        ],
      },
    ],
  },
  {
    id: 'equipe-permissoes',
    title: 'Equipe e Permissões',
    icon: Shield,
    items: [
      {
        title: 'Tipos de acesso: Administrador, Supervisor, Terapeuta',
        content: [
          'Administrador: acesso total — gerencia equipe, configurações e dados da clínica.',
          'Supervisor: visualiza todos os aprendizes, gera relatórios e acompanha a equipe.',
          'Terapeuta: acessa apenas seus próprios aprendizes e sessões.',
        ],
      },
      {
        title: 'Como convidar alguém para a equipe',
        content: [
          'Acesse Equipe na barra lateral (visível apenas para administradores).',
          'Clique em "Convidar Membro".',
          'Insira o e-mail e selecione o tipo de acesso.',
          'O convidado recebe um link para criar a conta.',
        ],
      },
      {
        title: 'O que cada tipo de acesso pode ver e fazer',
        content: [
          'Administrador: tudo, incluindo Equipe, Configurações e dados financeiros.',
          'Supervisor: Painel, todos os Aprendizes, todas as Sessões, PEI e Relatórios.',
          'Terapeuta: Painel resumido, seus Aprendizes e suas Sessões.',
        ],
      },
      {
        title: 'Transferir a administração para outra pessoa',
        content: [
          'Apenas o administrador atual pode fazer essa transferência.',
          'Acesse Equipe, selecione o membro e clique em "Promover a Administrador".',
          'Após a transferência, seu acesso muda automaticamente para Supervisor.',
          'Essa ação fica registrada no histórico do sistema.',
        ],
      },
    ],
  },
  {
    id: 'glossario',
    title: 'Glossário ABA',
    icon: BookOpen,
    items: [
      { title: 'Registro ABC', content: ['Antecedente, Comportamento e Consequência. Modelo para registrar o que acontece antes, durante e depois de um comportamento na sessão.'] },
      { title: 'Alvo', content: ['Habilidade específica que está sendo ensinada dentro de um protocolo de intervenção.'] },
      { title: 'Linha de base (Baseline)', content: ['Medição inicial do desempenho do aprendiz antes de começar a intervenção.'] },
      { title: 'CSO-ABA (Clinical State Object)', content: ['Índice de 0 a 100 que organiza os dados clínicos em 4 dimensões: SAS (aquisição de habilidades), PIS (independência de dicas), BSS (estabilidade comportamental) e TCM (consistência terapêutica). Cada dimensão vale 25%.'] },
      { title: 'SAS (Skill Acquisition Score)', content: ['Dimensão do CSO-ABA que mede a aquisição de habilidades. Calcula a média ponderada de acertos por tentativas nos alvos ativos, combinada com a taxa de alvos já dominados.'] },
      { title: 'PIS (Prompt Independence Score)', content: ['Dimensão do CSO-ABA que mede a independência de dicas. Baseada nos 6 níveis de prompt: independente (1.0), gestual (0.8), verbal (0.6), modelação (0.4), física parcial (0.2), física total (0.0). Quanto menos ajuda, maior o PIS.'] },
      { title: 'BSS (Behavioral Stability Score)', content: ['Dimensão do CSO-ABA que mede a estabilidade comportamental. Baseada na intensidade dos comportamentos (leve, moderada, alta, severa) e na tendência ao longo do tempo. Menos comportamentos intensos = maior BSS.'] },
      { title: 'TCM (Therapeutic Consistency Metric)', content: ['Dimensão do CSO-ABA que mede a consistência dos resultados entre as últimas 5 sessões. Usa o coeficiente de variação (CV). Menos variação = mais consistência. Com menos de 2 sessões, assume valor neutro (75).'] },
      { title: 'Área de desenvolvimento (Domínio)', content: ['Categoria ampla como comunicação, habilidades sociais, acadêmico ou comportamento adaptativo.'] },
      { title: 'EBP (Evidence-Based Practice)', content: ['Prática Baseada em Evidência. Cada protocolo é vinculado a uma EBP catalogada, garantindo fundamentação científica.'] },
      { title: 'Ensino por tentativas (DTT)', content: ['Método de ensino estruturado: o terapeuta dá uma instrução, o aprendiz responde e recebe uma consequência.'] },
      { title: 'Redução de ajuda (Fading)', content: ['Diminuição gradual da ajuda fornecida ao aprendiz, conforme ele ganha independência. Os 6 níveis de prompt vão de física total até independente.'] },
      { title: 'Generalização 3×2', content: ['Grid de verificação com 3 variações de estímulo × 2 variações de contexto = 6 células. Todas as 6 células precisam atingir o critério de maestria para o protocolo avançar automaticamente para "validado".'] },
      { title: 'Manutenção', content: ['Sondas periódicas em 2, 6 e 12 semanas após o protocolo ser considerado "mantido". Se o desempenho cair abaixo de 70%, o sistema detecta regressão automaticamente.'] },
      { title: 'Critério de domínio (Mastery)', content: ['O aprendiz atingiu o nível definido de acertos consistentes para determinado alvo. Critérios configuráveis: percentual de acerto, número de sessões e número de trials.'] },
      { title: 'PEI (Plano Educacional Individualizado)', content: ['Plano com período definido e metas organizadas por domínio. Os protocolos podem ser vinculados às metas do PEI para rastreabilidade completa.'] },
      { title: 'Ajuda (Prompt)', content: ['Suporte dado ao aprendiz para facilitar a resposta correta. 6 níveis: independente, gestual, verbal, modelação, física parcial e física total.'] },
      { title: 'Protocolo', content: ['Plano estruturado de intervenção vinculado a uma prática EBP. Segue o ciclo de vida: rascunho → ativo → dominado → generalização → validado → manutenção → mantido. Pode entrar em regressão, suspensão ou ser descontinuado/arquivado.'] },
      { title: 'Regressão', content: ['Queda de desempenho que retorna o protocolo para a fase de aquisição (status "ativo"). Detectada automaticamente quando uma sonda de manutenção fica abaixo de 70%. O contador de regressões é incrementado.'] },
      { title: 'Snapshot', content: ['Registro imutável do estado da sessão no momento do fechamento. Contém CSO-ABA, SAS, PIS, BSS, TCM, faixa e versão do motor. Não pode ser alterado depois de gerado.'] },
      { title: 'Sonda', content: ['Tentativa de avaliação sem ajuda. Mede o desempenho real do aprendiz. Usada na generalização (grid 3×2) e na manutenção (semanas 2, 6 e 12).'] },
      { title: 'Tentativa (Trial)', content: ['Cada oportunidade de resposta oferecida ao aprendiz dentro de uma sessão de ensino. Unidade mínima de mensuração no ABA.'] },
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

/* ─── accordion item (sem max-height fixo → sem corte de texto) ─── */
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

  // Re-measure on window resize
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

      {/* Container com transição de altura calculada — nunca corta conteúdo */}
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
                  style={{ backgroundColor: brand }}
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

/* ─── section accordion (sem max-height fixo) ─── */
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

  // Mede a altura real do conteúdo (recalcula quando items internos mudam)
  useEffect(() => {
    if (contentRef.current) {
      // Delay duplo: primeiro espera render dos items, depois remede para pegar sub-accordions expandidos
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

  // Quando busca força abertura, abre items que correspondem
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

      {/* Container da seção — altura calculada dinamicamente */}
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

            {/* Indicador final da seção */}
            <div className="pt-3 pb-1 text-right">
              <a
                href="#chat-ana"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('chat-ana')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-sm text-slate-400 italic hover:text-slate-500 transition-colors"
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

/* ─── types for chat ─── */
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

  // Auto-scroll para última mensagem
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
      const res = await fetch('/api/aba/chat-ana', {
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Central de Ajuda
          </h1>
          <p className="mt-2 text-base text-slate-500">
            Tire suas dúvidas sobre o AXIS ABA no seu ritmo.
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
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#c46a50]/30 focus:border-[#c46a50]/50 transition-colors shadow-sm"
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
                        ? 'bg-[#c46a50] text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-700 rounded-bl-md'
                    }`}
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
                className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#c46a50]/30 focus:border-[#c46a50]/50 transition-colors disabled:opacity-50"
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
