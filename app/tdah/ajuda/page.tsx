'use client'

import { useState } from 'react'

// =====================================================
// AXIS TDAH - Central de Ajuda
// FAQ + guias rápidos adaptados para TDAH tricontextual
// =====================================================

const TDAH_COLOR = '#0d7377'
const TDAH_LIGHT = 'rgba(13, 115, 119, 0.08)'

interface HelpItem {
  title: string
  content: string[]
}

interface HelpSection {
  id: string
  title: string
  icon: string
  items: HelpItem[]
}

const sections: HelpSection[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros Passos',
    icon: '🚀',
    items: [
      {
        title: 'Como cadastrar um paciente',
        content: [
          'Acesse o menu Pacientes na barra lateral.',
          'Clique em "Novo Paciente" no canto superior direito.',
          'Preencha nome, data de nascimento, diagnóstico e dados escolares.',
          'Opcionalmente, adicione dados do responsável (nome, telefone, email).',
          'Salve. O paciente já aparece na lista e no painel.',
        ],
      },
      {
        title: 'Como criar uma sessão',
        content: [
          'Vá ao menu Sessões ou à ficha do paciente.',
          'Clique em "+ Nova Sessão".',
          'Selecione o paciente, data/hora e contexto (Clínico, Domiciliar ou Escolar).',
          'A sessão é criada como "Agendada". Para iniciar, clique "Abrir Sessão".',
        ],
      },
      {
        title: 'Como ativar protocolos',
        content: [
          'Na ficha do paciente, vá até a seção "Protocolos".',
          'Clique em "+ Ativar Protocolo" para abrir a biblioteca.',
          'Selecione o protocolo desejado e clique "Ativar".',
          'O protocolo aparecerá na ficha com status "Ativo".',
        ],
      },
    ],
  },
  {
    id: 'sessoes',
    title: 'Sessões Tricontextuais',
    icon: '📋',
    items: [
      {
        title: 'Os 3 contextos de sessão',
        content: [
          'Clínico (🏥): sessão presencial no consultório.',
          'Domiciliar (🏠): sessão no ambiente familiar.',
          'Escolar (🏫): sessão ou observação no ambiente escolar.',
          'Cada sessão tem um contexto único que influencia o motor CSO-TDAH.',
        ],
      },
      {
        title: 'Registrando observações',
        content: [
          'Com a sessão aberta, clique "+ Observação".',
          'Selecione o protocolo, preencha SAS (atenção sustentada), PIS (dica) e BSS (estabilidade).',
          'Se a Layer AuDHD estiver ativa, campos SEN e TRF aparecem automaticamente.',
          'Se AuDHD Completa, campos RIG (rigidez) também aparecem.',
          'Salve. A observação é registrada na timeline.',
        ],
      },
      {
        title: 'Fechando sessão e motor CSO',
        content: [
          'Após registrar todas as observações, clique "Fechar Sessão".',
          'O motor CSO-TDAH processa automaticamente as observações.',
          'Um snapshot é gerado com scores por bloco (Base, Executivo, AuDHD).',
          'O score final e a faixa (Excelente/Bom/Atenção/Crítico) aparecem no gráfico.',
        ],
      },
      {
        title: 'Enviando resumo aos pais',
        content: [
          'Com a sessão concluída, clique "Enviar Resumo".',
          'O sistema gera um texto automático a partir das observações.',
          'Edite o texto conforme necessário (nunca inclua scores clínicos).',
          'Selecione o responsável ou insira um email.',
          'Clique "Aprovar e Enviar". O email é enviado pelo sistema.',
        ],
      },
    ],
  },
  {
    id: 'protocolos',
    title: 'Protocolos & Ciclo de Vida',
    icon: '📊',
    items: [
      {
        title: 'Ciclo de vida do protocolo (Bible §12)',
        content: [
          'Rascunho → Ativo: protocolo aprovado para uso.',
          'Ativo → Dominado: paciente atingiu critério de maestria.',
          'Dominado → Generalização → Manutenção → Mantido.',
          'Qualquer fase → Regressão: perda de habilidade previamente adquirida.',
          'Regressão → Ativo: retomar o protocolo.',
          'Suspenso: pausar temporariamente. Descontinuado: abandonar.',
          'Arquivado: estado final.',
        ],
      },
      {
        title: 'Blocos de protocolo',
        content: [
          'Bloco A — Base: atenção sustentada, regulação básica.',
          'Bloco B — Executivo: planejamento, memória de trabalho, inibição.',
          'Bloco C — AuDHD: protocolos específicos para sobreposição autismo+TDAH.',
          'Blocos D-G: Acadêmico, Social, Emocional, Autonomia.',
        ],
      },
    ],
  },
  {
    id: 'audhd',
    title: 'Layer AuDHD',
    icon: '🟣',
    items: [
      {
        title: 'O que é a Layer AuDHD?',
        content: [
          'Uma camada de sobreposição para pacientes com autismo + TDAH (AuDHD).',
          'Ativa métricas adicionais: SEN (sensorial), TRF (transição), RIG (rigidez), MSK (masking).',
          'Tem 3 estados: Desativada, Core (SEN+TRF) e Completa (+ RIG + MSK).',
          'Toda mudança de estado é registrada no log de auditoria (Bible §9.3).',
        ],
      },
      {
        title: 'Quando ativar',
        content: [
          'Quando avaliação clínica indica sobreposição autismo/TDAH.',
          'Core: para pacientes com sensibilidade sensorial e dificuldade de transição.',
          'Completa: quando há rigidez comportamental significativa.',
          'A ativação exige motivo clínico e fica no audit log.',
        ],
      },
    ],
  },
  {
    id: 'drc',
    title: 'DRC (Daily Report Card)',
    icon: '🏫',
    items: [
      {
        title: 'O que é o DRC?',
        content: [
          'Acompanhamento escolar diário com metas objetivas (Bible §17).',
          'Máximo de 3 metas por dia por paciente.',
          'Preenchido por professor/mediador/responsável.',
          'O clínico revisa e registra suas observações.',
        ],
      },
      {
        title: 'Usando o DRC',
        content: [
          'Acesse pelo menu DRC ou pela ficha do paciente.',
          'Selecione o paciente e crie uma entrada.',
          'Defina a meta, vincule a um protocolo (opcional), marque se atingida.',
          'O professor adiciona suas observações.',
          'O clínico revisa clicando "Revisar" na entrada.',
        ],
      },
    ],
  },
  {
    id: 'privacidade',
    title: 'Privacidade & Segurança',
    icon: '🔒',
    items: [
      {
        title: 'LGPD e dados clínicos',
        content: [
          'A clínica é controladora dos dados; AXIS é operador.',
          'Dados clínicos retidos por 7 anos, logs por 5 anos.',
          'Isolamento total por tenant_id: dados nunca cruzam entre clínicas.',
          'Snapshots CSO e logs de auditoria são append-only (imutáveis).',
          'Sessões concluídas são imutáveis (Bible §11).',
        ],
      },
    ],
  },
]

