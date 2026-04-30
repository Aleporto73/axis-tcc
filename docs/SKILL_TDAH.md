# AXIS TDAH — Documentação de Conhecimento (Skill da Ana)

Última atualização: 14/03/2026
Versão do motor: CSO-TDAH v1.0.0
Tom: acolhedor, direto, como uma colega que conhece o sistema por dentro.

---

## 1. O QUE É O AXIS TDAH E PARA QUEM É

O AXIS TDAH é um sistema de gestão clínica criado especificamente para profissionais que atendem crianças e adolescentes com TDAH. Faz parte do ecossistema AXIS, ao lado do TCC e do ABA, mas tem identidade e motor próprios.

**Para quem é:**
- Neuropsicólogos, psicólogos, psicopedagogos e terapeutas ocupacionais que atendem TDAH
- Clínicas com equipe multiprofissional que acompanham o paciente nos três ambientes: consultório, escola e casa
- Profissionais que precisam integrar os dados da escola (professor) e da família (responsável) no mesmo prontuário
- Quem tem pacientes com sobreposição TDAH + autismo (AuDHD) e precisa de rastreamento diferenciado

**O que o diferencia do ABA:**
- O paciente TDAH não é "aprendiz" — é paciente. O trabalho é acompanhamento clínico, não ensino de habilidades discretas
- O TDAH aparece em três contextos ao mesmo tempo: consultório, escola e casa. Todos precisam ser registrados
- O motor CSO-TDAH usa 3 blocos com layer AuDHD opcional — diferente do ABA que tem 4 dimensões lineares fixas
- Tem DRC (Daily Report Card): o professor preenche metas diárias no portal escolar e o clínico revisa pelo sistema
- Tem módulo Casa: rotinas domésticas e economia de fichas para pais e cuidadores

**Princípios inegociáveis:**
- O sistema NÃO decide nada — organiza dados para que você decida
- O histórico clínico é imutável — uma sessão fechada nunca pode ser alterada
- Toda ação é auditada — há registro de quem fez o quê e quando
- Cada clínica tem seus dados completamente isolados — nunca cruzam com outra clínica

---

## 2. FLUXO COMPLETO DO SISTEMA

```
Cadastrar paciente
    ↓
Ativar protocolos da biblioteca
    ↓
Agendar sessão (escolher contexto: consultório / casa / escola)
    ↓
Abrir sessão → registrar observações (SAS, PIS, BSS, EXR + AuDHD se ativa)
    ↓
Fechar sessão → motor CSO-TDAH gera snapshot automaticamente
    ↓
Gráfico de evolução atualizado na ficha do paciente
    ↓
Professor preenche DRC (portal escolar) → você revisa
    ↓
Família acessa portal com dados simplificados (sem scores clínicos)
    ↓
Relatório gerado por período → imprimível para convênio ou arquivo
```

Cada passo é independente. Você pode registrar uma sessão sem protocolos ativos, pode ter DRC sem sessão no mesmo dia, pode revisar relatório a qualquer momento. O sistema não força uma ordem rígida — ele registra o que aconteceu.

---

## 3. PLANOS E PREÇOS

| Plano | Preço | Pacientes | Para quem |
|-------|-------|-----------|-----------|
| **Free** | Grátis | 1 paciente | Testar o sistema sem compromisso |
| **Founders** | R$97/mês | Até 50 pacientes | Clínico solo ou pequena clínica |
| **Clínica 100** | R$247/mês | Até 100 pacientes | Clínica de médio porte |
| **Clínica 250** | R$497/mês | Até 250 pacientes | Clínica grande |
| **Enterprise** | Consultar | Ilimitado | Redes e franquias |

**Detalhes importantes:**
- O plano Free não expira — você pode usar com 1 paciente ativo para sempre
- Todos os recursos do sistema estão disponíveis em todos os planos pagos (DRC, portal escola, portal família, módulo casa, relatórios, alertas, equipe)
- Os pagamentos são processados pela Hotmart — o acesso é liberado automaticamente após a compra
- Para fazer upgrade, acesse o menu Preços dentro do AXIS TDAH ou entre em contato pelo suporte
- Se você atingir o limite do seu plano, uma mensagem de upgrade aparece ao tentar cadastrar um novo paciente

---

## 4. CADASTRO E FICHA DO PACIENTE

### O que é registrado no cadastro

- Nome completo, data de nascimento, gênero
- Diagnóstico (texto livre) e CID (código)
- Nível de suporte: 1 (mais autonomia) a 3 (mais apoio)
- Escola, contato da escola, nome e email do professor
- Observações clínicas (notas internas — invisíveis para professor e família)
- Status: ativo ou inativo

### O que aparece na ficha

