'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Search,
  ChevronDown,
  Rocket,
  ClipboardList,
  Brain,
  Layers,
  GraduationCap,
  Users,
  Home,
  FileText,
  Shield,
  BookOpen,
  Bell,
  MessageCircle,
  Send,
  Bot,
} from 'lucide-react'

/* ─── brand TDAH ─── */
const brand = '#0d7377'
const brandLight = 'rgba(13,115,119,0.08)'

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

/* ═══════════════════════ DATA ═══════════════════════ */

const sections: HelpSection[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros Passos',
    icon: Rocket,
    items: [
      {
        title: 'Como cadastrar um paciente',
        content: [
          'Acesse o menu Pacientes na barra lateral.',
          'Clique em "Novo Paciente" no canto superior direito.',
          'Preencha nome, data de nascimento, nível de suporte (1 a 3) e o código CID do diagnóstico.',
          'Opcionalmente adicione nome, telefone e e-mail do responsável.',
          'Salve. O paciente já aparece na lista e no painel principal.',
        ],
      },
      {
        title: 'Como criar uma sessão',
        content: [
          'Vá ao menu Sessões na barra lateral ou acesse a ficha do paciente.',
          'Clique em "+ Nova Sessão".',
          'Selecione o paciente, a data/hora e o contexto: Clínico, Domiciliar ou Escolar.',
          'A sessão é criada como "Agendada". Para iniciar, clique "Abrir Sessão".',
          'Cada contexto pesa de forma diferente no motor CSO-TDAH — registre sempre o contexto correto.',
        ],
      },
      {
        title: 'Como ativar protocolos para um paciente',
        content: [
          'Na ficha do paciente, vá até a seção "Protocolos".',
          'Clique em "+ Ativar Protocolo" para abrir a biblioteca.',
          'Escolha o bloco (A–G) e o protocolo desejado.',
          'Protocolos do bloco C (AuDHD) só aparecem quando a Layer AuDHD está ativa para esse paciente.',
          'Clique "Ativar". O protocolo aparece com status "Ativo" na ficha.',
        ],
      },
      {
        title: 'Entendendo o painel principal',
        content: [
          'O painel mostra um resumo geral da sua clínica TDAH.',
          'KPIs principais: pacientes ativos, sessões no mês, protocolos ativos, pacientes com Layer AuDHD.',
          'CSO médio: índice geral de evolução. Acima de 70 indica bom progresso.',
          'Alertas em destaque: pacientes críticos (CSO < 50 ou sem sessão recente).',
          'Distribuição tricontextual: onde as sessões estão acontecendo (consultório, escola, casa).',
        ],
      },
      {
        title: 'O que são os alertas no painel',
        content: [
          'Alerta de regressão: protocolo que apresentou queda após período de progresso. Aparece em vermelho/âmbar.',
          'Alerta de paciente crítico: CSO abaixo de 50 ou mais de 14 dias sem sessão registrada.',
          'Alerta de DRC pendente: professor enviou dados escolares aguardando sua revisão.',
          'Alerta de Layer AuDHD: paciente com suspeita de sobreposição sem camada ativada (quando habilitado).',
          'Todos os alertas são clicáveis — levam direto ao paciente ou protocolo envolvido.',
        ],
      },
    ],
  },
  {
    id: 'sessoes',
    title: 'Sessões Tricontextuais',
    icon: ClipboardList,
    items: [
      {
        title: 'Os 3 contextos de sessão',
        content: [
          'Clínico: sessão presencial no consultório. Contexto padrão com controle total do ambiente e das observações.',
          'Domiciliar: sessão realizada no ambiente familiar. Útil para trabalhar rotinas, economia de fichas e comportamento no lar.',
          'Escolar: sessão ou observação no ambiente escolar. Integra o que o professor vê ao trabalho clínico.',
          'Cada contexto de sessão é registrado separadamente e aparece na distribuição tricontextual do painel.',
        ],
      },
      {
        title: 'Registrando observações durante a sessão',
        content: [
          'Com a sessão aberta, clique "+ Observação".',
          'Selecione o protocolo que está sendo trabalhado.',
          'Camada Base: preencha SAS (atenção sustentada, 0–100%), PIS (resposta a instruções) e BSS (autocontrole/estabilidade).',
          'Camada Executiva: preencha EXR (função executiva) se esse aspecto foi relevante na atividade.',
          'Camada AuDHD (quando ativa no perfil): campos SEN (sensorial) e TRF (transições) aparecem automaticamente.',
          'Se a Layer AuDHD estiver em modo Completo, o campo RIG (rigidez comportamental) também aparece.',
          'Salve. A observação fica registrada na timeline da sessão.',
        ],
      },
      {
        title: 'Fechando a sessão e o motor CSO-TDAH',
        content: [
          'Após registrar todas as observações, clique "Fechar Sessão".',
          'O motor CSO-TDAH processa automaticamente todas as observações da sessão.',
          'Um snapshot imutável é gerado: contém os scores de cada bloco (Base, Executivo, AuDHD), o CSO final e a faixa (Excelente, Bom, Atenção, Crítico).',
          'O snapshot registra também a versão do motor usada — garante rastreabilidade histórica.',
          'Sessão fechada é imutável. Se esqueceu algo, use a próxima sessão.',
        ],
      },
      {
        title: 'Enviando resumo aos pais/responsáveis',
        content: [
          'Com a sessão concluída, clique "Enviar Resumo".',
          'O sistema gera um texto automático baseado nas observações da sessão.',
          'Edite o texto conforme necessário — adapte à linguagem da família.',
          'Selecione o responsável cadastrado ou insira um e-mail diretamente.',
          'Clique "Aprovar e Enviar". O e-mail é enviado pelo sistema e fica no histórico.',
        ],
      },
      {
        title: 'O que é o snapshot e por que é importante',
        content: [
          'É um registro fiel e imutável dos dados calculados no momento do fechamento da sessão.',
          'Contém: CSO-TDAH por bloco e total, faixa interpretativa, contexto, versão do motor.',
          'Não pode ser alterado nem excluído por ninguém depois de gerado (append-only).',
          'Garante a integridade da documentação para convênios, supervisão e auditoria clínica.',
        ],
      },
    ],
  },
  {
    id: 'motor-cso',
    title: 'Motor CSO-TDAH',
    icon: Brain,
    items: [
      {
        title: 'O que é o CSO-TDAH',
        content: [
          'CSO-TDAH (Clinical State Object TDAH) é o índice de evolução clínica do sistema.',
          'Ele transforma as observações das sessões em um número de 0 a 100, fácil de acompanhar.',
          'Quanto maior, melhor a evolução documentada do paciente.',
          'É calculado automaticamente a cada sessão fechada e armazenado de forma permanente (append-only).',
          'Você não precisa calcular nada — só registrar as observações. O sistema faz o resto.',
        ],
      },
      {
        title: 'Os 3 blocos que compõem o CSO-TDAH',
        content: [
          'Camada Base (50% do score): atenção e regulação. Métricas: SAS (atenção sustentada, 0–100%), PIS (resposta a instruções, escala 1–5) e BSS (autocontrole/estabilidade, escala 1–5).',
          'Camada Executiva (30% do score): função executiva. Métrica: EXR (organização, planejamento, flexibilidade, escala 1–5).',
          'Camada AuDHD (20% do score — só quando ativa): perfil AuDHD. Métricas: SEN (sensorial), TRF (transições) e, no modo Completo, RIG (rigidez comportamental).',
          'Os pesos são fixos e definidos pelo protocolo TDAH — não são configuráveis por clínica.',
        ],
      },
      {
        title: 'Como interpretar as faixas de pontuação',
        content: [
          'Excelente (85–100): evolução consistente e documentação sólida.',
          'Bom (70–84): progresso adequado — acompanhe normalmente.',
          'Atenção (50–69): possível estagnação — vale revisar o protocolo.',
          'Crítico (0–49): regressão ou falta de dados — necessita ação imediata.',
          'As faixas são referências clínicas. Seu julgamento profissional sempre prevalece.',
        ],
      },
      {
        title: 'O CSO-TDAH é uma ferramenta de suporte, não um diagnóstico',
        content: [
          'O CSO-TDAH não diagnostica nem classifica o paciente.',
          'Ele organiza os dados de sessão para facilitar o acompanhamento e a documentação.',
          'Nunca use o índice isoladamente para decisões clínicas.',
          'É uma ferramenta de apoio ao profissional — não substitui seu julgamento.',
        ],
      },
    ],
  },
  {
    id: 'audhd',
    title: 'Layer AuDHD',
    icon: Layers,
    items: [
      {
        title: 'O que é a Layer AuDHD',
        content: [
          'É uma camada adicional do AXIS TDAH para pacientes com sobreposição de TDAH e autismo (chamados AuDHD).',
          'Quando ativada, adiciona campos de observação específicos para o perfil AuDHD nas sessões.',
          'Também habilita os protocolos do Bloco C (AuDHD) na biblioteca.',
          'Toda mudança de estado é registrada automaticamente — o histórico é sempre preservado.',
        ],
      },
      {
        title: 'Os 3 modos da Layer AuDHD',
        content: [
          'Desativada (padrão): modo TDAH puro. Nenhum campo AuDHD é exibido nas sessões.',
          'Core: ativa o registro de sensibilidade sensorial (SEN) e dificuldade em transições (TRF) nas observações.',
          'Completo: além de SEN e TRF, adiciona rigidez comportamental (RIG) para análise mais aprofundada.',
          'Você pode mudar o modo a qualquer momento — o histórico de cada estado fica preservado.',
        ],
      },
      {
        title: 'Quando ativar a Layer AuDHD',
        content: [
          'Quando sua avaliação clínica indica sobreposição de autismo com TDAH no paciente.',
          'Não há certo ou errado — você é quem conhece o paciente. O sistema só facilita o registro.',
          'Use o modo Core para casos com sensibilidade sensorial e dificuldade em transições.',
          'Use o modo Completo quando há rigidez comportamental significativa que merece acompanhamento.',
          'A ativação exige um motivo clínico registrado e fica no audit log do sistema.',
        ],
      },
      {
        title: 'Como ativar a Layer AuDHD na ficha do paciente',
        content: [
          'Acesse a ficha do paciente.',
          'Localize o card "Layer AuDHD".',
          'Clique no botão do modo desejado: "Core — sensorial e transições" ou "Completa — inclui rigidez".',
          'Confirme o motivo clínico no campo solicitado.',
          'A partir da próxima sessão, os campos adicionais aparecem automaticamente nas observações.',
        ],
      },
    ],
  },
  {
    id: 'drc',
    title: 'DRC — Registro Escolar Diário',
    icon: GraduationCap,
    items: [
      {
        title: 'O que é o DRC',
        content: [
          'DRC (Daily Report Card, ou Registro Diário de Comportamento) é o módulo escolar do AXIS TDAH.',
          'O professor preenche as metas comportamentais do dia — você revisa pelo sistema.',
          'Simples e direto: sem precisar ligar ou enviar mensagens para a escola.',
          'Cada paciente tem no máximo 3 metas por dia — isso mantém o foco e evita sobrecarga para o professor.',
        ],
      },
      {
        title: 'O professor precisa criar uma conta para usar o DRC?',
        content: [
          'Não! O professor acessa pelo link único que você gera no menu Escola — sem login, sem senha, sem cadastro.',
          'Ele abre o link, vê as metas do paciente e preenche o desempenho do dia.',
          'O link é seguro e específico para aquele paciente/turno.',
          'Você controla qual professor tem acesso e pode revogar o link a qualquer momento.',
        ],
      },
      {
        title: 'Como criar uma entrada DRC',
        content: [
          'Acesse o menu DRC na barra lateral ou a ficha do paciente.',
          'Clique em "+ Nova Entrada" e selecione o paciente.',
          'Defina até 3 metas comportamentais para o dia (ex: "Ficou sentado por 20 minutos", "Completou a atividade proposta").',
          'Opcionalmente vincule cada meta a um protocolo ativo para rastreabilidade clínica.',
          'O professor preenche o desempenho (0–100 por meta) e observações.',
          'Você revisa e adiciona sua nota clínica no sistema.',
        ],
      },
      {
        title: 'Como revisar entradas DRC',
        content: [
          'O painel mostra um alerta quando há entradas pendentes de revisão.',
          'Acesse o menu DRC e filtre por "Aguardando revisão".',
          'Clique na entrada, leia as observações do professor e adicione sua revisão clínica.',
          'Clique "Marcar como revisado". A entrada fica registrada no histórico do paciente.',
          'Os dados do DRC também alimentam o painel escolar e os relatórios de contexto.',
        ],
      },
    ],
  },
  {
    id: 'portal-escola-familia',
    title: 'Portal Escola e Família',
    icon: Users,
    items: [
      {
        title: 'Portal Escola — acesso sem cadastro',
        content: [
          'O professor ou mediador acessa pelo link único gerado pelo sistema — sem criar conta.',
          'Pelo portal, ele visualiza as metas do dia, registra o desempenho e adiciona observações.',
          'Você pode gerar, consultar e revogar links de acesso na seção "Escola" da ficha do paciente.',
          'Cada link é rastreável: o sistema registra quando foi acessado e quem preencheu.',
        ],
      },
      {
        title: 'Portal Família — resumos de evolução',
        content: [
          'Responsáveis cadastrados recebem resumos das sessões por e-mail quando você aprova o envio.',
          'O resumo é gerado automaticamente a partir das observações e editável por você antes do envio.',
          'Nunca inclui scores clínicos (CSO) — apenas informações compreensíveis pela família.',
          'O consentimento LGPD é obtido e registrado automaticamente no primeiro acesso.',
        ],
      },
      {
        title: 'O que a família consegue ver (e o que não)',
        content: [
          'Podem ver: resumo de evolução, frequência de sessões e marcos alcançados (definidos por você).',
          'Não podem ver: dados detalhados de observação, valores de CSO, notas clínicas nem registros AuDHD.',
          'O conteúdo é sempre aprovado pelo profissional antes de ser compartilhado.',
        ],
      },
    ],
  },
  {
    id: 'modulo-casa',
    title: 'Módulo Casa',
    icon: Home,
    items: [
      {
        title: 'O que é o Módulo Casa',
        content: [
          'Permite registrar sessões e observações no contexto domiciliar — um dos três contextos tricontextuais.',
          'Útil quando você realiza visitas domiciliares ou orienta a família a registrar comportamentos em casa.',
          'Segue o mesmo formato de observação das sessões clínicas (Camada Base + Executiva + AuDHD se ativa).',
        ],
      },
      {
        title: 'Como registrar uma sessão domiciliar',
        content: [
          'Crie uma nova sessão normalmente.',
          'Selecione "Domiciliar" como contexto.',
          'Preencha as observações da mesma forma que uma sessão clínica.',
          'O motor CSO-TDAH processa os dados normalmente — o contexto é registrado no snapshot.',
        ],
      },
      {
        title: 'Envolvendo a família no registro',
        content: [
          'Você pode orientar um responsável a registrar observações em casa.',
          'O responsável usa o Portal Família para informar o que observou.',
          'Você revisa e valida as informações antes que entrem no registro clínico oficial.',
          'Isso garante que o histórico clínico tenha apenas dados revisados pelo profissional.',
        ],
      },
    ],
  },
  {
    id: 'protocolos',
    title: 'Protocolos Clínicos',
    icon: BookOpen,
    items: [
      {
        title: 'A biblioteca de protocolos TDAH',
        content: [
          'São 46 protocolos organizados em 7 blocos temáticos (A–G).',
          'Bloco A — Base: atenção sustentada, regulação básica (ex: técnicas de foco, tempo de atenção).',
          'Bloco B — Executivo: planejamento, memória de trabalho, inibição de impulsos.',
          'Bloco C — AuDHD: protocolos para sobreposição TDAH+autismo (só para pacientes com Layer AuDHD ativa).',
          'Bloco D — Acadêmico: habilidades de leitura, escrita, matemática adaptadas ao TDAH.',
          'Bloco E — Social: habilidades sociais, leitura de contexto, comunicação.',
          'Bloco F — Emocional: regulação emocional, tolerância à frustração, autoconhecimento.',
          'Bloco G — Autonomia: rotinas, autocuidado, organização pessoal.',
        ],
      },
      {
        title: 'Ciclo de vida do protocolo',
        content: [
          'Rascunho → Ativo: protocolo aprovado para uso com o paciente.',
          'Ativo → Dominado: paciente atingiu o critério de maestria definido.',
          'Dominado → Em revisão: período de acompanhamento após a maestria.',
          'Qualquer fase → Regressão: queda de desempenho após progresso — protocolo retorna para ativo.',
          'Suspenso: pausar temporariamente (ex: mudar foco terapêutico).',
          'Arquivado: estado final — protocolo concluído ou descontinuado definitivamente.',
        ],
      },
      {
        title: 'Como acompanhar a evolução por protocolo',
        content: [
          'Na ficha do paciente, cada protocolo ativo mostra o status atual e os scores recentes.',
          'Clicando no protocolo, você vê o histórico de observações vinculadas a ele.',
          'O gráfico de evolução mostra como o paciente progrediu ao longo das sessões naquele protocolo.',
          'Protocolos em regressão aparecem destacados no painel e geram alerta automático.',
        ],
      },
    ],
  },
  {
    id: 'alertas',
    title: 'Alertas e Notificações',
    icon: Bell,
    items: [
      {
        title: 'Os 5 tipos de alerta do AXIS TDAH',
        content: [
          'Crítico (CSO < 50): paciente com score abaixo da faixa mínima aceitável. Ação imediata recomendada.',
          'Ausência: mais de 14 dias sem sessão registrada para um paciente ativo.',
          'Regressão: protocolo que apresentou queda após período de progresso.',
          'DRC pendente: professor enviou dados escolares aguardando sua revisão clínica.',
          'Layer AuDHD: paciente com suspeita de sobreposição identificada pelo sistema (configurável).',
        ],
      },
      {
        title: 'Como os alertas aparecem no sistema',
        content: [
          'No painel principal, o card "Em atenção" mostra os pacientes com alertas ativos.',
          'Cada alerta tem um ícone colorido: vermelho (crítico/regressão), âmbar (ausência/DRC pendente), roxo (AuDHD).',
          'Clicar em um alerta leva direto ao paciente ou protocolo envolvido.',
          'Alertas são resolvidos automaticamente quando a situação é corrigida (ex: nova sessão registrada).',
        ],
      },
      {
        title: 'Notificações por e-mail',
        content: [
          'Você pode configurar notificações por e-mail para alertas críticos e DRC pendente.',
          'Acesse Configurações → Notificações para personalizar quais alertas geram e-mail.',
          'Terapeutas recebem apenas alertas dos seus próprios pacientes.',
          'Admins e supervisores recebem alertas de todos os pacientes da clínica.',
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
          'Selecione o paciente e o período desejado.',
          'Clique em "Gerar Relatório". O documento é montado automaticamente.',
          'Inclui: CSO-TDAH por bloco, gráfico de evolução, distribuição tricontextual e resumo por área.',
          'Se a Layer AuDHD está ativa, inclui também a seção AuDHD com scores de SEN, TRF e RIG.',
        ],
      },
      {
        title: 'Relatório para convênio',
        content: [
          'Use o modelo "Relatório para Convênio" na tela de Relatórios.',
          'O sistema preenche automaticamente a justificativa de carga horária com base nos dados clínicos.',
          'Inclui dados objetivos que sustentam a necessidade do tratamento.',
          'Exportável em PDF com layout profissional, cabeçalho da clínica e código de autenticidade.',
        ],
      },
      {
        title: 'O que é o código de autenticidade do relatório',
        content: [
          'Cada relatório recebe um código único no momento em que é gerado.',
          'Esse código funciona como uma "impressão digital" do documento.',
          'Se qualquer parte do relatório for alterada depois, o código deixa de ser válido.',
          'Serve como garantia de que o relatório não foi adulterado — útil para convênios e processos.',
        ],
      },
      {
        title: 'Relatório com dados do DRC e contexto escolar',
        content: [
          'Selecione "Incluir dados DRC" ao gerar o relatório.',
          'O relatório mostra a evolução das metas escolares ao longo do período.',
          'Inclui gráfico de desempenho por meta e comparação com o CSO clínico.',
          'Útil para reuniões com a escola, pais e equipe interdisciplinar.',
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
        title: 'Os perfis de acesso do AXIS TDAH',
        content: [
          'Admin (Dono da clínica): acesso total ao sistema. Gerencia equipe, configurações, assinatura e todos os pacientes.',
          'Supervisor Clínico: acesso a todos os pacientes da clínica. Cria sessões, relatórios e acompanha a equipe. Não gerencia assinatura.',
          'Terapeuta (Aplicador): acesso apenas aos pacientes vinculados a ele. Registra sessões e observações. Não gera relatórios.',
        ],
      },
      {
        title: 'Como convidar alguém para a equipe',
        content: [
          'Acesse Equipe na barra lateral (visível apenas para administradores).',
          'Clique em "Convidar Membro".',
          'Insira o e-mail e selecione o perfil de acesso desejado.',
          'O convidado recebe um link para criar a conta ou entrar na clínica.',
        ],
      },
      {
        title: 'Posso ter perfis diferentes em clínicas diferentes?',
        content: [
          'Sim. Você pode ser administradora na sua própria clínica e terapeuta em outra.',
          'Ao fazer login, se tiver acesso a mais de uma clínica, aparece uma tela de seleção.',
          'Cada clínica é completamente isolada — nenhum dado clínico é compartilhado entre elas.',
          'Ao trocar de clínica, o sistema ajusta automaticamente o que você pode ver e fazer.',
        ],
      },
    ],
  },
  {
    id: 'privacidade',
    title: 'Privacidade e LGPD',
    icon: Shield,
    items: [
      {
        title: 'LGPD e dados clínicos',
        content: [
          'A clínica é a controladora dos dados dos pacientes; o AXIS atua como operador.',
          'Dados clínicos são retidos por no mínimo 7 anos, conforme normas do CFM e do CRP.',
          'Logs de auditoria são retidos por no mínimo 5 anos.',
          'Cada clínica tem isolamento total por tenant_id — dados nunca cruzam entre clínicas.',
        ],
      },
      {
        title: 'Imutabilidade do histórico clínico',
        content: [
          'Snapshots de sessão são append-only: uma vez gerados, não podem ser alterados.',
          'Sessões concluídas são imutáveis — o histórico clínico nunca é modificado retroativamente.',
          'Logs de auditoria registram cada ação no sistema: quem fez, o quê e quando.',
          'Essa imutabilidade protege o prontuário eletrônico e é exigida por normas regulatórias.',
        ],
      },
      {
        title: 'Consentimento e acesso a dados',
        content: [
          'O consentimento do responsável é obtido e registrado automaticamente no primeiro acesso ao Portal Família.',
          'Sem consentimento, nenhuma informação é compartilhada com a família pelo sistema.',
          'Você pode revogar o acesso de qualquer usuário externo (professor, família) a qualquer momento.',
          'Todos os acessos externos são rastreados e ficam no histórico de auditoria.',
        ],
      },
    ],
  },
  {
    id: 'glossario',
    title: 'Glossário TDAH',
    icon: BookOpen,
    items: [
      { title: 'AuDHD', content: ['Paciente com sobreposição de autismo e TDAH. O AXIS TDAH tem uma camada específica (Layer AuDHD) para acompanhar esse perfil com métricas adicionais.'] },
      { title: 'BSS (Behavioral Stability Score)', content: ['Métrica de autocontrole durante a sessão — impulsividade, espera e regulação emocional. Escala 1–5. Faz parte da Camada Base do CSO-TDAH.'] },
      { title: 'Camada Base', content: ['Primeiro bloco do CSO-TDAH (peso 50%). Registra atenção e regulação: SAS, PIS e BSS.'] },
      { title: 'Camada Executiva', content: ['Segundo bloco do CSO-TDAH (peso 30%). Registra função executiva através do EXR.'] },
      { title: 'Camada AuDHD', content: ['Terceiro bloco do CSO-TDAH (peso 20%). Disponível apenas quando a Layer AuDHD está ativa. Registra SEN, TRF e, no modo Completo, RIG.'] },
      { title: 'CSO-TDAH (Clinical State Object)', content: ['Índice de 0 a 100 que mede a evolução clínica do paciente. Calculado automaticamente a cada sessão. Composto por 3 blocos: Base (50%), Executivo (30%) e AuDHD (20%).'] },
      { title: 'DRC (Daily Report Card)', content: ['Registro Diário de Comportamento. Ferramenta para acompanhamento escolar — o professor preenche as metas do dia e o clínico revisa pelo sistema. Máx. 3 metas/dia por paciente.'] },
      { title: 'EXR (Executive Report)', content: ['Métrica de função executiva: organização, planejamento e flexibilidade. Escala 1–5. Faz parte da Camada Executiva.'] },
      { title: 'Layer AuDHD', content: ['Camada de acompanhamento para pacientes AuDHD. 3 modos: desativada, Core (SEN+TRF) e Completa (+RIG). Controlada pelo profissional.'] },
      { title: 'PIS (Prompt Independence Score)', content: ['Métrica de resposta a instruções — como o paciente respondeu à estrutura da sessão. Escala 1–5. Faz parte da Camada Base.'] },
      { title: 'RIG (Rigidity)', content: ['Mérica de rigidez comportamental. Disponível apenas no modo Completo da Layer AuDHD.'] },
      { title: 'SAS (Sustained Attention Score)', content: ['Atenção sustentada e permanência na tarefa. Informada em porcentagem (0–100%). Faz parte da Camada Base.'] },
      { title: 'SEN (Sensory)', content: ['Sensibilidade sensorial — como o paciente reagiu a estímulos do ambiente. Disponível no modo Core e Completo da Layer AuDHD.'] },
      { title: 'Snapshot', content: ['Registro imutável dos dados calculados no fechamento da sessão. Contém CSO por bloco, faixa e versão do motor. Não pode ser alterado depois de gerado.'] },
      { title: 'TRF (Transition)', content: ['Dificuldade em transições — como o paciente reagiu à mudança de atividade ou ambiente. Disponível no modo Core e Completo da Layer AuDHD.'] },
      { title: 'Tricontextual', content: ['Abordagem que acompanha o paciente nos 3 contextos onde o TDAH se manifesta: consultório, escola e casa. Cada sessão tem um contexto registrado.'] },
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
        if (contentRef.current) setMeasuredHeight(contentRef.current.scrollHeight)
      }, 60)
      const timer2 = setTimeout(() => {
        if (contentRef.current) setMeasuredHeight(contentRef.current.scrollHeight)
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

/* ═══════════════════════ TYPES CHAT ═══════════════════════ */
interface ChatMessage {
  role: 'user' | 'ana'
  content: string
}

/* ═══════════════════════ PAGE ═══════════════════════ */
export default function AjudaTDAHPage() {
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
      const history = messages.map((m) => ({
        role: m.role === 'ana' ? 'assistant' : 'user',
        content: m.content,
      }))

      const res = await fetch('/api/tdah/chat-ana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })

      if (!res.ok) throw new Error('Erro na resposta')

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'ana', content: data.reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ana',
          content: 'Desculpe, tive um problema ao processar sua pergunta. Tente novamente em alguns segundos.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [chatInput, isLoading, messages])

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
          return { ...section, items: titleMatch ? section.items : matchingItems }
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
            Tire suas dúvidas sobre o AXIS TDAH no seu ritmo.
          </p>
        </div>

        {/* Card Ana */}
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

        {/* Search */}
        <div className="relative max-w-lg mx-auto mb-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tema..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d7377]/30 focus:border-[#0d7377]/50 transition-colors shadow-sm"
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

        {/* Chat Ana */}
        <div
          id="chat-ana"
          className="mt-14 bg-white rounded-2xl border border-slate-200 shadow-sm scroll-mt-8 flex flex-col"
        >
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
                    style={msg.role === 'user' ? { backgroundColor: brand } : {}}
                  >
                    {msg.role === 'ana' && (
                      <span
                        className="block text-xs font-semibold mb-1"
                        style={{ color: brand }}
                      >
                        Ana
                      </span>
                    )}
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  </div>
                </div>
              ))}

              {/* Loading */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                    <span
                      className="block text-xs font-semibold mb-1"
                      style={{ color: brand }}
                    >
                      Ana
                    </span>
                    <span className="flex items-center gap-1 text-sm text-slate-400">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
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
                className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d7377]/30 focus:border-[#0d7377]/50 transition-colors disabled:opacity-50"
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
              A Ana é uma assistente virtual do AXIS TDAH. Suas respostas não substituem orientação profissional.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