function AccordionItem({ item }: { item: HelpItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-50 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-3 text-left">
        <span className="text-sm text-slate-700 font-medium">{item.title}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="pb-3 space-y-1.5">
          {item.content.map((line, i) => (
            <p key={i} className="text-xs text-slate-500 leading-relaxed pl-3 border-l-2" style={{ borderLeftColor: `${TDAH_COLOR}30` }}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AjudaTDAHPage() {
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const filtered = search.trim()
    ? sections.map(s => ({
        ...s,
        items: s.items.filter(i =>
          i.title.toLowerCase().includes(search.toLowerCase()) ||
          i.content.some(c => c.toLowerCase().includes(search.toLowerCase()))
        ),
      })).filter(s => s.items.length > 0)
    : sections

  return (
    <div className="px-4 md:px-8 lg:px-12 xl:px-16 py-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Central de Ajuda</h1>
        <p className="text-sm text-slate-400 mt-1">AXIS TDAH · Guias e perguntas frequentes</p>
      </div>

      {/* Busca */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar na ajuda..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0d7377]" />
      </div>

      {/* Seções */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400">Nenhum resultado para &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(section => (
            <div key={section.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <button
                onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                className="w-full flex items-center gap-3 p-5 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-lg">{section.icon}</span>
                <span className="text-sm font-semibold text-slate-700 flex-1">{section.title}</span>
                <span className="text-[10px] text-slate-400">{section.items.length} tópicos</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${activeSection === section.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {(activeSection === section.id || search.trim()) && (
                <div className="px-5 pb-4">
                  {section.items.map((item, i) => (
                    <AccordionItem key={i} item={item} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Contato */}
      <div className="mt-8 bg-white rounded-xl border border-slate-100 p-6 text-center">
        <p className="text-sm text-slate-600 mb-2">Precisa de mais ajuda?</p>
        <a href="mailto:suporte@axisclinico.com" className="text-sm font-medium" style={{ color: TDAH_COLOR }}>
          suporte@axisclinico.com
        </a>
      </div>
    </div>
  )
}
