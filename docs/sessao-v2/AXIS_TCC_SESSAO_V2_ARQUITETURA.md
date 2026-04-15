# AXIS TCC — Sessão v2: Arquitetura de 2 Camadas

**Data:** 15/04/2026
**Versão:** 2.0 FINAL (11 ajustes de percepção + consistência + segurança clínica)
**Status:** Aprovado para execução

---

## 1. VISÃO GERAL

A página `/sessoes/[id]` será reestruturada em **4 blocos verticais** no mesmo scroll, sem abas separadas.

```
┌─────────────────────────────────────────┐
│  BLOCO 1 — TRANSCRIÇÃO                  │
│  (como está hoje, sem mudanças)         │
│  Upload / Gravar / Texto expandível     │
├─────────────────────────────────────────┤
│  BLOCO 2 — RELATÓRIO CLÍNICO (CFP)     │  ← NOVO
│  ┌─ Insight principal (1 linha IA) ──┐  │
│  │ "Sessão marcada por padrão de     │  │
│  │  evitação com 2 enfrentamentos"   │  │
│  └───────────────────────────────────┘  │
│  Gerado por IA, editável, salvável      │
│  Imprimível / Exportável PDF            │
│  • Objetivos da sessão                  │
│  • Resumo                               │
│  • Intervenção do psicólogo             │
│  • Observações clínicas                 │
│  • Encerramento / Tarefa de casa        │
├─────────────────────────────────────────┤
│  PREVIEW DE SINAIS (sempre visível)     │  ← NOVO
│  Evitação (2) · Ansiedade 0.8 ·        │
│  Catastrofização                         │
├─────────────────────────────────────────┤
│  BLOCO 3 — INSIGHTS AXIS               │  ← NOVO
│  Accordion, colapsado por padrão        │
│  • Emoções (com intensidade + badges)   │
│  • Tópicos extraídos (tags clicáveis)   │
│  • Distorções cognitivas                │
│  • Técnicas identificadas na sessão    │
│  • Micro-eventos (EVITOU/ENFRENTOU/...) │
│  • CSO / Flex Trend / Recovery Time     │
├─────────────────────────────────────────┤
│  BLOCO 4 — VER ESTRUTURA DA ANÁLISE    │  ← MIGRAÇÃO
│  Accordion, colapsado por padrão        │
│  • Fatos (o que hoje são analysis.fatos)│
│  • Pensamentos (analysis.pensamentos)   │
│  • Emoções brutas (analysis.emocoes)    │
│  (Pipeline Result REMOVIDO da UI)       │
└─────────────────────────────────────────┘
```

---

## 2. BLOCO 2 — RELATÓRIO CLÍNICO (DETALHAMENTO)

### 2.1 Fluxo do usuário

```
Transcrição existe
  └→ Botão "Gerar Relatório" (aparece)
       └→ IA gera rascunho narrativo
            └→ 5 campos editáveis (textarea)
                 └→ Botão "Salvar Relatório"
                      └→ Persiste no banco
                           └→ Botão "Exportar PDF" (aparece)
```

### 2.2 Campos do Relatório

| # | Campo | Geração IA | Editável | Obrigatório |
|---|-------|-----------|----------|-------------|
| 0 | **Insight principal (headline)** | 1 frase-síntese da sessão | ✅ (editável com ícone de lápis) | Sim |
| 1 | **Objetivos da sessão** | Inferido da transcrição + sessões anteriores | ✅ | Sim |
| 2 | **Resumo** | Síntese narrativa da sessão | ✅ | Sim |
| 3 | **Intervenção do psicólogo** | Técnicas e estratégias identificadas | ✅ | Sim |
| 4 | **Observações clínicas** | Comportamentos, padrões, sinais observados | ✅ | Não |
| 5 | **Encerramento / Tarefa de casa** | Tarefa proposta + plano de continuidade | ✅ | Não |

**Nota sobre o campo 0 (headline):** frase curta (máx 120 chars) que dá contexto imediato.
Default: gerado pela IA. Editável: o profissional pode ajustar clicando no ícone de lápis.

**Fallback:** se a IA retornar `headline: ""` (vazio), o frontend esconde o bloco headline completamente.
O profissional pode adicionar manualmente clicando em "+ Adicionar insight principal".
Nunca exibir placeholder genérico.

