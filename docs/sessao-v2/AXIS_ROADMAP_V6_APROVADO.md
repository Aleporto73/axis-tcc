# AXIS TCC — Roadmap v6.0 APROVADO

**Data:** 16/04/2026
**Status:** APROVADO para execução
**Revisões:** 3 LLMs + análise independente do líder — consenso atingido

---

## CONTEXTO

### O que já foi entregue (Fases 1-6 Sessão v2 em produção)
- Relatório clínico gerado por IA (editável, 5 campos + headline)
- Insights AXIS (emoções com intensidade, tópicos, distorções com disclaimer, técnicas identificadas)
- Preview de sinais com thresholds
- Estrutura analítica (Fatos/Pensamentos/Emoções) colapsada
- Export PDF client-side (jsPDF, padrão CFP)
- Auditoria completa (REPORT_GENERATE/EDIT/APPROVE/EXPORT)

### O que motiva este roadmap
Uma cliente em potencial comparou o AXIS com concorrente e disse que a concorrente "entrega mais". Análise identificou 2 gaps reais:
1. **Continuidade clínica** — AXIS não mostra evolução entre sessões
2. **Primeira impressão visual** — transcrição em parede de texto parece amadora

### Princípio guia
> **Inteligência como diferencial, gestão mínima pra não ser descartado, visual decente pra não perder na primeira impressão.**

---

## AÇÃO OBRIGATÓRIA ANTES DE EXECUTAR

**Validar o problema real com a cliente que reclamou.** Todo o plano assume que o problema é transcrição feia + falta de continuidade clínica. É hipótese não testada.

### Mensagem a enviar (hoje)

> *"Oi [nome], preciso de 2 minutos da sua opinião honesta.*
>
> *Quando você abriu o AXIS, chegou a ver o Relatório Clínico gerado pela IA, os Insights (emoções com intensidade, distorções cognitivas, técnicas identificadas) e a comparação entre sessões?*
>
> *Ou o que mais te incomodou foi a tela de transcrição parecendo parede de texto?*
>
> *Pergunto porque estou priorizando melhorias e quero investir no que realmente importa pra você."*

### Interpretação da resposta

| Resposta da cliente | Ordem de execução |
|---------------------|-------------------|
| "Transcrição ruim, não explorei o resto" | Fase 9 → 7 → 8 → 10 → 11 |
| "Vi o motor e achei pouco/incompleto" | Fase 7 → 8 → 9 → 10 → 11 (ordem padrão) |
| "Não cheguei a explorar direito" | Ordem padrão + reforçar onboarding |

**Tempo de espera:** 1-2 dias úteis. Vale a pena vs executar 10 dias na ordem errada.

---

## RESSALVAS DE EXECUÇÃO (valem para TODAS as fases)

Ignorar qualquer ressalva quebra o DNA do AXIS. Ler antes de começar qualquer fase.

### R1 — Headline como FALLBACK do Foco (com proteção anti-confusão)

O "Foco" do Contexto Clínico (Fase 7) usa a headline da última session_report **apenas enquanto a Base do Caso não existir**. Quando a Fase 10 estiver pronta, o Foco passa a vir do campo próprio da Base do Caso.

**Labels obrigatórios:**
- Enquanto usa headline: **"Último tema da sessão anterior"** (NUNCA "Foco do caso")
- Tooltip no hover: *"Este é o assunto da última sessão, não necessariamente o foco do tratamento. Preencha a Base do Caso para definir o foco real."*
- Quando Base do Caso existir e tiver foco definido: label muda para **"Foco do tratamento"**

**Regra de prioridade visual:** Base do Caso existe → ela domina o bloco. Não existe → headline como fallback com label protegido.

**Motivo:** um psicólogo batendo o olho rápido não pode confundir tema da última sessão com foco do tratamento. Ex: último tema foi "luto pelo avô", mas o caso é sobre evitação social.

### R2 — Highlight regex REMOVIDO da Fase 9

A ideia original era colar badges [EVITOU]/[ENFRENTOU]/etc na transcrição via regex. **Não entra na Fase 9.**

**Motivo:** falso positivo em contexto clínico tem peso maior que em outros produtos. Exemplo concreto: paciente diz *"evitei falar sobre meu pai porque ele é sensível comigo"* — regex bate em "evitei" e cola [EVITOU], mas clinicamente isso não é evitação patológica, é respeito familiar. Contaminar a transcrição com tags incorretas queima credibilidade.

**Reclassificação:** vira Fase 12+ experimental, só implementar após testar com 5-10 psicólogos reais se a conexão visual ajuda ou atrapalha.