- Totais: sessões realizadas, protocolos ativos
- Evolução: gráfico CSO-TDAH gerado automaticamente após cada sessão fechada
- Histórico de protocolos com status e datas
- Sessões recentes com link direto para a condução
- Responsáveis cadastrados com acesso ao portal família
- Seção DRC com link para registros escolares
- Card da camada AuDHD com os 3 estados (desativada / core / completa)
- Tokens de acesso para professor e família (quando gerados)

### Editar dados do paciente

Qualquer campo do cadastro pode ser editado pelo botão "Editar" na ficha. Terapeutas podem editar apenas seus próprios pacientes. Admin e supervisor podem editar qualquer paciente da clínica.

---

## 5. PROTOCOLOS — BIBLIOTECA E CICLO DE VIDA

### A biblioteca

O AXIS TDAH tem 46 protocolos clínicos organizados por bloco e prioridade:

- **42 protocolos P1** — primeira prioridade, prontos para uso
- **4 protocolos P1.1** — variações especializadas (requerem avaliação)

Os blocos organizam os protocolos por área de desenvolvimento:

| Bloco | Nome | Foco |
|-------|------|------|
| A | Base | Atenção sustentada, regulação básica |
| B | Executivo | Planejamento, memória de trabalho, inibição |
| C | AuDHD | Protocolos para sobreposição TDAH + autismo |
| D | Acadêmico | Desempenho em tarefas escolares |
| E | Social | Interação, comunicação, grupo |
| F | Emocional | Regulação emocional, autocontrole |
| G | Autonomia | Independência em atividades do dia a dia |

Protocolos marcados como "requer AuDHD" só podem ser ativados quando a camada AuDHD está ativa para o paciente.

### Como ativar um protocolo

Na ficha do paciente, seção Protocolos → "+ Ativar Protocolo" → escolha na biblioteca. O sistema avisa se o protocolo já está ativo para evitar duplicatas.

### Ciclo de vida do protocolo

```
Ativo → Em revisão → Dominado → Arquivado
                   ↘ Regressão → Ativo (recomeça)
Ativo → Suspenso (pausa) → Ativo
Ativo → Descontinuado (encerrado definitivamente)
```

- **Ativo**: protocolo em trabalho com o paciente
- **Em revisão**: você está avaliando o progresso antes de decidir
- **Dominado**: paciente atingiu o critério — celebre com ela!
- **Regressão**: houve queda após domínio — protocolo volta para ativo
- **Suspenso**: pausa temporária, pode retomar
- **Descontinuado**: objetivo não é mais relevante — encerrado
- **Arquivado**: protocolo concluído e guardado no histórico

Cada transição exige confirmação na tela e gera registro no log de auditoria. Você nunca perde o histórico de um protocolo.

---

## 6. SESSÕES TRICONTEXTUAIS

### Os 3 contextos

O TDAH não existe só no consultório. Por isso o AXIS TDAH acompanha o paciente nos três ambientes onde o transtorno aparece:

- **Clínico (🏥)**: sessão presencial no consultório — você tem controle total
- **Domiciliar (🏠)**: sessão na casa — trabalho com rotinas, economia de fichas, comportamento no lar
- **Escolar (🏫)**: sessão ou observação na escola — integra o que o professor vê ao trabalho clínico

O contexto da sessão influencia o motor CSO-TDAH. O painel mostra a distribuição dos três contextos nos últimos 30 dias.

### Fluxo de uma sessão

1. Agendar: escolher paciente, data, hora e contexto
2. Abrir sessão: clique em "Abrir Sessão" para registrar o horário de início
3. Registrar observações: botão "+ Observação" durante a sessão
4. Registrar eventos (opcional): botão "+ Evento" para comportamentos importantes
5. Fechar sessão: clique em "Fechar Sessão" — o motor processa automaticamente

Após fechar, a sessão é **imutável**. Isso é intencional — o histórico clínico não pode ser alterado. Se esqueceu de registrar algo, a próxima sessão é o lugar certo.

### Enviar resumo aos pais

Com a sessão concluída, clique "Enviar Resumo". O sistema gera um texto automático a partir das observações. Você edita, revisa e aprova antes do envio. O email vai pelo sistema — você não precisa usar email próprio.

O resumo **nunca inclui** scores CSO nem dados clínicos brutos. É uma comunicação simplificada para a família.

---

## 7. OBSERVAÇÕES CLÍNICAS — OS 3 BLOCOS

Cada observação registrada durante uma sessão captura métricas dos blocos que você escolhe preencher.

### Bloco Base (sempre disponível)

| Métrica | O que mede | Como registrar |
|---------|------------|----------------|
| **SAS** | Atenção e permanência na tarefa | Porcentagem de 0 a 100 |
| **PIS** | Resposta a instruções e estrutura | Nível: independente / mínimo / moderado / total |
| **BSS** | Autocontrole e regulação emocional | Nível: estável / leve / desregulado |

### Bloco Executivo (sempre disponível)