Exemplos:
- "Sessão focada em dinâmica familiar com 2 episódios de evitação emocional"
- "Primeiro enfrentamento de situação de exposição social — progresso significativo"
- "Sessão de acolhimento pós-crise — carga emocional elevada, sem técnica ativa"

### 2.3 Regras de geração (prompt IA)

**Input para a IA:**
- Texto completo da transcrição
- Análise TCC existente (fatos/pensamentos/emoções)
- Micro-eventos da sessão (se houver)
- Dados do paciente (nome, histórico resumido)
- Sessão anterior (resumo, se existir)

**Regras anti-alucinação:**
- Só usar informações presentes na transcrição
- Não inventar diagnósticos
- Não usar linguagem interpretativa ("o paciente sente que...")
- Usar linguagem descritiva ("foram observados relatos de...")
- Não mencionar medicamentos a menos que apareçam na transcrição
- Footer fixo: "Relatório assistido por IA — conteúdo revisado e aprovado pelo profissional responsável"

**Regras anti-genérico (obrigatório):**
- Cada seção DEVE conter pelo menos 1 elemento concreto da sessão (nome, situação, comportamento específico)
- PROIBIDO usar frases vazias como:
  - "foram discutidos temas importantes"
  - "a sessão abordou aspectos relevantes"
  - "questões emocionais foram trabalhadas"
  - "diversos assuntos foram mencionados"
  - "a paciente relatou suas dificuldades"
- Em vez de "foram trabalhadas questões familiares", escrever: "foram explorados conflitos com a avó materna relacionados à guarda da criança"
- Se a transcrição não tem conteúdo suficiente para ser concreto, escrever menos — nunca preencher com texto genérico

**Tom do texto:**
- 3ª pessoa
- Linguagem técnica acessível
- Frases curtas
- Padrão CFP/CRP

### 2.4 Estados do relatório

```
INEXISTENTE → (botão "Gerar Relatório")
    ↓
DRAFT      → (rascunho IA, editando, pode regenerar trechos)
    ↓
FINAL      → (profissional aprovou, editável a qualquer momento)
```

**Nota:** `exported` NÃO é estado — é evento. Exportar PDF não muda o status.
Controle de exportação via `exported_at` (timestamp) e `export_count` (contador).

### 2.5 Banco de dados — Nova tabela

```sql
CREATE TABLE session_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Campos do relatório
  headline TEXT,             -- Insight principal (1 frase, máx 120 chars)
  objectives TEXT,
  summary TEXT,
  intervention TEXT,
  observations TEXT,
  closing TEXT,
  
  -- Metadados
  status VARCHAR(20) DEFAULT 'draft', -- draft | final
  generated_by VARCHAR(20) DEFAULT 'ai', -- ai | manual
  ai_model VARCHAR(50),
  generation_prompt_hash VARCHAR(64), -- SHA256 do prompt usado
  
  -- Controle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  exported_at TIMESTAMPTZ,         -- último export
  export_count INT DEFAULT 0,      -- quantas vezes exportou PDF
  
  UNIQUE(session_id)
);

-- Índice
CREATE INDEX idx_session_reports_tenant ON session_reports(tenant_id);
CREATE INDEX idx_session_reports_session ON session_reports(session_id);

-- RLS (alinhar com padrão existente do projeto — verificar se usa app.current_tenant ou app.tenant_id)
ALTER TABLE session_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON session_reports
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- NOTA: worker_access REMOVIDO por segurança.
-- A geração IA deve receber tenant_id explícito via withTenant(), não via policy aberta.
-- Verificar no codebase se o padrão é 'app.current_tenant' ou 'app.tenant_id' e alinhar.
```

### 2.6 API — Novos endpoints

```
POST   /api/sessions/[id]/report/generate   → Gera rascunho IA
GET    /api/sessions/[id]/report             → Busca relatório
PUT    /api/sessions/[id]/report             → Salva edições
POST   /api/sessions/[id]/report/export-pdf  → Gera PDF
```

#### POST /api/sessions/[id]/report/generate

**Fluxo interno:**
1. Buscar transcrição completa da sessão
2. Buscar análise TCC (se existir)
3. Buscar micro-eventos da sessão
4. Buscar dados do paciente + resumo da sessão anterior
5. Montar prompt com regras anti-alucinação
6. Chamar OpenAI (gpt-4o-mini)
7. Parsear resposta em 5 campos
8. INSERT na session_reports com status='draft'
9. Retornar relatório

