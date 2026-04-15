# PROMPT CC — AXIS TCC Sessão v2 — FASE 4: Migração Analítico + Limpeza

## CONTEXTO

FASES 1-3 concluídas. Relatório clínico, preview de sinais e insights panel funcionando.
Agora: mover Fatos/Pensamentos/Emoções para accordion colapsado + remover Pipeline Result da UI.

**Projeto:** `/root/axis-tcc`

---

## PASSO 1 — Componente AnalyticalStructure.tsx

Criar arquivo: `app/components/AnalyticalStructure.tsx`

**Props:**
```typescript
interface AnalyticalStructureProps {
  analysis: {
    fatos: string[]
    pensamentos: string[]
    emocoes: string[]
  } | null
}
```

**Visual:** accordion colapsado por padrão com 3 sub-seções.

```
▸ Ver estrutura da análise (🔍)
  ├─ ▸ Fatos extraídos (4)
  ├─ ▸ Pensamentos identificados (3)
  └─ ▸ Emoções brutas (5)
```

**Estilo:**
- Container: `bg-slate-50 rounded-xl border border-slate-200`
- Header principal: 
  - Ícone: Lucide `Search`
  - Label: "Ver estrutura da análise"
  - `text-sm text-slate-500 font-medium`
  - Tooltip (title): "Dados extraídos pela IA a partir da transcrição. Útil para revisão detalhada ou supervisão."
- Sub-seções usam o MESMO visual dos 3 cards atuais (sky/amber/rose) mas dentro de accordions:
  - Fatos: `bg-sky-50 border-sky-200`
  - Pensamentos: `bg-amber-50 border-amber-200`
  - Emoções: `bg-rose-50 border-rose-200`
- Contagem entre parênteses no header de cada sub-seção

**Se analysis é null → componente não renderiza (retorna null).**

---

## PASSO 2 — Modificar página /sessoes/[id]

Modificar: `app/sessoes/[id]/page.tsx`

**O que REMOVER da página:**
1. O bloco inteiro `{analysis && (...)}` que renderiza os 3 cards lado a lado (grid-cols-3 com Fatos/Pensamentos/Emoções) — está por volta da linha 470-490
2. O bloco inteiro `{pipelineResult && (...)}` que renderiza "Pipeline TCC Processado" — está logo abaixo

**O que ADICIONAR:**
1. Importar `AnalyticalStructure`
2. Posicionar `<AnalyticalStructure analysis={analysis} />` APÓS `InsightsPanel`, como último bloco antes dos botões de finalização

**Pipeline Result:**
- REMOVER da UI completamente
- Os dados continuam sendo calculados pelo backend (rota `/api/sessions/[id]/finish`)
- Os console.log no backend continuam funcionando para debug
- Só não aparece mais na tela

**Ordem final dos blocos:**
1. Header da sessão
2. Transcrição
3. Botões (Analisar TCC / Gerar Relatório)
4. `<ClinicalReport>` 
5. `<SignalsPreview>`
6. `<InsightsPanel>`
7. `<AnalyticalStructure>` ← Fatos/Pensamentos/Emoções migrados aqui
8. Micro-eventos (botões EVITOU/ENFRENTOU etc — permanecem onde estão)
9. Notas / Finalizar sessão

**CUIDADO:** o state `analysis` continua existindo e sendo populado pelo botão "Analisar TCC". 
Não remover o `handleTCC()` nem o state. Só mudar onde o resultado é renderizado.

---

## PASSO 3 — Limpeza

1. Verificar se `app/components/SessionReport.tsx` ainda é usado na página
   - Se NÃO → pode ser mantido (não deletar, pode servir para relatório longitudinal)
   - Se SIM → avaliar se precisa refatorar
2. Remover imports não usados
3. Verificar se `pipelineResult` state pode ser simplificado (não precisa mais ser renderizado, mas se o handleFinish usa, manter o state)

---

## PASSO 4 — Build + teste

```bash
cd /root/axis-tcc && npm run next:build 2>&1 | tail -20
```

Build OK:
```bash
pm2 restart axis-tcc
```

**Teste visual (me confirme):**
1. Abrir sessão com transcrição e análise TCC existente
2. Confirmar que Fatos/Pensamentos/Emoções aparecem dentro de "Ver estrutura da análise" (colapsado)
3. Confirmar que Pipeline Result NÃO aparece em lugar nenhum da tela
4. Confirmar que "Analisar TCC" ainda funciona e popula o AnalyticalStructure

Me mostre output do build e confirme os 4 itens.