| Métrica | O que mede | Como registrar |
|---------|------------|----------------|
| **EXR** | Organização, planejamento, flexibilidade | Nível: excelente / adequado / prejudicado / severamente prejudicado |

### Bloco AuDHD (só quando camada AuDHD está ativa)

| Métrica | O que mede | Como registrar |
|---------|------------|----------------|
| **SEN** | Sensibilidade sensorial (sons, luz, textura) | Nível: ausente / leve / moderado / severo |
| **TRF** | Dificuldade em transições de atividade | Nível: ausente / leve / moderado / severo |
| **RIG** | Rigidez comportamental e inflexibilidade | Estado: flexível / rigidez leve / rigidez moderada / rigidez severa + severidade |

**Dica prática:** você não precisa preencher todos os campos de cada observação. Preencha o que foi observado naquele momento. Campos vazios são tratados como "não observado" — o sistema não interpreta ausência como melhora.

### Registrar um evento

Além das observações, você pode registrar eventos avulsos durante a sessão:

- **Transição**: mudança de atividade
- **Sensorial**: resposta a estímulo sensorial
- **Comportamental**: comportamento relevante
- **ABC**: análise comportamental completa (antecedente, comportamento, consequência)
- **Esquiva de tarefa**: fuga de demanda
- **Meltdown**: colapso emocional/sensorial
- **Desvio de foco**: dispersão significativa
- **Estratégia adaptativa**: uso espontâneo de estratégia

---

## 8. MOTOR CSO-TDAH v1.0.0

### O que é

O CSO-TDAH (Clinical State Object) é o índice que mede a evolução clínica do seu paciente ao longo do tempo. Ele é calculado automaticamente quando você fecha uma sessão — você não precisa fazer nada.

O score vai de 0 a 100. Quanto maior, melhor o desempenho.

### Como é calculado

O motor usa 3 blocos com pesos configuráveis:

- **Bloco Base (peso padrão: 0.5)**: combina SAS, PIS, BSS e TCM
- **Bloco Executivo (peso padrão: 0.3)**: baseado no EXR registrado
- **Bloco AuDHD (peso padrão: 0.2)**: só entra no cálculo quando a layer está ativa

O score final é: `(Base × peso_base) + (Executivo × peso_exec) + (AuDHD × peso_audhd)`

Os pesos são configuráveis por versão do motor — isso permite ajustes clínicos futuros sem perder a rastreabilidade histórica.

### Faixas de interpretação

| Faixa | Score | O que significa |
|-------|-------|-----------------|
| Excelente | > 85 | Evolução consistente e expressiva |
| Bom | 70 – 85 | Progresso adequado, no caminho certo |
| Atenção | 50 – 70 | Possível estagnação — rever protocolos |
| Crítico | < 50 | Pouco progresso ou dados insuficientes |

**Importante:** as faixas são referências, não diagnóstico. Um score baixo pode significar simplesmente que você ainda está na fase de coleta de dados. Confie no seu julgamento clínico.

### O snapshot

Toda sessão fechada gera um **snapshot imutável**: registro permanente do score, das métricas, da faixa, do contexto e da versão do motor naquele momento. O snapshot nunca é alterado, mesmo que você mude algo no paciente ou no protocolo depois.

O gráfico na ficha do paciente mostra a linha de evolução de todos os snapshots — score final, score base e (quando ativa) score AuDHD.

### Dados faltantes

Se uma sessão foi fechada sem observações (ou com poucas), o motor registra a confiança como "baixa" e não penaliza o score artificialmente. Ausência de dado não é interpretada como regressão.

---

## 9. LAYER AuDHD

### O que é

A Layer AuDHD é uma camada adicional de acompanhamento para pacientes que têm TDAH e autismo ao mesmo tempo — um perfil chamado AuDHD. Não é um produto separado nem um diagnóstico automático: é uma ferramenta que **você ativa quando avalia que faz sentido clinicamente**.

### Os 3 modos

| Modo | O que ativa | Quando usar |
|------|-------------|-------------|
| **Desativada** | Nada extra | Paciente com TDAH puro, sem sobreposição autista |
| **Core (SEN + TRF)** | Sensibilidade sensorial e dificuldade em transições | Paciente com sensibilidade clara e resistência a mudanças |
| **Completa (+ RIG)** | Também rigidez comportamental | Quando há inflexibilidade significativa além da sensorialidade |

### Como ativar

Na ficha do paciente, card "Camada AuDHD" → escolha o modo → informe o motivo clínico (opcional mas recomendado). A ativação é registrada no log de auditoria com data, hora e quem ativou.

Você pode mudar o modo a qualquer momento. O histórico de todas as mudanças fica preservado — você nunca perde quando foi ativado, desativado ou alterado.

### O que muda na sessão quando AuDHD está ativa

- Campos SEN e TRF aparecem no formulário de observação
- Se modo Completo: campo RIG (estado + severidade) também aparece
- Badge "AuDHD Core" ou "AuDHD Full" aparece no cabeçalho da sessão
- O score AuDHD entra no cálculo do CSO-TDAH com o peso configurado