**Prompt template (estrutura):**
```
Você é um assistente que gera relatórios clínicos para sessões de 
Terapia Cognitivo-Comportamental.

REGRAS OBRIGATÓRIAS:
- Use APENAS informações presentes na transcrição fornecida
- NÃO invente diagnósticos ou medicamentos
- Use linguagem descritiva, 3ª pessoa
- Frases curtas e objetivas
- Padrão CFP

DADOS DA SESSÃO:
- Paciente: {nome}
- Sessão #{numero} — {data}
- Duração: {duracao} minutos
- Tipo: {tipo}

TRANSCRIÇÃO:
{transcricao}

ANÁLISE TCC (se disponível):
Fatos: {fatos}
Pensamentos: {pensamentos}
Emoções: {emocoes}

MICRO-EVENTOS (se disponível):
{micro_eventos}

SESSÃO ANTERIOR (se disponível):
{resumo_anterior}

Gere o relatório no formato JSON:
{
  "headline": "1 frase-síntese da sessão, máx 120 chars. Se não houver padrão claro, retorne string vazia.",
  "objectives": "...",
  "summary": "...",
  "intervention": "...",
  "observations": "...",
  "closing": "..."
}

REGRA PARA HEADLINE:
- Deve conter pelo menos 1 elemento concreto da sessão
- Se a transcrição não tiver padrão claro suficiente, retorne "" (vazio)
- NUNCA inventar síntese genérica tipo "Sessão produtiva com bons avanços"
```

### 2.7 Exportação PDF

**Conteúdo do PDF (só Camada 1):**
```
CABEÇALHO
  Logo AXIS (opcional) | Nome do profissional | CRP
  
DADOS DO PACIENTE
  Nome | Data da sessão | Sessão # | Duração | Tipo

CORPO
  1. Objetivos da Sessão
  2. Resumo
  3. Intervenção do Psicólogo
  4. Observações Clínicas
  5. Encerramento / Tarefa de Casa

RODAPÉ
  "Relatório assistido por IA — conteúdo revisado e aprovado 
   pelo profissional responsável"
  Data/hora de exportação
  "AXIS Clínico — axisclinico.com"
```

---

## 2.8 PREVIEW DE SINAIS (entre Relatório e Insights)

**Propósito:** 3 indicadores-chave visíveis sem precisar abrir o accordion de Insights. Funciona como "teaser" que convida a explorar mais.

**Visual:** 1 linha horizontal com até 2 chips, sempre visível após o relatório existir.

```
┌──────────────────────────────────────────────────────┐
│  🔴 Evitação (2)  ·  😰 Ansiedade 0.8               │
└──────────────────────────────────────────────────────┘
```

**Regras de seleção (máx 2 sinais):**
1. **Micro-evento dominante** — o tipo com maior contagem (EVITOU/ENFRENTOU/AJUSTOU/RECUPEROU)
2. **Emoção com maior intensidade** — do array `insights.emotions`

**Distorções cognitivas NÃO aparecem no Preview** — são interpretativas e requerem validação do profissional. Ficam apenas dentro do accordion de Insights com disclaimer.

**Thresholds de relevância mínima (não mostrar ruído):**
- Micro-evento: só aparece se contagem >= 2
- Emoção: só aparece se intensidade >= 0.5
- Se 0 sinais passam no threshold → não exibir o preview (esconder componente)
- Se 1 sinal passa → exibir só 1 chip
- Máximo: 2 chips

Se algum não existir (ex: sem micro-eventos), mostra apenas os disponíveis que passaram no threshold.

**Comportamento:** clicável — ao clicar em qualquer chip, abre o accordion de Insights na seção correspondente.

## 3. BLOCO 3 — INSIGHTS AXIS (DETALHAMENTO)

### 3.1 Seções do accordion

Cada seção é colapsável. Por padrão, todas colapsadas.

#### 3.1.1 Emoções (com intensidade)

**Fonte:** análise TCC existente + novo campo de intensidade
**Visual:** badges coloridos com intensidade

```
RAIVA ████████░░ 0.8    TRISTEZA ██████░░░░ 0.6
MEDO  ████░░░░░░ 0.4    CONFIANÇA ███░░░░░░░ 0.3
```