**Fase 9 entrega apenas:** timestamps, abas, parágrafos por pausa.

### R3 — Fase 11 só como INPUT AUXILIAR

Conectar Suggestion Engine à Evolução = passar o delta como parâmetro adicional. **NÃO reescrever nenhuma regra do engine.** O engine determinístico continua sendo a fonte de verdade. Delta é só mais um dado disponível.

### R4 — Regra fechada de "estável" (valor inicial, a calibrar)

CSO classificado assim:
- `|delta CSO| < 0.05` → **estável** (ícone →)
- `delta CSO >= 0.05` → **↑ aumentou**
- `delta CSO <= -0.05` → **↓ diminuiu**

**Importante:** o threshold 0.05 é valor INICIAL chutado, sem base empírica. Deve ser validado com amostra de 20+ sessões reais e ajustado conforme os dados.

**Implementação:** constante configurável em `src/config/thresholds.ts` para facilitar ajuste posterior sem redeploy.

Sem exceções. Sem interpretação. É fórmula com threshold documentado como provisório.

### R5 — Fallbacks obrigatórios do Contexto

| Situação | O que exibir |
|----------|--------------|
| Sem sessão anterior | "Primeira sessão do paciente" |
| Sem clinical_state | "CSO ainda não calculado" |
| Sem headline | "Foco não definido" |
| Sem Base do Caso (quando Fase 10 existir) | badge "Base do caso incompleta" |

**Nunca mostrar bloco vazio ou quebrado.**

---

## FASE 7 — CONTEXTO CLÍNICO MÍNIMO (1-2 dias)

### O que é
Bloco no topo da página da sessão mostrando o estado atual do paciente ANTES de abrir a sessão.

### Visual esperado
```
PACIENTE: Pedro Henrique
Última sessão: há 7 dias
CSO atual: 0.68 → (estável)
Último tema da sessão anterior: "evitação em contexto social"
```

### Como é gerado
- **CSO atual** → query em `clinical_states` (último registro do paciente)
- **Última sessão** → query em `sessions` (data da anterior)
- **Último tema** → headline da última `session_report` (ver R1)
- **Status CSO** → cálculo delta vs penúltima sessão (ver R4)

### Regras críticas
- Aplicar R1 (labels de fallback) e R5 (fallbacks para dados ausentes)
- Zero IA nova. Zero chamada a OpenAI. Apenas queries SQL
- Componente `ClinicalContext.tsx` renderizado no topo de `/sessoes/[id]`

### Por que é Fase 7 (e não depois)
Contexto dá significado à Evolução (Fase 8). Sem contexto, "CSO subiu 0.06" é número solto.

---

## FASE 8 — EVOLUÇÃO ENTRE SESSÕES (1-2 dias)

### O que é
Bloco que aparece na sessão atual (quando há sessão anterior) mostrando o delta clínico.

### Visual esperado
```
EVOLUÇÃO VS SESSÃO ANTERIOR
CSO:         0.62 → 0.68  ↑  (+0.06)
Evitação:    3 → 2        ↓
Enfrentamento: 0 → 1      ↑
Recuperação: 1 → 1        →

TIMELINE (últimas 3-5 sessões)
Sessão 7 — primeira exposição social
Sessão 8 — evitou contato em reunião
Sessão 9 — enfrentou conversa com chefe ← ATUAL
```

### Componentes
- Delta CSO (valor numérico + seta direcional conforme R4)
- Delta micro-eventos (contagem atual vs anterior + setas)
- Timeline curta das últimas 3-5 sessões com headlines
- Indicadores visuais neutros: ↑ aumentou | → estável | ↓ diminuiu

### Regras críticas
- **NÃO incluir frases interpretativas** ("resposta à intervenção", "regressão", "padrão persistente")
- Interpretação clínica cabe ao profissional, não ao sistema
- Aplicar R4 (threshold configurável) e R5 (fallback "Primeira sessão do paciente")
- Zero IA. Cálculo puro. Indicadores neutros.

---

## FASE 9 — TRANSCRIÇÃO VISUAL PREMIUM (1-2 dias)

### Por que entra aqui
A primeira coisa que o psicólogo vê ao abrir a sessão é a transcrição. Se parece amadora, fecha o produto antes de ver Contexto/Evolução/Relatório. Primeira impressão importa.

### Escopo desta fase
- Timestamps por segmento (faster-whisper já retorna, só armazenar e renderizar)
- Abas "Transcrição / Relatório / Anotações"
- Quebrar texto em parágrafos por pausa (já vem segmentado do whisper)

