# PROMPT CC — AXIS TCC Sessão v2 — FASE 1: Backend (banco + APIs)

## CONTEXTO

O AXIS TCC está evoluindo a página `/sessoes/[id]` para incluir um **Relatório Clínico** gerado por IA e **Insights AXIS** extraídos automaticamente. Esta é a FASE 1: criar a tabela no banco e as APIs.

**Projeto:** `/root/axis-tcc`
**Stack:** Next.js (App Router), PostgreSQL (Docker: `axis-postgres`), Clerk auth
**Padrão de rotas existente:** todas usam `withTenant()` para isolamento multi-tenant
**Migration anterior:** 048 (a nova será 049)

---

## PASSO 1 — Migration 049: criar tabela session_reports

Criar arquivo: `scripts/migrations/049_session_reports.sql`

```sql
-- Migration 049: session_reports (relatório clínico + insights)
-- Data: 2026-04-15

CREATE TABLE session_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Campos do relatório
  headline TEXT,
  objectives TEXT,
  summary TEXT,
  intervention TEXT,
  observations TEXT,
  closing TEXT,
  
  -- Insights (JSONB)
  insights JSONB DEFAULT '{}',
  
  -- Metadados
  status VARCHAR(20) DEFAULT 'draft',
  generated_by VARCHAR(20) DEFAULT 'ai',
  ai_model VARCHAR(50),
  generation_prompt_hash VARCHAR(64),
  
  -- Controle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  exported_at TIMESTAMPTZ,
  export_count INT DEFAULT 0,
  
  UNIQUE(session_id)
);

CREATE INDEX idx_session_reports_tenant ON session_reports(tenant_id);
CREATE INDEX idx_session_reports_session ON session_reports(session_id);

ALTER TABLE session_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON session_reports
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY worker_access ON session_reports
  USING (current_setting('app.current_tenant', true) IS NULL);
```

**Aplicar na VPS:**
```bash
docker exec -i axis-postgres psql -U axis -d axis_tcc < scripts/migrations/049_session_reports.sql
```

**Verificar:**
```bash
docker exec axis-postgres psql -U axis -d axis_tcc -c "\d session_reports"
```

Me mostre o output dos dois comandos antes de prosseguir.

---

## PASSO 2 — API GET + PUT /api/sessions/[id]/report

Criar arquivo: `app/api/sessions/[id]/report/route.ts`

Este arquivo implementa:
- **GET** → busca relatório existente para a sessão
- **PUT** → salva edições do profissional (qualquer campo, incluindo headline)

**Regras obrigatórias:**
- Usar `withTenant()` do padrão existente (ver como `/api/sessions/[id]/route.ts` faz)
- Verificar que a sessão pertence ao tenant
- GET retorna `null` se não existir relatório (não é erro)
- PUT faz UPSERT (INSERT se não existe, UPDATE se existe)
- PUT atualiza `updated_at` sempre
- PUT aceita campos parciais (não precisa enviar todos)

**Response GET:**
```json
{
  "report": {
    "id": "uuid",
    "headline": "...",
    "objectives": "...",
    "summary": "...",
    "intervention": "...",
    "observations": "...",
    "closing": "...",
    "insights": { ... },
    "status": "draft",
    "created_at": "...",
    "updated_at": "..."
  }
}
```
Se não existe: `{ "report": null }`

**Body PUT:**
```json
{
  "headline": "texto editado",
  "objectives": "texto editado",
  "status": "final"
}
```
(aceita qualquer combinação dos campos)

**Após criar, verifique:**
```bash
cd /root/axis-tcc && npx tsc --noEmit 2>&1 | grep -i "report"
```

Me mostre o código criado e o output do TypeScript check.

---

## PASSO 3 — API POST /api/sessions/[id]/report/generate

Criar arquivo: `app/api/sessions/[id]/report/generate/route.ts`

Este é o endpoint principal — chama OpenAI para gerar o relatório + insights.

**Fluxo interno:**
1. `withTenant()` → verificar sessão pertence ao tenant
2. Buscar transcrição completa: query na tabela `transcripts` WHERE `session_id = $1` AND `tenant_id = $2`
3. Buscar análise TCC: verificar se existe em `tcc_analyses` (se a tabela existir — verificar primeiro com try/catch)
4. Buscar micro-eventos: query na tabela `events` WHERE `related_entity_id = $1` (session_id)
5. Buscar dados do paciente: JOIN sessions → patients para nome
6. Buscar relatório da sessão anterior: query `session_reports` JOIN `sessions` WHERE patient_id e session_number < current, ORDER BY session_number DESC LIMIT 1
7. Montar prompt (ver abaixo)
8. Chamar OpenAI `gpt-4o-mini` com `response_format: { type: "json_object" }`
9. Parsear JSON
10. INSERT na `session_reports` com `status = 'draft'`
11. Retornar relatório completo