**Cores por emoção:**
| Emoção | Cor | Hex |
|--------|-----|-----|
| Raiva | Vermelho | #EF4444 |
| Tristeza | Azul | #3B82F6 |
| Medo | Roxo | #8B5CF6 |
| Ansiedade | Âmbar | #F59E0B |
| Confiança | Esmeralda | #10B981 |
| Alegria | Verde | #22C55E |
| Culpa | Cinza | #6B7280 |
| Vergonha | Rosa | #EC4899 |

#### 3.1.2 Tópicos extraídos

**Fonte:** NOVO — extraído pela IA durante geração do relatório
**Visual:** tags clicáveis (estilo da concorrente)

```
# dinâmica familiar  # limites  # autoestima  # padrão de evitação
```

**Implementação:** campo adicional no prompt de geração:
```json
"topics": ["dinâmica familiar", "limites", "autoestima", ...]
```

#### 3.1.3 Distorções cognitivas

**Fonte:** NOVO — extraído pela IA (INTERPRETATIVO — requer validação)
**Visual:** lista com ícone + nome + exemplo da sessão
**Disclaimer obrigatório:** texto fixo acima da lista

```
⚠️ "Possíveis distorções identificadas — requer validação do profissional"

⚡ Catastrofização — "Se eu falar, vai ser o fim"
🔮 Leitura mental — "Ela deve estar pensando que sou fraca"
⚖️ Pensamento tudo-ou-nada — "Nunca consigo fazer nada certo"
```

**Nota de segurança clínica:** identificar distorções é ato interpretativo que cabe ao profissional em supervisão. A IA sugere possibilidades baseadas na transcrição, nunca afirma. O disclaimer é obrigatório e não pode ser removido.

**Implementação:** campo adicional no prompt:
```json
"distortions": [
  { "type": "catastrophizing", "example": "Se eu falar..." },
  ...
]
```

#### 3.1.4 Técnicas TCC utilizadas

**Fonte:** NOVO — extraído da transcrição (o que o profissional efetivamente fez)
#### 3.1.4 Técnicas identificadas na sessão

**Fonte:** NOVO — extraído da transcrição (o que aconteceu na sessão)
**Visual:** chips/tags verdes
**Linguagem:** "identificadas na sessão", NÃO "utilizadas pelo profissional" (evita tom de avaliação)

```
✅ Reestruturação cognitiva  ✅ Exposição gradual  ✅ Registro de pensamentos
```

**NOTA:** `techniques_suggested` (técnicas sugeridas para próxima sessão) foi REMOVIDO da geração IA.
Sugestões de ação futura vêm exclusivamente do Suggestion Engine (determinístico, 12 regras, gate of silence).
Isso evita duas fontes de sugestão potencialmente contraditórias.

#### 3.1.5 Micro-eventos

**Fonte:** dados já existentes (tabela events)
**Visual:** como já está hoje, mas dentro do accordion

```
🔴 EVITOU (2)     🟡 ENFRENTOU (1)
🔵 AJUSTOU (0)    🟢 RECUPEROU (1)
```

#### 3.1.8 CSO / Flex Trend

**Fonte:** dados já existentes (clinical_states)
**Visual:** card resumido

```
┌──────────────────────────────────┐
│  CSO                             │
│  Ativação: 0.65  Rigidez: 0.42  │
│  Carga emocional: 0.71          │
│                                  │
│  Tendência: ↗ SUBINDO            │
│  Tempo de recuperação: 2.3 sess  │
└──────────────────────────────────┘
```

### 3.2 Banco de dados — Novos campos

Na geração do relatório, a IA também extrai insights. Esses dados são salvos na mesma tabela `session_reports` como JSON:

```sql
ALTER TABLE session_reports ADD COLUMN insights JSONB DEFAULT '{}';
```

**Estrutura do JSONB `insights`:**
```json
{
  "emotions": [
    { "name": "raiva", "intensity": 0.8 },
    { "name": "tristeza", "intensity": 0.6 }
  ],
  "topics": ["dinâmica familiar", "limites", "autoestima"],
  "distortions": [
    { "type": "catastrophizing", "label": "Catastrofização", "example": "Se eu falar..." }
  ],
  "techniques_identified": ["reestruturação cognitiva", "exposição gradual"],
  "ai_model": "gpt-4o-mini",
  "generated_at": "2026-04-15T12:00:00Z"
}
```

---

## 4. BLOCO 4 — VER ESTRUTURA DA ANÁLISE (MIGRAÇÃO)

### O que migra pra cá