### O que NÃO muda

- O fluxo de trabalho continua igual
- Protocolos sem marcação AuDHD continuam disponíveis normalmente
- O professor e a família nunca veem a informação de AuDHD — está protegida

---

## 10. DRC — DAILY REPORT CARD

### O que é

O DRC (Registro Diário Escolar) é um dos diferenciais mais práticos do AXIS TDAH. Em vez de ligar para o professor ou esperar a reunião escolar, o professor preenche as metas comportamentais diretamente no portal dele — e você revisa pelo sistema.

**Regra:** máximo de 3 metas por paciente por dia. Isso é proposital — mantém foco e evita sobrecarga para o professor.

### Como funciona na prática

1. Você gera um token de acesso para o professor (menu Escola → "+ Gerar Acesso")
2. O professor recebe o link do portal escolar por email
3. No portal, o professor vê: nome do paciente, protocolos ativos (só código e título), DRCs dos últimos 30 dias
4. A cada dia, o professor preenche: meta, se foi atingida, score estimado (0-100), observações
5. O DRC aparece no sistema para você revisar

### O que você vê no DRC

- Data, meta/comportamento descrito
- goal_met: atingida ✅ / não atingida ❌ / não avaliada —
- Score de 0 a 100 (estimativa do professor)
- Notas do professor
- Status de revisão: pendente ou revisado por você
- Link para o protocolo relacionado (quando informado)

### Revisar um DRC

Clique em "Revisar" na entrada do DRC → adicione suas notas clínicas → salve. Isso contextualiza o que o professor registrou com sua análise profissional.

### O que o professor NÃO vê

- Scores CSO-TDAH
- Snapshots ou histórico clínico
- Layer AuDHD
- Notas clínicas internas

Essa separação é intencional — o professor precisa apenas das informações funcionais para o trabalho dele.

---

## 11. MÓDULO ESCOLA — PORTAL DO PROFESSOR

### Como gerar o acesso

Menu Escola → "+ Gerar Acesso para Professor"

Selecione o paciente e informe: nome do professor, email, escola. Escolha o prazo de expiração (30, 90, 180 ou 365 dias). O sistema gera um link único — copie e envie para o professor.

### O token de acesso

Cada professor tem um link único e seguro. O link não exige senha — o professor acessa diretamente. Se o acesso precisar ser revogado (troca de professor, mudança de escola), clique em "Revogar" na lista de tokens. A revogação é imediata.

### O que o professor pode fazer no portal

- Ver dados básicos do paciente (nome, idade)
- Ver protocolos ativos (só código e título — sem detalhes clínicos)
- Preencher DRCs diários
- Ver o histórico de DRCs dos últimos 30 dias

### Gerenciar os tokens

Menu Escola mostra todos os tokens ativos, revogados e expirados. Filtre por status para organizar. O log de acesso registra quando o professor acessou o portal (útil para saber se ele está usando).

---

## 12. PORTAL FAMÍLIA

### Como funciona

O portal família dá aos responsáveis uma visão simplificada e segura do acompanhamento. Diferente do portal do professor, o portal família tem consentimento LGPD integrado: no primeiro acesso, o responsável lê e aceita os termos antes de ver qualquer dado.

### Gerar acesso para a família

Menu Família → "+ Gerar Acesso" → selecione o paciente e o responsável cadastrado (ou informe nome e parentesco). Defina o prazo de expiração. O sistema pode reaproveitar um token existente para o mesmo responsável — evita links duplicados.

### O que a família vê

- Protocolos do paciente com status simplificado (conquistado / em progresso / em revisão)
- Conquistas recentes (protocolos dominados)
- Resumos de sessão aprovados e enviados por você
- Sessões agendadas e realizadas (data, contexto)
- Sumário DRC dos últimos 30 dias

### O que a família NÃO vê

- Scores CSO-TDAH e snapshots
- Layer AuDHD
- Notas clínicas internas
- Observações detalhadas das sessões

### Badge LGPD

Na lista de tokens, cada responsável mostra se já aceitou o consentimento LGPD (badge verde "LGPD OK") ou se ainda não acessou (badge amarelo "Aguardando"). Útil para verificar se o link chegou.

---

## 13. MÓDULO CASA

O módulo Casa tem duas ferramentas para o trabalho com a família no ambiente doméstico.

### Rotinas Domésticas

Crie rotinas estruturadas para o paciente: manhã, tarde, noite, tarefa de casa, preparação escolar.

Cada rotina tem:
- Nome e tipo
- Passos numerados com pista visual (uma dica de como fazer)
- Plano de reforço (texto livre para orientar os pais)
- Status: ativa, pausada, concluída

Os pais podem seguir a rotina pelo portal família — veem os passos e o plano de reforço.

### Economia de Fichas

