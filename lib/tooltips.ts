// =====================================================
// AXIS ABA — Textos Educativos (Tooltips)
// Arquivo centralizado para facilitar tradução futura.
// Chave = identificador único, valor = texto curto.
// =====================================================

export const TOOLTIPS = {
  // ─── Dashboard Hub ───
  dash_cso_medio: 'Clinical Significance Outcome — índice geral de progresso clínico. Acima de 70 = bom progresso.',
  dash_taxa_mastery: 'Percentual de protocolos que atingiram critério de domínio (80% em 3 sessões).',
  dash_tempo_mastery: 'Média de dias entre ativar um protocolo e atingir domínio.',
  dash_gen_manut: 'Protocolos em generalização (testar com outras pessoas/ambientes) ou manutenção (sondas 2/6/12 semanas).',
  dash_regressoes: 'Quando um protocolo dominado apresenta queda de desempenho e precisa ser retomado.',
  dash_alerta_regressao: 'O sistema detectou queda de desempenho. Clique para ver detalhes e decidir se retoma o protocolo.',

  // ─── Novo Aprendiz (modal) ───
  aprendiz_nivel_suporte: 'Nível 1 = menor suporte, Nível 3 = maior suporte. Baseado no DSM-5.',
  aprendiz_cid: 'Código Internacional de Doenças. Usado em relatórios para convênios.',

  // ─── Página do Aprendiz ───
  aprendiz_protocolos_ativos: 'Protocolos em fase de ensino ativo. O aprendiz ainda não atingiu o critério de domínio.',
  aprendiz_dominados: 'Protocolos onde o aprendiz atingiu 80% de acerto em 3 sessões consecutivas.',
  aprendiz_cso_atual: 'Índice de progresso clínico deste aprendiz. Acima de 70 = bom progresso.',
  aprendiz_btn_dominado: 'Marque quando o aprendiz atingir o critério (ex: 80% em 3 sessões). Cria automaticamente sondas de manutenção em 2, 6 e 12 semanas.',
  aprendiz_btn_suspenso: 'Pause temporariamente o protocolo. Use quando precisar focar em outros objetivos.',
  aprendiz_btn_descontinuado: 'Encerre definitivamente o protocolo. Use quando o objetivo não é mais relevante.',
  aprendiz_criterio_pct: 'Percentual mínimo de acertos para considerar a habilidade dominada.',
  aprendiz_btn_generalizacao: 'Testar se o aprendiz mantém a habilidade em diferentes contextos e com diferentes pessoas.',
  aprendiz_btn_regressao: 'Retomar o protocolo quando houve queda de desempenho.',
  aprendiz_btn_validado: 'A generalização foi concluída (6/6 células). Pronto para fase de manutenção.',
  aprendiz_btn_manutencao: 'Iniciar fase de sondas periódicas (2, 6 e 12 semanas).',
  aprendiz_btn_mantido: 'Protocolo manteve desempenho nas sondas. Pronto para arquivar.',
  aprendiz_btn_arquivado: 'Arquivar o protocolo concluído com sucesso.',

  // ─── Sessão Finalizada ───
  sessao_trials: 'Tentativas de ensino registradas nesta sessão. Cada trial tem um alvo específico.',
  sessao_comportamentos: 'Comportamentos-problema observados durante a sessão (ex: autolesão, fuga).',
  sessao_acertos: '8 acertos em 10 tentativas. Se mantiver 80%+ por 3 sessões, o protocolo pode ser marcado como dominado.',
  sessao_prompt_level: 'Nível de ajuda usado: Física total = guiar completamente, Física parcial = guiar parcialmente.',
  sessao_enviar_resumo: 'Gera um resumo simplificado desta sessão para enviar aos pais/responsáveis por email.',

  // ─── Evolução CSO ───
  cso_evolucao: 'Gráfico de progresso ao longo do tempo. Linha subindo = aprendiz evoluindo.',
  cso_dimensoes: 'SAS = Aquisição de habilidades, PIS = Redução de problemas, BSS = Comportamento social, TCM = Gestão do tempo/tarefa.',

  // ─── Responsáveis ───
  responsaveis_adicionar: 'Cadastre pais ou responsáveis para receberem resumos das sessões por email.',
  responsaveis_vazio: 'Os responsáveis recebem um link seguro para acessar o Portal Família sem precisar de senha.',

  // ─── Novo Protocolo (modal) ───
  protocolo_dominio: 'Área de desenvolvimento: Comunicação, Comportamento, Social, Autonomia, etc.',
  protocolo_tecnica: 'Prática baseada em evidência científica. O sistema só permite técnicas validadas.',
  protocolo_objetivo: 'Descreva o comportamento esperado de forma mensurável. Ex: "Solicitar itens usando 2+ palavras em 80% das oportunidades".',
  protocolo_criterio: 'Percentual mínimo de acertos para considerar dominado. Padrão: 80%. Mínimo recomendado: 70%.',

  // ─── PEI ───
  pei_descricao: 'Plano semestral com metas de desenvolvimento. Os protocolos são vinculados às metas do PEI.',
  pei_metas_atingidas: 'Quantas metas do PEI foram concluídas. Uma meta é atingida quando todos os protocolos vinculados são dominados.',

  // ─── Relatórios ───
  relatorio_cso: 'Índice de progresso clínico calculado automaticamente. Usado para justificar carga horária ao convênio.',
  relatorio_banda: 'Faixas: Excelente (>85), Bom (70-85), Atenção (50-70), Crítico (<50).',
  relatorio_dimensoes: 'Dimensões do CSO: SAS=Aquisição, PIS=Problema, BSS=Comportamento, TCM=Gestão. Cada uma contribui para o índice final.',
  relatorio_motor: 'Versão do motor de cálculo. Garante rastreabilidade clínica conforme SBNI.',

  // ─── Equipe ───
  equipe_vinculos: 'Define quais aprendizes cada terapeuta pode ver. Terapeutas só acessam dados dos aprendizes vinculados a eles.',
  equipe_principal: 'Terapeuta principal é responsável pelo caso. Pode haver outros terapeutas auxiliares.',

  // ─── Configurações ───
  config_sonda_pendente: 'Aviso quando chegou a hora de aplicar sonda de 2, 6 ou 12 semanas após domínio.',
  config_alerta_regressao: 'Notifica quando o sistema detecta queda de desempenho em protocolo dominado.',
  config_audit_logs: 'Registro imutável de todas as ações. Exigido por compliance e LGPD.',
  config_retencao: 'Tempo mínimo que dados clínicos devem ser guardados conforme CFM/CRP.',

  // ─── Generalização 3×2 ───
  gen_descricao: 'Testar se o aprendiz mantém a habilidade com 3 variações (pessoas/materiais) em 2 contextos (ambientes diferentes).',
  gen_variacao: 'Diferentes pessoas ou materiais usados para testar a habilidade. Ex: mãe, pai, terapeuta.',
  gen_contexto: 'Diferentes ambientes onde a habilidade é testada. Ex: clínica, casa.',
  gen_celulas: 'Precisa completar 6 células (3 variações × 2 contextos) para considerar generalização concluída.',
  gen_desc_variacao: 'Descreva qual variação está sendo testada. Ex: "Com brinquedo diferente", "Com a mãe".',
  gen_desc_contexto: 'Descreva o ambiente do teste. Ex: "Na sala de espera", "Em casa".',
  gen_nivel_dica: 'Quanto de ajuda foi necessária: Independente = sem ajuda, Física total = ajuda completa.',
  gen_tentativas: 'Quantas vezes tentou e quantas acertou. O critério (ex: 80%) é calculado automaticamente.',
} as const

export type TooltipKey = keyof typeof TOOLTIPS