| Elemento atual | Destino |
|----------------|---------|
| `analysis.fatos` (3 colunas) | Accordion "Fatos extraídos" |
| `analysis.pensamentos` | Accordion "Pensamentos identificados" |
| `analysis.emocoes` (lista) | Accordion "Emoções brutas" |
| `pipelineResult` | **REMOVIDO DA UI** → só log backend (console/Sentry) |

### Visual

```
▸ Ver estrutura da análise
  ├─ ▸ Fatos extraídos (4)
  ├─ ▸ Pensamentos identificados (3)
  └─ ▸ Emoções brutas (5)
```

**Label:** "Ver estrutura da análise" com ícone de lupa (Search)
**Default:** colapsado
**Tooltip:** "Dados extraídos pela IA a partir da transcrição. Útil para revisão detalhada ou supervisão."
**Pipeline Result:** removido completamente da UI clínica. Dados disponíveis apenas via logs do servidor para debugging.

---

## 5. FLUXO COMPLETO DO USUÁRIO

```
1. Profissional abre sessão
2. Grava/sobe áudio → transcrição automática
3. (opcional) Clica "Analisar TCC" → gera fatos/pensamentos/emoções
4. (opcional) Marca micro-eventos durante sessão
5. Clica "Gerar Relatório" ← NOVO
   └→ IA usa transcrição + análise TCC + micro-eventos
   └→ Gera: relatório (5 campos) + insights (emoções, tópicos, distorções, técnicas)
   └→ Tudo aparece na tela
6. Profissional revisa/edita o relatório
7. Clica "Salvar Relatório"
8. (opcional) Clica "Exportar PDF"
9. Finaliza sessão → Pipeline CSO roda
```

### Dependência importante

O botão "Gerar Relatório" só aparece SE:
- Existe transcrição com texto
- OU existe análise TCC

Se nenhum dos dois existe → não faz sentido gerar relatório narrativo.

---

## 6. DECISÃO: "ANALISAR TCC" vs "GERAR RELATÓRIO"

### Opção A — Dois botões, mas com auto-análise (DECISÃO FINAL)
- "Analisar TCC" → gera fatos/pensamentos/emoções (como hoje, mantido para backward compat)
- "Gerar Relatório" → **SE análise TCC não existe, roda internamente primeiro** → depois gera relatório narrativo + insights

**Fluxo interno do "Gerar Relatório":**
1. Verificar se `tcc_analyses` existe para esta sessão
2. Se NÃO existe → chamar endpoint `/api/analyze-tcc` internamente (server-side, não frontend)
3. Usar resultado da análise como input para geração do relatório
4. Profissional não precisa saber que são dois processos

**Vantagem:** melhor UX (1 clique faz tudo), backward compatible (Analisar TCC continua existindo para quem quer só a análise), relatório sempre tem dados ricos.

**Botão "Analisar TCC" permanece visível** — profissional pode usar sem gerar relatório. Mas "Gerar Relatório" não depende dele ter sido clicado antes.

---

## 7. ORDEM DE EXECUÇÃO (FASES)

### FASE 1 — Backend (banco + APIs)
1. Migration: criar tabela `session_reports`
2. API GET /api/sessions/[id]/report
3. API PUT /api/sessions/[id]/report (salvar edições)
4. API POST /api/sessions/[id]/report/generate (gerar com IA)
5. Testes unitários para as 3 APIs

### FASE 2 — Frontend Camada 1 (Relatório)
6. Componente `ClinicalReport.tsx` (5 campos editáveis + estados)
7. Botão "Gerar Relatório" na página da sessão
8. Estados: inexistente → draft → final
9. Auto-save ou botão "Salvar" (draft → final via botão "Aprovar Relatório")

### FASE 3 — Frontend Camada 2 (Insights)
10. Componente `InsightsPanel.tsx` (accordion)
11. Subcomponentes: EmotionBadges, TopicTags, DistortionList, TechniqueChips
12. Integrar com dados do relatório (campo `insights` JSONB)
13. Manter micro-eventos e CSO existentes

### FASE 4 — Migração Camada 4 (Analítico)
14. Mover Fatos/Pensamentos/Emoções para accordion "Ver estrutura da análise"
15. Remover Pipeline Result da UI (manter apenas em console.log/Sentry)
16. Limpar código antigo

### FASE 5 — PDF Export
17. API POST /api/sessions/[id]/report/export-pdf
18. Template PDF (só Camada 1 + cabeçalho + rodapé)
19. Botão "Exportar PDF" no frontend