### Fora do escopo
- **Highlight regex** (vai pra Fase 12+ experimental — ver R2)
- Diarização (T: / P:) — só se testar impacto em performance
- Indicador "Neutralidade %" — descartado (cosmético, custo alto)

### Importante
- Não mexer na lógica do ASR worker
- Só adicionar armazenamento dos segments (que já vêm do whisper mas hoje são descartados)

---

## FASE 10 — BASE DO CASO TCC (2-3 dias)

### Posicionamento
Nome estratégico: **"Base do Caso"** (não "Anamnese"). Anamnese é commodity que qualquer sistema tem. Base do Caso mantém a identidade TCC do AXIS.

### Campos (4 blocos, não 7)
1. **Queixa principal** — o que trouxe o paciente
2. **Padrão identificado** — evitação / enfrentamento / ruminação / controle
3. **Gatilhos** — situações que disparam o padrão
4. **Crença central (hipótese)** — formulação do caso

### Integração
- Aparece no Contexto Clínico (Fase 7) substituindo a headline (ver R1)
- Alimenta o prompt do relatório (melhora qualidade do texto gerado)
- Editável a qualquer momento

### Trava suave
Se Base do Caso estiver vazia ou incompleta:
- Badge amarelo "Base do caso incompleta" no Contexto Clínico
- Não bloqueia nenhuma funcionalidade
- Clicar no badge leva direto pro formulário
- Força uso sem obrigar

---

## FASE 11 — SUGESTÃO CONECTADA À EVOLUÇÃO (1 dia)

### O que é
Conectar o Suggestion Engine existente com os dados de Evolução (Fase 8).

### Como
Hoje o Suggestion Engine funciona mas não "sabe" se houve piora/melhora entre sessões. Passar o delta da Fase 8 como parâmetro adicional melhora a qualidade das sugestões.

### Regra crítica (R3)
Delta entra como **input auxiliar**. **NÃO reescrever nenhuma regra do engine.** O engine determinístico continua sendo a fonte de verdade.

**Não é feature nova. É refinamento de feature existente.**

---

## ORDEM E ESTIMATIVAS

| # | Fase | Dias | Prioridade | Motivo |
|---|------|------|------------|--------|
| 7 | Contexto Clínico | 1-2 | CRÍTICA | Dá significado a tudo |
| 8 | Evolução + Timeline | 1-2 | CRÍTICA | Continuidade clínica visível |
| 9 | Transcrição visual | 1-2 | ALTA | Cobre o flanco visual |
| 10 | Base do Caso TCC | 2-3 | MÉDIA | Gestão mínima sem virar ERP |
| 11 | Sugestão conectada | 1 | BAIXA | Refinamento, não é blocker |

**Total estimado:** 7-10 dias úteis (calibrar para 12-15 considerando bugs e ajustes).

---

## O QUE NÃO FAZER

Lista consolidada de tudo que foi descartado após análise:

### Features de gestão (viram ERP, não agregam diferencial)
- ❌ Biblioteca de documentos genérica
- ❌ Templates livres (tipo Google Forms)
- ❌ Sistema financeiro / pagamento / comparecimento
- ❌ Bandeiras DSM (fora do escopo TCC)

### Features clínicas arriscadas
- ❌ Frases interpretativas automáticas ("em resposta à intervenção", "regressão", "padrão persistente")
- ❌ Regras determinísticas de classificação clínica além do delta CSO
- ❌ Hipóteses do caso geradas por IA
- ❌ Highlight regex de palavras-chave na transcrição (Fase 12+ experimental)

### Features cosméticas/caras
- ❌ Diarização automática antes de validar impacto em performance
- ❌ Indicador "Neutralidade %" por segmento

### Atitudes de projeto
- ❌ Adicionar mais sub-features antes de fechar as 5 fases acima
- ❌ Executar sem validar com cliente real

---

## CHECKLIST FINAL ANTES DE COMEÇAR

- [ ] Mensagem enviada para a cliente
- [ ] Resposta da cliente recebida (1-2 dias)
- [ ] Ordem de execução definida com base na resposta
- [ ] Pasta `docs/sessao-v2/` atualizada com este documento v6.0
- [ ] Commit + push para disponibilizar na VPS
- [ ] Escolha do CC: Claude Code via `/root/axis-tcc/docs/sessao-v2/PROMPT_CC_FASE7.md` (a ser gerado após validação)

---

## FRASE DE FECHAMENTO

> **Você não está mais desenhando produto. Está decidindo onde gastar energia.
> E isso depende da resposta da cliente, não de mais análise.**