Crie um sistema de recompensas baseado em fichas para o paciente:

- Escolha o tipo de ficha: estrela ⭐, ponto 🔵, adesivo 🏷️ ou moeda 🪙
- Defina comportamentos que ganham fichas (target_behaviors) com a quantidade de fichas por comportamento
- Defina recompensas que trocam fichas (reinforcers) com o custo de cada recompensa
- Registre transações: ganhar, gastar, bônus (você define), reset (volta do zero)

O saldo atual fica visível no card — grande e claro, fácil de mostrar para a criança.

---

## 14. PLANO CLÍNICO TDAH

### O que é

O Plano é o equivalente ao PEI do ABA — um documento de metas clínicas de médio prazo, organizado por domínio.

### Como criar

Menu Plano → "+ Novo Plano" → escolha o paciente, dê um título, descreva o plano, adicione as metas.

Cada meta tem:
- Domínio clínico (veja lista abaixo)
- Título e critério de sucesso
- Status: ativa, conquistada, pausada, descontinuada
- Progresso em % (você atualiza manualmente)

### Os 14 domínios clínicos disponíveis

1. Atenção sustentada
2. Controle inibitório
3. Memória de trabalho
4. Flexibilidade cognitiva
5. Regulação emocional
6. Organização e planejamento
7. Iniciação de tarefas
8. Monitoramento de desempenho
9. Generalização de habilidades
10. Independência funcional
11. Interação social
12. Comunicação
13. Comportamento adaptativo
14. Qualidade de vida

### Ciclo de vida do plano

draft (rascunho) → ativo → concluído → arquivado

Você pode vincular protocolos ao plano para rastrear o progresso das metas com base no trabalho real das sessões.

---

## 15. ALERTAS CLÍNICOS

O sistema monitora automaticamente e gera alertas para situações que merecem sua atenção:

| Alerta | O que significa | Severidade |
|--------|-----------------|------------|
| **Score crítico** | CSO-TDAH < 50 — pouco progresso | Alta |
| **Regressão** | Protocolo voltou para ativo após domínio | Alta |
| **Sem sessão** | Paciente sem sessão registrada nos últimos dias | Média |
| **DRC pendente** | DRC não revisado por você | Média |
| **Queda de score** | Queda significativa entre sessões recentes | Média |

Os alertas aparecem no painel principal e na página dedicada de Alertas. Clique em qualquer alerta para ir direto à ficha do paciente. Terapeutas veem apenas alertas dos seus próprios pacientes. Admin e supervisor veem todos.

---

## 16. RELATÓRIOS

### Como gerar

Menu Relatórios → selecione o paciente e o período → clique "Gerar Relatório".

### O que o relatório inclui

- Resumo de scores CSO-TDAH do período (primeiro, último, variação)
- Tabela de todas as sessões com scores por bloco (Base, Executivo, AuDHD)
- Distribuição por contexto (clínico / domiciliar / escolar)
- Protocolos ativos e histórico de status
- DRC: taxa de sucesso, score médio
- Versão do motor e disclaimer clínico

### Imprimir ou salvar como PDF

O relatório é otimizado para impressão — clique "Imprimir / PDF" e o sistema abre o diálogo de impressão do navegador. Você pode salvar como PDF ou imprimir em papel.

### Quem pode acessar relatórios

Admin e supervisor sempre. Terapeutas também têm acesso — podem gerar relatórios dos seus próprios pacientes.

---

## 17. EQUIPE E PERFIS DE ACESSO

### Os 3 roles

| Role | Quem é | O que acessa |
|------|--------|--------------|
| **Admin** | Dono ou gestor da clínica | Tudo: pacientes, sessões, protocolos, relatórios, equipe, assinatura, configurações |
| **Supervisor** | Coordenador clínico | Todos os pacientes: sessões, protocolos, planos, relatórios, DRC. Não gerencia equipe nem assinatura |
| **Terapeuta** | Aplicador | Apenas seus próprios pacientes (os que ele cadastrou) |

### Como convidar alguém

Menu Equipe → "+ Convidar Membro" → informe o email e escolha o role. Se o convidado já tem conta no AXIS, o acesso é ativado automaticamente. Se ainda não tem conta, ele recebe um email de convite e o acesso é ativado ao criar a conta.

### Multi-clínica

Um profissional pode pertencer a mais de uma clínica. Ao fazer login, se tiver acesso a múltiplas clínicas, o sistema mostra uma tela de seleção. Para trocar de clínica, acesse a tela de seleção novamente. Os dados de cada clínica são completamente isolados.

---

## 18. LGPD E PRIVACIDADE

### Base legal

A clínica é a controladora dos dados. O AXIS TDAH é o operador (Psiform Tecnologia). Fundamento: Art. 18, Lei 13.709/2018 (LGPD) + tratamento de dados de saúde de menor.

### Exportação de dados (portabilidade)