### FASE 6 — Polish
20. Tooltip em cada seção explicando o que é
21. Loading states (skeleton) para geração
22. Mensagem de segurança ("relatório assistido por IA...")
23. Teste end-to-end com áudio real

---

## 8. ARQUIVOS IMPACTADOS

### Novos
```
app/api/sessions/[id]/report/route.ts          → GET + PUT
app/api/sessions/[id]/report/generate/route.ts → POST
app/api/sessions/[id]/report/export-pdf/route.ts → POST
app/components/ClinicalReport.tsx               → Camada 1 (relatório editável)
app/components/SignalsPreview.tsx                → Preview de 3 sinais
app/components/InsightsPanel.tsx                 → Camada 2 (accordion insights)
app/components/AnalyticalStructure.tsx           → Camada 4 (ver estrutura)
scripts/migrations/049_session_reports.sql       → DDL
```

### Modificados
```
app/sessoes/[id]/page.tsx  → Reestruturar layout (4 blocos)
app/components/SessionReport.tsx → Pode ser removido/refatorado
```

### Não modificados
```
app/api/transcribe/*       → Transcrição permanece igual
app/api/analyze-tcc/*      → Análise TCC permanece igual
app/api/events/*           → Micro-eventos permanecem igual
app/api/sessions/[id]/finish/* → Pipeline CSO permanece igual
src/engines/cso.ts         → CSO Engine permanece igual
```

---

## 9. PROMPT DE GERAÇÃO EXPANDIDO

Na chamada à OpenAI para gerar o relatório, o prompt pede TUDO de uma vez:

```
Responda APENAS com JSON válido, sem markdown:
{
  "headline": "1 frase-síntese da sessão (máx 120 caracteres)",
  "objectives": "texto...",
  "summary": "texto...",
  "intervention": "texto...",
  "observations": "texto...",
  "closing": "texto...",
  "insights": {
    "emotions": [{"name": "...", "intensity": 0.0-1.0}],
    "topics": ["..."],
    "distortions": [{"type": "...", "label": "...", "example": "..."}],
    "techniques_identified": ["técnicas identificadas na sessão a partir da transcrição"]
  }
}
```

**REGRAS CRÍTICAS:**
- `techniques_identified`: SOMENTE técnicas que aparecem EXPLICITAMENTE na transcrição. Linguagem neutra ("identificadas"), não avaliativa ("utilizadas pelo profissional").
- `techniques_suggested` foi REMOVIDO — sugestões vêm do Suggestion Engine (determinístico).
- `distortions`: são POSSIBILIDADES, não afirmações. O frontend exibe com disclaimer obrigatório.

**Uma chamada API → relatório completo + insights. Sem chamadas extras.**

---

## 10. VANTAGEM COMPETITIVA FINAL

| Feature | Concorrente | AXIS TCC v2 |
|---------|------------|-------------|
| Insight principal (headline) | ❌ | ✅ 1 frase-síntese no topo |
| Relatório da sessão | ✅ Gerado | ✅ Gerado + editável |
| Preview de sinais rápidos | ❌ | ✅ 2 indicadores sempre visíveis |
| Tópicos | ✅ Tags | ✅ Tags |
| Emoções | ✅ Badges simples | ✅ Badges + intensidade |
| Distorções cognitivas | ❌ | ✅ Com exemplo + disclaimer validação |
| Técnicas identificadas | ❌ | ✅ Linguagem neutra, sem julgamento |
| Micro-eventos 3ª Onda | ❌ | ✅ EVITOU/ENFRENTOU/AJUSTOU/RECUPEROU |
| CSO / Flex Trend | ❌ | ✅ Índice longitudinal |
| Transcrição self-hosted | ❌ (paga API) | ✅ Custo zero |
| Exportação PDF (só relatório) | ✅ | ✅ Padrão CFP limpo |
| Análise estrutural (avançado) | ❌ | ✅ Fatos/Pensamentos/Emoções |
| Sugestões determinísticas | ❌ | ✅ Suggestion Engine com gate of silence |

**Resultado:** o AXIS entrega tudo que a concorrente entrega + 8 features que ela não tem.
O relatório é limpo. Os insights são acessíveis sem poluir. Distorções vêm com disclaimer.
Sugestões têm fonte única de verdade (Suggestion Engine), não IA generativa.
