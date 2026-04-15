# PROMPT CC — AXIS TCC Sessão v2 — FASE 2: Frontend Relatório Clínico

## CONTEXTO

FASE 1 concluída: tabela `session_reports` criada, APIs GET/PUT/POST generate funcionando.
Agora: criar o componente `ClinicalReport.tsx` e integrar na página `/sessoes/[id]`.

**Projeto:** `/root/axis-tcc`
**Design system:** Tailwind, cores clínicas (blue-600 primary, amber alert, emerald success, neutral text)
**Padrão existente:** ver `app/components/SessionReport.tsx` para referência de estilo

---

## PASSO 1 — Componente ClinicalReport.tsx

Criar arquivo: `app/components/ClinicalReport.tsx`

**Props:**
```typescript
interface ClinicalReportProps {
  sessionId: string
  hasTranscript: boolean    // true se existe transcrição com texto
  hasAnalysis: boolean      // true se existe análise TCC
}
```

**Estados internos:**
- `report`: dados do relatório (ou null)
- `isGenerating`: boolean (loading da geração IA)
- `isSaving`: boolean
- `editMode`: boolean (toggle entre visualização e edição)
- `editedFields`: objeto parcial com campos editados

**Fluxo visual:**

### Estado 1: Sem relatório (report === null)
```
┌─────────────────────────────────────────────────┐
│  📋 Relatório Clínico                           │
│                                                  │
│  Nenhum relatório gerado para esta sessão.       │
│                                                  │
│  [🤖 Gerar Relatório]     ← botão indigo-600    │
│                                                  │
│  Botão só aparece se hasTranscript || hasAnalysis │
└─────────────────────────────────────────────────┘
```

### Estado 2: Gerando (isGenerating === true)
```
┌─────────────────────────────────────────────────┐
│  📋 Relatório Clínico                           │
│                                                  │
│  ████████████░░░░ Gerando relatório...           │
│  Analisando transcrição e extraindo insights     │
│                                                  │
│  (skeleton loading nos 5 campos)                 │
└─────────────────────────────────────────────────┘
```

### Estado 3: Relatório existe (modo visualização)
```
┌─────────────────────────────────────────────────────┐
│  📋 Relatório Clínico              [✏️ Editar]      │
│  status: DRAFT | FINAL                               │
│                                                       │
│  ┌─ headline (se não vazio) ────────────────────┐    │
│  │ "Sessão focada em dinâmica familiar com..."  │    │
│  └──────────────────────────────────────────────┘    │
│  (se headline vazio: "+ Adicionar insight principal") │
│                                                       │
│  ▎ Objetivos da sessão                               │
│  │ Texto gerado/editado...                           │
│                                                       │
│  ▎ Resumo                                            │
│  │ Texto gerado/editado...                           │
│                                                       │
│  ▎ Intervenção do psicólogo                          │
│  │ Texto gerado/editado...                           │
│                                                       │
│  ▎ Observações clínicas                              │
│  │ Texto gerado/editado...                           │
│                                                       │
│  ▎ Encerramento / Tarefa de casa                     │
│  │ Texto gerado/editado...                           │
│                                                       │
│  ── rodapé ──────────────────────────────────────    │
│  "Relatório assistido por IA — conteúdo revisado     │
│   e aprovado pelo profissional responsável"          │
│                                                       │
│  [🔄 Regenerar]  [✅ Aprovar]  [📄 Exportar PDF]    │
│  (Regenerar: só em draft)                            │
│  (Aprovar: draft → final)                            │
│  (Exportar PDF: sempre disponível se report existe)  │
└─────────────────────────────────────────────────────┘
```

### Estado 4: Modo edição (editMode === true)
- Cada campo vira `<textarea>` com auto-resize
- Headline vira `<input type="text" maxLength={120}>`
- Botões: [Salvar] [Cancelar]
- Salvar chama PUT /api/sessions/[id]/report

