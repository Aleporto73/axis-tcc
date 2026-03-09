-- Migration 015: Seed expandido da Biblioteca de Protocolos ABA
--
-- Usa subquery para resolver ebp_practice_id a partir do nome,
-- garantindo compatibilidade com o schema real (ebp_practice_id NOT NULL).

INSERT INTO protocol_library (title, domain, objective, ebp_practice_id, ebp_practice_name, measurement_type, default_mastery_pct, default_mastery_sessions, default_mastery_trials, difficulty_level, tags)
VALUES
  -- Comunicação
  ('Contato Visual sob Demanda', 'comunicacao',
   'Estabelecer contato visual por 3 segundos quando chamado pelo nome, em 80% das oportunidades por 3 sessões consecutivas.',
   (SELECT id FROM ebp_practices WHERE name = 'DTT' LIMIT 1), 'DTT', 'discrete_trial', 80, 3, 10, 1,
   ARRAY['contato visual','atenção','básico','pré-requisito']),

  ('Ecoico Funcional', 'comunicacao',
   'Repetir vocalizações de 1-2 sílabas com correspondência fonética em 80% das tentativas por 3 sessões consecutivas.',
   (SELECT id FROM ebp_practices WHERE name = 'DTT' LIMIT 1), 'DTT', 'discrete_trial', 80, 3, 10, 2,
   ARRAY['ecoico','vocalização','verbal','comunicação']),

  ('Pedido com PECS Fase III', 'comunicacao',
   'Discriminar entre 2+ figuras e entregar a figura correspondente ao item desejado em 80% das oportunidades.',
   (SELECT id FROM ebp_practices WHERE name = 'PECS' LIMIT 1), 'PECS', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['PECS','comunicação alternativa','discriminação','mando']),

  -- Social
  ('Brincar Paralelo', 'social',
   'Permanecer em atividade de brincar ao lado de um par por 5 minutos sem comportamento de fuga ou agressão, em 80% das oportunidades.',
   (SELECT id FROM ebp_practices WHERE name = 'NET' LIMIT 1), 'NET', 'duration', 80, 3, 10, 2,
   ARRAY['brincar','social','interação','par']),

  ('Revezamento em Jogos', 'social',
   'Esperar sua vez e passar o turno em jogos de mesa com 1 par, sem necessidade de prompt, em 80% das rodadas por 3 sessões.',
   (SELECT id FROM ebp_practices WHERE name = 'Social Stories' LIMIT 1), 'Social Stories', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['revezamento','jogo','turno','social']),

  -- Autocuidado
  ('Lavar as Mãos — Cadeia Completa', 'autocuidado',
   'Completar todos os 8 passos da cadeia de lavar as mãos de forma independente em 80% das oportunidades por 3 sessões consecutivas.',
   (SELECT id FROM ebp_practices WHERE name = 'Task Analysis' LIMIT 1), 'Task Analysis', 'task_analysis', 80, 3, 10, 2,
   ARRAY['autocuidado','higiene','cadeia','independência']),

  ('Escovar os Dentes com Apoio Visual', 'autocuidado',
   'Seguir rotina visual de escovação (6 passos) com independência em 80% dos passos por 3 sessões consecutivas.',
   (SELECT id FROM ebp_practices WHERE name = 'Task Analysis' LIMIT 1), 'Task Analysis', 'task_analysis', 80, 3, 10, 2,
   ARRAY['autocuidado','higiene','escovação','rotina visual']),

  -- Motor
  ('Imitação Motora Grossa', 'motor',
   'Imitar 10 movimentos motores grossos (bater palmas, levantar braços, pular) sob modelo em 80% das tentativas por 3 sessões.',
   (SELECT id FROM ebp_practices WHERE name = 'DTT' LIMIT 1), 'DTT', 'discrete_trial', 80, 3, 10, 1,
   ARRAY['imitação','motor grosso','básico','pré-requisito']),

  ('Imitação Motora Fina', 'motor',
   'Imitar 8 movimentos motores finos (pinça, apontar, girar pulso) sob modelo em 80% das tentativas por 3 sessões.',
   (SELECT id FROM ebp_practices WHERE name = 'DTT' LIMIT 1), 'DTT', 'discrete_trial', 80, 3, 10, 2,
   ARRAY['imitação','motor fino','coordenação']),

  -- Comportamento
  ('Redução de Autolesão com DRA', 'comportamento',
   'Reduzir frequência de comportamento autolesivo em 80% em relação à linha de base, com uso de comportamento alternativo funcional, por 3 sessões consecutivas.',
   (SELECT id FROM ebp_practices WHERE name = 'DRA' LIMIT 1), 'DRA', 'frequency', 80, 3, 10, 4,
   ARRAY['autolesão','DRA','comportamento','redução','funcional']),

  ('Transição entre Atividades', 'comportamento',
   'Realizar transições entre atividades dentro de 30 segundos após sinal, sem comportamento disruptivo, em 80% das transições por 3 sessões.',
   (SELECT id FROM ebp_practices WHERE name = 'Prompt Fading' LIMIT 1), 'Prompt Fading', 'discrete_trial', 80, 3, 10, 2,
   ARRAY['transição','flexibilidade','rotina','prompt']),

  -- Cognitivo
  ('Categorização por Função', 'cognitivo',
   'Agrupar objetos/figuras pela função (coisas de comer, vestir, brincar) com 80% de acerto em campo de 3 categorias por 3 sessões.',
   (SELECT id FROM ebp_practices WHERE name = 'DTT' LIMIT 1), 'DTT', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['categorização','função','cognitivo','discriminação']),

  ('Receptivo por Função/Característica', 'cognitivo',
   'Selecionar item correto quando descrito por função ou característica (ex: "qual voa?") em campo de 4, com 80% de acerto por 3 sessões.',
   (SELECT id FROM ebp_practices WHERE name = 'DTT' LIMIT 1), 'DTT', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['receptivo','RFFC','função','característica','linguagem']),

  -- Brincar
  ('Brincar Funcional com Objetos', 'brincar',
   'Demonstrar uso funcional de 5+ brinquedos/objetos (empurrar carrinho, alimentar boneca) de forma independente em 80% das oportunidades.',
   (SELECT id FROM ebp_practices WHERE name = 'NET' LIMIT 1), 'NET', 'discrete_trial', 80, 3, 10, 2,
   ARRAY['brincar','funcional','objetos','simbólico']),

  -- Acadêmico
  ('Emparelhamento Letra-Som', 'academico',
   'Selecionar a letra correspondente ao som apresentado (10 letras-alvo) com 80% de acerto em campo de 4 por 3 sessões.',
   (SELECT id FROM ebp_practices WHERE name = 'DTT' LIMIT 1), 'DTT', 'discrete_trial', 80, 3, 10, 3,
   ARRAY['acadêmico','letras','fonema','alfabetização','pré-escolar'])