**Prompt completo para a IA (copiar exatamente):**

```
Você é um assistente que gera relatórios clínicos para sessões de Terapia Cognitivo-Comportamental.

REGRAS OBRIGATÓRIAS:
- Use APENAS informações presentes na transcrição fornecida
- NÃO invente diagnósticos ou medicamentos
- Use linguagem descritiva, 3ª pessoa
- Frases curtas e objetivas
- Padrão CFP/CRP

REGRAS ANTI-GENÉRICO:
- Cada seção DEVE conter pelo menos 1 elemento concreto da sessão (nome, situação, comportamento específico)
- PROIBIDO frases vazias como: "foram discutidos temas importantes", "a sessão abordou aspectos relevantes", "questões emocionais foram trabalhadas", "diversos assuntos foram mencionados", "a paciente relatou suas dificuldades"
- Se não houver conteúdo suficiente para ser concreto, escreva menos — NUNCA preencha com texto genérico

REGRA HEADLINE:
- Deve conter pelo menos 1 elemento concreto da sessão
- Máximo 120 caracteres
- Se a transcrição não tiver padrão claro suficiente, retorne headline como string vazia ""
- NUNCA invente síntese genérica tipo "Sessão produtiva com bons avanços"

REGRA TÉCNICAS:
- techniques_used: SOMENTE técnicas que aparecem EXPLICITAMENTE na transcrição como ações do profissional
- techniques_suggested: técnicas que PODERIAM ser úteis na próxima sessão baseado nos padrões observados
- NUNCA misturar o que foi feito com o que poderia ser feito

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

Responda APENAS com JSON válido, sem markdown:
{
  "headline": "1 frase-síntese da sessão, máx 120 chars. Se não houver padrão claro, retorne string vazia.",
  "objectives": "objetivos abordados na sessão",
  "summary": "resumo narrativo da sessão",
  "intervention": "intervenções e estratégias utilizadas pelo profissional",
  "observations": "observações clínicas relevantes (comportamentos, padrões, sinais)",
  "closing": "encerramento, tarefa de casa, plano de continuidade",
  "insights": {
    "emotions": [{"name": "nome da emoção em português", "intensity": 0.0}],
    "topics": ["tópico1", "tópico2"],
    "distortions": [{"type": "tipo_em_inglês", "label": "Nome em português", "example": "frase exemplo da sessão"}],
    "techniques_used": ["técnica que o profissional usou"],
    "techniques_suggested": ["técnica sugerida para próxima sessão"]
  }
}
```

**Importante:**
- Usar `getOpenAI()` do padrão existente no projeto (verificar como `app/api/analyze-tcc` faz)
- Se já existir relatório para essa sessão, fazer UPDATE ao invés de INSERT (regeneração)
- Guardar `ai_model: 'gpt-4o-mini'` e hash SHA256 do prompt em `generation_prompt_hash`
- Usar `response_format: { type: "json_object" }` para garantir JSON válido

**Após criar, verifique:**
```bash
cd /root/axis-tcc && npx tsc --noEmit 2>&1 | grep -i "report\|generate"
```

Me mostre o código criado e o output do check.

---

## PASSO 4 — Verificação final Fase 1

Após os 3 passos, rode:

```bash
cd /root/axis-tcc && npm run next:build 2>&1 | tail -20
```

Se build passar, rode:
```bash
pm2 restart axis-tcc
```

Me mostre o output do build e do restart.

---

## REGRAS GERAIS (PARA TODOS OS PASSOS)

1. **Sempre use `withTenant()`** — copiar padrão de rotas existentes
2. **Nunca hardcode tenant_id** — sempre via Clerk auth
3. **TypeScript strict** — sem `any`, sem `@ts-ignore`
4. **Imports relativos** — seguir padrão do projeto
5. **Error handling** — try/catch com mensagens úteis, status codes corretos
6. **Não mexer em arquivos que não foram listados** — transcrição, analyze-tcc, events, CSO engine permanecem intocados