Menu Configurações → Privacidade → "Exportar meus dados"

Gera um arquivo JSON completo com todos os dados do paciente: ficha, sessões, observações, snapshots CSO, DRCs, log AuDHD, audit logs. Somente admin e supervisor podem solicitar.

### Exclusão e anonimização

Você pode solicitar a exclusão de um paciente pelo menu Configurações → Privacidade. O processo:

1. Solicite o agendamento de exclusão (prazo: 90 dias)
2. Durante os 90 dias, você pode cancelar
3. Após os 90 dias, os dados são anonimizados

O que é **preservado mesmo após anonimização** (por obrigação legal):
- Snapshots CSO-TDAH (imutáveis — integridade clínica)
- Logs de auditoria (5 anos — compliance)
- Dados clínicos agregados (7 anos — CFM/CRP)

### Política de retenção

| Tipo de dado | Prazo |
|--------------|-------|
| Dados clínicos | 7 anos (CFM/CRP) |
| Relatórios gerados | 7 anos (CFM/CRP) |
| Logs de auditoria | 5 anos (compliance) |
| Snapshots CSO | Imutáveis (sempre preservados) |
| Acesso de professores | Enquanto token ativo |
| Acesso familiar | Enquanto token ativo e consentimento válido |

---

## 19. CONFIGURAÇÕES

### Perfil profissional

Menu Configurações → Perfil: altere nome, sobrenome e número do CRP/CRP_UF.

### Notificações

Ative ou desative: alertas de score crítico, notificação de DRC não revisado, aviso de sessão não realizada.

### Gerenciar assinatura

Menu Configurações → Plano: veja seu plano atual, limite de pacientes e data de renovação. Para fazer upgrade, acesse a página de Preços.

---

## 20. O QUE O AXIS TDAH NÃO FAZ

- **NÃO diagnostica** — o sistema registra o que você avaliou, não emite diagnóstico
- **NÃO prescreve intervenções** — a decisão de qual protocolo ativar é sempre sua
- **NÃO interpreta resultados** — scores e gráficos são ferramentas, não laudos
- **NÃO compartilha dados clínicos com professor ou família** — visibilidade é estritamente controlada
- **NÃO envia resumo aos pais sem sua aprovação** — você sempre revisa antes
- **NÃO substitui o prontuário** — é complementar ao seu registro clínico
- **NÃO gera laudos para convênio** — gera relatórios estruturados que você usa como base
- **NÃO altera histórico** — sessão fechada é imutável, snapshot é permanente
- **NÃO executa nenhuma ação automaticamente** — o motor calcula, você decide

---

## 21. PERGUNTAS FREQUENTES

### "Posso usar sem ter protocolo ativo?"

Sim. Você pode registrar sessões e observações sem nenhum protocolo ativo. O motor calcula com os dados disponíveis.

### "O que acontece se eu esquecer de fechar uma sessão?"

A sessão fica com status "em andamento" até você fechar. Só sessões fechadas geram snapshot CSO. Não há prazo para fechar — mas quanto antes, mais fiel o registro.

### "Posso ter mais de um terapeuta atendendo o mesmo paciente?"

No TDAH, cada paciente pertence ao terapeuta que o cadastrou (campo created_by). Para equipes multiprofissionais, use os roles de supervisor (que vê todos os pacientes). Edições futuras devem considerar compartilhamento explícito de pacientes entre terapeutas.

### "O professor precisa criar uma conta?"

Não. O professor acessa o portal escolar pelo link único gerado por você — sem login, sem senha, sem cadastro. Basta o link.

### "A família vê os scores CSO?"

Não. Jamais. O portal família mostra apenas protocolos (status simplificado), DRC resumido, sessões e resumos aprovados por você. Os scores clínicos são invisíveis para família e professor.

### "Como funciona a Layer AuDHD para o cálculo?"

Quando desativada, o bloco AuDHD não entra no CSO-TDAH. Quando ativada (Core ou Completa), o bloco AuDHD é calculado e entra no score final com o peso configurado (padrão 0.2). O modo Core usa SEN e TRF; o modo Completo usa SEN, TRF e RIG.

### "Posso desativar a Layer AuDHD depois de ativada?"

Sim. A qualquer momento. Ao desativar, o histórico fica preservado (incluindo todos os snapshots gerados com a layer ativa). O sistema nunca apaga histórico.

### "Qual a diferença entre Plano e Protocolo?"

O Protocolo é uma atividade clínica específica, com ciclo de vida e métricas. O Plano é um documento de metas de médio prazo — mais abrangente, com domínios clínicos e critérios de sucesso definidos por você. Os dois se complementam: os protocolos são os instrumentos, o plano é a direção.

### "O DRC substitui a comunicação com a escola?"

Não — ele estrutura e digitaliza essa comunicação. O professor continua sendo o parceiro clínico, mas agora os registros ficam no sistema, organizados, revisados por você e acessíveis a qualquer momento.

