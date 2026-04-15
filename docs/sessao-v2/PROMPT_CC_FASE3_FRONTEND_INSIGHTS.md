# PROMPT CC — AXIS TCC Sessão v2 — FASE 3: Frontend Insights AXIS

## CONTEXTO

FASE 1 (banco + APIs) e FASE 2 (relatório clínico + preview sinais) concluídas.
Agora: criar o accordion de Insights AXIS com todas as seções.

**Projeto:** `/root/axis-tcc`

---

## PASSO 1 — Componente InsightsPanel.tsx

Criar arquivo: `app/components/InsightsPanel.tsx`

**Props:**
```typescript
interface InsightsPanelProps {
  insights: {
    emotions?: { name: string; intensity: number }[]
    topics?: string[]
    distortions?: { type: string; label: string; example: string }[]
    techniques_identified?: string[]
  } | null
  microEvents?: { type: string; intensity: number; note: string; created_at: string }[]
  cso?: {
    activation_level: number | null
    cognitive_rigidity: number | null
    emotional_load: number | null
    flex_trend: string | null
  } | null
  openSection?: string | null  // para abrir seção específica via SignalsPreview
}
```

**Estrutura: accordion com 6 seções, TODAS colapsadas por padrão.**

Se `openSection` é passado, abrir essa seção automaticamente.

### Seção 1: Emoções (com intensidade)
- Badges coloridos com barra de intensidade
- Cores por emoção:
  - Raiva: `bg-red-50 text-red-700 border-red-200`
  - Tristeza: `bg-blue-50 text-blue-700 border-blue-200`
  - Medo: `bg-violet-50 text-violet-700 border-violet-200`
  - Ansiedade: `bg-amber-50 text-amber-700 border-amber-200`
  - Confiança: `bg-emerald-50 text-emerald-700 border-emerald-200`
  - Alegria: `bg-green-50 text-green-700 border-green-200`
  - Culpa: `bg-slate-100 text-slate-700 border-slate-300`
  - Vergonha: `bg-pink-50 text-pink-700 border-pink-200`
- Barra: `<div>` com width proporcional à intensidade (0-1), cor de fundo da emoção
- Label: "Emoções identificadas"

### Seção 2: Tópicos extraídos
- Tags clicáveis (visual similar ao concorrente)
- Estilo: `bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-3 py-1 text-xs`
- Prefixo `#` em cada tag
- Label: "Tópicos da sessão"

### Seção 3: Distorções cognitivas
- **Disclaimer obrigatório no topo da seção:** `text-xs text-amber-600 italic mb-2` → "Possíveis distorções identificadas — requer validação do profissional"
- Lista com ícone + nome + exemplo
- Ícone: ⚡ (usar Lucide `Zap`)
- Exemplo em itálico, entre aspas
- Estilo: `bg-orange-50 rounded-lg p-3 border border-orange-100`
- Label: "Possíveis distorções cognitivas"

### Seção 4: Técnicas identificadas na sessão
- Chips verdes
- Ícone: ✅ (usar Lucide `CheckCircle`)
- Estilo: `bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1`
- Label: "Técnicas identificadas na sessão"
- **Linguagem neutra** — NÃO usar "utilizadas pelo profissional" (evita tom de avaliação)

**NOTA: Seção "Técnicas sugeridas" foi REMOVIDA. Sugestões vêm exclusivamente do Suggestion Engine.**

### Seção 5: Micro-eventos
- Dados já existentes (vindos da página pai)
- Manter visual atual: 4 badges com contagem
  - 🔴 EVITOU: `bg-red-100 text-red-700`
  - 🟡 ENFRENTOU: `bg-amber-100 text-amber-700`
  - 🔵 AJUSTOU: `bg-blue-100 text-blue-700`
  - 🟢 RECUPEROU: `bg-emerald-100 text-emerald-700`
- Label: "Micro-eventos 3ª Onda"

### Seção 6: CSO / Flex Trend
- Dados já existentes (vindos do pipeline)
- Card com 3 métricas + tendência
- Ativação, Rigidez, Carga emocional (barras)
- Flex trend: ↗ SUBINDO (verde) | → ESTÁVEL (amarelo) | ↘ DESCENDO (vermelho)
- Recovery time em sessões
- Label: "Estado Clínico (CSO)"

**Estilo geral do accordion:**
- Container: `bg-white rounded-xl border border-slate-200`
- Header de cada seção: `flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50`
- Ícone chevron rotaciona ao abrir/fechar
- Conteúdo: `px-4 pb-4`
- Se seção não tem dados: não renderiza (esconde completamente)

**Após criar, verifique:**
```bash
cd /root/axis-tcc && npx tsc --noEmit 2>&1 | grep -i "insights\|panel"
```

---

## PASSO 2 — Integrar InsightsPanel na página

Modificar: `app/sessoes/[id]/page.tsx`

1. Importar `InsightsPanel`
2. Posicionar APÓS `SignalsPreview`, ANTES da seção de análise TCC existente
3. Passar os dados: insights do relatório + microEvents existentes + CSO existente
4. Conectar `SignalsPreview.onClickSignal` → `InsightsPanel.openSection`
   - State compartilhado: `const [openInsightSection, setOpenInsightSection] = useState<string | null>(null)`
   - SignalsPreview passa `onClickSignal={setOpenInsightSection}`
   - InsightsPanel recebe `openSection={openInsightSection}`

**Após integrar:**
```bash
cd /root/axis-tcc && npm run next:build 2>&1 | tail -20
```

Build OK → `pm2 restart axis-tcc`

Me mostre output e confirme visualmente que a página carrega com o accordion abaixo do relatório.

---

## REGRAS

- Sem emojis nos componentes — usar ícones Lucide
- Ícones necessários: `ChevronDown, ChevronRight, Zap, CheckCircle, Lightbulb, Activity, TrendingUp, TrendingDown, Minus, Heart, Brain, Search`
- Acessibilidade: `aria-expanded` nos headers do accordion
- Animação: `transition-all duration-200` no conteúdo do accordion
- Se insights é null ou vazio → InsightsPanel não renderiza
