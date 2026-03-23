// =====================================================
// AXIS ABA — Textos Educativos (Tooltips)
// Arquivo centralizado para facilitar tradução futura.
// Chave = identificador único, valor = texto curto.
// =====================================================

export const TOOLTIPS = {
  // ─── Dashboard Hub ───
  dash_aprendizes: 'Total de aprendizes cadastrados na clínica.',
  dash_protocolos: 'Protocolos em fase de ensino ativo. "Dominados" = atingiram critério de 80% em 3 sessões.',
  dash_cso_medio: 'Clinical Significance Outcome — índice geral de progresso clínico. Acima de 70 = bom progresso.',
  dash_em_alerta: 'Aprendizes com protocolos em regressão ou desempenho abaixo do esperado.',
  dash_taxa_mastery: 'Percentual de protocolos que atingiram critério de domínio (80% em 3 sessões).',
  dash_tempo_mastery: 'Média de dias entre ativar um protocolo e atingir domínio.',
  dash_sessoes_totais: 'Total de sessões finalizadas. A duração média é calculada automaticamente.',
  dash_gen_manut: 'Protocolos em generalização (testar com outras pessoas/ambientes) ou manutenção (sondas 2/6/12 semanas).',
  dash_regressoes: 'Quando um protocolo dominado apresenta queda de desempenho e precisa ser retomado.',
  dash_cancelamento: 'Percentual de sessões canceladas nos últimos 30 dias. Acima de 20% merece atenção.',
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
  gen_descricao: 'Testar se o aprendiz mantém a habilidade com 3 pessoas diferentes em 2 ambientes diferentes.',
  gen_variacao: 'Diferentes pessoas que aplicam a habilidade. Ex: mãe, pai, terapeuta.',
  gen_contexto: 'Diferentes ambientes onde a habilidade é testada. Ex: clínica, casa, escola.',
  gen_celulas: 'Precisa completar 6 células (3 pessoas × 2 ambientes) para considerar generalização concluída.',
  gen_desc_variacao: 'Quem está aplicando. Ex: "Mãe", "Pai", "Terapeuta Ana".',
  gen_desc_contexto: 'Onde está sendo testado. Ex: "Clínica", "Em casa", "Escola".',
  gen_nivel_dica: 'Quanto de ajuda foi necessária: Independente = sem ajuda, Física total = ajuda completa.',
  gen_tentativas: 'Quantas vezes tentou e quantas acertou. O critério (ex: 80%) é calculado automaticamente.',

  // ─── Locais de Atendimento (v2.7.0 Sprint 0) ───
  site_locais: 'Cadastre os locais onde sua equipe atende. Na sessão, o terapeuta seleciona o local e o GPS valida a presença automaticamente.',
  site_raio: 'Distância máxima aceitável entre o GPS do terapeuta e este local. Padrão: 200m.',

  // ─── Prova de Presença (v2.7.0 Sprint 1) ───
  presenca_gps: 'Captura a localização GPS do dispositivo para comprovar presença no local de atendimento. Classificação automática: válido, ressalva ou exceção.',
  presenca_anexos: 'Fotos e documentos anexados à sessão. Formatos: JPG, PNG, PDF (até 10MB). Duplicatas são detectadas automaticamente.',
  evidencia_bundle: 'Pacote de evidências da sessão: snapshot clínico, provas GPS, atestações e anexos. Hash SHA256 garante integridade. Imutável após geração.',

  // ─── Camada Institucional (v2.7.0 Sprint 2) ───
  credenciais_equipe: 'Cadastro dos conselhos profissionais (CRP, CRFa, CREFITO, etc.), credenciamento junto a operadoras e dados de formação da equipe.',
  cobertura_pagador: 'Vínculos com operadoras de saúde. Cada aprendiz pode ter múltiplas coberturas ativas com códigos de autorização e horas semanais aprovadas.',

  // ─── Integridade (v2.7.0 Sprint 3) ───
  integridade_painel: 'Painel de conformidade com alertas automáticos. Flags críticas exigem revisão humana. O scan diário detecta inconsistências como sessões sobrepostas, conselho vencido e horas excedidas.',
  integridade_flag: 'Alerta de integridade detectado pelo sistema. Severidade: crítico (ação imediata), atenção (revisar), info (registro). Flags críticas não podem ser dispensadas sem justificativa.',
  integridade_scan: 'Executa verificação completa de conformidade. Detecta sobreposição de sessões, duração excessiva, exceções recorrentes, conselhos vencidos e mais.',

  // ─── Perfis de Pagador (v2.7.0 Sprint 4) ───
  perfil_pagador: 'Requisitos exigidos por cada operadora: GPS, atestação do responsável, foto, documentação obrigatória, frequência de relatórios e formatos aceitos. Alterações são versionadas no audit log.',
  // ─── Páginas Comerciais (linguagem 50+) ───
  pub_gps: 'O sistema confirma automaticamente que o terapeuta estava no local do atendimento usando a localização do celular. Funciona como um "ponto digital" com prova geográfica.',
  pub_atestacao: 'Depois da sessão, o terapeuta e o responsável pelo paciente confirmam digitalmente que o atendimento aconteceu. É como uma assinatura eletrônica vinculada ao prontuário.',
  pub_bundle: 'Todos os registros da sessão (dados clínicos, localização GPS, assinaturas, fotos) são reunidos num pacote único e protegido. Ninguém pode alterar depois de gerado.',
  pub_claim: 'A documentação necessária para solicitar reembolso à operadora de saúde é gerada automaticamente a partir dos dados da sessão. Sem preencher formulários extras.',
  pub_compliance: 'O sistema verifica automaticamente se há documentos vencidos, sessões sem comprovação ou inconsistências. Alertas aparecem antes que virem problemas.',
  pub_cobertura: 'Os dados do plano de saúde do paciente ficam vinculados ao prontuário: qual operadora, número da autorização, quantas horas por semana, validade. Tudo num só lugar.',
  pub_cso: 'Um número calculado automaticamente que mostra se o paciente está evoluindo. Acima de 70 é considerado bom progresso. Ajuda a visualizar a melhora ao longo do tempo.',
  pub_lgpd: 'Lei Geral de Proteção de Dados. O sistema segue as regras brasileiras de privacidade: dados GPS são apagados automaticamente após o período necessário.',
  pub_operadora: 'Empresas de plano de saúde (Unimed, Bradesco Saúde, SulAmérica, etc.) que exigem comprovação detalhada dos atendimentos para liberar reembolso.',
  pub_append_only: 'Depois que um registro clínico é salvo, ele nunca é apagado ou alterado. Novas informações são adicionadas sem modificar o histórico. Isso garante rastreabilidade total.',
  pub_multi_tenant: 'Cada clínica tem seus dados completamente separados. Nenhuma clínica consegue ver ou acessar dados de outra, mesmo estando no mesmo sistema.',
  pub_motor_congelado: 'O motor de cálculo clínico (que mede progresso do paciente) foi testado e validado. Ele não muda quando novas funcionalidades são adicionadas. Seus dados históricos ficam intactos.',
  pub_founders: 'Primeiros clientes que adotam o sistema. Em troca, garantem o preço de lançamento para sempre, mesmo quando o valor normal aumentar.',
  pub_dashboard_compliance: 'Painel visual que mostra a situação de toda a clínica: quais documentos estão em dia, quais vencem em breve, e onde há pendências que precisam de atenção.',
  pub_credenciais: 'Registros profissionais da equipe: número do conselho (CRP, CRFa, etc.), validade, credenciamento junto a operadoras. O sistema avisa quando algo está para vencer.',
  pub_flags: 'Alertas automáticos quando o sistema detecta algo que precisa de atenção: documento vencido, sessão sem GPS, horários sobrepostos. Cada alerta tem nível de urgência.',
  pub_service_sites: 'Endereços cadastrados onde a equipe faz atendimentos. Quando o terapeuta faz check-in, o GPS compara com o endereço cadastrado para validar a presença.',
  pub_payer_profiles: 'Cada operadora de saúde tem regras diferentes (quais documentos exige, se precisa de GPS, formato do relatório). Esses perfis guardam as regras de cada uma.',

  // ─── Tabela de planos — Motor Clínico ───
  pub_motor_cso: 'O coração do sistema: calcula automaticamente se o paciente está evoluindo. Analisa sessões, tentativas e comportamentos para gerar um índice de progresso confiável.',
  pub_registro_estruturado: 'Cada sessão é registrada com campos padronizados: tentativas por alvo, nível de dica, comportamentos, duração. Nada se perde e tudo vira dado mensurável.',
  pub_relatorio_institucional: 'Relatório gerado automaticamente com os dados das sessões. Pronto para apresentar a supervisores, famílias ou operadoras de saúde.',
  pub_multi_terapeuta: 'Vários profissionais podem acessar o mesmo sistema, cada um vendo apenas os aprendizes vinculados a ele. Ideal para clínicas com equipe multidisciplinar.',
  pub_relatorios_consolidados: 'Visão geral de todos os aprendizes e terapeutas da clínica. Ajuda a supervisão a acompanhar o progresso de toda a equipe num só lugar.',
  pub_onboarding: 'Acompanhamento dedicado para configurar a clínica no sistema: cadastrar equipe, importar dados, configurar protocolos. Suporte humano nos primeiros passos.',
  pub_atestacao_terapeuta: 'Depois da sessão, o terapeuta confirma digitalmente que o atendimento aconteceu. Funciona como assinatura eletrônica vinculada ao prontuário.',
  pub_locais_atendimento: 'Endereços cadastrados onde a equipe atende. Na sessão, o GPS do terapeuta é comparado automaticamente com o local cadastrado para validar presença.',
  pub_anexos_sessao: 'Fotos, documentos e registros podem ser anexados diretamente à sessão. Tudo fica vinculado ao prontuário e protegido contra alteração.',
  pub_credenciais_provedor: 'Registros profissionais da equipe (CRP, CRFa, CREFITO, etc.), credenciamentos e validades. O sistema avisa quando algo está para vencer.',
  pub_flags_integridade: 'Alertas automáticos que detectam inconsistências: documento vencido, sessão sem GPS, horários sobrepostos. Cada alerta tem nível de urgência.',
  pub_perfis_operadora: 'Cada operadora de saúde tem regras diferentes. Esses perfis guardam quais documentos cada uma exige, se precisa de GPS e o formato do relatório.',
  pub_investimento: 'Valor mensal do plano. Inclui todos os recursos listados acima, sem cobrança extra por funcionalidade.',
} as const

export type TooltipKey = keyof typeof TOOLTIPS
