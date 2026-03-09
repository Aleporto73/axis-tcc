-- Migration 015: Seed expandido da Biblioteca de Protocolos ABA
--
-- Schema: protocol_library (sem tenant_id — tabela global)
--   title TEXT, domain TEXT, objective TEXT, ebp_practice_name TEXT,
--   measurement_type TEXT, default_mastery_pct INT, default_mastery_sessions INT,
--   default_mastery_trials INT, difficulty_level INT (1-5), tags TEXT[], is_active BOOLEAN
--
-- ebp_practices existentes no banco (por nome):
--   DTT, NET, PRT, FCT, PECS, Social Stories, Video Modeling,
--   Task Analysis, Self-Management, Extinction, DRA, DRO, NCR,
--   Prompt Fading, Shaping
--
-- Seeds existentes (migration 005, 8 protocolos):
--   Imitação Motora, Tato de Objetos Comuns, Mando Funcional,
--   Intraverbal Simples, Habilidades Sociais - Cumprimentar,
--   Seguir Instruções de 2 Passos, Pareamento por Identidade,
--   Tolerância a Espera
--
-- Domínios usados no sistema:
--   comunicacao, social, academico, autocuidado, motor, comportamento, brincar, cognitivo

INSERT INTO protocol_library (title, domain, objective, ebp_practice_name, measurement_type, default_mastery_pct, default_mastery_sessions, default_mastery_trials, difficulty_level, tags)
VALUES
  -- Comunicação
  ('Contato Visual sob Demanda', 'comunicacao',
   'Estabelecer contato visual por 3 segundos quando chamado pelo nome, em 80% das oportunidades por 3 sessões consecutivas.',
   'DTT', 'discrete_trial', 80, 3, 10, 1,
   ARRAY['contato visual','atenção','básico','pré-requisito']),

  ('Ecoico Funcional', 'comunicacao',
   'Repetir vocalizações de 1-2 sílabas com correspondência fonética em 80% das tentativas por 3 sessões consecutivas.',
   'DTT', 'discrete_trial', 80, 3, 10, 2,
   ARRAY['ecoico','vocalização','verbal','comunicação']),

  ('Pedido com PECS Fase III', 'comunicacao',
   'Discriminar entre 2+ figuras e entregar a figura correspondente ao item desejado em 80% das oportunidades.',
   'PECS', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['PECS','comunicação alternativa','discriminação','mando']),

  -- Social
  ('Brincar Paralelo', 'social',
   'Permanecer em atividade de brincar ao lado de um par por 5 minutos sem comportamento de fuga ou agressão, em 80% das oportunidades.',
   'NET', 'duration', 80, 3, 10, 2,
   ARRAY['brincar','social','interação','par']),

  ('Revezamento em Jogos', 'social',
   'Esperar sua vez e passar o turno em jogos de mesa com 1 par, sem necessidade de prompt, em 80% das rodadas por 3 sessões.',
   'Social Stories', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['revezamento','jogo','turno','social']),

  -- Autocuidado
  ('Lavar as Mãos — Cadeia Completa', 'autocuidado',
   'Completar todos os 8 passos da cadeia de lavar as mãos de forma independente em 80% das oportunidades por 3 sessões consecutivas.',
   'Task Analysis', 'task_analysis', 80, 3, 10, 2,
   ARRAY['autocuidado','higiene','cadeia','independência']),

  ('Escovar os Dentes com Apoio Visual', 'autocuidado',
   'Seguir rotina visual de escovação (6 passos) com independência em 80% dos passos por 3 sessões consecutivas.',
   'Task Analysis', 'task_analysis', 80, 3, 10, 2,
   ARRAY['autocuidado','higiene','escovação','rotina visual']),

  -- Motor
  ('Imitação Motora Grossa', 'motor',
   'Imitar 10 movimentos motores grossos (bater palmas, levantar braços, pular) sob modelo em 80% das tentativas por 3 sessões.',
   'DTT', 'discrete_trial', 80, 3, 10, 1,
   ARRAY['imitação','motor grosso','básico','pré-requisito']),

  ('Imitação Motora Fina', 'motor',
   'Imitar 8 movimentos motores finos (pinça, apontar, girar pulso) sob modelo em 80% das tentativas por 3 sessões.',
   'DTT', 'discrete_trial', 80, 3, 10, 2,
   ARRAY['imitação','motor fino','coordenação']),

  -- Comportamento
  ('Redução de Autolesão com DRA', 'comportamento',
   'Reduzir frequência de comportamento autolesivo em 80% em relação à linha de base, com uso de comportamento alternativo funcional, por 3 sessões consecutivas.',
   'DRA', 'frequency', 80, 3, 10, 4,
   ARRAY['autolesão','DRA','comportamento','redução','funcional']),

  ('Transição entre Atividades', 'comportamento',
   'Realizar transições entre atividades dentro de 30 segundos após sinal, sem comportamento disruptivo, em 80% das transições por 3 sessões.',
   'Prompt Fading', 'discrete_trial', 80, 3, 10, 2,
   ARRAY['transição','flexibilidade','rotina','prompt']),

  -- Cognitivo
  ('Categorização por Função', 'cognitivo',
   'Agrupar objetos/figuras pela função (coisas de comer, vestir, brincar) com 80% de acerto em campo de 3 categorias por 3 sessões.',
   'DTT', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['categorização','função','cognitivo','discriminação']),

  ('Receptivo por Função/Característica', 'cognitivo',
   'Selecionar item correto quando descrito por função ou característica (ex: "qual voa?") em campo de 4, com 80% de acerto por 3 sessões.',
   'DTT', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['receptivo','RFFC','função','característica','linguagem']),

  -- Brincar
  ('Brincar Funcional com Objetos', 'brincar',
   'Demonstrar uso funcional de 5+ brinquedos/objetos (empurrar carrinho, alimentar boneca) de forma independente em 80% das oportunidades.',
   'NET', 'discrete_trial', 80, 3, 10, 2,
   ARRAY['brincar','funcional','objetos','simbólico']),

  -- Acadêmico
  ('Emparelhamento Letra-Som', 'academico',
   'Selecionar a letra correspondente ao som apresentado (10 letras-alvo) com 80% de acerto em campo de 4 por 3 sessões.',
   'DTT', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['acadêmico','letras','fonema','alfabetização','pré-escolar'])

ON CONFLICT DO NOTHING;