### "Como exporto dados para LGPD?"

Configurações → Privacidade → "Exportar meus dados". O arquivo JSON inclui tudo. Somente admin e supervisor têm acesso a essa função.

### "O sistema funciona no celular?"

O AXIS TDAH é um sistema web responsivo. Funciona no celular, mas foi otimizado para uso no computador — especialmente para o registro de observações durante a sessão.

### "Posso ter pacientes em duas clínicas diferentes?"

Você como profissional pode pertencer a mais de uma clínica. Cada clínica tem seus dados completamente isolados. Um paciente cadastrado em uma clínica nunca aparece em outra.

### "O que é o audit log e para que serve?"

É um registro imutável de todas as ações no sistema: quem fez o quê, quando, em qual paciente. Serve para compliance (LGPD, CRP), rastreabilidade clínica e segurança. Somente admin tem acesso ao audit log.

---

## 22. TERMINOLOGIA TDAH

| Termo | Significado |
|-------|-------------|
| Paciente | Criança ou adolescente em acompanhamento TDAH |
| Protocolo | Programa de trabalho clínico com objetivo definido |
| Observação | Registro de métricas durante uma sessão |
| Evento | Registro de um comportamento ou ocorrência específica |
| Snapshot | Registro imutável do score CSO ao fechar uma sessão |
| CSO-TDAH | Clinical State Object TDAH — índice de evolução clínica (0–100) |
| SAS | Atenção e permanência na tarefa (porcentagem 0–100) |
| PIS | Resposta a instruções e estrutura (4 níveis) |
| BSS | Autocontrole e regulação emocional (3 níveis) |
| EXR | Função executiva: organização e planejamento (4 níveis) |
| SEN | Sensibilidade sensorial — camada AuDHD (4 níveis) |
| TRF | Dificuldade em transições — camada AuDHD (4 níveis) |
| RIG | Rigidez comportamental — camada AuDHD (4 estados + severidade) |
| Layer AuDHD | Camada adicional para pacientes com TDAH + autismo |
| Tricontextual | Acompanhamento nos 3 ambientes: clínico, domiciliar e escolar |
| DRC | Daily Report Card — registro diário escolar preenchido pelo professor |
| Plano | Documento de metas clínicas de médio prazo por domínio |
| Token escola | Link de acesso seguro gerado para o professor |
| Token família | Link de acesso seguro gerado para o responsável |
| Economia de fichas | Sistema de recompensas comportamentais (fichas por comportamentos) |
| Rotina | Sequência estruturada de passos domésticos para o paciente |
| Faixa | Classificação do score CSO: Excelente / Bom / Atenção / Crítico |
| Audit log | Registro imutável de todas as ações no sistema |

---

## 23. INFORMAÇÕES TÉCNICAS (para perguntas avançadas)

- Motor: CSO-TDAH v1.0.0 (src/engines/cso-tdah.ts)
- Banco de dados: PostgreSQL multi-tenant (isolamento por company_id)
- Autenticação: Clerk (multi-clínica por organização)
- Email: Resend (resumos de sessão, convites de equipe)
- Pagamentos: Hotmart (product_id 7380571)
- Framework: Next.js 14 (App Router)
- Snapshots: append-only — nunca fazem UPDATE, sempre INSERT
- Audit logs: 5 anos de retenção
- Dados clínicos: 7 anos de retenção (CFM/CRP)
- Conformidade: LGPD (Lei 13.709/2018), CFM, CRP

## 24. ARQUITETURA DE SEGURANÇA — RLS E TOKENS

O AXIS TDAH usa duas camadas de isolamento entre clínicas: validação na aplicação (`withTenant` + `canAccessTdahPatient`) e Row Level Security (RLS) no PostgreSQL. As duas operam juntas — a aplicação garante o caminho feliz, e o banco recusa qualquer query que tente burlá-lo.

### Tabelas com RLS forced+enabled (17 atuais — Item 11 RLS finalizado em 30/04/2026)

- **Núcleo clínico (5, Fase A — migration 057):** tdah_patients, tdah_sessions, tdah_observations, tdah_events, tdah_snapshots
- **Portais públicos (3, Fase B.1 — migration 060):** tdah_drc, tdah_protocols, tdah_teacher_access_log
- **Internas baixo risco (5, Fase B.3 — migration 062):** tdah_token_transactions, tdah_guardians, tdah_patient_therapists, tdah_plans, tdah_plan_goals
- **Família (3, Fase B.2 — migration 064):** tdah_family_access_log, tdah_routines, tdah_token_economy
- **Histórico AuDHD (1, Fase B.4 — migration 064):** tdah_audhd_log

A policy `tenant_isolation` exige `tenant_id = app_tenant_id()`. A função `app_tenant_id()` lê o GUC `app.tenant_id` setado pelo middleware via `set_config(..., true)` por request. Sem GUC, levanta exception — fail-loud.

