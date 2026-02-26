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
} from 'lucide-react'

/* ─── brand ─── */
const brand = '#c46a50'

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

/* ─── data ─── */

const sections: HelpSection[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros Passos',
    icon: Rocket,
    items: [
      {
        title: 'Como cadastrar um aprendiz',
        content: [
          'Acesse o menu Aprendizes na sidebar.',
          'Clique em "Novo Aprendiz" no canto superior direito.',
          'Preencha nome, data de nascimento e responsável.',
          'Salve. O aprendiz já aparece no painel principal.',
        ],
      },
      {
        title: 'Como criar um protocolo de intervenção',
        content: [
          'Abra o perfil do aprendiz e acesse a aba PEI.',
          'Clique em "Novo Protocolo".',
          'Defina o domínio, os alvos e os critérios de mastery.',
          'Salve. O protocolo fica vinculado ao aprendiz e pronto para registro de sessão.',
        ],
      },
      {
        title: 'Como agendar a primeira sessão',
        content: [
          'Vá ao menu Sessões na sidebar.',
          'Clique em "Nova Sessão".',
          'Selecione o aprendiz, a data e o terapeuta responsável.',
          'A sessão aparece na agenda e pode ser iniciada no horário marcado.',
        ],
      },
      {
        title: 'Entendendo o painel principal',
        content: [
          'O painel mostra um resumo geral da clínica.',
          'Indicadores de CSO dos aprendizes ativos.',
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
        title: 'Registrando tentativas (trials DTT)',
        content: [
          'Dentro da sessão ativa, selecione o protocolo e o alvo.',
          'Registre cada tentativa como acerto, erro ou com prompt.',
          'O sistema calcula a porcentagem de acerto em tempo real.',
        ],
      },
      {
        title: 'Registrando comportamentos (ABC)',
        content: [
          'Use a aba "Comportamento" na sessão ativa.',
          'Registre: Antecedente, Comportamento e Consequência.',
          'Cada registro é salvo com timestamp automático.',
        ],
      },
      {
        title: 'Finalizando e gerando snapshot',
        content: [
          'Clique em "Finalizar Sessão" quando terminar.',
          'O sistema gera um snapshot imutável dos dados registrados.',
          'O snapshot recebe um hash SHA256 que garante autenticidade.',
        ],
      },
      {
        title: 'O que é snapshot imutável e por que importa',
        content: [
          'Snapshot é uma fotografia dos dados da sessão no momento do fechamento.',
          'Uma vez gerado, não pode ser alterado nem excluído.',
          'Garante integridade documental para auditorias e convênios.',
          'Funciona como prova técnica de que o registro é original.',
        ],
      },
    ],
  },
  {
    id: 'motor-cso',
    title: 'Motor CSO-ABA',
    icon: Brain,
    items: [
      {
        title: 'O que é o CSO-ABA',
        content: [
          'CSO-ABA é o Clinical Status Overview para Análise do Comportamento Aplicada.',
          'Um índice composto que organiza dados de sessão em um número interpretável.',
          'Vai de 0 a 100. Quanto maior, melhor a situação clínica documentada.',
        ],
      },
      {
        title: 'As 4 dimensões explicadas (SAS, PIS, BSS, TCM)',
        content: [
          'SAS (Skill Acquisition Score): taxa de acerto nos alvos ativos.',
          'PIS (Protocol Implementation Score): aderência ao protocolo planejado.',
          'BSS (Behavior Stability Score): estabilidade comportamental entre sessões.',
          'TCM (Therapeutic Compliance Metric): frequência e regularidade das sessões.',
        ],
      },
      {
        title: 'Como interpretar as faixas',
        content: [
          'Excelente (85–100): evolução consistente, documentação sólida.',
          'Bom (70–84): progresso adequado, acompanhar normalmente.',
          'Atenção (50–69): possível estagnação, revisar protocolo.',
          'Crítico (0–49): regressão ou ausência de dados, ação imediata.',
        ],
      },
      {
        title: 'Por que os pesos são fixos (0.25 cada)',
        content: [
          'Cada dimensão tem peso igual para evitar viés clínico.',
          'Nenhuma dimensão é mais importante que outra por padrão.',
          'Isso garante que o índice represente o quadro geral, não uma parte.',
          'A decisão clínica continua com o profissional — o CSO organiza, não decide.',
        ],
      },
      {
        title: 'CSO não é diagnóstico — é organização de dados',
        content: [
          'O CSO não diagnostica nem classifica o aprendiz.',
          'Ele organiza dados de sessão para facilitar supervisão e documentação.',
          'Nunca deve ser usado isoladamente para decisões clínicas.',
          'É uma ferramenta de suporte, não de substituição do julgamento profissional.',
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
        title: 'Como gerar relatório de evolução',
        content: [
          'Acesse Relatórios na sidebar.',
          'Selecione o aprendiz e o período desejado.',
          'Clique em "Gerar Relatório". O documento é montado automaticamente.',
          'Inclui CSO, gráficos de evolução e resumo por dimensão.',
        ],
      },
      {
        title: 'Relatório para convênio (ANS/SBNI)',
        content: [
          'Use o modelo "Relatório para Convênio" na tela de Relatórios.',
          'O sistema preenche justificativa de carga horária automaticamente.',
          'Estrutura compatível com exigências da ANS e fundamentação SBNI 2025.',
          'Inclui dados objetivos que sustentam a necessidade do tratamento.',
        ],
      },
      {
        title: 'Exportar PDF',
        content: [
          'Após gerar o relatório, clique em "Exportar PDF".',
          'O documento é gerado com layout profissional e cabeçalho da clínica.',
          'Inclui hash SHA256 no rodapé para verificação de autenticidade.',
        ],
      },
      {
        title: 'Entendendo o hash SHA256 (autenticidade)',
        content: [
          'Cada relatório recebe um hash SHA256 único no momento da geração.',
          'É uma impressão digital criptográfica do conteúdo.',
          'Qualquer alteração no documento invalida o hash.',
          'Serve como prova de que o relatório não foi adulterado.',
        ],
      },
      {
        title: 'Justificativa técnica de carga horária',
        content: [
          'O relatório inclui seção específica de justificativa.',
          'Baseada em dados reais: frequência de sessões, evolução mensurada, protocolos ativos.',
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
        title: 'Consentimento LGPD obrigatório',
        content: [
          'Antes de compartilhar qualquer dado, o responsável precisa consentir.',
          'O sistema registra data, hora e IP do consentimento.',
          'Sem consentimento, nenhuma informação é exibida no portal.',
        ],
      },
      {
        title: 'O que os pais veem (e o que não veem)',
        content: [
          'Veem: resumo de evolução, frequência de sessões, marcos alcançados.',
          'Não veem: dados brutos de sessão, anotações clínicas, registros ABC.',
          'O conteúdo é um resumo aprovado pelo profissional, não dados técnicos.',
        ],
      },
      {
        title: 'Envio de resumo após sessão',
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
        title: 'Roles: Administrador, Supervisor, Terapeuta',
        content: [
          'Administrador: acesso total, gerencia equipe e configurações.',
          'Supervisor: visualiza todos os aprendizes, gera relatórios, supervisiona.',
          'Terapeuta: acessa apenas seus aprendizes e sessões atribuídas.',
        ],
      },
      {
        title: 'Como convidar um membro da equipe',
        content: [
          'Acesse Equipe na sidebar (visível apenas para administradores).',
          'Clique em "Convidar Membro".',
          'Insira o e-mail e selecione o role.',
          'O convidado recebe um link para criar a conta.',
        ],
      },
      {
        title: 'O que cada role pode ver e fazer',
        content: [
          'Administrador: tudo, incluindo Equipe, Configurações e dados financeiros.',
          'Supervisor: Painel, Aprendizes (todos), Sessões (todas), PEI, Relatórios.',
          'Terapeuta: Painel (resumido), Aprendizes (atribuídos), Sessões (suas).',
        ],
      },
      {
        title: 'Transferir administração',
        content: [
          'Apenas o administrador atual pode transferir o role.',
          'Acesse Equipe, selecione o membro e clique em "Promover a Admin".',
          'Após a transferência, seu role muda automaticamente para Supervisor.',
          'Essa ação é registrada no log de auditoria.',
        ],
      },
    ],
  },
  {
    id: 'glossario',
    title: 'Glossário ABA',
    icon: BookOpen,
    items: [
      { title: 'ABC', content: ['Antecedente, Comportamento e Consequência. Modelo de registro funcional de comportamentos durante sessão.'] },
      { title: 'Alvo', content: ['Habilidade específica que está sendo ensinada dentro de um protocolo de intervenção.'] },
      { title: 'Baseline', content: ['Linha de base. Medição inicial do desempenho do aprendiz antes da intervenção.'] },
      { title: 'CSO-ABA', content: ['Clinical Status Overview para ABA. Índice composto (0–100) que organiza dados clínicos em 4 dimensões.'] },
      { title: 'Domínio', content: ['Área ampla de desenvolvimento (ex: comunicação, social, acadêmico, comportamento adaptativo).'] },
      { title: 'DTT', content: ['Discrete Trial Training. Ensino por tentativas discretas com estrutura: instrução, resposta, consequência.'] },
      { title: 'Fading', content: ['Redução gradual do nível de ajuda (prompt) fornecida ao aprendiz conforme ele ganha independência.'] },
      { title: 'Generalização 3x2', content: ['Critério que exige acerto com pelo menos 3 pessoas diferentes em 2 ambientes distintos para considerar habilidade generalizada.'] },
      { title: 'Manutenção', content: ['Verificação periódica de habilidades já adquiridas para garantir que não houve perda.'] },
      { title: 'Mastery', content: ['Critério de domínio. O aprendiz atingiu o nível definido de acerto consistente para aquele alvo.'] },
      { title: 'Prompt', content: ['Ajuda fornecida ao aprendiz para facilitar a resposta correta. Pode ser físico, verbal, gestual ou visual.'] },
      { title: 'Protocolo', content: ['Plano estruturado de intervenção contendo alvos, critérios de mastery e estratégias de ensino.'] },
      { title: 'Regressão', content: ['Perda de habilidade previamente adquirida, identificada pela queda nos indicadores entre períodos.'] },
      { title: 'Sonda', content: ['Tentativa de avaliação sem ajuda (prompt). Mede o desempenho real do aprendiz.'] },
      { title: 'Tentativa', content: ['Cada oportunidade de resposta oferecida ao aprendiz dentro de uma sessão DTT.'] },
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
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0)
    }
  }, [isOpen])

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3.5 px-4 text-left hover:bg-slate-50/50 transition-colors rounded-lg"
      >
        <span className="text-sm font-medium text-slate-700">
          <Highlight text={item.title} term={searchTerm} />
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: height }}
      >
        <div ref={contentRef} className="px-4 pb-4">
          <ul className="space-y-2">
            {item.content.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0 mt-2" />
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
  const [height, setHeight] = useState(0)

  const expanded = forceOpen || isOpen

  useEffect(() => {
    if (contentRef.current) {
      setHeight(expanded ? contentRef.current.scrollHeight : 0)
    }
  }, [expanded, openItems])

  // When search forces open, open matching items too
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
        className="w-full flex items-center gap-4 p-6 text-left"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#f5ebe7' }}
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
          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: height }}
      >
        <div ref={contentRef} className="px-6 pb-6">
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
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════ PAGE ═══════════════════════ */

export default function AjudaPage() {
  const [search, setSearch] = useState('')

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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Central de Ajuda
          </h1>
          <p className="mt-3 text-base text-slate-500">
            Aprenda a usar o AXIS ABA no seu ritmo. Sem precisar de suporte.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-lg mx-auto mb-12">
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

        {/* Sections */}
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
            <p className="text-slate-400 text-sm">Nenhum resultado encontrado para &quot;{search}&quot;</p>
            <button
              onClick={() => setSearch('')}
              className="mt-3 text-sm font-medium transition-colors"
              style={{ color: brand }}
            >
              Limpar busca
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center border-t border-slate-200 pt-10">
          <p className="text-sm text-slate-500">
            Não encontrou o que procura?
          </p>
          <a
            href="mailto:contato@psiform.com.br"
            className="mt-2 inline-block text-sm font-medium transition-colors"
            style={{ color: brand }}
          >
            Envie sua dúvida
          </a>
          <p className="mt-1 text-xs text-slate-400">
            Respondemos em até 24 horas úteis.
          </p>
        </div>
      </div>
    </div>
  )
}