ON CONFLICT DO NOTHING;

-- Normaliza ebp_practice_name e seta ebp_practice_id dos seeds antigos (migration 005)
UPDATE protocol_library SET
  ebp_practice_name = 'DTT',
  ebp_practice_id = (SELECT id FROM ebp_practices WHERE name = 'DTT' LIMIT 1)
WHERE ebp_practice_name IN ('Discrete Trial Training', 'discrete_trial_training')
  AND (ebp_practice_id IS NULL OR ebp_practice_name != 'DTT');

UPDATE protocol_library SET
  ebp_practice_name = 'FCT',
  ebp_practice_id = (SELECT id FROM ebp_practices WHERE name = 'FCT' LIMIT 1)
WHERE ebp_practice_name IN ('Functional Communication Training')
  AND (ebp_practice_id IS NULL OR ebp_practice_name != 'FCT');

UPDATE protocol_library SET
  ebp_practice_name = 'Social Stories',
  ebp_practice_id = (SELECT id FROM ebp_practices WHERE name = 'Social Stories' LIMIT 1)
WHERE ebp_practice_name IN ('Social Skills Training')
  AND (ebp_practice_id IS NULL OR ebp_practice_name != 'Social Stories');

UPDATE protocol_library SET
  ebp_practice_name = 'DRA',
  ebp_practice_id = (SELECT id FROM ebp_practices WHERE name = 'DRA' LIMIT 1)
WHERE ebp_practice_name IN ('Differential Reinforcement')
  AND (ebp_practice_id IS NULL OR ebp_practice_name != 'DRA');

-- Preencher ebp_practice_id para qualquer registro que tenha ebp_practice_name mas não tenha id
UPDATE protocol_library pl SET
  ebp_practice_id = ep.id
FROM ebp_practices ep
WHERE pl.ebp_practice_name = ep.name
  AND pl.ebp_practice_id IS NULL;