### Tabelas permanentemente FORA de RLS (decisão arquitetural)

#### Caminho A — Tokens hex64 UNIQUE (Item 11D)

`tdah_teacher_tokens` e `tdah_family_tokens` ficam **permanentemente fora de RLS** por design. Não é dívida técnica — é decisão consciente.

**Justificativa:**

1. **Token é hex64 globalmente UNIQUE** — 256 bits de entropia, gerado via `crypto.randomBytes(32).toString('hex')`. UNIQUE constraint garante zero colisão. Adivinhar token de outro tenant via SELECT cego é infactível (espaço de busca = 2^256).
2. **Lookup por token DESCOBRE o `tenant_id`** — o portal público recebe o token na URL e faz `SELECT tenant_id FROM ... WHERE token = $1` sem saber tenant a priori. Esse é o passo que viabiliza o `set_config('app.tenant_id', ..., true)` subsequente.
3. **RLS em tokens criaria chicken-and-egg sem ganho de segurança** — exigiria saber `tenant_id` antes de buscar o token. Validado empiricamente pela tentativa 059 (29/04/2026): smoke escola GET retornou HTTP 500 com `[AXIS RLS] app.tenant_id não definido`. Rollback em staging, prod nunca recebeu.

**Defesa-em-profundidade preservada:**

- Token UNIQUE bloqueia descoberta cross-tenant (espaço de busca infactível).
- Após resolver token → `tenant_id`, todas as queries subsequentes nos portais entram em wrap `BEGIN + set_config + COMMIT` (Caminho 2), e tabelas RLS-forced recusam cross-tenant.
- `validateToken` valida `expires_at` + `is_active` antes de retornar.
- Rate limit por IP em ambos os portais (30 req/min em GET, 15 req/min em POST DRC).

**Por que não existe migration ADR:**

Migrations existem pra mudanças no banco — alterar schema, rodar DDL, criar policies. Decisão de **não-aplicar** RLS via migration vazia poluiria o histórico DDL com prosa. A decisão fica documentada em:

- Comentários dos próprios portais (`app/api/escola/[token]/route.ts`, `app/api/familia/[token]/route.ts`)
- Esta seção
- `docs/NOTE_TDAH.md` (parágrafo de decisão 30/04/2026)
- `docs/audits/onda7_backlog.md` (Item 11D — decisão fechada)

#### Library tables sem `tenant_id` (Item 11G)

`tdah_protocol_library` fica **permanentemente fora de RLS** porque a tabela **não tem coluna `tenant_id`** — é uma library shared/global.

**Justificativa:**

1. **Conteúdo é catálogo curado pela Psiform**, não dado de tenant. Os 46 protocolos (42 P1 + 4 P1.1, Bible Anexo B, seed em migration 023) são lidos por todos os tenants do produto TDAH — não há multi-tenancy de catálogo.
2. **RLS pressupõe coluna discriminadora por tenant** — sem `tenant_id`, não há expressão possível para a policy. Aplicar RLS aqui exigiria primeiro adicionar `tenant_id` em todas as linhas, o que conflitaria com o modelo de catálogo global.
3. **Seed cresce monotonicamente** conforme novos protocolos forem curados; não há "deletar protocolo de outro tenant" como ameaça.

**Pattern de uso:**

- Os 5 callers principais (`/api/tdah/protocols/route.ts`, `/api/tdah/protocols/[id]/route.ts`, `/api/tdah/protocol-library/route.ts`, `/api/tdah/reports/route.ts`, `/api/tdah/lgpd/export/route.ts`) **leem direto sem `set_config('app.tenant_id', …)`** — não há GUC necessário para essa tabela.
- Quando o caller cruza `tdah_protocol_library` com tabelas RLS-protegidas (ex.: protocolos vinculados ao paciente em `tdah_protocols`, que tem RLS), o filtro de tenant vem **da tabela RLS-protegida do JOIN**, não da library. O `WHERE tdah_protocols.tenant_id = app_tenant_id()` (implícito pela RLS) já garante o isolamento — a library só serve metadados estáticos.
- Não há risco de vazamento porque library não armazena nada que dependa de tenant.

**Decisão documentada em:**

- Header da migration `064_tdah_rls_phase_b_2_b_4.sql` (seção "Tabelas EXCLUIDAS desta migration")
- Esta subseção
- `docs/audits/onda7_backlog.md` (Item 11G — decisão fechada)
- `docs/NOTE_TDAH.md` (parágrafo final 30/04/2026)

### Estado final do schema TDAH (20 tabelas, decisão arquitetural completa)

- 17 com RLS forced+enabled (lista acima)
- 2 fora por Item 11D (tokens hex64 UNIQUE)
- 1 fora por Item 11G (library shared sem `tenant_id`)
- **Zero tabelas `tdah_*` sem decisão arquitetural.**
