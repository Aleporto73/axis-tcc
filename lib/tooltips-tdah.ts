// =====================================================
// AXIS TDAH — Textos Educativos (Tooltips)
// Tom: acolhedor, direto, sem jargão técnico.
// Público-alvo: clínica experiente, 40+ anos.
// =====================================================

export const TOOLTIPS_TDAH = {

  // ─── Dashboard — KPIs principais ───
  dash_pacientes_ativos:
    'Total de pacientes com acompanhamento em andamento nesta clínica.',
  dash_sessoes_mes:
    'Sessões realizadas nos últimos 30 dias — somando consultório, escola e casa.',
  dash_protocolos_ativos:
    'Protocolos de trabalho em uso neste momento. Cada protocolo tem um objetivo clínico definido por você.',
  dash_audhd_ativos:
    'Pacientes com a camada AuDHD ativada — aqueles que têm TDAH e autismo ao mesmo tempo. Você é quem decide quando ativar.',
  dash_cso_medio:
    'Evolução média dos seus pacientes segundo o motor clínico. Acima de 70 indica bom progresso.',
  dash_criticos:
    'Pacientes com queda de desempenho ou sem sessão registrada recentemente — merecem atenção.',
  dash_tricontextual:
    'Distribuição das sessões entre os três ambientes: consultório, escola e casa. Ver onde o trabalho acontece ajuda a planejar melhor.',
  dash_regressao:
    'Protocolos que apresentaram queda após um período de progresso. Útil para priorizar os próximos atendimentos.',

  // ─── Dashboard — CSO ───
  cso_evolucao:
    'Linha de evolução do seu paciente ao longo do tempo. Quanto mais alto o ponto, melhor o desempenho naquela sessão.',
  cso_geral:
    'O sistema calcula automaticamente a evolução do seu paciente com base nas observações de cada sessão. Você não precisa fazer nada — só registrar.',
  cso_bandas:
    'Faixas de desempenho: Excelente (>85), Bom (70–85), Atenção (50–70), Crítico (<50). São referências para orientar — não substituem o seu julgamento clínico.',

  // ─── Tricontextual ───
  tricontextual:
    'Seu paciente é acompanhado nos três ambientes onde o TDAH aparece: consultório, escola e casa. Tudo registrado em um só lugar.',
  contexto_clinico:
    'Sessão presencial no consultório. Aqui você tem controle total do ambiente e dos registros.',
  contexto_domiciliar:
    'Sessão realizada em casa, com a família. Útil para trabalhar rotinas, economia de fichas e comportamento no lar.',
  contexto_escolar:
    'Sessão realizada na escola ou com dados vindos da escola. Integra o que o professor observa ao trabalho clínico.',

  // ─── AuDHD Layer ───
  audhd_layer:
    'Camada de acompanhamento para pacientes que têm TDAH e autismo ao mesmo tempo. Você decide quando ativar — e pode mudar a qualquer momento.',
  audhd_off:
    'Modo padrão TDAH ativo. Nenhum dado de autismo está sendo registrado.',
  audhd_core:
    'Modo básico ativado: registra sensibilidade sensorial (SEN) e dificuldade em transições (TRF) nas sessões.',
  audhd_full:
    'Modo completo: inclui também rigidez comportamental (RIG) e permite análise mais aprofundada do perfil AuDHD do paciente.',

  // ─── Formulário de observação — Camada Base ───
  camada_base:
    'Registros principais da sessão: atenção, resposta a instruções e controle comportamental. São os três pilares do acompanhamento TDAH.',
  sas:
    'Atenção e permanência na tarefa — o quanto o paciente conseguiu se manter focado durante a atividade. Informe em porcentagem (0 a 100).',
  pis:
    'Como o paciente respondeu às instruções e à estrutura da sessão — se seguiu bem, precisou de apoio ou resistiu.',
  bss:
    'Autocontrole durante a sessão — impulsividade, espera, regulação emocional. Ausente = não observado.',

  // ─── Formulário de observação — Camada Executiva ───
  camada_executiva:
    'Registros de função executiva: como o paciente organizou, planejou e adaptou suas ações durante a atividade.',
  exr:
    'Função executiva — organização, planejamento, flexibilidade. Preencha se esse aspecto foi relevante na atividade registrada.',

  // ─── Formulário de observação — Camada AuDHD ───
  camada_audhd:
    'Campos extras para pacientes com AuDHD. Aparecem automaticamente quando você ativa essa camada na ficha do paciente.',
  sen:
    'Sensibilidade sensorial — como o paciente reagiu a estímulos do ambiente (barulho, luz, textura). Registre só se foi observado.',
  trf:
    'Dificuldade em transições — como o paciente reagiu à mudança de atividade ou de ambiente. Registre só se foi observado.',
  rig:
    'Rigidez comportamental — rigidez ou inflexibilidade observada. Registre estado e intensidade apenas se aparecer claramente na sessão.',

  // ─── DRC ───
  drc:
    'Registro Diário Escolar — o professor preenche as metas comportamentais do dia e você revisa pelo sistema. Simples, direto, sem precisar ligar.',
  drc_meta:
    'O comportamento ou habilidade que está sendo acompanhado na escola naquele dia.',
  drc_score:
    'Desempenho estimado de 0 a 100. Não precisa ser exato — é uma referência para acompanhar a tendência ao longo do tempo.',
  drc_review:
    'Sua revisão clínica do DRC. Você pode adicionar uma nota para contextualizar o que o professor registrou.',
  drc_limite:
    'Cada dia aceita até 3 metas por paciente. Isso mantém o foco e evita sobrecarga para o professor.',

  // ─── Protocolos ───
  protocolo_biblioteca:
    'Conjunto de protocolos clínicos disponíveis para uso. São organizados por área de desenvolvimento do TDAH.',
  protocolo_bloco:
    'Área de desenvolvimento à qual o protocolo pertence: Base, Executiva ou AuDHD.',
  protocolo_ativo:
    'Protocolo em trabalho ativo com este paciente. Você pode acompanhar a evolução na ficha e nos relatórios.',
  protocolo_audhd_req:
    'Este protocolo só pode ser usado quando a camada AuDHD está ativa para o paciente.',
  protocolo_transicoes:
    'O ciclo de vida do protocolo: ativo, em revisão, dominado, suspenso ou arquivado. Você controla cada etapa.',

  // ─── Ficha do paciente — Indicadores ───
  paciente_nivel_suporte:
    'Nível 1 = maior autonomia, Nível 3 = mais apoio necessário. Baseado na avaliação clínica inicial — você pode ajustar quando necessário.',
  paciente_cid:
    'Código de diagnóstico internacional. Aparece nos relatórios para convênios e documentação clínica.',
  paciente_scores:
    'Histórico de evolução calculado automaticamente pelo sistema após cada sessão fechada. Quanto mais sessões, mais preciso o gráfico.',
  paciente_drc_link:
    'Ver os registros diários enviados pelo professor. Cada registro mostra data, meta e se foi atingida.',

  // ─── Relatórios ───
  relatorio_motor:
    'Versão do motor de cálculo usado neste relatório. Garante que os resultados possam ser verificados e comparados ao longo do tempo.',
  relatorio_contextos:
    'Distribuição das sessões entre consultório, escola e casa no período selecionado.',
  relatorio_delta:
    'Variação entre o primeiro e o último score do período. Positivo = evolução, negativo = queda.',

  // ─── Configurações e compliance ───
  config_audit:
    'Registro de todas as ações realizadas no sistema. Exigido por normas de prontuário eletrônico e LGPD.',
  config_retencao:
    'Tempo mínimo de guarda dos dados clínicos conforme as normas do CFM e do CRP.',

} as const

export type TooltipTDAHKey = keyof typeof TOOLTIPS_TDAH