**Estilo:**
- Background: `bg-white` com `border border-blue-200 rounded-xl`
- Headline: `bg-blue-50 border-l-4 border-blue-500 p-3 text-blue-900 font-medium`
- Labels das seções: `text-xs font-semibold text-slate-500 uppercase tracking-wide`
- Texto das seções: `text-sm text-slate-700 leading-relaxed`
- Status badge: `draft` = amarelo, `final` = verde
- Footer IA: `text-xs text-slate-400 italic border-t border-slate-100 pt-3 mt-4`
- Botão Gerar: `bg-indigo-600 hover:bg-indigo-700 text-white`
- Botão Aprovar: `bg-emerald-600 hover:bg-emerald-700 text-white`
- Botão Exportar: `bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300`

**Após criar, verifique:**
```bash
cd /root/axis-tcc && npx tsc --noEmit 2>&1 | grep -i "clinical\|report"
```

Me mostre o código e o output.

---

## PASSO 2 — Componente SignalsPreview.tsx

Criar arquivo: `app/components/SignalsPreview.tsx`

**Props:**
```typescript
interface SignalsPreviewProps {
  insights: {
    emotions?: { name: string; intensity: number }[]
    distortions?: { type: string; label: string; example: string }[]
  } | null
  microEvents?: { type: string; count: number }[]
  onClickSignal?: (section: string) => void  // para abrir accordion no insight correspondente
}
```

**Lógica de thresholds:**
- Emoção: só aparece se `intensity >= 0.5`
- Micro-evento: só aparece se `count >= 2`
- Distorção: só aparece se `example` não vazio
- Máximo 3 chips
- Se 0 sinais passam → componente não renderiza (retorna null)

**Visual:** 1 linha horizontal com chips:
```
🔴 Evitação (2)  ·  😰 Ansiedade 0.8  ·  ⚡ Catastrofização
```

**Estilo:**
- Container: `flex items-center gap-3 py-3 px-4 bg-slate-50 rounded-lg border border-slate-200`
- Chips: `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80`
- Separador: `text-slate-300`
- Cada chip clicável (onClick → abre accordion correspondente)

**Cores dos chips:**
- Micro-evento: `bg-red-50 text-red-700 border border-red-200`
- Emoção: `bg-amber-50 text-amber-700 border border-amber-200`
- Distorção: `bg-violet-50 text-violet-700 border border-violet-200`

---

## PASSO 3 — Integrar na página /sessoes/[id]

Modificar: `app/sessoes/[id]/page.tsx`

**O que fazer:**
1. Importar `ClinicalReport` e `SignalsPreview`
2. Adicionar state: `const [report, setReport] = useState(null)`
3. No `loadSession()`, após carregar sessão, fazer fetch para `/api/sessions/${id}/report`
4. Posicionar os componentes APÓS a seção de transcrição atual, ANTES da seção de análise TCC

**Ordem dos blocos na página (de cima pra baixo):**
1. Header da sessão (como está)
2. Transcrição (como está)
3. `<ClinicalReport>` ← NOVO
4. `<SignalsPreview>` ← NOVO (só aparece se report existe e tem insights)
5. Análise TCC (Fatos/Pensamentos/Emoções) ← EXISTENTE (será movido na Fase 4)
6. Micro-eventos (como estão)
7. Pipeline Result (será removido na Fase 4)

**NÃO MEXER nos seguintes blocos existentes nesta fase:**
- Transcrição (upload/gravar/texto)
- Análise TCC (fatos/pensamentos/emoções)
- Micro-eventos
- Pipeline Result
- Botão "Analisar TCC"
- Botão "Finalizar Sessão"

**Após integrar:**
```bash
cd /root/axis-tcc && npm run next:build 2>&1 | tail -20
```

Se build passar:
```bash
pm2 restart axis-tcc
```

Me mostre o output do build e confirme que a página carrega sem erro.

---

## REGRAS

- Manter design system existente (Tailwind, cores blue/amber/emerald/neutral)
- Componentes client-side ('use client')
- Não instalar novas dependências
- Sem emojis nos componentes reais — usar ícones Lucide (FileText, Pencil, Check, Download, RefreshCw, ChevronDown, Search, Zap, AlertCircle)
- Acessibilidade: aria-labels em botões, role nos status badges
- Loading states com skeleton (div animado) — sem spinner genérico
